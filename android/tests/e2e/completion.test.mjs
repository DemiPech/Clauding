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
  assert.equal(await page.textContent('#app-title'), 'Cartes à compléter');
  assert.equal(await page.isVisible('#completion-expansion-field'), false);
  await page.click('#completion-run');
  await page.waitForSelector('#completion-result:not([hidden])');

  assert.deepEqual(await texts(page, '#completion-stats .stat'), [
    '4 cartes à compléter', '9 exemplaires manquants', '2 cartes absentes', '≈ 0,00 € pour compléter (4 sans prix)',
  ]);
  await page.selectOption('#completion-group', 'name');
  assert.deepEqual(await rowsText(page), [
    'Beast Mode R · HVY003 2 / 3 — −1',
    'Buckwild C · Xp2 0 / 3 — −3',
    'Pummel C · HVY001 1 / 3 — −2',
    'Pummel C · HVY002 0 / 3 — −3',
  ]);

  // Filtre de rareté et texte copié.
  await page.click('#completion-rarities [data-rarity="rare"]');
  assert.deepEqual(await rowsText(page), ['Beast Mode R · HVY003 2 / 3 — −1']);
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
  await page.click('#tool-completion');
  await page.click('#completion-modes [data-mode="expansion"]');
  assert.equal(await page.isVisible('#completion-expansion-field'), true);
  assert.equal(await page.isDisabled('#completion-run'), true, 'il faut choisir une extension');
  await page.click('#completion-expansion');
  await page.click('#expansion-groups [data-expansion="8"]');
  await page.waitForSelector('#completion-result:not([hidden])');
  // Armory Deck: Kayo ne contient que Sink Below : 2 exemplaires de cette impression.
  assert.deepEqual(await rowsText(page), ['Sink Below C · AKO008 2 / 3 — −1']);

  await page.click('#completion-expansion');
  await page.click('#expansion-groups [data-expansion="7"]');
  await page.waitForFunction(() => document.querySelectorAll('.completion-row').length === 3);
  await page.selectOption('#completion-group', 'name');
  assert.deepEqual(await rowsText(page), [
    'Beast Mode R · HVY003 2 / 3 — −1',
    'Pummel C · HVY001 1 / 3 — −2',
    'Pummel C · HVY002 0 / 3 — −3',
  ]);
  // Sans armes ni équipements : aucune ici, même résultat.
  await page.uncheck('#completion-gear');
  await page.click('#completion-run');
  await page.waitForFunction(() => document.querySelectorAll('.completion-row').length === 3);
  assert.deepEqual(errors, []);
  await context.close();
});

test('majestics et légendaires : prix, coût total et tri par prix', async () => {
  const { page, context, errors } = await openApp({
    // Enlightened Strike (p5) majestic : 1 possédé ; Dorinthea (p4) héros légendaire ;
    // « Kayo » (e5) majestic de HVY, une action ici ; Ancestral Empowerment (super rare) hors sujet.
    inv: [line('a', 'p5', 1, 'Classeur')],
    locations: [place('Classeur')],
    rarity: { p4: 'Legendary', p5: 'Majestic' },
    prices: { p4: 45, p5: 12.5, e5: 8.2 },
  });
  await page.click('[data-tab="tools"]');
  await page.click('#tool-completion');
  await page.click('#completion-tiers [data-tier="ml"]');
  assert.equal(await page.textContent('#completion-title'), 'Majestics et légendaires');
  await page.click('#completion-run');
  await page.waitForSelector('#completion-result:not([hidden])');

  // Coût : 2 × 12,50 + 1 × 45 (héros : un exemplaire) + 3 × 8,20 = 94,60 €.
  assert.deepEqual(await texts(page, '#completion-stats .stat'), [
    '3 cartes à compléter', '6 exemplaires manquants', '2 cartes absentes', '≈ 94,60 € pour compléter',
  ]);
  await page.selectOption('#completion-group', 'price-desc');
  assert.deepEqual(await texts(page, '.completion-name'), ['Dorinthea Ironsong', 'Enlightened Strike', 'Kayo, Armed and Dangerous']);
  assert.deepEqual(await texts(page, '.completion-price'), ['45,00 €', '12,50 €', '8,20 €']);
  await page.selectOption('#completion-group', 'price-asc');
  assert.deepEqual(await texts(page, '.completion-name'), ['Kayo, Armed and Dangerous', 'Enlightened Strike', 'Dorinthea Ironsong']);
  assert.deepEqual(await texts(page, '#completion-rarities .chip'), ['Toutes', 'Majestics', 'Légendaires']);

  // Passer aux communes et rares depuis l'écran remet le résultat à zéro.
  await page.click('#completion-tiers [data-tier="cr"]');
  assert.equal(await page.textContent('#completion-title'), 'Communes et rares');
  assert.equal(await page.isVisible('#completion-result'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('catalogue Card Vault : toutes les cartes, prix CardNexus', async () => {
  // Card Vault liste aussi une carte Pirate que CardNexus ne connaît pas ;
  // Buckwild bleue (commune chez CardNexus) n'y est pas : ignorée.
  const V = (cardId, name, pitch, typebox, printId) => ({
    card_id: cardId, print_id: printId, printed_name: name, printed_pitch: pitch, printed_typebox: typebox,
    core_talent: null, faces: [{ layout_position: 10, image: { small: null } }],
  });
  const vault = {
    common: [
      V('buckwild-1', 'Buckwild', 1, 'Brute Action - Attack', 'WTR001'),
      V('sink-below-1', 'Sink Below', 1, 'Generic Defense Reaction', 'WTR215'),
      V('pummel-1', 'Pummel', 1, 'Generic Action - Attack', 'HVY001'),
      V('pummel-3', 'Pummel', 3, 'Generic Action - Attack', 'HVY002'),
      V('jolly-roger-1', 'Jolly Roger', 1, 'Pirate Action - Attack', 'SEA100'),
    ],
    rare: [V('beast-mode-1', 'Beast Mode', 1, 'Brute Action - Attack', 'HVY003')],
  };
  const { page, context, errors } = await openApp({
    inv: INV,
    locations: [place('Vrac 1'), place('Vrac 2'), place('Classeur'), place('Deck A', 'deck', 'red')],
    rarity: RARITY,
    prices: { e1: 0.5, e2: 0.25 },
    vault,
  });
  await page.click('[data-tab="tools"]');
  await page.click('#tool-completion');
  await page.click('#completion-run');
  await page.waitForSelector('#completion-result:not([hidden])');

  assert.equal(await page.textContent('#completion-note'), '');
  // Pummel 2 + 3, Beast Mode 1, Jolly Roger 3 ; coût 2 × 0,50 + 3 × 0,25.
  assert.deepEqual(await texts(page, '#completion-stats .stat'), [
    '4 cartes à compléter', '9 exemplaires manquants', '2 cartes absentes', '≈ 1,75 € pour compléter (2 sans prix)',
  ]);
  await page.selectOption('#completion-group', 'name');
  assert.deepEqual(await texts(page, '.completion-name'), ['Beast Mode', 'Jolly Roger', 'Pummel', 'Pummel']);
  assert.deepEqual(await texts(page, '.completion-count'), ['2 / 3', '0 / 3', '1 / 3', '0 / 3']);
  assert.deepEqual(await texts(page, '.completion-price'), ['—', '—', '0,50 €', '0,25 €']);
  // Classes de Card Vault : Pirate compris.
  await page.selectOption('#completion-group', 'class');
  assert.deepEqual(await texts(page, '#completion-list h2'), ['Brute', 'Generic', 'Pirate']);

  // Filtre de classes : n'en garder que quelques-unes.
  await page.selectOption('#completion-group', 'name');
  await page.click('#completion-classes');
  assert.equal(await page.textContent('#choice-sheet-title'), 'Classes');
  assert.deepEqual(await texts(page, '.choice-label'), ['Brute', 'Generic', 'Pirate']);
  assert.deepEqual(await texts(page, '.choice-count'), ['1', '2', '1']);
  await page.check('.choice-option input[value="Pirate"]');
  await page.check('.choice-option input[value="Brute"]');
  assert.deepEqual(await texts(page, '.completion-name'), ['Beast Mode', 'Jolly Roger']);
  await back(page);
  assert.equal(await page.isVisible('#choice-sheet'), false, 'retour : ferme la feuille');
  assert.equal(await page.textContent('#completion-classes'), 'Classes : Pirate, Brute');

  // Filtre d'extensions, nommées d'après CardNexus quand elle les connaît.
  await page.click('#completion-expansions');
  assert.deepEqual(await texts(page, '.choice-label'), ['Heavy Hitters', 'SEA']);
  await page.check('.choice-option input[value="SEA"]');
  await page.click('#choice-close');
  assert.deepEqual(await texts(page, '.completion-name'), ['Jolly Roger']);
  assert.equal(await page.textContent('#completion-expansions'), 'Extensions : SEA');
  await page.click('#completion-expansions');
  await page.click('#choice-all');
  await page.click('#choice-close');
  assert.deepEqual(await texts(page, '.completion-name'), ['Beast Mode', 'Jolly Roger']);

  // Gardé une semaine : une seconde recherche ne relit ni Card Vault ni CardNexus.
  const calls = await page.evaluate(() => [window.__cardVaultCalls, window.__catalogCalls]);
  await page.click('#completion-run');
  await page.waitForSelector('#completion-result:not([hidden])');
  assert.deepEqual(await page.evaluate(() => [window.__cardVaultCalls, window.__catalogCalls]), calls);

  // Un seul outil : il se rouvre sur le palier, le mode et les classes choisis.
  await page.click('#completion-tiers [data-tier="ml"]');
  await page.reload();
  await page.waitForSelector('#places:not([hidden])');
  await page.click('[data-tab="tools"]');
  await page.click('#tool-completion');
  assert.equal(await page.textContent('#completion-title'), 'Majestics et légendaires');
  assert.equal(await page.textContent('#completion-classes'), 'Classes : Pirate, Brute');
  assert.deepEqual(errors, []);
  await context.close();
});
