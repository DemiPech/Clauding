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

const REGION = 'us-east-2';
const IDENTITY_POOL_ID = 'us-east-2:e50f3ed7-32ed-4b22-a05e-10b3e7e03fe0';
const GRAPHQL_ENDPOINT = `https://42xrd23ihbd47fjvsrt27ufpfe.appsync-api.${REGION}.amazonaws.com/graphql`;
const CONTENT_BASE = 'https://content.fabrary.net';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  Origin: 'https://fabrary.net',
  Referer: 'https://fabrary.net/',
  Accept: '*/*',
};

// --- Credentials invite (mises en cache jusqu'a expiration) ---------------

let cachedCredentials = null;

async function cognitoCall(target, body) {
  const res = await httpFetch(`https://cognito-identity.${REGION}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityService.${target}`,
      ...BROWSER_HEADERS,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Cognito ${target} a repondu ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function getGuestCredentials() {
  // On renouvelle 2 minutes avant l'expiration pour eviter les 403 en vol.
  if (cachedCredentials && cachedCredentials.expiresAt - 120_000 > Date.now()) {
    return cachedCredentials.value;
  }
  const { IdentityId } = await cognitoCall('GetId', { IdentityPoolId: IDENTITY_POOL_ID });
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

  const scope = `${dateStamp}/${REGION}/appsync/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');

  let key = await hmac(`AWS4${credentials.SecretKey}`, dateStamp);
  key = await hmac(key, REGION);
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

/**
 * `partial` : une requete groupee (plusieurs cartes) rend ce qu'elle a trouve
 * meme si certaines cartes n'existent pas ; on ne leve d'erreur que sans donnees.
 */
async function graphql(query, variables, progress = silent, { partial = false } = {}) {
  progress.report(0.05, 'Connexion à FaBrary');
  const credentials = await getGuestCredentials();
  progress.report(0.4, partial ? 'Lecture des cartes' : 'Lecture de la liste');
  const payload = JSON.stringify({ query, variables });
  const res = await httpFetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { ...(await signRequest({ credentials, url: GRAPHQL_ENDPOINT, payload })), ...BROWSER_HEADERS },
    body: payload,
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw new FabraryError(`Reponse illisible de FaBrary (HTTP ${res.status})`, 502);
  }

  if (json.errors?.length && !(partial && json.data)) {
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
    const batch = ids.slice(i, i + CARDS_PER_QUERY);
    const variables = Object.fromEntries(batch.map((id, n) => [`c${n}`, id]));
    const query = `query cards(${batch.map((_, n) => `$c${n}: ID!`).join(', ')}) {
${batch.map((_, n) => `  c${n}: getCard(cardIdentifier: $c${n}) { ${fields} }`).join('\n')}
}`;
    const step = progress.sub(i / ids.length, (i + batch.length) / ids.length);
    const data = await graphql(query, variables, step, { partial: true });
    // Sans donnees du tout (erreur du serveur), ce n'est pas « carte inconnue ».
    if (!data) throw new FabraryError('FaBrary n’a pas répondu pour ces cartes.', 502);
    batch.forEach((id, n) => {
      found[id] = data[`c${n}`] || null;
    });
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
        imageUrl: cardImageUrl(card.defaultImage),
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
