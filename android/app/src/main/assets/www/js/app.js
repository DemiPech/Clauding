import { getApiKey, setApiKey, UNPLACED, UNPLACED_LABEL } from './cardnexus.js';
import { diffSnapshots, snapshotTotal } from './snapshots.js';

const $ = (sel) => document.querySelector(sel);

const els = {
  form: $('#search-form'),
  input: $('#deck-input'),
  loadBtn: $('#load-btn'),
  search: $('#search-view'),
  searchHint: $('#search-hint'),
  tools: $('#tools-view'),
  toolBuild: $('#tool-build'),
  toolCompare: $('#tool-compare'),
  tabbar: $('#tabbar'),
  collectionFilter: $('#collection-filter'),
  collectionKinds: $('#collection-kinds'),
  compareDeckField: $('#compare-deck-field'),
  compareDeck: $('#compare-deck'),
  loading: $('#state-loading'),
  error: $('#state-error'),
  errorMessage: $('#error-message'),
  deck: $('#deck'),
  heroArt: $('#hero-art'),
  heroLine: $('#deck-hero-line'),
  name: $('#deck-name'),
  byline: $('#deck-byline'),
  stats: $('#deck-stats'),
  fabraryLink: $('#fabrary-link'),
  copyBtn: $('#copy-btn'),
  toolbar: $('.toolbar'),
  sections: $('#sections'),
  notes: $('#deck-notes'),
  notesBody: $('#notes-body'),
  preview: $('#preview'),
  previewImg: $('#preview-img'),
  lightbox: $('#lightbox'),
  lightboxImg: $('#lightbox-img'),

  linePicker: $('#line-picker'),
  linePickerTitle: $('#line-picker-title'),
  linePickerList: $('#line-picker-list'),
  linePickerClose: $('#line-picker-close'),

  movebar: $('#movebar'),
  movebarPanel: $('#movebar-panel'),
  moveSearch: $('#move-search'),
  moveSearchForm: $('#move-search-form'),
  moveSearchInput: $('#move-search-input'),
  moveSearchNote: $('#move-search-note'),
  moveSearchResults: $('#move-search-results'),
  moveBasket: $('#move-basket'),
  basketList: $('#basket-list'),
  basketNote: $('#basket-note'),
  selectAll: $('#select-all'),
  searchToggle: $('#search-toggle'),
  basketToggle: $('#basket-toggle'),
  basketCount: $('#basket-count'),
  destination: $('#destination'),
  destinationLabel: $('#destination-label'),
  applyMove: $('#apply-move'),

  toast: $('#toast'),
  toastMessage: $('#toast-message'),
  toastUndo: $('#toast-undo'),
  toastClose: $('#toast-close'),

  buildBtn: $('#build-btn'),
  build: $('#build'),
  buildBack: $('#build-back'),
  buildTitle: $('#build-title'),
  buildSubtitle: $('#build-subtitle'),
  buildSetup: $('#build-setup'),
  buildNewName: $('#build-new-name'),
  buildExisting: $('#build-existing'),
  buildSideboard: $('#build-sideboard'),
  buildSideboardLabel: $('#build-sideboard-label'),
  buildCompute: $('#build-compute'),
  buildNote: $('#build-note'),
  buildResult: $('#build-result'),
  buildStats: $('#build-stats'),
  buildApply: $('#build-apply'),
  buildHint: $('#build-hint'),
  buildRows: $('#build-rows'),
  buildEyebrow: $('#build-eyebrow'),
  buildHideSettled: $('#build-hide-settled'),
  buildHideSettledRow: $('#build-hide-settled-row'),
  buildHideSettledLabel: $('#build-hide-settled-label'),
  buildSurplus: $('#build-surplus'),
  buildSurplusCount: $('#build-surplus-count'),
  buildSurplusRows: $('#build-surplus-rows'),
  buildOut: $('#build-out'),
  buildProtect: $('#build-protect'),
  buildDeckHint: $('#build-deck-hint'),
  buildDeckHintText: $('#build-deck-hint-text'),
  buildDeckHintBtn: $('#build-deck-hint-btn'),
  buildPickup: $('#build-pickup'),
  buildPickupCount: $('#build-pickup-count'),
  buildPickupList: $('#build-pickup-list'),
  buildPickupCopy: $('#build-pickup-copy'),
  buildReset: $('#build-reset'),

  groupSelect: $('#group-select'),
  deleteCards: $('#delete-cards'),
  untagBtn: $('#untag-btn'),
  confirm: $('#confirm'),
  confirmForm: $('#confirm-form'),
  confirmTitle: $('#confirm-title'),
  confirmText: $('#confirm-text'),
  confirmList: $('#confirm-list'),
  confirmNote: $('#confirm-note'),
  confirmOk: $('#confirm-ok'),
  confirmCancel: $('#confirm-cancel'),
  confirmClose: $('#confirm-close'),
  selectionGroup: $('#selection-group'),
  moreBtn: $('#more-btn'),
  actions: $('#actions'),
  actionsTitle: $('#actions-title'),
  actionsClose: $('#actions-close'),
  actionList: $('#action-list'),
  clearBasket: $('#clear-basket'),
  excessBtn: $('#excess-btn'),
  excessKeep: $('#excess-keep'),
  renameBtn: $('#rename-btn'),
  deleteBtn: $('#delete-btn'),
  rename: $('#rename'),
  renameForm: $('#rename-form'),
  renameInput: $('#rename-input'),
  renameNote: $('#rename-note'),
  renameSubmit: $('#rename-submit'),
  renameClose: $('#rename-close'),
  delete: $('#delete'),
  deleteForm: $('#delete-form'),
  deleteText: $('#delete-text'),
  deleteMoveField: $('#delete-move-field'),
  deleteTarget: $('#delete-target'),
  deleteNote: $('#delete-note'),
  deleteSubmit: $('#delete-submit'),
  deleteCancel: $('#delete-cancel'),
  deleteClose: $('#delete-close'),

  compareBtn: $('#compare-btn'),
  compare: $('#compare'),
  compareForm: $('#compare-form'),
  compareInput: $('#compare-input'),
  compareNote: $('#compare-note'),
  compareTarget: $('#compare-target'),
  compareSubmit: $('#compare-submit'),
  compareClose: $('#compare-close'),

  openTidy: $('#open-tidy'),

  places: $('#places'),
  placesSearchNote: $('#places-search-note'),
  placesSearchResults: $('#places-search-results'),
  placesCount: $('#places-count'),
  placesNote: $('#places-note'),
  placesList: $('#places-list'),

  tidy: $('#tidy'),
  tidyBack: $('#tidy-back'),
  tidySetup: $('#tidy-setup'),
  tidyPlaces: $('#tidy-places'),
  tidyCompute: $('#tidy-compute'),
  tidyNote: $('#tidy-note'),
  tidyResult: $('#tidy-result'),
  tidyStats: $('#tidy-stats'),
  tidyApply: $('#tidy-apply'),
  tidyCopy: $('#tidy-copy'),
  tidyLayout: $('#tidy-layout'),
  tidyMoves: $('#tidy-moves'),

  history: $('#history'),
  historyTabs: $('#history-tabs'),
  historyJournal: $('#history-journal'),
  historyRecent: $('#history-recent'),
  journalList: $('#journal-list'),
  journalClear: $('#journal-clear'),
  recentList: $('#recent-list'),
  historyChanges: $('#history-changes'),
  snapshotStatus: $('#snapshot-status'),
  snapshotNow: $('#snapshot-now'),
  changesList: $('#changes-list'),
  settingsSnapshot: $('#settings-snapshot'),
  recentNote: $('#recent-note'),
  recentMore: $('#recent-more'),

  settingsBtn: $('#settings-btn'),
  settings: $('#settings'),
  settingsForm: $('#settings-form'),
  settingsKey: $('#settings-key'),
  settingsShow: $('#settings-show'),
  settingsClear: $('#settings-clear'),
  settingsClose: $('#settings-close'),
};

const state = {
  deck: null,
  view: 'grid',
  group: 'pitch',
};

// --- Libellés --------------------------------------------------------------

const PITCH_LABELS = { 1: 'Pitch rouge', 2: 'Pitch jaune', 3: 'Pitch bleu' };
const PITCH_COLORS = { 1: 'var(--pitch-1)', 2: 'var(--pitch-2)', 3: 'var(--pitch-3)' };

const TYPE_LABELS = {
  Action: 'Actions',
  'Attack Reaction': "Réactions d'attaque",
  'Defense Reaction': 'Réactions de défense',
  Instant: 'Instants',
  Block: 'Blocs',
  Resource: 'Ressources',
};

const TYPE_ORDER = [
  'Attaques',
  'Actions',
  "Réactions d'attaque",
  'Réactions de défense',
  'Blocs',
  'Instants',
  'Ressources',
];

// Couleurs de location CardNexus → pastille de la carte de deck.
const LOCATION_COLORS = {
  red: '#c0392b',
  green: '#3f9e5a',
  blue: '#3b7bc4',
  yellow: '#d9a520',
  white: '#cfc6ba',
  black: '#5a534b',
};

function typeLabel(card) {
  if (card.subtypes.includes('Attack')) return 'Attaques';
  const primary = card.types[0];
  return TYPE_LABELS[primary] || primary || 'Autres';
}

const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// --- Chargement ------------------------------------------------------------

// --- Navigation par onglets --------------------------------------------------
//
// Quatre onglets en bas : Collection (l'accueil), Chercher, Outils, Historique.
// Les vues de détail (un deck, un emplacement, un plan de montage, le
// rangement) s'ouvrent par-dessus l'onglet d'où l'on vient, qui reste allumé,
// et le retour y ramène.

/** Onglet auquel appartient chaque vue ; les autres gardent l'onglet courant. */
const VIEW_TABS = { places: 'collection', 'search-view': 'search', 'tools-view': 'tools', history: 'history', tidy: 'tools' };

function showOnly(el) {
  const views = [els.search, els.tools, els.loading, els.error, els.deck, els.build, els.places, els.tidy, els.history];
  for (const node of views) node.hidden = node !== el;
  if (VIEW_TABS[el.id]) state.tab = VIEW_TABS[el.id];
  for (const tab of els.tabbar.querySelectorAll('[data-tab]')) {
    tab.classList.toggle('is-active', tab.dataset.tab === state.tab);
  }
  updateMovebar();
  window.scrollTo(0, 0);
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

/** Complète les decks de la Collection (héros, cartes), deux à la fois pour ménager l'API. */
async function enrichDecks() {
  const queue = deckLocations.map((loc) => loc.name).filter((name) => !deckInfo.has(name));

  const worker = async () => {
    for (let name = queue.shift(); name; name = queue.shift()) {
      try {
        const res = await fetch(`/api/cardnexus/deck?location=${encodeURIComponent(name)}`);
        const deck = await res.json();
        if (!res.ok) throw new Error(deck.error);
        const total = deck.counts.deck + deck.counts.weapons + deck.counts.equipment + (deck.hero?.quantity || 0);
        deckInfo.set(name, { hero: deck.hero?.name || null, imageUrl: deck.hero?.imageUrl || null });
        placeCounts.set(name, total);
      } catch {
        deckInfo.set(name, { hero: null, imageUrl: null, failed: true });
      }
      if (!els.places.hidden) updatePlaceNode(name);
    }
  };

  await Promise.all([worker(), worker()]);
}

async function loadDeckLocations() {
  try {
    const res = await fetch('/api/cardnexus/decks');
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
    if (!els.places.hidden) renderPlacesList();
    enrichDecks();
  } catch (err) {
    els.placesNote.textContent = `Inventaire CardNexus indisponible : ${err.message}`;
  }
}

// --- Rendu ----------------------------------------------------------------

function statItem(label, value) {
  const li = document.createElement('li');
  li.className = 'stat';
  li.innerHTML = `<b>${value}</b> ${label}`;
  return li;
}

/**
 * Un emplacement CardNexus qui n'est pas un deck (vrac, Kallax, classeur...) :
 * pas de héros ni de decklist, juste un tas de cartes à consulter et à ranger.
 */
function isStoragePlace(deck = state.deck) {
  return deck?.source === 'cardnexus' && !deckLocations.some((loc) => loc.name === deck.deckId);
}

/** Lignes d'inventaire de la vue qui portent au moins un tag. */
function taggedLines(deck) {
  if (deck?.source !== 'cardnexus') return [];
  return placeCards(deck).flatMap((card) => (card.printings || []).filter((line) => line.tags?.length));
}

/** Toutes les cartes d'un emplacement, héros compris, pour l'afficher à plat. */
const placeCards = (deck) =>
  [deck.hero, ...deck.weapons, ...deck.equipment, ...deck.deck, ...deck.sideboard].filter(Boolean);

function renderPlaceHeader(deck) {
  const cards = placeCards(deck);
  const total = cards.reduce((sum, card) => sum + card.quantity, 0);
  const known = locations.find((loc) => loc.name === deck.deckId);

  els.heroArt.hidden = true;
  els.heroLine.textContent = deck.unplaced
    ? 'Cartes à ranger'
    : known
      ? PLACE_KINDS.find((k) => k.kind === placeKind(known))?.label || ''
      : 'Emplacement';
  els.name.textContent = deck.name;
  els.byline.textContent = deck.updatedAt
    ? `mis à jour le ${new Date(deck.updatedAt).toLocaleDateString('fr-FR')}`
    : '';
  els.fabraryLink.hidden = true;
  els.copyBtn.hidden = true;
  els.compareBtn.hidden = true;
  els.buildBtn.hidden = true;

  els.stats.replaceChildren(statItem('cartes', total), statItem('différentes', cards.length));
  els.notes.hidden = !deck.notes;
  if (deck.notes) els.notesBody.textContent = deck.notes;
}

function renderHeader(deck) {
  // Renommer et supprimer valent pour tout emplacement CardNexus, deck compris.
  const realPlace = deck.source === 'cardnexus' && !deck.unplaced;
  const tagged = taggedLines(deck);
  els.untagBtn.hidden = tagged.length === 0;
  els.untagBtn.textContent = `Retirer les tags (${tagged.length} ligne${tagged.length > 1 ? 's' : ''})`;
  els.selectionGroup.hidden = deck.source !== 'cardnexus';
  els.renameBtn.hidden = !realPlace;
  els.deleteBtn.hidden = !realPlace;
  // Grouper par extension n'a de sens que pour l'inventaire (FaBrary ne la donne pas).
  els.groupSelect.querySelector('option[value="expansion"]').hidden = deck.source !== 'cardnexus';
  if (deck.source !== 'cardnexus' && state.group === 'expansion') {
    state.group = 'pitch';
    els.groupSelect.value = 'pitch';
  }

  if (isStoragePlace(deck)) {
    renderPlaceHeader(deck);
    return;
  }
  els.copyBtn.hidden = false;
  const hero = deck.hero;

  if (hero?.imageUrl) {
    els.heroArt.src = hero.imageUrl;
    els.heroArt.alt = hero.name;
    els.heroArt.hidden = false;
  } else {
    els.heroArt.hidden = true;
  }

  els.heroLine.textContent = [hero?.name, deck.format].filter(Boolean).join(' · ');
  els.name.textContent = deck.name;

  const updated = deck.updatedAt
    ? `mis à jour le ${new Date(deck.updatedAt).toLocaleDateString('fr-FR')}`
    : null;
  els.byline.textContent = [deck.author && `par ${deck.author}`, updated].filter(Boolean).join(' · ');

  els.fabraryLink.hidden = !deck.url;
  if (deck.url) els.fabraryLink.href = deck.url;

  updateBuildButton();
  els.compareBtn.hidden = deck.source !== 'cardnexus';

  els.stats.replaceChildren();
  if (hero?.intellect != null) els.stats.append(statItem('intellect', hero.intellect));
  if (hero?.life != null) els.stats.append(statItem('vie', hero.life));
  els.stats.append(statItem('cartes', deck.counts.deck));
  els.stats.append(statItem('uniques', deck.counts.unique));
  if (deck.counts.sideboard) els.stats.append(statItem('en réserve', deck.counts.sideboard));

  if (deck.notes) {
    els.notesBody.textContent = deck.notes;
    els.notes.hidden = false;
  } else {
    els.notes.hidden = true;
  }
}

/** Résumé des impressions d'une carte d'inventaire, pour l'infobulle. */
function printingsSummary(card) {
  if (!card.printings?.length) return '';
  return card.printings
    .map((p) => [`${p.quantity}×`, p.printNumber, p.finish, p.condition].filter(Boolean).join(' '))
    .join(' · ');
}

/**
 * Bouton "prendre" — seulement sur les decks d'inventaire, où les cartes
 * correspondent à des lignes déplaçables. `data-lines` sert à retrouver ce qui
 * est en main sans re-render.
 */
function pickupButton(card) {
  if (!card.printings?.length) return null;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pickup-btn';
  button.dataset.pickup = card.id;
  button.dataset.lines = card.printings.map((p) => p.inventoryId).join(',');
  button.textContent = '+';
  button.title = 'Prendre des exemplaires';
  return button;
}

function cardTile(card) {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'card-tile';
  tile.dataset.image = card.imageUrl || '';
  tile.title = [`${card.quantity}× ${card.name}`, printingsSummary(card)].filter(Boolean).join('\n');

  const img = document.createElement('img');
  img.src = card.imageUrl || '';
  img.alt = card.name;
  img.loading = 'lazy';

  const badge = document.createElement('span');
  badge.className = 'qty-badge';
  badge.textContent = `${card.quantity}×`;

  tile.append(img, badge);

  if (card.foil) {
    const foil = document.createElement('span');
    foil.className = 'foil-badge';
    foil.textContent = '✦';
    foil.title = 'Au moins un exemplaire foil';
    tile.append(foil);
  }
  return tile;
}

function cardRow(card) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'card-row';
  row.dataset.image = card.imageUrl || '';
  row.title = printingsSummary(card);

  const stats = [
    card.image ? `<span class="row-print">${escapeHtml(card.image)}</span>` : '',
    card.foil ? '<span class="row-foil" title="Foil">✦</span>' : '',
    card.cost != null ? `<b>${card.cost}</b> coût` : '',
    card.power != null ? `<b>${card.power}</b> atq` : '',
    card.defense != null ? `<b>${card.defense}</b> déf` : '',
  ].filter(Boolean);

  row.innerHTML = `
    <span class="row-qty">${card.quantity}×</span>
    <span class="row-name">
      <i class="row-pitch" style="--dot:${PITCH_COLORS[card.pitch] || 'var(--pitch-0)'}"></i>
      <span>${escapeHtml(card.name)}</span>
    </span>
    <span class="row-stats">${stats.join('')}</span>
  `;
  return row;
}

function renderSection({ title, cards, dotColor }) {
  if (!cards.length) return null;

  const section = document.createElement('section');
  section.className = 'deck-section';

  const head = document.createElement('div');
  head.className = 'section-head';
  if (dotColor) {
    const dot = document.createElement('i');
    dot.className = 'pitch-dot';
    dot.style.setProperty('--dot', dotColor);
    head.append(dot);
  }
  const h2 = document.createElement('h2');
  h2.textContent = title;
  const count = document.createElement('span');
  count.className = 'section-count';
  const total = cards.reduce((sum, c) => sum + c.quantity, 0);
  count.textContent = `${total} carte${total > 1 ? 's' : ''}`;
  head.append(h2, count);

  const grid = state.view === 'grid';
  const body = document.createElement(grid ? 'div' : 'ul');
  body.className = grid ? 'card-grid' : 'card-list';

  for (const card of cards) {
    // La carte et son bouton "prendre" sont frères : un bouton ne peut pas en
    // contenir un autre.
    const slot = document.createElement(grid ? 'div' : 'li');
    slot.className = 'card-slot';
    slot.append(grid ? cardTile(card) : cardRow(card));

    const pickup = pickupButton(card);
    if (pickup) {
      // Toucher la carte elle-même prend tous ses exemplaires.
      slot.classList.add('is-selectable');
      slot.dataset.card = card.id;
      slot.append(pickup);
    }

    body.append(slot);
  }

  section.append(head, body);
  return section;
}

/** Regroupements par attribut : la clé d'une carte, et le libellé quand elle n'en a pas. */
const ATTRIBUTE_GROUPS = {
  class: (card) => (card.classes?.length ? card.classes.join(' / ') : 'Sans classe'),
  talent: (card) => (card.talents?.length ? card.talents.join(' / ') : 'Sans talent'),
  classTalent: (card) => [...(card.talents || []), ...(card.classes || [])].join(' ') || 'Sans classe',
  expansion: (card) => card.expansion || 'Extension inconnue',
};

/** Découpe le deck principal selon le regroupement choisi. */
function groupMainDeck(cards, { title = 'Deck' } = {}) {
  if (state.group === 'none') {
    return [{ title, cards }];
  }

  const byAttribute = ATTRIBUTE_GROUPS[state.group];
  if (byAttribute) {
    const buckets = new Map();
    for (const card of cards) {
      const key = byAttribute(card);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(card);
    }
    // Les groupes nommés par ordre alphabétique, les « Sans ... » à la fin.
    const last = (key) => Number(/^(Sans|Extension inconnue)/.test(key));
    return [...buckets.entries()]
      .sort(([a], [b]) => last(a) - last(b) || a.localeCompare(b, 'fr'))
      .map(([key, list]) => ({ title: key, cards: list }));
  }

  if (state.group === 'pitch') {
    const buckets = new Map();
    for (const card of cards) {
      const key = card.pitch ?? 0;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(card);
    }
    return [1, 2, 3, 0]
      .filter((key) => buckets.has(key))
      .map((key) => ({
        title: PITCH_LABELS[key] || 'Sans pitch',
        cards: buckets.get(key),
        dotColor: PITCH_COLORS[key] || 'var(--pitch-0)',
      }));
  }

  const buckets = new Map();
  for (const card of cards) {
    const key = typeLabel(card);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(card);
  }
  const rank = (title) => {
    const i = TYPE_ORDER.indexOf(title);
    return i === -1 ? TYPE_ORDER.length : i;
  };
  return [...buckets.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([title, list]) => ({ title, cards: list }));
}

function renderSectionsAndMarks() {
  renderSections();
  markHeldCards();
}

function renderSections() {
  const deck = state.deck;
  if (isStoragePlace(deck)) {
    // Un emplacement n'a ni armes ni réserve : toutes ses cartes, groupées d'un bloc.
    const cards = placeCards(deck).sort(
      (a, b) => a.name.localeCompare(b.name) || (a.pitch ?? 0) - (b.pitch ?? 0),
    );
    els.sections.replaceChildren(
      ...groupMainDeck(cards, { title: 'Cartes' }).map(renderSection).filter(Boolean),
    );
    return;
  }
  const groups = [
    { title: 'Armes', cards: deck.weapons },
    { title: 'Équipement', cards: deck.equipment },
    ...groupMainDeck(deck.deck),
    { title: 'Réserve (sideboard)', cards: deck.sideboard },
  ];

  els.sections.replaceChildren(...groups.map(renderSection).filter(Boolean));
}

/** Le menu ⋯ n'a de sens que s'il contient au moins une action. */
function updateMoreButton() {
  els.moreBtn.hidden = ![...els.actionList.children].some((item) => !item.hidden);
}

function openActions() {
  els.actionsTitle.textContent = state.deck?.name || 'Actions';
  els.actions.hidden = false;
}

const closeActions = () => {
  els.actions.hidden = true;
};

function renderDeck() {
  renderHeader(state.deck);
  updateMoreButton();
  renderSections();
  markHeldCards();
  updateMovebar();
}

// --- Panier de déplacements ------------------------------------------------
//
// Le modèle est celui des cartes en main : on prend des exemplaires (depuis le
// deck affiché, ou n'importe où dans l'inventaire via la recherche), puis on
// les repose tous dans une même location. Ce qu'on prend, ce sont des *lignes*
// d'inventaire — la granularité de l'API — pas des cartes : deux exemplaires
// d'une même carte en finitions différentes sont deux lignes distinctes.

/** inventoryId → { count, max, … }. L'inventoryId est unique par envoi. */
const basket = new Map();
let locations = [];
let movePanel = 'none';
let lastMove = null;
/** Entrée du journal liée au bandeau affiché : l'annuler depuis le bandeau la marque annulée. */
let lastLogId = null;

const FINISH_SHORT = { Standard: 'Standard' };
const lineLabel = (line) =>
  [line.printNumber, FINISH_SHORT[line.finish] || line.finish, line.condition, line.language?.toUpperCase()]
    .filter(Boolean)
    .join(' · ');

function basketTotal() {
  let total = 0;
  for (const entry of basket.values()) total += entry.count;
  return total;
}

/** Combien d'exemplaires de cette ligne sont déjà en main. */
const heldCount = (inventoryId) => basket.get(inventoryId)?.count ?? 0;

/**
 * Écrit dans le panier sans rafraîchir l'affichage — pour les lots.
 *
 * `toDeck` distingue les deux sens : une carte prise dans la recherche
 * d'inventaire entre dans le deck ouvert, une carte prise dans le deck en sort
 * vers la destination choisie dans la barre.
 */
function writeHeld(line, card, count, { toDeck = false } = {}) {
  const clamped = Math.max(0, Math.min(count, line.quantity));

  if (clamped === 0) {
    basket.delete(line.inventoryId);
  } else {
    basket.set(line.inventoryId, {
      inventoryId: line.inventoryId,
      count: clamped,
      max: line.quantity,
      cardName: card.name,
      pitch: card.pitch ?? null,
      label: lineLabel(line),
      location: line.location || null,
      forSale: line.forSale,
      toDeck,
    });
  }
  return clamped;
}

/** Le deck actuellement ouvert, quand c'est un deck d'inventaire. */
const currentDeckName = () => (state.deck?.source === 'cardnexus' ? state.deck.name : null);

/** Où l'API doit ranger ce qui entre dans la vue ouverte : `null` pour « Sans emplacement ». */
const currentDeckTarget = () => (state.deck?.unplaced ? null : state.deck?.deckId ?? null);

function refreshBasketViews() {
  renderBasket();
  markHeldCards();
}

function setHeld(line, card, count, options) {
  const clamped = writeHeld(line, card, count, options);
  refreshBasketViews();
  return clamped;
}

/**
 * Toutes les cartes du deck affiché, zones confondues. Le héros en fait partie
 * même s'il est rendu à part, sinon « Tout prendre » le laisserait sur place.
 */
function allDeckCards() {
  const deck = state.deck;
  if (!deck) return [];
  const hero = deck.hero?.printings?.length ? [deck.hero] : [];
  return [...hero, ...deck.weapons, ...deck.equipment, ...deck.deck, ...deck.sideboard];
}

const cardHeld = (card) =>
  (card.printings || []).reduce((sum, line) => sum + heldCount(line.inventoryId), 0);

const cardTotal = (card) =>
  (card.printings || []).reduce((sum, line) => sum + line.quantity, 0);

/** Prend (ou repose) tous les exemplaires d'une carte d'un seul geste. */
function toggleCard(card) {
  const takeAll = cardHeld(card) < cardTotal(card);
  for (const line of card.printings) writeHeld(line, card, takeAll ? line.quantity : 0);
  refreshBasketViews();
  closeLinePicker();
}

/**
 * Ordre dans lequel on met de côté l'excédent d'une carte : on garde sur place
 * les plus beaux exemplaires. Partent d'abord les exemplaires en vente, puis
 * les plus abîmés, puis les Standard (les foils restent), puis les grosses
 * lignes (moins de lignes à couper).
 */
const EXCESS_CONDITION_RANK = { NM: 0, LP: 1, MP: 2, HP: 3, DMG: 4 };
const excessOrder = (a, b) =>
  Number(b.forSale) - Number(a.forSale) ||
  (EXCESS_CONDITION_RANK[b.condition] ?? 9) - (EXCESS_CONDITION_RANK[a.condition] ?? 9) ||
  Number(a.finish !== 'Standard') - Number(b.finish !== 'Standard') ||
  b.quantity - a.quantity;

/**
 * Met en main tout ce qui dépasse `keep` exemplaires par carte (nom et pitch).
 * La sélection des cartes de cette vue est remplacée ; ce qui a été pris
 * ailleurs (recherche) reste en main.
 */
function takeExcess(keep) {
  let taken = 0;
  let cards = 0;
  for (const card of allDeckCards().filter((c) => c.printings?.length)) {
    for (const line of card.printings) writeHeld(line, card, 0);
    let excess = cardTotal(card) - keep;
    if (excess <= 0) continue;
    cards += 1;
    for (const line of card.printings.slice().sort(excessOrder)) {
      if (excess === 0) break;
      const take = Math.min(excess, line.quantity);
      writeHeld(line, card, take);
      excess -= take;
      taken += take;
    }
  }
  refreshBasketViews();
  closeLinePicker();
  showToast(
    taken
      ? `${taken} exemplaire${taken > 1 ? 's' : ''} en main (${cards} carte${cards > 1 ? 's' : ''} au-delà de ${keep}). Choisissez la destination en bas.`
      : `Aucune carte n'a plus de ${keep} exemplaire${keep > 1 ? 's' : ''} ici.`,
  );
}

/** Prend tout le deck, ou repose tout si tout est déjà en main. */
function toggleSelectAll() {
  const cards = allDeckCards().filter((card) => card.printings?.length);
  const takeAll = cards.some((card) => cardHeld(card) < cardTotal(card));

  for (const card of cards) {
    for (const line of card.printings) writeHeld(line, card, takeAll ? line.quantity : 0);
  }
  refreshBasketViews();
  closeLinePicker();
}

/** Reflète l'état du panier sur les cartes affichées. */
function markHeldCards() {
  for (const button of els.sections.querySelectorAll('.pickup-btn')) {
    const ids = (button.dataset.lines || '').split(',').filter(Boolean);
    const held = ids.reduce((sum, id) => sum + heldCount(id), 0);
    button.classList.toggle('is-held', held > 0);
    button.textContent = held > 0 ? String(held) : '+';
    button.title = held > 0 ? `${held} en main` : 'Prendre des exemplaires';
    button.closest('.card-slot')?.classList.toggle('is-held', held > 0);
  }

  const hero = state.deck?.hero;
  const heroSelectable = Boolean(hero?.printings?.length);
  els.heroArt.classList.toggle('is-selectable', heroSelectable);
  els.heroArt.classList.toggle('is-held', heroSelectable && cardHeld(hero) > 0);
  els.heroArt.title = heroSelectable ? 'Prendre le héros' : '';

  updateSelectAllButton();
}

function updateSelectAllButton() {
  const cards = allDeckCards().filter((card) => card.printings?.length);
  const complete = cards.length > 0 && cards.every((card) => cardHeld(card) === cardTotal(card));
  els.selectAll.textContent = complete ? 'Tout reposer' : 'Tout prendre';
  els.selectAll.disabled = cards.length === 0;
}

/**
 * Compteur générique. `store` dit où lire et écrire la quantité choisie : le
 * panier pour les déplacements libres, le plan pour le montage d'un deck.
 */
function stepperNode({ max, get, set }) {
  const wrap = document.createElement('div');
  wrap.className = 'stepper';

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.textContent = '−';
  minus.setAttribute('aria-label', 'Un de moins');

  const out = document.createElement('output');
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.textContent = '+';
  plus.setAttribute('aria-label', 'Un de plus');

  const paint = () => {
    const count = get();
    out.innerHTML = `<b>${count}</b><span class="stepper-max"> / ${max}</span>`;
    minus.disabled = count === 0;
    plus.disabled = count >= max;
  };

  const bump = (delta) => {
    set(Math.max(0, Math.min(max, get() + delta)));
    paint();
  };

  minus.addEventListener('click', () => bump(-1));
  plus.addEventListener('click', () => bump(1));
  paint();

  wrap.append(minus, out, plus);
  return wrap;
}

/** Store adossé au panier, pour une ligne d'inventaire donnée. */
const basketStore = (line, card, onChange, toDeck) => ({
  max: line.quantity,
  get: () => heldCount(line.inventoryId),
  set: (count) => {
    setHeld(line, card, count, { toDeck });
    onChange?.();
  },
});

function lineRowNode(line, card, { showLocation = false, onChange, store, note, toDeck = false } = {}) {
  const li = document.createElement('li');
  li.className = 'line-row';
  if (line.forSale) li.classList.add('is-forsale');
  if (note === 'deck') li.classList.add('is-deck');

  const info = document.createElement('div');
  info.className = 'line-row-info';

  const main = document.createElement('span');
  main.className = 'line-row-main';
  main.textContent = showLocation ? line.location || 'sans location' : lineLabel(line);

  const sub = document.createElement('span');
  sub.className = 'line-row-sub';
  sub.textContent = [
    showLocation ? lineLabel(line) : null,
    line.forSale ? 'en vente sur la marketplace' : null,
    note === 'deck' ? 'appartient à un autre deck' : null,
    line.tags?.length ? `tags : ${line.tags.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  info.append(main, sub);
  li.append(info, stepperNode(store || basketStore(line, card, onChange, toDeck)));
  return li;
}

// --- Sélecteur de lignes (au toucher du "+" d'une carte) -------------------

function closeLinePicker() {
  els.linePicker.hidden = true;
}

function openLinePicker(card, anchor) {
  els.linePickerTitle.textContent = [card.name, card.pitchName].filter(Boolean).join(' · ');
  els.linePickerList.replaceChildren(
    ...card.printings.map((line) => lineRowNode(line, card, { onChange: markHeldCards })),
  );

  els.linePicker.hidden = false;

  // Ancré sous le bouton, ramené dans la fenêtre s'il dépasse.
  const rect = anchor.getBoundingClientRect();
  const box = els.linePicker.getBoundingClientRect();
  const margin = 12;
  const left = Math.min(Math.max(margin, rect.left - box.width / 2), window.innerWidth - box.width - margin);
  const below = rect.bottom + 8;
  const top = below + box.height > window.innerHeight - margin ? Math.max(margin, rect.top - box.height - 8) : below;

  els.linePicker.style.left = `${left}px`;
  els.linePicker.style.top = `${top}px`;
}

// --- Barre de déplacement --------------------------------------------------

function setMovePanel(next) {
  movePanel = movePanel === next ? 'none' : next;
  els.movebarPanel.hidden = movePanel === 'none';
  els.moveSearch.hidden = movePanel !== 'search';
  els.moveBasket.hidden = movePanel !== 'basket';
  els.searchToggle.classList.toggle('is-active', movePanel === 'search');
  els.basketToggle.classList.toggle('is-active', movePanel === 'basket');

  if (movePanel === 'search') {
    els.moveSearchInput.focus();
    if (!els.moveSearchNote.textContent) {
      els.moveSearchNote.textContent = `Les exemplaires pris ici entreront dans « ${currentDeckName()} ».`;
    }
  }
  updateMovebar();
}

function renderBasket() {
  const total = basketTotal();
  // Main vide : la liste « en main » n'a plus rien à montrer.
  if (total === 0 && movePanel === 'basket') setMovePanel('none');
  els.basketCount.textContent = String(total);
  els.applyMove.disabled = total === 0;
  els.deleteCards.disabled = total === 0;

  els.basketList.replaceChildren(
    ...[...basket.values()].map((entry) => {
      const li = document.createElement('li');
      li.className = 'line-row';

      const target = entry.toDeck
        ? currentDeckName()
        : els.destination.value === NO_LOCATION
          ? 'aucune location'
          : els.destination.value || '…';

      const info = document.createElement('div');
      info.className = 'line-row-info';
      info.innerHTML = `
        <span class="line-row-main">${entry.count}× ${escapeHtml(entry.cardName)}</span>
        <span class="line-row-sub">${escapeHtml(entry.label)} · ${escapeHtml(entry.location || 'sans location')} → ${escapeHtml(target)}</span>
      `;

      const drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'icon-btn';
      drop.textContent = '×';
      drop.title = 'Reposer';
      drop.addEventListener('click', () => {
        basket.delete(entry.inventoryId);
        renderBasket();
        markHeldCards();
        refreshOpenSteppers();
      });

      li.append(info, drop);
      return li;
    }),
  );

  const entries = [...basket.values()];
  const forSale = entries.filter((e) => e.forSale).length;
  const incoming = entries.filter((e) => e.toDeck).reduce((sum, e) => sum + e.count, 0);

  els.basketNote.textContent = total
    ? [
        incoming ? `${incoming} carte(s) entrent dans « ${currentDeckName()} ».` : '',
        forSale ? `${forSale} ligne(s) en vente sur la marketplace : les déplacer touche vos annonces.` : '',
      ]
        .filter(Boolean)
        .join(' ')
    : "Rien en main. Prenez des cartes depuis le deck, ou cherchez-en dans l'inventaire.";

  updateDestinationField(entries);
  updateMovebar();
}

/**
 * La destination de la barre ne gouverne que les cartes qui sortent du deck :
 * sans aucune sortante, elle n'a rien à régler.
 */
function updateDestinationField(entries) {
  const outgoing = entries.some((entry) => !entry.toDeck);
  els.destination.disabled = !outgoing;
  const verb = els.search.hidden ? 'Sortir vers' : 'Déplacer vers';
  els.destinationLabel.textContent = outgoing ? verb : `${verb} (rien en main)`;
}

/** Les steppers ouverts ailleurs doivent refléter le panier après un retrait. */
function refreshOpenSteppers() {
  closeLinePicker();
  if (movePanel === 'search') renderSearchResults();
  if (!els.search.hidden) renderPlacesSearch();
}

// Aucune location ne porte ce nom : jeton sentinelle pour « retirer la carte
// de toute location », que l'API attend sous la forme null.
const NO_LOCATION = '__aucune__';

function renderDestinations() {
  const current = els.destination.value;
  const options = [
    '<option value="">— choisir —</option>',
    ...locations.map((loc) => `<option value="${escapeHtml(loc.name)}">${escapeHtml(loc.name)}</option>`),
    `<option value="${NO_LOCATION}">(aucune location)</option>`,
  ];
  els.destination.innerHTML = options.join('');
  if (current) els.destination.value = current;
}

function updateMovebar() {
  // Deux usages : sur un deck d'inventaire, et sur l'écran Emplacements, où il
  // n'y a pas de deck ouvert — tout ce qui est pris part vers la destination.
  // Contextuelle : elle n'apparaît que quand on a des cartes en main (ou le
  // panneau « depuis l'inventaire » ouvert), sur un deck d'inventaire ou dans Chercher.
  const onPlaces = !els.search.hidden;
  const context = (state.deck?.source === 'cardnexus' && !els.deck.hidden) || onPlaces;
  const active = context && (basketTotal() > 0 || movePanel !== 'none');
  els.movebar.hidden = !active;
  els.destinationLabel.dataset.mode = onPlaces ? 'places' : 'deck';
  updateDestinationField([...basket.values()]);
  document.body.classList.toggle('has-movebar', active);
  if (!active) {
    if (movePanel !== 'none') setMovePanel('none');
    closeLinePicker();
  }
}

// --- Recherche dans l'inventaire -------------------------------------------

let searchResults = null;

function renderSearchResults() {
  if (!searchResults) {
    els.moveSearchResults.replaceChildren();
    return;
  }

  els.moveSearchResults.replaceChildren(
    ...searchResults.cards.map((card) => {
      const section = document.createElement('div');
      section.className = 'result-card';

      const head = document.createElement('div');
      head.className = 'result-card-head';
      head.innerHTML = `
        <i class="row-pitch" style="--dot:${PITCH_COLORS[card.pitch] || 'var(--pitch-0)'}"></i>
        <span>${escapeHtml(card.name)}</span>
        <span class="count">${card.quantity} exemplaire${card.quantity > 1 ? 's' : ''}</span>
      `;

      const list = document.createElement('ul');
      list.className = 'result-lines';
      list.append(
        ...card.lines.map((line) =>
          lineRowNode(line, card, { showLocation: true, onChange: markHeldCards, toDeck: true }),
        ),
      );

      section.append(head, list);
      return section;
    }),
  );
}

async function runInventorySearch(term) {
  els.moveSearchNote.textContent = 'Recherche…';
  els.moveSearchResults.replaceChildren();

  try {
    const res = await fetch(`/api/cardnexus/search?q=${encodeURIComponent(term)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

    searchResults = data;
    const into = `Les exemplaires pris ici entreront dans « ${currentDeckName()} ».`;
    if (!data.cards.length) {
      els.moveSearchNote.textContent = 'Aucune carte de votre inventaire ne correspond.';
    } else {
      els.moveSearchNote.textContent = data.truncated
        ? `${data.total} lignes trouvées, les premières sont affichées — affinez si besoin. ${into}`
        : into;
    }
    renderSearchResults();
  } catch (err) {
    searchResults = null;
    els.moveSearchNote.textContent = err.message;
  }
}

// --- Application -----------------------------------------------------------

function hideToast() {
  clearTimeout(showToast.timer);
  els.toast.hidden = true;
}

/**
 * Bandeau de confirmation. Avec `log`, l'action est aussi inscrite au journal
 * ({ kind, details }) — le message du bandeau en devient le résumé, et
 * l'annulation proposée ici reste possible plus tard depuis l'historique.
 */
function showToast(message, { error = false, undo = null, log = null } = {}) {
  els.toastMessage.textContent = message;
  els.toast.classList.toggle('is-error', error);
  els.toastUndo.hidden = !undo;
  lastMove = undo;
  lastLogId = log ? logAction({ ...log, summary: message, undo }) : null;
  els.toast.hidden = false;

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(hideToast, undo ? 12000 : 6000);
}

async function postMoves(moves, destination) {
  const res = await fetch('/api/cardnexus/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moves, destination }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

/**
 * Destination de chaque entrée : le deck ouvert pour ce qui vient de la
 * recherche, la destination choisie pour ce qui sort du deck. Renvoie null si
 * une destination de sortie est nécessaire mais pas encore choisie.
 */
function resolveDestinations() {
  const entries = [...basket.values()];
  const outgoing = entries.filter((entry) => !entry.toDeck);

  let outTarget;
  if (outgoing.length) {
    const raw = els.destination.value;
    if (!raw) return null;
    outTarget = raw === NO_LOCATION ? null : raw;
  }

  const byDestination = new Map();
  let skipped = 0;

  for (const entry of entries) {
    const destination = entry.toDeck ? currentDeckTarget() : outTarget;
    // Une ligne déjà dans sa destination n'a rien à y faire.
    if (entry.location === destination) {
      skipped += 1;
      continue;
    }
    if (!byDestination.has(destination)) byDestination.set(destination, []);
    byDestination.get(destination).push(entry);
  }

  return { byDestination, skipped };
}

async function applyBasket() {
  const resolved = resolveDestinations();
  if (!resolved) {
    showToast('Choisissez où sortir les cartes prises dans le deck.', { error: true });
    return;
  }

  const { byDestination, skipped } = resolved;
  if (!byDestination.size) {
    showToast('Ces cartes sont déjà à leur place.', { error: true });
    return;
  }

  els.applyMove.disabled = true;
  els.applyMove.textContent = 'Déplacement…';

  try {
    let moved = 0;
    const failed = [];
    const undo = [];
    const places = [];

    for (const [destination, entries] of byDestination) {
      const result = await postMoves(
        entries.map(({ inventoryId, count }) => ({ inventoryId, count })),
        destination,
      );

      moved += result.applied.reduce((sum, m) => sum + m.count, 0);
      failed.push(...result.failed);
      places.push(destination || 'aucune location');

      // De quoi refaire le trajet inverse : la ligne survivante et son origine.
      for (const applied of result.applied) {
        const entry = entries.find((e) => e.inventoryId === applied.inventoryId);
        undo.push({ inventoryId: applied.survivingId, count: applied.count, back: entry?.location ?? null });
      }
    }

    const details = [...byDestination].flatMap(([destination, entries]) =>
      entries.map(
        (e) =>
          `${e.count}× ${cardLabel({ name: e.cardName, pitch: e.pitch })} : ${placeLabel(e.location)} → ${placeLabel(destination)}`,
      ),
    );
    basket.clear();
    renderBasket();
    setMovePanel('none');

    const problems = [
      failed.length ? `${failed.length} refusée(s) : ${failed[0].reason}` : null,
      skipped ? `${skipped} déjà sur place` : null,
    ].filter(Boolean);

    showToast(
      `${moved} carte${moved > 1 ? 's' : ''} → ${places.join(' et ')}` +
        (problems.length ? ` (${problems.join(', ')})` : ''),
      { error: Boolean(failed.length), undo: undo.length ? undo : null, log: { kind: 'move', details } },
    );

    await reloadCurrentDeck();
  } catch (err) {
    showToast(err.message, { error: true });
  } finally {
    els.applyMove.textContent = 'Déplacer';
    els.applyMove.disabled = basketTotal() === 0;
  }
}

/**
 * Annule le dernier lot. Chaque ligne repart vers sa location d'origine — si
 * elle a fusionné à l'arrivée, on la redécoupe : le contenu revient à
 * l'identique, l'identifiant de ligne pas forcément.
 */
/**
 * Renvoie chaque ligne vers son emplacement d'origine. Un lot peut venir de
 * plusieurs origines : un envoi par origine, par lots de 200.
 */
async function undoMoves(items) {
  const byOrigin = new Map();
  for (const item of items) {
    if (!byOrigin.has(item.back)) byOrigin.set(item.back, []);
    byOrigin.get(item.back).push({ inventoryId: item.inventoryId, count: item.count });
  }
  let restored = 0;
  const failed = [];
  for (const [origin, moves] of byOrigin) {
    for (let i = 0; i < moves.length; i += 200) {
      const result = await postMoves(moves.slice(i, i + 200), origin);
      restored += result.applied.reduce((sum, m) => sum + m.count, 0);
      failed.push(...result.failed);
    }
  }
  return { restored, failed };
}

async function undoLastMove() {
  if (!lastMove) return;

  els.toastUndo.disabled = true;
  try {
    const { restored } = await undoMoves(lastMove);
    const logId = lastLogId;
    lastMove = null;
    markUndone(logId);
    showToast(`${restored} carte${restored > 1 ? 's' : ''} remise${restored > 1 ? 's' : ''} en place.`, {
      log: { kind: 'undo' },
    });
    await reloadCurrentDeck();
  } catch (err) {
    showToast(`Annulation impossible : ${err.message}`, { error: true });
  } finally {
    els.toastUndo.disabled = false;
  }
}

async function reloadCurrentDeck() {
  // Le stock a bougé : les comptes connus des endroits sont périmés.
  placeCounts.clear();
  deckInfo.clear();
  if (!els.places.hidden) {
    renderPlacesList();
    enrichDecks();
    return;
  }
  if (!els.search.hidden) {
    if (placesSearch.term) runPlacesSearch(placesSearch.term);
    return;
  }
  if (state.deck?.source !== 'cardnexus') return;
  const res = await fetch(`/api/cardnexus/deck?location=${encodeURIComponent(state.deck.deckId)}`);
  if (res.status === 404) {
    // Plus aucune carte ici (tout déplacé ou supprimé) : on affiche l'emplacement vide.
    state.deck = {
      ...state.deck,
      hero: null,
      weapons: [],
      equipment: [],
      deck: [],
      sideboard: [],
      counts: { deck: 0, weapons: 0, equipment: 0, sideboard: 0, unique: 0 },
    };
    placeCounts.set(state.deck.deckId, 0);
    renderDeck();
    return;
  }
  if (!res.ok) return;
  state.deck = await res.json();
  renderDeck();
}

async function loadLocations() {
  try {
    const res = await fetch('/api/cardnexus/locations');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    locations = data;
    renderDestinations();
  } catch {
    locations = [];
  }
}

// --- Montage d'un deck FaBrary dans CardNexus ------------------------------
//
// Le calcul produit un plan : pour chaque carte voulue, ce qui est déjà dans
// la destination, ce qu'il propose de déplacer, et ce qui manque. On garde ici
// une allocation modifiable (carte → ligne d'inventaire → quantité), initialisée
// avec la proposition du plan, et les compteurs l'éditent.

//
// Sur un deck déjà monté, le plan liste aussi ce qu'il contient en trop : la
// même mécanique de compteurs règle alors ce qui sort (`removal`). Entrées et
// sorties ensemble transforment le deck en la liste — c'est la comparaison.

const build = {
  deckId: null,
  plan: null,
  /** Map(clé de carte → Map(inventoryId → quantité prise)) */
  allocation: new Map(),
  /** Map(clé de carte → Map(inventoryId → quantité sortie du deck)) */
  removal: new Map(),
  deckLocationNames: new Set(),
};

const isDeckLocation = (name) => build.deckLocationNames.has(name);

function allocationFor(key) {
  if (!build.allocation.has(key)) build.allocation.set(key, new Map());
  return build.allocation.get(key);
}

const takenFor = (key) => [...allocationFor(key).values()].reduce((sum, n) => sum + n, 0);

function removalFor(key) {
  if (!build.removal.has(key)) build.removal.set(key, new Map());
  return build.removal.get(key);
}

const removedFor = (key) => [...removalFor(key).values()].reduce((sum, n) => sum + n, 0);

/** Totaux recalculés à partir de l'allocation courante, pas de celle du plan. */
function buildTotals() {
  const rows = build.plan?.rows || [];
  let needed = 0;
  let already = 0;
  let toMove = 0;
  let missing = 0;
  let cardsMissing = 0;
  let fromDecks = 0;
  let toRemove = 0;
  let extraLeft = 0;

  for (const row of build.plan?.surplus || []) {
    const removed = removedFor(row.key);
    toRemove += removed;
    extraLeft += Math.max(0, row.extra - removed);
  }

  for (const row of rows) {
    const taken = takenFor(row.key);
    const short = Math.max(0, row.needed - row.already - taken);
    needed += row.needed;
    already += row.already;
    toMove += taken;
    missing += short;
    if (short > 0) cardsMissing += 1;

    for (const [inventoryId, count] of allocationFor(row.key)) {
      const line = row.candidates.find((c) => c.inventoryId === inventoryId);
      if (count > 0 && line && isDeckLocation(line.location)) fromDecks += count;
    }
  }

  return { needed, already, toMove, missing, cardsMissing, fromDecks, toRemove, extraLeft };
}

function buildStatus(row) {
  const taken = takenFor(row.key);
  const short = Math.max(0, row.needed - row.already - taken);
  if (short === 0 && taken === 0) return { label: 'déjà en place', className: 'is-onsite' };
  if (short === 0) return { label: 'complet', className: 'is-ok' };
  if (taken + row.already > 0) return { label: `manque ${short}`, className: 'is-partial' };
  return { label: `manque ${short}`, className: 'is-missing' };
}

function buildRowNode(row) {
  const li = document.createElement('li');
  li.className = 'build-row';
  // Rien à faire pour cette carte : masquable, pour ne voir que les écarts.
  if (row.already >= row.needed) li.classList.add('is-settled');

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'build-row-head';

  const art = document.createElement('img');
  art.className = 'build-row-art';
  art.alt = '';
  art.loading = 'lazy';
  if (row.imageUrl) art.src = row.imageUrl;

  const qty = document.createElement('span');
  qty.className = 'build-row-qty';
  qty.textContent = `${row.needed}×`;

  const name = document.createElement('span');
  name.className = 'build-row-name';
  name.innerHTML = `
    <i class="row-pitch" style="--dot:${PITCH_COLORS[row.pitch] || 'var(--pitch-0)'}"></i>
    <span>${escapeHtml(row.name)}</span>
  `;

  const badge = document.createElement('span');
  const status = buildStatus(row);
  badge.className = `badge ${status.className}`;
  badge.textContent = status.label;

  const source = document.createElement('span');
  source.className = 'build-row-source';

  const caret = document.createElement('span');
  caret.className = 'build-row-caret';
  caret.textContent = '▸';

  head.append(art, qty, name, badge, source, caret);

  const lines = document.createElement('ul');
  lines.className = 'build-row-lines';
  lines.hidden = true;

  const empty = document.createElement('p');
  empty.className = 'build-row-empty';
  empty.textContent = "Aucun exemplaire de cette carte ailleurs dans votre collection.";
  empty.hidden = true;

  const paintSource = () => {
    const alloc = allocationFor(row.key);
    const parts = [];
    if (row.already) parts.push(`${row.already} déjà sur place`);
    for (const [inventoryId, count] of alloc) {
      if (!count) continue;
      const line = row.candidates.find((c) => c.inventoryId === inventoryId);
      parts.push(`${count} ← ${line?.location || 'sans location'}`);
    }
    source.textContent = parts.join(' · ');

    const next = buildStatus(row);
    badge.className = `badge ${next.className}`;
    badge.textContent = next.label;
  };

  // Le message d'absence n'a d'intérêt que s'il manque vraiment quelque chose :
  // une carte déjà entièrement sur place n'a rien à chercher ailleurs.
  if (!row.candidates.length && row.already < row.needed) empty.hidden = false;

  if (row.candidates.length) {
    for (const line of row.candidates) {
      lines.append(
        lineRowNode(line, row, {
          showLocation: true,
          note: isDeckLocation(line.location) ? 'deck' : null,
          store: {
            max: line.quantity,
            get: () => allocationFor(row.key).get(line.inventoryId) || 0,
            set: (count) => {
              const alloc = allocationFor(row.key);
              if (count > 0) alloc.set(line.inventoryId, count);
              else alloc.delete(line.inventoryId);
              build.modified = true;
              paintSource();
              renderBuildSummary();
            },
          },
        }),
      );
    }
  }

  head.addEventListener('click', () => {
    const open = lines.hidden && row.candidates.length;
    lines.hidden = !open;
    caret.textContent = open ? '▾' : '▸';
  });

  paintSource();
  li.append(head, lines, empty);
  return li;
}

function surplusStatus(row) {
  const removed = removedFor(row.key);
  const left = row.extra - removed;
  if (left > 0) return { label: `${left} en trop`, className: 'is-partial' };
  return { label: `${removed} à sortir`, className: 'is-ok' };
}

/** Une carte en trop dans le deck : ses lignes, avec combien en sortir. */
function surplusRowNode(row) {
  const li = document.createElement('li');
  li.className = 'build-row';

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'build-row-head';

  const art = document.createElement('img');
  art.className = 'build-row-art';
  art.alt = '';
  art.loading = 'lazy';
  if (row.imageUrl) art.src = row.imageUrl;

  const qty = document.createElement('span');
  qty.className = 'build-row-qty';
  qty.textContent = `${row.have}×`;

  const name = document.createElement('span');
  name.className = 'build-row-name';
  name.innerHTML = `
    <i class="row-pitch" style="--dot:${PITCH_COLORS[row.pitch] || 'var(--pitch-0)'}"></i>
    <span>${escapeHtml(row.name)}</span>
    <span class="build-row-want">${row.wanted ? `liste : ${row.wanted}` : 'hors liste'}</span>
  `;

  const badge = document.createElement('span');
  const caret = document.createElement('span');
  caret.className = 'build-row-caret';
  caret.textContent = '▸';

  const paint = () => {
    const status = surplusStatus(row);
    badge.className = `badge ${status.className}`;
    badge.textContent = status.label;
  };

  head.append(art, qty, name, badge, caret);

  const lines = document.createElement('ul');
  lines.className = 'build-row-lines';
  lines.hidden = true;
  for (const line of row.lines) {
    lines.append(
      lineRowNode(line, row, {
        store: {
          max: line.quantity,
          get: () => removalFor(row.key).get(line.inventoryId) || 0,
          set: (count) => {
            const removal = removalFor(row.key);
            if (count > 0) removal.set(line.inventoryId, count);
            else removal.delete(line.inventoryId);
            paint();
            renderBuildSummary();
          },
        },
      }),
    );
  }

  head.addEventListener('click', () => {
    lines.hidden = !lines.hidden;
    caret.textContent = lines.hidden ? '▸' : '▾';
  });

  paint();
  li.append(head, lines);
  return li;
}

function renderBuildSummary() {
  const totals = buildTotals();
  const stat = (label, value, className) => {
    const li = document.createElement('li');
    li.className = `stat${className ? ` ${className}` : ''}`;
    li.innerHTML = `<b>${value}</b> ${label}`;
    return li;
  };
  const hasSurplus = Boolean(build.plan?.surplus?.length);

  els.buildStats.replaceChildren(
    stat('à faire entrer', totals.toMove),
    ...(hasSurplus ? [stat('à sortir', totals.toRemove)] : []),
    ...(totals.extraLeft ? [stat('encore en trop', totals.extraLeft, 'is-warn')] : []),
    ...(totals.already ? [stat('déjà en place', totals.already)] : []),
    ...(totals.missing
      ? [
          stat(
            `manquante${totals.missing > 1 ? 's' : ''} (${totals.cardsMissing} carte${totals.cardsMissing > 1 ? 's' : ''})`,
            totals.missing,
            'is-bad',
          ),
        ]
      : []),
    ...(totals.fromDecks ? [stat("prises à d'autres decks", totals.fromDecks, 'is-warn')] : []),
  );

  renderPickup();

  const moves = totals.toMove + totals.toRemove;
  els.buildApply.disabled = moves === 0;
  if (moves) {
    els.buildHint.textContent = [
      totals.toMove ? `${totals.toMove} vers « ${build.plan.destination} »` : null,
      totals.toRemove ? `${totals.toRemove} hors du deck` : null,
    ]
      .filter(Boolean)
      .join(', ');
  } else if (totals.missing || totals.extraLeft) {
    els.buildHint.textContent = 'aucun exemplaire sélectionné';
  } else {
    els.buildHint.textContent = 'le deck correspond déjà à la liste';
  }
}

// --- Récap « où chercher » -------------------------------------------------
//
// La tournée à faire dans la collection : les exemplaires sélectionnés,
// regroupés par endroit, le plus fourni en premier. Il suit les compteurs.

const PITCH_FR = { 1: 'rouge', 2: 'jaune', 3: 'bleu' };

const byCardName = (a, b) => a.row.name.localeCompare(b.row.name) || (a.row.pitch ?? 0) - (b.row.pitch ?? 0);

/** [{ place, total, items: [{ row, line, count }] }], du plus gros au plus petit. */
function pickupGroups() {
  const byPlace = new Map();
  for (const row of build.plan.rows) {
    for (const [inventoryId, count] of allocationFor(row.key)) {
      const line = row.candidates.find((c) => c.inventoryId === inventoryId);
      if (!count || !line) continue;
      const key = line.location ?? '';
      if (!byPlace.has(key)) byPlace.set(key, { place: line.location || null, total: 0, items: [] });
      const group = byPlace.get(key);
      group.items.push({ row, line, count });
      group.total += count;
    }
  }

  const groups = [...byPlace.values()];
  for (const group of groups) group.items.sort(byCardName);
  return groups.sort((a, b) => b.total - a.total || (a.place || '').localeCompare(b.place || '', 'fr'));
}

/** Ce qui manque encore une fois la sélection prise : à acheter ou à échanger. */
function missingCards() {
  return build.plan.rows
    .map((row) => ({ row, count: Math.max(0, row.needed - row.already - takenFor(row.key)) }))
    .filter((item) => item.count > 0)
    .sort(byCardName);
}

const cardLabel = (row) => `${row.name}${PITCH_FR[row.pitch] ? ` (${PITCH_FR[row.pitch]})` : ''}`;

function pickupItemNode({ row, line, count }) {
  const li = document.createElement('li');
  li.className = 'pickup-item';
  li.innerHTML = `
    <span class="pickup-qty">${count}×</span>
    <i class="row-pitch" style="--dot:${PITCH_COLORS[row.pitch] || 'var(--pitch-0)'}"></i>
    <span class="pickup-name">
      <span>${escapeHtml(row.name)}</span>
      <span class="pickup-sub"></span>
    </span>
  `;
  li.querySelector('.pickup-sub').textContent = [
    line ? lineLabel(line) : null,
    line?.forSale ? 'en vente' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return li;
}

function pickupPlaceNode({ title, total, items, note, className }) {
  const box = document.createElement('div');
  box.className = `pickup-place${className ? ` ${className}` : ''}`;

  const head = document.createElement('div');
  head.className = 'pickup-place-head';
  const name = document.createElement('b');
  name.textContent = title;
  const count = document.createElement('span');
  count.className = 'section-count';
  count.textContent = `${total} carte${total > 1 ? 's' : ''}`;
  head.append(name);
  if (note) {
    const badge = document.createElement('span');
    badge.className = 'badge is-partial';
    badge.textContent = note;
    head.append(badge);
  }
  head.append(count);

  const list = document.createElement('ul');
  list.className = 'pickup-items';
  list.append(...items.map(pickupItemNode));

  box.append(head, list);
  return box;
}

function renderPickup() {
  const groups = pickupGroups();
  const missing = missingCards();
  els.buildPickup.hidden = groups.length === 0 && missing.length === 0;
  els.buildReset.hidden = !build.modified;

  const places = groups.length;
  const cards = groups.reduce((sum, g) => sum + g.total, 0);
  els.buildPickupCount.textContent = places
    ? `${places} endroit${places > 1 ? 's' : ''} · ${cards} carte${cards > 1 ? 's' : ''}`
    : 'rien à aller chercher';

  const nodes = groups.map((group) =>
    pickupPlaceNode({
      title: group.place || 'Sans location',
      total: group.total,
      items: group.items,
      note: isDeckLocation(group.place) ? 'autre deck' : null,
    }),
  );
  if (missing.length) {
    nodes.push(
      pickupPlaceNode({
        title: 'Manquantes',
        total: missing.reduce((sum, item) => sum + item.count, 0),
        items: missing.map(({ row, count }) => ({ row, line: null, count })),
        className: 'is-missing',
      }),
    );
  }
  els.buildPickupList.replaceChildren(...nodes);
}

/** Le récap en texte, à coller dans une note ou un message. */
function pickupAsText() {
  const groups = pickupGroups();
  const cards = groups.reduce((sum, g) => sum + g.total, 0);
  const lines = [
    `Monter « ${build.plan.destination} » — ${groups.length} endroit${groups.length > 1 ? 's' : ''}, ${cards} carte${cards > 1 ? 's' : ''}`,
  ];

  for (const group of groups) {
    lines.push('', `${group.place || 'Sans location'} (${group.total})${isDeckLocation(group.place) ? ' — autre deck' : ''}`);
    for (const { row, line, count } of group.items) {
      lines.push(`  ${count}× ${cardLabel(row)} — ${lineLabel(line)}${line.forSale ? ' · en vente' : ''}`);
    }
  }

  const missing = missingCards();
  if (missing.length) {
    lines.push('', `Manquantes (${missing.reduce((sum, item) => sum + item.count, 0)})`);
    for (const { row, count } of missing) lines.push(`  ${count}× ${cardLabel(row)}`);
  }
  return lines.join('\n');
}

/** Rétablit la répartition calculée (le moins d'endroits), après des retouches. */
function resetAllocation() {
  build.allocation = new Map(
    build.plan.rows.map((row) => [row.key, new Map(row.picks.map((p) => [p.inventoryId, p.take]))]),
  );
  build.modified = false;
  renderBuild();
}

/** Où ranger les cartes en trop : toute location sauf le deck lui-même. */
function renderBuildOutOptions() {
  const current = els.buildOut.value;
  els.buildOut.innerHTML = [
    '<option value="">— choisir —</option>',
    ...locations
      .filter((loc) => loc.name !== build.plan.destination)
      .map((loc) => `<option value="${escapeHtml(loc.name)}">${escapeHtml(loc.name)}</option>`),
    `<option value="${NO_LOCATION}">(aucune location)</option>`,
  ].join('');
  if (current) els.buildOut.value = current;
}

/** Seuil à partir duquel un autre deck vaut la peine d'être repris en bloc. */
const DECK_HINT_SHARE = 0.5;

/**
 * Quand les autres decks sont protégés mais que l'un d'eux contient déjà une
 * bonne part de la liste, on le signale : le reprendre évite de courir la
 * collection (typiquement, remonter une liste déjà montée ailleurs).
 */
function renderDeckHint() {
  const [best] = build.plan.deckSources || [];
  const toFind = build.plan.rows.reduce((sum, row) => sum + Math.max(0, row.needed - row.already), 0);
  const show = els.buildProtect.checked && best && toFind > 0 && best.cards / toFind >= DECK_HINT_SHARE;

  els.buildDeckHint.hidden = !show;
  if (show) {
    els.buildDeckHintText.textContent =
      `« ${best.name} » contient déjà ${best.cards} des ${toFind} cartes à réunir. ` +
      'Comme c’est un autre deck, il n’est utilisé qu’en dernier recours.';
  }
}

function renderBuild() {
  renderDeckHint();
  els.buildRows.replaceChildren(...build.plan.rows.map(buildRowNode));

  const settled = build.plan.rows.filter((row) => row.already >= row.needed).length;
  els.buildHideSettledRow.hidden = settled === 0;
  els.buildHideSettledLabel.textContent = `Masquer celles déjà en place (${settled})`;
  els.buildRows.classList.toggle('hide-settled', els.buildHideSettled.checked);

  const surplus = build.plan.surplus || [];
  els.buildSurplus.hidden = surplus.length === 0;
  if (surplus.length) {
    const extra = surplus.reduce((sum, row) => sum + row.extra, 0);
    els.buildSurplusCount.textContent = `${extra} carte${extra > 1 ? 's' : ''}`;
    els.buildSurplusRows.replaceChildren(...surplus.map(surplusRowNode));
    renderBuildOutOptions();
  }

  renderBuildSummary();
  els.buildResult.hidden = false;
}

/** Nom de la destination selon le mode choisi, ou null si incomplet. */
function chosenDestination() {
  const mode = els.buildSetup.querySelector('input[name="build-mode"]:checked')?.value;
  if (mode === 'new') {
    const name = els.buildNewName.value.trim();
    return name ? { name, create: true } : null;
  }
  const name = els.buildExisting.value;
  return name ? { name, create: false } : null;
}

function syncBuildMode() {
  const mode = els.buildSetup.querySelector('input[name="build-mode"]:checked')?.value;
  els.buildNewName.disabled = mode !== 'new';
  els.buildExisting.disabled = mode !== 'existing';
}

/**
 * Ouvre l'écran de montage pour une liste FaBrary. Avec `existing`, on vient
 * d'un deck d'inventaire à comparer : il est présélectionné comme destination.
 */
function openBuild(deck, { existing = null, returnTo = 'deck' } = {}) {
  build.returnTo = returnTo;
  build.deckId = deck.deckId;
  build.plan = null;
  build.allocation = new Map();
  build.removal = new Map();
  build.deckLocationNames = new Set(deckLocations.map((l) => l.name));

  els.buildEyebrow.textContent = existing
    ? `Comparer « ${existing} » à cette liste`
    : 'Monter ce deck dans CardNexus';
  els.buildTitle.textContent = deck.name;
  els.buildSubtitle.textContent = [deck.hero?.name, deck.format].filter(Boolean).join(' · ');
  els.buildNewName.value = deck.hero?.name ? `Deck - ${deck.hero.name}` : deck.name;
  els.buildSideboardLabel.textContent = deck.counts.sideboard
    ? `Inclure la réserve (${deck.counts.sideboard} cartes)`
    : 'Inclure la réserve (aucune)';
  els.buildSideboard.disabled = !deck.counts.sideboard;
  els.buildSideboard.checked = false;
  els.buildProtect.checked = true;

  // Le deck comparé peut ne pas porter l'icône deck (ouvert par lien direct).
  const choices = deckLocations.map((l) => l.name);
  if (existing && !choices.includes(existing)) choices.unshift(existing);
  els.buildExisting.innerHTML = [
    '<option value="">— choisir —</option>',
    ...choices.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`),
  ].join('');
  els.buildExisting.value = existing || '';
  els.buildSetup.querySelector(`input[name="build-mode"][value="${existing ? 'existing' : 'new'}"]`).checked = true;

  els.buildNote.textContent = '';
  els.buildResult.hidden = true;
  syncBuildMode();
  showOnly(els.build);
}

async function computePlan() {
  const destination = chosenDestination();
  if (!destination) {
    els.buildNote.textContent = 'Indiquez un nom de deck, ou choisissez un deck existant.';
    return;
  }

  els.buildCompute.disabled = true;
  els.buildNote.textContent = 'Recherche des cartes dans votre collection…';
  els.buildResult.hidden = true;

  try {
    const res = await fetch('/api/cardnexus/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deckId: build.deckId,
        destination: destination.name,
        includeSideboard: els.buildSideboard.checked,
        existing: !destination.create,
        protectDecks: els.buildProtect.checked,
      }),
    });
    const plan = await res.json();
    if (!res.ok) throw new Error(plan.error || `Erreur ${res.status}`);

    build.plan = plan;
    build.allocation = new Map(
      plan.rows.map((row) => [row.key, new Map(row.picks.map((p) => [p.inventoryId, p.take]))]),
    );
    build.removal = new Map(
      (plan.surplus || []).map((row) => [row.key, new Map(row.picks.map((p) => [p.inventoryId, p.take]))]),
    );
    build.modified = false;
    build.pendingCreate = destination.create ? destination.name : null;

    els.buildNote.textContent = '';
    renderBuild();
  } catch (err) {
    els.buildNote.textContent = err.message;
  } finally {
    els.buildCompute.disabled = false;
  }
}

/** Envoie des déplacements par lots de 200 (plafond de l'API) et cumule les résultats. */
async function postMovesInBatches(moves, destination, origins) {
  let moved = 0;
  const failed = [];
  const undo = [];

  for (let i = 0; i < moves.length; i += 200) {
    const result = await postMoves(moves.slice(i, i + 200), destination);
    moved += result.applied.reduce((sum, m) => sum + m.count, 0);
    failed.push(...result.failed);
    for (const applied of result.applied) {
      undo.push({
        inventoryId: applied.survivingId,
        count: applied.count,
        back: origins.get(applied.inventoryId) ?? null,
      });
    }
  }
  return { moved, failed, undo };
}

async function applyBuild() {
  const destination = build.plan.destination;

  // D'où vient chaque ligne : de quoi annuler en renvoyant tout à sa place.
  const origins = new Map();
  const incoming = [];
  for (const row of build.plan.rows) {
    for (const line of row.candidates) origins.set(line.inventoryId, line.location);
    for (const [inventoryId, count] of allocationFor(row.key)) {
      if (count > 0) incoming.push({ inventoryId, count });
    }
  }

  const outgoing = [];
  for (const row of build.plan.surplus || []) {
    for (const line of row.lines) origins.set(line.inventoryId, destination);
    for (const [inventoryId, count] of removalFor(row.key)) {
      if (count > 0) outgoing.push({ inventoryId, count });
    }
  }

  if (!incoming.length && !outgoing.length) return;

  let outTarget = null;
  if (outgoing.length) {
    const raw = els.buildOut.value;
    if (!raw) {
      els.buildNote.textContent =
        'Choisissez où ranger les cartes en trop, ou remettez leurs compteurs à 0.';
      els.buildOut.scrollIntoView({ block: 'center', behavior: 'smooth' });
      els.buildOut.focus();
      return;
    }
    outTarget = raw === NO_LOCATION ? null : raw;
  }

  els.buildNote.textContent = '';
  els.buildApply.disabled = true;
  els.buildApply.textContent = 'Déplacement…';

  try {
    // La location doit exister avant qu'on y range quoi que ce soit.
    if (build.pendingCreate) {
      const res = await fetch('/api/cardnexus/locations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: build.pendingCreate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      build.pendingCreate = null;
      await loadDeckLocations();
      await loadLocations();
    }

    // Les sorties d'abord : elles ne touchent que des lignes du deck, que les
    // entrées pourraient sinon fusionner (et renuméroter) à leur arrivée.
    const out = outgoing.length
      ? await postMovesInBatches(outgoing, outTarget, origins)
      : { moved: 0, failed: [], undo: [] };
    const into = incoming.length
      ? await postMovesInBatches(incoming, destination, origins)
      : { moved: 0, failed: [], undo: [] };

    const failures = [...out.failed, ...into.failed];
    const undo = [...out.undo, ...into.undo];
    const plural = (n) => (n > 1 ? 's' : '');

    showToast(
      [
        into.moved ? `${into.moved} carte${plural(into.moved)} rangée${plural(into.moved)} dans « ${destination} »` : null,
        out.moved ? `${out.moved} sortie${plural(out.moved)} vers ${outTarget ? `« ${outTarget} »` : 'aucune location'}` : null,
      ]
        .filter(Boolean)
        .join(' · ') +
        (failures.length ? ` (${failures.length} refusée(s) : ${failures[0].reason})` : ''),
      { error: Boolean(failures.length), undo: undo.length ? undo : null, log: { kind: 'build', details: buildDetails(outTarget) } },
    );

    // On ouvre le deck monté, mais sans perdre le plan si la lecture échoue
    // (rien n'a pu être déplacé, par exemple).
    try {
      const check = await fetch(`/api/cardnexus/deck?location=${encodeURIComponent(destination)}`);
      if (check.ok) loadCardnexusDeck(destination);
      else els.buildNote.textContent = `Deck « ${destination} » pas encore lisible : ${(await check.json()).error}`;
    } catch {
      els.buildNote.textContent = 'Déplacements appliqués, mais la relecture du deck a échoué.';
    }
  } catch (err) {
    showToast(err.message, { error: true });
    els.buildApply.disabled = false;
  } finally {
    els.buildApply.textContent = 'Déplacer les cartes';
  }
}

// --- Export texte ----------------------------------------------------------

const PITCH_SHORT = { 1: 'red', 2: 'yellow', 3: 'blue' };

function deckAsText(deck) {
  const lines = [deck.name];
  lines.push([deck.hero?.name, deck.format].filter(Boolean).join(' — '));
  if (deck.author) lines.push(`par ${deck.author}`);
  if (deck.url) lines.push(deck.url);
  lines.push('');

  const block = (title, cards) => {
    if (!cards.length) return;
    const total = cards.reduce((sum, c) => sum + c.quantity, 0);
    lines.push(`${title} (${total})`);
    for (const card of cards) {
      const pitch = PITCH_SHORT[card.pitch];
      lines.push(`${card.quantity} ${card.name}${pitch ? ` (${pitch})` : ''}`);
    }
    lines.push('');
  };

  block('Armes', deck.weapons);
  block('Équipement', deck.equipment);
  block('Deck', deck.deck);
  block('Réserve', deck.sideboard);

  return lines.join('\n').trim();
}

/** Presse-papiers : le pont Android d'abord, l'API du navigateur sinon. */
async function copyText(text) {
  if (window.AndroidApp?.copyText) {
    if (window.AndroidApp.copyText(text)) return;
    throw new Error('Presse-papiers indisponible');
  }
  await navigator.clipboard.writeText(text);
}

// --- Aperçu au survol (souris) et plein écran (toucher) ----------------------

let previewSource = null;

function showPreview(target, event) {
  const src = target.dataset.image;
  if (!src) return;
  if (previewSource !== src) {
    els.previewImg.src = src;
    previewSource = src;
  }
  els.preview.hidden = false;
  movePreview(event);
}

function movePreview(event) {
  if (els.preview.hidden) return;
  const width = 300;
  const height = Math.round((width * 838) / 600);
  const margin = 16;
  const left = Math.min(event.clientX + 22, window.innerWidth - width - margin);
  const top = Math.min(Math.max(event.clientY - height / 2, margin), window.innerHeight - height - margin);
  els.preview.style.left = `${Math.max(margin, left)}px`;
  els.preview.style.top = `${top}px`;
}

const hidePreview = () => {
  els.preview.hidden = true;
};

function openLightbox(src) {
  if (!src) return;
  els.lightboxImg.src = src;
  els.lightbox.hidden = false;
}

function closeLightbox() {
  els.lightbox.hidden = true;
}

// --- Réglages --------------------------------------------------------------

function openSettings() {
  els.settingsSnapshot.value = String(snapshotInterval());
  els.settingsKey.value = getApiKey() || '';
  els.settingsShow.checked = false;
  els.settingsKey.type = 'password';
  els.settings.hidden = false;
}

function closeSettings() {
  els.settings.hidden = true;
}

/** La clé change de compte : on repart d'un état propre plutôt que de purger chaque cache. */
function saveApiKey(value) {
  setApiKey(value);
  location.replace(location.pathname);
}

// --- Comparer un deck d'inventaire à une liste FaBrary ---------------------

const COMPARE_HINT = els.compareNote.innerHTML;
const compare = { pick: false };

/**
 * Depuis un deck ouvert, on compare ce deck. Depuis les Outils, on choisit
 * d'abord le deck (ou l'emplacement) dans la collection.
 */
function openCompare({ pick = false } = {}) {
  pick = pick || state.deck?.source !== 'cardnexus' || els.deck.hidden;
  compare.pick = pick;
  els.compareDeckField.hidden = !pick;
  if (pick) {
    const decks = locations.filter((loc) => placeKind(loc) === 'deck').sort(byPlaceName);
    const others = locations.filter((loc) => placeKind(loc) !== 'deck').sort(byPlaceName);
    els.compareDeck.innerHTML = [...decks, ...others]
      .map((loc) => `<option value="${escapeHtml(loc.name)}">${escapeHtml(loc.name)}</option>`)
      .join('');
  }
  els.compareNote.innerHTML = COMPARE_HINT;
  els.compareNote.querySelector('#compare-target').textContent = pick ? 'le deck choisi' : state.deck.deckId;
  els.compareSubmit.disabled = false;
  els.compare.hidden = false;
  els.compareInput.focus();
}

function closeCompare() {
  els.compare.hidden = true;
}

/** Charge la liste FaBrary, puis ouvre le plan avec le deck ouvert pour destination. */
async function runCompare() {
  const value = els.compareInput.value.trim();
  if (!value) return;
  const target = compare.pick ? els.compareDeck.value : state.deck.deckId;
  if (!target) return;

  els.compareSubmit.disabled = true;
  els.compareNote.textContent = 'Récupération de la liste FaBrary…';
  try {
    const res = await fetch(`/api/deck?id=${encodeURIComponent(value)}`);
    const list = await res.json();
    if (!res.ok) throw new Error(list.error || `Erreur ${res.status}`);

    closeCompare();
    openBuild(list, { existing: target, returnTo: compare.pick ? 'tools' : 'deck' });
    computePlan();
  } catch (err) {
    els.compareNote.textContent = err.message;
  } finally {
    els.compareSubmit.disabled = false;
  }
}

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

// --- Ranger les vracs --------------------------------------------------------

const TIDY_STORAGE = 'tidy_places';
const TIDY_MODE_LABELS = {
  name: 'nom',
  class: 'classe',
  talent: 'talent',
  classTalent: 'classe et talent',
  expansion: 'extension',
};
const tidy = { mode: 'name', plan: null };

/** Endroits cochés : ceux mémorisés, sinon tout ce qui n'est ni deck, ni Kallax, ni classeur. */
function tidySelection() {
  try {
    const saved = JSON.parse(localStorage.getItem(TIDY_STORAGE) || 'null');
    if (Array.isArray(saved)) return new Set(saved);
  } catch {
    // Réglage illisible : on repart des valeurs par défaut.
  }
  return new Set(locations.filter((loc) => placeKind(loc) === 'other').map((loc) => loc.name));
}

function saveTidySelection() {
  const names = [...els.tidyPlaces.querySelectorAll('input:checked')].map((input) => input.value);
  try {
    localStorage.setItem(TIDY_STORAGE, JSON.stringify(names));
  } catch {
    // Stockage indisponible : la sélection vaut pour cette fois.
  }
  return names;
}

async function showTidy() {
  showOnly(els.tidy);
  if (!locations.length) await loadLocations();
  const selected = tidySelection();

  els.tidyPlaces.replaceChildren(
    ...PLACE_KINDS.map(({ kind, label }) => {
      const list = locations.filter((loc) => placeKind(loc) === kind).sort(byPlaceName);
      if (!list.length) return null;
      const group = document.createElement('div');
      group.className = 'tidy-group';
      const title = document.createElement('p');
      title.className = 'tidy-group-title';
      title.textContent = label;
      group.append(title);
      for (const loc of list) {
        const row = document.createElement('label');
        row.className = 'check-row';
        row.innerHTML = `<input type="checkbox" value="${escapeHtml(loc.name)}" /><span>${escapeHtml(loc.name)}</span>`;
        row.querySelector('input').checked = selected.has(loc.name);
        group.append(row);
      }
      return group;
    }).filter(Boolean),
  );
}

async function computeTidy() {
  const places = saveTidySelection();
  if (places.length < 2) {
    els.tidyNote.textContent = 'Cochez au moins deux endroits à ranger.';
    return;
  }

  els.tidyCompute.disabled = true;
  els.tidyResult.hidden = true;
  els.tidyNote.textContent = `Lecture de ${places.length} endroits… Pour une grosse collection, cela peut prendre une minute.`;
  try {
    const res = await fetch('/api/cardnexus/tidy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ places, mode: tidy.mode }),
    });
    const plan = await res.json();
    if (!res.ok) throw new Error(plan.error || `Erreur ${res.status}`);

    tidy.plan = plan;
    for (const { place, before } of plan.layout) placeCounts.set(place, before);
    els.tidyNote.textContent = '';
    renderTidy();
  } catch (err) {
    els.tidyNote.textContent = err.message;
  } finally {
    els.tidyCompute.disabled = false;
  }
}

/** Déplacements regroupés par trajet (d'où → où), le plus gros d'abord. */
function tidyTrips() {
  const trips = new Map();
  for (const move of tidy.plan.moves) {
    const key = `${move.from} → ${move.to}`;
    if (!trips.has(key)) trips.set(key, { from: move.from, to: move.to, total: 0, items: [] });
    const trip = trips.get(key);
    trip.items.push({ row: { name: move.card.name, pitch: move.card.pitch }, line: move.line, count: move.line.quantity });
    trip.total += move.line.quantity;
  }
  const list = [...trips.values()];
  for (const trip of list) trip.items.sort(byCardName);
  return list.sort((a, b) => a.from.localeCompare(b.from, 'fr', { numeric: true }) || b.total - a.total);
}

function renderTidy() {
  const { stats, layout, mode } = tidy.plan;
  const stat = (label, value, className) => {
    const li = document.createElement('li');
    li.className = `stat${className ? ` ${className}` : ''}`;
    li.innerHTML = `<b>${value}</b> ${label}`;
    return li;
  };
  els.tidyStats.replaceChildren(
    stat('à déplacer', stats.toMove),
    stat(`carte${stats.splitBefore > 1 ? 's' : ''} éparpillée${stats.splitBefore > 1 ? 's' : ''} aujourd'hui`, stats.splitBefore, stats.splitBefore ? 'is-warn' : ''),
    stat('cartes rangées', stats.cards),
  );
  els.tidyApply.disabled = stats.toMove === 0;
  els.tidyApply.textContent = stats.toMove ? `Déplacer ${stats.toMove} carte${stats.toMove > 1 ? 's' : ''}` : 'Déjà rangé';

  els.tidyLayout.replaceChildren(
    ...layout.map(({ place, before, after, groups }) => {
      const box = document.createElement('div');
      box.className = 'pickup-place';
      const shown = mode === 'name' ? [] : groups.slice(0, 8);
      const rest = groups.length - shown.length;
      box.innerHTML = `
        <div class="pickup-place-head">
          <b>${escapeHtml(place)}</b>
          <span class="section-count">${before} → ${after} cartes</span>
        </div>
        <p class="tidy-groups"></p>
      `;
      box.querySelector('.tidy-groups').textContent =
        mode === 'name'
          ? `${groups.length} carte${groups.length > 1 ? 's' : ''} différente${groups.length > 1 ? 's' : ''}`
          : [...shown.map((g) => `${g.group} (${g.count})`), rest > 0 ? `+ ${rest} autre${rest > 1 ? 's' : ''}` : null]
              .filter(Boolean)
              .join(' · ') || 'vide';
      return box;
    }),
  );

  const trips = tidyTrips();
  els.tidyMoves.replaceChildren(
    ...(trips.length
      ? trips.map((trip) => pickupPlaceNode({ title: `${trip.from} → ${trip.to}`, total: trip.total, items: trip.items }))
      : [Object.assign(document.createElement('p'), { className: 'move-note', textContent: 'Rien à déplacer : ces endroits sont déjà rangés.' })]),
  );
  els.tidyResult.hidden = false;
}

function tidyAsText() {
  const { stats, mode } = tidy.plan;
  const lines = [`Rangement par ${TIDY_MODE_LABELS[mode]} — ${stats.toMove} cartes à déplacer`];
  for (const trip of tidyTrips()) {
    lines.push('', `${trip.from} → ${trip.to} (${trip.total})`);
    for (const { row, line, count } of trip.items) {
      lines.push(`  ${count}× ${cardLabel(row)} — ${lineLabel(line)}`);
    }
  }
  return lines.join('\n');
}

async function applyTidy() {
  const byDestination = new Map();
  const origins = new Map();
  for (const move of tidy.plan.moves) {
    origins.set(move.line.inventoryId, move.from);
    if (!byDestination.has(move.to)) byDestination.set(move.to, []);
    byDestination.get(move.to).push({ inventoryId: move.line.inventoryId, count: move.line.quantity });
  }
  if (!byDestination.size) return;

  els.tidyApply.disabled = true;
  els.tidyApply.textContent = 'Déplacement…';
  try {
    let moved = 0;
    const failed = [];
    const undo = [];
    for (const [destination, moves] of byDestination) {
      const result = await postMovesInBatches(moves, destination, origins);
      moved += result.moved;
      failed.push(...result.failed);
      undo.push(...result.undo);
    }

    placeCounts.clear();
    showToast(
      `${moved} carte${moved > 1 ? 's' : ''} rangée${moved > 1 ? 's' : ''} (par ${TIDY_MODE_LABELS[tidy.plan.mode]})` +
        (failed.length ? ` (${failed.length} refusée(s) : ${failed[0].reason})` : ''),
      {
        error: Boolean(failed.length),
        undo: undo.length ? undo : null,
        log: {
          kind: 'tidy',
          details: tidyTrips().flatMap((trip) =>
            trip.items.map(({ row, count }) => `${count}× ${cardLabel(row)} : ${trip.from} → ${trip.to}`),
          ),
        },
      },
    );
    els.tidyResult.hidden = true;
    els.tidyNote.textContent = 'Rangement appliqué. Recalculez le plan pour vérifier le résultat.';
  } catch (err) {
    showToast(err.message, { error: true });
    els.tidyApply.disabled = false;
  } finally {
    if (!els.tidyResult.hidden) renderTidy();
  }
}

// --- Confirmation, suppression de cartes, retrait des tags ------------------------

let confirmResolve = null;

/**
 * Demande confirmation dans un panneau (les boîtes de dialogue du navigateur
 * ne s'affichent pas dans la WebView). Résout à true si l'on confirme.
 */
function askConfirm({ title, text, items = [], note = '', ok, danger = false }) {
  els.confirmTitle.textContent = title;
  els.confirmText.textContent = text;
  els.confirmList.replaceChildren(
    ...items.map((item) => Object.assign(document.createElement('li'), { textContent: item })),
  );
  els.confirmList.hidden = items.length === 0;
  els.confirmNote.textContent = note;
  els.confirmOk.textContent = ok;
  els.confirmOk.classList.toggle('danger', danger);
  els.confirmOk.disabled = false;
  els.confirm.hidden = false;
  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}

function closeConfirm(answer = false) {
  els.confirm.hidden = true;
  confirmResolve?.(answer);
  confirmResolve = null;
}

/** Résumé lisible d'une sélection : une ligne par carte, du plus nombreux au moins nombreux. */
function selectionSummary(entries, limit = 12) {
  const byCard = new Map();
  for (const entry of entries) {
    const key = `${entry.cardName}|${entry.pitch ?? ''}`;
    const item = byCard.get(key) || { name: entry.cardName, pitch: entry.pitch, count: 0 };
    item.count += entry.count;
    byCard.set(key, item);
  }
  const list = [...byCard.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const shown = list.slice(0, limit).map((item) => `${item.count}× ${cardLabel(item)}`);
  if (list.length > limit) shown.push(`… et ${list.length - limit} autre${list.length - limit > 1 ? 's' : ''}`);
  return shown;
}

/** Supprime de la collection tout ce qui est en main, après confirmation. */
async function deleteHeldCards() {
  const entries = [...basket.values()];
  if (!entries.length) return;
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const forSale = entries.filter((entry) => entry.forSale).length;
  const wholeLines = entries.filter((entry) => entry.count >= entry.max).length;

  const confirmed = await askConfirm({
    title: 'Supprimer de la collection',
    text: `Supprimer définitivement ${total} carte${total > 1 ? 's' : ''} de votre collection CardNexus ?`,
    items: selectionSummary(entries),
    note: [
      'Impossible à annuler.',
      forSale ? `${forSale} ligne(s) en vente : leur annonce sera retirée.` : '',
      wholeLines > 20 ? `${wholeLines} lignes entières à supprimer, une requête chacune : comptez environ ${Math.ceil(wholeLines / 55)} min.` : '',
    ]
      .filter(Boolean)
      .join(' '),
    ok: `Supprimer ${total} carte${total > 1 ? 's' : ''}`,
    danger: true,
  });
  if (!confirmed) return;

  els.deleteCards.disabled = true;
  els.deleteCards.textContent = 'Suppression…';
  try {
    const res = await fetch('/api/cardnexus/cards/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: entries.map(({ inventoryId, count, max }) => ({ inventoryId, count, max })) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

    const failedIds = new Set(data.failed.map((f) => f.inventoryId));
    for (const entry of entries) if (!failedIds.has(entry.inventoryId)) basket.delete(entry.inventoryId);
    renderBasket();
    setMovePanel('none');
    placeCounts.clear();
    showToast(
      `${data.removed} carte${data.removed > 1 ? 's' : ''} supprimée${data.removed > 1 ? 's' : ''} de la collection` +
        (data.failed.length ? ` (${data.failed.length} échec(s) : ${data.failed[0].reason})` : ''),
      {
        error: Boolean(data.failed.length),
        log: {
          kind: 'delete',
          details: entries
            .filter((e) => !failedIds.has(e.inventoryId))
            .map((e) => `${e.count}× ${cardLabel({ name: e.cardName, pitch: e.pitch })} — ${e.label} — ${placeLabel(e.location)}`),
        },
      },
    );
    await reloadCurrentDeck();
  } catch (err) {
    showToast(err.message, { error: true });
  } finally {
    els.deleteCards.textContent = 'Supprimer';
    els.deleteCards.disabled = basketTotal() === 0;
  }
}

/** Retire les tags de toutes les lignes de la vue, après confirmation. */
async function untagCurrentView() {
  const lines = taggedLines(state.deck);
  if (!lines.length) return;
  const tagCounts = new Map();
  for (const line of lines) for (const tag of line.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);

  const confirmed = await askConfirm({
    title: 'Retirer les tags',
    text: `Retirer tous les tags de ${lines.length} ligne${lines.length > 1 ? 's' : ''} de « ${state.deck.name} » ?`,
    items: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, n]) => `${tag} — ${n} ligne${n > 1 ? 's' : ''}`),
    note: 'Les cartes restent en place ; les tags eux-mêmes existent toujours dans votre compte.',
    ok: 'Retirer les tags',
  });
  if (!confirmed) return;

  els.untagBtn.disabled = true;
  try {
    const res = await fetch('/api/cardnexus/cards/untag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: lines.map((line) => line.inventoryId) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    showToast(
      `Tags retirés de ${data.cleared} ligne${data.cleared > 1 ? 's' : ''}` +
        (data.failed.length ? ` (${data.failed.length} échec(s))` : '') +
        ` dans « ${state.deck.name} »`,
      {
        error: Boolean(data.failed.length),
        log: { kind: 'untag', details: [...tagCounts.entries()].map(([tag, n]) => `${tag} — ${n} ligne${n > 1 ? 's' : ''}`) },
      },
    );
    await reloadCurrentDeck();
  } catch (err) {
    showToast(err.message, { error: true });
  } finally {
    els.untagBtn.disabled = false;
  }
}

// --- Renommer / supprimer un emplacement -------------------------------------

/** Le choix d'endroits à ranger est mémorisé par nom : il suit les renommages. */
function renameInTidySelection(from, to) {
  try {
    const saved = JSON.parse(localStorage.getItem(TIDY_STORAGE) || 'null');
    if (!Array.isArray(saved)) return;
    const next = saved.map((name) => (name === from ? to : name)).filter(Boolean);
    localStorage.setItem(TIDY_STORAGE, JSON.stringify(next));
  } catch {
    // Réglage illisible ou stockage indisponible : rien à suivre.
  }
}

/** Après un renommage ou une suppression, les listes d'emplacements sont à relire. */
async function reloadPlaces() {
  await Promise.all([loadDeckLocations(), loadLocations()]);
}

function openRename() {
  els.renameInput.value = state.deck.deckId;
  els.renameNote.textContent = 'Les cartes restent en place : seul le nom change.';
  els.renameSubmit.disabled = false;
  els.rename.hidden = false;
  els.renameInput.focus();
  els.renameInput.select();
}

const closeRename = () => {
  els.rename.hidden = true;
};

async function submitRename() {
  const from = state.deck.deckId;
  const to = els.renameInput.value.trim();
  if (!to || to === from) return closeRename();

  els.renameSubmit.disabled = true;
  try {
    const res = await fetch('/api/cardnexus/locations/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

    if (placeCounts.has(from)) placeCounts.set(to, placeCounts.get(from));
    placeCounts.delete(from);
    renameInTidySelection(from, to);
    closeRename();
    await reloadPlaces();
    await loadCardnexusDeck(to);
    showToast(`« ${from} » s'appelle maintenant « ${to} ».`, { log: { kind: 'rename' } });
  } catch (err) {
    els.renameNote.textContent = err.message;
    els.renameSubmit.disabled = false;
  }
}

function openDelete() {
  const deck = state.deck;
  const cards = placeCards(deck);
  const total = cards.reduce((sum, card) => sum + card.quantity, 0);

  els.deleteText.textContent = total
    ? `« ${deck.deckId} » contient ${total} carte${total > 1 ? 's' : ''}. Sans destination, elles resteront dans votre collection mais sans emplacement.`
    : `« ${deck.deckId} » est vide.`;
  els.deleteMoveField.hidden = total === 0;
  els.deleteTarget.innerHTML = [
    '<option value="">Ne pas les déplacer (sans emplacement)</option>',
    ...locations
      .filter((loc) => loc.name !== deck.deckId)
      .sort(byPlaceName)
      .map((loc) => `<option value="${escapeHtml(loc.name)}">${escapeHtml(loc.name)}</option>`),
  ].join('');
  els.deleteNote.textContent = 'La suppression est définitive (les cartes, elles, ne sont jamais supprimées).';
  els.deleteSubmit.disabled = false;
  els.delete.hidden = false;
}

const closeDelete = () => {
  els.delete.hidden = true;
};

async function submitDelete() {
  const deck = state.deck;
  const name = deck.deckId;
  const target = els.deleteTarget.value || null;

  els.deleteSubmit.disabled = true;
  try {
    // Les cartes d'abord, si on a choisi où les mettre : après, l'emplacement n'existe plus.
    let moved = 0;
    if (target) {
      els.deleteNote.textContent = `Déplacement des cartes vers « ${target} »…`;
      const origins = new Map();
      const moves = [];
      for (const card of placeCards(deck)) {
        for (const line of card.printings || []) {
          origins.set(line.inventoryId, name);
          moves.push({ inventoryId: line.inventoryId, count: line.quantity });
        }
      }
      const result = await postMovesInBatches(moves, target, origins);
      moved = result.moved;
      if (result.failed.length) {
        throw new Error(`${result.failed.length} ligne(s) n'ont pas pu être déplacées (${result.failed[0].reason}). Rien n'a été supprimé.`);
      }
    }

    els.deleteNote.textContent = 'Suppression…';
    const res = await fetch('/api/cardnexus/locations/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

    placeCounts.clear();
    renameInTidySelection(name, null);
    closeDelete();
    await reloadPlaces();
    showToast(
      `« ${name} » supprimé` + (moved ? ` · ${moved} carte${moved > 1 ? 's' : ''} → « ${target} »` : '') + '.',
      { log: { kind: 'deleteLocation' } },
    );
    returnToTab();
  } catch (err) {
    els.deleteNote.textContent = err.message;
    els.deleteSubmit.disabled = false;
  }
}

// --- Historique ----------------------------------------------------------------
//
// Deux sources. Le journal : ce que l'app a fait, gardé sur le téléphone, avec
// le détail et de quoi annuler un déplacement. « Modifié récemment » : ce que
// l'API sait, c'est-à-dire la date de dernière modification de chaque ligne —
// y compris ce qui a été fait sur le site, mais sans dire quoi.

const JOURNAL_STORAGE = 'action_log';
const JOURNAL_MAX = 300;
const JOURNAL_MAX_DETAILS = 300;

const LOG_KINDS = {
  move: 'Déplacement',
  build: 'Montage de deck',
  tidy: 'Rangement',
  delete: 'Suppression de cartes',
  untag: 'Retrait des tags',
  rename: 'Renommage',
  deleteLocation: "Suppression d'emplacement",
  undo: 'Annulation',
};

const placeLabel = (name) => (name == null || name === UNPLACED ? 'sans emplacement' : name);

function readJournal() {
  try {
    const list = JSON.parse(localStorage.getItem(JOURNAL_STORAGE) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeJournal(list) {
  try {
    localStorage.setItem(JOURNAL_STORAGE, JSON.stringify(list.slice(0, JOURNAL_MAX)));
  } catch {
    // Stockage plein ou indisponible : le journal n'est qu'un confort.
  }
}

/** Inscrit une action ; renvoie son identifiant. */
function logAction({ kind, summary, details = [], undo = null }) {
  const entry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    kind,
    summary,
    details: details.slice(0, JOURNAL_MAX_DETAILS),
    more: Math.max(0, details.length - JOURNAL_MAX_DETAILS),
    undo: undo?.length ? undo : null,
    undone: false,
  };
  writeJournal([entry, ...readJournal()]);
  if (!els.history.hidden) renderJournal();
  return entry.id;
}

function markUndone(id) {
  if (!id) return;
  writeJournal(readJournal().map((entry) => (entry.id === id ? { ...entry, undone: true } : entry)));
}

/** Détail d'un montage : ce qui entre, d'où, et ce qui sort, vers où. */
function buildDetails(outTarget) {
  const destination = build.plan.destination;
  const lines = [];
  for (const row of build.plan.rows) {
    for (const [inventoryId, count] of allocationFor(row.key)) {
      const line = row.candidates.find((c) => c.inventoryId === inventoryId);
      if (count > 0 && line) lines.push(`${count}× ${cardLabel(row)} : ${placeLabel(line.location)} → ${destination}`);
    }
  }
  for (const row of build.plan.surplus || []) {
    const count = removedFor(row.key);
    if (count > 0) lines.push(`${count}× ${cardLabel(row)} : ${destination} → ${placeLabel(outTarget)}`);
  }
  return lines;
}

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function dayLabel(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return 'Hier';
  const label = dayFormat.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Regroupe des éléments datés par jour, dans l'ordre reçu. */
function byDay(items, dateOf) {
  const days = [];
  for (const item of items) {
    const date = new Date(dateOf(item));
    const label = Number.isNaN(date.getTime()) ? 'Date inconnue' : dayLabel(date);
    if (days.at(-1)?.label !== label) days.push({ label, items: [] });
    days.at(-1).items.push(item);
  }
  return days;
}

function journalEntryNode(entry) {
  const li = document.createElement('li');
  li.className = `journal-entry${entry.undone ? ' is-undone' : ''}`;

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'journal-head';
  head.innerHTML = `
    <span class="journal-time"></span>
    <span class="journal-body">
      <span class="journal-kind"></span>
      <span class="journal-summary"></span>
    </span>
    <span class="build-row-caret">${entry.details.length ? '▸' : ''}</span>
  `;
  head.querySelector('.journal-time').textContent = timeFormat.format(new Date(entry.at));
  head.querySelector('.journal-kind').textContent =
    (LOG_KINDS[entry.kind] || entry.kind) + (entry.undone ? ' · annulé' : '');
  head.querySelector('.journal-summary').textContent = entry.summary;

  const details = document.createElement('div');
  details.className = 'journal-details';
  details.hidden = true;
  const list = document.createElement('ul');
  list.append(...entry.details.map((text) => Object.assign(document.createElement('li'), { textContent: text })));
  if (entry.more) list.append(Object.assign(document.createElement('li'), { textContent: `… et ${entry.more} de plus` }));
  details.append(list);

  if (entry.undo && !entry.undone) {
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'link-btn';
    undo.textContent = 'Annuler ce déplacement';
    undo.addEventListener('click', () => undoJournalEntry(entry, undo));
    details.append(undo);
  }

  head.addEventListener('click', () => {
    if (!entry.details.length && !entry.undo) return;
    details.hidden = !details.hidden;
    head.querySelector('.build-row-caret').textContent = details.hidden ? '▸' : '▾';
  });

  li.append(head, details);
  return li;
}

function renderJournal() {
  const entries = readJournal();
  els.journalClear.hidden = entries.length === 0;
  if (!entries.length) {
    els.journalList.replaceChildren(
      Object.assign(document.createElement('p'), {
        className: 'move-note',
        textContent: "Rien pour l'instant : les déplacements, montages, rangements et suppressions faits dans l'app s'afficheront ici.",
      }),
    );
    return;
  }
  els.journalList.replaceChildren(
    ...byDay(entries, (e) => e.at).map(({ label, items }) => {
      const section = document.createElement('section');
      section.className = 'journal-day';
      section.append(Object.assign(document.createElement('h3'), { textContent: label }));
      const ul = document.createElement('ul');
      ul.className = 'journal-list';
      ul.append(...items.map(journalEntryNode));
      section.append(ul);
      return section;
    }),
  );
}

async function undoJournalEntry(entry, button) {
  const confirmed = await askConfirm({
    title: 'Annuler ce déplacement',
    text: `Remettre chaque carte là où elle était avant : « ${entry.summary} » ?`,
    items: entry.details.slice(0, 12),
    note: "Si des cartes ont bougé depuis, elles seront quand même renvoyées à leur emplacement d'origine.",
    ok: 'Annuler le déplacement',
  });
  if (!confirmed) return;

  button.disabled = true;
  try {
    const { restored, failed } = await undoMoves(entry.undo);
    markUndone(entry.id);
    placeCounts.clear();
    showToast(
      `${restored} carte${restored > 1 ? 's' : ''} remise${restored > 1 ? 's' : ''} en place` +
        (failed.length ? ` (${failed.length} échec(s) : ${failed[0].reason})` : ''),
      { error: Boolean(failed.length), log: { kind: 'undo', details: [`Annule : ${entry.summary}`] } },
    );
    renderJournal();
  } catch (err) {
    showToast(`Annulation impossible : ${err.message}`, { error: true });
    button.disabled = false;
  }
}

const recent = { lines: [], next: 0, hasMore: false, loading: false };

async function loadRecent({ reset = false } = {}) {
  if (recent.loading) return;
  if (reset) Object.assign(recent, { lines: [], next: 0, hasMore: false });
  recent.loading = true;
  els.recentMore.disabled = true;
  els.recentNote.textContent = 'Lecture des dernières modifications…';
  try {
    const res = await fetch(`/api/cardnexus/recent?offset=${recent.next}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    recent.lines.push(...data.lines);
    recent.next = data.next;
    recent.hasMore = data.hasMore;
    els.recentNote.textContent =
      'Lignes de votre collection, de la plus récemment modifiée à la plus ancienne — y compris les changements faits sur le site CardNexus. ' +
      "L'API donne la date de la dernière modification, pas sa nature.";
    renderRecent();
  } catch (err) {
    els.recentNote.textContent = err.message;
  } finally {
    recent.loading = false;
    els.recentMore.disabled = false;
    els.recentMore.hidden = !recent.hasMore;
  }
}

function renderRecent() {
  els.recentList.replaceChildren(
    ...byDay(recent.lines, (line) => line.updatedAt).map(({ label, items }) => {
      const section = document.createElement('section');
      section.className = 'journal-day';
      section.append(Object.assign(document.createElement('h3'), { textContent: label }));
      const ul = document.createElement('ul');
      ul.className = 'journal-list';
      for (const line of items) {
        const li = document.createElement('li');
        li.className = 'recent-line';
        li.innerHTML = `
          <span class="journal-time"></span>
          <i class="row-pitch" style="--dot:${PITCH_COLORS[line.card.pitch] || 'var(--pitch-0)'}"></i>
          <span class="pickup-name">
            <span></span>
            <span class="pickup-sub"></span>
          </span>
        `;
        li.querySelector('.journal-time').textContent = line.updatedAt ? timeFormat.format(new Date(line.updatedAt)) : '';
        li.querySelector('.pickup-name > span').textContent = `${line.quantity}× ${line.card.name}`;
        li.querySelector('.pickup-sub').textContent = [
          placeLabel(line.location),
          lineLabel(line),
          line.forSale ? 'en vente' : null,
          line.tags?.length ? `tags : ${line.tags.join(', ')}` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        ul.append(li);
      }
      section.append(ul);
      return section;
    }),
  );
}

// --- Photos de la collection ------------------------------------------------------

const SNAPSHOT_STORAGE = 'collection_snapshot';
const CHANGES_STORAGE = 'collection_changes';
const INTERVAL_STORAGE = 'snapshot_interval_h';
const CHANGES_MAX_STEPS = 120;
const CHANGES_MAX_ITEMS = 1500;
/** Laisse l'accueil charger avant de lancer un balayage automatique. */
const AUTO_SNAPSHOT_DELAY_MS = 8000;

let snapshotRunning = false;

function readStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Intervalle entre deux photos automatiques, en heures (0 = jamais). */
function snapshotInterval() {
  const hours = Number(readStored(INTERVAL_STORAGE, 24));
  return Number.isFinite(hours) && hours >= 0 ? hours : 24;
}

const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const shortDate = (iso) => dateTimeFormat.format(new Date(iso)).replace(' ', ' à ');

/**
 * Photographie la collection et, s'il y a une photo précédente, inscrit les
 * différences. Renvoie { changes, first } ou null si une photo est déjà en cours.
 */
async function takeSnapshot({ auto = false } = {}) {
  if (snapshotRunning) return null;
  snapshotRunning = true;
  els.snapshotNow.disabled = true;
  renderSnapshotStatus(auto ? 'Photo automatique en cours…' : 'Photo en cours… (quelques secondes par tranche de 200 lignes)');

  try {
    const res = await fetch('/api/cardnexus/snapshot');
    const now = await res.json();
    if (!res.ok) throw new Error(now.error || `Erreur ${res.status}`);

    const previous = readStored(SNAPSHOT_STORAGE, null);
    let changes = [];
    if (previous?.counts) {
      changes = diffSnapshots(previous.counts, now.counts);
      if (changes.length) {
        const ids = [...new Set(changes.map((c) => c.productId))];
        const namesRes = await fetch('/api/cardnexus/products/names', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
        const names = namesRes.ok ? await namesRes.json() : {};
        const described = changes.map((change) => ({ ...change, ...(names[change.productId] || { name: `Produit ${change.productId}` }) }));
        const step = {
          from: previous.at,
          to: now.at,
          auto,
          total: described.length,
          changes: described.slice(0, CHANGES_MAX_ITEMS),
        };
        writeStored(CHANGES_STORAGE, [step, ...readStored(CHANGES_STORAGE, [])].slice(0, CHANGES_MAX_STEPS));
      }
    }

    const saved = writeStored(SNAPSHOT_STORAGE, { at: now.at, lines: now.lines, cards: snapshotTotal(now.counts), counts: now.counts });
    renderSnapshotStatus(saved ? '' : 'Photo prise, mais la mémoire du téléphone est pleine : elle n’a pas pu être gardée.');
    if (!els.history.hidden) renderChanges();
    return { changes, first: !previous?.counts };
  } catch (err) {
    renderSnapshotStatus(`Photo impossible : ${err.message}`);
    return null;
  } finally {
    snapshotRunning = false;
    els.snapshotNow.disabled = false;
  }
}

/** À l'ouverture : une photo si la dernière est plus vieille que l'intervalle choisi. */
function scheduleAutoSnapshot() {
  const hours = snapshotInterval();
  if (!hours) return;
  const last = readStored(SNAPSHOT_STORAGE, null);
  const age = last?.at ? Date.now() - new Date(last.at).getTime() : Infinity;
  if (age < hours * 3600 * 1000) return;

  setTimeout(async () => {
    const result = await takeSnapshot({ auto: true });
    if (result?.changes.length) {
      showToast(
        `Photo automatique : ${result.changes.length} changement${result.changes.length > 1 ? 's' : ''} dans la collection depuis la dernière. Voir Historique → Changements.`,
      );
    }
  }, AUTO_SNAPSHOT_DELAY_MS);
}

function renderSnapshotStatus(message = '') {
  const last = readStored(SNAPSHOT_STORAGE, null);
  els.snapshotStatus.textContent =
    message ||
    (last?.at
      ? `Dernière photo : ${shortDate(last.at)} · ${last.cards ?? '?'} cartes`
      : 'Aucune photo pour l’instant : la première servira de point de départ.');
}

const CHANGE_GROUPS = [
  { kind: 'added', title: 'Ajoutées', sign: '+' },
  { kind: 'removed', title: 'Supprimées ou vendues', sign: '−' },
  { kind: 'moved', title: 'Déplacées', sign: '' },
];

function changeText(change) {
  const card = `${change.count}× ${cardLabel(change)}`;
  const variant = [change.printNumber, change.finish !== 'Standard' ? change.finish : null, change.condition, change.language?.toUpperCase()]
    .filter(Boolean)
    .join(' · ');
  const where =
    change.kind === 'moved'
      ? `${placeLabel(change.from)} → ${placeLabel(change.to)}`
      : change.kind === 'added'
        ? `dans ${placeLabel(change.to)}`
        : `de ${placeLabel(change.from)}`;
  return { card, sub: [variant, where].filter(Boolean).join(' — ') };
}

function renderChanges() {
  renderSnapshotStatus(snapshotRunning ? 'Photo en cours…' : '');
  const steps = readStored(CHANGES_STORAGE, []);
  if (!steps.length) {
    const hasSnapshot = Boolean(readStored(SNAPSHOT_STORAGE, null));
    els.changesList.replaceChildren(
      Object.assign(document.createElement('p'), {
        className: 'move-note',
        textContent: hasSnapshot
          ? 'Aucun changement détecté entre les photos pour l’instant.'
          : 'Prenez une première photo : les suivantes lui seront comparées.',
      }),
    );
    return;
  }

  els.changesList.replaceChildren(
    ...steps.map((step) => {
      const section = document.createElement('section');
      section.className = 'journal-day';
      const title = document.createElement('h3');
      title.textContent = `Du ${shortDate(step.from)} au ${shortDate(step.to)} · ${step.total} changement${step.total > 1 ? 's' : ''}`;
      section.append(title);

      for (const { kind, title: groupTitle, sign } of CHANGE_GROUPS) {
        const items = step.changes.filter((c) => c.kind === kind);
        if (!items.length) continue;
        const count = items.reduce((sum, c) => sum + c.count, 0);
        const box = document.createElement('div');
        box.className = `pickup-place change-${kind}`;
        box.innerHTML = `
          <div class="pickup-place-head">
            <b></b>
            <span class="section-count">${sign}${count} carte${count > 1 ? 's' : ''}</span>
          </div>
        `;
        box.querySelector('b').textContent = groupTitle;
        const ul = document.createElement('ul');
        ul.className = 'pickup-items';
        for (const change of items.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))) {
          const { card, sub } = changeText(change);
          const li = document.createElement('li');
          li.className = 'pickup-item';
          li.innerHTML = `
            <i class="row-pitch" style="--dot:${PITCH_COLORS[change.pitch] || 'var(--pitch-0)'}"></i>
            <span class="pickup-name"><span></span><span class="pickup-sub"></span></span>
          `;
          li.querySelector('.pickup-name > span').textContent = card;
          li.querySelector('.pickup-sub').textContent = sub;
          ul.append(li);
        }
        box.append(ul);
        section.append(box);
      }
      if (step.total > step.changes.length) {
        section.append(
          Object.assign(document.createElement('p'), {
            className: 'move-note',
            textContent: `… et ${step.total - step.changes.length} autres changements non conservés.`,
          }),
        );
      }
      return section;
    }),
  );
}

function setHistoryTab(tab) {
  for (const chip of els.historyTabs.querySelectorAll('[data-history-tab]')) {
    chip.classList.toggle('is-active', chip.dataset.historyTab === tab);
  }
  els.historyJournal.hidden = tab !== 'journal';
  els.historyRecent.hidden = tab !== 'recent';
  els.historyChanges.hidden = tab !== 'changes';
  if (tab === 'changes') renderChanges();
  if (tab === 'recent' && !recent.lines.length) loadRecent({ reset: true });
}

function showHistory() {
  state.from = null;
  showOnly(els.history);
  renderJournal();
  setHistoryTab('journal');
}

// --- Retour Android --------------------------------------------------------

/**
 * Appelé par le bouton retour du téléphone. Referme d'abord ce qui est ouvert
 * par-dessus, puis remonte d'une vue ; renvoie false à l'accueil pour quitter.
 */
window.__appBack = () => {
  if (!els.settings.hidden) return closeSettings(), true;
  if (!els.compare.hidden) return closeCompare(), true;
  if (!els.actions.hidden) return closeActions(), true;
  if (!els.confirm.hidden) return closeConfirm(false), true;
  if (!els.rename.hidden) return closeRename(), true;
  if (!els.delete.hidden) return closeDelete(), true;
  if (!els.lightbox.hidden) return closeLightbox(), true;
  if (!els.linePicker.hidden) return closeLinePicker(), true;
  if (movePanel !== 'none') return setMovePanel('none'), true;
  if (!els.build.hidden) return leaveBuild(), true;
  if (!els.tidy.hidden) return showTools(), true;
  if (!els.deck.hidden || !els.error.hidden || !els.loading.hidden) return returnToTab(), true;
  if (els.places.hidden) return showHome(), true;
  return false;
};

// --- Événements ------------------------------------------------------------

/** Un lien (ou un identifiant) de deck FaBrary, plutôt qu'un nom de carte. */
const looksLikeFabrary = (value) =>
  /fabrary\.net\/decks\//i.test(value) || /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value.trim());

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = els.input.value.trim();
  if (!value) return;
  if (looksLikeFabrary(value)) {
    loadFabraryDeck(value);
    return;
  }
  if (value.length < 2) {
    els.placesSearchNote.textContent = 'Tapez au moins deux caractères.';
    return;
  }
  if (!cardnexusReady) {
    els.placesSearchNote.textContent = "Chercher dans la collection demande une clé d'API CardNexus (⚙).";
    return;
  }
  els.input.blur();
  runPlacesSearch(value);
});

els.search.addEventListener('click', (event) => {
  const example = event.target.closest('[data-example]');
  if (!example) return;
  els.input.value = example.dataset.example;
  loadFabraryDeck(example.dataset.example);
});

els.tabbar.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (tab) showTab(tab.dataset.tab);
});

els.collectionFilter.addEventListener('input', () => {
  collectionFilter.text = els.collectionFilter.value;
  renderPlacesList();
});
els.collectionKinds.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-kind]');
  if (!chip) return;
  collectionFilter.kind = chip.dataset.kind;
  for (const other of els.collectionKinds.querySelectorAll('[data-kind]')) {
    other.classList.toggle('is-active', other === chip);
  }
  renderPlacesList();
});

els.toolBuild.addEventListener('click', () => {
  showSearch();
  els.placesSearchNote.textContent =
    'Collez le lien du deck FaBrary à monter, puis touchez « Monter dans CardNexus » sur la liste.';
  els.input.focus();
});
els.toolCompare.addEventListener('click', () => openCompare({ pick: true }));
els.historyTabs.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-history-tab]');
  if (chip) setHistoryTab(chip.dataset.historyTab);
});
els.recentMore.addEventListener('click', () => loadRecent());
els.snapshotNow.addEventListener('click', async () => {
  const result = await takeSnapshot();
  if (!result) return;
  showToast(
    result.first
      ? 'Première photo prise : les suivantes lui seront comparées.'
      : result.changes.length
        ? `${result.changes.length} changement${result.changes.length > 1 ? 's' : ''} depuis la photo précédente.`
        : 'Aucun changement depuis la photo précédente.',
  );
});
els.settingsSnapshot.addEventListener('change', () => {
  writeStored(INTERVAL_STORAGE, Number(els.settingsSnapshot.value));
});
els.journalClear.addEventListener('click', async () => {
  const confirmed = await askConfirm({
    title: 'Vider le journal',
    text: "Effacer tout le journal des actions de l'app ? Les cartes ne bougent pas, seul l'historique est effacé.",
    ok: 'Vider le journal',
    danger: true,
  });
  if (!confirmed) return;
  writeJournal([]);
  renderJournal();
});
els.openTidy.addEventListener('click', showTidy);
els.placesCount.addEventListener('click', countAllPlaces);
els.placesList.addEventListener('click', (event) => {
  const place = event.target.closest('[data-place]');
  if (!place) return;
  state.from = 'collection';
  loadCardnexusDeck(place.dataset.place);
});

els.tidyBack.addEventListener('click', showTools);
els.tidySetup.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-tidy-mode]');
  if (!chip) return;
  tidy.mode = chip.dataset.tidyMode;
  for (const other of els.tidySetup.querySelectorAll('[data-tidy-mode]')) {
    other.classList.toggle('is-active', other === chip);
  }
  if (tidy.plan) computeTidy();
});
els.tidySetup.addEventListener('change', saveTidySelection);
els.tidySetup.addEventListener('submit', (event) => {
  event.preventDefault();
  computeTidy();
});
els.tidyApply.addEventListener('click', applyTidy);
els.tidyCopy.addEventListener('click', async () => {
  try {
    await copyText(tidyAsText());
    els.tidyCopy.textContent = 'Copié !';
  } catch {
    els.tidyCopy.textContent = 'Copie refusée';
  }
  setTimeout(() => {
    els.tidyCopy.textContent = 'Copier le plan';
  }, 1600);
});

els.toolbar.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;

  const value = chip.dataset.view;
  if (!value || state.view === value) return;

  state.view = value;
  for (const sibling of chip.parentElement.querySelectorAll('.chip')) {
    sibling.classList.toggle('is-active', sibling === chip);
  }
  renderSectionsAndMarks();
});

els.excessBtn.addEventListener('click', () => takeExcess(Number(els.excessKeep.value) || 3));

els.groupSelect.addEventListener('change', () => {
  state.group = els.groupSelect.value;
  renderSectionsAndMarks();
});

els.copyBtn.addEventListener('click', async () => {
  if (!state.deck) return;
  try {
    await copyText(deckAsText(state.deck));
    showToast('Decklist copiée dans le presse-papiers.');
  } catch {
    showToast('Copie refusée par le téléphone.', { error: true });
  }
});

els.moreBtn.addEventListener('click', openActions);
els.actionsClose.addEventListener('click', closeActions);
els.actions.addEventListener('click', (event) => {
  if (event.target === els.actions) closeActions();
});
// Une action choisie referme le menu (son propre gestionnaire a déjà agi).
els.actionList.addEventListener('click', (event) => {
  if (event.target.closest('.action-item')) closeActions();
});
els.clearBasket.addEventListener('click', () => {
  basket.clear();
  refreshBasketViews();
  refreshOpenSteppers();
  setMovePanel('none');
});

els.sections.addEventListener('pointerover', (event) => {
  if (event.pointerType !== 'mouse') return;
  const target = event.target.closest('[data-image]');
  if (target) showPreview(target, event);
});

els.sections.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse') return;
  if (event.target.closest('[data-image]')) movePreview(event);
});

els.sections.addEventListener('pointerout', (event) => {
  const to = event.relatedTarget;
  if (!to || !to.closest?.('[data-image]')) hidePreview();
});

els.sections.addEventListener('click', (event) => {
  // Le « + » garde son rôle : choisir exemplaire par exemplaire.
  const pickup = event.target.closest('.pickup-btn');
  if (pickup) {
    const card = findCard(pickup.dataset.pickup);
    if (card) openLinePicker(card, pickup);
    return;
  }

  // Sur un deck d'inventaire, toucher une carte prend tous ses exemplaires.
  const slot = event.target.closest('.card-slot.is-selectable');
  if (slot) {
    const card = findCard(slot.dataset.card);
    if (card) toggleCard(card);
    return;
  }

  const target = event.target.closest('[data-image]');
  if (target?.dataset.image) openLightbox(target.dataset.image);
});

// Appui long : voir la carte en grand, même quand le toucher sert à la prendre.
els.sections.addEventListener('contextmenu', (event) => {
  const target = event.target.closest('[data-image]');
  if (!target?.dataset.image) return;
  event.preventDefault();
  openLightbox(target.dataset.image);
});

els.lightbox.addEventListener('click', closeLightbox);

/** Retrouve une carte du deck affiché par son identifiant. */
function findCard(id) {
  return allDeckCards().find((c) => c.id === id) || null;
}

els.linePickerClose.addEventListener('click', closeLinePicker);

document.addEventListener('click', (event) => {
  if (els.linePicker.hidden) return;
  if (event.target.closest('#line-picker') || event.target.closest('.pickup-btn')) return;
  closeLinePicker();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeLinePicker();
  closeLightbox();
  closeSettings();
  closeCompare();
  closeRename();
  closeDelete();
  if (!els.confirm.hidden) closeConfirm(false);
  closeActions();
});

els.deleteCards.addEventListener('click', deleteHeldCards);
els.untagBtn.addEventListener('click', untagCurrentView);
els.confirmForm.addEventListener('submit', (event) => {
  event.preventDefault();
  closeConfirm(true);
});
els.confirmCancel.addEventListener('click', () => closeConfirm(false));
els.confirmClose.addEventListener('click', () => closeConfirm(false));
els.confirm.addEventListener('click', (event) => {
  if (event.target === els.confirm) closeConfirm(false);
});

els.renameBtn.addEventListener('click', openRename);
els.renameClose.addEventListener('click', closeRename);
els.renameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitRename();
});
els.deleteBtn.addEventListener('click', openDelete);
els.deleteClose.addEventListener('click', closeDelete);
els.deleteCancel.addEventListener('click', closeDelete);
els.deleteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitDelete();
});
for (const sheet of [els.rename, els.delete]) {
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) sheet.hidden = true;
  });
}

els.heroArt.addEventListener('click', () => {
  const hero = state.deck?.hero;
  if (hero?.printings?.length) toggleCard(hero);
  else openLightbox(hero?.imageUrl);
});

els.heroArt.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  openLightbox(state.deck?.hero?.imageUrl);
});

els.destination.addEventListener('change', renderBasket);
els.selectAll.addEventListener('click', toggleSelectAll);
els.searchToggle.addEventListener('click', () => setMovePanel('search'));
els.basketToggle.addEventListener('click', () => setMovePanel('basket'));

els.moveSearchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const term = els.moveSearchInput.value.trim();
  if (term.length < 2) {
    els.moveSearchNote.textContent = 'Tapez au moins deux caractères.';
    return;
  }
  els.moveSearchInput.blur();
  runInventorySearch(term);
});

els.applyMove.addEventListener('click', applyBasket);
els.toastUndo.addEventListener('click', undoLastMove);
els.toastClose.addEventListener('click', hideToast);

els.buildBtn.addEventListener('click', () => {
  if (state.deck) openBuild(state.deck);
});

/** Quitte le plan de montage vers là d'où il a été ouvert. */
function leaveBuild() {
  if (build.returnTo === 'tools' || !state.deck) showTools();
  else showOnly(els.deck);
}

els.buildBack.addEventListener('click', leaveBuild);
els.buildSetup.addEventListener('change', syncBuildMode);
els.buildSetup.addEventListener('submit', (event) => {
  event.preventDefault();
  computePlan();
});
els.buildApply.addEventListener('click', applyBuild);
els.buildReset.addEventListener('click', resetAllocation);
// Changer la protection des decks change la répartition : on recalcule.
els.buildProtect.addEventListener('change', () => {
  if (build.plan) computePlan();
});
els.buildDeckHintBtn.addEventListener('click', () => {
  els.buildProtect.checked = false;
  computePlan();
});
els.buildPickupCopy.addEventListener('click', async () => {
  try {
    await copyText(pickupAsText());
    els.buildPickupCopy.textContent = 'Copié !';
  } catch {
    els.buildPickupCopy.textContent = 'Copie refusée';
  }
  setTimeout(() => {
    els.buildPickupCopy.textContent = 'Copier le récap';
  }, 1600);
});
els.buildHideSettled.addEventListener('change', () => {
  els.buildRows.classList.toggle('hide-settled', els.buildHideSettled.checked);
});

els.compareBtn.addEventListener('click', openCompare);
els.compareClose.addEventListener('click', closeCompare);
els.compare.addEventListener('click', (event) => {
  if (event.target === els.compare) closeCompare();
});
els.compareForm.addEventListener('submit', (event) => {
  event.preventDefault();
  els.compareInput.blur();
  runCompare();
});

els.settingsBtn.addEventListener('click', openSettings);
els.settingsClose.addEventListener('click', closeSettings);
els.settings.addEventListener('click', (event) => {
  if (event.target === els.settings) closeSettings();
});
els.settingsShow.addEventListener('change', () => {
  els.settingsKey.type = els.settingsShow.checked ? 'text' : 'password';
});
els.settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveApiKey(els.settingsKey.value);
});
els.settingsClear.addEventListener('click', () => saveApiKey(''));

window.addEventListener('scroll', hidePreview, { passive: true });

// --- Démarrage -------------------------------------------------------------

const params = new URLSearchParams(location.search);
const initialDeck = params.get('deck');
const initialLocation = params.get('location');

state.tab = 'collection';
loadDeckLocations().then(() => {
  updateBuildButton();
  if (!els.places.hidden) renderPlacesList();
});
loadLocations().then(() => {
  if (!els.places.hidden) renderPlacesList();
});
renderBasket();

if (initialDeck) {
  els.input.value = initialDeck;
  state.tab = 'search';
  loadFabraryDeck(initialDeck);
} else if (initialLocation) {
  state.from = 'collection';
  loadCardnexusDeck(initialLocation);
} else {
  showHome();
  // Premier lancement : la clé est le seul réglage, on le propose d'emblée.
  if (!getApiKey()) openSettings();
}
