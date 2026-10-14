/**
 * Stockage clé → valeur dans IndexedDB, pour ce qui dépasse localStorage
 * (quelques Mo au plus) : le catalogue des cartes à compléter, le dernier
 * recensement. Sans IndexedDB (navigation privée…), on garde en mémoire le
 * temps de la session.
 */
const DB_NAME = 'fab-decks';
const STORE = 'kv';
const memory = new Map();
let opening = null;

function open() {
  if (!opening) {
    opening = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return opening;
}

function run(mode, action) {
  return open().then(
    (db) =>
      db &&
      new Promise((resolve, reject) => {
        const request = action(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/** La valeur gardée, ou null. */
export async function storeGet(key) {
  try {
    const db = await open();
    if (!db) return memory.get(key) ?? null;
    return (await run('readonly', (store) => store.get(key))) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export async function storeSet(key, value) {
  memory.set(key, value);
  try {
    if (!(await open())) return;
    await run('readwrite', (store) => store.put(value, key));
    memory.delete(key);
  } catch {
    // Stockage plein ou refusé : la valeur reste en mémoire pour la session.
  }
}

export async function storeDelete(key) {
  memory.delete(key);
  try {
    await run('readwrite', (store) => store.delete(key));
  } catch {
    // Rien à effacer.
  }
}
