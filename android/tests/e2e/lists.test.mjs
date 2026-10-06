// Decklists du site officiel fabtcg.com, et historique des listes consultées.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, texts, openFabrary, back } from '../helpers/app.mjs';

after(close);

const PATH = '/decklists/michel-verissimo-da-silva-luiz-fang-dracai-of-blades-100th-calling-atlanta/';
const URL = `https://fabtcg.com${PATH}`;
const PAGE = `<html><head><title>Michel Verissimo Da Silva Luiz &#8211; Fang, Dracai of Blades &#8211; 100th Calling Atlanta</title></head>
<body><h1>Michel Verissimo Da Silva Luiz &#8211; Fang, Dracai of Blades &#8211; 100th Calling Atlanta</h1>
<h3>Hero / Weapon / Equipment</h3><ul><li>1 x Fang, Dracai of Blades</li><li>2 x Kunai of Retribution</li></ul>
<h3>Pitch 1</h3><ul><li>3 x Buckwild (1)</li><li>2 x Mystery Card (1)</li></ul>
<h3>Pitch 3</h3><ul><li>2 x Buckwild (3)</li></ul></body></html>`;

const CARDS = {
  'fang-dracai-of-blades': { name: 'Fang, Dracai of Blades', types: ['Hero'], classes: ['Warrior'], talents: ['Draconic'], defaultImage: null, life: 20, intellect: 4 },
  'kunai-of-retribution': { name: 'Kunai of Retribution', types: ['Weapon'], subtypes: ['Dagger'], classes: ['Warrior'], defaultImage: null },
  'buckwild-red': { name: 'Buckwild', pitch: 1, types: ['Action'], subtypes: ['Attack'], classes: ['Generic'], defaultImage: null },
  'buckwild-blue': { name: 'Buckwild', pitch: 3, types: ['Action'], subtypes: ['Attack'], classes: ['Generic'], defaultImage: null },
};

async function openFabtcg(page) {
  await page.click('[data-tab="search"]');
  await page.fill('#deck-input', URL);
  await page.click('#load-btn');
  await page.waitForSelector('#deck:not([hidden])');
}

test('une decklist fabtcg.com s’ouvre comme une liste FaBrary et se monte', async () => {
  const { page, context, errors } = await openApp({ inv: [line('a', 'p1', 3, 'Vrac 1')], locations: [place('Vrac 1')] });
  await page.evaluate(({ path, html, cards }) => {
    window.__mockFabtcgPages = { [path]: html };
    window.__mockFabraryCards = cards;
  }, { path: PATH, html: PAGE, cards: CARDS });

  await openFabtcg(page);
  assert.equal(await page.textContent('#app-title'), 'Michel Verissimo Da Silva Luiz – Fang, Dracai of Blades – 100th Calling Atlanta');
  assert.equal(await page.textContent('#deck-hero-line'), 'Fang, Dracai of Blades · 100th Calling Atlanta');
  assert.equal(await page.textContent('#deck-byline'), 'par Michel Verissimo Da Silva Luiz');
  // Héros (1) + 2 kunai + 3 + 2 Buckwild + 2 cartes inconnues de FaBrary = 10.
  assert.deepEqual(await texts(page, '#deck-stats .stat'), ['10 cartes', '5 différentes']);
  assert.match(await page.textContent('#deck-notes'), /non reconnues par FaBrary.*Mystery Card/);
  assert.equal(await page.isVisible('#build-btn'), true, 'Monter dans CardNexus');
  await page.click('#more-btn');
  assert.equal(await page.textContent('#fabrary-link'), 'Voir sur fabtcg.com ↗');
  assert.equal(await page.getAttribute('#fabrary-link', 'href'), URL);
  await back(page);

  // Le plan de montage fonctionne avec ce lien.
  await page.click('#build-btn');
  await page.fill('#build-new-name', 'Fang');
  await page.click('#build-compute');
  await page.waitForSelector('#build-result:not([hidden])');
  assert.match(await page.textContent('#build-pickup-count'), /endroit/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('historique des listes : par héros, filtre, réouverture et retrait', async () => {
  const { page, context, errors } = await openApp({ inv: [], locations: [place('Vrac 1')] });
  await page.evaluate(({ path, html, cards }) => {
    window.__mockFabtcgPages = { [path]: html };
    window.__mockFabraryCards = cards;
  }, { path: PATH, html: PAGE, cards: CARDS });

  await page.click('[data-tab="search"]');
  assert.equal(await page.isVisible('#list-history'), false, 'vide au départ');

  await openFabtcg(page);
  await back(page);
  await openFabrary(page);
  await back(page);

  assert.equal(await page.isVisible('#list-history'), true);
  const titles = () => page.$$eval('#list-history-groups h2', (h) => h.map((x) => x.textContent));
  // Le héros consulté le plus récemment en premier.
  assert.deepEqual(await titles(), ['Dorinthea Ironsong', 'Fang, Dracai of Blades']);
  assert.deepEqual(await texts(page, '#list-history-heroes .chip'), [
    'Tous (2)', 'Dorinthea Ironsong (1)', 'Fang, Dracai of Blades (1)',
  ]);
  assert.match((await texts(page, '.history-list-meta'))[1], /Michel Verissimo Da Silva Luiz · 100th Calling Atlanta · fabtcg\.com/);

  // Filtrer par héros.
  await page.click('#list-history-heroes [data-hero="Fang, Dracai of Blades"]');
  assert.deepEqual(await titles(), ['Fang, Dracai of Blades']);

  // Rouvrir depuis l'historique (sans recharger la page fabtcg.com : cache).
  const calls = await page.evaluate(() => window.__fabtcgCalls);
  await page.click('.history-list-open');
  await page.waitForSelector('#deck:not([hidden])');
  assert.equal(await page.textContent('#deck-hero-line'), 'Fang, Dracai of Blades · 100th Calling Atlanta');
  assert.equal(await page.evaluate(() => window.__fabtcgCalls), calls);
  await back(page);

  // Une liste rouverte remonte en tête.
  await page.click('#list-history-heroes [data-hero=""]');
  assert.deepEqual(await titles(), ['Fang, Dracai of Blades', 'Dorinthea Ironsong']);

  // Retirer une liste.
  await page.locator('.history-list', { hasText: 'Liste test' }).locator('[data-act="remove"]').click();
  assert.deepEqual(await titles(), ['Fang, Dracai of Blades']);
  assert.equal(await page.isVisible('#list-history-heroes'), false, 'un seul héros : pas de filtres');

  // Gardé sur le téléphone.
  await page.goto('https://appassets.androidplatform.net/index.html');
  await page.waitForSelector('#places:not([hidden])');
  await page.click('[data-tab="search"]');
  assert.deepEqual(await titles(), ['Fang, Dracai of Blades']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('page fabtcg.com introuvable : message clair', async () => {
  const { page, context, errors } = await openApp({ inv: [], locations: [place('Vrac 1')] });
  await page.click('[data-tab="search"]');
  await page.fill('#deck-input', 'https://fabtcg.com/decklists/n-existe-pas/');
  await page.click('#load-btn');
  await page.waitForSelector('#state-error:not([hidden])');
  assert.match(await page.textContent('#error-message'), /n'existe pas sur fabtcg\.com/);
  assert.deepEqual(errors, []);
  await context.close();
});
