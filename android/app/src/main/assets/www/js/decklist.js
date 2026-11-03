/**
 * Une liste donnée par noms de cartes : decklist fabtcg.com, ou texte collé
 * (la liste copiée depuis FaBrary, bouton « Copier »). Les fiches des cartes
 * (types, image, statistiques, classes) viennent de Card Vault, la base
 * officielle.
 *
 * Texte copié depuis FaBrary :
 *
 *   Name: Fang Aggro
 *   Hero: Fang, Dracai of Blades
 *   Format: Classic Constructed
 *
 *   Arena cards
 *   1x Kunai of Retribution
 *   Deck cards
 *   3x Blood Runs Deep (red)
 *
 *   Made with ❤️ at the FaBrary
 *   See the full deck @ https://fabrary.net/decks/01…
 */
import { vaultCardsByName } from './cardvault.js';
import { silent } from './progress.js';

const PITCH_NAMES = { 1: 'Red', 2: 'Yellow', 3: 'Blue' };
const PITCH_WORDS = { red: 1, r: 1, yellow: 2, yel: 2, y: 2, blue: 3, blu: 3, b: 3 };

/** « red », « (2) »… → 1, 2, 3, ou null. */
export function pitchOf(marker) {
  if (!marker) return null;
  const key = String(marker).toLowerCase();
  return PITCH_WORDS[key] ?? (Number(key) || null);
}

// « 3x Blood Runs Deep (red) », « 3 x Name (1) », « 1x Fang, Dracai of Blades »
export const CARD_LINE = /^(\d{1,2})\s*x\s+(.+?)(?:\s*\((?:pitch\s*)?([0-3]|red|r|yel|yellow|y|blu|blue|b)\))?$/i;

// --- Liste par noms -----------------------------------------------------------

function normalizeCard(card, quantity) {
  return {
    id: card.cardIdentifier,
    name: card.name,
    quantity,
    image: null,
    imageUrl: card.imageUrl || null,
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
const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/**
 * Le deck d'une liste par noms, dans la même forme qu'un deck FaBrary :
 * `entries` = [{ name, pitch, quantity, section?, imageUrl? }] ; `section`
 * 'sideboard' range la carte en réserve. Une carte que Card Vault ne connaît
 * pas garde son seul nom (et figure dans `unknown`).
 */
export async function deckFromNames(entries, { heroName = null } = {}, progress = silent) {
  const cards = await vaultCardsByName(entries, progress);

  let hero = null;
  const weapons = [];
  const equipment = [];
  const main = [];
  const sideboard = [];
  entries.forEach((entry, index) => {
    const card = cards[index] || { cardIdentifier: null, name: entry.name, pitch: entry.pitch ?? null, types: [] };
    const isHero = (card.types || []).includes('Hero') || (heroName && sameName(entry.name, heroName));
    if (isHero && !hero) {
      hero = {
        id: card.cardIdentifier,
        name: card.name,
        image: null,
        imageUrl: card.imageUrl || entry.imageUrl || null,
        intellect: card.intellect ?? null,
        life: card.life ?? null,
        classes: card.classes || [],
        talents: card.talents || [],
        typeText: card.typeText || '',
        text: card.functionalText || '',
      };
      return;
    }
    const normalized = normalizeCard(card, entry.quantity);
    // L'image de la page d'origine, quand Card Vault n'en a pas.
    if (!normalized.imageUrl && entry.imageUrl) normalized.imageUrl = entry.imageUrl;
    if (entry.section === 'sideboard') {
      sideboard.push(normalized);
      return;
    }
    const zone = zoneOf(card);
    (zone === 'weapons' ? weapons : zone === 'equipment' ? equipment : main).push(normalized);
  });

  [weapons, equipment, main, sideboard].forEach((list) => list.sort(byNameThenPitch));
  const total = (list) => list.reduce((sum, c) => sum + c.quantity, 0);
  return {
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
    unknown: entries.filter((_, index) => !cards[index]).map((entry) => entry.name),
  };
}

// --- Liste collée ---------------------------------------------------------------

/**
 * Lit une liste en texte : celle copiée depuis FaBrary, ou toute liste
 * « 3x Nom (red) ». Rend { name, heroName, format, url, entries }.
 */
export function parseDecklistText(text) {
  const result = { name: null, heroName: null, format: null, url: null, entries: [] };
  let section = 'deck';
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const link = line.match(/https?:\/\/(?:www\.)?fabrary\.net\/decks\/[A-Za-z0-9_-]+/i);
    if (link) {
      result.url ??= link[0];
      continue;
    }
    const field = line.match(/^(name|hero|format)\s*:\s*(.+)$/i);
    if (field) {
      const key = field[1].toLowerCase();
      if (key === 'name') result.name ??= field[2].trim();
      else if (key === 'format') result.format ??= field[2].trim();
      else result.heroName ??= field[2].trim();
      continue;
    }
    if (/^(arena|deck|main)( cards?)?$/i.test(line)) {
      section = 'deck';
      continue;
    }
    if (/^(sideboard|side|réserve|inventory)( cards?)?$/i.test(line)) {
      section = 'sideboard';
      continue;
    }
    const card = line.match(CARD_LINE);
    if (!card) continue;
    result.entries.push({ quantity: Number(card[1]), name: card[2].trim(), pitch: pitchOf(card[3]), section });
  }
  // Le héros, s'il n'est pas déjà parmi les cartes.
  if (result.heroName && !result.entries.some((entry) => sameName(entry.name, result.heroName))) {
    result.entries.unshift({ quantity: 1, name: result.heroName, pitch: null, section: 'hero' });
  }
  return result;
}

const PASTED_STORAGE = 'pasted_lists';
const MAX_PASTED = 50;

function hashText(text) {
  let hash = 5381;
  for (const char of text) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

function readPasted() {
  try {
    return JSON.parse(localStorage.getItem(PASTED_STORAGE)) || {};
  } catch {
    return {};
  }
}

/**
 * Garde une liste collée sur le téléphone et rend sa référence (« paste:… »),
 * qui sert à la rouvrir (historique des listes, montage). Les plus anciennes
 * sont oubliées au-delà de 50.
 */
export function savePastedList(text) {
  const clean = String(text || '').trim();
  const ref = `paste:${hashText(clean)}`;
  const lists = readPasted();
  lists[ref] = { text: clean, at: Date.now() };
  const kept = Object.entries(lists).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_PASTED);
  try {
    localStorage.setItem(PASTED_STORAGE, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Mémoire pleine : la liste s'ouvre quand même, sans être gardée.
  }
  return ref;
}

export const isPastedRef = (value) => /^paste:[a-z0-9]+$/.test(String(value || ''));

export class DecklistError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** Une liste collée, d'après sa référence, dans la même forme qu'un deck FaBrary. */
export async function fetchPastedDeck(ref, progress = silent) {
  const stored = readPasted()[ref];
  if (!stored) throw new DecklistError("Cette liste collée n'est plus gardée sur le téléphone. Collez-la de nouveau.", 404);
  const { name, heroName, format, url, entries } = parseDecklistText(stored.text);
  if (!entries.length) throw new DecklistError('Aucune carte trouvée dans ce texte (lignes « 3x Nom (red) » attendues).', 422);

  progress.report(0.05, 'Fiches des cartes sur Card Vault');
  const deck = await deckFromNames(entries, { heroName }, progress.sub(0.05, 1));
  progress.report(1);
  return {
    source: 'paste',
    deckId: ref,
    url,
    name: name || (deck.hero ? `Liste ${deck.hero.name}` : 'Liste collée'),
    format: format || null,
    notes: deck.unknown.length
      ? `Cartes non reconnues par Card Vault (affichées sans type ni statistiques) : ${deck.unknown.join(', ')}.`
      : null,
    tags: [],
    tournament: null,
    createdAt: null,
    updatedAt: new Date(stored.at).toISOString(),
    author: null,
    ...deck,
  };
}
