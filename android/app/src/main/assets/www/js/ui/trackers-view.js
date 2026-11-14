// Suivis de collection : la liste des suivis, leur création ou modification
// par critères, et le détail d'un suivi (cartes, complétion).
import { PITCH_COLORS, escapeHtml } from './core.js';
import { showOnly } from './nav.js';
import { showToast } from './moves.js';
import { cardLabel } from './build.js';
import { copyText } from './deck-tools.js';
import { getApiKey } from '../cardnexus.js';
import { storeGet, storeSet, storeDelete } from '../store.js';
import { keyPrint } from './collection-cache.js';
import {
  LANGUAGES, deleteTracker, describeTracker, normalizeTracker, readTrackers, saveTracker, trackerSignature,
} from '../trackers.js';

const $ = (sel) => document.querySelector(sel);
const view = $('#trackers');
const els = {
  list: $('#trackers-list'),
  items: $('#trackers-items'),
  empty: $('#trackers-empty'),
  create: $('#trackers-new'),
  edit: $('#tracker-edit'),
  editTitle: $('#tracker-edit-title'),
  name: $('#tracker-name'),
  chips: { classes: $('#tracker-classes'), talents: $('#tracker-talents'), types: $('#tracker-types') },
  language: $('#tracker-language'),
  ownedField: $('#tracker-owned-field'),
  ownedLanguage: $('#tracker-owned-language'),
  target: $('#tracker-target'),
  single: $('#tracker-single'),
  editNote: $('#tracker-edit-note'),
  cancel: $('#tracker-cancel'),
  remove: $('#tracker-delete'),
  detail: $('#tracker-detail'),
  title: $('#tracker-title'),
  criteria: $('#tracker-criteria'),
  run: $('#tracker-run'),
  modify: $('#tracker-modify'),
  note: $('#tracker-note'),
  result: $('#tracker-result'),
  bar: $('#tracker-bar'),
  stats: $('#tracker-stats'),
  filter: $('#tracker-filter'),
  group: $('#tracker-group'),
  status: $('#tracker-status'),
  copy: $('#tracker-copy'),
  cards: $('#tracker-list'),
};

for (const [code, label] of Object.entries(LANGUAGES)) els.language.append(new Option(label, code));

/** Écran affiché ('list', 'edit', 'detail'), suivi ouvert, brouillon, résultat. */
const ui = {
  mode: 'list',
  tracker: null,
  draft: null,
  result: null,
  status: 'missing',
  vocabulary: null,
};

const resultKey = (id) => `tracker_result:${keyPrint(getApiKey())}:${id}`;

const percent = (value) => `${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

const formatDate = (iso) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function setMode(mode) {
  ui.mode = mode;
  els.list.hidden = mode !== 'list';
  els.edit.hidden = mode !== 'edit';
  els.detail.hidden = mode !== 'detail';
  if (view.hidden) showOnly(view);
  window.scrollTo(0, 0);
}

// --- Liste des suivis ---------------------------------------------------------------

function showTrackers() {
  setMode('list');
  renderTrackerList();
}

async function renderTrackerList() {
  const trackers = readTrackers();
  els.empty.hidden = trackers.length > 0;
  els.items.replaceChildren(
    ...trackers.map((tracker) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <button type="button" class="tracker-item" data-tracker="${escapeHtml(tracker.id)}">
          <b>${escapeHtml(tracker.name)}</b>
          <span class="tracker-item-meta">${escapeHtml(describeTracker(tracker))}</span>
          <span class="tracker-item-progress">Pas encore calculé</span>
        </button>
      `;
      return li;
    }),
  );
  // La progression gardée de chaque suivi, sans rien recalculer.
  for (const tracker of trackers) {
    const stored = await storeGet(resultKey(tracker.id));
    const node = els.items.querySelector(`[data-tracker="${CSS.escape(tracker.id)}"] .tracker-item-progress`);
    if (!node || !stored || stored.signature !== trackerSignature(tracker)) continue;
    const { totals } = stored;
    node.textContent = `${percent(totals.percent)} · ${totals.complete} / ${totals.cards} cartes complètes · ${formatDate(stored.at)}`;
    const bar = document.createElement('span');
    bar.className = 'tracker-progress';
    bar.innerHTML = `<i style="width:${Math.min(100, totals.percent)}%"></i>`;
    node.after(bar);
  }
}

// --- Création et modification ------------------------------------------------------

async function loadVocabulary() {
  if (ui.vocabulary) return ui.vocabulary;
  const res = await fetch('/api/cardvault/vocabulary');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  ui.vocabulary = data;
  return data;
}

async function editTracker(tracker = null) {
  ui.draft = normalizeTracker(tracker || { name: '' });
  ui.editing = Boolean(tracker);
  els.editTitle.textContent = tracker ? 'Modifier le suivi' : 'Nouveau suivi';
  els.name.value = tracker ? ui.draft.name : '';
  els.language.value = ui.draft.language || '';
  els.ownedLanguage.checked = ui.draft.ownedInLanguage;
  els.target.value = String(ui.draft.target);
  els.single.checked = ui.draft.singleRule;
  els.remove.hidden = !tracker;
  els.editNote.textContent = '';
  syncOwnedField();
  setMode('edit');
  for (const box of Object.values(els.chips)) box.replaceChildren();
  try {
    const vocabulary = await loadVocabulary();
    renderChips(vocabulary);
  } catch (err) {
    els.editNote.textContent = `Classes, talents et types indisponibles (${err.message}).`;
  }
}

function renderChips(vocabulary) {
  for (const [field, box] of Object.entries(els.chips)) {
    // Une valeur déjà retenue reste proposée, même absente de la liste lue.
    const values = [...new Set([...vocabulary[field], ...ui.draft[field]])];
    box.replaceChildren(
      ...values.map((value) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.dataset.value = value;
        chip.textContent = value;
        chip.classList.toggle('is-active', ui.draft[field].includes(value));
        chip.setAttribute('aria-pressed', String(ui.draft[field].includes(value)));
        return chip;
      }),
    );
  }
}

function syncOwnedField() {
  els.ownedField.hidden = !els.language.value;
}

function saveDraft(event) {
  event.preventDefault();
  const tracker = saveTracker({
    ...ui.draft,
    name: els.name.value.trim() || defaultName(),
    language: els.language.value || null,
    ownedInLanguage: els.ownedLanguage.checked,
    target: Number(els.target.value),
    singleRule: els.single.checked,
  });
  openTracker(tracker.id, { run: true });
}

/** Un nom tiré des critères : « Ninja en japonais ». */
function defaultName() {
  const what = [...ui.draft.classes, ...ui.draft.talents, ...ui.draft.types].join(', ') || 'Toutes les cartes';
  return els.language.value ? `${what} en ${LANGUAGES[els.language.value].toLowerCase()}` : what;
}

// --- Détail d'un suivi ----------------------------------------------------------------

async function openTracker(id, { run = false } = {}) {
  const tracker = readTrackers().find((t) => t.id === id);
  if (!tracker) return showTrackers();
  ui.tracker = tracker;
  ui.result = null;
  els.title.textContent = tracker.name;
  els.criteria.textContent = describeTracker(tracker);
  els.result.hidden = true;
  els.note.textContent = '';
  setMode('detail');
  const stored = await storeGet(resultKey(id));
  if (ui.tracker?.id !== id) return;
  if (stored && stored.signature === trackerSignature(tracker)) {
    ui.result = stored;
    els.note.textContent = `Calculé le ${formatDate(stored.at)}. « Actualiser » relit la collection.`;
    renderResult();
  }
  if (run || !ui.result) runTracker();
}

async function runTracker() {
  const tracker = ui.tracker;
  if (!tracker) return;
  els.run.disabled = true;
  els.note.textContent = ui.result ? els.note.textContent : 'Lecture de Card Vault et de la collection…';
  try {
    const res = await fetch('/api/trackers/compute', { method: 'POST', body: JSON.stringify({ tracker }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    await storeSet(resultKey(tracker.id), data);
    if (ui.tracker?.id !== tracker.id) return;
    ui.result = data;
    els.note.textContent = data.rows.length ? '' : 'Aucune carte ne correspond à ces critères.';
    renderResult();
  } catch (err) {
    if (ui.tracker?.id === tracker.id) els.note.textContent = err.message;
  } finally {
    els.run.disabled = false;
  }
}

const RESULT_PLURAL = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

function renderResult() {
  const { totals } = ui.result;
  els.result.hidden = false;
  els.bar.style.width = `${Math.min(100, totals.percent)}%`;
  els.stats.innerHTML = [
    `${percent(totals.percent)} complété`,
    `${totals.complete} / ${RESULT_PLURAL(totals.cards, 'carte')} complète${totals.cards > 1 ? 's' : ''}`,
    `${totals.ownedCopies} / ${RESULT_PLURAL(totals.copies, 'exemplaire')}`,
    `${RESULT_PLURAL(totals.missing, 'exemplaire')} manquant${totals.missing > 1 ? 's' : ''}`,
    `${RESULT_PLURAL(totals.absent, 'carte')} absente${totals.absent > 1 ? 's' : ''}`,
  ]
    .map((text) => `<li class="stat">${escapeHtml(text)}</li>`)
    .join('');
  for (const chip of els.status.querySelectorAll('[data-status]')) {
    chip.classList.toggle('is-active', chip.dataset.status === ui.status);
  }
  renderCards();
}

function visibleRows() {
  const text = els.filter.value.trim().toLowerCase();
  return ui.result.rows.filter(
    (row) =>
      (ui.status === 'all' || (ui.status === 'missing' ? row.missing > 0 : row.missing === 0)) &&
      (!text || row.name.toLowerCase().includes(text)),
  );
}

const RARITY_LABELS = {
  basic: 'Basique', common: 'Commune', rare: 'Rare', 'super-rare': 'Super rare', majestic: 'Majestic',
  legendary: 'Légendaire', fabled: 'Fabled', marvel: 'Marvel', gold: 'Gold', 'gold-marvel': 'Gold Marvel',
  promo: 'Promo', 'promo-marvel': 'Promo Marvel', token: 'Token',
};
const RARITY_ORDER = Object.keys(RARITY_LABELS);
const rarityLabel = (rarity) => RARITY_LABELS[rarity] || rarity || 'Rareté inconnue';

const TYPE_ORDER = ['Hero', 'Demi-Hero', 'Weapon', 'Equipment', 'Action', 'Attack Reaction', 'Defense Reaction', 'Instant', 'Block', 'Resource', 'Token'];
const classOf = (row) => (row.classes.length ? row.classes.join(' / ') : row.talents.length ? row.talents.join(' / ') : 'Sans classe');
const typeOf = (row) => TYPE_ORDER.find((type) => row.types.includes(type)) || row.types[0] || 'Autres';

const SEVERAL = 'Plusieurs extensions';
const UNKNOWN_EXPANSION = 'Extension inconnue';

/** L'extension d'une carte : la seule où elle se trouve, sinon « Plusieurs extensions ». */
const expansionOf = (row) =>
  !row.products?.length ? UNKNOWN_EXPANSION : row.products.length === 1 ? row.products[0] : SEVERAL;

/** Extensions de la plus récente à la plus ancienne, puis « Plusieurs extensions » et l'inconnue. */
function expansionRank(a, b) {
  const tail = [SEVERAL, UNKNOWN_EXPANSION];
  if (tail.includes(a) || tail.includes(b)) return tail.indexOf(a) - tail.indexOf(b);
  const dates = ui.result.productDates || {};
  return String(dates[b] || '').localeCompare(String(dates[a] || '')) || a.localeCompare(b, 'fr');
}

function sections(rows) {
  const by = els.group.value;
  if (by === 'none') return [{ title: null, rows }];
  const keyOf = by === 'type' ? typeOf : by === 'rarity' ? (row) => rarityLabel(row.rarity) : by === 'expansion' ? expansionOf : classOf;
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  if (by === 'expansion') {
    return [...groups.keys()].sort(expansionRank).map((key) => ({ title: key, rows: groups.get(key) }));
  }
  const order = by === 'type' ? TYPE_ORDER : by === 'rarity' ? RARITY_ORDER.map(rarityLabel) : [];
  const rank = (key) => (order.includes(key) ? order.indexOf(key) : order.length);
  return [...groups.keys()]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'fr'))
    .map((key) => ({ title: key, rows: groups.get(key) }));
}

function renderCards() {
  const rows = visibleRows();
  if (!rows.length) {
    const text = !ui.result.rows.length
      ? 'Aucune carte ne correspond à ces critères.'
      : ui.status === 'missing'
        ? 'Rien ne manque : suivi complet.'
        : 'Aucune carte ne correspond.';
    els.cards.replaceChildren(Object.assign(document.createElement('p'), { className: 'move-note', textContent: text }));
    return;
  }
  els.cards.replaceChildren(
    ...sections(rows).map(({ title, rows: group }) => {
      const section = document.createElement('section');
      section.className = 'picker';
      if (title) {
        const missing = group.reduce((sum, row) => sum + row.missing, 0);
        section.innerHTML = `
          <div class="section-head">
            <h2>${escapeHtml(title)}</h2>
            <span class="section-count">${group.length}${missing ? ` · −${missing}` : ''}</span>
          </div>
        `;
      }
      const ul = document.createElement('ul');
      ul.className = 'completion-list';
      ul.append(...group.map(rowNode));
      section.append(ul);
      return section;
    }),
  );
}

function rowNode(row) {
  const li = document.createElement('li');
  li.className = 'tracker-card';
  li.dataset.key = row.key;
  // La rareté la plus courante, et « + Marvel… » si la carte existe aussi en d'autres.
  const rarity = row.rarity
    ? [rarityLabel(row.rarity), ...(row.rarities || []).slice(1).map(rarityLabel)].join(', ')
    : null;
  const meta = [typeOf(row), rarity, row.legendary ? 'Legendary' : null, row.target === 1 ? '1 suffit' : null]
    .filter(Boolean)
    .join(' · ');
  li.innerHTML = `
    <div class="completion-row${row.missing ? '' : ' is-complete'}" role="button" tabindex="0" aria-expanded="false">
      <i class="row-pitch" style="--dot:${PITCH_COLORS[row.pitch] || 'var(--pitch-0)'}"></i>
      <span class="completion-body">
        <span class="completion-name">${escapeHtml(row.name)}</span>
        <span class="completion-meta">${escapeHtml(meta)}</span>
      </span>
      <span class="completion-count">${row.owned} / ${row.target}</span>
      <span class="completion-missing">${row.missing ? `−${row.missing}` : '✓'}</span>
    </div>
    <div class="tracker-prints" hidden></div>
  `;
  return li;
}

// --- Où trouver une carte : ses impressions, selon la langue du suivi -------------------

const FLAGS = { ja: 'JA', en: 'EN', fr: 'FR', de: 'DE', it: 'IT', es: 'ES' };

async function togglePrintings(li) {
  const row = ui.result?.rows.find((r) => r.key === li.dataset.key);
  const head = li.querySelector('.completion-row');
  const box = li.querySelector('.tracker-prints');
  if (!row || !box) return;
  const open = box.hidden;
  box.hidden = !open;
  head.setAttribute('aria-expanded', String(open));
  if (!open || box.dataset.loaded) return;
  const language = ui.tracker?.language || '';
  box.innerHTML = '<p class="move-note">Recherche des impressions…</p>';
  try {
    const params = new URLSearchParams({ ids: row.cardIds.join(','), ...(language ? { language } : {}) });
    const res = await fetch(`/api/cardvault/printings?${params}`, { background: true });
    const prints = await res.json();
    if (!res.ok) throw new Error(prints.error || `Erreur ${res.status}`);
    box.dataset.loaded = '1';
    const where = language ? ` en ${LANGUAGES[language].toLowerCase()}` : '';
    if (!prints.length) {
      box.innerHTML = `<p class="move-note">Aucune impression${escapeHtml(where)} trouvée sur Card Vault.</p>`;
      return;
    }
    box.innerHTML = `
      <p class="tracker-prints-head">Où la trouver${escapeHtml(where)} :</p>
      <ul>
        ${prints
          .map(
            (print) => `
          <li>
            <b>${escapeHtml(print.product || print.setName || print.setCode || '?')}</b>
            <span>${escapeHtml(
              [
                print.printId,
                rarityLabel(print.rarity),
                print.finishes.join(', '),
                !language && print.language ? FLAGS[print.language] || print.language.toUpperCase() : null,
                print.releaseDate ? new Date(print.releaseDate).getFullYear() : null,
              ]
                .filter(Boolean)
                .join(' · '),
            )}</span>
          </li>`,
          )
          .join('')}
      </ul>
    `;
  } catch (err) {
    box.innerHTML = `<p class="move-note">${escapeHtml(err.message)}</p>`;
  }
}

/** Les cartes manquantes en texte : « 2x Bittering Thorns (rouge) ». */
function missingAsText() {
  const rows = ui.result.rows.filter((row) => row.missing > 0);
  return [`${ui.tracker.name} — manquantes`, '', ...rows.map((row) => `${row.missing}x ${cardLabel(row)}`)].join('\n');
}

// --- Retour -------------------------------------------------------------------------

/** Le retour d'Android : du détail ou de l'édition vers la liste. Rend false à la racine. */
function trackersBack() {
  if (ui.mode === 'edit' && ui.editing && ui.tracker) {
    openTracker(ui.tracker.id);
    return true;
  }
  if (ui.mode !== 'list') {
    showTrackers();
    return true;
  }
  return false;
}

// --- Événements ---------------------------------------------------------------------

els.create.addEventListener('click', () => editTracker());
els.items.addEventListener('click', (event) => {
  const item = event.target.closest('[data-tracker]');
  if (item) openTracker(item.dataset.tracker);
});
for (const [field, box] of Object.entries(els.chips)) {
  box.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-value]');
    if (!chip) return;
    const values = new Set(ui.draft[field]);
    if (values.has(chip.dataset.value)) values.delete(chip.dataset.value);
    else values.add(chip.dataset.value);
    ui.draft[field] = [...values];
    chip.classList.toggle('is-active', values.has(chip.dataset.value));
    chip.setAttribute('aria-pressed', String(values.has(chip.dataset.value)));
  });
}
els.language.addEventListener('change', syncOwnedField);
els.edit.addEventListener('submit', saveDraft);
els.cancel.addEventListener('click', () => trackersBack());
els.remove.addEventListener('click', async () => {
  if (!ui.tracker) return;
  const { id, name } = ui.tracker;
  deleteTracker(id);
  await storeDelete(resultKey(id));
  ui.tracker = null;
  showToast(`Suivi « ${name} » supprimé.`);
  showTrackers();
});
els.run.addEventListener('click', runTracker);
els.modify.addEventListener('click', () => editTracker(ui.tracker));
els.cards.addEventListener('click', (event) => {
  const head = event.target.closest('.completion-row');
  if (head) togglePrintings(head.closest('.tracker-card'));
});
els.cards.addEventListener('keydown', (event) => {
  const head = event.target.closest('.completion-row');
  if (head && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    togglePrintings(head.closest('.tracker-card'));
  }
});
els.filter.addEventListener('input', renderCards);
els.group.addEventListener('change', renderCards);
els.status.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-status]');
  if (!chip) return;
  ui.status = chip.dataset.status;
  renderResult();
});
els.copy.addEventListener('click', async () => {
  try {
    await copyText(missingAsText());
    showToast('Liste des manquantes copiée.');
  } catch {
    showToast('Copie refusée.', { error: true });
  }
});

export { showTrackers, trackersBack, view as trackersView };
