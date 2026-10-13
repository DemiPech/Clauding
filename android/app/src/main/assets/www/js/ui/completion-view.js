// Outil « Cartes à compléter » : communes et rares (ou majestics et
// légendaires) à moins de 3 exemplaires, toutes éditions confondues ou pour
// une extension, avec leur prix ; filtres par rareté, classe et extension.
import { PITCH_COLORS, escapeHtml } from './core.js';
import { showOnly } from './nav.js';
import { showToast } from './moves.js';
import { cardLabel } from './build.js';
import { copyText } from './deck-tools.js';
import { pickExpansion } from './import-view.js';
import { completionTotals } from '../completion.js';

const $ = (sel) => document.querySelector(sel);
const view = $('#completion');
const els = {
  eyebrow: $('#completion-eyebrow'),
  title: $('#completion-title'),
  byline: $('#completion-byline'),
  expansionField: $('#completion-expansion-field'),
  expansion: $('#completion-expansion'),
  target: $('#completion-target'),
  gear: $('#completion-gear'),
  run: $('#completion-run'),
  refresh: $('#completion-refresh'),
  note: $('#completion-note'),
  result: $('#completion-result'),
  stats: $('#completion-stats'),
  filter: $('#completion-filter'),
  group: $('#completion-group'),
  rarities: $('#completion-rarities'),
  copy: $('#completion-copy'),
  list: $('#completion-list'),
  tiers: $('#completion-tiers'),
  modes: $('#completion-modes'),
  classes: $('#completion-classes'),
  expansions: $('#completion-expansions'),
  sheet: $('#choice-sheet'),
  sheetTitle: $('#choice-sheet-title'),
  sheetClose: $('#choice-close'),
  sheetFilter: $('#choice-filter'),
  sheetAll: $('#choice-all'),
  sheetSummary: $('#choice-summary'),
  sheetList: $('#choice-list'),
};

const RARITY_LABELS = { common: 'Communes', rare: 'Rares', majestic: 'Majestics', legendary: 'Légendaires' };
const RARITY_CODES = { common: 'C', rare: 'R', majestic: 'M', legendary: 'L' };
const TIER_RARITIES = { cr: ['common', 'rare'], ml: ['majestic', 'legendary'] };
const TIER_TEXT = { cr: 'communes et rares', ml: 'majestics et légendaires' };

const euros = (value) =>
  value == null ? '—' : value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

const PREFS_STORAGE = 'completion_prefs';

function readPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_STORAGE)) || {};
    return {
      tier: TIER_RARITIES[prefs.tier] ? prefs.tier : 'cr',
      mode: prefs.mode === 'expansion' ? 'expansion' : 'all',
      classes: Array.isArray(prefs.classes) ? prefs.classes : [],
    };
  } catch {
    return { tier: 'cr', mode: 'all', classes: [] };
  }
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_STORAGE, JSON.stringify({ tier: comp.tier, mode: comp.mode, classes: [...comp.classes] }));
  } catch {
    // Pas de stockage : l'outil repartira des réglages par défaut.
  }
}

const prefs = readPrefs();

/**
 * Ce qui est affiché : palier, mode, extension choisie, résultat, filtres.
 * `classes` et `expansions` : les valeurs retenues (vide = toutes).
 */
const comp = {
  tier: prefs.tier,
  mode: prefs.mode,
  expansion: null,
  rows: [],
  rarity: null,
  target: 3,
  classes: new Set(prefs.classes),
  expansions: new Set(),
  expansionNames: new Map(),
};

/** Ouvre l'outil, sur le palier et le mode demandés ou sur les derniers utilisés. */
function showCompletion(mode = comp.mode, tier = comp.tier) {
  if (comp.mode !== mode || comp.tier !== tier) {
    comp.rows = [];
    comp.rarity = null;
    comp.expansions.clear();
    els.result.hidden = true;
    els.note.textContent = '';
  }
  comp.mode = mode;
  comp.tier = tier;
  savePrefs();
  const byExpansion = mode === 'expansion';
  const what = TIER_TEXT[tier];
  els.eyebrow.textContent = 'Cartes à compléter';
  els.title.textContent = `${what[0].toUpperCase()}${what.slice(1)}`;
  els.byline.textContent = byExpansion
    ? `Les ${what} d'une extension dont vous avez moins d'exemplaires que l'objectif, en ne comptant que l'impression de cette extension.`
    : `Les ${what} dont vous avez moins d'exemplaires que l'objectif, en additionnant toutes leurs impressions (2 de Welcome to Rathe + 2 d'un deck Blitz = 4).`;
  els.expansionField.hidden = !byExpansion;
  els.refresh.hidden = byExpansion;
  els.expansions.hidden = byExpansion;
  for (const chip of els.tiers.querySelectorAll('[data-tier]')) chip.classList.toggle('is-active', chip.dataset.tier === tier);
  for (const chip of els.modes.querySelectorAll('[data-mode]')) chip.classList.toggle('is-active', chip.dataset.mode === mode);
  renderExpansionButton();
  renderChoiceButtons();
  if (view.hidden) showOnly(view);
}

function renderExpansionButton() {
  els.expansion.textContent = comp.expansion ? comp.expansion.name : 'Choisir une extension…';
  els.expansion.classList.toggle('is-empty', !comp.expansion);
  els.run.disabled = comp.mode === 'expansion' && !comp.expansion;
}

async function runCompletion({ refresh = false } = {}) {
  if (comp.mode === 'expansion' && !comp.expansion) return;
  const params = new URLSearchParams({ tier: comp.tier, target: els.target.value, gear: els.gear.checked ? '1' : '0' });
  if (comp.mode === 'expansion') params.set('expansion', comp.expansion.id);
  if (refresh) params.set('refresh', '1');

  els.run.disabled = true;
  els.note.textContent = comp.mode === 'all' ? 'Lecture du catalogue et de toute la collection…' : '';
  try {
    const res = await fetch(`/api/cardnexus/completion?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    comp.rows = data.rows;
    comp.target = Number(els.target.value);
    const catalogName = data.source === 'cardvault' ? 'Card Vault' : 'CardNexus';
    els.note.textContent = !data.catalogSize
      ? `Aucune carte (${TIER_TEXT[comp.tier]}) trouvée dans le catalogue ${catalogName}.`
      : data.priced === false
        ? 'Catalogue Card Vault ; prix indisponibles (catalogue CardNexus injoignable).'
        : '';
    els.result.hidden = false;
    renderResult();
    loadExpansionNames();
  } catch (err) {
    els.note.textContent = err.message;
  } finally {
    renderExpansionButton();
  }
}

// --- Résultat ---------------------------------------------------------------------

// Une carte sans classe (« Shadow Action ») se range sous son talent.
const NO_CLASS = 'Sans classe';
const rowClasses = (row) => (row.classes.length ? row.classes : row.talents.length ? row.talents : [NO_CLASS]);
const classOf = (row) => rowClasses(row).join(' / ');
const rowExpansions = (row) => [...new Set(row.printings.map((p) => p.expansion).filter(Boolean))];
const expansionLabel = (code) => comp.expansionNames.get(code) || code;
const firstPrinting = (row) => (row.printings[0]?.expansion ? expansionLabel(row.printings[0].expansion) : 'Autres');

/** Les filtres de classe et d'extension (vide = toutes). */
const CHOICES = {
  classes: { title: 'Classes', all: 'toutes', of: rowClasses, label: (value) => value, active: () => comp.classes },
  expansions: { title: 'Extensions', all: 'toutes', of: rowExpansions, label: expansionLabel, active: () => comp.expansions },
};
const matches = (kind, row) => {
  const chosen = CHOICES[kind].active();
  return !chosen.size || CHOICES[kind].of(row).some((value) => chosen.has(value));
};

function visibleRows() {
  const text = els.filter.value.trim().toLowerCase();
  return comp.rows.filter(
    (row) =>
      (!comp.rarity || row.rarity === comp.rarity) &&
      (!text || row.name.toLowerCase().includes(text)) &&
      matches('classes', row) &&
      (comp.mode === 'expansion' || matches('expansions', row)),
  );
}

// Prix décroissant ou croissant ; les cartes sans prix à la fin.
const byPrice = (direction) => (a, b) =>
  (a.price == null) - (b.price == null) || direction * ((a.price ?? 0) - (b.price ?? 0)) || a.name.localeCompare(b.name, 'en');

function sections(rows) {
  const by = els.group.value;
  if (by === 'name') return [{ title: null, rows }];
  if (by === 'price-desc' || by === 'price-asc') {
    return [{ title: null, rows: rows.slice().sort(byPrice(by === 'price-desc' ? -1 : 1)) }];
  }
  const keyOf = by === 'rarity' ? (row) => RARITY_LABELS[row.rarity] : by === 'expansion' ? firstPrinting : classOf;
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const order =
    by === 'rarity'
      ? Object.values(RARITY_LABELS)
      : [...groups.keys()].sort((a, b) => a.localeCompare(b, 'fr'));
  return order.filter((key) => groups.has(key)).map((key) => ({ title: key, rows: groups.get(key) }));
}

function renderResult() {
  const totals = completionTotals(comp.rows);
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  els.stats.innerHTML = [
    plural(totals.cards, 'carte') + ' à compléter',
    plural(totals.missing, 'exemplaire') + ' manquant' + (totals.missing > 1 ? 's' : ''),
    plural(totals.absent, 'carte') + ' absente' + (totals.absent > 1 ? 's' : ''),
    `≈ ${euros(totals.cost)} pour compléter` + (totals.unpriced ? ` (${totals.unpriced} sans prix)` : ''),
  ]
    .map((text) => `<li class="stat">${escapeHtml(text)}</li>`)
    .join('');

  const present = TIER_RARITIES[comp.tier].filter((r) => comp.rows.some((row) => row.rarity === r));
  const chip = (key, label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.dataset.rarity = key ?? '';
    button.textContent = label;
    button.classList.toggle('is-active', (key ?? null) === comp.rarity);
    return button;
  };
  els.rarities.replaceChildren(chip(null, 'Toutes'), ...present.map((r) => chip(r, RARITY_LABELS[r])));
  renderChoiceButtons();
  renderList();
}

// --- Filtres par classe et par extension ------------------------------------------

function renderChoiceButtons() {
  for (const [kind, button] of [['classes', els.classes], ['expansions', els.expansions]]) {
    const choice = CHOICES[kind];
    const chosen = [...choice.active()];
    const text = !chosen.length
      ? choice.all
      : chosen.length <= 2
        ? chosen.map(choice.label).join(', ')
        : `${chosen.length} choisies`;
    button.textContent = `${choice.title} : ${text}`;
    button.classList.toggle('is-filtered', chosen.length > 0);
  }
}

let choiceKind = null;

function openChoiceSheet(kind) {
  choiceKind = kind;
  els.sheetTitle.textContent = CHOICES[kind].title;
  els.sheetFilter.value = '';
  renderChoices();
  els.sheet.hidden = false;
}

function closeChoiceSheet() {
  els.sheet.hidden = true;
  choiceKind = null;
}

/** Les valeurs présentes dans le résultat, avec le nombre de cartes de chacune. */
function choiceOptions(kind) {
  const counts = new Map();
  for (const row of comp.rows) {
    for (const value of CHOICES[kind].of(row)) counts.set(value, (counts.get(value) || 0) + 1);
  }
  // Une valeur retenue absente du résultat reste visible, pour pouvoir la décocher.
  for (const value of CHOICES[kind].active()) if (!counts.has(value)) counts.set(value, 0);
  const label = CHOICES[kind].label;
  return [...counts]
    .map(([value, count]) => ({ value, count, label: label(value) }))
    .sort((a, b) => (a.value === NO_CLASS) - (b.value === NO_CLASS) || a.label.localeCompare(b.label, 'fr'));
}

function renderChoices() {
  const kind = choiceKind;
  if (!kind) return;
  const chosen = CHOICES[kind].active();
  const text = els.sheetFilter.value.trim().toLowerCase();
  const options = choiceOptions(kind).filter((option) => !text || option.label.toLowerCase().includes(text));
  els.sheetSummary.textContent = chosen.size ? `${chosen.size} choisie${chosen.size > 1 ? 's' : ''}` : 'Toutes affichées';
  els.sheetAll.disabled = !chosen.size;
  if (!options.length) {
    els.sheetList.replaceChildren(
      Object.assign(document.createElement('li'), { className: 'move-note', textContent: 'Aucun choix ne correspond.' }),
    );
    return;
  }
  els.sheetList.replaceChildren(
    ...options.map((option) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <label class="choice-option">
          <input type="checkbox" value="${escapeHtml(option.value)}"${chosen.has(option.value) ? ' checked' : ''} />
          <span class="choice-label">${escapeHtml(option.label)}</span>
          <span class="choice-count">${option.count}</span>
        </label>
      `;
      return li;
    }),
  );
}

function applyChoices() {
  if (choiceKind === 'classes') savePrefs();
  renderChoices();
  renderChoiceButtons();
  renderList();
}

/** Les noms des extensions (CardNexus), pour afficher « Heavy Hitters » plutôt que HVY. */
async function loadExpansionNames() {
  if (comp.expansionNames.size) return;
  try {
    const res = await fetch('/api/cardnexus/expansions', { background: true });
    const list = await res.json();
    if (!res.ok || !Array.isArray(list)) return;
    for (const exp of list) if (exp.code && exp.name) comp.expansionNames.set(exp.code, exp.name);
    if (!els.result.hidden) {
      renderChoiceButtons();
      renderChoices();
      renderList();
    }
  } catch {
    // Sans les noms, les codes d'extension.
  }
}

function renderList() {
  const rows = visibleRows();
  if (!comp.rows.length) {
    els.list.replaceChildren(
      Object.assign(document.createElement('p'), {
        className: 'move-note',
        textContent: `Rien à compléter : vous avez au moins ${comp.target} exemplaire${comp.target > 1 ? 's' : ''} de chaque carte (${TIER_TEXT[comp.tier]}), et 1 pour les héros, armes et équipements.`,
      }),
    );
    return;
  }
  if (!rows.length) {
    els.list.replaceChildren(Object.assign(document.createElement('p'), { className: 'move-note', textContent: 'Aucune carte ne correspond.' }));
    return;
  }
  els.list.replaceChildren(
    ...sections(rows).map(({ title, rows: group }) => {
      const section = document.createElement('section');
      section.className = 'picker';
      if (title) {
        const missing = group.reduce((sum, row) => sum + row.missing, 0);
        const cost = group.reduce((sum, row) => sum + (row.price ?? 0) * row.missing, 0);
        section.innerHTML = `
          <div class="section-head">
            <h2>${escapeHtml(title)}</h2>
            <span class="section-count">${group.length} · −${missing} · ${escapeHtml(euros(Math.round(cost * 100) / 100))}</span>
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
  li.className = 'completion-row';
  const printings = [...new Set(row.printings.map((p) => p.printNumber || p.expansion).filter(Boolean))];
  const meta = [RARITY_CODES[row.rarity], printings.slice(0, 4).join(', ') + (printings.length > 4 ? '…' : '')]
    .filter(Boolean)
    .join(' · ');
  li.innerHTML = `
    <i class="row-pitch" style="--dot:${PITCH_COLORS[row.pitch] || 'var(--pitch-0)'}"></i>
    <span class="completion-body">
      <span class="completion-name">${escapeHtml(row.name)}</span>
      <span class="completion-meta">${escapeHtml(meta)}</span>
    </span>
    <span class="completion-count">${row.owned} / ${row.target}</span>
    <span class="completion-price${row.price == null ? ' is-unknown' : ''}" title="Prix Cardmarket, l'unité">${escapeHtml(euros(row.price))}</span>
    <span class="completion-missing">−${row.missing}</span>
  `;
  return li;
}

/** La liste en texte : « 2x Sink Below (rouge) — 0,25 € », pour un achat ou un échange. */
function completionAsText() {
  const rows = sections(visibleRows()).flatMap((section) => section.rows);
  const where = comp.mode === 'expansion' && comp.expansion ? comp.expansion.name : 'toutes éditions';
  const head = `Cartes à compléter (${TIER_TEXT[comp.tier]}) — ${where}`;
  const price = (row) => (row.price == null ? '' : ` — ${euros(row.price)}`);
  return [head, '', ...rows.map((row) => `${row.missing}x ${cardLabel(row)}${price(row)}`)].join('\n');
}

// --- Événements -------------------------------------------------------------------

els.run.addEventListener('click', () => runCompletion());
els.tiers.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-tier]');
  if (chip && chip.dataset.tier !== comp.tier) showCompletion(comp.mode, chip.dataset.tier);
});
els.modes.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-mode]');
  if (chip && chip.dataset.mode !== comp.mode) showCompletion(chip.dataset.mode, comp.tier);
});
els.refresh.addEventListener('click', () => runCompletion({ refresh: true }));
els.expansion.addEventListener('click', async () => {
  try {
    await pickExpansion({
      selected: comp.expansion?.id ?? null,
      onPick: (expansion) => {
        comp.expansion = expansion;
        comp.rows = [];
        els.result.hidden = true;
        renderExpansionButton();
        runCompletion();
      },
    });
  } catch (err) {
    els.note.textContent = err.message;
  }
});
els.filter.addEventListener('input', renderList);
for (const button of [els.classes, els.expansions]) {
  button.addEventListener('click', () => openChoiceSheet(button.dataset.choice));
}
els.sheetClose.addEventListener('click', closeChoiceSheet);
els.sheet.addEventListener('click', (event) => {
  if (event.target === els.sheet) closeChoiceSheet();
});
els.sheetFilter.addEventListener('input', renderChoices);
els.sheetAll.addEventListener('click', () => {
  CHOICES[choiceKind].active().clear();
  applyChoices();
});
els.sheetList.addEventListener('change', (event) => {
  const box = event.target.closest('input[type="checkbox"]');
  if (!box || !choiceKind) return;
  const chosen = CHOICES[choiceKind].active();
  if (box.checked) chosen.add(box.value);
  else chosen.delete(box.value);
  applyChoices();
});
els.group.addEventListener('change', renderList);
els.rarities.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-rarity]');
  if (!chip) return;
  comp.rarity = chip.dataset.rarity || null;
  renderResult();
});
els.copy.addEventListener('click', async () => {
  try {
    await copyText(completionAsText());
    showToast(`Liste copiée (${visibleRows().length} cartes).`);
  } catch {
    showToast('Copie refusée.', { error: true });
  }
});

export { closeChoiceSheet, showCompletion, view as completionView };
