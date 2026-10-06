// Affichage d'un deck ou d'un emplacement : en-tête, sections, menu ⋯.
import {
  PITCH_COLORS, PITCH_LABELS, TYPE_ORDER, els, escapeHtml, isListSource, state, typeLabel,
} from './core.js';
import { deckLocations, updateAppBar, updateBuildButton } from './nav.js';
import { locations, markHeldCards, updateMovebar } from './moves.js';
import { PLACE_KINDS, placeKind } from './places.js';

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

  els.stats.replaceChildren(
    statItem(total > 1 ? 'cartes' : 'carte', total),
    statItem(cards.length > 1 ? 'différentes' : 'différente', cards.length),
  );
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

  // Le format n'a d'intérêt que pour une liste FaBrary (« Inventaire CardNexus » n'apprend rien).
  els.heroLine.textContent = [hero?.name, isListSource(deck.source) ? deck.format : null].filter(Boolean).join(' · ');
  els.name.textContent = deck.name;

  const updated = deck.updatedAt
    ? `mis à jour le ${new Date(deck.updatedAt).toLocaleDateString('fr-FR')}`
    : null;
  els.byline.textContent = [deck.author && `par ${deck.author}`, updated].filter(Boolean).join(' · ');

  els.fabraryLink.hidden = !deck.url;
  if (deck.url) {
    els.fabraryLink.href = deck.url;
    els.fabraryLink.textContent = deck.source === 'fabtcg' ? 'Voir sur fabtcg.com ↗' : 'Voir sur FaBrary ↗';
  }

  updateBuildButton();
  els.compareBtn.hidden = deck.source !== 'cardnexus';

  // Toutes les cartes du deck : héros, armes, équipement et deck principal (la
  // réserve garde son propre compte).
  const main = [hero, ...deck.weapons, ...deck.equipment, ...deck.deck].filter(Boolean);
  const total = main.reduce((sum, card) => sum + (card.quantity ?? 1), 0);
  els.stats.replaceChildren(
    statItem(total > 1 ? 'cartes' : 'carte', total),
    statItem(main.length > 1 ? 'différentes' : 'différente', main.length),
  );
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
  updateAppBar();
  renderSections();
  markHeldCards();
  updateMovebar();
}

export {
  closeActions, isStoragePlace, openActions, placeCards, renderDeck, renderSectionsAndMarks,
  taggedLines,
};
