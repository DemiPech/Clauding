// Outils « Cartes à compléter » : communes et rares (ou majestics et
// légendaires) à moins de 3 exemplaires, toutes éditions confondues ou pour
// une extension, avec leur prix.
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
};

const RARITY_LABELS = { common: 'Communes', rare: 'Rares', majestic: 'Majestics', legendary: 'Légendaires' };
const RARITY_CODES = { common: 'C', rare: 'R', majestic: 'M', legendary: 'L' };
const TIER_RARITIES = { cr: ['common', 'rare'], ml: ['majestic', 'legendary'] };
const TIER_TEXT = { cr: 'communes et rares', ml: 'majestics et légendaires' };

const euros = (value) =>
  value == null ? '—' : value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

/** Ce qui est affiché : mode, extension choisie, résultat, filtres. */
const comp = {
  tier: 'cr',
  mode: 'all',
  expansion: null,
  rows: [],
  rarity: null,
  target: 3,
};

function showCompletion(mode, tier = comp.tier) {
  if (comp.mode !== mode || comp.tier !== tier) {
    comp.rows = [];
    comp.rarity = null;
    els.result.hidden = true;
    els.note.textContent = '';
  }
  comp.mode = mode;
  comp.tier = tier;
  const byExpansion = mode === 'expansion';
  const what = TIER_TEXT[tier];
  els.eyebrow.textContent = 'Cartes à compléter';
  els.title.textContent = `${what[0].toUpperCase()}${what.slice(1)}`;
  els.byline.textContent = byExpansion
    ? `Les ${what} d'une extension dont vous avez moins d'exemplaires que l'objectif, en ne comptant que l'impression de cette extension.`
    : `Les ${what} dont vous avez moins d'exemplaires que l'objectif, en additionnant toutes leurs impressions (2 de Welcome to Rathe + 2 d'un deck Blitz = 4).`;
  els.expansionField.hidden = !byExpansion;
  els.refresh.hidden = byExpansion;
  for (const chip of els.tiers.querySelectorAll('[data-tier]')) chip.classList.toggle('is-active', chip.dataset.tier === tier);
  for (const chip of els.modes.querySelectorAll('[data-mode]')) chip.classList.toggle('is-active', chip.dataset.mode === mode);
  renderExpansionButton();
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
  } catch (err) {
    els.note.textContent = err.message;
  } finally {
    renderExpansionButton();
  }
}

// --- Résultat ---------------------------------------------------------------------

function visibleRows() {
  const text = els.filter.value.trim().toLowerCase();
  return comp.rows.filter(
    (row) => (!comp.rarity || row.rarity === comp.rarity) && (!text || row.name.toLowerCase().includes(text)),
  );
}

// Une carte sans classe (« Shadow Action ») se range sous son talent.
const classOf = (row) =>
  row.classes.length ? row.classes.join(' / ') : row.talents.length ? row.talents.join(' / ') : 'Sans classe';
const firstPrinting = (row) => row.printings[0]?.expansion || 'Autres';

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
  renderList();
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

export { showCompletion, view as completionView };
