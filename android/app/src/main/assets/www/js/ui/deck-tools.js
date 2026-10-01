// Export texte, aperçu des cartes, réglages et comparaison à une liste FaBrary.
import { getApiKey, setApiKey } from '../cardnexus.js';
import { els, escapeHtml, state } from './core.js';
import { locations } from './moves.js';
import { computePlan, openBuild } from './build.js';
import { byPlaceName, placeKind } from './places.js';
import { snapshotInterval } from './history.js';

// --- Export texte ----------------------------------------------------------

const PITCH_SHORT = { 1: 'red', 2: 'yellow', 3: 'blue' };

function deckAsText(deck) {
  const lines = [deck.name];
  lines.push([deck.hero?.name, deck.format].filter(Boolean).join(' — '));
  if (deck.author) lines.push(`par ${deck.author}`);
  if (deck.url) lines.push(deck.url);
  lines.push('');

  const block = (title, cards) => {
    if (!cards.length) return;
    const total = cards.reduce((sum, c) => sum + c.quantity, 0);
    lines.push(`${title} (${total})`);
    for (const card of cards) {
      const pitch = PITCH_SHORT[card.pitch];
      lines.push(`${card.quantity} ${card.name}${pitch ? ` (${pitch})` : ''}`);
    }
    lines.push('');
  };

  block('Armes', deck.weapons);
  block('Équipement', deck.equipment);
  block('Deck', deck.deck);
  block('Réserve', deck.sideboard);

  return lines.join('\n').trim();
}

/** Presse-papiers : le pont Android d'abord, l'API du navigateur sinon. */
async function copyText(text) {
  if (window.AndroidApp?.copyText) {
    if (window.AndroidApp.copyText(text)) return;
    throw new Error('Presse-papiers indisponible');
  }
  await navigator.clipboard.writeText(text);
}

// --- Aperçu au survol (souris) et plein écran (toucher) ----------------------

let previewSource = null;

function showPreview(target, event) {
  const src = target.dataset.image;
  if (!src) return;
  if (previewSource !== src) {
    els.previewImg.src = src;
    previewSource = src;
  }
  els.preview.hidden = false;
  movePreview(event);
}

function movePreview(event) {
  if (els.preview.hidden) return;
  const width = 300;
  const height = Math.round((width * 838) / 600);
  const margin = 16;
  const left = Math.min(event.clientX + 22, window.innerWidth - width - margin);
  const top = Math.min(Math.max(event.clientY - height / 2, margin), window.innerHeight - height - margin);
  els.preview.style.left = `${Math.max(margin, left)}px`;
  els.preview.style.top = `${top}px`;
}

const hidePreview = () => {
  els.preview.hidden = true;
};

function openLightbox(src) {
  if (!src) return;
  els.lightboxImg.src = src;
  els.lightbox.hidden = false;
}

function closeLightbox() {
  els.lightbox.hidden = true;
}

// --- Réglages --------------------------------------------------------------

function openSettings() {
  els.settingsSnapshot.value = String(snapshotInterval());
  els.settingsKey.value = getApiKey() || '';
  els.settingsShow.checked = false;
  els.settingsKey.type = 'password';
  els.settings.hidden = false;
}

function closeSettings() {
  els.settings.hidden = true;
}

/** La clé change de compte : on repart d'un état propre plutôt que de purger chaque cache. */
function saveApiKey(value) {
  setApiKey(value);
  location.replace(location.pathname);
}

// --- Comparer un deck d'inventaire à une liste FaBrary ---------------------

const COMPARE_HINT = els.compareNote.innerHTML;
const compare = { pick: false };

/**
 * Depuis un deck ouvert, on compare ce deck. Depuis les Outils, on choisit
 * d'abord le deck (ou l'emplacement) dans la collection.
 */
function openCompare({ pick = false } = {}) {
  pick = pick || state.deck?.source !== 'cardnexus' || els.deck.hidden;
  compare.pick = pick;
  els.compareDeckField.hidden = !pick;
  if (pick) {
    const decks = locations.filter((loc) => placeKind(loc) === 'deck').sort(byPlaceName);
    const others = locations.filter((loc) => placeKind(loc) !== 'deck').sort(byPlaceName);
    els.compareDeck.innerHTML = [...decks, ...others]
      .map((loc) => `<option value="${escapeHtml(loc.name)}">${escapeHtml(loc.name)}</option>`)
      .join('');
  }
  els.compareNote.innerHTML = COMPARE_HINT;
  els.compareNote.querySelector('#compare-target').textContent = pick ? 'le deck choisi' : state.deck.deckId;
  els.compareSubmit.disabled = false;
  els.compare.hidden = false;
  els.compareInput.focus();
}

function closeCompare() {
  els.compare.hidden = true;
}

/** Charge la liste FaBrary, puis ouvre le plan avec le deck ouvert pour destination. */
async function runCompare() {
  const value = els.compareInput.value.trim();
  if (!value) return;
  const target = compare.pick ? els.compareDeck.value : state.deck.deckId;
  if (!target) return;

  els.compareSubmit.disabled = true;
  els.compareNote.textContent = 'Récupération de la liste FaBrary…';
  try {
    const res = await fetch(`/api/deck?id=${encodeURIComponent(value)}`);
    const list = await res.json();
    if (!res.ok) throw new Error(list.error || `Erreur ${res.status}`);

    closeCompare();
    openBuild(list, { existing: target, returnTo: compare.pick ? 'tools' : 'deck' });
    computePlan();
  } catch (err) {
    els.compareNote.textContent = err.message;
  } finally {
    els.compareSubmit.disabled = false;
  }
}

export {
  closeCompare, closeLightbox, closeSettings, copyText, deckAsText, hidePreview, movePreview,
  openCompare, openLightbox, openSettings, runCompare, saveApiKey, showPreview,
};
