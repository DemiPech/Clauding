// Catalogue Card Vault : lignes de type, codes d'extension, rattachement à CardNexus.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { parseTypebox, printSet, vaultCard } = await import('../../app/src/main/assets/www/js/cardvault.js');
const { mergeCatalogs } = await import('../../app/src/main/assets/www/js/cardnexus.js');

// Listes de référence de Card Vault (extraits), les plus longues d'abord comme l'app les range.
const longestFirst = (list) => list.sort((a, b) => b.length - a.length);
const VOCABULARY = {
  types: longestFirst(['Action', 'Attack Reaction', 'Defense Reaction', 'Demi-Hero', 'Equipment', 'Hero', 'Instant', 'Token', 'Weapon']),
  classes: longestFirst(['Brute', 'Generic', 'Necromancer', 'Pirate', 'Runeblade', 'Warrior']),
  talents: longestFirst(['Light', 'Lightning', 'Revered', 'Shadow']),
};

test('ligne de type : talents, classes et types, sans les sous-types', () => {
  assert.deepEqual(parseTypebox('Shadow Brute Action - Attack', VOCABULARY), { types: ['Action'], classes: ['Brute'], talents: ['Shadow'] });
  assert.deepEqual(parseTypebox('Lightning Warrior Weapon - Sword (2H)', VOCABULARY), { types: ['Weapon'], classes: ['Warrior'], talents: ['Lightning'] });
  assert.deepEqual(parseTypebox('Pirate Action - Attack', VOCABULARY).classes, ['Pirate']);
  assert.deepEqual(parseTypebox('Shadow Necromancer Weapon - Staff (2H)', VOCABULARY).classes, ['Necromancer']);
  assert.deepEqual(parseTypebox('Revered Warrior Hero - Young', VOCABULARY).talents, ['Revered']);
  assert.deepEqual(parseTypebox('Generic Defense Reaction', VOCABULARY).types, ['Defense Reaction']);
  assert.deepEqual(parseTypebox('Warrior Demi-Hero', VOCABULARY).types, ['Demi-Hero']);
  assert.deepEqual(parseTypebox('', VOCABULARY), { types: [], classes: [], talents: [] });
});

test('code d’extension tiré du numéro d’impression', () => {
  assert.equal(printSet('WTR215'), 'WTR');
  assert.equal(printSet('1HP001'), '1HP');
  assert.equal(printSet('AAC005-RF'), 'AAC');
  assert.equal(printSet('U-MON187-RF'), 'MON');
  assert.equal(printSet('R-WTR079'), 'WTR');
  assert.equal(printSet(''), null);
});

test('une carte de la recherche Card Vault', () => {
  const card = vaultCard(
    {
      card_id: 'abyssal-bite-3',
      print_id: 'IAR206',
      printed_name: 'Abyssal Bite',
      printed_typebox: 'Shadow Action',
      printed_pitch: 3,
      core_talent: 'Shadow',
      faces: [{ layout_position: 10, image: { small: 'https://img/IAR206.webp' } }],
    },
    'common',
    VOCABULARY,
  );
  assert.deepEqual(card, {
    cardId: 'abyssal-bite-3', name: 'Abyssal Bite', pitch: 3, rarity: 'common', types: ['Action'], classes: [],
    talents: ['Shadow'], expansion: 'IAR', printNumber: 'IAR206', imageUrl: 'https://img/IAR206.webp',
  });
});

test('Card Vault donne la liste, CardNexus les prix et les impressions', () => {
  const vault = [
    { cardId: 'sink-below-1', name: 'Sink Below', pitch: 1, rarity: 'common', types: ['Defense Reaction'], classes: ['Generic'], talents: [], expansion: 'WTR', printNumber: 'WTR215' },
    { cardId: 'jolly-roger-1', name: 'Jolly Roger', pitch: 1, rarity: 'common', types: [], classes: ['Pirate'], talents: [], expansion: 'SEA', printNumber: 'SEA100' },
    { cardId: 'qi-unleashed-1', name: 'Qi Unbound', pitch: 1, rarity: 'rare', types: ['Action'], classes: [], talents: [], expansion: 'MST', printNumber: 'MST001' },
  ];
  const nexus = [
    // Rattachée par son nom + pitch.
    { productId: 'p3', key: 'sink-below-red', name: 'Sink Below', pitch: 1, rarity: 'common', types: ['Defense Reaction'], price: 0.2 },
    // Rattachée par son identifiant (fabId = card_id), malgré un autre nom.
    { productId: 'q1', key: 'qi-unleashed-1', name: 'Qi Unleashed', pitch: 1, rarity: 'rare', types: ['Action'], price: 1.5 },
    // Ligne de type vide chez Card Vault : celle de CardNexus la remplace.
    { productId: 'j1', key: 'jolly-roger-1', name: 'Jolly Roger', pitch: 1, rarity: 'common', types: ['Equipment'], price: 3 },
    // Inconnue de Card Vault (rareté différente) : ignorée.
    { productId: 'x1', key: 'other-1', name: 'Other', pitch: 1, rarity: 'common', types: ['Action'], price: 9 },
  ];
  const { cards, aliases } = mergeCatalogs(vault, nexus);
  assert.deepEqual(aliases, { 'sink-below-1': 'sink-below-1', 'jolly-roger-1': 'jolly-roger-1', 'qi-unleashed-1': 'qi-unbound-1' });
  assert.deepEqual(cards.map((c) => [c.key, c.productId, c.price]), [
    ['sink-below-1', null, null], ['jolly-roger-1', null, null], ['qi-unbound-1', null, null],
    ['sink-below-1', 'p3', 0.2], ['qi-unbound-1', 'q1', 1.5], ['jolly-roger-1', 'j1', 3],
  ]);
  assert.deepEqual(cards[1].types, ['Equipment']);
});
