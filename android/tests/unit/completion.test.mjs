import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completionRows, completionTotals } from '../../app/src/main/assets/www/js/completion.js';

const C = (productId, key, name, pitch, rarity, expansion, types = ['Action']) =>
  ({ productId, key, name, pitch, rarity, types, classes: ['Generic'], expansion, printNumber: `${expansion}001` });

const CATALOG = [
  C(1, 'sink-below-1', 'Sink Below', 1, 'common', 'WTR', ['Defense Reaction']),
  C(2, 'sink-below-1', 'Sink Below', 1, 'common', 'DRO', ['Defense Reaction']),
  C(3, 'pummel-1', 'Pummel', 1, 'common', 'WTR'),
  C(4, 'pummel-3', 'Pummel', 3, 'rare', 'HVY'),
  C(5, 'pummel-3', 'Pummel', 3, 'common', 'HNT'),
  C(6, 'kayo-hero', 'Kayo', null, 'rare', 'HVY', ['Hero']),
  C(7, 'might', 'Might', null, 'common', 'HVY', ['Token', 'Aura']),
  C(8, 'helm', 'Fyendal Helm', null, 'common', 'WTR', ['Equipment']),
  C(9, 'enlightened-1', 'Enlightened Strike', 1, 'majestic', 'WTR'),
];

test('toutes éditions confondues : 2 + 2 Sink Below = 4, rien à compléter', () => {
  const owned = new Map([['sink-below-1', 4], ['pummel-1', 1], ['helm', 3]]);
  const rows = completionRows(CATALOG, owned, { target: 3 });
  assert.deepEqual(rows.map((r) => [r.name, r.pitch, r.target, r.owned, r.missing, r.rarity]), [
    // Un héros : un exemplaire suffit (le casque, 3 possédés, est complet).
    ['Kayo', null, 1, 0, 1, 'rare'],
    ['Pummel', 1, 3, 1, 2, 'common'],
    // Rare dans HVY, commune dans HNT : on la dit commune (plus facile à trouver).
    ['Pummel', 3, 3, 0, 3, 'common'],
  ]);
  assert.deepEqual(rows[2].printings.map((p) => p.expansion), ['HVY', 'HNT']);
  assert.deepEqual(completionTotals(rows), { cards: 3, missing: 6, absent: 2 });
});

test('tokens et raretés supérieures exclus ; héros, armes et équipements au choix, à 1 exemplaire', () => {
  const rows = completionRows(CATALOG, new Map(), { target: 3, includeGear: false });
  assert.deepEqual(rows.map((r) => r.name), ['Pummel', 'Pummel', 'Sink Below']);
  const all = completionRows(CATALOG, new Map(), { target: 4 });
  assert.deepEqual(
    all.filter((r) => ['Fyendal Helm', 'Kayo'].includes(r.name)).map((r) => [r.name, r.target, r.missing]),
    [['Fyendal Helm', 1, 1], ['Kayo', 1, 1]],
  );
  assert.equal(all.find((r) => r.name === 'Sink Below').target, 4);
});

test('par extension : chaque impression compte à part', () => {
  const owned = new Map([['1', 3], ['2', 1]]);
  const rows = completionRows(CATALOG.filter((c) => ['WTR', 'DRO'].includes(c.expansion)), owned, { by: 'printing' });
  assert.deepEqual(rows.map((r) => [r.name, r.printings[0].expansion, r.owned, r.missing]), [
    ['Fyendal Helm', 'WTR', 0, 1],
    ['Pummel', 'WTR', 0, 3],
    ['Sink Below', 'DRO', 1, 2],
  ]);
});
