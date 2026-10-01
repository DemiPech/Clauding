// Onglet Collection : liste des emplacements, filtres, tirer pour actualiser.
import { UNPLACED, UNPLACED_LABEL, getApiKey } from '../cardnexus.js';
import { LOCATION_COLORS, PITCH_COLORS, els, escapeHtml, state } from './core.js';
import {
  cardnexusReady, deckInfo, deckLocations, enrichDecks, loadDeckLocations, showOnly,
} from './nav.js';
import { lineRowNode, loadLocations, locations, showToast, updateMovebar } from './moves.js';

// --- Emplacements ------------------------------------------------------------
//
// Toutes les locations, rangées par nature. Toucher un endroit l'ouvre dans la
// vue deck (mêmes outils de sélection et de déplacement) ; la recherche trouve
// une carte partout et permet de la déplacer sans ouvrir d'endroit.

const PLACE_KINDS = [
  { kind: 'other', label: 'Vrac & autres' },
  { kind: 'kallax', label: 'Kallax' },
  { kind: 'binder', label: 'Classeurs' },
  { kind: 'deck', label: 'Decks' },
];

/** Nature d'un endroit, d'après son icône CardNexus et son nom. */
function placeKind(location) {
  const name = location.name.toLowerCase();
  if (location.icon === 'deck') return 'deck';
  if (name.includes('kallax')) return 'kallax';
  if (/classeur|binder|album/.test(name) || location.icon === 'binder') return 'binder';
  return 'other';
}

/** Nombre de cartes par endroit, quand on le connaît (deck ouvert, rangement calculé). */
const placeCounts = new Map();
const placesSearch = { term: '', data: null };

const byPlaceName = (a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true });

/** Filtre de la Collection : nature d'emplacement et texte, mémorisés pour la session. */
const collectionFilter = { kind: 'all', text: '' };

/** Ordre des sections de la Collection : les decks d'abord. */
const COLLECTION_ORDER = ['deck', 'other', 'kallax', 'binder'];

async function showPlaces() {
  state.from = null;
  showOnly(els.places);
  if (!locations.length) {
    els.placesNote.textContent = 'Chargement des emplacements…';
    await loadLocations();
  }
  if (!getApiKey()) {
    els.placesNote.textContent =
      "Aucune clé d'API CardNexus : touchez ⚙ en haut à droite pour l'ajouter. Les decks FaBrary (onglet Chercher) fonctionnent sans.";
  } else if (cardnexusReady || locations.length) {
    els.placesNote.textContent = locations.length ? '' : 'Aucun emplacement trouvé sur votre compte CardNexus.';
  }
  els.placesCount.hidden = !getApiKey();
  renderPlacesList();
}

/** Sous-titre d'un emplacement : héros d'un deck, nombre de cartes s'il est connu. */
function placeSubtitle(name) {
  const info = deckInfo.get(name);
  const count = placeCounts.get(name);
  const parts = [info?.hero, count == null ? null : `${count} carte${count > 1 ? 's' : ''}`].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  if (deckLocations.some((loc) => loc.name === name) && !info) return 'chargement…';
  return 'toucher pour ouvrir';
}

/** Bouton d'un emplacement dans la liste, avec son nombre de cartes s'il est connu. */
function placeButtonNode(name, label, color) {
  const li = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'deck-card';
  button.dataset.place = name;
  button.style.setProperty('--chip', color || 'var(--line-strong)');
  button.innerHTML = `
    <img class="deck-card-art" alt="" hidden />
    <span class="deck-card-body">
      <span class="deck-card-name">${escapeHtml(label)}</span>
      <span class="deck-card-sub"></span>
    </span>
  `;
  // Une image introuvable ne doit pas laisser de cadre vide.
  button.querySelector('.deck-card-art').addEventListener('error', (event) => {
    event.target.hidden = true;
  });
  li.append(button);
  fillPlaceNode(button, name);
  return li;
}

function fillPlaceNode(button, name) {
  const sub = button.querySelector('.deck-card-sub');
  sub.textContent = placeSubtitle(name);
  sub.classList.toggle('is-pending', sub.textContent === 'chargement…');
  const art = button.querySelector('.deck-card-art');
  const imageUrl = deckInfo.get(name)?.imageUrl;
  if (imageUrl) art.src = imageUrl;
  art.hidden = !imageUrl;
}

/** Met à jour un emplacement déjà affiché (héros ou compte arrivé entre-temps). */
function updatePlaceNode(name) {
  const button = [...els.placesList.querySelectorAll('[data-place]')].find((b) => b.dataset.place === name);
  if (button) fillPlaceNode(button, name);
}

function renderPlacesList() {
  const text = collectionFilter.text.trim().toLowerCase();
  const matches = (name) => !text || name.toLowerCase().includes(text);
  const showKind = (kind) => collectionFilter.kind === 'all' || collectionFilter.kind === kind;

  // Les cartes sans emplacement, en tête tant qu'il en reste (ou qu'on ne sait pas).
  const nodes = [];
  const loose = placeCounts.get(UNPLACED);
  if (cardnexusReady && showKind('other') && loose !== 0 && matches(UNPLACED_LABEL)) {
    const section = document.createElement('section');
    section.className = 'picker';
    section.innerHTML = '<div class="section-head"><h2>À ranger</h2></div>';
    const list = document.createElement('ul');
    list.className = 'deck-cards';
    list.append(placeButtonNode(UNPLACED, UNPLACED_LABEL, 'var(--pitch-2)'));
    section.append(list);
    nodes.push(section);
  }

  const sections = COLLECTION_ORDER.map((kind) => {
    const { label } = PLACE_KINDS.find((k) => k.kind === kind);
    if (!showKind(kind)) return null;
    const list = locations.filter((loc) => placeKind(loc) === kind && matches(loc.name)).sort(byPlaceName);
    if (!list.length) return null;

    const section = document.createElement('section');
    section.className = 'picker';
    section.innerHTML = `
      <div class="section-head">
        <h2>${escapeHtml(label)}</h2>
        <span class="section-count">${list.length}</span>
      </div>
    `;

    const ul = document.createElement('ul');
    ul.className = 'deck-cards';
    for (const loc of list) ul.append(placeButtonNode(loc.name, loc.name, LOCATION_COLORS[loc.color]));
    section.append(ul);
    return section;
  }).filter(Boolean);

  nodes.push(...sections);
  if (!nodes.length && locations.length) {
    nodes.push(Object.assign(document.createElement('p'), { className: 'move-note', textContent: 'Aucun emplacement ne correspond.' }));
  }
  els.placesList.replaceChildren(...nodes);
}

// --- Tirer pour actualiser ---------------------------------------------------

/** Distance à tirer (en px) pour déclencher l'actualisation. */
const PULL_THRESHOLD = 70;
let refreshing = false;

/**
 * Relit emplacements et decks sans le cache de l'app. Les comptes de cartes
 * connus sont oubliés (ils ont pu changer) ; les decks se recomptent seuls,
 * les autres emplacements avec « Compter les cartes ».
 */
async function refreshCollection() {
  if (refreshing) return;
  refreshing = true;
  els.placesRefresh.disabled = true;
  setPullState('loading');
  try {
    await fetch('/api/cardnexus/refresh');
    placeCounts.clear();
    deckInfo.clear();
    await Promise.all([loadDeckLocations(), loadLocations()]);
    renderPlacesList();
    enrichDecks();
    showToast(`Collection actualisée · ${locations.length} emplacement${locations.length > 1 ? 's' : ''}.`);
  } catch (err) {
    showToast(`Actualisation impossible : ${err.message}`, { error: true });
  } finally {
    refreshing = false;
    els.placesRefresh.disabled = false;
    setPullState('idle');
  }
}

/** Indicateur en haut de la Collection : idle, pulling (avec la distance), ready, loading. */
function setPullState(mode, distance = 0) {
  els.ptr.dataset.state = mode;
  const height = mode === 'loading' ? 44 : mode === 'idle' ? 0 : Math.min(distance, PULL_THRESHOLD * 1.4) * 0.6;
  els.ptr.style.height = `${height}px`;
  els.ptrText.textContent =
    mode === 'loading' ? 'Actualisation…' : mode === 'ready' ? 'Relâcher pour actualiser' : 'Tirer pour actualiser';
}

/** Le geste « tirer vers le bas » sur la Collection. */
function listenForPull() {
  let startY = null;
  let distance = 0;
  const pullable = () =>
    !els.places.hidden && window.scrollY <= 0 && !refreshing && !document.querySelector('.sheet-backdrop:not([hidden])');

  window.addEventListener(
    'touchstart',
    (event) => {
      startY = pullable() && event.touches.length === 1 ? event.touches[0].clientY : null;
      distance = 0;
    },
    { passive: true },
  );
  window.addEventListener(
    'touchmove',
    (event) => {
      if (startY === null) return;
      distance = event.touches[0].clientY - startY;
      if (distance <= 0 || window.scrollY > 0) {
        setPullState('idle');
        return;
      }
      setPullState(distance >= PULL_THRESHOLD ? 'ready' : 'pulling', distance);
    },
    { passive: true },
  );
  window.addEventListener('touchend', () => {
    if (startY === null) return;
    startY = null;
    if (distance >= PULL_THRESHOLD && !els.places.hidden) refreshCollection();
    else setPullState('idle');
  });
}

/** Compte toutes les cartes de la collection, endroit par endroit, en un balayage. */
async function countAllPlaces() {
  els.placesCount.disabled = true;
  els.placesNote.textContent = 'Comptage de toute la collection… (quelques secondes par tranche de 200 lignes)';
  try {
    const res = await fetch('/api/cardnexus/counts');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

    placeCounts.clear();
    let loose = 0;
    let total = 0;
    for (const { name, count } of data) {
      total += count;
      if (name === null) loose = count;
      else placeCounts.set(name, count);
    }
    // Un endroit vide n'apparaît pas dans le balayage : il vaut 0.
    for (const loc of locations) if (!placeCounts.has(loc.name)) placeCounts.set(loc.name, 0);
    placeCounts.set(UNPLACED, loose);

    els.placesNote.textContent =
      `${total} cartes au total.` + (loose ? ` ${loose} n'ont aucun emplacement.` : '');
    renderPlacesList();
  } catch (err) {
    els.placesNote.textContent = err.message;
  } finally {
    els.placesCount.disabled = false;
  }
}

async function runPlacesSearch(term) {
  placesSearch.term = term;
  els.placesSearchNote.textContent = 'Recherche…';
  try {
    const res = await fetch(`/api/cardnexus/search?q=${encodeURIComponent(term)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    placesSearch.data = data;
    els.placesSearchNote.textContent = data.cards.length
      ? `Réglez combien d'exemplaires prendre, puis choisissez la destination en bas.${data.truncated ? ' Premiers résultats seulement : affinez si besoin.' : ''}`
      : 'Aucune carte de votre collection ne correspond.';
  } catch (err) {
    placesSearch.data = null;
    els.placesSearchNote.textContent = err.message;
  }
  renderPlacesSearch();
}

function renderPlacesSearch() {
  const cards = placesSearch.data?.cards || [];
  if (!els.search.hidden) updateMovebar();
  els.placesSearchResults.replaceChildren(
    ...cards.map((card) => {
      const section = document.createElement('div');
      section.className = 'result-card';
      section.innerHTML = `
        <div class="result-card-head">
          <i class="row-pitch" style="--dot:${PITCH_COLORS[card.pitch] || 'var(--pitch-0)'}"></i>
          <span>${escapeHtml(card.name)}</span>
          <span class="count">${card.quantity} exemplaire${card.quantity > 1 ? 's' : ''}</span>
        </div>
      `;
      const list = document.createElement('ul');
      list.className = 'result-lines';
      list.append(...card.lines.map((line) => lineRowNode(line, card, { showLocation: true })));
      section.append(list);
      return section;
    }),
  );
}

export {
  PLACE_KINDS, byPlaceName, collectionFilter, countAllPlaces, listenForPull, placeCounts,
  placeKind, placesSearch, refreshCollection, renderPlacesList, renderPlacesSearch,
  runPlacesSearch, showPlaces, updatePlaceNode,
};
