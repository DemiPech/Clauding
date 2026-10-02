// Onglets, filtres de la Collection, retour Android, menu ⋯, barre du bas
// contextuelle, tirer pour actualiser, en-têtes et groupement par défaut.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, texts, toast, openPlace, openFabrary, back } from '../helpers/app.mjs';

after(close);

const activeTab = (page) => page.$eval('.tab.is-active', (e) => e.dataset.tab);
const menuItems = async (page) => {
  await page.click('#more-btn');
  const items = await texts(page, '#action-list .action-item');
  await back(page);
  return items;
};

test('onglets, filtres, recherche et retour', async () => {
  const { page, context, errors } = await openApp({
    inv: [
      line('h', 'p4', 1, 'Boulder - Cindra'), line('a', 'p1', 3, 'Boulder - Cindra'), line('b', 'p1', 4, 'Vrac 1'),
      line('c', 'p3', 2, 'Kallax - HNT'), line('d', 'p5', 1, null),
    ],
    locations: [
      place('Boulder - Cindra', 'deck', 'red'), place('Vrac 1'), place('Kallax - HNT', 'box', 'blue'), place('Classeur Blanc'),
    ],
  });
  assert.equal(await activeTab(page), 'collection');
  await page.waitForFunction(() => /cartes/.test(document.querySelector('[data-place="Boulder - Cindra"] .deck-card-sub')?.textContent || ''));

  await page.click('[data-kind="deck"]');
  assert.deepEqual(await texts(page, '#places-list .deck-card-name'), ['Boulder - Cindra']);
  await page.click('[data-kind="all"]');
  await page.fill('#collection-filter', 'vrac');
  assert.deepEqual(await texts(page, '#places-list .deck-card-name'), ['Vrac 1']);
  await page.fill('#collection-filter', '');

  await openPlace(page, 'Vrac 1');
  assert.equal(await activeTab(page), 'collection');
  await back(page);
  assert.equal(await page.isVisible('#places'), true);

  // Chercher un nom de carte : résultats, pas de barre du bas.
  await page.click('[data-tab="search"]');
  await page.fill('#deck-input', 'buck');
  await page.click('#load-btn');
  await page.waitForSelector('#places-search-results .result-card');
  assert.ok((await texts(page, '#places-search-results .result-card-head')).some((t) => t.includes('Buckwild')));
  assert.equal(await page.isVisible('#movebar'), false);

  // Un lien FaBrary ouvre la liste, retour → Chercher.
  await openFabrary(page);
  assert.equal(await page.textContent('#deck-name'), 'Liste test');
  assert.equal(await activeTab(page), 'search');
  await back(page);
  assert.equal(await page.isVisible('#search-view'), true);

  // Outils → Comparer un deck choisi, retour → Outils.
  await page.click('[data-tab="tools"]');
  await page.click('#tool-compare');
  const choices = await page.$$eval('#compare-deck option', (o) => o.map((x) => x.value));
  assert.equal(choices[0], 'Boulder - Cindra', 'les decks d’abord');
  await page.fill('#compare-input', 'https://fabrary.net/decks/01ABCDEFGH');
  await page.click('#compare-submit');
  await page.waitForSelector('#build-result:not([hidden])');
  await page.click('#app-back');
  assert.equal(await page.isVisible('#tools-view'), true);

  // Historique, retour → Collection, retour depuis la Collection → quitter.
  await page.click('[data-tab="history"]');
  assert.equal(await page.isVisible('#history'), true);
  assert.equal(await back(page), true);
  assert.equal(await page.isVisible('#places'), true);
  assert.equal(await back(page), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('menu ⋯ et barre du bas contextuelle', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('h', 'p4', 1, 'Boulder - Cindra'), line('a', 'p1', 5, 'Vrac 1', { tags: ['Trade'] }), line('b', 'p3', 2, 'Vrac 1')],
    locations: [place('Boulder - Cindra', 'deck', 'red'), place('Vrac 1'), place('Vrac 2')],
  });
  await openPlace(page, 'Vrac 1');
  assert.equal(await page.isVisible('#movebar'), false);
  const placeMenu = await menuItems(page);
  assert.ok(placeMenu.some((t) => t.startsWith('Renommer')), placeMenu.join(' | '));
  assert.ok(placeMenu.some((t) => t.startsWith('Retirer les tags')), placeMenu.join(' | '));
  assert.equal(await page.isVisible('#actions'), false);

  await page.click('#excess-btn');
  await toast(page, /en main/);
  assert.equal(await page.isVisible('#movebar'), true);
  assert.match(await page.textContent('#basket-toggle'), /2 en main/);
  await page.click('#clear-basket');
  assert.equal(await page.isVisible('#movebar'), false);

  await page.click('#search-toggle');
  assert.equal(await page.isVisible('#move-search'), true);
  await page.click('#search-toggle');
  assert.equal(await page.isVisible('#movebar'), false);

  await back(page);
  await openPlace(page, 'Boulder - Cindra');
  assert.ok((await menuItems(page)).some((t) => t.startsWith('Comparer')));
  await page.click('#more-btn');
  await page.click('#copy-btn');
  assert.equal(await page.isVisible('#actions'), false);

  await openFabrary(page);
  assert.equal(await page.isVisible('#build-btn'), true);
  assert.ok((await menuItems(page)).some((t) => t.includes('FaBrary')));
  assert.deepEqual(errors, []);
  await context.close();
});

test('tirer vers le bas et ↻ actualisent les emplacements', async () => {
  const { page, context, errors } = await openApp({ inv: [line('a', 'p1', 2, 'Vrac 1')], locations: [place('Vrac 1')] });
  await page.waitForSelector('[data-place="Vrac 1"]');
  const names = () => page.$$eval('#places-list .deck-card-name', (e) => e.map((x) => x.textContent));
  await page.evaluate(() => window.__mockLocations.push({ name: 'Vrac 9', color: 'white', icon: 'box' }));

  const pull = (dy) => page.evaluate((dy) => {
    const t = (y) => new Touch({ identifier: 1, target: document.body, clientX: 200, clientY: y });
    document.body.dispatchEvent(new TouchEvent('touchstart', { touches: [t(150)], bubbles: true }));
    for (let y = 150; y <= 150 + dy; y += 20) document.body.dispatchEvent(new TouchEvent('touchmove', { touches: [t(y)], bubbles: true }));
    document.body.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
  }, dy);
  await pull(40);
  assert.ok(!(await names()).includes('Vrac 9'), 'un petit geste ne doit pas actualiser');
  await pull(120);
  await toast(page, /actualisée/);
  assert.ok((await names()).includes('Vrac 9'));
  assert.equal(await page.$eval('#ptr', (e) => e.dataset.state), 'idle');

  await page.evaluate(() => window.__mockLocations.push({ name: 'Classeur Rouge', color: 'red', icon: 'box' }));
  await page.click('#places-refresh');
  await page.waitForFunction(() => [...document.querySelectorAll('#places-list .deck-card-name')].some((e) => e.textContent === 'Classeur Rouge'));
  assert.deepEqual(errors, []);
  await context.close();
});

test('en-têtes : toutes les cartes comptées ; groupement par défaut', async () => {
  const { page, context, errors } = await openApp({
    inv: [
      line('h', 'p4', 1, 'Bastion Bleu - Scurv'), line('a', 'p1', 3, 'Bastion Bleu - Scurv'),
      line('b', 'p2', 2, 'Bastion Bleu - Scurv'), line('c', 'p3', 2, 'Bastion Bleu - Scurv'),
      line('d', 'p3', 2, 'Vrac 1'), line('e', 'p5', 2, 'Vrac 1'),
    ],
    locations: [place('Bastion Bleu - Scurv', 'deck', 'blue'), place('Vrac 1')],
    classes: { p1: ['Brute'], p2: ['Brute'], p3: ['Generic'], p4: ['Warrior'], p5: ['Ninja'] },
  });
  await openPlace(page, 'Bastion Bleu - Scurv');
  assert.deepEqual(await texts(page, '#deck-stats .stat'), ['8 cartes', '4 différentes']);
  assert.equal(await page.$eval('#group-select', (e) => e.value), 'pitch');
  await back(page);

  await openPlace(page, 'Vrac 1');
  assert.equal(await page.$eval('#group-select', (e) => e.value), 'classTalent');
  assert.deepEqual(await texts(page, '#sections .section-head h2'), ['Generic', 'Ninja']);
  await page.selectOption('#group-select', 'type');
  await back(page);

  await openFabrary(page);
  assert.deepEqual(await texts(page, '#deck-stats .stat'), ['8 cartes', '4 différentes']);
  assert.deepEqual(errors, []);
  await context.close();
});
