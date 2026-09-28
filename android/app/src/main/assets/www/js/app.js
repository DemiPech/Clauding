import { getApiKey, setApiKey } from './cardnexus.js';

const $ = (sel) => document.querySelector(sel);

const els = {
  form: $('#search-form'),
  input: $('#deck-input'),
  loadBtn: $('#load-btn'),
  myDecksBtn: $('#my-decks-btn'),
  idle: $('#state-idle'),
  loading: $('#state-loading'),
  error: $('#state-error'),
  errorMessage: $('#error-message'),
  picker: $('#picker'),
  pickerList: $('#picker-list'),
  pickerNote: $('#picker-note'),
  pickerCount: $('#picker-count'),
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

  compareBtn: $('#compare-btn'),
  compare: $('#compare'),
  compareForm: $('#compare-form'),
  compareInput: $('#compare-input'),
  compareNote: $('#compare-note'),
  compareTarget: $('#compare-target'),
  compareSubmit: $('#compare-submit'),
  compareClose: $('#compare-close'),

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

/** "Mes decks" ne sert qu'à revenir au sélecteur, depuis une autre vue. */
function updateMyDecksButton() {
  els.myDecksBtn.hidden = !els.idle.hidden;
}

function showOnly(el) {
  for (const node of [els.idle, els.loading, els.error, els.deck, els.build]) {
    node.hidden = node !== el;
  }
  updateMyDecksButton();
  updateMovebar();
  window.scrollTo(0, 0);
}

function showHome() {
  history.replaceState(null, '', location.pathname);
  document.title = 'Decklist Viewer — Flesh and Blood';
  showOnly(els.idle);
}

async function loadFromApi(endpoint, { historyUrl }) {
  showOnly(els.loading);
  els.loadBtn.disabled = true;

  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

    state.deck = data;
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

function deckCardNode(location) {
  const li = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'deck-card';
  button.dataset.location = location.name;
  button.style.setProperty('--chip', LOCATION_COLORS[location.color] || 'var(--line-strong)');

  button.innerHTML = `
    <img class="deck-card-art" alt="" hidden />
    <span class="deck-card-body">
      <span class="deck-card-name">${escapeHtml(location.name)}</span>
      <span class="deck-card-sub is-pending">chargement…</span>
    </span>
  `;
  li.append(button);
  return li;
}

/** Complète chaque carte avec son héros et son nombre de cartes, sans saturer l'API. */
async function enrichDeckCards() {
  const queue = [...els.pickerList.querySelectorAll('.deck-card')];

  const worker = async () => {
    for (let node = queue.shift(); node; node = queue.shift()) {
      const sub = node.querySelector('.deck-card-sub');
      try {
        const res = await fetch(`/api/cardnexus/deck?location=${encodeURIComponent(node.dataset.location)}`);
        const deck = await res.json();
        if (!res.ok) throw new Error(deck.error);

        const total = deck.counts.deck + deck.counts.weapons + deck.counts.equipment;
        sub.textContent = [deck.hero?.name, `${total} cartes`].filter(Boolean).join(' · ');
        sub.classList.remove('is-pending');

        const art = node.querySelector('.deck-card-art');
        if (deck.hero?.imageUrl) {
          art.src = deck.hero.imageUrl;
          art.hidden = false;
        }
      } catch {
        sub.textContent = 'détail indisponible';
        sub.classList.remove('is-pending');
      }
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
      els.pickerNote.textContent =
        "Aucune clé d'API CardNexus : touchez ⚙ en haut à droite pour l'ajouter. Les decks FaBrary fonctionnent sans.";
      return;
    }

    cardnexusReady = true;
    updateBuildButton();
    deckLocations = data.decks;
    if (!deckLocations.length) {
      els.pickerNote.textContent =
        "Aucune location d'inventaire ne porte l'icône deck sur votre compte CardNexus.";
      return;
    }

    els.pickerNote.textContent = '';
    els.pickerCount.textContent = `${deckLocations.length} deck${deckLocations.length > 1 ? 's' : ''}`;
    els.pickerList.replaceChildren(...deckLocations.map(deckCardNode));
    enrichDeckCards();
  } catch (err) {
    els.pickerNote.textContent = `Inventaire CardNexus indisponible : ${err.message}`;
  }
}

// --- Rendu ----------------------------------------------------------------

function statItem(label, value) {
  const li = document.createElement('li');
  li.className = 'stat';
  li.innerHTML = `<b>${value}</b> ${label}`;
  return li;
}

function renderHeader(deck) {
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

/** Découpe le deck principal selon le regroupement choisi. */
function groupMainDeck(cards) {
  if (state.group === 'none') {
    return [{ title: 'Deck', cards }];
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
  const groups = [
    { title: 'Armes', cards: deck.weapons },
    { title: 'Équipement', cards: deck.equipment },
    ...groupMainDeck(deck.deck),
    { title: 'Réserve (sideboard)', cards: deck.sideboard },
  ];

  els.sections.replaceChildren(...groups.map(renderSection).filter(Boolean));
}

function renderDeck() {
  renderHeader(state.deck);
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
const currentDeckName = () => (state.deck?.source === 'cardnexus' ? state.deck.deckId : null);

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
}

function renderBasket() {
  const total = basketTotal();
  els.basketCount.textContent = String(total);
  els.applyMove.disabled = total === 0;

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
}

/**
 * La destination de la barre ne gouverne que les cartes qui sortent du deck :
 * sans aucune sortante, elle n'a rien à régler.
 */
function updateDestinationField(entries) {
  const outgoing = entries.some((entry) => !entry.toDeck);
  els.destination.disabled = !outgoing;
  els.destinationLabel.textContent = outgoing ? 'Sortir vers' : 'Sortir vers (rien à sortir)';
}

/** Les steppers ouverts ailleurs doivent refléter le panier après un retrait. */
function refreshOpenSteppers() {
  closeLinePicker();
  if (movePanel === 'search') renderSearchResults();
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
  const active = state.deck?.source === 'cardnexus' && !els.deck.hidden;
  els.movebar.hidden = !active;
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

function showToast(message, { error = false, undo = null } = {}) {
  els.toastMessage.textContent = message;
  els.toast.classList.toggle('is-error', error);
  els.toastUndo.hidden = !undo;
  lastMove = undo;
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
    const destination = entry.toDeck ? currentDeckName() : outTarget;
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
      { error: Boolean(failed.length), undo: undo.length ? undo : null },
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
async function undoLastMove() {
  if (!lastMove) return;

  // Un lot peut venir de plusieurs origines : un envoi par destination.
  const byOrigin = new Map();
  for (const item of lastMove) {
    if (!byOrigin.has(item.back)) byOrigin.set(item.back, []);
    byOrigin.get(item.back).push({ inventoryId: item.inventoryId, count: item.count });
  }

  els.toastUndo.disabled = true;
  try {
    let restored = 0;
    for (const [origin, moves] of byOrigin) {
      const result = await postMoves(moves, origin);
      restored += result.applied.reduce((sum, m) => sum + m.count, 0);
    }
    lastMove = null;
    showToast(`${restored} carte${restored > 1 ? 's' : ''} remise${restored > 1 ? 's' : ''} en place.`);
    await reloadCurrentDeck();
  } catch (err) {
    showToast(`Annulation impossible : ${err.message}`, { error: true });
  } finally {
    els.toastUndo.disabled = false;
  }
}

async function reloadCurrentDeck() {
  if (state.deck?.source !== 'cardnexus') return;
  const res = await fetch(`/api/cardnexus/deck?location=${encodeURIComponent(state.deck.deckId)}`);
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

function renderBuild() {
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
function openBuild(deck, { existing = null } = {}) {
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
      { error: Boolean(failures.length), undo: undo.length ? undo : null },
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

function openCompare() {
  if (state.deck?.source !== 'cardnexus') return;
  els.compareNote.innerHTML = COMPARE_HINT;
  els.compareNote.querySelector('#compare-target').textContent = state.deck.deckId;
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
  const target = state.deck.deckId;

  els.compareSubmit.disabled = true;
  els.compareNote.textContent = 'Récupération de la liste FaBrary…';
  try {
    const res = await fetch(`/api/deck?id=${encodeURIComponent(value)}`);
    const list = await res.json();
    if (!res.ok) throw new Error(list.error || `Erreur ${res.status}`);

    closeCompare();
    openBuild(list, { existing: target });
    computePlan();
  } catch (err) {
    els.compareNote.textContent = err.message;
  } finally {
    els.compareSubmit.disabled = false;
  }
}

// --- Retour Android --------------------------------------------------------

/**
 * Appelé par le bouton retour du téléphone. Referme d'abord ce qui est ouvert
 * par-dessus, puis remonte d'une vue ; renvoie false à l'accueil pour quitter.
 */
window.__appBack = () => {
  if (!els.settings.hidden) return closeSettings(), true;
  if (!els.compare.hidden) return closeCompare(), true;
  if (!els.lightbox.hidden) return closeLightbox(), true;
  if (!els.linePicker.hidden) return closeLinePicker(), true;
  if (movePanel !== 'none') return setMovePanel('none'), true;
  if (!els.build.hidden) return showOnly(els.deck), true;
  if (els.idle.hidden) return showHome(), true;
  return false;
};

// --- Événements ------------------------------------------------------------

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  loadFabraryDeck(els.input.value);
});

els.idle.addEventListener('click', (event) => {
  const example = event.target.closest('[data-example]');
  if (example) {
    els.input.value = example.dataset.example;
    loadFabraryDeck(example.dataset.example);
    return;
  }

  const deckCard = event.target.closest('[data-location]');
  if (deckCard) loadCardnexusDeck(deckCard.dataset.location);
});

els.myDecksBtn.addEventListener('click', showHome);

els.toolbar.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;

  const key = chip.dataset.view ? 'view' : 'group';
  const value = chip.dataset.view || chip.dataset.group;
  if (state[key] === value) return;

  state[key] = value;
  for (const sibling of chip.parentElement.querySelectorAll('.chip')) {
    sibling.classList.toggle('is-active', sibling === chip);
  }
  renderSectionsAndMarks();
});

els.copyBtn.addEventListener('click', async () => {
  if (!state.deck) return;
  try {
    await copyText(deckAsText(state.deck));
    els.copyBtn.textContent = 'Copié !';
  } catch {
    els.copyBtn.textContent = 'Copie refusée';
  }
  setTimeout(() => {
    els.copyBtn.textContent = 'Copier la decklist';
  }, 1600);
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
});

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

els.buildBack.addEventListener('click', () => showOnly(els.deck));
els.buildSetup.addEventListener('change', syncBuildMode);
els.buildSetup.addEventListener('submit', (event) => {
  event.preventDefault();
  computePlan();
});
els.buildApply.addEventListener('click', applyBuild);
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

loadDeckLocations().then(() => {
  updateMyDecksButton();
  updateBuildButton();
});
loadLocations();
renderBasket();

if (initialDeck) {
  els.input.value = initialDeck;
  loadFabraryDeck(initialDeck);
} else if (initialLocation) {
  loadCardnexusDeck(initialLocation);
} else if (!getApiKey()) {
  // Premier lancement : la clé est le seul réglage, on le propose d'emblée.
  openSettings();
}
