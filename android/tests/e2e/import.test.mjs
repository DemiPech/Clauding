// Importer des cartes : extension, tri par rareté, raccourcis de quantité,
// finitions, ajout vers un emplacement, brouillon gardé et annulation.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, texts, toast, stock, back } from '../helpers/app.mjs';

after(close);

async function openImport(page) {
  await page.click('[data-tab="tools"]');
  await page.click('#tool-import');
  await page.waitForSelector('#import:not([hidden])');
  await page.waitForFunction(() => !document.querySelector('#import-expansion').disabled);
}

async function chooseExpansion(page) {
  await page.click('#import-expansion');
  await page.click('#expansion-groups [data-expansion="7"]');
  await page.waitForSelector('#import-body:not([hidden]) .import-card');
}

const card = (page, name) => page.locator('.import-card', { hasText: name });
const count = (page, name) => card(page, name).locator('.import-count').textContent();

test('compter les cartes d’une extension, triées par rareté, puis les ajouter', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'e1', 2, 'Vrac 3')],
    locations: [place('Vrac 3'), place('Deck A', 'deck', 'red')],
  });
  await openImport(page);
  assert.equal(await page.textContent('#app-title'), 'Importer');
  assert.equal(await page.textContent('#import-expansion'), 'Choisir une extension…');

  // Les extensions par famille, comme sur FaBrary, sans le code entre parenthèses.
  await page.click('#import-expansion');
  const groupTitles = () => page.$$eval('#expansion-groups h3', (h) => h.map((x) => x.textContent));
  assert.deepEqual(await groupTitles(), ['Core Set', 'Armory Deck', 'Blitz Deck']);
  assert.deepEqual(await texts(page, '#expansion-groups .expansion-option'), [
    'Heavy Hitters', 'Welcome to Rathe', 'Armory Deck: Kayo', 'Kayo Blitz Deck',
  ]);
  await page.fill('#expansion-filter', 'kayo');
  assert.deepEqual(await groupTitles(), ['Armory Deck', 'Blitz Deck']);
  assert.equal(await back(page), true);
  assert.equal(await page.isVisible('#expansion-sheet'), false);

  await chooseExpansion(page);
  assert.equal(await page.textContent('#import-expansion'), 'Heavy Hitters');

  // Par défaut, l'ordre des numéros de print.
  assert.equal(await page.$eval('#import-sort', (e) => e.value), 'number');
  assert.deepEqual(await texts(page, '#import-list .import-meta'), ['HVY001 · C', 'HVY002 · C', 'HVY003 · R', 'HVY004 · S']);

  // Sections par rareté, des communes aux plus rares ; « S » est reconnu comme Super Rare.
  await page.selectOption('#import-sort', 'rarity');
  assert.deepEqual(await texts(page, '#import-list .section-head h2'), ['Common', 'Rare', 'Super Rare']);
  assert.deepEqual(await texts(page, '#import-finishes .chip'), ['Standard', 'Rainbow', 'Cold']);
  assert.equal(await page.isVisible('#importbar'), false);

  // Un toucher = +1, +3, −1, Retirer.
  await card(page, 'Pummel').first().locator('.import-card-main').click();
  await card(page, 'Pummel').first().locator('.import-card-main').click();
  assert.equal(await card(page, 'Pummel').first().locator('.import-count').textContent(), '×2');
  await card(page, 'Beast Mode').locator('[data-act="plus3"]').click();
  await card(page, 'Beast Mode').locator('[data-act="minus"]').click();
  assert.equal(await count(page, 'Beast Mode'), '×2');
  await card(page, 'Ancestral').locator('[data-act="plus3"]').click();
  await card(page, 'Ancestral').locator('[data-act="clear"]').click();
  assert.equal(await count(page, 'Ancestral'), '0');

  // Une autre finition se compte à part ; la carte rappelle ce qui est déjà compté.
  await page.click('#import-finishes [data-finish="Cold Foil"]');
  assert.deepEqual(await texts(page, '#import-list .import-name'), ['Ancestral Empowerment', 'Kayo, Armed and Dangerous']);
  await card(page, 'Kayo').locator('.import-card-main').click();
  await page.click('#import-finishes [data-finish="Standard"]');
  assert.match(await card(page, 'Beast Mode').locator('.import-meta').textContent(), /^HVY003 · R/);

  // Filtre de rareté.
  await page.click('#import-rarities [data-rarity="rare"]');
  assert.deepEqual(await texts(page, '#import-list .import-name'), ['Beast Mode']);
  await page.click('#import-rarities [data-rarity="all"]');

  assert.equal(await page.isVisible('#importbar'), true);
  assert.equal(await page.textContent('#import-total'), '5 cartes · 3 différentes');

  await page.selectOption('#import-destination', 'Vrac 3');
  await page.click('#import-apply');
  assert.equal(await toast(page, /ajoutée/), '5 cartes ajoutées (« Vrac 3 »)');
  const s = await stock(page);
  assert.equal(s['Vrac 3:e1'], 4, 'la ligne existante grossit');
  assert.equal(s['Vrac 3:e3'], 2);
  assert.equal(s['Vrac 3:e5'], 1);
  assert.equal(await page.evaluate(() => window.__inv.find((l) => l.productId === 'e5').finish), 'Cold Foil');
  assert.equal(await page.isVisible('#importbar'), false);
  assert.equal(await count(page, 'Beast Mode'), '0');

  // L'historique garde l'import, et sait l'annuler.
  await page.click('[data-tab="history"]');
  const entry = page.locator('.journal-entry', { hasText: 'Import de cartes' });
  await entry.locator('.journal-head').click();
  assert.ok((await entry.locator('.journal-details li').allTextContents()).includes('2× Pummel (rouge) · HVY001'));
  await entry.locator('text=Annuler cet import').click();
  await page.click('#confirm-ok');
  assert.match(await toast(page, /retirée/), /5 cartes retirées de la collection/);
  assert.deepEqual(await stock(page), { 'Vrac 3:e1': 2 });
  assert.deepEqual(errors, []);
  await context.close();
});

test('le brouillon survit à la fermeture, et Tout effacer demande confirmation', async () => {
  const { page, context, errors } = await openApp({ inv: [], locations: [place('Vrac 1')] });
  await openImport(page);
  await chooseExpansion(page);
  await card(page, 'Beast Mode').locator('[data-act="plus3"]').click();
  await back(page);
  assert.equal(await page.isVisible('#importbar'), false, 'la barre suit l’écran');

  await page.reload();
  await page.waitForSelector('#places:not([hidden])');
  await openImport(page);
  await page.waitForSelector('#import-body:not([hidden]) .import-card');
  assert.equal(await page.textContent('#import-expansion'), 'Heavy Hitters');
  assert.equal(await count(page, 'Beast Mode'), '×3');
  assert.equal(await page.textContent('#import-total'), '3 cartes');

  await page.click('#import-clear');
  await page.click('#confirm-cancel');
  assert.equal(await count(page, 'Beast Mode'), '×3');
  await page.click('#import-clear');
  await page.click('#confirm-ok');
  assert.equal(await count(page, 'Beast Mode'), '0');
  assert.equal(await page.isVisible('#importbar'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('annuler depuis le bandeau retire seulement les exemplaires ajoutés', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'e3', 1, null)],
    locations: [place('Vrac 1')],
  });
  await openImport(page);
  await chooseExpansion(page);
  await card(page, 'Beast Mode').locator('.import-card-main').click();
  await card(page, 'Pummel').last().locator('[data-act="plus3"]').click();
  // Sans emplacement par défaut : Beast Mode rejoint la ligne existante.
  await page.click('#import-apply');
  await page.waitForFunction(() => !document.querySelector('#toast').hidden && !document.querySelector('#toast-undo').hidden);
  await page.click('#toast-undo');
  await toast(page, /retirée/);
  assert.deepEqual(await stock(page), { '∅:e3': 1 });
  assert.deepEqual(errors, []);
  await context.close();
});

test('ordre de la liste au choix, gardé ; ajout dans un emplacement créé sur place', async () => {
  const { page, context, errors } = await openApp({ inv: [], locations: [place('Vrac 1')] });
  await openImport(page);
  await chooseExpansion(page);

  await page.selectOption('#import-sort', 'pitch');
  assert.deepEqual(await texts(page, '#import-list .section-head h2'), ['Pitch rouge', 'Pitch bleu']);
  await page.selectOption('#import-sort', 'name');
  assert.deepEqual(await texts(page, '#import-list .import-name'), [
    'Ancestral Empowerment', 'Beast Mode', 'Pummel', 'Pummel',
  ]);

  await card(page, 'Beast Mode').locator('[data-act="plus3"]').click();
  await page.selectOption('#import-destination', '__nouveau__');
  assert.equal(await page.isVisible('#import-new-name'), true);

  // Sans nom, rien ne part.
  await page.click('#import-apply');
  assert.match(await toast(page, /nom/), /Donnez un nom/);
  assert.equal(await page.evaluate(() => window.__addCalls || 0), 0);

  await page.fill('#import-new-name', 'Classeur HVY');
  await page.click('#import-apply');
  assert.equal(await toast(page, /ajoutée/), '3 cartes ajoutées (« Classeur HVY »)');
  assert.deepEqual(await stock(page), { 'Classeur HVY:e3': 3 });
  const created = await page.evaluate(() => window.__mockLocations.find((l) => l.name === 'Classeur HVY'));
  assert.equal(created.icon, 'box');
  assert.equal(await page.$eval('#import-destination', (e) => e.value), 'Classeur HVY');
  assert.equal(await page.isVisible('#import-new-name'), false);

  // L'ordre choisi est retrouvé à la prochaine ouverture.
  await page.reload();
  await page.waitForSelector('#places:not([hidden])');
  await openImport(page);
  assert.equal(await page.$eval('#import-sort', (e) => e.value), 'name');
  assert.deepEqual(errors, []);
  await context.close();
});
