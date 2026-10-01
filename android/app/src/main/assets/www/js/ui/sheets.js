// Confirmation, suppression de cartes, retrait des tags, renommer / supprimer un emplacement.
import { els, escapeHtml, state } from './core.js';
import { loadCardnexusDeck, loadDeckLocations, returnToTab } from './nav.js';
import { placeCards, taggedLines } from './deck-view.js';
import {
  basket, basketTotal, loadLocations, locations, reloadCurrentDeck, renderBasket, setMovePanel,
  showToast,
} from './moves.js';
import { cardLabel, postMovesInBatches } from './build.js';
import { byPlaceName, placeCounts } from './places.js';
import { TIDY_STORAGE } from './tidy-view.js';
import { placeLabel } from './history.js';

// --- Confirmation, suppression de cartes, retrait des tags ------------------------

let confirmResolve = null;

/**
 * Demande confirmation dans un panneau (les boîtes de dialogue du navigateur
 * ne s'affichent pas dans la WebView). Résout à true si l'on confirme.
 */
function askConfirm({ title, text, items = [], note = '', ok, danger = false }) {
  els.confirmTitle.textContent = title;
  els.confirmText.textContent = text;
  els.confirmList.replaceChildren(
    ...items.map((item) => Object.assign(document.createElement('li'), { textContent: item })),
  );
  els.confirmList.hidden = items.length === 0;
  els.confirmNote.textContent = note;
  els.confirmOk.textContent = ok;
  els.confirmOk.classList.toggle('danger', danger);
  els.confirmOk.disabled = false;
  els.confirm.hidden = false;
  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}

function closeConfirm(answer = false) {
  els.confirm.hidden = true;
  confirmResolve?.(answer);
  confirmResolve = null;
}

/** Résumé lisible d'une sélection : une ligne par carte, du plus nombreux au moins nombreux. */
function selectionSummary(entries, limit = 12) {
  const byCard = new Map();
  for (const entry of entries) {
    const key = `${entry.cardName}|${entry.pitch ?? ''}`;
    const item = byCard.get(key) || { name: entry.cardName, pitch: entry.pitch, count: 0 };
    item.count += entry.count;
    byCard.set(key, item);
  }
  const list = [...byCard.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const shown = list.slice(0, limit).map((item) => `${item.count}× ${cardLabel(item)}`);
  if (list.length > limit) shown.push(`… et ${list.length - limit} autre${list.length - limit > 1 ? 's' : ''}`);
  return shown;
}

/** Supprime de la collection tout ce qui est en main, après confirmation. */
async function deleteHeldCards() {
  const entries = [...basket.values()];
  if (!entries.length) return;
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const forSale = entries.filter((entry) => entry.forSale).length;
  const wholeLines = entries.filter((entry) => entry.count >= entry.max).length;

  const confirmed = await askConfirm({
    title: 'Supprimer de la collection',
    text: `Supprimer définitivement ${total} carte${total > 1 ? 's' : ''} de votre collection CardNexus ?`,
    items: selectionSummary(entries),
    note: [
      'Impossible à annuler.',
      forSale ? `${forSale} ligne(s) en vente : leur annonce sera retirée.` : '',
      wholeLines > 20 ? `${wholeLines} lignes entières à supprimer, une requête chacune : comptez environ ${Math.ceil(wholeLines / 55)} min.` : '',
    ]
      .filter(Boolean)
      .join(' '),
    ok: `Supprimer ${total} carte${total > 1 ? 's' : ''}`,
    danger: true,
  });
  if (!confirmed) return;

  els.deleteCards.disabled = true;
  els.deleteCards.textContent = 'Suppression…';
  try {
    const res = await fetch('/api/cardnexus/cards/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: entries.map(({ inventoryId, count, max }) => ({ inventoryId, count, max })) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

    const failedIds = new Set(data.failed.map((f) => f.inventoryId));
    for (const entry of entries) if (!failedIds.has(entry.inventoryId)) basket.delete(entry.inventoryId);
    renderBasket();
    setMovePanel('none');
    placeCounts.clear();
    showToast(
      `${data.removed} carte${data.removed > 1 ? 's' : ''} supprimée${data.removed > 1 ? 's' : ''} de la collection` +
        (data.failed.length ? ` (${data.failed.length} échec(s) : ${data.failed[0].reason})` : ''),
      {
        error: Boolean(data.failed.length),
        log: {
          kind: 'delete',
          details: entries
            .filter((e) => !failedIds.has(e.inventoryId))
            .map((e) => `${e.count}× ${cardLabel({ name: e.cardName, pitch: e.pitch })} — ${e.label} — ${placeLabel(e.location)}`),
        },
      },
    );
    await reloadCurrentDeck();
  } catch (err) {
    showToast(err.message, { error: true });
  } finally {
    els.deleteCards.textContent = 'Supprimer';
    els.deleteCards.disabled = basketTotal() === 0;
  }
}

/** Retire les tags de toutes les lignes de la vue, après confirmation. */
async function untagCurrentView() {
  const lines = taggedLines(state.deck);
  if (!lines.length) return;
  const tagCounts = new Map();
  for (const line of lines) for (const tag of line.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);

  const confirmed = await askConfirm({
    title: 'Retirer les tags',
    text: `Retirer tous les tags de ${lines.length} ligne${lines.length > 1 ? 's' : ''} de « ${state.deck.name} » ?`,
    items: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, n]) => `${tag} — ${n} ligne${n > 1 ? 's' : ''}`),
    note: 'Les cartes restent en place ; les tags eux-mêmes existent toujours dans votre compte.',
    ok: 'Retirer les tags',
  });
  if (!confirmed) return;

  els.untagBtn.disabled = true;
  try {
    const res = await fetch('/api/cardnexus/cards/untag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: lines.map((line) => line.inventoryId) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    showToast(
      `Tags retirés de ${data.cleared} ligne${data.cleared > 1 ? 's' : ''}` +
        (data.failed.length ? ` (${data.failed.length} échec(s))` : '') +
        ` dans « ${state.deck.name} »`,
      {
        error: Boolean(data.failed.length),
        log: { kind: 'untag', details: [...tagCounts.entries()].map(([tag, n]) => `${tag} — ${n} ligne${n > 1 ? 's' : ''}`) },
      },
    );
    await reloadCurrentDeck();
  } catch (err) {
    showToast(err.message, { error: true });
  } finally {
    els.untagBtn.disabled = false;
  }
}

// --- Renommer / supprimer un emplacement -------------------------------------

/** Le choix d'endroits à ranger est mémorisé par nom : il suit les renommages. */
function renameInTidySelection(from, to) {
  try {
    const saved = JSON.parse(localStorage.getItem(TIDY_STORAGE) || 'null');
    if (!Array.isArray(saved)) return;
    const next = saved.map((name) => (name === from ? to : name)).filter(Boolean);
    localStorage.setItem(TIDY_STORAGE, JSON.stringify(next));
  } catch {
    // Réglage illisible ou stockage indisponible : rien à suivre.
  }
}

/** Après un renommage ou une suppression, les listes d'emplacements sont à relire. */
async function reloadPlaces() {
  await Promise.all([loadDeckLocations(), loadLocations()]);
}

function openRename() {
  els.renameInput.value = state.deck.deckId;
  els.renameNote.textContent = 'Les cartes restent en place : seul le nom change.';
  els.renameSubmit.disabled = false;
  els.rename.hidden = false;
  els.renameInput.focus();
  els.renameInput.select();
}

const closeRename = () => {
  els.rename.hidden = true;
};

async function submitRename() {
  const from = state.deck.deckId;
  const to = els.renameInput.value.trim();
  if (!to || to === from) return closeRename();

  els.renameSubmit.disabled = true;
  try {
    const res = await fetch('/api/cardnexus/locations/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

    if (placeCounts.has(from)) placeCounts.set(to, placeCounts.get(from));
    placeCounts.delete(from);
    renameInTidySelection(from, to);
    closeRename();
    await reloadPlaces();
    await loadCardnexusDeck(to);
    showToast(`« ${from} » s'appelle maintenant « ${to} ».`, { log: { kind: 'rename' } });
  } catch (err) {
    els.renameNote.textContent = err.message;
    els.renameSubmit.disabled = false;
  }
}

function openDelete() {
  const deck = state.deck;
  const cards = placeCards(deck);
  const total = cards.reduce((sum, card) => sum + card.quantity, 0);

  els.deleteText.textContent = total
    ? `« ${deck.deckId} » contient ${total} carte${total > 1 ? 's' : ''}. Sans destination, elles resteront dans votre collection mais sans emplacement.`
    : `« ${deck.deckId} » est vide.`;
  els.deleteMoveField.hidden = total === 0;
  els.deleteTarget.innerHTML = [
    '<option value="">Ne pas les déplacer (sans emplacement)</option>',
    ...locations
      .filter((loc) => loc.name !== deck.deckId)
      .sort(byPlaceName)
      .map((loc) => `<option value="${escapeHtml(loc.name)}">${escapeHtml(loc.name)}</option>`),
  ].join('');
  els.deleteNote.textContent = 'La suppression est définitive (les cartes, elles, ne sont jamais supprimées).';
  els.deleteSubmit.disabled = false;
  els.delete.hidden = false;

  // L'app ne voit que Flesh and Blood : on vérifie s'il reste d'autres jeux ici.
  if (!deck.unplaced) {
    fetch(`/api/cardnexus/other-games?location=${encodeURIComponent(deck.deckId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.lines || els.delete.hidden) return;
        els.deleteNote.textContent =
          `Attention : cet emplacement contient aussi ${data.lines} ligne${data.lines > 1 ? 's' : ''} d'autres jeux, ` +
          "que l'app n'affiche pas. Elles n'auront plus d'emplacement (déplacez-les d'abord sur le site si besoin).";
      })
      .catch(() => {});
  }
}

const closeDelete = () => {
  els.delete.hidden = true;
};

async function submitDelete() {
  const deck = state.deck;
  const name = deck.deckId;
  const target = els.deleteTarget.value || null;

  els.deleteSubmit.disabled = true;
  try {
    // Les cartes d'abord, si on a choisi où les mettre : après, l'emplacement n'existe plus.
    let moved = 0;
    if (target) {
      els.deleteNote.textContent = `Déplacement des cartes vers « ${target} »…`;
      const origins = new Map();
      const moves = [];
      for (const card of placeCards(deck)) {
        for (const line of card.printings || []) {
          origins.set(line.inventoryId, name);
          moves.push({ inventoryId: line.inventoryId, count: line.quantity });
        }
      }
      const result = await postMovesInBatches(moves, target, origins);
      moved = result.moved;
      if (result.failed.length) {
        throw new Error(`${result.failed.length} ligne(s) n'ont pas pu être déplacées (${result.failed[0].reason}). Rien n'a été supprimé.`);
      }
    }

    els.deleteNote.textContent = 'Suppression…';
    const res = await fetch('/api/cardnexus/locations/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

    placeCounts.clear();
    renameInTidySelection(name, null);
    closeDelete();
    await reloadPlaces();
    showToast(
      `« ${name} » supprimé` + (moved ? ` · ${moved} carte${moved > 1 ? 's' : ''} → « ${target} »` : '') + '.',
      { log: { kind: 'deleteLocation' } },
    );
    returnToTab();
  } catch (err) {
    els.deleteNote.textContent = err.message;
    els.deleteSubmit.disabled = false;
  }
}

export {
  askConfirm, closeConfirm, closeDelete, closeRename, deleteHeldCards, openDelete, openRename,
  submitDelete, submitRename, untagCurrentView,
};
