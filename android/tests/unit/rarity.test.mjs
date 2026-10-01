import { test } from 'node:test';
import assert from 'node:assert/strict';

// cardnexus.js lit window et localStorage a l'import : le minimum pour Node.
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { cardRarity, rarityKey } = await import('../../app/src/main/assets/www/js/cardnexus.js');

test('raretés : noms, lettres, tokens et basiques à part', () => {
  assert.equal(rarityKey('Super Rare'), 'super rare');
  assert.equal(rarityKey('S'), 'super rare');
  assert.equal(rarityKey('basic'), 'basic');
  assert.equal(rarityKey(''), 'other');
  assert.equal(cardRarity({ rarity: 'Common', attributes: { types: ['Token'] } }), 'token');
  assert.equal(cardRarity({ rarity: 'Common', attributes: { rarity: 'B', types: ['Resource'] } }), 'basic');
  assert.equal(cardRarity({ rarity: 'Common', attributes: { types: ['Action'] } }), 'common');
  assert.equal(cardRarity({ rarity: null, attributes: { rarity: 'Majestic' } }), 'majestic');
});
