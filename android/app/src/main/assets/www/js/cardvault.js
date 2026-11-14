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
 *
 * On y cherche aussi des cartes par leur nom (`?name=…`) : la fiche des
 * cartes d'une liste collée ou d'une decklist fabtcg.com (types, image,
 * statistiques), et les classes et talents que CardNexus ne donne pas.
 */
import { httpFetch } from './http.js';
import { formatCount, silent } from './progress.js';
import { storeGet, storeSet } from './store.js';

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

let vocabularyPromise = null;

/** Classes, talents et types connus de Card Vault (lus une fois). */
function vocabulary() {
  vocabularyPromise ||= Promise.all([names('core-classes/'), names('core-talents/'), names('core-types/')])
    .then(([classes, talents, types]) => ({ classes, talents, types }))
    .catch((err) => {
      vocabularyPromise = null;
      throw err;
    });
  return vocabularyPromise;
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
  const vocab = await vocabulary();

  const cards = [];
  for (const [index, rarity] of rarities.entries()) {
    const step = progress.sub(index / rarities.length, (index + 1) / rarities.length);
    const label = RARITY_LABELS[rarity] || rarity;
    for (let page = 1; ; page += 1) {
      const query = new URLSearchParams({ rarities: rarity, language: 'en', page_size: String(PAGE_SIZE), page: String(page), orderby: 'relevance' });
      const data = await get(`advanced-search/?${query}`);
      const results = data.results || [];
      cards.push(...results.map((item) => vaultCard(item, rarity, vocab)));
      const done = (page - 1) * PAGE_SIZE + results.length;
      if (data.count) step.report(Math.min(1, done / data.count), `Card Vault, ${label} : ${formatCount(done)} / ${formatCount(data.count)}`);
      if (!data.next || !results.length) break;
    }
  }
  return cards;
}

// --- Fiches de cartes, par nom ---------------------------------------------------

/** Nom comparable : casse, espaces et apostrophe courbe ignorés. */
const nameKey = (name) => String(name || '').trim().replace(/\s+/g, ' ').replace(/’/g, "'").toLowerCase();

// Une recherche par nom, gardée le temps de la session.
const searches = new Map();

/** Les cartes portant exactement ce nom (imprimées en anglais), tous pitchs. */
function searchName(name) {
  const key = nameKey(name);
  if (!searches.has(key)) {
    // Card Vault écrit « Hunt's End » : l'apostrophe courbe ne trouverait rien.
    const query = new URLSearchParams({ name: String(name).trim().replace(/’/g, "'"), language: 'en', page_size: '100', page: '1', orderby: 'relevance' });
    const pending = get(`advanced-search/?${query}`)
      .then((data) => (data.results || []).filter((item) => nameKey(item.printed_name) === key))
      .catch((err) => {
        searches.delete(key);
        throw err;
      });
    searches.set(key, pending);
  }
  return searches.get(key);
}

/** « 3 » → 3, « » → null, « X » → « X ». */
const stat = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return /^\d+$/.test(text) ? Number(text) : text;
};

/**
 * La fiche d'une carte, dans la forme qu'attend l'affichage d'une liste :
 * nom, image, pitch, statistiques, types, sous-types, classes et talents.
 */
export function vaultDetails(item, vocab) {
  const { types, classes, talents } = parseTypebox(item.printed_typebox, vocab);
  const subtypes = String(item.printed_typebox || '').split(/\s+[-–—]\s+/)[1] || '';
  const face = (item.faces || []).find((f) => f.layout_position === 10) || item.faces?.[0];
  return {
    cardIdentifier: item.card_id,
    name: String(item.printed_name || '').trim(),
    imageUrl: face?.image?.normal || face?.image?.small || null,
    pitch: Number(item.printed_pitch) || null,
    cost: stat(item.printed_cost),
    power: stat(item.printed_power),
    defense: stat(item.printed_defense),
    life: stat(item.printed_life),
    intellect: stat(item.printed_intellect),
    types,
    subtypes: subtypes ? subtypes.split(/\s+(?![^(]*\))/) : [],
    classes,
    talents: talents.length ? talents : item.core_talent ? [item.core_talent] : [],
    keywords: [],
    rarity: null,
    typeText: item.printed_typebox || '',
    functionalText: item.printed_rules_text || '',
  };
}

/** Le bon pitch parmi les cartes d'un nom ; sans pitch demandé, celle qui n'en a pas, sinon la première. */
function pickPitch(items, pitch) {
  if (pitch) return items.find((item) => Number(item.printed_pitch) === Number(pitch)) || null;
  return items.find((item) => !item.printed_pitch) || items[0] || null;
}

/**
 * Les fiches de ces cartes (`entries` : [{ name, pitch }]), dans le même ordre :
 * une fiche, ou null pour une carte que Card Vault ne connaît pas. Une
 * recherche par nom distinct, quatre à la fois. Lève une erreur si Card Vault
 * ne répond à aucune.
 */
export async function vaultCardsByName(entries, progress = silent) {
  const vocab = await vocabulary();
  const unique = [...new Map(entries.map((entry) => [nameKey(entry.name), entry.name])).values()];
  const found = new Map();
  let done = 0;
  let failed = 0;
  const queue = [...unique];
  const worker = async () => {
    for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
      try {
        found.set(nameKey(name), await searchName(name));
      } catch {
        failed += 1;
        found.set(nameKey(name), []);
      }
      done += 1;
      progress.report(done / unique.length, `Fiches Card Vault : ${done} / ${unique.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, unique.length) }, worker));
  if (unique.length && failed === unique.length) throw new CardVaultError('Card Vault ne répond pas.');
  return entries.map((entry) => {
    const item = pickPitch(found.get(nameKey(entry.name)) || [], entry.pitch);
    return item ? vaultDetails(item, vocab) : null;
  });
}

// --- Index de toutes les cartes : classes et talents --------------------------------

const INDEX_STORAGE = 'cardvault_index';
const INDEX_TTL_MS = 7 * 24 * 3600 * 1000;
let indexPromise = null;

const indexKey = (name, pitch) => `${nameKey(name)}|${Number(pitch) || ''}`;

/** « **Legendary** » (ou « **Legendary Viserai Specialization** ») en tête du texte : 1 exemplaire par deck. */
export const isLegendary = (rulesText) => /\*\*Legendary\b/.test(String(rulesText || ''));

/** Une carte de l'index : identifiant, nom, pitch, classes, talents, types, Legendary, image. */
export function indexCard(item, vocab) {
  const { types, classes, talents } = parseTypebox(item.printed_typebox, vocab);
  const face = (item.faces || []).find((f) => f.layout_position === 10) || item.faces?.[0];
  return {
    cardId: item.card_id,
    name: String(item.printed_name || '').trim(),
    pitch: Number(item.printed_pitch) || null,
    types,
    classes,
    talents: talents.length ? talents : item.core_talent ? [item.core_talent] : [],
    legendary: isLegendary(item.printed_rules_text),
    imageUrl: face?.image?.small || face?.image?.normal || null,
  };
}

/**
 * Toutes les cartes imprimées en anglais (environ 5 000, six pages), réduites
 * à nom, pitch, classes, talents et types. Lues une fois par semaine et gardées
 * sur le téléphone (IndexedDB) : de quoi compléter les classes et talents de
 * toute une collection sans une requête par carte.
 */
export function vaultIndex(progress = silent) {
  indexPromise ||= (async () => {
    const stored = await storeGet(INDEX_STORAGE);
    if (stored?.v === 3 && Date.now() - stored.at < INDEX_TTL_MS) return stored.cards;
    const vocab = await vocabulary();
    const cards = [];
    for (let page = 1; ; page += 1) {
      const query = new URLSearchParams({ language: 'en', page_size: String(PAGE_SIZE), page: String(page), orderby: 'relevance' });
      const data = await get(`advanced-search/?${query}`);
      const results = data.results || [];
      for (const item of results) {
        cards.push(indexCard(item, vocab));
      }
      const done = (page - 1) * PAGE_SIZE + results.length;
      if (data.count) progress.report(Math.min(1, done / data.count), `Card Vault : ${formatCount(done)} / ${formatCount(data.count)} cartes`);
      if (!data.next || !results.length) break;
    }
    await completeBlankCards(cards, progress);
    await storeSet(INDEX_STORAGE, { v: 3, at: Date.now(), cards });
    return cards;
  })().catch((err) => {
    indexPromise = null;
    throw err;
  });
  return indexPromise;
}

/**
 * Quelques cartes (une cinquantaine) ont une ligne de type vide sur
 * l'impression que rend la recherche (une réimpression « R-WTR… ») : sans
 * classe ni type, elles échapperaient aux suivis. Leur fiche (`card_id/…`)
 * donne classes, types et talents structurés : on la lit pour elles seules.
 */
async function completeBlankCards(cards, progress = silent) {
  const blank = cards.filter((card) => !card.types.length && !card.classes.length);
  let done = 0;
  const queue = [...blank];
  const worker = async () => {
    for (let card = queue.shift(); card; card = queue.shift()) {
      try {
        const data = await get(`card_id/${encodeURIComponent(card.cardId)}/`);
        const core = data.results?.[0]?.cores?.[0];
        if (core) {
          const names = (list) => (list || []).map((item) => item.name_en || item.name).filter(Boolean);
          card.types = names(core.core_types);
          card.classes = names(core.core_classes);
          if (!card.talents.length) card.talents = names(core.core_talents);
          card.legendary ||= isLegendary(core.textbox);
        }
      } catch {
        // Fiche illisible : la carte reste sans classe ni type.
      }
      done += 1;
      progress.detail?.(`Card Vault : fiches complétées ${done} / ${blank.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, blank.length) }, worker));
}

/** Classes, talents et types connus de Card Vault, pour composer un suivi. */
export async function vaultVocabulary() {
  const vocab = await vocabulary();
  const sorted = (list) => list.slice().sort((a, b) => a.localeCompare(b, 'en'));
  return { classes: sorted(vocab.classes), talents: sorted(vocab.talents), types: sorted(vocab.types) };
}

const LANGUAGE_STORAGE = 'cardvault_language';

/**
 * Identifiants des cartes imprimées dans cette langue (`ja`, `fr`…), une ligne
 * par carte quelle que soit l'extension. Avec `classes`, une recherche par
 * classe (bien plus courte : Ninja en japonais tient en une page) ; sinon
 * toute la langue. Gardés une semaine sur le téléphone.
 */
export async function vaultLanguageIds(language, classes = [], progress = silent) {
  const filters = classes.length ? classes.map((name) => ({ classes: name })) : [{}];
  const ids = new Set();
  for (const [index, filter] of filters.entries()) {
    const step = progress.sub(index / filters.length, (index + 1) / filters.length);
    const storage = `${LANGUAGE_STORAGE}:${language}:${filter.classes || '*'}`;
    const stored = await storeGet(storage);
    let found = stored?.v === 1 && Date.now() - stored.at < INDEX_TTL_MS ? stored.ids : null;
    if (!found) {
      found = [];
      for (let page = 1; ; page += 1) {
        const query = new URLSearchParams({ ...filter, language, page_size: String(PAGE_SIZE), page: String(page), orderby: 'relevance' });
        const data = await get(`advanced-search/?${query}`);
        const results = data.results || [];
        found.push(...results.map((item) => item.card_id));
        const done = (page - 1) * PAGE_SIZE + results.length;
        if (data.count) step.report(Math.min(1, done / data.count), `Card Vault, cartes en ${language} : ${formatCount(done)} / ${formatCount(data.count)}`);
        if (!data.next || !results.length) break;
      }
      await storeSet(storage, { v: 1, at: Date.now(), ids: found });
    }
    for (const id of found) ids.add(id);
  }
  return ids;
}

// --- Raretés et impressions (suivis de collection) ---------------------------------

/** Les raretés de Card Vault, de la plus courante à la plus rare (puis promos et à part). */
export const RARITY_ORDER = [
  'basic', 'common', 'rare', 'super-rare', 'majestic', 'legendary', 'fabled',
  'marvel', 'gold', 'gold-marvel', 'promo', 'promo-marvel', 'token',
];

const RARITY_STORAGE = 'cardvault_rarity';

/**
 * Les raretés de chaque carte (identifiant → ['common', 'marvel'…]) parmi ses
 * impressions dans cette langue (ou toutes langues si `language` est vide),
 * une recherche par rareté (et par classe, si `classes`). Gardées une semaine.
 */
export async function vaultRarities(language = null, classes = [], progress = silent) {
  const filters = classes.length ? classes.map((name) => ({ classes: name })) : [{}];
  const map = {};
  for (const [index, filter] of filters.entries()) {
    const step = progress.sub(index / filters.length, (index + 1) / filters.length);
    const storage = `${RARITY_STORAGE}:${language || '*'}:${filter.classes || '*'}`;
    const stored = await storeGet(storage);
    let found = stored?.v === 1 && Date.now() - stored.at < INDEX_TTL_MS ? stored.map : null;
    if (!found) {
      found = {};
      let done = 0;
      const queue = [...RARITY_ORDER];
      const worker = async () => {
        for (let rarity = queue.shift(); rarity; rarity = queue.shift()) {
          for (let page = 1; ; page += 1) {
            const query = new URLSearchParams({
              ...filter, ...(language ? { language } : {}), rarities: rarity, page_size: String(PAGE_SIZE), page: String(page), orderby: 'relevance',
            });
            const data = await get(`advanced-search/?${query}`);
            const results = data.results || [];
            for (const item of results) (found[item.card_id] ||= []).push(rarity);
            if (!data.next || !results.length) break;
          }
          done += 1;
          step.report(done / RARITY_ORDER.length, `Card Vault : raretés ${done} / ${RARITY_ORDER.length}`);
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));
      await storeSet(storage, { v: 1, at: Date.now(), map: found });
    }
    for (const [id, rarities] of Object.entries(found)) map[id] = [...new Set([...(map[id] || []), ...rarities])];
  }
  return map;
}

const FINISH_LABELS = {
  regular: 'Standard', 'rainbow-foil': 'Rainbow Foil', 'cold-foil': 'Cold Foil', 'gold-cold-foil': 'Gold Cold Foil',
};
const finishLabel = (finish) => FINISH_LABELS[finish] || String(finish || '').replace(/(^|-)([a-z])/g, (_, sep, c) => `${sep ? ' ' : ''}${c.toUpperCase()}`);

/**
 * Les impressions de ces cartes (plusieurs identifiants pour une même carte),
 * dans cette langue si `language` : où la trouver. Rend [{ printId, language,
 * rarity, setCode, setName, product, releaseDate, finishes }], les plus
 * récentes d'abord.
 */
export async function vaultPrintings(cardIds, language = null) {
  const prints = new Map();
  for (const id of cardIds) {
    const data = await get(`card_id/${encodeURIComponent(id)}/`);
    for (const print of data.results?.[0]?.card_prints || []) {
      if (print.is_published === false) continue;
      if (language && print.print_language !== language) continue;
      const key = print.print_id || print.id;
      const previous = prints.get(key);
      const finishes = [...new Set([...(previous?.finishes || []), ...(print.faces || []).map((face) => finishLabel(face.finish_type))])];
      prints.set(key, {
        printId: print.print_id || null,
        language: print.print_language || null,
        rarity: print.rarity || null,
        setCode: print.print_set?.set_code || null,
        setName: print.print_set?.set_name || null,
        product: print.product?.product_name || print.print_set?.set_name || null,
        releaseDate: print.product?.release_date || null,
        finishes: finishes.filter(Boolean),
      });
    }
  }
  return [...prints.values()].sort(
    (a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')) || String(a.printId).localeCompare(String(b.printId)),
  );
}

/**
 * Classes et talents de ces cartes (`cards` : [{ id, name, pitch }]) :
 * { id: { classes, talents } }, ou null pour une carte inconnue. Une carte
 * sans pitch connu prend la première de ce nom.
 */
export async function vaultCardClasses(cards, progress = silent) {
  const index = await vaultIndex(progress);
  const exact = new Map();
  const byName = new Map();
  for (const card of index) {
    const key = indexKey(card.name, card.pitch);
    if (!exact.has(key)) exact.set(key, card);
    if (!byName.has(nameKey(card.name))) byName.set(nameKey(card.name), card);
  }
  return Object.fromEntries(
    cards.map((card) => {
      const hit = exact.get(indexKey(card.name, card.pitch)) || (!card.pitch ? byName.get(nameKey(card.name)) : null);
      return [card.id, hit ? { classes: hit.classes, talents: hit.talents } : null];
    }),
  );
}
