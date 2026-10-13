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

// Les paliers recensés : communes et rares, ou majestics et légendaires.
export const TIERS = {
  cr: ['common', 'rare'],
  ml: ['majestic', 'legendary'],
};
const RARITY_ORDER = ['common', 'rare', 'super rare', 'majestic', 'legendary', 'fabled', 'marvel', 'promo'];

// Un héros, une arme ou un équipement : un exemplaire suffit.
const SINGLE_TYPES = ['Hero', 'Weapon', 'Equipment'];
const isSingle = (types) => types.some((type) => SINGLE_TYPES.includes(type));

/**
 * `cards` : impressions du catalogue [{ productId, key, name, pitch, rarity,
 * types, classes, talents, expansion, printNumber, imageUrl }] ; `owned` :
 * Map clé → exemplaires possédés (clé de carte, ou productId par extension).
 * L'objectif vaut `target` pour une carte de deck, et 1 pour un héros, une
 * arme ou un équipement (`includeGear` : les compter ou non).
 * Rend une ligne par carte à compléter : { key, name, pitch, rarity, types,
 * classes, talents, target, owned, missing, price, printings, imageUrl } ;
 * `price` : la moins chère de ses impressions (euros), ou null.
 */
export function completionRows(
  cards,
  owned,
  { target = 3, includeGear = true, by = 'card', rarities = TIERS.cr } = {},
) {
  const wanted = new Set(rarities);
  const rows = new Map();
  for (const card of cards) {
    if (!wanted.has(card.rarity)) continue;
    const types = card.types || [];
    if (types.includes('Token')) continue;
    if (!includeGear && isSingle(types)) continue;

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
        target: isSingle(types) ? Math.min(1, target) : target,
        price: null,
        printings: [],
      };
      rows.set(key, row);
    }
    // La rarete la plus basse de ses impressions : la plus facile a trouver.
    if (RARITY_ORDER.indexOf(card.rarity) < RARITY_ORDER.indexOf(row.rarity)) row.rarity = card.rarity;
    if (!row.imageUrl && card.imageUrl) row.imageUrl = card.imageUrl;
    if (card.price != null && (row.price == null || card.price < row.price)) row.price = card.price;
    row.printings.push({
      expansion: card.expansion || null,
      printNumber: card.printNumber || null,
      rarity: card.rarity,
      price: card.price ?? null,
    });
  }

  const result = [];
  for (const row of rows.values()) {
    row.owned = owned.get(row.key) || 0;
    row.missing = Math.max(0, row.target - row.owned);
    if (row.missing > 0) result.push(row);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'en') || (a.pitch ?? 0) - (b.pitch ?? 0));
}

/**
 * Totaux affichés en tête : cartes à compléter, exemplaires manquants, et
 * coût estimé (prix × exemplaires manquants, pour les cartes qui ont un prix).
 */
export function completionTotals(rows) {
  const priced = rows.filter((row) => row.price != null);
  return {
    cards: rows.length,
    missing: rows.reduce((sum, row) => sum + row.missing, 0),
    absent: rows.filter((row) => row.owned === 0).length,
    cost: Math.round(priced.reduce((sum, row) => sum + row.price * row.missing, 0) * 100) / 100,
    unpriced: rows.length - priced.length,
  };
}

/**
 * Prix d'une impression du catalogue CardNexus : la valeur de marché
 * Cardmarket (euros) en finition Standard, sinon la moins chère des finitions.
 */
export function productPrice(product) {
  const blocks = product?.pricesByFinish || {};
  const value = (finish) => {
    const market = blocks[finish]?.cardmarket;
    return market && market.currency !== 'USD' && Number.isFinite(market.marketValue) && market.marketValue > 0
      ? market.marketValue
      : null;
  };
  const standard = value('Standard');
  if (standard != null) return standard;
  const others = Object.keys(blocks).map(value).filter((v) => v != null);
  return others.length ? Math.min(...others) : null;
}
