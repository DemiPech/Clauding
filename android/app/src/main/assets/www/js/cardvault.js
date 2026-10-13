/**
 * Card Vault (https://cardvault.fabtcg.com), la base de cartes officielle de
 * Legend Story Studios : le catalogue complet, avec la rareté, la ligne de type
 * (classes, talents, types) et l'image de chaque carte, Pirate et Necromancer
 * compris.
 *
 * On y lit, par rareté, toutes les cartes imprimées en anglais :
 * `advanced-search/?rarities=common&language=en&page_size=1000&page=N`. La
 * recherche rend une ligne par carte (son impression la plus récente), pas
 * une par impression. Pas de prix : ils viennent de CardNexus.
 */
import { httpFetch } from './http.js';
import { formatCount, silent } from './progress.js';

const BASE = 'https://api.cardvault.fabtcg.com/carddb/api/v1/';
const PAGE_SIZE = 1000;
const RARITY_LABELS = { common: 'communes', rare: 'rares', majestic: 'majestics', legendary: 'légendaires' };

export class CardVaultError extends Error {}

async function get(path) {
  const res = await httpFetch(BASE + path, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new CardVaultError(`Card Vault a répondu ${res.status}.`);
  return res.json();
}

/** Les noms d'une liste de référence (classes, talents, types), les plus longs d'abord. */
async function names(path) {
  const data = await get(path);
  return (data.results || [])
    .map((item) => item.name_en || item.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

/**
 * La ligne de type découpée : « Shadow Brute Action - Attack » →
 * { talents: ['Shadow'], classes: ['Brute'], types: ['Action'] }. Seule la
 * partie avant le tiret compte (le reste, ce sont les sous-types).
 */
export function parseTypebox(typebox, vocabulary) {
  let rest = ` ${String(typebox || '').split(/\s+[-–—]\s+/)[0]} `;
  const take = (list) => {
    const found = [];
    for (const name of list) {
      const word = ` ${name} `;
      if (rest.includes(word)) {
        found.push(name);
        rest = rest.replace(word, ' ');
      }
    }
    return found;
  };
  // Les types d'abord : « Demi-Hero » ne doit pas devenir « Hero ».
  const types = take(vocabulary.types);
  const classes = take(vocabulary.classes);
  const talents = take(vocabulary.talents);
  return { types, classes, talents };
}

/**
 * Code d'extension d'une impression : « WTR215 » → WTR, « 1HP001 » → 1HP,
 * « AAC005-RF » → AAC, « U-MON187 » (Unlimited) → MON.
 */
export function printSet(printId) {
  return String(printId || '').replace(/^[UR]-/i, '').match(/^([A-Z0-9]+?)\d{3}/i)?.[1]?.toUpperCase() || null;
}

/** Une carte de la recherche, réduite à ce qu'il faut pour compléter. */
export function vaultCard(item, rarity, vocabulary) {
  const { types, classes, talents } = parseTypebox(item.printed_typebox, vocabulary);
  const face = (item.faces || []).find((f) => f.layout_position === 10) || item.faces?.[0];
  return {
    cardId: item.card_id,
    name: String(item.printed_name || '').trim(),
    pitch: Number(item.printed_pitch) || null,
    rarity,
    types,
    classes,
    talents: talents.length ? talents : item.core_talent ? [item.core_talent] : [],
    expansion: printSet(item.print_id),
    printNumber: item.print_id || null,
    imageUrl: face?.image?.small || face?.image?.normal || null,
  };
}

/**
 * Toutes les cartes des raretés demandées (['common', 'rare']…), imprimées en
 * anglais. Une carte peut revenir pour deux raretés (commune dans une
 * extension, rare dans une autre) : elle figure alors deux fois.
 */
export async function vaultCatalog(rarities, progress = silent) {
  progress.report(0, 'Card Vault : classes, talents et types');
  const [classes, talents, types] = await Promise.all([
    names('core-classes/'),
    names('core-talents/'),
    names('core-types/'),
  ]);
  const vocabulary = { classes, talents, types };

  const cards = [];
  for (const [index, rarity] of rarities.entries()) {
    const step = progress.sub(index / rarities.length, (index + 1) / rarities.length);
    const label = RARITY_LABELS[rarity] || rarity;
    for (let page = 1; ; page += 1) {
      const query = new URLSearchParams({ rarities: rarity, language: 'en', page_size: String(PAGE_SIZE), page: String(page), orderby: 'relevance' });
      const data = await get(`advanced-search/?${query}`);
      const results = data.results || [];
      cards.push(...results.map((item) => vaultCard(item, rarity, vocabulary)));
      const done = (page - 1) * PAGE_SIZE + results.length;
      if (data.count) step.report(Math.min(1, done / data.count), `Card Vault, ${label} : ${formatCount(done)} / ${formatCount(data.count)}`);
      if (!data.next || !results.length) break;
    }
  }
  return cards;
}
