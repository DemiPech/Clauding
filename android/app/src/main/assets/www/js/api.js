/**
 * Remplace server.js dans l'app Android.
 *
 * L'interface appelle toujours les memes routes `/api/...` : on intercepte ces
 * appels a fetch et on y repond localement, avec les memes handlers et le meme
 * cache que le serveur de bureau. app.js reste ainsi quasi identique a la
 * version PC. Tout autre fetch part normalement.
 */
import { fetchDeck, parseDeckId, FabraryError } from './fabrary.js';
import {
  listDeckLocations,
  listLocations,
  fetchDeckFromLocation,
  searchInventoryLines,
  moveLines,
  planDeckBuild,
  ensureLocation,
  isConfigured as cardnexusConfigured,
  CardnexusError,
} from './cardnexus.js';

// Un deck change rarement : on evite de retaper les API a chaque affichage.
const CACHE_TTL_MS = 5 * 60 * 1000;
const deckCache = new Map();

/** Sert depuis le cache, sinon appelle `load` et memorise le resultat. */
async function cached(key, load) {
  const hit = deckCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const value = await load();
  deckCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/**
 * Apres un deplacement, le contenu des locations touchees a change. On ne sait
 * pas d'ou partait chaque ligne, donc on vide tous les decks CardNexus plutot
 * que de servir un etat perime.
 */
function invalidateCardnexusDecks() {
  for (const key of deckCache.keys()) {
    if (key.startsWith('cardnexus:deck:')) deckCache.delete(key);
  }
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

/** Renvoie le resultat de `load`, en traduisant les erreurs connues en JSON. */
async function respond(load, fallback) {
  try {
    return json(200, await load());
  } catch (err) {
    if (err instanceof FabraryError || err instanceof CardnexusError) {
      return json(err.status || 502, { error: err.message });
    }
    console.error('[api]', err);
    return json(502, { error: err?.message ? `${fallback} (${err.message})` : fallback });
  }
}

function readJsonBody(init) {
  const raw = init?.body;
  if (!raw) return {};
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

function handleFabraryDeck(rawId) {
  const deckId = parseDeckId(rawId);
  if (!deckId) {
    return json(400, {
      error: 'Identifiant de deck invalide. Collez une URL fabrary.net/decks/... ou un ID.',
    });
  }
  return respond(
    () => cached(`fabrary:${deckId}`, () => fetchDeck(deckId)),
    'Impossible de contacter FaBrary pour le moment.',
  );
}

function handleCardnexusDeck(locationName) {
  if (!locationName) return json(400, { error: 'Nom de location manquant.' });
  return respond(
    () => cached(`cardnexus:deck:${locationName}`, () => fetchDeckFromLocation(locationName)),
    'Impossible de contacter CardNexus pour le moment.',
  );
}

/**
 * Transforme une liste FaBrary en liste de cartes voulues. Le heros, les armes
 * et l'equipement font partie du deck physique ; la reserve est optionnelle.
 */
function wantedFromDeck(deck, { includeSideboard }) {
  const hero = deck.hero
    ? [{ name: deck.hero.name, pitch: null, quantity: 1, types: ['Hero'], imageUrl: deck.hero.imageUrl }]
    : [];

  return [...hero, ...deck.weapons, ...deck.equipment, ...deck.deck, ...(includeSideboard ? deck.sideboard : [])]
    .map((card) => ({
      name: card.name,
      pitch: card.pitch ?? null,
      quantity: card.quantity,
      types: card.types || [],
      imageUrl: card.imageUrl || null,
    }));
}

/** Calcule le plan de montage d'une liste FaBrary vers une location. */
function handlePlan(body) {
  const deckId = parseDeckId(body.deckId);
  if (!deckId) return json(400, { error: 'Identifiant de deck FaBrary invalide.' });
  if (!body.destination) return json(400, { error: 'Destination manquante.' });

  return respond(async () => {
    const deck = await cached(`fabrary:${deckId}`, () => fetchDeck(deckId));
    const wanted = wantedFromDeck(deck, { includeSideboard: Boolean(body.includeSideboard) });
    const plan = await planDeckBuild(wanted, body.destination, {
      existing: Boolean(body.existing),
      protectDecks: body.protectDecks !== false,
    });
    return { ...plan, deck: { name: deck.name, hero: deck.hero?.name || null, format: deck.format } };
  }, 'Impossible de calculer le plan pour le moment.');
}

/** Cree (ou retrouve) une location de deck. */
function handleCreateLocation(body) {
  return respond(async () => {
    const location = await ensureLocation(body.name, { color: body.color || 'blue' });
    deckCache.delete('cardnexus:locations');
    deckCache.delete('cardnexus:locations:all');
    return location;
  }, 'Impossible de creer la location pour le moment.');
}

/** Applique un lot de deplacements, puis invalide les decks en cache. */
function handleMove(body) {
  const { moves, destination } = body;
  if (destination !== null && typeof destination !== 'string') {
    return json(400, { error: 'Destination manquante (nom de location, ou null).' });
  }

  return respond(async () => {
    const result = await moveLines(moves, destination);
    if (result.applied.length) invalidateCardnexusDecks();
    return result;
  }, "Impossible d'appliquer les deplacements pour le moment.");
}

const WRITE_ROUTES = {
  '/api/cardnexus/move': handleMove,
  '/api/cardnexus/plan': handlePlan,
  '/api/cardnexus/locations/create': handleCreateLocation,
};

async function route(url, init = {}) {
  const method = (init.method || 'GET').toUpperCase();
  const params = url.searchParams;

  const writeRoute = WRITE_ROUTES[url.pathname];
  if (writeRoute) {
    if (method !== 'POST') return json(405, { error: 'Methode non autorisee' });
    let body;
    try {
      body = readJsonBody(init);
    } catch {
      return json(400, { error: 'Corps de requete JSON invalide.' });
    }
    return writeRoute(body);
  }

  if (method !== 'GET') return json(405, { error: 'Methode non autorisee' });

  switch (url.pathname) {
    case '/api/cardnexus/locations':
      return respond(
        () => cached('cardnexus:locations:all', listLocations),
        'Impossible de contacter CardNexus pour le moment.',
      );

    case '/api/cardnexus/search':
      return respond(
        () => searchInventoryLines(params.get('q')),
        'Impossible de contacter CardNexus pour le moment.',
      );

    case '/api/deck':
      return handleFabraryDeck(params.get('id') || params.get('url'));

    case '/api/cardnexus/decks':
      if (!cardnexusConfigured()) return json(200, { configured: false, decks: [] });
      return respond(
        async () => ({ configured: true, decks: await cached('cardnexus:locations', listDeckLocations) }),
        'Impossible de contacter CardNexus pour le moment.',
      );

    case '/api/cardnexus/deck':
      return handleCardnexusDeck(params.get('location'));

    default:
      return json(404, { error: 'Route inconnue' });
  }
}

// --- Interception de fetch -------------------------------------------------

const nativeFetch = window.fetch.bind(window);

window.fetch = (input, init) => {
  const raw = typeof input === 'string' ? input : input?.url;
  if (typeof raw === 'string' && raw.startsWith('/api/')) {
    return route(new URL(raw, 'https://app.local'), init);
  }
  return nativeFetch(input, init);
};
