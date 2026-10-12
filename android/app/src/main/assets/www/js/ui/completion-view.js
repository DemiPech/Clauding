// Outils « Cartes à compléter » : communes et rares à moins de 3 exemplaires,
// toutes éditions confondues, ou pour une extension.
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
};

const RARITY_LABELS = { common: 'Communes', rare: 'Rares' };
const RARITY_CODES = { common: 'C', rare: 'R' };

/** Ce qui est affiché : mode, extension choisie, résultat, filtres. */
const comp = {
  mode: 'all',
  expansion: null,
  rows: [],
  rarity: null,
  target: 3,
};

function showCompletion(mode) {
  if (comp.mode !== mode) {
    comp.rows = [];
    els.result.hidden = true;
    els.note.textContent = '';
  }
  comp.mode = mode;
  const byExpansion = mode === 'expansion';
  els.eyebrow.textContent = 'Cartes à compléter';
  els.title.textContent = byExpansion ? 'Par extension' : 'Toutes éditions confondues';
  els.byline.textContent = byExpansion
    ? "Les communes et rares d'une extension dont vous avez moins d'exemplaires que l'objectif, en ne comptant que l'impression de cette extension."
    : "Les communes et rares dont vous avez moins d'exemplaires que l'objectif, en additionnant toutes leurs impressions (2 de Welcome to Rathe + 2 d'un deck Blitz = 4).";
  els.expansionField.hidden = !byExpansion;
  els.refresh.hidden = byExpansion;
  renderExpansionButton();
  showOnly(view);
}

function renderExpansionButton() {
  els.expansion.textContent = comp.expansion ? comp.expansion.name : 'Choisir une extension…';
  els.expansion.classList.toggle('is-empty', !comp.expansion);
  els.run.disabled = comp.mode === 'expansion' && !comp.expansion;
}

async function runCompletion({ refresh = false } = {}) {
  if (comp.mode === 'expansion' && !comp.expansion) return;
  const params = new URLSearchParams({ target: els.target.value, gear: els.gear.checked ? '1' : '0' });
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
    els.note.textContent = data.catalogSize
      ? ''
      : 'Aucune commune ni rare trouvée dans le catalogue CardNexus.';
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

const classOf = (row) => (row.classes.length ? row.classes.join(' / ') : 'Sans classe');
const firstPrinting = (row) => row.printings[0]?.expansion || 'Autres';

function sections(rows) {
  const by = els.group.value;
  if (by === 'name') return [{ title: null, rows }];
  const keyOf = by === 'rarity' ? (row) => RARITY_LABELS[row.rarity] : by === 'expansion' ? firstPrinting : classOf;
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const order = by === 'rarity' ? ['Communes', 'Rares'] : [...groups.keys()].sort((a, b) => a.localeCompare(b, 'fr'));
  return order.filter((key) => groups.has(key)).map((key) => ({ title: key, rows: groups.get(key) }));
}

function renderResult() {
  const totals = completionTotals(comp.rows);
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  els.stats.innerHTML = [
    plural(totals.cards, 'carte') + ' à compléter',
    plural(totals.missing, 'exemplaire') + ' manquant' + (totals.missing > 1 ? 's' : ''),
    plural(totals.absent, 'carte') + ' absente' + (totals.absent > 1 ? 's' : ''),
  ]
    .map((text) => `<li class="stat">${escapeHtml(text)}</li>`)
    .join('');

  const present = ['common', 'rare'].filter((r) => comp.rows.some((row) => row.rarity === r));
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
        textContent: `Rien à compléter : vous avez au moins ${comp.target} exemplaire${comp.target > 1 ? 's' : ''} de chaque commune et rare (1 pour les héros, armes et équipements).`,
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
        section.innerHTML = `
          <div class="section-head">
            <h2>${escapeHtml(title)}</h2>
            <span class="section-count">${group.length} · −${missing}</span>
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
    <span class="completion-missing">−${row.missing}</span>
  `;
  return li;
}

/** La liste en texte : « 2x Sink Below (rouge) », pour un achat ou un échange. */
function completionAsText() {
  const rows = visibleRows();
  const head =
    comp.mode === 'expansion' && comp.expansion
      ? `Cartes à compléter — ${comp.expansion.name}`
      : 'Cartes à compléter — toutes éditions';
  return [head, '', ...rows.map((row) => `${row.missing}x ${cardLabel(row)}`)].join('\n');
}

// --- Événements -------------------------------------------------------------------

els.run.addEventListener('click', () => runCompletion());
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
