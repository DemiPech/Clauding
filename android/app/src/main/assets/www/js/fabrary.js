/**
 * Client FaBrary.
 *
 * FaBrary est une SPA qui parle a une API AppSync. Les decks publics sont lus
 * en invite : on echange une identite anonyme aupres du Cognito Identity Pool
 * public de l'app contre des credentials temporaires, puis on signe l'appel
 * GraphQL en SigV4. Le WAF devant l'API rejette les requetes qui ne
 * ressemblent pas a un navigateur, d'ou les en-tetes Origin/Referer/UA.
 *
 * Portage navigateur de lib/fabrary.js : la signature utilise WebCrypto (donc
 * asynchrone) au lieu du module crypto de Node.
 */
import { silent } from './progress.js';
import { httpFetch } from './http.js';

const CONTENT_BASE = 'https://content.fabrary.net';
const SITE = 'https://fabrary.net/';

/**
 * Configuration AWS de FaBrary : pool d'identites invite et API AppSync.
 * FaBrary peut en changer (nouveau pool, nouvelle API) : on la relit alors
 * dans le code du site (`discoverConfig`) et on la garde sur le telephone.
 */
const DEFAULT_CONFIG = {
  region: 'us-east-2',
  identityPoolId: 'us-east-2:e50f3ed7-32ed-4b22-a05e-10b3e7e03fe0',
  endpoint: 'https://42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com/graphql',
};
const CONFIG_STORAGE = 'fabrary_config';

function readStoredConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(CONFIG_STORAGE));
    return stored?.identityPoolId && stored?.endpoint ? { ...DEFAULT_CONFIG, ...stored } : null;
  } catch {
    return null;
  }
}

let config = readStoredConfig() || DEFAULT_CONFIG;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  Origin: 'https://fabrary.net',
  Referer: 'https://fabrary.net/',
  Accept: '*/*',
};

// --- Credentials invite (mises en cache jusqu'a expiration) ---------------

let cachedCredentials = null;

/** Une erreur AWS, avec son type (« ResourceNotFoundException »…). */
class AwsError extends Error {
  constructor(message, type) {
    super(message);
    this.awsType = type || null;
  }
}

async function cognitoCall(target, body) {
  const region = config.identityPoolId.split(':')[0] || config.region;
  const res = await httpFetch(`https://cognito-identity.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityService.${target}`,
      ...BROWSER_HEADERS,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let type = null;
    try {
      type = String(JSON.parse(text).__type || '').split('#').pop() || null;
    } catch {
      type = null;
    }
    throw new AwsError(`Cognito ${target} a repondu ${res.status}: ${text}`, type);
  }
  return JSON.parse(text);
}

async function getGuestCredentials() {
  // On renouvelle 2 minutes avant l'expiration pour eviter les 403 en vol.
  if (cachedCredentials && cachedCredentials.expiresAt - 120_000 > Date.now()) {
    return cachedCredentials.value;
  }
  const { IdentityId } = await cognitoCall('GetId', { IdentityPoolId: config.identityPoolId });
  const { Credentials } = await cognitoCall('GetCredentialsForIdentity', { IdentityId });
  cachedCredentials = {
    value: Credentials,
    expiresAt: Credentials.Expiration * 1000,
  };
  return Credentials;
}

// --- Signature SigV4 -------------------------------------------------------

const encoder = new TextEncoder();
const bytes = (data) => (typeof data === 'string' ? encoder.encode(data) : data);
const toHex = (buffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmac(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    bytes(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, bytes(data)));
}

const sha256Hex = async (data) => toHex(await crypto.subtle.digest('SHA-256', bytes(data)));

async function signRequest({ credentials, url, payload }) {
  const parsed = new URL(url);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const headers = {
    'content-type': 'application/json; charset=UTF-8',
    host: parsed.host,
    'x-amz-date': amzDate,
    'x-amz-security-token': credentials.SessionToken,
  };
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(';');
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join('');
  const canonicalRequest = [
    'POST',
    parsed.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    await sha256Hex(payload),
  ].join('\n');

  const region = parsed.host.match(/\.appsync-api\.([a-z0-9-]+)\.amazonaws\.com$/)?.[1] || config.region;
  const scope = `${dateStamp}/${region}/appsync/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');

  let key = await hmac(`AWS4${credentials.SecretKey}`, dateStamp);
  key = await hmac(key, region);
  key = await hmac(key, 'appsync');
  key = await hmac(key, 'aws4_request');
  const signature = toHex(await hmac(key, stringToSign));

  return {
    ...headers,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${credentials.AccessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

// --- Requete ---------------------------------------------------------------

const GET_DECK_QUERY = `
  query getDeck($deckId: ID!) {
    getDeck(deckId: $deckId) {
      deckId
      name
      format
      notes
      tags
      tournament
      createdAt
      updatedAt
      proxyAuthor
      author {
        userId
        publicProfile { isPrivate nickname }
      }
      heroIdentifier
      hero {
        cardIdentifier
        name
        defaultImage
        intellect
        life
        types
        classes
        talents
        typeText
        functionalText
      }
      deckCards {
        cardIdentifier
        quantity
        sideboardQuantity
        printOverride
        card {
          cardIdentifier
          name
          defaultImage
          pitch
          cost
          power
          defense
          life
          intellect
          types
          subtypes
          talents
          classes
          keywords
          rarity
          typeText
          functionalText
        }
      }
    }
  }
`;

export class FabraryError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'FabraryError';
    this.status = status;
  }
}

/** Extrait l'ID d'un deck depuis une URL FaBrary, ou renvoie l'entree si c'est deja un ID. */
export function parseDeckId(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const fromUrl = raw.match(/fabrary\.net\/decks\/([A-Za-z0-9_-]+)/i);
  if (fromUrl) return fromUrl[1];
  if (/^[A-Za-z0-9_-]{6,64}$/.test(raw)) return raw;
  return null;
}

export const cardImageUrl = (image) => (image ? `${CONTENT_BASE}/cards/${image}.webp` : null);

// --- Configuration relue sur le site ----------------------------------------

/**
 * Le pool d'identites et l'API AppSync cites dans un texte (le code du site) :
 * { identityPoolId, endpoint, region }, chaque champ pouvant manquer.
 */
export function findFabraryConfig(text) {
  const source = String(text);
  const pool = source.match(/["'`]([a-z]{2}(?:-[a-z]+)+-\d:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})["'`]/);
  const api = source.match(/https:\/\/[a-z0-9]+\.appsync-api\.([a-z0-9-]+)\.amazonaws\.com\/graphql/);
  return {
    identityPoolId: pool?.[1] || null,
    endpoint: api?.[0] || null,
    region: api?.[1] || pool?.[1]?.split(':')[0] || null,
  };
}

const MAX_SCRIPTS = 25;

/** Les scripts d'une page ou d'un script : <script src>, modulepreload, imports de morceaux. */
function scriptUrls(text, base) {
  const urls = new Set();
  const patterns = [
    /<script\b[^>]*\bsrc=["']([^"']+)["']/gi,
    /<link\b[^>]*\bhref=["']([^"']+\.js)["']/gi,
    /["'`]((?:\.{0,2}\/)?(?:assets|static\/js|_next\/static|js)\/[^"'`\s]+\.js)["'`]/gi,
    // Imports relatifs entre morceaux : import("./config-c3d4.js").
    /["'`](\.{1,2}\/[^"'`\s]+\.js)["'`]/gi,
  ];
  for (const pattern of patterns) {
    for (const [, src] of String(text).matchAll(pattern)) {
      try {
        const url = new URL(src, base);
        if (url.hostname.endsWith('fabrary.net')) urls.add(url.href);
      } catch {
        // Adresse illisible : ignoree.
      }
    }
  }
  return [...urls];
}

/**
 * Relit la configuration dans le code de fabrary.net : la page, puis ses
 * scripts (et les morceaux qu'ils chargent), jusqu'a trouver le pool
 * d'identites. Rend true si elle a change.
 */
async function discoverConfig(progress = silent) {
  progress.detail?.('FaBrary a changé de configuration : relecture du site');
  const read = async (url) => {
    const res = await httpFetch(url, { method: 'GET', headers: { ...BROWSER_HEADERS, Accept: 'text/html,*/*' } });
    return res.ok ? res.text() : '';
  };
  const found = { identityPoolId: null, endpoint: null, region: null };
  const merge = (text) => {
    const hit = findFabraryConfig(text);
    for (const key of Object.keys(found)) found[key] ||= hit[key];
  };
  const page = await read(SITE);
  merge(page);
  const queue = scriptUrls(page, SITE);
  const seen = new Set(queue);
  for (let i = 0; i < queue.length && i < MAX_SCRIPTS && !(found.identityPoolId && found.endpoint); i += 1) {
    const text = await read(queue[i]);
    merge(text);
    for (const url of scriptUrls(text, queue[i])) {
      if (!seen.has(url)) {
        seen.add(url);
        queue.push(url);
      }
    }
  }
  if (!found.identityPoolId) return false;

  const next = {
    region: found.region || config.region,
    identityPoolId: found.identityPoolId,
    endpoint: found.endpoint || config.endpoint,
  };
  if (next.identityPoolId === config.identityPoolId && next.endpoint === config.endpoint) return false;
  config = next;
  cachedCredentials = null;
  try {
    localStorage.setItem(CONFIG_STORAGE, JSON.stringify({ ...next, at: new Date().toISOString() }));
  } catch {
    // Pas de stockage : elle sera relue au prochain demarrage.
  }
  return true;
}

/** Les erreurs qui signalent une configuration perimee (pool ou API disparus). */
const STALE_TYPES = ['ResourceNotFoundException', 'InvalidIdentityPoolConfigurationException'];
const isStaleConfig = (err) =>
  STALE_TYPES.includes(err?.awsType) || err?.staleEndpoint === true;

let discovering = null;

/** `run()`, et une seconde fois apres relecture de la configuration si elle etait perimee. */
async function withFreshConfig(run, progress) {
  try {
    return await run();
  } catch (err) {
    if (!isStaleConfig(err)) throw err;
    discovering ||= discoverConfig(progress).finally(() => {
      discovering = null;
    });
    let changed = false;
    try {
      changed = await discovering;
    } catch {
      changed = false;
    }
    if (!changed) {
      throw new FabraryError(
        "FaBrary a changé sa configuration et l'app n'a pas su la retrouver sur fabrary.net. " +
          `(${err.message})`,
        502,
      );
    }
    return run();
  }
}

/**
 * `partial` : une requete groupee (plusieurs cartes). On rend alors { data,
 * errors } tels quels, pour que l'appelant sache quelles cartes ont echoue ;
 * on ne leve d'erreur que si aucune erreur ne designe une carte.
 */
function graphql(query, variables, progress = silent, options = {}) {
  return withFreshConfig(() => graphqlOnce(query, variables, progress, options), progress);
}

async function graphqlOnce(query, variables, progress = silent, { partial = false } = {}) {
  progress.report(0.05, 'Connexion à FaBrary');
  const credentials = await getGuestCredentials();
  progress.report(0.4, partial ? 'Lecture des cartes' : 'Lecture de la liste');
  const payload = JSON.stringify({ query, variables });
  const endpoint = config.endpoint;
  const res = await httpFetch(endpoint, {
    method: 'POST',
    headers: { ...(await signRequest({ credentials, url: endpoint, payload })), ...BROWSER_HEADERS },
    body: payload,
  });
  // L'API n'existe plus a cette adresse.
  if (res.status === 404) {
    throw Object.assign(new FabraryError(`L'API FaBrary a répondu 404.`, 502), { staleEndpoint: true });
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new FabraryError(`Reponse illisible de FaBrary (HTTP ${res.status})`, 502);
  }

  if (partial && (json.data || json.errors?.some((error) => error.path?.length))) {
    return { data: json.data || null, errors: json.errors || [] };
  }
  if (json.errors?.length) {
    const first = json.errors[0];
    // Les credentials invite ont pu etre invalidees cote AWS : on purge le cache.
    if (res.status === 403) cachedCredentials = null;
    const mapped = {
      'Not found': ["Ce deck n'existe pas (ou a ete supprime).", 404],
      Private: ['Ce deck est prive sur FaBrary.', 403],
      Unauthorized: ["Ce deck n'est pas accessible publiquement.", 403],
    }[first.message];
    if (mapped) throw new FabraryError(mapped[0], mapped[1]);
    // AppSync repond la meme chose pour un deck absent et pour un deck prive.
    if (/not authorized/i.test(first.message || '')) {
      throw new FabraryError('Deck introuvable, ou non partage publiquement sur FaBrary.', 404);
    }
    if (first.errorType === 'WAFForbiddenException') {
      throw new FabraryError('FaBrary a refuse la requete (protection anti-bot). Reessayez dans un instant.', 503);
    }
    throw new FabraryError(first.message || 'Erreur FaBrary', 502);
  }
  return json.data;
}

// --- Normalisation ---------------------------------------------------------

const PITCH_NAMES = { 1: 'Red', 2: 'Yellow', 3: 'Blue' };

function normalizeCard(entry, quantity) {
  const card = entry.card || {};
  const image = entry.printOverride || card.defaultImage;
  return {
    id: entry.cardIdentifier,
    name: card.name || entry.cardIdentifier,
    quantity,
    image,
    imageUrl: cardImageUrl(image),
    pitch: card.pitch ?? null,
    pitchName: card.pitch ? PITCH_NAMES[card.pitch] : null,
    cost: card.cost ?? null,
    power: card.power ?? null,
    defense: card.defense ?? null,
    types: card.types || [],
    subtypes: card.subtypes || [],
    talents: card.talents || [],
    classes: card.classes || [],
    keywords: card.keywords || [],
    rarity: card.rarity || null,
    typeText: card.typeText || '',
    text: card.functionalText || '',
  };
}

/** Range une carte dans sa zone : arme, equipement, ou deck principal. */
function zoneOf(card) {
  const types = card?.types || [];
  if (types.includes('Weapon')) return 'weapons';
  if (types.includes('Equipment')) return 'equipment';
  return 'deck';
}

const byNameThenPitch = (a, b) => a.name.localeCompare(b.name) || (a.pitch ?? 0) - (b.pitch ?? 0);

export async function fetchDeck(deckId, progress = silent) {
  const data = await graphql(GET_DECK_QUERY, { deckId }, progress);
  progress.report(1);
  const deck = data?.getDeck;
  if (!deck) throw new FabraryError("Ce deck n'existe pas (ou a ete supprime).", 404);

  const weapons = [];
  const equipment = [];
  const main = [];
  const sideboard = [];

  for (const entry of deck.deckCards || []) {
    const zone = zoneOf(entry.card);
    if (entry.quantity > 0) {
      const card = normalizeCard(entry, entry.quantity);
      (zone === 'weapons' ? weapons : zone === 'equipment' ? equipment : main).push(card);
    }
    if (entry.sideboardQuantity > 0) {
      sideboard.push(normalizeCard(entry, entry.sideboardQuantity));
    }
  }

  [weapons, equipment, main, sideboard].forEach((list) => list.sort(byNameThenPitch));

  const hero = deck.hero
    ? {
        id: deck.hero.cardIdentifier,
        name: deck.hero.name,
        image: deck.hero.defaultImage,
        imageUrl: cardImageUrl(deck.hero.defaultImage),
        intellect: deck.hero.intellect ?? null,
        life: deck.hero.life ?? null,
        classes: deck.hero.classes || [],
        talents: deck.hero.talents || [],
        typeText: deck.hero.typeText || '',
        text: deck.hero.functionalText || '',
      }
    : null;

  const total = (list) => list.reduce((sum, c) => sum + c.quantity, 0);
  const profile = deck.author?.publicProfile;

  return {
    source: 'fabrary',
    deckId: deck.deckId,
    url: `https://fabrary.net/decks/${deck.deckId}`,
    name: deck.name || 'Deck sans nom',
    format: deck.format || null,
    notes: deck.notes || null,
    tags: deck.tags || [],
    tournament: deck.tournament || null,
    createdAt: deck.createdAt || null,
    updatedAt: deck.updatedAt || null,
    author: deck.proxyAuthor || (profile && !profile.isPrivate ? profile.nickname : null),
    hero,
    weapons,
    equipment,
    deck: main,
    sideboard,
    counts: {
      deck: total(main),
      weapons: total(weapons),
      equipment: total(equipment),
      sideboard: total(sideboard),
      unique: main.length,
    },
  };
}

// --- Classes et talents des cartes ------------------------------------------

/** Couleur de pitch dans les identifiants FaBrary : « buckwild-red ». */
const PITCH_COLORS = { 1: 'red', 2: 'yellow', 3: 'blue' };

/** Identifiant FaBrary d'une carte, d'apres son nom et son pitch. */
export function fabraryIdentifier(name, pitch) {
  const slug = String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return PITCH_COLORS[pitch] ? `${slug}-${PITCH_COLORS[pitch]}` : slug;
}

const CARDS_PER_QUERY = 40;

/** « NECROMANCER », « necromancer » → « Necromancer ». */
const titleCase = (word) =>
  String(word)
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, sep, letter) => sep + letter.toUpperCase());

/**
 * Fiches de ces cartes selon FaBrary : { identifiant: fiche }, ou null pour une
 * carte que FaBrary ne connait pas. Les cartes sont demandees par groupes, une
 * requete GraphQL par groupe (alias c0, c1…). `fields` : les champs voulus.
 */
async function fetchCards(identifiers, fields, progress = silent) {
  const ids = [...new Set(identifiers)];
  const found = {};
  for (let i = 0; i < ids.length; i += CARDS_PER_QUERY) {
    const step = progress.sub(i / ids.length, Math.min(ids.length, i + CARDS_PER_QUERY) / ids.length);
    let batch = ids.slice(i, i + CARDS_PER_QUERY);
    // getCard ne peut pas rendre « rien » : une seule carte inconnue fait
    // echouer tout le lot (data: null). L'erreur designe la carte (path) : on
    // la note inconnue, et on redemande le reste du lot.
    for (let attempt = 0; batch.length && attempt <= CARDS_PER_QUERY; attempt += 1) {
      const variables = Object.fromEntries(batch.map((id, n) => [`c${n}`, id]));
      const query = `query cards(${batch.map((_, n) => `$c${n}: ID!`).join(', ')}) {
${batch.map((_, n) => `  c${n}: getCard(cardIdentifier: $c${n}) { ${fields} }`).join('\n')}
}`;
      const { data, errors } = await graphql(query, variables, step, { partial: true });
      const failed = new Set(
        errors.map((error) => error.path?.[0]).filter((alias) => typeof alias === 'string' && /^c\d+$/.test(alias)),
      );
      if (data) {
        batch.forEach((id, n) => {
          found[id] = data[`c${n}`] || null;
        });
        break;
      }
      if (!failed.size) throw new FabraryError('FaBrary n’a pas répondu pour ces cartes.', 502);
      const retry = [];
      batch.forEach((id, n) => {
        if (failed.has(`c${n}`)) found[id] = null;
        else retry.push(id);
      });
      batch = retry;
    }
    step.report(1);
  }
  return found;
}

/**
 * Classes et talents de ces cartes selon FaBrary : { identifiant: { classes,
 * talents } }, ou null pour une carte que FaBrary ne connait pas.
 */
export async function fetchCardClasses(identifiers, progress = silent) {
  const cards = await fetchCards(identifiers, 'cardIdentifier classes talents', progress);
  return Object.fromEntries(
    Object.entries(cards).map(([id, card]) => [
      id,
      card
        ? {
            classes: (card.classes || []).map(titleCase).filter((c) => c !== 'Notclassed'),
            talents: (card.talents || []).map(titleCase),
          }
        : null,
    ]),
  );
}

const CARD_FIELDS = `cardIdentifier name defaultImage pitch cost power defense life intellect
  types subtypes talents classes keywords rarity typeText functionalText`;

/**
 * Une liste donnee par noms de cartes (decklist d'un autre site), completee par
 * FaBrary : `entries` = [{ name, pitch, quantity }]. Rend le deck dans la meme
 * forme que fetchDeck ; une carte inconnue de FaBrary garde son seul nom.
 */
export async function deckFromNames(entries, { heroName = null } = {}, progress = silent) {
  const ids = entries.map((entry) => fabraryIdentifier(entry.name, entry.pitch));
  const cards = await fetchCards(ids, CARD_FIELDS, progress);

  let hero = null;
  const weapons = [];
  const equipment = [];
  const main = [];
  entries.forEach((entry, index) => {
    const id = ids[index];
    const card = cards[id] || { cardIdentifier: id, name: entry.name, pitch: entry.pitch ?? null, types: [] };
    const isHero = (card.types || []).includes('Hero') || (heroName && sameName(entry.name, heroName));
    if (isHero && !hero) {
      hero = {
        id,
        name: card.name,
        image: card.defaultImage || null,
        imageUrl: cardImageUrl(card.defaultImage) || entry.imageUrl || null,
        intellect: card.intellect ?? null,
        life: card.life ?? null,
        classes: card.classes || [],
        talents: card.talents || [],
        typeText: card.typeText || '',
        text: card.functionalText || '',
      };
      return;
    }
    const normalized = normalizeCard({ cardIdentifier: id, card }, entry.quantity);
    // L'image de la page d'origine, quand FaBrary n'en a pas.
    if (!normalized.imageUrl && entry.imageUrl) normalized.imageUrl = entry.imageUrl;
    const zone = zoneOf(card);
    (zone === 'weapons' ? weapons : zone === 'equipment' ? equipment : main).push(normalized);
  });

  [weapons, equipment, main].forEach((list) => list.sort(byNameThenPitch));
  const total = (list) => list.reduce((sum, c) => sum + c.quantity, 0);
  return {
    hero,
    weapons,
    equipment,
    deck: main,
    sideboard: [],
    counts: { deck: total(main), weapons: total(weapons), equipment: total(equipment), sideboard: 0, unique: main.length },
    unknown: entries.filter((_, index) => !cards[ids[index]]).map((entry) => entry.name),
  };
}

const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
