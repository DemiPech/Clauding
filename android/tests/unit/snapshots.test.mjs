// Comparaison de deux photos de la collection : ajouts, suppressions (ou
// ventes) et deplacements, carte par carte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countLines, diffSnapshots } from '../../app/src/main/assets/www/js/snapshots.js';

const L = (productId, quantity, location, extra = {}) =>
  ({ productId, quantity, location, finish: 'Standard', condition: 'NM', language: 'en', ...extra });
const describe = (changes) =>
  changes.map((c) => `${c.kind} ${c.count}x ${c.productId}${c.condition !== 'NM' ? ` ${c.condition}` : ''} ${c.from ?? '∅'}>${c.to ?? '∅'}`).sort();

test('deplacement, vente, rangement, ajout, autre etat', () => {
  const before = countLines([L(1, 5, 'Vrac 3'), L(2, 3, 'Vrac 5'), L(3, 2, null), L(4, 1, 'Vrac 1', { finish: 'Rainbow Foil' })]);
  const after = countLines([
    L(1, 3, 'Vrac 3'), L(1, 2, 'Boulder'),
    L(2, 2, 'Vrac 5'),
    L(3, 2, 'Vrac 1'),
    L(4, 1, 'Vrac 1', { finish: 'Rainbow Foil' }),
    L(5, 3, 'Vrac 5'),
    L(1, 1, 'Vrac 3', { condition: 'LP' }),
  ]);
  assert.deepEqual(describe(diffSnapshots(before, after)), [
    'added 1x 1 LP ∅>Vrac 3',
    'added 3x 5 ∅>Vrac 5',
    'moved 2x 1 Vrac 3>Boulder',
    'moved 2x 3 ∅>Vrac 1',
    'removed 1x 2 Vrac 5>∅',
  ]);
});

test('deux photos identiques : aucun changement', () => {
  const counts = countLines([L(1, 5, 'Vrac 3'), L(2, 1, null)]);
  assert.equal(diffSnapshots(counts, counts).length, 0);
});

test('une ligne coupee en deux au meme endroit ne compte pas comme un changement', () => {
  const before = countLines([L(1, 4, 'Vrac 1')]);
  const after = countLines([L(1, 1, 'Vrac 1'), L(1, 3, 'Vrac 1')]);
  assert.equal(diffSnapshots(before, after).length, 0);
});
