// Suivis de collection : cartes retenues, objectifs, complétion.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
const { trackerCards, trackerProgress, normalizeTracker, describeTracker, saveTracker, readTrackers, deleteTracker } = await import(
  '../../app/src/main/assets/www/js/trackers.js'
);
const { indexCard, isLegendary } = await import('../../app/src/main/assets/www/js/cardvault.js');

const C = (cardId, name, pitch, { types = ['Action'], classes = ['Ninja'], talents = [], legendary = false } = {}) =>
  ({ cardId, name, pitch, types, classes, talents, legendary, imageUrl: null });

const INDEX = [
  C('bittering-thorns-1', 'Bittering Thorns', 1),
  // Même carte, autre identifiant (version Inner Chi) : une seule ligne.
  C('bittering-thorns-1--inner-chi-1', 'Bittering Thorns', 1),
  C('bittering-thorns-3', 'Bittering Thorns', 3),
  C('fang', 'Fang', null, { types: ['Hero'], classes: ['Warrior'], talents: ['Draconic'] }),
  C('kunai-of-retribution', 'Kunai of Retribution', null, { types: ['Weapon'], talents: ['Draconic'] }),
  C('mask-of-momentum', 'Mask of Momentum', null, { types: ['Equipment'] }),
  C('a-drop-in-the-ocean-3', 'A Drop in the Ocean', 3, { types: ['Instant'], classes: ['Generic'], talents: ['Mystic'], legendary: true }),
  C('flick-knives', 'Flick Knives', null, { types: ['Equipment'], classes: ['Assassin', 'Ninja'] }),
  C('ninja-only-en-1', 'Ninja Only En', 1),
];
const JA = new Set(['bittering-thorns-1', 'bittering-thorns-1--inner-chi-1', 'bittering-thorns-3', 'kunai-of-retribution', 'mask-of-momentum', 'flick-knives', 'fang', 'a-drop-in-the-ocean-3']);

test('cartes Ninja imprimées en japonais : une ligne par nom + pitch, objectifs 1 ou 3', () => {
  const tracker = normalizeTracker({ name: 'Ninja JA', classes: ['Ninja'], language: 'ja' });
  const rows = trackerCards(INDEX, tracker, JA);
  assert.deepEqual(rows.map((r) => [r.name, r.pitch, r.target]), [
    ['Bittering Thorns', 1, 3],
    ['Bittering Thorns', 3, 3],
    ['Flick Knives', null, 1],
    ['Kunai of Retribution', null, 1],
    ['Mask of Momentum', null, 1],
  ]);
  assert.deepEqual(rows[0].cardIds, ['bittering-thorns-1', 'bittering-thorns-1--inner-chi-1']);
});

test('mot-clé Legendary (pas la rareté) : un exemplaire ; règle désactivable', () => {
  const mystic = normalizeTracker({ talents: ['Mystic'] });
  assert.equal(trackerCards(INDEX, mystic)[0].target, 1);
  const flat = normalizeTracker({ talents: ['Mystic'], singleRule: false, target: 2 });
  assert.equal(trackerCards(INDEX, flat)[0].target, 2);
  // Plusieurs critères : une valeur de chaque rubrique suffit, les rubriques se cumulent.
  const both = normalizeTracker({ talents: ['Draconic'], types: ['Hero'] });
  assert.deepEqual(trackerCards(INDEX, both).map((r) => r.name), ['Fang']);
});

test('complétion : possédés par identifiant ou par nom + pitch, plafonnés à l’objectif', () => {
  const rows = trackerCards(INDEX, normalizeTracker({ classes: ['Ninja'], language: 'ja' }), JA);
  const counts = {
    byId: new Map([['bittering-thorns-1', 2], ['bittering-thorns-1--inner-chi-1', 1], ['kunai-of-retribution', 4]]),
    byName: new Map([['bittering-thorns-1', 2], ['mask-of-momentum', 1]]),
  };
  const { rows: done, totals } = trackerProgress(rows, counts);
  assert.deepEqual(done.map((r) => [r.name, r.pitch, r.owned, r.missing]), [
    ['Bittering Thorns', 1, 3, 0],
    ['Bittering Thorns', 3, 0, 3],
    ['Flick Knives', null, 0, 1],
    ['Kunai of Retribution', null, 4, 0],
    ['Mask of Momentum', null, 1, 0],
  ]);
  // Objectifs 3 + 3 + 1 + 1 + 1 = 9 ; possédés (plafonnés) 3 + 0 + 0 + 1 + 1 = 5.
  assert.deepEqual(totals, { cards: 5, complete: 3, absent: 2, copies: 9, ownedCopies: 5, missing: 4, percent: 55.5 });
});

test('Legendary repéré dans le texte de règles ; fiche d’index', () => {
  assert.equal(isLegendary('**Legendary** _(You may only have 1 X in your deck.)_'), true);
  assert.equal(isLegendary('**Legendary Viserai Specialization** _(…)_'), true);
  assert.equal(isLegendary('When you arrive at the **legendary** Korshem'), false);
  const vocab = { types: ['Instant', 'Action'], classes: ['Generic'], talents: ['Mystic'] };
  const card = indexCard({ card_id: 'x-3', printed_name: 'X', printed_pitch: 3, printed_typebox: 'Mystic Instant', printed_rules_text: '**Legendary**', faces: [] }, vocab);
  assert.deepEqual(card, { cardId: 'x-3', name: 'X', pitch: 3, types: ['Instant'], classes: [], talents: ['Mystic'], legendary: true, imageUrl: null });
});

test('suivis enregistrés, décrits et supprimés', () => {
  const saved = saveTracker({ name: 'Ninja JA', classes: ['Ninja'], language: 'ja', ownedInLanguage: true });
  assert.equal(readTrackers().length, 1);
  assert.equal(
    describeTracker(saved),
    'Ninja · imprimées en japonais · exemplaires en japonais · objectif 3 (1 pour héros, armes, équipements, Legendary)',
  );
  saveTracker({ ...saved, name: 'Ninja japonais' });
  assert.deepEqual(readTrackers().map((t) => t.name), ['Ninja japonais']);
  deleteTracker(saved.id);
  assert.deepEqual(readTrackers(), []);
  // « Seulement dans cette langue » n'a de sens qu'avec une langue.
  assert.equal(normalizeTracker({ ownedInLanguage: true }).ownedInLanguage, false);
});
