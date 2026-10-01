// Démarrage instantané : la dernière liste connue des emplacements et des decks,
// gardée sur le téléphone, s'affiche dès l'ouverture puis se met à jour.
import { getApiKey } from '../cardnexus.js';

const STORAGE = 'collection_cache';
const SAVE_DELAY_MS = 500;

/**
 * Une empreinte de la clé (pas la clé elle-même) : changer de compte CardNexus
 * ne doit pas afficher les emplacements de l'ancien.
 */
function keyPrint(key) {
  let hash = 5381;
  for (const char of key || '') hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

/** La dernière liste gardée pour cette clé, ou null. */
export function readCollectionCache() {
  const key = getApiKey();
  if (!key) return null;
  try {
    const cache = JSON.parse(localStorage.getItem(STORAGE));
    if (!cache || cache.key !== keyPrint(key) || !Array.isArray(cache.locations)) return null;
    return cache;
  } catch {
    return null;
  }
}

let saveTimer = null;
let pending = {};

/**
 * Garde une partie de la liste (`locations`, `decks`, `deckInfo`). Les appels
 * rapprochés (un deck après l'autre) sont regroupés en une écriture.
 */
export function saveCollectionCache(part) {
  const key = getApiKey();
  if (!key) return;
  pending = { ...pending, ...part };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const previous = readCollectionCache() || {};
    const next = { ...previous, ...pending, key: keyPrint(key), at: new Date().toISOString() };
    pending = {};
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
    } catch {
      // Mémoire pleine : le prochain démarrage relira simplement l'API.
    }
  }, SAVE_DELAY_MS);
}
