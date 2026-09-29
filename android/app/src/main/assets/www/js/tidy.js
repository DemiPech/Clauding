/**
 * Plan de rangement des vracs.
 *
 * Entree : les lignes d'inventaire des endroits a ranger, chacune avec sa carte
 * (nom, classe, extension). Sortie : ou chaque carte devrait etre, et la liste
 * des deplacements pour y arriver.
 *
 * L'unite qu'on ne coupe jamais est le **nom** de carte, pitchs confondus :
 * toutes les Ignite finissent au meme endroit. Au-dessus, on peut regrouper par
 * classe ou par extension : chaque groupe est range dans le moins d'endroits
 * possible, en respectant a peu pres le remplissage actuel de chaque boite.
 * A chaque choix, on prefere l'endroit qui contient deja le plus de copies :
 * c'est ce qui limite les cartes a deplacer.
 */

/** Marge tolérée au-delà du remplissage actuel d'un endroit. */
const SLACK_RATIO = 0.05;
const SLACK_MIN = 5;

const GROUPERS = {
  name: () => null,
  class: (card) => (card.classes.length ? card.classes.join(' / ') : 'Sans classe'),
  expansion: (card) => card.expansion || 'Extension inconnue',
};

export const TIDY_MODES = Object.keys(GROUPERS);

/** Compte par endroit, trié du plus gros au plus petit. */
function countBy(entries) {
  const map = new Map();
  for (const [key, n] of entries) map.set(key, (map.get(key) || 0) + n);
  return map;
}

const topKey = (map, tieBreak = () => 0) =>
  [...map.entries()].sort((a, b) => b[1] - a[1] || tieBreak(a[0], b[0]))[0]?.[0];

/**
 * `lines` : [{ inventoryId, quantity, location, card: { slug, name, classes, expansion } }]
 * `places` : noms des endroits a ranger (toutes les lignes en viennent).
 * `mode` : 'name' | 'class' | 'expansion'.
 */
export function planTidy(lines, places, mode = 'name') {
  const groupOf = GROUPERS[mode] || GROUPERS.name;

  // Remplissage actuel : il sert de capacite, a une petite marge pres.
  const fill = countBy(lines.map((line) => [line.location, line.quantity]));
  const capacity = new Map(
    places.map((place) => {
      const current = fill.get(place) || 0;
      return [place, current + Math.max(SLACK_MIN, Math.ceil(current * SLACK_RATIO))];
    }),
  );
  const bigger = (a, b) => (fill.get(b) || 0) - (fill.get(a) || 0) || a.localeCompare(b, 'fr');

  // Unites : un nom de carte, avec ses copies par endroit.
  const units = new Map();
  for (const line of lines) {
    const { slug } = line.card;
    if (!units.has(slug)) {
      units.set(slug, { slug, card: line.card, group: groupOf(line.card), total: 0, where: new Map(), lines: [] });
    }
    const unit = units.get(slug);
    unit.total += line.quantity;
    unit.where.set(line.location, (unit.where.get(line.location) || 0) + line.quantity);
    unit.lines.push(line);
  }

  const target = new Map();

  if (mode === 'name') {
    // Chaque nom rejoint l'endroit ou il a le plus de copies.
    for (const unit of units.values()) target.set(unit.slug, topKey(unit.where, bigger));
  } else {
    const free = new Map(capacity);
    const groups = new Map();
    for (const unit of units.values()) {
      if (!groups.has(unit.group)) groups.set(unit.group, []);
      groups.get(unit.group).push(unit);
    }

    const sortedGroups = [...groups.entries()]
      .map(([group, list]) => ({ group, list, total: list.reduce((sum, u) => sum + u.total, 0) }))
      .sort((a, b) => b.total - a.total || String(a.group).localeCompare(String(b.group), 'fr'));

    for (const { list } of sortedGroups) {
      // Ou ce groupe est deja : ses endroits naturels.
      const present = countBy(list.flatMap((unit) => [...unit.where.entries()]));
      const used = new Map();

      for (const unit of list.sort((a, b) => b.total - a.total || a.slug.localeCompare(b.slug))) {
        // Ordre de preference : endroits deja pris par le groupe, puis ceux ou
        // le groupe est deja present, puis ceux ou cette carte est ; a egalite,
        // le plus de place libre.
        const ranked = [...places].sort(
          (a, b) =>
            (used.get(b) || 0) - (used.get(a) || 0) ||
            (present.get(b) || 0) - (present.get(a) || 0) ||
            (unit.where.get(b) || 0) - (unit.where.get(a) || 0) ||
            (free.get(b) || 0) - (free.get(a) || 0),
        );
        const place =
          ranked.find((p) => (free.get(p) || 0) >= unit.total) ||
          [...places].sort((a, b) => (free.get(b) || 0) - (free.get(a) || 0))[0];

        target.set(unit.slug, place);
        free.set(place, (free.get(place) || 0) - unit.total);
        used.set(place, (used.get(place) || 0) + unit.total);
      }
    }
  }

  // Deplacements : toute ligne qui n'est pas a sa place y part entiere.
  const moves = [];
  for (const unit of units.values()) {
    const to = target.get(unit.slug);
    for (const line of unit.lines) {
      if (line.location !== to) moves.push({ line, card: unit.card, group: unit.group, from: line.location, to });
    }
  }

  // Ce que contiendra chaque endroit, par groupe (utile en mode classe/extension).
  const layout = new Map(places.map((place) => [place, new Map()]));
  for (const unit of units.values()) {
    const groups = layout.get(target.get(unit.slug));
    const key = unit.group ?? unit.card.name;
    groups.set(key, (groups.get(key) || 0) + unit.total);
  }

  const splitBefore = [...units.values()].filter((unit) => unit.where.size > 1).length;
  const fillAfter = countBy([...units.values()].map((unit) => [target.get(unit.slug), unit.total]));

  return {
    mode,
    moves,
    layout: places.map((place) => ({
      place,
      before: fill.get(place) || 0,
      after: fillAfter.get(place) || 0,
      groups: [...layout.get(place).entries()]
        .map(([group, count]) => ({ group, count }))
        .sort((a, b) => b.count - a.count),
    })),
    stats: {
      names: units.size,
      cards: lines.reduce((sum, line) => sum + line.quantity, 0),
      splitBefore,
      toMove: moves.reduce((sum, move) => sum + move.line.quantity, 0),
      lines: moves.length,
    },
  };
}
