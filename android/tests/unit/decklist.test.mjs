// Lecture d'une liste collée (texte copié depuis FaBrary, ou toute liste « 3x Nom »).
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { parseDecklistText } = await import('../../app/src/main/assets/www/js/decklist.js');

// Le texte du bouton « Copier » de FaBrary.
const FABRARY_TEXT = `Name: Fang Aggro
Hero: Fang, Dracai of Blades
Format: Classic Constructed

Arena cards
1x Kunai of Retribution
1x Hunt’s End (red)
Deck cards
3x Blood Runs Deep (red)
2x Blunten (yellow)
3x Buckwild (blue)

Made with ❤️ at the FaBrary
See the full deck @ https://fabrary.net/decks/01M6HN6NA59YHATVWNMVF8D12H`;

test('texte copié depuis FaBrary', () => {
  const list = parseDecklistText(FABRARY_TEXT);
  assert.equal(list.name, 'Fang Aggro');
  assert.equal(list.heroName, 'Fang, Dracai of Blades');
  assert.equal(list.format, 'Classic Constructed');
  assert.equal(list.url, 'https://fabrary.net/decks/01M6HN6NA59YHATVWNMVF8D12H');
  assert.deepEqual(
    list.entries.map((e) => [e.quantity, e.name, e.pitch, e.section]),
    [
      [1, 'Fang, Dracai of Blades', null, 'hero'],
      [1, 'Kunai of Retribution', null, 'deck'],
      [1, 'Hunt’s End', 1, 'deck'],
      [3, 'Blood Runs Deep', 1, 'deck'],
      [2, 'Blunten', 2, 'deck'],
      [3, 'Buckwild', 3, 'deck'],
    ],
  );
});

test('autres écritures : « 3 x Nom (1) », réserve, lignes parasites ignorées', () => {
  const list = parseDecklistText('Ma liste\r\n3 x Sink Below (1)\r\n2x Pummel (blu)\r\n\r\nSideboard\r\n1x Enlightened Strike (red)\r\nune ligne quelconque');
  assert.equal(list.name, null);
  assert.deepEqual(
    list.entries.map((e) => [e.quantity, e.name, e.pitch, e.section]),
    [[3, 'Sink Below', 1, 'deck'], [2, 'Pummel', 3, 'deck'], [1, 'Enlightened Strike', 1, 'sideboard']],
  );
  assert.deepEqual(parseDecklistText('rien à lire').entries, []);
});
