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
    headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
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

/** crypto.randomUUID, avec repli pour les WebView anciennes. */
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
