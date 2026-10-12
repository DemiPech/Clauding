/**
 * Cartes a completer : les communes et rares dont on possede moins d'exemplaires
 * que l'objectif (3 par defaut).
 *
 * Deux facons de compter :
 * - toutes editions confondues (`by: 'card'`) : une carte = un nom + un pitch ;
 *   2 Sink Below du deck Blitz Dromai + 2 de Welcome to Rathe = 4 exemplaires ;
 * - par extension (`by: 'printing'`) : seuls comptent les exemplaires de
 *   l'impression de cette extension.
 *
 * Calcul pur, sans reseau : cardnexus.js fournit le catalogue et les quantites.
 */

const RARITIES_WANTED = new Set(['common', 'rare']);

/**
 * `cards` : impressions du catalogue [{ productId, key, name, pitch, rarity,
 * types, classes, talents, expansion, printNumber, imageUrl }] ; `owned` :
 * Map clé → exemplaires possédés (clé de carte, ou productId par extension).
 * Rend une ligne par carte à compléter : { key, name, pitch, rarity, types,
 * classes, talents, owned, missing, printings, imageUrl }.
 */
export function completionRows(cards, owned, { target = 3, includeGear = true, by = 'card' } = {}) {
  const rows = new Map();
  for (const card of cards) {
    if (!RARITIES_WANTED.has(card.rarity)) continue;
    const types = card.types || [];
    if (types.includes('Hero') || types.includes('Token')) continue;
    if (!includeGear && (types.includes('Weapon') || types.includes('Equipment'))) continue;

    const key = by === 'printing' ? String(card.productId) : card.key;
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        name: card.name,
        pitch: card.pitch ?? null,
        rarity: card.rarity,
        types,
        classes: card.classes || [],
        talents: card.talents || [],
        imageUrl: card.imageUrl || null,
        printings: [],
      };
      rows.set(key, row);
    }
    // Commune quelque part : c'est la rarete la plus facile a trouver.
    if (card.rarity === 'common') row.rarity = 'common';
    if (!row.imageUrl && card.imageUrl) row.imageUrl = card.imageUrl;
    row.printings.push({ expansion: card.expansion || null, printNumber: card.printNumber || null, rarity: card.rarity });
  }

  const result = [];
  for (const row of rows.values()) {
    row.owned = owned.get(row.key) || 0;
    row.missing = Math.max(0, target - row.owned);
    if (row.missing > 0) result.push(row);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'en') || (a.pitch ?? 0) - (b.pitch ?? 0));
}

/** Totaux affichés en tête : cartes à compléter, exemplaires manquants. */
export function completionTotals(rows) {
  return {
    cards: rows.length,
    missing: rows.reduce((sum, row) => sum + row.missing, 0),
    absent: rows.filter((row) => row.owned === 0).length,
  };
}
