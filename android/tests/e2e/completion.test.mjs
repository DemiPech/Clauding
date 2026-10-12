// Communes et rares à compléter : toutes éditions confondues, puis par extension.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, texts, back } from '../helpers/app.mjs';

after(close);

// Catalogue simulé : Buckwild (C), Sink Below (C, p3 et sa réimpression e8),
// Pummel rouge et bleu (C), Beast Mode (R) ; plus des cartes hors sujet
// (super rare, majestic, héros, token, basique).
const RARITY = { p1: 'Common', p2: 'Common', p3: 'Common', p4: 'Majestic', p5: 'Majestic' };
const INV = [
  line('a', 'p1', 2, 'Vrac 1'), line('b', 'p1', 1, 'Classeur'), // Buckwild rouge : 3, complet
  line('c', 'p3', 2, 'Vrac 1'), line('d', 'e8', 2, 'Deck A'), // Sink Below : 2 + 2 réimpression = 4
  line('e', 'e1', 1, 'Vrac 2', { finish: 'Rainbow Foil' }), // Pummel rouge : 1
  line('f', 'e3', 2, 'Vrac 2'), // Beast Mode : 2
];

const rowsText = (page) => texts(page, '.completion-row');

test('toutes éditions confondues : les réimpressions s’additionnent', async () => {
  const { page, context, errors } = await openApp({
    inv: INV,
    locations: [place('Vrac 1'), place('Vrac 2'), place('Classeur'), place('Deck A', 'deck', 'red')],
    rarity: RARITY,
  });
  await page.click('[data-tab="tools"]');
  await page.click('#tool-completion');
  assert.equal(await page.textContent('#app-title'), 'À compléter');
  assert.equal(await page.isVisible('#completion-expansion-field'), false);
  await page.click('#completion-run');
  await page.waitForSelector('#completion-result:not([hidden])');

  assert.deepEqual(await texts(page, '#completion-stats .stat'), [
    '4 cartes à compléter', '9 exemplaires manquants', '2 cartes absentes',
  ]);
  await page.selectOption('#completion-group', 'name');
  assert.deepEqual(await rowsText(page), [
    'Beast Mode R · HVY003 2 / 3 −1',
    'Buckwild C · Xp2 0 / 3 −3',
    'Pummel C · HVY001 1 / 3 −2',
    'Pummel C · HVY002 0 / 3 −3',
  ]);

  // Filtre de rareté et texte copié.
  await page.click('#completion-rarities [data-rarity="rare"]');
  assert.deepEqual(await rowsText(page), ['Beast Mode R · HVY003 2 / 3 −1']);
  await page.click('#completion-rarities [data-rarity=""]');

  // Objectif 2 : Beast Mode (2) n'est plus à compléter.
  await page.selectOption('#completion-target', '2');
  await page.click('#completion-run');
  await page.waitForFunction(() => document.querySelectorAll('.completion-row').length === 3);
  // Le catalogue est gardé : une seconde recherche ne le relit pas.
  assert.equal(await page.evaluate(() => window.__catalogCalls), 2, 'une requête par rareté, une seule fois');
  await back(page);
  assert.equal(await page.isVisible('#tools-view'), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('par extension : seule l’impression de l’extension compte', async () => {
  const { page, context, errors } = await openApp({
    inv: INV,
    locations: [place('Vrac 1'), place('Vrac 2'), place('Classeur'), place('Deck A', 'deck', 'red')],
    rarity: RARITY,
  });
  await page.click('[data-tab="tools"]');
  await page.click('#tool-completion-set');
  assert.equal(await page.isDisabled('#completion-run'), true, 'il faut choisir une extension');
  await page.click('#completion-expansion');
  await page.click('#expansion-groups [data-expansion="8"]');
  await page.waitForSelector('#completion-result:not([hidden])');
  // Armory Deck: Kayo ne contient que Sink Below : 2 exemplaires de cette impression.
  assert.deepEqual(await rowsText(page), ['Sink Below C · AKO008 2 / 3 −1']);

  await page.click('#completion-expansion');
  await page.click('#expansion-groups [data-expansion="7"]');
  await page.waitForFunction(() => document.querySelectorAll('.completion-row').length === 3);
  await page.selectOption('#completion-group', 'name');
  assert.deepEqual(await rowsText(page), [
    'Beast Mode R · HVY003 2 / 3 −1',
    'Pummel C · HVY001 1 / 3 −2',
    'Pummel C · HVY002 0 / 3 −3',
  ]);
  // Sans armes ni équipements : aucune ici, même résultat.
  await page.uncheck('#completion-gear');
  await page.click('#completion-run');
  await page.waitForFunction(() => document.querySelectorAll('.completion-row').length === 3);
  assert.deepEqual(errors, []);
  await context.close();
});
