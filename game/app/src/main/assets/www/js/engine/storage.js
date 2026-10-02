/**
 * Sauvegarde en localStorage (meilleur score, reglages, progression).
 * Chaque cle est prefixee ; une valeur illisible ou un stockage indisponible
 * renvoie la valeur par defaut au lieu de planter.
 */
export function createStore(prefix, storage = globalThis.localStorage) {
  return {
    get(key, fallback) {
      try {
        const raw = storage.getItem(prefix + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        storage.setItem(prefix + key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        storage.removeItem(prefix + key);
      } catch {
        // Rien a faire.
      }
    },
  };
}
