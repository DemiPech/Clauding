/**
 * Requetes HTTP sortantes.
 *
 * Dans l'app Android, elles passent par le pont natif (window.AndroidApp) :
 * pas de CORS, et les en-tetes Origin/Referer/User-Agent sont envoyes tels
 * quels. Hors de l'app (navigateur de bureau, pour le developpement), on se
 * rabat sur fetch, sans garantie que les API l'acceptent.
 */

const bridge = window.AndroidApp;
const pending = new Map();
let nextId = 0;

window.__androidHttpDone = (id, status, headersJson, body, error) => {
  const call = pending.get(id);
  if (!call) return;
  pending.delete(id);

  if (error) {
    call.reject(new Error(`Connexion impossible (${error}). Vérifiez votre accès internet.`));
    return;
  }

  let headers = {};
  try {
    headers = JSON.parse(headersJson || '{}');
  } catch {
    headers = {};
  }

  call.resolve({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[String(name).toLowerCase()] ?? null, all: headers },
    text: async () => body,
    json: async () => JSON.parse(body),
  });
};

/** Meme signature qu'un fetch minimal : { method, headers, body }. */
export function httpFetch(url, { method = 'GET', headers = {}, body } = {}) {
  if (!bridge) return fetch(url, { method, headers, body });

  return new Promise((resolve, reject) => {
    const id = String((nextId += 1));
    pending.set(id, { resolve, reject });
    const hasBody = body !== undefined && body !== null;
    bridge.request(id, method, url, JSON.stringify(headers), hasBody, hasBody ? String(body) : '');
  });
}

/** Les en-tetes d'un fetch (objet, tableau ou Headers) en objet simple. */
function plainHeaders(headers) {
  if (!headers) return {};
  if (typeof headers.forEach === 'function' && !Array.isArray(headers)) {
    const out = {};
    headers.forEach((value, name) => {
      out[name] = value;
    });
    return out;
  }
  return Object.fromEntries(Array.isArray(headers) ? headers : Object.entries(headers));
}

// Reponses sans corps, que le constructeur Response refuse d'en recevoir un.
const NO_BODY = new Set([101, 204, 205, 304]);

/**
 * Un vrai fetch, pour le SDK CardNexus : memes arguments, et une vraie
 * Response en retour. La requete passe par le pont natif comme les autres ;
 * l'annulation (delai depasse) est respectee cote JavaScript.
 */
export async function sdkFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input.url ?? String(input);
  const method = (init.method || 'GET').toUpperCase();
  // Un DELETE n'a pas de corps : la pile HTTP de certains Android le refuse.
  const body = method === 'DELETE' || method === 'GET' ? undefined : init.body ?? undefined;
  const { signal } = init;
  if (signal?.aborted) throw new DOMException('Requête annulée', 'AbortError');

  const request = httpFetch(url, { method, headers: plainHeaders(init.headers), body });
  const raw = await (signal
    ? new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Requête annulée', 'AbortError')), { once: true });
        request.then(resolve, reject);
      })
    : request);
  if (raw instanceof Response) return raw;

  const text = await raw.text();
  const headers = new Headers();
  for (const [name, value] of Object.entries(raw.headers.all || {})) {
    try {
      headers.set(name, value);
    } catch {
      // Un en-tete que le navigateur refuse : le SDK n'en a pas besoin.
    }
  }
  return new Response(NO_BODY.has(raw.status) ? null : text, { status: raw.status, headers });
}

/** crypto.randomUUID, avec repli pour les WebView anciennes. */
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
