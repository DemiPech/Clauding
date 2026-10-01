// Monter une liste FaBrary dans CardNexus, et le récap « où chercher ».
import { PITCH_COLORS, els, escapeHtml } from './core.js';
import { deckLocations, loadCardnexusDeck, loadDeckLocations, showOnly } from './nav.js';
import {
  NO_LOCATION, lineLabel, lineRowNode, loadLocations, locations, postMoves, showToast,
} from './moves.js';
import { buildDetails } from './history.js';

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
              build.modified = true;
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

  renderPickup();

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

// --- Récap « où chercher » -------------------------------------------------
//
// La tournée à faire dans la collection : les exemplaires sélectionnés,
// regroupés par endroit, le plus fourni en premier. Il suit les compteurs.

const PITCH_FR = { 1: 'rouge', 2: 'jaune', 3: 'bleu' };

const byCardName = (a, b) => a.row.name.localeCompare(b.row.name) || (a.row.pitch ?? 0) - (b.row.pitch ?? 0);

/** [{ place, total, items: [{ row, line, count }] }], du plus gros au plus petit. */
function pickupGroups() {
  const byPlace = new Map();
  for (const row of build.plan.rows) {
    for (const [inventoryId, count] of allocationFor(row.key)) {
      const line = row.candidates.find((c) => c.inventoryId === inventoryId);
      if (!count || !line) continue;
      const key = line.location ?? '';
      if (!byPlace.has(key)) byPlace.set(key, { place: line.location || null, total: 0, items: [] });
      const group = byPlace.get(key);
      group.items.push({ row, line, count });
      group.total += count;
    }
  }

  const groups = [...byPlace.values()];
  for (const group of groups) group.items.sort(byCardName);
  return groups.sort((a, b) => b.total - a.total || (a.place || '').localeCompare(b.place || '', 'fr'));
}

/** Ce qui manque encore une fois la sélection prise : à acheter ou à échanger. */
function missingCards() {
  return build.plan.rows
    .map((row) => ({ row, count: Math.max(0, row.needed - row.already - takenFor(row.key)) }))
    .filter((item) => item.count > 0)
    .sort(byCardName);
}

const cardLabel = (row) => `${row.name}${PITCH_FR[row.pitch] ? ` (${PITCH_FR[row.pitch]})` : ''}`;

function pickupItemNode({ row, line, count }) {
  const li = document.createElement('li');
  li.className = 'pickup-item';
  li.innerHTML = `
    <span class="pickup-qty">${count}×</span>
    <i class="row-pitch" style="--dot:${PITCH_COLORS[row.pitch] || 'var(--pitch-0)'}"></i>
    <span class="pickup-name">
      <span>${escapeHtml(row.name)}</span>
      <span class="pickup-sub"></span>
    </span>
  `;
  li.querySelector('.pickup-sub').textContent = [
    line ? lineLabel(line) : null,
    line?.forSale ? 'en vente' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return li;
}

function pickupPlaceNode({ title, total, items, note, className }) {
  const box = document.createElement('div');
  box.className = `pickup-place${className ? ` ${className}` : ''}`;

  const head = document.createElement('div');
  head.className = 'pickup-place-head';
  const name = document.createElement('b');
  name.textContent = title;
  const count = document.createElement('span');
  count.className = 'section-count';
  count.textContent = `${total} carte${total > 1 ? 's' : ''}`;
  head.append(name);
  if (note) {
    const badge = document.createElement('span');
    badge.className = 'badge is-partial';
    badge.textContent = note;
    head.append(badge);
  }
  head.append(count);

  const list = document.createElement('ul');
  list.className = 'pickup-items';
  list.append(...items.map(pickupItemNode));

  box.append(head, list);
  return box;
}

function renderPickup() {
  const groups = pickupGroups();
  const missing = missingCards();
  els.buildPickup.hidden = groups.length === 0 && missing.length === 0;
  els.buildReset.hidden = !build.modified;

  const places = groups.length;
  const cards = groups.reduce((sum, g) => sum + g.total, 0);
  els.buildPickupCount.textContent = places
    ? `${places} endroit${places > 1 ? 's' : ''} · ${cards} carte${cards > 1 ? 's' : ''}`
    : 'rien à aller chercher';

  const nodes = groups.map((group) =>
    pickupPlaceNode({
      title: group.place || 'Sans location',
      total: group.total,
      items: group.items,
      note: isDeckLocation(group.place) ? 'autre deck' : null,
    }),
  );
  if (missing.length) {
    nodes.push(
      pickupPlaceNode({
        title: 'Manquantes',
        total: missing.reduce((sum, item) => sum + item.count, 0),
        items: missing.map(({ row, count }) => ({ row, line: null, count })),
        className: 'is-missing',
      }),
    );
  }
  els.buildPickupList.replaceChildren(...nodes);
}

/** Le récap en texte, à coller dans une note ou un message. */
function pickupAsText() {
  const groups = pickupGroups();
  const cards = groups.reduce((sum, g) => sum + g.total, 0);
  const lines = [
    `Monter « ${build.plan.destination} » — ${groups.length} endroit${groups.length > 1 ? 's' : ''}, ${cards} carte${cards > 1 ? 's' : ''}`,
  ];

  for (const group of groups) {
    lines.push('', `${group.place || 'Sans location'} (${group.total})${isDeckLocation(group.place) ? ' — autre deck' : ''}`);
    for (const { row, line, count } of group.items) {
      lines.push(`  ${count}× ${cardLabel(row)} — ${lineLabel(line)}${line.forSale ? ' · en vente' : ''}`);
    }
  }

  const missing = missingCards();
  if (missing.length) {
    lines.push('', `Manquantes (${missing.reduce((sum, item) => sum + item.count, 0)})`);
    for (const { row, count } of missing) lines.push(`  ${count}× ${cardLabel(row)}`);
  }
  return lines.join('\n');
}

/** Rétablit la répartition calculée (le moins d'endroits), après des retouches. */
function resetAllocation() {
  build.allocation = new Map(
    build.plan.rows.map((row) => [row.key, new Map(row.picks.map((p) => [p.inventoryId, p.take]))]),
  );
  build.modified = false;
  renderBuild();
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

/** Seuil à partir duquel un autre deck vaut la peine d'être repris en bloc. */
const DECK_HINT_SHARE = 0.5;

/**
 * Quand les autres decks sont protégés mais que l'un d'eux contient déjà une
 * bonne part de la liste, on le signale : le reprendre évite de courir la
 * collection (typiquement, remonter une liste déjà montée ailleurs).
 */
function renderDeckHint() {
  const [best] = build.plan.deckSources || [];
  const toFind = build.plan.rows.reduce((sum, row) => sum + Math.max(0, row.needed - row.already), 0);
  const show = els.buildProtect.checked && best && toFind > 0 && best.cards / toFind >= DECK_HINT_SHARE;

  els.buildDeckHint.hidden = !show;
  if (show) {
    els.buildDeckHintText.textContent =
      `« ${best.name} » contient déjà ${best.cards} des ${toFind} cartes à réunir. ` +
      'Comme c’est un autre deck, il n’est utilisé qu’en dernier recours.';
  }
}

function renderBuild() {
  renderDeckHint();
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
function openBuild(deck, { existing = null, returnTo = 'deck' } = {}) {
  build.returnTo = returnTo;
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
  els.buildProtect.checked = true;

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
        protectDecks: els.buildProtect.checked,
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
    build.modified = false;
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
      { error: Boolean(failures.length), undo: undo.length ? undo : null, log: { kind: 'build', details: buildDetails(outTarget) } },
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

export {
  allocationFor, applyBuild, build, byCardName, cardLabel, computePlan, openBuild, pickupAsText,
  pickupPlaceNode, postMovesInBatches, removedFor, resetAllocation, syncBuildMode,
};
