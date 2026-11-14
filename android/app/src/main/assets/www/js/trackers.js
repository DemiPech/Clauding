/**
 * Suivis de collection : des listes de cartes définies par des critères
 * (classes, talents, types, langue d'impression), et leur complétion d'après
 * la collection CardNexus.
 *
 * - Une carte = un nom + un pitch, quelle que soit l'extension : Bittering
 *   Thorns rouge d'un Archive Pack et du deck Ira ne compte qu'une fois.
 * - Les cartes viennent de l'index Card Vault (toutes les cartes imprimées en
 *   anglais) ; avec une langue d'impression, seules celles qui ont une
 *   impression dans cette langue.
 * - Objectif : 1 exemplaire pour un héros, une arme, un équipement ou une
 *   carte au mot-clé Legendary (pas la rareté), l'objectif du suivi sinon.
 * - Possédés : tous les exemplaires de la carte, toutes impressions ; avec
 *   « seulement dans cette langue », ceux imprimés dans la langue du suivi.
 */
import { collectionCounts, fabKey } from './cardnexus.js';
import { RARITY_ORDER, vaultIndex, vaultLanguageIds, vaultRarities } from './cardvault.js';
import { silent } from './progress.js';

const STORAGE = 'collection_trackers';

export const LANGUAGES = {
  ja: 'Japonais', en: 'Anglais', fr: 'Français', de: 'Allemand', it: 'Italien', es: 'Espagnol',
};

// Un exemplaire suffit : on n'en joue qu'un par deck.
const SINGLE_TYPES = ['Hero', 'Demi-Hero', 'Weapon', 'Equipment'];

/** Un suivi complété de ses valeurs par défaut. */
export function normalizeTracker(raw = {}) {
  const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
  return {
    id: raw.id || `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: String(raw.name || '').trim() || 'Suivi sans nom',
    classes: list(raw.classes),
    talents: list(raw.talents),
    types: list(raw.types),
    language: LANGUAGES[raw.language] ? raw.language : null,
    ownedInLanguage: Boolean(raw.language && raw.ownedInLanguage),
    target: Math.min(4, Math.max(1, Number(raw.target) || 3)),
    singleRule: raw.singleRule !== false,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

/** Ce qui change la liste ou les comptes : un résultat gardé d'un autre jeu de critères est périmé. */
// La version change quand un calcul gardé ne contient plus tout ce qu'affiche l'écran (2 : raretés).
const RESULT_VERSION = 2;
export const trackerSignature = (tracker) =>
  JSON.stringify([RESULT_VERSION, tracker.classes, tracker.talents, tracker.types, tracker.language, tracker.ownedInLanguage, tracker.target, tracker.singleRule]);

export function readTrackers() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE));
    return Array.isArray(list) ? list.map(normalizeTracker) : [];
  } catch {
    return [];
  }
}

function writeTrackers(list) {
  localStorage.setItem(STORAGE, JSON.stringify(list));
}

/** Crée ou remplace un suivi ; rend le suivi enregistré. */
export function saveTracker(raw) {
  const tracker = normalizeTracker(raw);
  const list = readTrackers();
  const index = list.findIndex((t) => t.id === tracker.id);
  if (index >= 0) list[index] = tracker;
  else list.push(tracker);
  writeTrackers(list);
  return tracker;
}

export function deleteTracker(id) {
  writeTrackers(readTrackers().filter((t) => t.id !== id));
}

/** Les critères en une ligne : « Ninja · imprimées en japonais · exemplaires en japonais ». */
export function describeTracker(tracker) {
  const parts = [];
  if (tracker.classes.length) parts.push(tracker.classes.join(', '));
  if (tracker.talents.length) parts.push(tracker.talents.join(', '));
  if (tracker.types.length) parts.push(tracker.types.join(', '));
  if (!parts.length) parts.push('Toutes les cartes');
  if (tracker.language) {
    parts.push(`imprimées en ${LANGUAGES[tracker.language].toLowerCase()}`);
    if (tracker.ownedInLanguage) parts.push(`exemplaires en ${LANGUAGES[tracker.language].toLowerCase()}`);
  }
  parts.push(tracker.singleRule ? `objectif ${tracker.target} (1 pour héros, armes, équipements, Legendary)` : `objectif ${tracker.target}`);
  return parts.join(' · ');
}

const someIn = (values, wanted) => !wanted.length || values.some((value) => wanted.includes(value));

/**
 * Les cartes d'un suivi, une par nom + pitch : `index` = cartes Card Vault
 * ({ cardId, name, pitch, types, classes, talents, legendary, imageUrl }),
 * `languageIds` = identifiants imprimés dans la langue du suivi (ou null).
 */
export function trackerCards(index, tracker, languageIds = null) {
  const rows = new Map();
  for (const card of index) {
    if (languageIds && !languageIds.has(card.cardId)) continue;
    if (!someIn(card.classes, tracker.classes) || !someIn(card.talents, tracker.talents) || !someIn(card.types, tracker.types)) {
      continue;
    }
    const key = fabKey(card.name, card.pitch);
    let row = rows.get(key);
    if (!row) {
      row = { key, name: card.name, pitch: card.pitch, cardIds: [], types: card.types, classes: card.classes, talents: card.talents, legendary: false, imageUrl: card.imageUrl };
      rows.set(key, row);
    }
    row.cardIds.push(card.cardId);
    row.legendary ||= card.legendary;
  }
  for (const row of rows.values()) {
    const single = row.legendary || row.types.some((type) => SINGLE_TYPES.includes(type));
    row.single = single;
    row.target = tracker.singleRule && single ? 1 : tracker.target;
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'en') || (a.pitch ?? 0) - (b.pitch ?? 0));
}

/**
 * Raretés de chaque ligne d'après Card Vault (`map` : identifiant → raretés) :
 * `rarities` toutes celles de ses impressions, `rarity` la plus courante (celle
 * sous laquelle la carte est la plus facile à trouver), ou null.
 */
export function assignRarities(rows, map) {
  for (const row of rows) {
    const rarities = [...new Set(row.cardIds.flatMap((id) => map[id] || []))].sort(
      (a, b) => RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b),
    );
    row.rarities = rarities;
    row.rarity = rarities[0] || null;
  }
  return rows;
}

/**
 * Possédés, manquants et totaux. `counts` = { byId, byName } (collectionCounts) :
 * une carte compte ses exemplaires par identifiant ou, s'ils sont plus
 * nombreux, par nom + pitch (CardNexus et Card Vault n'écrivent pas toujours
 * l'identifiant de la même façon).
 */
export function trackerProgress(rows, counts) {
  const done = rows.map((row) => {
    const byId = row.cardIds.reduce((sum, id) => sum + (counts.byId.get(id) || 0), 0);
    const owned = Math.max(byId, counts.byName.get(row.key) || 0);
    return { ...row, owned, missing: Math.max(0, row.target - owned) };
  });
  const copies = done.reduce((sum, row) => sum + row.target, 0);
  const ownedCopies = done.reduce((sum, row) => sum + Math.min(row.owned, row.target), 0);
  return {
    rows: done,
    totals: {
      cards: done.length,
      complete: done.filter((row) => row.missing === 0).length,
      absent: done.filter((row) => row.owned === 0).length,
      copies,
      ownedCopies,
      missing: copies - ownedCopies,
      percent: copies ? Math.floor((ownedCopies / copies) * 1000) / 10 : 0,
    },
  };
}

/** La liste d'un suivi et sa complétion d'après la collection. */
export async function computeTracker(raw, progress = silent) {
  const tracker = normalizeTracker(raw);
  const index = await vaultIndex(progress.sub(0, 0.3));
  const languageIds = tracker.language
    ? await vaultLanguageIds(tracker.language, tracker.classes, progress.sub(0.3, 0.4))
    : null;
  const rows = trackerCards(index, tracker, languageIds);
  try {
    assignRarities(rows, await vaultRarities(tracker.language, tracker.classes, progress.sub(0.4, 0.55)));
  } catch {
    // Raretés indisponibles : le suivi s'affiche quand même, sans elles.
    assignRarities(rows, {});
  }
  const counts = await collectionCounts(
    { language: tracker.ownedInLanguage ? tracker.language : null },
    progress.sub(0.55, 1),
  );
  return { ...trackerProgress(rows, counts), signature: trackerSignature(tracker), at: new Date().toISOString() };
}
