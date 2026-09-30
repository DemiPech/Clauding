/**
 * Photos de la collection et différences entre deux photos.
 *
 * L'API ne garde aucune trace d'une ligne supprimée et ne donne pas la
 * quantité d'avant une modification. On compense en photographiant la
 * collection de temps en temps : combien d'exemplaires de chaque carte, dans
 * chaque état, à chaque endroit. Comparer deux photos dit ce qui est arrivé,
 * parti, ou a changé d'endroit entre les deux — y compris ce qui a été fait
 * sur le site ou vendu.
 *
 * On compte par carte (produit + finition + état + langue) et par endroit,
 * pas par ligne d'inventaire : un déplacement partiel coupe une ligne en deux
 * et une arrivée peut fusionner avec une ligne identique, donc les
 * identifiants de ligne changent sans que la collection change.
 */

const SEP = '|';

/** Clé d'une photo : la carte exacte, puis l'endroit (vide = sans emplacement). */
export const snapshotKey = (line) =>
  [line.productId, line.finish, line.condition ?? '', line.language ?? '', line.location ?? ''].join(SEP);

/** Photo à partir des lignes d'inventaire : { clé → quantité }. */
export function countLines(lines) {
  const counts = {};
  for (const line of lines) {
    const key = snapshotKey(line);
    counts[key] = (counts[key] || 0) + line.quantity;
  }
  return counts;
}

function splitKey(key) {
  const parts = key.split(SEP);
  const location = parts.pop();
  return { variant: parts.join(SEP), location: location || null, parts };
}

/**
 * Différences entre deux photos, carte par carte.
 *
 * Pour chaque carte, ce qui a diminué quelque part et augmenté ailleurs est un
 * déplacement ; le reste d'une hausse est un ajout, le reste d'une baisse une
 * suppression (ou une vente). Renvoie [{ kind, productId, finish, condition,
 * language, count, from, to }], kind ∈ 'moved' | 'added' | 'removed'.
 */
export function diffSnapshots(before, after) {
  const variants = new Map();
  const touch = (key) => {
    const { variant, location, parts } = splitKey(key);
    if (!variants.has(variant)) variants.set(variant, { parts, places: new Map() });
    const places = variants.get(variant).places;
    if (!places.has(location)) places.set(location, { before: 0, after: 0 });
    return places.get(location);
  };
  for (const [key, n] of Object.entries(before)) touch(key).before += n;
  for (const [key, n] of Object.entries(after)) touch(key).after += n;

  const changes = [];
  for (const { parts, places } of variants.values()) {
    const [productId, finish, condition, language] = parts;
    // Les identifiants produit de l'API sont des entiers ; la clé les a mis en texte.
    const id = /^\d+$/.test(productId) ? Number(productId) : productId;
    const card = { productId: id, finish, condition: condition || null, language: language || null };

    const losses = [];
    const gains = [];
    for (const [location, { before: b, after: a }] of places) {
      if (a < b) losses.push({ location, count: b - a });
      if (a > b) gains.push({ location, count: a - b });
    }
    if (!losses.length && !gains.length) continue;

    // Les plus gros mouvements d'abord : un transfert de 3 reste un transfert de 3.
    losses.sort((x, y) => y.count - x.count);
    gains.sort((x, y) => y.count - x.count);
    for (const loss of losses) {
      for (const gain of gains) {
        const count = Math.min(loss.count, gain.count);
        if (!count) continue;
        changes.push({ kind: 'moved', ...card, count, from: loss.location, to: gain.location });
        loss.count -= count;
        gain.count -= count;
      }
    }
    for (const gain of gains) {
      if (gain.count) changes.push({ kind: 'added', ...card, count: gain.count, from: null, to: gain.location });
    }
    for (const loss of losses) {
      if (loss.count) changes.push({ kind: 'removed', ...card, count: loss.count, from: loss.location, to: null });
    }
  }
  return changes;
}

/** Total d'exemplaires d'une photo. */
export const snapshotTotal = (counts) => Object.values(counts).reduce((sum, n) => sum + n, 0);
