// Navigation par onglets, barre du haut et liste des decks CardNexus.
import { els, state } from './core.js';
import { isStoragePlace, renderDeck } from './deck-view.js';
import { updateMovebar } from './moves.js';
import {
  placeCounts, renderPlacesList, renderPlacesSearch, showPlaces, updatePlaceNode,
} from './places.js';
import { scheduleAutoSnapshot, showHistory } from './history.js';
import { importView, updateImportBar } from './import-view.js';
import { saveCollectionCache } from './collection-cache.js';
import { silent, startTask } from '../progress.js';

// --- Chargement ------------------------------------------------------------

// --- Navigation par onglets --------------------------------------------------
//
// Quatre onglets en bas : Collection (l'accueil), Chercher, Outils, Historique.
// Les vues de détail (un deck, un emplacement, un plan de montage, le
// rangement) s'ouvrent par-dessus l'onglet d'où l'on vient, qui reste allumé,
// et le retour y ramène.

/** Onglet auquel appartient chaque vue ; les autres gardent l'onglet courant. */
const VIEW_TABS = {
  places: 'collection',
  'search-view': 'search',
  'tools-view': 'tools',
  history: 'history',
  tidy: 'tools',
  import: 'tools',
};

function showOnly(el) {
  const views = [els.search, els.tools, els.loading, els.error, els.deck, els.build, els.places, els.tidy, els.history, importView];
  for (const node of views) node.hidden = node !== el;
  if (VIEW_TABS[el.id]) state.tab = VIEW_TABS[el.id];
  for (const tab of els.tabbar.querySelectorAll('[data-tab]')) {
    tab.classList.toggle('is-active', tab.dataset.tab === state.tab);
  }
  updateAppBar();
  updateMovebar();
  updateImportBar();
  window.scrollTo(0, 0);
}

/** Titres des écrans racines (les onglets) ; les autres ont une flèche retour. */
const ROOT_TITLES = { places: 'Collection', 'search-view': 'Chercher', 'tools-view': 'Outils', history: 'Historique' };

/**
 * Barre du haut à la manière d'Android : le nom de l'onglet à la racine, une
 * flèche retour et le titre de l'écran ouvert par-dessus.
 */
function updateAppBar() {
  const views = [els.places, els.search, els.tools, els.history, els.deck, els.build, els.tidy, importView, els.loading, els.error];
  const current = views.find((view) => !view.hidden);
  const root = current && ROOT_TITLES[current.id];
  let title = root || '';
  if (current === els.deck) title = state.deck?.name || '';
  else if (current === els.build) title = els.buildEyebrow.textContent.startsWith('Comparer') ? 'Comparer' : 'Monter un deck';
  else if (current === els.tidy) title = 'Ranger les vracs';
  else if (current === importView) title = 'Importer';
  else if (current === els.loading) title = 'Chargement…';
  else if (current === els.error) title = 'Indisponible';
  els.appTitle.textContent = title;
  els.appBack.hidden = Boolean(root);
  els.appBrand.hidden = !root;
}

/** L'accueil : l'onglet Collection. */
function showHome() {
  state.from = null;
  history.replaceState(null, '', location.pathname);
  document.title = 'Decklist Viewer — Flesh and Blood';
  showPlaces();
}

function showSearch() {
  showOnly(els.search);
  renderPlacesSearch();
}

function showTools() {
  showOnly(els.tools);
}

/** Revient à l'onglet d'où une vue de détail a été ouverte. */
function returnToTab(tab = state.from || state.tab) {
  if (tab === 'search') showSearch();
  else if (tab === 'tools') showTools();
  else if (tab === 'history') showHistory();
  else showHome();
}

function showTab(tab) {
  state.from = null;
  if (tab === 'search') showSearch();
  else if (tab === 'tools') showTools();
  else if (tab === 'history') showHistory();
  else showHome();
}

async function loadFromApi(endpoint, { historyUrl }) {
  showOnly(els.loading);
  els.loadBtn.disabled = true;

  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

    state.deck = data;
    // Regroupement par défaut : par classe pour un emplacement de rangement,
    // par pitch pour un deck. Un choix manuel vaut jusqu'à la prochaine ouverture.
    state.group = isStoragePlace(data) ? 'class' : 'pitch';
    els.groupSelect.value = state.group;
    if (data.source === 'cardnexus') {
      const { deck, weapons, equipment } = data.counts;
      placeCounts.set(data.deckId, deck + weapons + equipment + (data.hero?.quantity || 0));
    }
    history.replaceState(null, '', historyUrl);
    document.title = `${data.name} — Decklist Viewer`;
    renderDeck();
    showOnly(els.deck);
  } catch (err) {
    els.errorMessage.textContent = err.message;
    showOnly(els.error);
  } finally {
    els.loadBtn.disabled = false;
  }
}

const loadFabraryDeck = (input) => {
  const value = String(input || '').trim();
  if (!value) return Promise.resolve();
  els.input.blur();
  state.from = state.tab;
  return loadFromApi(`/api/deck?id=${encodeURIComponent(value)}`, {
    historyUrl: `?deck=${encodeURIComponent(value)}`,
  });
};

const loadCardnexusDeck = (location) =>
  loadFromApi(`/api/cardnexus/deck?location=${encodeURIComponent(location)}`, {
    historyUrl: `?location=${encodeURIComponent(location)}`,
  });

// --- Sélecteur de decks CardNexus -----------------------------------------

let deckLocations = [];
let cardnexusReady = false;

/**
 * Monter un deck ne demande qu'une clé CardNexus valide : on peut créer la
 * location à la volée, donc n'avoir aucun deck n'est pas bloquant. Le bouton
 * est réévalué quand l'inventaire arrive, car il arrive après le deck.
 */
function updateBuildButton() {
  els.buildBtn.hidden = state.deck?.source !== 'fabrary' || !cardnexusReady;
}

/** Héros et nombre de cartes de chaque deck, pour la liste de la Collection. */
const deckInfo = new Map();

/** Decks relus depuis l'ouverture de l'app (les autres viennent de la dernière fois). */
const refreshedDecks = new Set();

/** Ce qu'on garde d'un deck pour le prochain démarrage. */
function keepDeckInfo() {
  const kept = {};
  for (const [name, info] of deckInfo) {
    if (!info.failed) kept[name] = { ...info, count: placeCounts.get(name) ?? info.count ?? null };
  }
  saveCollectionCache({ deckInfo: kept });
}

/** Remet la liste des decks gardée la dernière fois, avant toute requête. */
function restoreDecks(decks, info = {}) {
  deckLocations = decks || [];
  cardnexusReady = true;
  for (const [name, { hero, imageUrl, count }] of Object.entries(info)) {
    deckInfo.set(name, { hero, imageUrl, count });
    if (count != null) placeCounts.set(name, count);
  }
}

/**
 * Complète les decks de la Collection (héros, cartes), deux à la fois pour
 * ménager l'API. En arrière-plan : l'écran reste utilisable, la barre du haut
 * montre l'avancement.
 */
async function enrichDecks() {
  const queue = deckLocations.map((loc) => loc.name).filter((name) => !refreshedDecks.has(name));
  if (!queue.length) return;
  const total = queue.length;
  let done = 0;
  const progress = startTask('Mise à jour des decks', { background: true });

  const worker = async () => {
    for (let name = queue.shift(); name; name = queue.shift()) {
      refreshedDecks.add(name);
      try {
        const res = await fetch(`/api/cardnexus/deck?location=${encodeURIComponent(name)}`, { progress: silent });
        const deck = await res.json();
        if (!res.ok) throw new Error(deck.error);
        const count = deck.counts.deck + deck.counts.weapons + deck.counts.equipment + (deck.hero?.quantity || 0);
        deckInfo.set(name, { hero: deck.hero?.name || null, imageUrl: deck.hero?.imageUrl || null });
        placeCounts.set(name, count);
      } catch {
        // Un deck illisible garde ce qu'on en savait la dernière fois.
        if (!deckInfo.has(name)) deckInfo.set(name, { hero: null, imageUrl: null, failed: true });
      }
      done += 1;
      progress.report(done / total, `${done} / ${total} decks`);
      if (!els.places.hidden) updatePlaceNode(name);
    }
  };

  try {
    await Promise.all([worker(), worker()]);
  } finally {
    progress.end();
    keepDeckInfo();
  }
}

/** Oublie quels decks ont été relus : la prochaine mise à jour les relit tous. */
function forgetRefreshedDecks() {
  refreshedDecks.clear();
}

async function loadDeckLocations({ background = false } = {}) {
  try {
    const res = await fetch('/api/cardnexus/decks', { background });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

    if (!data.configured) {
      els.placesNote.textContent =
        "Aucune clé d'API CardNexus : touchez ⚙ en haut à droite pour l'ajouter. Les decks FaBrary (onglet Chercher) fonctionnent sans.";
      return;
    }

    cardnexusReady = true;
    if (!loadDeckLocations.snapshotScheduled) {
      loadDeckLocations.snapshotScheduled = true;
      scheduleAutoSnapshot();
    }
    updateBuildButton();
    deckLocations = data.decks;
    saveCollectionCache({ decks: data.decks });
    if (!els.places.hidden) renderPlacesList();
    enrichDecks();
  } catch (err) {
    els.placesNote.textContent = `Inventaire CardNexus indisponible : ${err.message}`;
  }
}

export {
  cardnexusReady, deckInfo, deckLocations, enrichDecks, forgetRefreshedDecks,
  loadCardnexusDeck, loadDeckLocations, restoreDecks,
  loadFabraryDeck, returnToTab, showHome, showOnly, showSearch, showTab, showTools, updateAppBar,
  updateBuildButton,
};
