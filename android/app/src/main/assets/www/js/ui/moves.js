// Cartes en main, barre du bas, recherche dans l'inventaire et déplacements (avec annulation).
import { PITCH_COLORS, els, escapeHtml, state } from './core.js';
import { deckInfo, enrichDecks } from './nav.js';
import { renderDeck } from './deck-view.js';
import { cardLabel } from './build.js';
import {
  placeCounts, placesSearch, renderPlacesList, renderPlacesSearch, runPlacesSearch,
} from './places.js';
import { logAction, markUndone, placeLabel } from './history.js';

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

export {
  NO_LOCATION, allDeckCards, applyBasket, basket, basketTotal, closeLinePicker, hideToast,
  lineLabel, lineRowNode, loadLocations, locations, markHeldCards, movePanel, openLinePicker,
  postMoves, refreshBasketViews, refreshOpenSteppers, reloadCurrentDeck, renderBasket,
  runInventorySearch, setMovePanel, showToast, takeExcess, toggleCard, toggleSelectAll,
  undoLastMove, undoMoves, updateMovebar,
};
