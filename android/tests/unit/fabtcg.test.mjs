// Lecture des decklists du site officiel fabtcg.com.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { parseFabtcgDecklist, parseFabtcgUrl, htmlToLines } = await import(
  '../../app/src/main/assets/www/js/fabtcg.js'
);
const { FABTCG_PAGE } = await import('../fixtures/fabtcg-decklist.mjs');

const PAGE = `<!doctype html><html><head><title>Michel Verissimo Da Silva Luiz &#8211; Fang, Dracai of Blades &#8211; 100th Calling Atlanta - Flesh and Blood TCG</title>
<script>var x = "1 x Not A Card";</script></head><body>
<h1>Michel Verissimo Da Silva Luiz &ndash; Fang, Dracai of Blades &ndash; 100th Calling Atlanta</h1>
<div class="decklist">
  <h3>Hero / Weapon / Equipment</h3>
  <ul><li>1 x Fang, Dracai of Blades</li><li>2 x Kunai of Retribution</li><li>1 x Flick Knives</li></ul>
  <h3>Pitch 1</h3>
  <ul><li>3 x Blood Runs Deep (1)</li><li>3x Hot on Their Heels (Red)</li></ul>
  <h3>Pitch 2</h3>
  <p>2 x Art of the Dragon: Blood (2)<br>1 x Lyath&rsquo;s Shadow (2)</p>
  <h3>Pitch 3</h3>
  <table><tr><td>3</td><td>x</td><td>Throw Dagger (3)</td></tr></table>
  <h3>Others</h3>
  <ul><li>1 x Fealty</li></ul>
</div></body></html>`;

test('lien fabtcg.com reconnu et normalisé', () => {
  assert.equal(
    parseFabtcgUrl('fabtcg.com/decklists/michel-verissimo-da-silva-luiz-fang-dracai-of-blades-100th-calling-atlanta'),
    'https://fabtcg.com/decklists/michel-verissimo-da-silva-luiz-fang-dracai-of-blades-100th-calling-atlanta/',
  );
  assert.equal(parseFabtcgUrl('https://fabtcg.com/decklists/'), null);
  assert.equal(parseFabtcgUrl('https://fabrary.net/decks/01ABC'), null);
});

test('texte de la page : blocs, cellules jointes, entités, scripts ignorés', () => {
  const lines = htmlToLines(PAGE);
  assert.ok(lines.includes('3 x Throw Dagger (3)'));
  assert.ok(lines.includes('1 x Lyath’s Shadow (2)'));
  assert.ok(!lines.some((line) => line.includes('Not A Card')));
});

test('sections, quantités, pitch et héros', () => {
  const { title, heroName, entries } = parseFabtcgDecklist(PAGE);
  assert.equal(title, 'Michel Verissimo Da Silva Luiz – Fang, Dracai of Blades – 100th Calling Atlanta');
  assert.equal(heroName, 'Fang, Dracai of Blades');
  assert.deepEqual(
    entries.map((e) => [e.quantity, e.name, e.pitch, e.section]),
    [
      [1, 'Fang, Dracai of Blades', null, 'heroGear'],
      [2, 'Kunai of Retribution', null, 'heroGear'],
      [1, 'Flick Knives', null, 'heroGear'],
      [3, 'Blood Runs Deep', 1, 'pitch1'],
      [3, 'Hot on Their Heels', 1, 'pitch1'],
      [2, 'Art of the Dragon: Blood', 2, 'pitch2'],
      [1, 'Lyath’s Shadow', 2, 'pitch2'],
      [3, 'Throw Dagger', 3, 'pitch3'],
      [1, 'Fealty', null, 'others'],
    ],
  );
});

test('un champ « Hero: … » l’emporte sur le titre', () => {
  const html = '<h1>Joueur – Deck</h1><p>Hero: Kayo, Armed and Dangerous</p><h3>Hero / Weapons / Equipment</h3><p>1 x Kayo, Armed and Dangerous</p>';
  assert.equal(parseFabtcgDecklist(html).heroName, 'Kayo, Armed and Dangerous');
});

test('page réelle : champs du joueur, pitch (red/yel/blu), images, liste lue une seule fois', () => {
  const { title, heroName, fields, entries } = parseFabtcgDecklist(FABTCG_PAGE);
  assert.equal(title, 'Michel Verissimo da Silva Luiz - Fang, Dracai of Blades - 100th Calling Atlanta');
  assert.equal(heroName, 'Fang, Dracai of Blades');
  assert.deepEqual(fields, {
    rank: '13th', date: 'October 3, 2026', player: 'Michel Verissimo da Silva Luiz (29114217)',
    event: '100th Calling Atlanta', format: 'Classic Constructed', hero: 'Fang, Dracai of Blades',
  });
  assert.deepEqual(
    entries.map((e) => [e.quantity, e.name, e.pitch, e.section]),
    [
      [1, 'Fang, Dracai of Blades', null, 'heroGear'],
      [2, 'Obsidian Fire Vein', null, 'heroGear'],
      [1, 'Mystery Helm', null, 'heroGear'],
      [3, 'Buckwild', 1, 'pitch1'],
      [3, 'Hunt’s End', 1, 'pitch1'],
      [2, 'Blunten', 2, 'pitch2'],
      [2, 'Buckwild', 3, 'pitch3'],
    ],
  );
  assert.match(entries[2].imageUrl, /XXX001\.webp$/);
  assert.match(entries[6].imageUrl, /WTR003\.webp$/);
});
