/**
 * Client CardNexus (https://docs.cardnexus.com).
 *
 * Un "deck" ici est une location d'inventaire dont l'icone est `deck`.
 * On lit ses lignes (GET /inventory?location=...), on resout les produits en
 * lot (POST /products/search avec productIds), puis on normalise le tout dans
 * la meme forme que fabrary.js pour que l'interface affiche les deux sources
 * avec le meme rendu.
 *
 * Portage navigateur de lib/cardnexus.js : la cle d'API vient des reglages de
 * l'app (localStorage) au lieu de api_key.txt.
 */
import { cardImageUrl } from './fabrary.js';
import { httpFetch, uuid } from './http.js';
import { silent, pauseFor, formatCount } from './progress.js';

const BASE = 'https://public-api.cardnexus.com/v1';
const DECK_ICON = 'deck';
const PRODUCT_BATCH = 200;
const KEY_STORAGE = 'cardnexus_api_key';

export class CardnexusError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'CardnexusError';
    this.status = status;
  }
}

// --- Cle d'API -------------------------------------------------------------

export function getApiKey() {
  try {
    return localStorage.getItem(KEY_STORAGE)?.trim() || null;
  } catch {
    return null;
  }
}

export function setApiKey(value) {
  const key = String(value || '').trim();
  if (key) localStorage.setItem(KEY_STORAGE, key);
  else localStorage.removeItem(KEY_STORAGE);
}

export const isConfigured = () => Boolean(getApiKey());

// --- Appels ----------------------------------------------------------------

// CardNexus autorise 60 requetes/minute et par compte. Monter un deck en
// consomme une par nom de carte : sans regulation on prend un 429 en plein
// milieu d'un plan. On s'auto-limite un cran en dessous et on attend plutot que
// d'echouer.
const RATE_LIMIT = 55;
const RATE_WINDOW_MS = 60_000;
const recentCalls = [];

async function throttle() {
  for (;;) {
    const now = Date.now();
    while (recentCalls.length && now - recentCalls[0] > RATE_WINDOW_MS) recentCalls.shift();
    if (recentCalls.length < RATE_LIMIT) {
      recentCalls.push(now);
      return;
    }
    const waitMs = RATE_WINDOW_MS - (now - recentCalls[0]) + 50;
    pauseFor(waitMs, 'CardNexus accepte 60 requêtes par minute');
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

// Un 429 n'est pas une erreur a remonter : l'API dit combien attendre
// (Retry-After), on patiente et on rejoue. Au-dela, on abandonne.
const MAX_RATE_RETRIES = 3;

async function api(endpoint, { method = 'GET', body, idempotencyKey } = {}) {
  const key = getApiKey();
  if (!key) {
    throw new CardnexusError("Aucune clé d'API CardNexus : ajoutez-la dans les réglages (⚙).", 503);
  }

  for (let attempt = 0; ; attempt += 1) {
    await throttle();
    const res = await httpFetch(`${BASE}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        // La meme cle a chaque reprise : une ecriture rejouee ne s'applique qu'une fois.
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (res.status === 401) throw new CardnexusError("Clé d'API CardNexus refusée (401).", 401);
    if (res.status === 429) {
      const retry = Number(res.headers.get('Retry-After')) || 10;
      if (attempt < MAX_RATE_RETRIES) {
        pauseFor((retry + 1) * 1000, 'Quota CardNexus atteint');
        await new Promise((resolve) => setTimeout(resolve, (retry + 1) * 1000));
        continue;
      }
      throw new CardnexusError(`Quota CardNexus atteint. Reessayez dans ${retry} secondes.`, 429);
    }
    if (res.status === 409) throw new CardnexusError('Ce nom est déjà utilisé par un autre emplacement.', 409);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new CardnexusError(`CardNexus a repondu ${res.status}. ${text.slice(0, 200)}`, 502);
    }
    // Une suppression peut repondre sans corps.
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
}

// POST /inventory/search rend 200 lignes par page (contre 100 pour
// GET /inventory) et filtre plusieurs endroits a la fois : deux fois moins de
// requetes pour lire un endroit. Il pagine par position, jusqu'a 10 000 lignes.
const LINES_PAGE = 200;

// L'app ne s'occupe que de Flesh and Blood : toute lecture de l'inventaire est
// filtree sur ce jeu, les cartes des autres jeux restent invisibles et intactes.
const GAME = 'fab';
const FAB_ONLY = { game: GAME };
const SEARCH_WINDOW = 10_000;
const LOCATIONS_PER_QUERY = 50;

/** Où en est une lecture de lignes : « 400 / 1 234 lignes ». */
function reportLines(progress, read, total) {
  if (total) progress.report(read / total, `${formatCount(read)} / ${formatCount(total)} lignes`);
  else progress.detail(`${formatCount(read)} lignes lues`);
}

/** Toutes les lignes repondant a ce filtre de recherche, page apres page. */
async function searchAllLines(filters, progress = silent) {
  const lines = [];
  for (let offset = 0; offset < SEARCH_WINDOW; offset += LINES_PAGE) {
    const res = await api('/inventory/search', {
      method: 'POST',
      body: { ...filters, gameFilters: FAB_ONLY, limit: LINES_PAGE, offset, sortBy: 'name' },
    });
    lines.push(...(res.data || []));
    // L'API donne le nombre total de lignes : de quoi afficher un vrai pourcentage.
    reportLines(progress, lines.length, res.pagination?.total);
    if (!res.pagination?.hasMore) return lines;
  }
  throw new CardnexusError(
    'Plus de 10 000 lignes a lire d’un coup : choisissez moins d’endroits a la fois.',
    400,
  );
}

/** Les lignes rangees dans ces endroits (par lots de 50 noms, limite de l'API). */
async function linesAtLocations(names, progress = silent) {
  const lines = [];
  const chunks = Math.max(1, Math.ceil(names.length / LOCATIONS_PER_QUERY));
  for (let i = 0; i < names.length; i += LOCATIONS_PER_QUERY) {
    const values = names.slice(i, i + LOCATIONS_PER_QUERY);
    const part = i / LOCATIONS_PER_QUERY;
    const found = await searchAllLines({ location: { op: 'or', values } }, progress.sub(part / chunks, (part + 1) / chunks));
    // La recherche de CardNexus renvoie parfois, pour « sans emplacement »
    // (null), des lignes qui en ont un : on ne garde que ce que chaque ligne
    // dit d'elle-même.
    const wanted = new Set(values.map(placeKey));
    lines.push(...found.filter((line) => wanted.has(placeKey(line.location))));
  }
  return lines;
}

/** Nom d'emplacement comparable : la casse ne compte pas, « aucun » vaut null. */
const placeKey = (name) => (name == null || name === '' ? null : String(name).toLowerCase());

/**
 * Toute la collection, sans plafond : GET /inventory au curseur (100 lignes
 * par page). Plus lent que la recherche, mais va au-dela de 10 000 lignes.
 */
async function walkAllLines(progress = silent) {
  // Le curseur ne dit pas combien il reste : on s'appuie sur la derniere lecture.
  const estimate = Number(readStored(LINES_ESTIMATE_STORAGE)) || 0;
  const lines = [];
  let cursor = null;
  for (let page = 0; page < 2000; page += 1) {
    const qs = new URLSearchParams({ limit: '100', game: GAME });
    if (cursor) qs.set('cursor', cursor);
    const res = await api(`/inventory?${qs}`);
    lines.push(...(res.data || []));
    if (estimate > lines.length) {
      progress.report(lines.length / estimate, `${formatCount(lines.length)} / ≈ ${formatCount(estimate)} lignes`);
    } else {
      progress.detail(`${formatCount(lines.length)} lignes lues`);
    }
    cursor = res.pagination?.nextCursor;
    if (!cursor) break;
  }
  return lines;
}

const LINES_ESTIMATE_STORAGE = 'collection_lines_estimate';

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Photo de toute la collection : les lignes, par la recherche (200 par page),
 * ou au curseur si la collection depasse ce que la recherche sait paginer.
 */
export async function allCollectionLines(progress = silent) {
  let lines;
  try {
    lines = await searchAllLines({}, progress);
  } catch (err) {
    if (err.status !== 400) throw err;
    lines = await walkAllLines(progress);
  }
  try {
    localStorage.setItem(LINES_ESTIMATE_STORAGE, String(lines.length));
  } catch {
    // Sans stockage, la prochaine lecture au curseur n'aura pas de pourcentage.
  }
  return lines;
}

/** Nom et pitch de ces produits, pour decrire des changements. */
export async function productNames(productIds, progress = silent) {
  const products = await resolveProducts(productIds, progress);
  return Object.fromEntries(
    [...products].map(([id, product]) => [
      id,
      { name: cleanName(product.name), pitch: product.attributes?.pitch ?? null, printNumber: product.printNumber || null },
    ]),
  );
}

/**
 * Nombre de cartes par endroit, pour toute la collection, en un balayage
 * (quelques dizaines de requetes). Les lignes sans endroit sont comptees sous
 * la cle `null`.
 */
export async function countByLocation(progress = silent) {
  const counts = new Map();
  for (const line of await searchAllLines({}, progress)) {
    const place = line.location ?? null;
    counts.set(place, (counts.get(place) || 0) + line.quantity);
  }
  return counts;
}

// Le catalogue ne bouge quasiment jamais et les decks partagent des cartes :
// on garde les produits en memoire pour le temps de vie de l'app.
const productCache = new Map();

async function resolveProducts(productIds, progress = silent) {
  const missing = [...new Set(productIds)].filter((id) => !productCache.has(id));

  for (let i = 0; i < missing.length; i += PRODUCT_BATCH) {
    progress.report(i / missing.length, `Catalogue : ${formatCount(i)} / ${formatCount(missing.length)} cartes`);
    const res = await api('/products/search', {
      method: 'POST',
      body: { productIds: missing.slice(i, i + PRODUCT_BATCH), limit: PRODUCT_BATCH },
    });
    for (const product of res.data || []) productCache.set(product.id, product);
  }
  progress.report(1);

  return new Map(productIds.map((id) => [id, productCache.get(id)]).filter(([, p]) => p));
}

// --- Locations -------------------------------------------------------------

const byName = (a, b) => a.name.localeCompare(b.name, 'fr');

/** Toutes les locations, avec leur icone — les destinations possibles d'un deplacement. */
export async function listLocations() {
  const locations = await api('/inventory/locations');
  return locations.map(({ name, color, icon }) => ({ name, color, icon })).sort(byName);
}

export async function listDeckLocations() {
  const locations = await listLocations();
  return locations.filter((loc) => loc.icon === DECK_ICON).map(({ name, color }) => ({ name, color }));
}

// --- Normalisation ---------------------------------------------------------

const PITCH_NAMES = { 1: 'Red', 2: 'Yellow', 3: 'Blue' };

/**
 * Cle de regroupement d'une carte : `fabId` (slug + pitch) rassemble les
 * reimpressions et les finitions d'une meme carte, ce qu'attend une decklist.
 */
const mergeKey = (product) =>
  product.attributes?.fabId ||
  [product.nameSlug, product.attributes?.pitch].filter(Boolean).join('-') ||
  String(product.id);

/** Nom de carte sans le suffixe de pitch que CardNexus ajoute, ex. "Buckwild (Blue)". */
const cleanName = (name) => name.replace(/\s*\((Red|Yellow|Blue)\)\s*$/i, '');

/**
 * Une ligne d'inventaire telle que l'interface la manipule. `inventoryId` est
 * ce qui identifie la ligne a deplacer : c'est la vraie granularite de l'API,
 * plus fine que la carte affichee.
 */
function describeLine(line, product) {
  return {
    inventoryId: line.id,
    printNumber: product.printNumber || null,
    expansion: product.expansion?.name || null,
    finish: line.finish,
    condition: line.condition,
    language: line.language,
    quantity: line.quantity,
    location: line.location || null,
    forSale: Boolean(line.forSale),
    tags: line.tags || [],
    updatedAt: line.updatedAt || null,
  };
}

function zoneOf(types) {
  if (types.includes('Hero')) return 'hero';
  if (types.includes('Weapon')) return 'weapons';
  if (types.includes('Equipment')) return 'equipment';
  return 'deck';
}

function buildCard(group) {
  const { product, quantity, printings } = group;
  const attrs = product.attributes || {};

  // CardNexus renvoie 0 la ou la carte n'imprime simplement aucune valeur.
  // Heros, armes et equipements n'ont jamais de cout, et n'affichent attaque ou
  // defense que si la valeur est non nulle ; les cartes de deck, elles, peuvent
  // vraiment couter 0 ou defendre 0, on ne touche donc qu'a leur attaque.
  const types = attrs.types || [];
  const permanent = ['Hero', 'Weapon', 'Equipment'].some((t) => types.includes(t));
  const isAttack = (attrs.subTypes || []).includes('Attack') || types.includes('Weapon');

  const drop = (value, whenZero) => (value === 0 && whenZero ? null : value ?? null);
  const cost = drop(attrs.cost, permanent);
  const power = drop(attrs.attack, permanent || !isAttack);
  const defense = drop(attrs.defense, permanent);

  return {
    id: mergeKey(product),
    name: cleanName(product.name),
    quantity,
    image: product.printNumber || null,
    // Quelques produits n'ont pas d'illustration chez CardNexus ; les codes
    // d'impression sont les memes que ceux de FaBrary, qui sert de repli.
    imageUrl: product.imageUrl || cardImageUrl(product.printNumber),
    pitch: attrs.pitch ?? null,
    pitchName: attrs.pitch ? PITCH_NAMES[attrs.pitch] : null,
    cost,
    power,
    defense,
    types: attrs.types || [],
    subtypes: attrs.subTypes || [],
    talents: attrs.talents || [],
    classes: attrs.classes || [],
    expansion: product.expansion?.name || null,
    keywords: [],
    rarity: product.rarity || attrs.rarity || null,
    typeText: [(attrs.classes || []).join(' '), (attrs.types || []).join(' ')]
      .filter(Boolean)
      .join(' '),
    text: attrs.description || '',
    intellect: attrs.intellect ?? null,
    life: attrs.life ?? null,
    printings,
    foil: printings.some((p) => p.finish && p.finish !== 'Standard'),
  };
}

const byNameThenPitch = (a, b) => a.name.localeCompare(b.name) || (a.pitch ?? 0) - (b.pitch ?? 0);

/**
 * Pseudo-emplacement des cartes qui n'en ont aucun : il s'ouvre comme un
 * emplacement (deckId = UNPLACED), mais se lit et s'adresse avec `null`.
 */
export const UNPLACED = '__sans_emplacement__';
export const UNPLACED_LABEL = 'Sans emplacement';

export async function fetchDeckFromLocation(locationName, progress = silent) {
  const unplaced = locationName === UNPLACED;
  const lines = await linesAtLocations([unplaced ? null : locationName], progress.sub(0, 0.8));
  if (!lines.length) {
    throw new CardnexusError(
      unplaced ? 'Toutes vos cartes ont un emplacement.' : `Aucune carte dans la location "${locationName}".`,
      404,
    );
  }

  const products = await resolveProducts(lines.map((l) => l.productId), progress.sub(0.8, 1));

  // Une carte = plusieurs lignes possibles (finitions, editions, etats).
  const groups = new Map();
  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product) continue;

    const key = mergeKey(product);
    if (!groups.has(key)) groups.set(key, { product, quantity: 0, printings: [] });
    const group = groups.get(key);
    group.quantity += line.quantity;
    group.printings.push(describeLine(line, product));
    // On affiche l'illustration de l'edition la plus representee.
    if (line.quantity > (group.topQuantity || 0)) {
      group.topQuantity = line.quantity;
      group.product = product;
    }
  }

  const unresolved = lines.filter((l) => !products.has(l.productId)).length;

  const zones = { hero: [], weapons: [], equipment: [], deck: [] };
  for (const group of groups.values()) {
    const card = buildCard(group);
    zones[zoneOf(card.types)].push(card);
  }

  [zones.weapons, zones.equipment, zones.deck].forEach((list) => list.sort(byNameThenPitch));

  // Une location ne contient normalement qu'un heros ; s'il y en a plusieurs on
  // prend le premier et on laisse les autres dans le deck.
  const [heroCard, ...extraHeroes] = zones.hero.sort(byNameThenPitch);
  zones.deck.push(...extraHeroes);
  zones.deck.sort(byNameThenPitch);

  const hero = heroCard
    ? {
        // Toute la carte : sur un simple emplacement, le heros s'affiche et se
        // groupe comme les autres (type, classe, extension...).
        ...heroCard,
        id: heroCard.id,
        name: heroCard.name,
        image: heroCard.image,
        imageUrl: heroCard.imageUrl,
        intellect: heroCard.intellect,
        life: heroCard.life,
        classes: heroCard.classes,
        talents: heroCard.talents,
        typeText: heroCard.typeText,
        text: heroCard.text,
        // Le heros est une carte comme une autre cote inventaire : il porte ses
        // lignes, sinon "tout prendre" le laisserait derriere.
        pitch: heroCard.pitch,
        quantity: heroCard.quantity,
        printings: heroCard.printings,
      }
    : null;

  const total = (list) => list.reduce((sum, c) => sum + c.quantity, 0);

  return {
    source: 'cardnexus',
    deckId: locationName,
    unplaced,
    url: null,
    name: unplaced ? UNPLACED_LABEL : locationName,
    format: 'Inventaire CardNexus',
    notes: unresolved
      ? `${unresolved} ligne(s) d'inventaire n'ont pas pu etre resolues dans le catalogue CardNexus.`
      : null,
    tags: [],
    tournament: null,
    createdAt: null,
    updatedAt: lines.reduce((latest, l) => (l.updatedAt > latest ? l.updatedAt : latest), ''),
    author: null,
    hero,
    weapons: zones.weapons,
    equipment: zones.equipment,
    deck: zones.deck,
    sideboard: [],
    counts: {
      deck: total(zones.deck),
      weapons: total(zones.weapons),
      equipment: total(zones.equipment),
      sideboard: 0,
      unique: zones.deck.length,
    },
  };
}

// --- Recherche dans l'inventaire ------------------------------------------

const SEARCH_LIMIT = 60;

/**
 * Cherche des lignes d'inventaire par nom de carte, toutes locations confondues.
 * C'est le sens "ramener une carte dans le deck" : on voit ou sont les
 * exemplaires avant d'en prendre.
 */
export async function searchInventoryLines(query, { game = 'fab', progress = silent } = {}) {
  const term = String(query || '').trim();
  if (term.length < 2) {
    throw new CardnexusError('Tapez au moins deux caracteres.', 400);
  }

  const res = await api('/inventory/search', {
    method: 'POST',
    body: { name: term, limit: SEARCH_LIMIT, gameFilters: { game } },
  });

  const lines = res.data || [];
  progress.report(0.5);
  const products = await resolveProducts(lines.map((l) => l.productId), progress.sub(0.5, 1));

  // Une entree par carte, ses lignes en dessous : meme lecture que dans un deck.
  const groups = new Map();
  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product) continue;

    const key = mergeKey(product);
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: cleanName(product.name),
        pitch: product.attributes?.pitch ?? null,
        pitchName: product.attributes?.pitch ? PITCH_NAMES[product.attributes.pitch] : null,
        imageUrl: product.imageUrl || cardImageUrl(product.printNumber),
        types: product.attributes?.types || [],
        lines: [],
      });
    }
    groups.get(key).lines.push(describeLine(line, product));
  }

  for (const group of groups.values()) {
    group.lines.sort((a, b) => (a.location || '').localeCompare(b.location || '', 'fr'));
    group.quantity = group.lines.reduce((sum, l) => sum + l.quantity, 0);
  }

  return {
    total: res.pagination?.total ?? lines.length,
    truncated: Boolean(res.pagination?.hasMore),
    // L'API classe par pertinence : la carte cherchee arrive en premier. On
    // garde cet ordre (les Map preservent l'insertion) au lieu de re-trier.
    cards: [...groups.values()],
  };
}

// --- Deplacements ----------------------------------------------------------

const MOVE_BATCH = 200;

const ERROR_LABELS = {
  NOT_FOUND: "cette ligne d'inventaire n'existe plus",
  INSUFFICIENT_QUANTITY: 'quantite insuffisante sur la ligne',
  INVALID_COUNT: 'quantite demandee superieure a la ligne',
  INVALID_ITEM: 'la ligne est citee deux fois dans le meme envoi',
  LOCATION_NOT_FOUND: 'cette location n existe pas',
  TAG_NOT_FOUND: 'tag inconnu',
};

/**
 * Deplace des fractions de lignes vers une location.
 *
 * `moves` : [{ inventoryId, count }]. `destination` est un nom de location
 * existante, ou null pour retirer les cartes de toute location. L'API decoupe
 * la ligne toute seule quand `count` est inferieur a sa quantite, et fusionne
 * a l'arrivee avec une ligne identique s'il y en a une.
 */
export async function moveLines(moves, destination) {
  if (!Array.isArray(moves) || !moves.length) {
    throw new CardnexusError('Aucun deplacement a appliquer.', 400);
  }
  if (moves.length > MOVE_BATCH) {
    throw new CardnexusError(`Maximum ${MOVE_BATCH} deplacements par envoi.`, 400);
  }

  // L'API rejette l'envoi entier si une ligne y figure deux fois.
  const seen = new Set();
  const items = moves.map(({ inventoryId, count }) => {
    if (!inventoryId || !Number.isInteger(count) || count < 1) {
      throw new CardnexusError('Deplacement invalide : inventoryId et count requis.', 400);
    }
    if (seen.has(inventoryId)) {
      throw new CardnexusError('La meme ligne apparait deux fois dans la selection.', 400);
    }
    seen.add(inventoryId);
    return { inventoryId, count, location: destination };
  });

  const res = await api('/inventory/bulk/update', {
    method: 'POST',
    body: { items },
    idempotencyKey: uuid(),
  });

  // Le stock a bouge : les recherches memorisees ne valent plus rien.
  forgetInventorySearches();

  const results = res.results || [];
  const applied = [];
  const failed = [];

  for (const result of results) {
    const move = moves[result.index];
    if (result.status === 'ok') {
      applied.push({ ...move, survivingId: result.inventoryId });
    } else {
      failed.push({ ...move, code: result.code, reason: ERROR_LABELS[result.code] || result.code });
    }
  }

  return { applied, failed, destination };
}

// --- Montage d'un deck a partir d'une liste ---------------------------------

/**
 * Cle de jointure entre une carte FaBrary et un produit CardNexus.
 *
 * CardNexus expose `attributes.fabId` = slug du nom + numero de pitch
 * ("buckwild-1"). FaBrary donne le nom et le pitch : on reconstruit donc la
 * meme cle des deux cotes, sans dependre du format d'identifiant de FaBrary.
 */
export const slugifyName = (name) =>
  String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const fabKey = (name, pitch) =>
  pitch ? `${slugifyName(name)}-${pitch}` : slugifyName(name);

const SEARCH_PAGE = 200;
const SLUG_CACHE_TTL_MS = 2 * 60 * 1000;

// Un plan coute une requete par nom de carte, et deux decks partagent beaucoup
// de cartes. On garde les resultats un court moment — assez pour replanifier ou
// enchainer deux decks, assez peu pour ne pas travailler sur un stock perime.
const slugCache = new Map();

/** Vide le cache des recherches : l'inventaire vient de changer. */
export function forgetInventorySearches() {
  slugCache.clear();
}

/** Toutes les lignes de l'inventaire pour ce slug, pitchs confondus. */
async function linesForSlug(nameSlug) {
  const hit = slugCache.get(nameSlug);
  if (hit && hit.expiresAt > Date.now()) return hit.lines;

  const lines = [];
  for (let offset = 0; offset < 2000; offset += SEARCH_PAGE) {
    const res = await api('/inventory/search', {
      method: 'POST',
      body: { nameSlug, limit: SEARCH_PAGE, offset, gameFilters: { game: 'fab' } },
    });
    lines.push(...(res.data || []));
    if (!res.pagination?.hasMore) break;
  }

  slugCache.set(nameSlug, { lines, expiresAt: Date.now() + SLUG_CACHE_TTL_MS });
  return lines;
}

/** Execute `task` sur chaque element, `size` en parallele au plus. */
async function mapWithConcurrency(items, size, task) {
  const results = new Array(items.length);
  const queue = items.map((item, index) => ({ item, index }));

  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      results[next.index] = await task(next.item);
    }
  };

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return results;
}

const CONDITION_RANK = { NM: 0, LP: 1, MP: 2, HP: 3, DMG: 4 };

/**
 * Ordre dans lequel on pioche automatiquement les exemplaires. On evite
 * d'abord ce qui couterait cher a deplacer : une carte en vente (elle porte une
 * annonce), puis une carte prise a un autre deck (on le demonterait).
 */
function allocationOrder(deckLocations) {
  return (a, b) =>
    Number(a.forSale) - Number(b.forSale) ||
    Number(deckLocations.has(a.location)) - Number(deckLocations.has(b.location)) ||
    Number(a.finish !== 'Standard') - Number(b.finish !== 'Standard') ||
    (CONDITION_RANK[a.condition] ?? 9) - (CONDITION_RANK[b.condition] ?? 9) ||
    b.quantity - a.quantity;
}

// --- Repartition sur le moins d'endroits possible ----------------------------

/** Au-dela, l'enumeration exacte des combinaisons coute trop : on passe au glouton. */
const EXACT_COVER_MAX_PLACES = 16;

const placeOf = (line) => line.location ?? '';

/** Copies obtenues pour chaque carte si l'on va chercher dans ces endroits. */
function coverage(places, offers, need) {
  let total = 0;
  for (let i = 0; i < need.length; i += 1) {
    let got = 0;
    for (const place of places) got += offers.get(place)[i];
    total += Math.min(need[i], got);
  }
  return total;
}

/** Toutes les combinaisons de `size` elements, dans l'ordre du tableau. */
function* combinations(items, size, start = 0, prefix = []) {
  if (prefix.length === size) {
    yield prefix;
    return;
  }
  for (let i = start; i <= items.length - (size - prefix.length); i += 1) {
    yield* combinations(items, size, i + 1, [...prefix, items[i]]);
  }
}

/**
 * Le plus petit ensemble d'endroits qui fournit autant de copies que tous les
 * endroits reunis. Exact jusqu'a EXACT_COVER_MAX_PLACES endroits (on essaie
 * les ensembles de 1, puis 2, ... endroits), glouton au-dela.
 *
 * `offers` : Map(endroit → copies disponibles par carte). `need` : copies
 * encore voulues par carte.
 */
function fewestPlaces(offers, need) {
  // Les endroits qui fournissent le plus d'abord : a taille egale, la premiere
  // combinaison trouvee prefere les gros stocks.
  const places = [...offers.keys()].sort(
    (a, b) => coverage([b], offers, need) - coverage([a], offers, need) || a.localeCompare(b, 'fr'),
  );
  const target = coverage(places, offers, need);
  if (target === 0) return [];

  // Un endroit sans lequel on n'atteint pas la cible (seul a avoir une carte,
  // par exemple) est de toute facon retenu : on ne cherche que parmi les autres.
  const required = places.filter(
    (place) => coverage(places.filter((p) => p !== place), offers, need) < target,
  );
  const optional = places.filter((place) => !required.includes(place));
  if (coverage(required, offers, need) === target) return required;

  if (optional.length <= EXACT_COVER_MAX_PLACES) {
    for (let size = 1; size <= optional.length; size += 1) {
      for (const combo of combinations(optional, size)) {
        const candidate = [...required, ...combo];
        if (coverage(candidate, offers, need) === target) return candidate;
      }
    }
  }

  const chosen = [...required];
  let covered = coverage(chosen, offers, need);
  while (covered < target) {
    let best = null;
    let bestGain = 0;
    for (const place of places) {
      if (chosen.includes(place)) continue;
      const gain = coverage([...chosen, place], offers, need) - covered;
      if (gain > bestGain) {
        best = place;
        bestGain = gain;
      }
    }
    if (!best) break;
    chosen.push(best);
    covered += bestGain;
  }
  return chosen;
}

/**
 * Repartit les copies a prendre en visitant le moins d'endroits possible.
 *
 * `rows` : [{ need, candidates }], les candidates deja triees par preference
 * (allocationOrder). Les regles de prudence passent avant le nombre
 * d'endroits : on ne pioche dans un autre deck, puis dans une carte en vente,
 * que si le reste de la collection ne suffit pas. A chaque palier, les endroits
 * deja retenus sont gratuits ; on n'en ajoute que pour ce qu'ils ne couvrent pas.
 *
 * Une fois les endroits choisis, chaque carte est prise dans le plus fourni
 * d'entre eux, et seulement ce qui y manque ailleurs : la tournee se concentre
 * sur les gros stocks au lieu de s'eparpiller au gre de la taille des lignes.
 *
 * Renvoie, par carte, Map(inventoryId → copies prises).
 */
export function allocateFewestPlaces(rows, deckLocations, { protectDecks = true } = {}) {
  // Sans protection, un autre deck est un endroit comme un autre : utile pour
  // reprendre en bloc un deck qui contient deja la liste.
  const tiers = protectDecks
    ? [(line) => !line.forSale && !deckLocations.has(line.location), (line) => !line.forSale, () => true]
    : [(line) => !line.forSale, () => true];

  const taken = rows.map(() => new Map());
  const remaining = rows.map((row) => row.need);
  // Endroits retenus, du plus fourni au moins fourni : c'est l'ordre de pioche.
  const chosen = [];
  const rankOf = (line) => chosen.indexOf(placeOf(line));

  // Pioche dans les endroits retenus. Une carte vient d'un seul endroit quand
  // l'un d'eux suffit (le mieux classe) ; sinon, du mieux classe d'abord. Dans
  // un meme endroit, l'ordre de preference des lignes (Standard, etat...).
  const takeFrom = (allowed) => {
    rows.forEach((row, i) => {
      if (remaining[i] === 0) return;
      const left = (line) => line.quantity - (taken[i].get(line.inventoryId) || 0);
      const usable = row.candidates
        .map((line, order) => ({ line, order, rank: rankOf(line) }))
        .filter(({ line, rank }) => rank !== -1 && allowed(line));

      const stock = new Map();
      for (const { line, rank } of usable) stock.set(rank, (stock.get(rank) || 0) + left(line));
      const single = [...stock.entries()]
        .filter(([, count]) => count >= remaining[i])
        .map(([rank]) => rank)
        .sort((a, b) => a - b)[0];

      const lines = usable
        .filter(({ rank }) => single === undefined || rank === single)
        .sort((a, b) => a.rank - b.rank || a.order - b.order);

      for (const { line } of lines) {
        if (remaining[i] === 0) break;
        const take = Math.min(remaining[i], left(line));
        if (take <= 0) continue;
        taken[i].set(line.inventoryId, (taken[i].get(line.inventoryId) || 0) + take);
        remaining[i] -= take;
      }
    });
  };

  for (const allowed of tiers) {
    takeFrom(allowed);
    if (remaining.every((n) => n === 0)) break;

    const offers = new Map();
    rows.forEach((row, i) => {
      if (remaining[i] === 0) return;
      for (const line of row.candidates) {
        const place = placeOf(line);
        if (!allowed(line) || chosen.includes(place)) continue;
        if (!offers.has(place)) offers.set(place, rows.map(() => 0));
        offers.get(place)[i] += line.quantity;
      }
    });

    // Les nouveaux endroits, du plus fourni au moins fourni pour ce qui reste.
    const added = fewestPlaces(offers, remaining).sort(
      (a, b) => coverage([b], offers, remaining) - coverage([a], offers, remaining),
    );
    chosen.push(...added);
    takeFrom(allowed);
  }

  return taken;
}

/**
 * Ordre dans lequel on propose de sortir les exemplaires en trop d'un deck :
 * d'abord ce qui n'a rien a y faire (une carte en vente), puis le plus abime,
 * puis les petites lignes — le deck garde ses meilleurs exemplaires.
 */
function removalOrder(a, b) {
  return (
    Number(b.forSale) - Number(a.forSale) ||
    (CONDITION_RANK[b.condition] ?? 9) - (CONDITION_RANK[a.condition] ?? 9) ||
    a.quantity - b.quantity
  );
}

/**
 * Ce que la location contient en plus de la liste : cartes absentes de la
 * liste, ou presentes en plus grand nombre. C'est l'autre moitie d'une
 * comparaison — le plan dit quoi faire entrer, ceci dit quoi faire sortir.
 */
async function surplusInLocation(wanted, destination, progress = silent) {
  const lines = await linesAtLocations([destination], progress.sub(0, 0.6));
  const products = await resolveProducts(lines.map((l) => l.productId), progress.sub(0.6, 1));

  const wantedByKey = new Map(wanted.map((card) => [fabKey(card.name, card.pitch), card.quantity]));

  const groups = new Map();
  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product) continue;

    const key = mergeKey(product);
    if (!groups.has(key)) groups.set(key, { product, lines: [] });
    groups.get(key).lines.push(describeLine(line, product));
  }

  const rows = [];
  for (const [key, { product, lines: held }] of groups) {
    const have = held.reduce((sum, line) => sum + line.quantity, 0);
    const want = wantedByKey.get(key) || 0;
    const extra = have - want;
    if (extra <= 0) continue;

    const sorted = held.slice().sort(removalOrder);
    const picks = [];
    let remaining = extra;
    for (const line of sorted) {
      if (remaining === 0) break;
      const take = Math.min(remaining, line.quantity);
      picks.push({ ...line, take });
      remaining -= take;
    }

    const pitch = product.attributes?.pitch ?? null;
    rows.push({
      key,
      name: cleanName(product.name),
      pitch,
      pitchName: pitch ? PITCH_NAMES[pitch] : null,
      types: product.attributes?.types || [],
      imageUrl: product.imageUrl || cardImageUrl(product.printNumber),
      have,
      wanted: want,
      extra,
      lines: sorted,
      picks,
    });
  }

  return rows.sort(byNameThenPitch);
}

/**
 * Une meme carte peut figurer deux fois dans une liste (deck et reserve). Le
 * plan raisonne par carte : on additionne, sinon deux lignes du plan se
 * disputeraient les memes exemplaires.
 */
function mergeWanted(wanted) {
  const byKey = new Map();
  for (const card of wanted) {
    const key = fabKey(card.name, card.pitch);
    const hit = byKey.get(key);
    if (hit) hit.quantity += card.quantity;
    else byKey.set(key, { ...card });
  }
  return [...byKey.values()];
}

/**
 * Construit le plan de montage : pour chaque carte voulue, ce qui est deja sur
 * place, ce qu'on propose de deplacer, et ce qui manque. Avec `existing`, la
 * destination est un deck deja monte : le plan liste aussi ce qu'il contient en
 * trop par rapport a la liste (`surplus`), pour qu'il devienne exactement elle.
 *
 * `wanted` : [{ name, pitch, quantity, imageUrl, types }] — issu d'une liste
 * FaBrary. `destination` : la location ou le deck doit finir.
 */
export async function planDeckBuild(
  rawWanted,
  destination,
  { existing = false, protectDecks = true, progress = silent } = {},
) {
  if (!Array.isArray(rawWanted) || !rawWanted.length) {
    throw new CardnexusError('Liste de cartes vide.', 400);
  }
  const wanted = mergeWanted(rawWanted);

  const slugs = [...new Set(wanted.map((card) => slugifyName(card.name)))];
  // Une recherche par nom de carte : c'est l'essentiel de l'attente.
  const searching = progress.sub(0, 0.8);
  let searched = 0;
  const pages = await mapWithConcurrency(slugs, 3, async (slug) => {
    const lines = await linesForSlug(slug);
    searched += 1;
    searching.report(searched / slugs.length, `${searched} / ${slugs.length} cartes cherchées`);
    return lines;
  });
  const allLines = pages.flat();

  const products = await resolveProducts(allLines.map((l) => l.productId), progress.sub(0.8, 0.9));
  const deckLocations = new Set((await listDeckLocations()).map((l) => l.name));
  progress.report(0.92);

  // Lignes disponibles, rangees par cle de carte.
  const byKey = new Map();
  for (const line of allLines) {
    const product = products.get(line.productId);
    if (!product) continue;

    const key = mergeKey(product);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ ...describeLine(line, product), imageUrl: product.imageUrl });
  }

  const sortForAllocation = allocationOrder(deckLocations);
  const rows = wanted.map((card) => {
    const key = fabKey(card.name, card.pitch);
    const candidates = (byKey.get(key) || []).slice().sort(sortForAllocation);

    const onSite = candidates.filter((line) => line.location === destination);
    const elsewhere = candidates.filter((line) => line.location !== destination);
    const already = onSite.reduce((sum, line) => sum + line.quantity, 0);

    return {
      key,
      name: card.name,
      pitch: card.pitch ?? null,
      pitchName: card.pitch ? PITCH_NAMES[card.pitch] : null,
      types: card.types || [],
      imageUrl: card.imageUrl || candidates[0]?.imageUrl || null,
      needed: card.quantity,
      already,
      available: elsewhere.reduce((sum, line) => sum + line.quantity, 0),
      candidates: elsewhere,
      onSite,
    };
  });

  // Repartition proposee : le moins d'endroits possible ou aller chercher.
  const needs = rows.map((row) => ({ need: Math.max(0, row.needed - row.already), candidates: row.candidates }));
  const allocation = allocateFewestPlaces(needs, deckLocations, { protectDecks });

  // Ce que chaque autre deck pourrait fournir a lui seul : de quoi suggerer de
  // le reprendre en bloc plutot que de courir la collection.
  const deckSources = [...deckLocations]
    .filter((name) => name !== destination)
    .map((name) => ({
      name,
      cards: needs.reduce((sum, { need, candidates }) => {
        const here = candidates
          .filter((line) => line.location === name && !line.forSale)
          .reduce((total, line) => total + line.quantity, 0);
        return sum + Math.min(need, here);
      }, 0),
    }))
    .filter((source) => source.cards > 0)
    .sort((a, b) => b.cards - a.cards);
  rows.forEach((row, i) => {
    row.picks = row.candidates
      .filter((line) => allocation[i].has(line.inventoryId))
      .map((line) => ({ ...line, take: allocation[i].get(line.inventoryId) }));
    row.picked = row.picks.reduce((sum, pick) => sum + pick.take, 0);
    row.missing = Math.max(0, row.needed - row.already - row.picked);
  });

  const surplus = existing ? await surplusInLocation(wanted, destination, progress.sub(0.92, 1)) : [];
  progress.report(1);

  const sum = (field) => rows.reduce((total, row) => total + row[field], 0);
  return {
    destination,
    rows,
    surplus,
    deckSources,
    totals: {
      extra: surplus.reduce((total, row) => total + row.extra, 0),
      needed: sum('needed'),
      already: sum('already'),
      toMove: sum('picked'),
      missing: sum('missing'),
      cardsMissing: rows.filter((row) => row.missing > 0).length,
      fromDecks: rows
        .flatMap((row) => row.picks)
        .filter((pick) => deckLocations.has(pick.location)).length,
    },
  };
}

// --- Rangement des vracs ----------------------------------------------------

/**
 * Toutes les lignes de ces endroits, chacune avec la carte qu'elle porte (nom,
 * classes, extension) : la matiere premiere d'un plan de rangement.
 */
export async function linesInPlaces(places, progress = silent) {
  const lines = await linesAtLocations(places, progress.sub(0, 0.8));
  const products = await resolveProducts(lines.map((line) => line.productId), progress.sub(0.8, 1));

  return lines
    .filter((line) => products.has(line.productId))
    .map((line) => {
      const product = products.get(line.productId);
      const attrs = product.attributes || {};
      return {
        ...describeLine(line, product),
        card: {
          slug: product.nameSlug || slugifyName(cleanName(product.name)),
          name: cleanName(product.name),
          pitch: attrs.pitch ?? null,
          classes: (attrs.classes || []).filter((c) => c && c !== 'NotClassed'),
          talents: attrs.talents || [],
          expansion: product.expansion?.name || null,
        },
      };
    });
}

// --- Modifie recemment -------------------------------------------------------

const RECENT_PAGE = 100;

/**
 * Les lignes de la collection, de la plus recemment modifiee a la plus
 * ancienne. L'API ne dit pas ce qui a change, seulement quand : c'est le seul
 * historique qu'elle expose, et il couvre aussi ce qui est fait sur le site.
 */
export async function recentLines(offset = 0, progress = silent) {
  const res = await api('/inventory/search', {
    method: 'POST',
    body: { limit: RECENT_PAGE, offset, sortBy: 'lastModified', sortDirection: 'desc', gameFilters: FAB_ONLY },
  });
  const lines = res.data || [];
  progress.report(0.5);
  const products = await resolveProducts(lines.map((line) => line.productId), progress.sub(0.5, 1));

  return {
    total: res.pagination?.total ?? lines.length,
    hasMore: Boolean(res.pagination?.hasMore),
    next: offset + lines.length,
    lines: lines
      .filter((line) => products.has(line.productId))
      .map((line) => {
        const product = products.get(line.productId);
        const pitch = product.attributes?.pitch ?? null;
        return {
          ...describeLine(line, product),
          card: { name: cleanName(product.name), pitch, imageUrl: product.imageUrl || cardImageUrl(product.printNumber) },
        };
      }),
  };
}

// --- Suppression de cartes, retrait des tags --------------------------------

const UPDATE_BATCH = 200;

/** Applique des modifications par lots de 200 (plafond de bulk/update). */
async function bulkUpdate(items, progress = silent) {
  const results = [];
  for (let i = 0; i < items.length; i += UPDATE_BATCH) {
    progress.report(i / items.length, `${formatCount(i)} / ${formatCount(items.length)} lignes`);
    const batch = items.slice(i, i + UPDATE_BATCH);
    const res = await api('/inventory/bulk/update', {
      method: 'POST',
      body: { items: batch },
      idempotencyKey: uuid(),
    });
    for (const result of res.results || []) results.push({ ...result, item: batch[result.index] });
  }
  progress.report(1);
  return results;
}

/**
 * Supprime des cartes de la collection. `items` : [{ inventoryId, count, max }].
 * Une partie d'une ligne s'enleve en baissant sa quantite (par lots) ; une
 * ligne entiere se supprime (une requete par ligne : l'API n'a pas de
 * suppression en lot). C'est definitif ; une ligne en vente perd son annonce.
 */
export async function deleteCards(items, progress = silent) {
  if (!Array.isArray(items) || !items.length) throw new CardnexusError('Aucune carte a supprimer.', 400);

  const partial = items.filter((item) => item.count < item.max);
  const whole = items.filter((item) => item.count >= item.max);
  let removed = 0;
  const failed = [];

  // Une requete par lot de lignes entamees, puis une par ligne entiere.
  const steps = Math.ceil(partial.length / UPDATE_BATCH) + whole.length;
  const share = steps ? Math.ceil(partial.length / UPDATE_BATCH) / steps : 0;
  const adjusted = await bulkUpdate(
    partial.map(({ inventoryId, count }) => ({ inventoryId, quantity: { adjust: -count } })),
    progress.sub(0, share),
  );
  for (const result of adjusted) {
    const item = partial.find((p) => p.inventoryId === result.item.inventoryId);
    if (result.status === 'ok') removed += item.count;
    else failed.push({ ...item, reason: ERROR_LABELS[result.code] || result.code });
  }

  const deleting = progress.sub(share, 1);
  for (const [index, item] of whole.entries()) {
    deleting.report(index / whole.length, `${index} / ${whole.length} lignes supprimées`);
    try {
      await api(`/inventory/${encodeURIComponent(item.inventoryId)}`, { method: 'DELETE' });
      removed += item.count;
    } catch (err) {
      failed.push({ ...item, reason: err.message });
    }
  }

  forgetInventorySearches();
  return { removed, failed };
}

/** Retire tous les tags de ces lignes (elles restent ou elles sont). */
export async function clearTags(inventoryIds, progress = silent) {
  if (!Array.isArray(inventoryIds) || !inventoryIds.length) throw new CardnexusError('Aucune ligne.', 400);
  const results = await bulkUpdate(
    inventoryIds.map((inventoryId) => ({ inventoryId, tags: { set: [] } })),
    progress,
  );
  forgetInventorySearches();
  return {
    cleared: results.filter((r) => r.status === 'ok').length,
    failed: results.filter((r) => r.status !== 'ok').map((r) => ({ ...r.item, reason: ERROR_LABELS[r.code] || r.code })),
  };
}

/** Renomme un emplacement ; ses cartes restent en place. */
export async function renameLocation(from, to) {
  const name = String(to || '').trim();
  if (!name) throw new CardnexusError('Nouveau nom manquant.', 400);
  if (name.length > 100) throw new CardnexusError('Nom trop long (100 caracteres max).', 400);
  return api(`/inventory/locations/${encodeURIComponent(from)}`, { method: 'PATCH', body: { name } });
}

/**
 * Lignes d'autres jeux encore dans un emplacement : l'app ne les voit pas, mais
 * supprimer l'emplacement les laisserait sans emplacement.
 */
export async function otherGameLines(name) {
  const res = await api('/inventory/search', {
    method: 'POST',
    body: { location: { op: 'or', values: [name] }, limit: 1 },
  });
  const all = res.pagination?.total ?? 0;
  const fab = await api('/inventory/search', {
    method: 'POST',
    body: { location: { op: 'or', values: [name] }, gameFilters: FAB_ONLY, limit: 1 },
  });
  return Math.max(0, all - (fab.pagination?.total ?? 0));
}

/** Supprime un emplacement ; les cartes qui y restaient n'ont plus d'emplacement. */
export async function deleteLocation(name) {
  await api(`/inventory/locations/${encodeURIComponent(name)}`, { method: 'DELETE' });
  return { deleted: name };
}

/** Cree la location (ou la renvoie telle quelle si elle existe deja). */
export async function ensureLocation(name, { color = 'blue', icon = DECK_ICON } = {}) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new CardnexusError('Nom de location manquant.', 400);
  if (trimmed.length > 100) throw new CardnexusError('Nom de location trop long (100 max).', 400);

  return api('/inventory/locations', {
    method: 'POST',
    body: { name: trimmed, color, icon, upsert: true },
    idempotencyKey: uuid(),
  });
}

// --- Import d'une extension -----------------------------------------------

const EXPANSIONS_PAGE = 200;
const IMPORT_BATCH = 1000;

/** Raretés Flesh and Blood, dans l'ordre d'un booster : des communes aux plus rares. */
export const RARITIES = [
  { key: 'common', label: 'Common', code: 'C' },
  { key: 'rare', label: 'Rare', code: 'R' },
  { key: 'super rare', label: 'Super Rare', code: 'S' },
  { key: 'majestic', label: 'Majestic', code: 'M' },
  { key: 'legendary', label: 'Legendary', code: 'L' },
  { key: 'fabled', label: 'Fabled', code: 'F' },
  { key: 'marvel', label: 'Marvel', code: 'V' },
  { key: 'promo', label: 'Promo', code: 'P' },
  { key: 'basic', label: 'Basic', code: 'B' },
  { key: 'token', label: 'Token', code: 'T' },
];

// Ni les tokens ni les basiques ne sont des cartes de booster : on les met à part.
const APART = ['token', 'basic'];

/**
 * Rareté d'une carte du catalogue. Un token se reconnaît à son type, même
 * quand CardNexus lui donne la rareté « Common » ; un basique, à la rareté de
 * ses attributs quand elle diffère de celle du produit.
 */
export function cardRarity(product) {
  const attrs = product.attributes || {};
  if ((attrs.types || []).includes('Token')) return 'token';
  const keys = [attrs.rarity, product.rarity].map(rarityKey);
  return keys.find((key) => APART.includes(key)) || keys.find((key) => key !== 'other') || 'other';
}

/** « Super Rare », « super-rare », « S » : la même rareté, sous sa clé. */
export function rarityKey(value) {
  const text = String(value || '').trim().toLowerCase().replace(/[-_]/g, ' ');
  if (!text) return 'other';
  const found = RARITIES.find((r) => r.key === text || r.code.toLowerCase() === text);
  return found ? found.key : 'other';
}

/** Les extensions Flesh and Blood, des plus récentes aux plus anciennes. */
export async function listExpansions() {
  const all = [];
  for (let offset = 0; offset < 5000; offset += EXPANSIONS_PAGE) {
    const res = await api(`/games/${GAME}/expansions?limit=${EXPANSIONS_PAGE}&offset=${offset}`);
    all.push(...(res.data || []));
    if (!res.pagination?.hasMore) break;
  }
  return all.map(({ id, name, code, releaseDate, cardCount, languages }) => ({
    id,
    name,
    code: code || null,
    releaseDate: releaseDate || null,
    cardCount: cardCount ?? null,
    languages: languages || [],
  }));
}

/** Les cartes d'une extension, prêtes pour la page d'import. */
export async function expansionCards(expansionId, progress = silent) {
  const id = Number(expansionId);
  if (!Number.isInteger(id)) throw new CardnexusError('Extension invalide.', 400);

  const products = [];
  for (let offset = 0; offset < SEARCH_WINDOW; offset += PRODUCT_BATCH) {
    const res = await api('/products/search', {
      method: 'POST',
      body: {
        expansionId: [id],
        productType: { op: 'or', values: ['card'] },
        gameFilters: FAB_ONLY,
        limit: PRODUCT_BATCH,
        offset,
      },
    });
    products.push(...(res.data || []));
    const total = res.pagination?.total;
    if (total) progress.report(products.length / total, `${formatCount(products.length)} / ${formatCount(total)} cartes`);
    if (!res.pagination?.hasMore) break;
  }

  return products.map((product) => {
    productCache.set(product.id, product);
    const attrs = product.attributes || {};
    return {
      productId: product.id,
      name: cleanName(product.name),
      pitch: attrs.pitch ?? null,
      printNumber: product.printNumber || null,
      rarity: cardRarity(product),
      finishes: product.finishes?.length ? product.finishes : ['Standard'],
      languages: product.languages || [],
      imageUrl: product.imageUrl || cardImageUrl(product.printNumber),
      types: attrs.types || [],
    };
  });
}

const IMPORT_ERRORS = {
  PRODUCT_NOT_FOUND: 'carte introuvable au catalogue',
  INVALID_LANGUAGE: 'carte non imprimée dans cette langue',
  INVALID_FINISH: 'carte non imprimée dans cette finition',
  INVALID_QUANTITY: 'quantité invalide',
  CONDITION_REQUIRED: 'état manquant',
  LOCATION_NOT_FOUND: "cet emplacement n'existe pas",
};

/**
 * Ajoute des cartes à la collection. `lines` : [{ productId, finish, quantity }],
 * avec `language`, `condition` et `location` communs à toutes. Une carte déjà
 * présente à l'identique (même état, langue, finition) voit sa ligne grossir.
 *
 * Renvoie `added` (cartes ajoutées), `failed`, et `undo` : de quoi retirer
 * exactement ce qui a été ajouté — une ligne créée se supprime, une ligne
 * existante perd seulement les exemplaires ajoutés.
 */
export async function addCards({ lines, language = 'en', condition = 'NM', location = null }, progress = silent) {
  if (!Array.isArray(lines) || !lines.length) throw new CardnexusError('Aucune carte à ajouter.', 400);

  const requests = lines.map(({ productId, finish, quantity }) => {
    if (!Number.isInteger(quantity) || quantity < 1) throw new CardnexusError('Quantité invalide.', 400);
    return {
      // L'API attend un nombre ; l'interface les manipule souvent en texte.
      productId: /^\d+$/.test(String(productId)) ? Number(productId) : productId,
      finish: finish || 'Standard',
      condition,
      language,
      quantity,
      ...(location ? { location } : {}),
    };
  });

  let added = 0;
  const failed = [];
  const undo = [];
  for (let i = 0; i < requests.length; i += IMPORT_BATCH) {
    progress.report(i / requests.length, `${formatCount(i)} / ${formatCount(requests.length)} cartes envoyées`);
    const batch = requests.slice(i, i + IMPORT_BATCH);
    const res = await api('/inventory', { method: 'POST', body: { lines: batch }, idempotencyKey: uuid() });

    const rejected = new Map((res.errors || []).map((error) => [error.index, error.code]));
    for (const [index, code] of rejected) {
      failed.push({ ...batch[index], reason: IMPORT_ERRORS[code] || code });
    }
    // Chaque carte envoyée est unique (produit + finition) : on retrouve sa ligne.
    for (const line of res.created || []) {
      const sent = batch.find(
        (req, index) =>
          !rejected.has(index) && String(req.productId) === String(line.productId) && req.finish === line.finish,
      );
      if (!sent) continue;
      added += sent.quantity;
      undo.push({ inventoryId: line.id, count: sent.quantity, max: line.quantity, remove: true });
    }
  }
  progress.report(1);

  forgetInventorySearches();
  return { added, failed, undo };
}
