/**
 * Decklists du site officiel (https://fabtcg.com/decklists/…).
 *
 * La page affiche la liste en texte, par sections :
 *
 *   Hero / Weapon / Equipment
 *   1 x Fang, Dracai of Blades
 *   1 x Kunai of Retribution
 *   Pitch 1
 *   3 x Blood Runs Deep (1)
 *   Pitch 2
 *   …
 *   Others
 *
 * On recupere la page (par le pont natif : pas de CORS), on la reduit a des
 * lignes de texte, et on y lit les cartes : quantite, nom, pitch. Le reste
 * (types, image, classes) vient de FaBrary, carte par carte (fabrary.js).
 */
import { deckFromNames, FabraryError } from './fabrary.js';
import { httpFetch } from './http.js';
import { silent } from './progress.js';

const BROWSER_HEADERS = {
  Accept: 'text/html,application/xhtml+xml',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
};

/** Le lien d'une decklist fabtcg.com, normalise (https, slash final), ou null. */
export function parseFabtcgUrl(input) {
  const match = String(input || '').match(/fabtcg\.com\/decklists\/([a-z0-9][a-z0-9-]*[a-z0-9])\/?/i);
  return match ? `https://fabtcg.com/decklists/${match[1].toLowerCase()}/` : null;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', hellip: '…' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** La page reduite a ses lignes de texte : une ligne par bloc, cellules d'un tableau jointes. */
export function htmlToLines(html) {
  const text = String(html)
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(td|th)\s*>/gi, ' ')
    .replace(/<(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<\/?(p|div|li|tr|ul|ol|table|thead|tbody|tfoot|section|article|header|footer|main|aside|nav|h[1-6]|dt|dd|dl|figure|figcaption|blockquote)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Le contenu d'une balise (titre, h1), sans balises internes. */
function tagText(html, tag) {
  const match = String(html).match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeEntities(match[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '';
}

const PITCH_WORDS = { red: 1, yellow: 2, blue: 3 };
// « 3 x Blood Runs Deep (1) », « 3x Name (Red) », « 1 x Fang, Dracai of Blades »
const CARD_LINE = /^(\d{1,2})\s*x\s+(.+?)(?:\s*\((?:pitch\s*)?([0-3]|red|yellow|blue)\))?$/i;

/**
 * Lit une decklist fabtcg.com. Rend { title, heroName, entries }, ou `entries`
 * = [{ name, pitch, quantity, section }] et `section` vaut 'heroGear',
 * 'pitch1'…'pitch3' ou 'others'.
 */
export function parseFabtcgDecklist(html) {
  const lines = htmlToLines(html);
  const title = tagText(html, 'h1') || tagText(html, 'title').replace(/\s*[-–|]\s*Flesh and Blood TCG\s*$/i, '');
  const entries = [];
  let section = null;
  let heroName = null;

  for (const line of lines) {
    if (/^hero\b.*\bweapons?\b.*\bequipment\b/i.test(line)) {
      section = 'heroGear';
      continue;
    }
    const pitch = line.match(/^pitch\s*([0-3])$/i);
    if (pitch) {
      section = `pitch${pitch[1]}`;
      continue;
    }
    if (/^others?$/i.test(line)) {
      section = 'others';
      continue;
    }
    // Un champ « Hero: Fang, Dracai of Blades » dans les informations du deck.
    const heroField = line.match(/^hero\s*:\s*(.+)$/i);
    if (heroField && !heroName) heroName = heroField[1].trim();

    if (!section) continue;
    const card = line.match(CARD_LINE);
    if (!card) continue;
    const marker = card[3]?.toLowerCase();
    const sectionPitch = section.startsWith('pitch') ? Number(section.slice(5)) || null : null;
    entries.push({
      quantity: Number(card[1]),
      name: card[2].trim(),
      pitch: (marker && (PITCH_WORDS[marker] ?? (Number(marker) || null))) ?? sectionPitch,
      section,
    });
  }

  // Sans champ « Hero », le heros est la carte de la premiere section dont le
  // nom figure dans le titre (« Joueur – Fang, Dracai of Blades – Evenement »).
  if (!heroName) {
    const lowerTitle = title.toLowerCase();
    heroName =
      entries.find((e) => e.section === 'heroGear' && lowerTitle.includes(e.name.toLowerCase()))?.name || null;
  }
  return { title, heroName, entries };
}

/** Une decklist fabtcg.com, dans la meme forme qu'un deck FaBrary. */
export async function fetchFabtcgDeck(input, progress = silent) {
  const url = parseFabtcgUrl(input);
  if (!url) throw new FabraryError('Lien de decklist fabtcg.com invalide.', 400);

  progress.report(0.05, 'Lecture de la page fabtcg.com');
  const res = await httpFetch(url, { method: 'GET', headers: BROWSER_HEADERS });
  if (res.status === 404) throw new FabraryError("Cette decklist n'existe pas sur fabtcg.com.", 404);
  if (!res.ok) throw new FabraryError(`fabtcg.com a répondu ${res.status}.`, 502);
  const html = await res.text();

  const { title, heroName, entries } = parseFabtcgDecklist(html);
  if (!entries.length) {
    throw new FabraryError('Aucune carte trouvée sur cette page fabtcg.com (format de page inattendu ?).', 422);
  }

  progress.report(0.3, 'Fiches des cartes sur FaBrary');
  const deck = await deckFromNames(entries, { heroName }, progress.sub(0.3, 1));
  progress.report(1);

  // « Joueur – Héros – Événement » : le joueur en auteur, l'événement en format.
  const parts = title.split(/\s+[–—-]\s+/).map((part) => part.trim()).filter(Boolean);
  const heroInTitle = deck.hero && parts.findIndex((part) => part.toLowerCase() === deck.hero.name.toLowerCase());
  return {
    source: 'fabtcg',
    deckId: url,
    url,
    name: title || 'Decklist fabtcg.com',
    format: heroInTitle >= 0 && parts.length > heroInTitle + 1 ? parts.slice(heroInTitle + 1).join(' – ') : null,
    notes: deck.unknown.length
      ? `Cartes non reconnues par FaBrary (affichées sans image ni type) : ${deck.unknown.join(', ')}.`
      : null,
    tags: [],
    tournament: null,
    createdAt: null,
    updatedAt: null,
    author: heroInTitle > 0 ? parts.slice(0, heroInTitle).join(' – ') : null,
    ...deck,
  };
}
