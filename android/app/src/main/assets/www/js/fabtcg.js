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

const PITCH_WORDS = { red: 1, r: 1, yel: 2, yellow: 2, y: 2, blu: 3, blue: 3, b: 3 };
// « 3x Affirm Loyalty (red) », « 2x Blunten (yel) », « 3 x Name (1) », « 1x Fang, Dracai of Blades »
const CARD_LINE = /^(\d{1,2})\s*x\s+(.+?)(?:\s*\((?:pitch\s*)?([0-3]|red|r|yel|yellow|y|blu|blue|b)\))?$/i;

// Champs du deck, un intitule puis sa valeur (« Player », puis « Michel … (29114217) »).
const FIELDS = { player: 'player', event: 'event', format: 'format', hero: 'hero', date: 'date', rank: 'rank' };

const pitchOf = (marker) => {
  if (!marker) return null;
  const key = marker.toLowerCase();
  return PITCH_WORDS[key] ?? (Number(key) || null);
};

/**
 * Les images officielles de la page : « 3x Affirm Loyalty (red) » → URL de
 * l'image (balise <li class="card-item"> : nom puis <img>).
 */
function cardImages(html) {
  const images = new Map();
  const item = /<div class="card-name">([\s\S]*?)<\/div>[\s\S]*?<img[^>]+src="([^"]+)"/gi;
  for (const [, label, src] of String(html).matchAll(item)) {
    const text = decodeEntities(label.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    const card = text.match(CARD_LINE);
    if (card && !images.has(imageKey(card[2], pitchOf(card[3])))) {
      images.set(imageKey(card[2], pitchOf(card[3])), decodeEntities(src));
    }
  }
  return images;
}

const imageKey = (name, pitch) => `${String(name).trim().toLowerCase()}|${pitch ?? ''}`;

/**
 * Lit une decklist fabtcg.com. Rend { title, heroName, fields, entries }, ou
 * `entries` = [{ name, pitch, quantity, section, imageUrl }] et `section` vaut
 * 'heroGear', 'pitch1'…'pitch3' ou 'others'. La page affiche la liste deux
 * fois (deux presentations) : on s'arrete a la fin de la premiere.
 */
export function parseFabtcgDecklist(html) {
  const lines = htmlToLines(html);
  const title = tagText(html, 'h1') || tagText(html, 'title').replace(/\s*[-–|]\s*Flesh and Blood TCG\s*$/i, '');
  const images = cardImages(html);
  const entries = [];
  const fields = {};
  let section = null;
  let heroName = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^hero\b.*\bweapons?\b.*\bequipment\b/i.test(line)) {
      if (entries.length) break; // deuxieme presentation de la meme liste
      section = 'heroGear';
      continue;
    }
    const pitch = line.match(/^pitch\s*([0-3])(?:\s*\(\d+\))?$/i);
    if (pitch) {
      section = `pitch${pitch[1]}`;
      continue;
    }
    if (/^others?(?:\s*\(\d+\))?$/i.test(line)) {
      section = 'others';
      continue;
    }
    // « Hero: Fang, … » sur une ligne, ou l'intitule seul suivi de sa valeur.
    const inline = line.match(/^(player|event|format|hero|date|rank)\s*:\s*(.+)$/i);
    if (inline && !section) {
      fields[FIELDS[inline[1].toLowerCase()]] ??= inline[2].trim();
      continue;
    }
    const label = FIELDS[line.toLowerCase()];
    if (label && !section && lines[i + 1] && !CARD_LINE.test(lines[i + 1])) {
      fields[label] ??= lines[i + 1].trim();
      i += 1;
      continue;
    }

    if (!section) continue;
    const card = line.match(CARD_LINE);
    if (!card) continue;
    const sectionPitch = section.startsWith('pitch') ? Number(section.slice(5)) || null : null;
    const cardPitch = pitchOf(card[3]) ?? sectionPitch;
    entries.push({
      quantity: Number(card[1]),
      name: card[2].trim(),
      pitch: cardPitch,
      section,
      imageUrl: images.get(imageKey(card[2], pitchOf(card[3]))) || null,
    });
  }

  heroName = fields.hero || null;
  // Sans champ « Hero », le heros est la carte de la premiere section dont le
  // nom figure dans le titre (« Joueur – Fang, Dracai of Blades – Evenement »).
  if (!heroName) {
    const lowerTitle = title.toLowerCase();
    heroName =
      entries.find((e) => e.section === 'heroGear' && lowerTitle.includes(e.name.toLowerCase()))?.name || null;
  }
  return { title, heroName, fields, entries };
}

/** Une decklist fabtcg.com, dans la meme forme qu'un deck FaBrary. */
export async function fetchFabtcgDeck(input, progress = silent) {
  const url = parseFabtcgUrl(input);
  if (!url) throw new FabraryError('Lien de decklist fabtcg.com invalide.', 400);

  progress.report(0.05, 'Lecture de la page fabtcg.com');
  const res = await httpFetch(url, { method: 'GET', headers: BROWSER_HEADERS });
  if (res.status === 404) throw new FabraryError("Cette decklist n'existe pas sur fabtcg.com.", 404);
  const html = await res.text();
  // Une page de verification anti-robot (Cloudflare) plutot que la decklist.
  if (/just a moment|cf-chl|challenge-platform|attention required/i.test(html.slice(0, 20000))) {
    throw new FabraryError('fabtcg.com a demandé une vérification anti-robot. Réessayez dans un moment.', 503);
  }
  if (!res.ok) throw new FabraryError(`fabtcg.com a répondu ${res.status}.`, 502);

  const { title, heroName, fields, entries } = parseFabtcgDecklist(html);
  if (!entries.length) {
    throw new FabraryError('Aucune carte trouvée sur cette page fabtcg.com (format de page inattendu ?).', 422);
  }

  progress.report(0.3, 'Fiches des cartes sur FaBrary');
  const deck = await deckFromNames(entries, { heroName }, progress.sub(0.3, 1));
  progress.report(1);

  // Le joueur et l'evenement : champs de la page, sinon le titre
  // (« Joueur – Héros – Événement »).
  const parts = title.split(/\s+[–—-]\s+/).map((part) => part.trim()).filter(Boolean);
  const heroInTitle = deck.hero ? parts.findIndex((part) => part.toLowerCase() === deck.hero.name.toLowerCase()) : -1;
  const player = fields.player?.replace(/\s*\(\d+\)\s*$/, '') || (heroInTitle > 0 ? parts.slice(0, heroInTitle).join(' – ') : null);
  const event = fields.event || (heroInTitle >= 0 && parts.length > heroInTitle + 1 ? parts.slice(heroInTitle + 1).join(' – ') : null);
  return {
    source: 'fabtcg',
    deckId: url,
    url,
    name: title || 'Decklist fabtcg.com',
    format: [event, fields.rank].filter(Boolean).join(' · ') || null,
    notes: deck.unknown.length
      ? `Cartes non reconnues par FaBrary (affichées sans type ni statistiques) : ${deck.unknown.join(', ')}.`
      : null,
    tags: [],
    tournament: null,
    createdAt: null,
    updatedAt: null,
    author: player,
    ...deck,
  };
}
