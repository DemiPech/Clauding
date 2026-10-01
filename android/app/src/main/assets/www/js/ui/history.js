// Onglet Historique : journal des actions, photos de la collection, modifié récemment.
import { UNPLACED } from '../cardnexus.js';
import { diffSnapshots, snapshotTotal } from '../snapshots.js';
import { PITCH_COLORS, els, state } from './core.js';
import { showOnly } from './nav.js';
import { lineLabel, showToast, undoMoves, undoneMessage } from './moves.js';
import { allocationFor, build, cardLabel, removedFor } from './build.js';
import { placeCounts } from './places.js';
import { askConfirm } from './sheets.js';
import { startTask } from '../progress.js';

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
  import: 'Import de cartes',
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
    undo.textContent = entry.kind === 'import' ? 'Annuler cet import' : 'Annuler ce déplacement';
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
  const isImport = entry.kind === 'import';
  const confirmed = await askConfirm(
    isImport
      ? {
          title: 'Annuler cet import',
          text: `Retirer de la collection les cartes ajoutées : « ${entry.summary} » ?`,
          items: entry.details.slice(0, 12),
          note: 'Seuls les exemplaires ajoutés par cet import sont retirés.',
          ok: "Annuler l'import",
        }
      : {
          title: 'Annuler ce déplacement',
          text: `Remettre chaque carte là où elle était avant : « ${entry.summary} » ?`,
          items: entry.details.slice(0, 12),
          note: "Si des cartes ont bougé depuis, elles seront quand même renvoyées à leur emplacement d'origine.",
          ok: 'Annuler le déplacement',
        },
  );
  if (!confirmed) return;

  button.disabled = true;
  try {
    const result = await undoMoves(entry.undo);
    const { failed } = result;
    markUndone(entry.id);
    placeCounts.clear();
    showToast(
      undoneMessage(result) +
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
  renderSnapshotStatus(auto ? 'Photo automatique en cours…' : 'Photo en cours…');

  const progress = startTask(auto ? 'Photo automatique de la collection' : 'Photo de la collection', {
    background: auto,
  });
  try {
    const res = await fetch('/api/cardnexus/snapshot', { progress: progress.sub(0, 0.9) });
    const now = await res.json();
    if (!res.ok) throw new Error(now.error || `Erreur ${res.status}`);

    // Une photo d'avant le filtre « Flesh and Blood seulement » contenait les
    // autres jeux : la comparer annoncerait ces cartes comme supprimées. Elle ne
    // sert alors que de point de départ.
    const stored = readStored(SNAPSHOT_STORAGE, null);
    const previous = stored?.scope === 'fab' ? stored : null;
    let changes = [];
    if (previous?.counts) {
      changes = diffSnapshots(previous.counts, now.counts);
      if (changes.length) {
        const ids = [...new Set(changes.map((c) => c.productId))];
        const namesRes = await fetch('/api/cardnexus/products/names', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
          progress: progress.sub(0.9, 1),
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

    const saved = writeStored(SNAPSHOT_STORAGE, {
      scope: 'fab',
      at: now.at,
      lines: now.lines,
      cards: snapshotTotal(now.counts),
      counts: now.counts,
    });
    renderSnapshotStatus(saved ? '' : 'Photo prise, mais la mémoire du téléphone est pleine : elle n’a pas pu être gardée.');
    if (!els.history.hidden) renderChanges();
    return { changes, first: !previous?.counts };
  } catch (err) {
    renderSnapshotStatus(`Photo impossible : ${err.message}`);
    return null;
  } finally {
    progress.end();
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

export {
  INTERVAL_STORAGE, buildDetails, loadRecent, logAction, markUndone, placeLabel, renderJournal,
  scheduleAutoSnapshot, setHistoryTab, showHistory, snapshotInterval, takeSnapshot, writeJournal,
  writeStored,
};
