// Importer des cartes : choisir une extension, toucher les cartes à ajouter,
// puis tout envoyer d'un coup vers un emplacement.
import { RARITIES, UNPLACED_LABEL } from '../cardnexus.js';
import { groupExpansions } from '../expansions.js';
import { PITCH_COLORS, escapeHtml } from './core.js';
import { showOnly } from './nav.js';
import { NO_LOCATION, loadLocations, locations, showToast } from './moves.js';
import { cardLabel } from './build.js';
import { byPlaceName, placeCounts } from './places.js';
import { askConfirm } from './sheets.js';

const $ = (sel) => document.querySelector(sel);
const view = $('#import');
const bar = $('#importbar');
const els = {
  expansion: $('#import-expansion'),
  sheet: $('#expansion-sheet'),
  sheetFilter: $('#expansion-filter'),
  sheetGroups: $('#expansion-groups'),
  sheetClose: $('#expansion-close'),
  language: $('#import-language'),
  condition: $('#import-condition'),
  note: $('#import-note'),
  body: $('#import-body'),
  finishes: $('#import-finishes'),
  filter: $('#import-filter'),
  sort: $('#import-sort'),
  rarities: $('#import-rarities'),
  list: $('#import-list'),
  total: $('#import-total'),
  clear: $('#import-clear'),
  destination: $('#import-destination'),
  newRow: $('#import-new-row'),
  newName: $('#import-new-name'),
  apply: $('#import-apply'),
};

const DRAFT_STORAGE = 'import_draft';
const NEW_PLACE = '__nouveau__';
const PITCH_SECTIONS = [
  { pitch: 1, label: 'Pitch rouge' },
  { pitch: 2, label: 'Pitch jaune' },
  { pitch: 3, label: 'Pitch bleu' },
  { pitch: null, label: 'Sans pitch' },
];
const TYPE_LABELS = {
  Hero: 'Héros',
  Weapon: 'Armes',
  Equipment: 'Équipements',
  Action: 'Actions',
  'Attack Reaction': "Réactions d'attaque",
  'Defense Reaction': 'Réactions de défense',
  Instant: 'Instants',
  Block: 'Blocs',
  Resource: 'Ressources',
  Token: 'Jetons',
};
const FINISH_LABELS = { Standard: 'Standard', 'Rainbow Foil': 'Rainbow', 'Cold Foil': 'Cold', 'Gold Foil': 'Gold' };
const LANGUAGE_LABELS = {
  en: 'Anglais', fr: 'Français', de: 'Allemand', it: 'Italien', es: 'Espagnol', ja: 'Japonais', ko: 'Coréen',
  zh: 'Chinois', 'zh-Hans': 'Chinois', pt: 'Portugais',
};
const RARITY_ORDER = [...RARITIES.map((r) => r.key), 'other'];
const rarityInfo = (key) => RARITIES.find((r) => r.key === key) || { key: 'other', label: 'Autres', code: '?' };

/**
 * Ce qui est en cours : l'extension affichée et ses cartes, la finition sur
 * laquelle on compte, et les quantités (« produit|finition » → nombre). Les
 * quantités et ce qu'il faut savoir des cartes comptées sont gardés sur le
 * téléphone : quitter l'écran ou l'app ne perd pas un booster à moitié saisi.
 */
const imp = {
  expansions: [],
  expansionId: null,
  cards: [],
  finish: 'Standard',
  rarities: new Set(),
  counts: new Map(),
  known: new Map(),
};

const countKey = (productId, finish) => `${productId}|${finish}`;

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_STORAGE)) || {};
  } catch {
    return {};
  }
}

function saveDraft() {
  const draft = {
    expansionId: imp.expansionId,
    finish: imp.finish,
    language: els.language.value || readDraft().language || 'en',
    condition: els.condition.value,
    sort: els.sort.value,
    destination: els.destination.value === NEW_PLACE ? readDraft().destination : els.destination.value,
    counts: Object.fromEntries(imp.counts),
    known: Object.fromEntries([...imp.known].filter(([id]) => [...imp.counts.keys()].some((k) => k.startsWith(`${id}|`)))),
  };
  try {
    localStorage.setItem(DRAFT_STORAGE, JSON.stringify(draft));
  } catch {
    // Mémoire pleine : le brouillon ne survivra pas à la fermeture, rien de plus.
  }
}

function restoreDraft() {
  const draft = readDraft();
  imp.counts = new Map(Object.entries(draft.counts || {}).filter(([, n]) => n > 0));
  imp.known = new Map(Object.entries(draft.known || {}));
  imp.finish = draft.finish || 'Standard';
  imp.expansionId = draft.expansionId ?? null;
  if (draft.condition) els.condition.value = draft.condition;
  // Par défaut, l'ordre des numéros de print, celui du classeur.
  if ([...els.sort.options].some((o) => o.value === draft.sort)) els.sort.value = draft.sort;
}

// --- Ouverture ----------------------------------------------------------------

let started = false;

async function showImport() {
  if (!started) {
    started = true;
    restoreDraft();
  }
  showOnly(view);
  renderDestinations();
  updateImportBar();
  if (!imp.expansions.length) await loadExpansions();
}

async function loadExpansions() {
  els.note.textContent = '';
  try {
    const res = await fetch('/api/cardnexus/expansions');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    imp.expansions = data;
  } catch (err) {
    els.expansion.textContent = 'Extensions indisponibles';
    els.note.textContent = err.message;
    return;
  }
  els.expansion.disabled = false;
  if (imp.expansionId != null && imp.expansions.some((exp) => exp.id === Number(imp.expansionId))) {
    await loadExpansion(imp.expansionId);
  } else {
    imp.expansionId = null;
    renderExpansionButton();
  }
}

function renderExpansionButton() {
  const chosen = imp.expansions.find((exp) => exp.id === imp.expansionId);
  els.expansion.textContent = chosen ? chosen.name : 'Choisir une extension…';
  els.expansion.classList.toggle('is-empty', !chosen);
}

// --- Choix de l'extension -----------------------------------------------------

function openExpansionSheet() {
  els.sheetFilter.value = '';
  renderExpansionGroups();
  els.sheet.hidden = false;
  const active = els.sheetGroups.querySelector('.is-active');
  if (active) active.scrollIntoView({ block: 'center' });
}

function closeExpansionSheet() {
  els.sheet.hidden = true;
}

function renderExpansionGroups() {
  const groups = groupExpansions(imp.expansions, els.sheetFilter.value);
  if (!groups.length) {
    els.sheetGroups.replaceChildren(
      Object.assign(document.createElement('p'), { className: 'move-note', textContent: 'Aucune extension ne correspond.' }),
    );
    return;
  }
  els.sheetGroups.replaceChildren(
    ...groups.map(({ label, expansions }) => {
      const section = document.createElement('section');
      section.className = 'expansion-group';
      section.append(Object.assign(document.createElement('h3'), { textContent: label }));
      for (const exp of expansions) {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'expansion-option';
        option.dataset.expansion = exp.id;
        option.textContent = exp.name;
        option.classList.toggle('is-active', exp.id === imp.expansionId);
        section.append(option);
      }
      return section;
    }),
  );
}

async function loadExpansion(id) {
  imp.expansionId = id ? Number(id) : null;
  imp.cards = [];
  imp.rarities.clear();
  els.body.hidden = true;
  renderExpansionButton();
  saveDraft();
  if (!imp.expansionId) return;

  const expansion = imp.expansions.find((exp) => exp.id === imp.expansionId);
  renderLanguages(expansion);
  els.note.textContent = '';
  try {
    const res = await fetch(`/api/cardnexus/expansion-cards?id=${imp.expansionId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    // Une réponse arrivée après un changement d'extension ne compte plus.
    if (imp.expansionId !== expansion.id) return;
    imp.cards = data.map((card) => ({ ...card, expansion: expansion.code || expansion.name }));
  } catch (err) {
    els.note.textContent = err.message;
    return;
  }
  if (!imp.cards.length) {
    els.note.textContent = 'Aucune carte trouvée dans cette extension.';
    return;
  }
  const finishes = availableFinishes();
  if (!finishes.includes(imp.finish)) imp.finish = 'Standard';
  els.body.hidden = false;
  renderFinishes();
  renderRarities();
  renderList();
}

function renderLanguages(expansion) {
  const wanted = readDraft().language || els.language.value || 'en';
  const codes = expansion?.languages?.length ? expansion.languages : ['en'];
  els.language.replaceChildren(...codes.map((code) => new Option(LANGUAGE_LABELS[code] || code, code)));
  els.language.value = codes.includes(wanted) ? wanted : codes.includes('en') ? 'en' : codes[0];
}

function renderDestinations() {
  const previous = els.destination.value || readDraft().destination || '';
  const options = [
    new Option(UNPLACED_LABEL, NO_LOCATION),
    ...[...locations].sort(byPlaceName).map((loc) => new Option(loc.name, loc.name)),
    new Option('+ Nouvel emplacement…', NEW_PLACE),
  ];
  els.destination.replaceChildren(...options);
  if ([...els.destination.options].some((o) => o.value === previous)) els.destination.value = previous;
  syncNewPlace();
}

/** « Nouvel emplacement » choisi : le champ du nom apparaît au-dessus de la barre. */
function syncNewPlace({ focus = false } = {}) {
  const creating = els.destination.value === NEW_PLACE;
  els.newRow.hidden = !creating;
  if (creating && focus) els.newName.focus();
}

/**
 * L'emplacement où ajouter : existant, aucun, ou nouveau (créé ici s'il
 * n'existe pas déjà sous ce nom). Renvoie undefined si le nom manque.
 */
async function resolveDestination() {
  const value = els.destination.value;
  if (value === NO_LOCATION) return null;
  if (value !== NEW_PLACE) return value;

  const name = els.newName.value.trim();
  if (!name) {
    showToast('Donnez un nom au nouvel emplacement.', { error: true });
    els.newName.focus();
    return undefined;
  }
  const existing = locations.find((loc) => loc.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.name;

  const res = await fetch('/api/cardnexus/locations/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, icon: 'box', color: 'white' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  await loadLocations();
  return data.name || name;
}

// --- Liste des cartes ---------------------------------------------------------

function availableFinishes() {
  const order = ['Standard', 'Rainbow Foil', 'Cold Foil', 'Gold Foil'];
  const found = new Set(imp.cards.flatMap((card) => card.finishes));
  return [...order.filter((f) => found.has(f)), ...[...found].filter((f) => !order.includes(f))];
}

function renderFinishes() {
  els.finishes.replaceChildren(
    ...availableFinishes().map((finish) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.finish = finish;
      chip.textContent = FINISH_LABELS[finish] || finish;
      chip.classList.toggle('is-active', finish === imp.finish);
      return chip;
    }),
  );
  els.finishes.hidden = els.finishes.children.length < 2;
}

function renderRarities() {
  const present = RARITY_ORDER.filter((key) => imp.cards.some((card) => card.rarity === key));
  const chip = (key, label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.dataset.rarity = key;
    button.textContent = label;
    button.classList.toggle('is-active', key === 'all' ? !imp.rarities.size : imp.rarities.has(key));
    return button;
  };
  els.rarities.replaceChildren(chip('all', 'Toutes'), ...present.map((key) => chip(key, rarityInfo(key).label)));
}

/** Les cartes à afficher : finition choisie, raretés cochées, filtre texte. */
function visibleCards() {
  const text = els.filter.value.trim().toLowerCase();
  return imp.cards.filter(
    (card) =>
      card.finishes.includes(imp.finish) &&
      (!imp.rarities.size || imp.rarities.has(card.rarity)) &&
      (!text || card.name.toLowerCase().includes(text) || (card.printNumber || '').toLowerCase().includes(text)),
  );
}

const byNumber = (a, b) => (a.printNumber || '').localeCompare(b.printNumber || '', 'en', { numeric: true });
const byName = (a, b) => a.name.localeCompare(b.name, 'fr') || (a.pitch ?? 0) - (b.pitch ?? 0);

const mainType = (card) => card.types.find((t) => TYPE_LABELS[t]) || card.types[0] || 'Autres';

/** Les sections de la liste selon l'ordre choisi ; dans chaque section, par numéro. */
function sectionsFor(cards, sort) {
  const grouped = (keys, keyOf, labelOf) =>
    keys
      .map((key) => ({ title: labelOf(key), cards: cards.filter((card) => keyOf(card) === key).sort(byNumber) }))
      .filter((section) => section.cards.length);

  if (sort === 'rarity') return grouped(RARITY_ORDER, (card) => card.rarity, (key) => rarityInfo(key).label);
  if (sort === 'pitch') {
    return grouped(
      PITCH_SECTIONS.map((p) => p.pitch),
      (card) => (PITCH_SECTIONS.some((p) => p.pitch === card.pitch) ? card.pitch : null),
      (pitch) => PITCH_SECTIONS.find((p) => p.pitch === pitch).label,
    );
  }
  if (sort === 'type') {
    const order = [...Object.keys(TYPE_LABELS), 'Autres'];
    const present = [...new Set(cards.map(mainType))].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia < 0 ? order.length : ia) - (ib < 0 ? order.length : ib) || a.localeCompare(b);
    });
    return grouped(present, mainType, (type) => TYPE_LABELS[type] || type);
  }
  return [{ title: null, cards: cards.slice().sort(sort === 'name' ? byName : byNumber) }];
}

function renderList() {
  const cards = visibleCards();
  const sections = sectionsFor(cards, els.sort.value);

  if (!cards.length) {
    els.list.replaceChildren(
      Object.assign(document.createElement('p'), { className: 'move-note', textContent: 'Aucune carte ne correspond.' }),
    );
    return;
  }

  els.list.replaceChildren(
    ...sections.map(({ title, cards: group }) => {
      const section = document.createElement('section');
      section.className = 'picker';
      if (title) {
        section.innerHTML = `
          <div class="section-head">
            <h2>${escapeHtml(title)}</h2>
            <span class="section-count">${group.length}</span>
          </div>
        `;
      }
      const ul = document.createElement('ul');
      ul.className = 'import-list';
      ul.append(...group.map(cardNode));
      section.append(ul);
      return section;
    }),
  );
}

function cardNode(card) {
  const li = document.createElement('li');
  li.className = 'import-card';
  li.dataset.product = card.productId;
  li.innerHTML = `
    <button type="button" class="import-card-main" data-act="add" aria-label="Ajouter un ${escapeHtml(card.name)}">
      <img class="import-art" alt="" loading="lazy" ${card.imageUrl ? `src="${escapeHtml(card.imageUrl)}"` : 'hidden'} />
      <span class="import-card-body">
        <span class="import-name">
          <i class="row-pitch" style="--dot:${PITCH_COLORS[card.pitch] || 'var(--pitch-0)'}"></i>
          <span>${escapeHtml(card.name)}</span>
        </span>
        <span class="import-meta"></span>
      </span>
      <output class="import-count"></output>
    </button>
    <div class="import-actions">
      <button type="button" data-act="minus" aria-label="Un de moins">−1</button>
      <button type="button" data-act="plus3" aria-label="Trois de plus">+3</button>
      <button type="button" data-act="clear" class="import-remove" aria-label="Retirer">Retirer</button>
    </div>
  `;
  li.querySelector('.import-art').addEventListener('error', (event) => {
    event.target.hidden = true;
  });
  fillCardNode(li, card);
  return li;
}

/** « HVY001 », ou « HVY 12 » quand le numéro ne porte pas le code de l'extension. */
function printLabel(card) {
  const code = card.expansion || '';
  if (!card.printNumber) return code;
  return card.printNumber.toUpperCase().startsWith(code.toUpperCase()) ? card.printNumber : `${code} ${card.printNumber}`;
}

/** Quantité de la finition affichée, et ce qui est déjà compté dans les autres. */
function fillCardNode(li, card) {
  const count = imp.counts.get(countKey(card.productId, imp.finish)) || 0;
  li.classList.toggle('has-count', count > 0);
  li.querySelector('.import-count').textContent = count ? `×${count}` : '0';
  li.querySelector('[data-act="minus"]').disabled = !count;
  li.querySelector('[data-act="clear"]').disabled = !count;

  const others = card.finishes
    .filter((finish) => finish !== imp.finish && imp.counts.get(countKey(card.productId, finish)))
    .map((finish) => `${imp.counts.get(countKey(card.productId, finish))} ${FINISH_LABELS[finish] || finish}`);
  li.querySelector('.import-meta').textContent = [
    printLabel(card),
    rarityInfo(card.rarity).code,
    others.length ? `+ ${others.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function changeCount(productId, delta, { reset = false } = {}) {
  const card = imp.cards.find((c) => String(c.productId) === String(productId));
  if (!card) return;
  const key = countKey(card.productId, imp.finish);
  const next = reset ? 0 : Math.max(0, (imp.counts.get(key) || 0) + delta);
  if (next) imp.counts.set(key, next);
  else imp.counts.delete(key);
  imp.known.set(String(card.productId), {
    name: card.name,
    pitch: card.pitch,
    printNumber: card.printNumber,
    expansion: card.expansion,
  });

  const li = els.list.querySelector(`[data-product="${CSS.escape(String(card.productId))}"]`);
  if (li) fillCardNode(li, card);
  saveDraft();
  updateImportBar();
}

// --- Barre du bas et envoi ------------------------------------------------------

function totals() {
  let cards = 0;
  for (const n of imp.counts.values()) cards += n;
  return { cards, lines: imp.counts.size };
}

function updateImportBar() {
  const { cards, lines } = totals();
  const active = !view.hidden && cards > 0;
  bar.hidden = !active;
  document.body.classList.toggle('has-importbar', active);
  els.total.textContent = `${cards} carte${cards > 1 ? 's' : ''}` + (lines > 1 ? ` · ${lines} différentes` : '');
}

async function clearImport() {
  const { cards } = totals();
  const confirmed = await askConfirm({
    title: 'Tout effacer',
    text: `Remettre à zéro les ${cards} carte${cards > 1 ? 's' : ''} comptée${cards > 1 ? 's' : ''} ? Rien n'a encore été ajouté à la collection.`,
    ok: 'Tout effacer',
  });
  if (!confirmed) return;
  imp.counts.clear();
  imp.known.clear();
  saveDraft();
  updateImportBar();
  for (const li of els.list.querySelectorAll('[data-product]')) {
    const card = imp.cards.find((c) => String(c.productId) === li.dataset.product);
    if (card) fillCardNode(li, card);
  }
}

/** « 3× Buckwild (rouge) · Rainbow · HNT 001 ». */
function importLineLabel(productId, finish, quantity) {
  const card = imp.known.get(String(productId)) || { name: `Produit ${productId}` };
  return [
    `${quantity}× ${cardLabel(card)}`,
    finish !== 'Standard' ? FINISH_LABELS[finish] || finish : null,
    printLabel(card),
  ]
    .filter(Boolean)
    .join(' · ');
}

async function applyImport() {
  const { cards } = totals();
  if (!cards) return;
  const lines = [...imp.counts].map(([key, quantity]) => {
    const [productId, finish] = key.split('|');
    return { productId, finish, quantity };
  });

  els.apply.disabled = true;
  els.apply.textContent = 'Ajout…';
  try {
    const destination = await resolveDestination();
    if (destination === undefined) return;
    if (els.destination.value === NEW_PLACE) {
      // Le nouvel emplacement devient la destination choisie, pour la suite.
      renderDestinations();
      els.destination.value = destination;
      els.newName.value = '';
      syncNewPlace();
    }
    const res = await fetch('/api/cardnexus/cards/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines, language: els.language.value || 'en', condition: els.condition.value, location: destination }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

    const details = lines.map(({ productId, finish, quantity }) => importLineLabel(productId, finish, quantity));
    // Les cartes refusées restent comptées, pour corriger et renvoyer.
    const refused = new Set(data.failed.map((f) => countKey(f.productId, f.finish)));
    for (const key of [...imp.counts.keys()]) if (!refused.has(key)) imp.counts.delete(key);
    saveDraft();
    updateImportBar();
    renderList();
    if (destination) placeCounts.delete(destination);

    const where = destination ? `« ${destination} »` : 'sans emplacement';
    showToast(
      `${data.added} carte${data.added > 1 ? 's' : ''} ajoutée${data.added > 1 ? 's' : ''} (${where})` +
        (data.failed.length ? ` · ${data.failed.length} refusée(s) : ${data.failed[0].reason}` : ''),
      {
        error: Boolean(data.failed.length),
        undo: data.undo.length ? data.undo : null,
        log: { kind: 'import', details },
      },
    );
  } catch (err) {
    showToast(err.message, { error: true });
  } finally {
    els.apply.disabled = false;
    els.apply.textContent = 'Ajouter';
  }
}

// --- Événements -------------------------------------------------------------------

els.expansion.addEventListener('click', openExpansionSheet);
els.sheetClose.addEventListener('click', closeExpansionSheet);
els.sheet.addEventListener('click', (event) => {
  if (event.target === els.sheet) return closeExpansionSheet();
  const option = event.target.closest('[data-expansion]');
  if (!option) return;
  closeExpansionSheet();
  if (Number(option.dataset.expansion) !== imp.expansionId) loadExpansion(option.dataset.expansion);
});
els.sheetFilter.addEventListener('input', renderExpansionGroups);
els.language.addEventListener('change', saveDraft);
els.condition.addEventListener('change', saveDraft);
els.destination.addEventListener('change', () => {
  syncNewPlace({ focus: true });
  saveDraft();
});
els.newName.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') applyImport();
});
els.filter.addEventListener('input', renderList);
els.sort.addEventListener('change', () => {
  saveDraft();
  renderList();
});
els.finishes.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-finish]');
  if (!chip) return;
  imp.finish = chip.dataset.finish;
  saveDraft();
  renderFinishes();
  renderList();
});
els.rarities.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-rarity]');
  if (!chip) return;
  const key = chip.dataset.rarity;
  if (key === 'all') imp.rarities.clear();
  else if (imp.rarities.has(key)) imp.rarities.delete(key);
  else imp.rarities.add(key);
  renderRarities();
  renderList();
});
els.list.addEventListener('click', (event) => {
  const button = event.target.closest('[data-act]');
  const li = event.target.closest('[data-product]');
  if (!button || !li) return;
  const act = button.dataset.act;
  if (act === 'add') changeCount(li.dataset.product, 1);
  else if (act === 'plus3') changeCount(li.dataset.product, 3);
  else if (act === 'minus') changeCount(li.dataset.product, -1);
  else if (act === 'clear') changeCount(li.dataset.product, 0, { reset: true });
});
els.clear.addEventListener('click', clearImport);
els.apply.addEventListener('click', applyImport);

export {
  closeExpansionSheet, renderDestinations as renderImportDestinations, showImport, updateImportBar,
  view as importView,
};
