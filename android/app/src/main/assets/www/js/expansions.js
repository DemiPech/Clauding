/**
 * Classement des extensions Flesh and Blood comme dans la recherche de
 * FaBrary : les extensions principales d'abord, puis les decks prêts à jouer
 * par famille (Armory Deck, Blitz Deck…), les promos et le reste. Dans chaque
 * groupe, par ordre alphabétique.
 *
 * CardNexus ne dit pas de quelle famille relève une extension : on la déduit
 * de son nom, et de sa taille pour une extension principale inconnue d'ici.
 */

export const EXPANSION_GROUPS = [
  { key: 'core', label: 'Core Set' },
  { key: 'armory', label: 'Armory Deck', match: /armory deck/i },
  { key: 'mastery', label: 'Mastery Pack', match: /mastery pack/i },
  { key: 'history', label: 'History Pack', match: /history pack/i },
  { key: 'silverAge', label: 'Silver Age', match: /silver age/i },
  { key: 'firstStrike', label: '1st Strike', match: /^1st strike/i },
  { key: 'blitz', label: 'Blitz Deck', match: /blitz deck/i },
  { key: 'welcome', label: 'Welcome Deck', match: /welcome deck/i },
  { key: 'classicBattles', label: 'Classic Battles', match: /classic battles/i },
  { key: 'roundTable', label: 'Round the Table', match: /round the table/i },
  { key: 'heroDeck', label: 'Hero Deck', match: /\bdecks?\b/i },
  {
    key: 'promo',
    label: 'Promo',
    match: /promo|judge|championship|nationals|calling|pro quest|pro tour|battle hardened|prize|redemption|launch/i,
  },
  { key: 'other', label: 'Autres' },
];

// Les extensions principales connues (et leurs rééditions : « … Unlimited »).
const CORE_SETS = [
  'Welcome to Rathe',
  'Arcane Rising',
  'Crucible of War',
  'Monarch',
  'Tales of Aria',
  'Everfest',
  'Uprising',
  'Dynasty',
  'Outsiders',
  'Dusk till Dawn',
  'Bright Lights',
  'Heavy Hitters',
  'Part the Mistveil',
  'Rosetta',
  'The Hunted',
  'High Seas',
  'Super Slam',
  'Compendium of Rathe',
  'Usurp the Shadow Throne',
];

// Au-delà, une extension sans autre famille reconnue est une extension principale.
const CORE_MIN_CARDS = 150;

const normalize = (text) => String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
const CORE_NAMES = CORE_SETS.map(normalize);

/** La famille d'une extension (clé de EXPANSION_GROUPS). */
export function expansionGroup({ name, cardCount }) {
  const plain = normalize(name);
  if (CORE_NAMES.some((core) => plain === core || plain.startsWith(`${core} `))) return 'core';
  const family = EXPANSION_GROUPS.find((group) => group.match?.test(name || ''));
  if (family) return family.key;
  return (cardCount ?? 0) >= CORE_MIN_CARDS ? 'core' : 'other';
}

/**
 * Les extensions rangées par famille, dans l'ordre des groupes, chaque groupe
 * trié par nom. `filter` ne garde que les noms qui contiennent ce texte.
 */
export function groupExpansions(expansions, filter = '') {
  const wanted = normalize(filter);
  const byName = (a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' });
  return EXPANSION_GROUPS.map(({ key, label }) => ({
    key,
    label,
    expansions: expansions
      .filter((exp) => expansionGroup(exp) === key && (!wanted || normalize(exp.name).includes(wanted)))
      .sort(byName),
  })).filter((group) => group.expansions.length);
}
