// Repartition des cartes a aller chercher : le moins d'endroits possible,
// sans renoncer aux regles de prudence (autres decks, cartes en vente).
import { test } from 'node:test';
import assert from 'node:assert/strict';

// cardnexus.js lit window et localStorage a l'import : le minimum pour Node.
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { allocateFewestPlaces } = await import('../../app/src/main/assets/www/js/cardnexus.js');

const L = (id, location, quantity, extra = {}) =>
  ({ inventoryId: id, location, quantity, forSale: false, finish: 'Standard', condition: 'NM', ...extra });

/** Ce que la repartition prend, par carte : ["2x A", "1x B"]. */
function picks(rows, protect = new Set(), options) {
  return allocateFewestPlaces(rows, protect, options).map((taken, i) =>
    [...taken].map(([id, n]) => `${n}x ${rows[i].candidates.find((l) => l.inventoryId === id).location}`),
  );
}

test('un seul endroit qui a tout vaut mieux que trois gros stocks eparpilles', () => {
  const rows = [
    { need: 3, candidates: [L('a', 'A', 3), L('x1', 'X', 3)] },
    { need: 3, candidates: [L('b', 'B', 3), L('x2', 'X', 3)] },
    { need: 2, candidates: [L('c', 'C', 2), L('x3', 'X', 2)] },
  ];
  assert.deepEqual(picks(rows), [['3x X'], ['3x X'], ['2x X']]);
});

test("un autre deck n'est utilise que si la collection ne suffit pas", () => {
  const rows = [
    { need: 2, candidates: [L('d1', 'Deck B', 2), L('a', 'A', 2)] },
    { need: 2, candidates: [L('d2', 'Deck B', 2), L('b', 'B', 2)] },
  ];
  assert.deepEqual(picks(rows, new Set(['Deck B'])), [['2x A'], ['2x B']]);

  const short = [
    { need: 3, candidates: [L('a', 'A', 2), L('d', 'Deck B', 3)] },
    { need: 1, candidates: [L('d2', 'Deck B', 1), L('a2', 'A', 1)] },
  ];
  assert.deepEqual(picks(short, new Set(['Deck B'])), [['2x A', '1x Deck B'], ['1x A']]);
});

test('sans protection, un autre deck est un endroit comme un autre', () => {
  const rows = [
    { need: 2, candidates: [L('d1', 'Deck B', 2), L('a', 'A', 2)] },
    { need: 2, candidates: [L('d2', 'Deck B', 2), L('b', 'B', 2)] },
  ];
  assert.deepEqual(picks(rows, new Set(['Deck B']), { protectDecks: false }), [['2x Deck B'], ['2x Deck B']]);
});

test("une carte en vente n'est prise qu'en dernier recours", () => {
  const rows = [{ need: 2, candidates: [L('s', 'A', 2, { forSale: true }), L('b', 'B', 1), L('c', 'C', 1)] }];
  assert.deepEqual(picks(rows), [['1x B', '1x C']]);
});

test("une carte vient du plus gros vrac retenu, et d'un seul endroit quand il suffit", () => {
  // Cas reel : Vrac 7 est indispensable (3e Oath, Concealed Blade), mais Blaze
  // et Rabble sont aussi dans Vrac 5, le plus fourni.
  const rows = [
    { need: 3, candidates: [L('b7', 'Vrac 7', 4), L('b5', 'Vrac 5', 3)] },
    { need: 3, candidates: [L('r7', 'Vrac 7', 5), L('r5', 'Vrac 5', 3)] },
    { need: 3, candidates: [L('o5', 'Vrac 5', 2), L('o7', 'Vrac 7', 1)] },
    { need: 1, candidates: [L('c7', 'Vrac 7', 1)] },
    { need: 3, candidates: [L('s5', 'Vrac 5', 3)] },
  ];
  assert.deepEqual(picks(rows), [['3x Vrac 5'], ['3x Vrac 5'], ['2x Vrac 5', '1x Vrac 7'], ['1x Vrac 7'], ['3x Vrac 5']]);
});

test('reste rapide au pire cas (16 endroits indispensables)', () => {
  const rows = Array.from({ length: 48 }, (_, c) => ({ need: 3, candidates: [L(`l${c}`, `P${c % 16}`, 3)] }));
  const start = Date.now();
  allocateFewestPlaces(rows, new Set());
  assert.ok(Date.now() - start < 1000, 'plus d’une seconde');
});
