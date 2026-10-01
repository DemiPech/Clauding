// Ranger les vracs.
import { els, escapeHtml } from './core.js';
import { showOnly } from './nav.js';
import { lineLabel, loadLocations, locations, showToast } from './moves.js';
import { byCardName, cardLabel, pickupPlaceNode, postMovesInBatches } from './build.js';
import { PLACE_KINDS, byPlaceName, placeCounts, placeKind } from './places.js';

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

export {
  TIDY_STORAGE, applyTidy, computeTidy, saveTidySelection, showTidy, tidy, tidyAsText,
};
