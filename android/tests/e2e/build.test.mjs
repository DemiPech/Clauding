// Monter une liste FaBrary dans CardNexus : récap des endroits où chercher,
// retouches manuelles, et suggestion de prendre dans un deck existant.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, texts, openFabrary, stock, toast } from '../helpers/app.mjs';

after(close);

async function computeBuild(page, newName) {
  await openFabrary(page);
  await page.click('#build-btn');
  if (newName) await page.fill('#build-new-name', newName);
  await page.click('#build-compute');
  await page.waitForSelector('#build-result:not([hidden])');
}

test('récap : le moins d’endroits possible, retouche puis réinitialisation', async () => {
  const { page, context, errors } = await openApp({
    inv: [
      line('h1', 'p4', 1, 'Deck A'), line('r1', 'p1', 2, 'Deck A'), line('r2', 'p1', 3, 'Binder'), line('r3', 'p1', 4, 'Boîte 1'),
      line('s1', 'p3', 2, 'Binder'), line('s2', 'p3', 3, 'Boîte 2'),
      line('b1', 'p2', 1, 'Binder', { finish: 'Rainbow Foil' }), line('b2', 'p2', 5, 'Boîte 3'),
    ],
    locations: [place('Deck A', 'deck', 'blue'), place('Binder'), place('Boîte 1'), place('Boîte 2'), place('Boîte 3')],
  });
  await computeBuild(page, 'Nouveau deck');
  const count = () => page.textContent('#build-pickup-count');
  // Ni Boîte 1 ni Boîte 2 : le Binder couvre déjà les rouges et les Sink Below.
  assert.equal(await count(), '3 endroits · 8 cartes');
  assert.deepEqual(await texts(page, '.pickup-place-head b'), ['Binder', 'Boîte 3', 'Deck A']);
  assert.equal(await page.isVisible('#build-reset'), false);

  // Retouche : un bleu pris dans le Binder (le foil) au lieu de la Boîte 3.
  const blue = page.locator('#build-rows > li').filter({ hasText: 'Buckwild' }).nth(1);
  await blue.locator('.build-row-head').click();
  await blue.locator('.line-row', { hasText: 'Boîte 3' }).locator('button[aria-label="Un de moins"]').click();
  await blue.locator('.line-row', { hasText: 'Binder' }).locator('button[aria-label="Un de plus"]').click();
  assert.equal(await page.isVisible('#build-reset'), true);
  await page.click('#build-reset');
  assert.equal(await count(), '3 endroits · 8 cartes');
  assert.equal(await page.isVisible('#build-reset'), false);

  await page.click('#build-apply');
  await toast(page, /Nouveau deck/);
  const s = await stock(page);
  assert.deepEqual(
    Object.fromEntries(Object.entries(s).filter(([k]) => k.startsWith('Nouveau deck'))),
    { 'Nouveau deck:p1': 3, 'Nouveau deck:p2': 2, 'Nouveau deck:p3': 2, 'Nouveau deck:p4': 1 },
  );
  assert.deepEqual(errors, []);
  await context.close();
});

test('suggestion : tout prendre dans un deck qui contient déjà la liste', async () => {
  const { page, context, errors } = await openApp({
    inv: [
      line('d1', 'p4', 1, 'Boulder - Cindra'), line('d2', 'p1', 3, 'Boulder - Cindra'),
      line('d3', 'p2', 2, 'Boulder - Cindra'), line('d4', 'p3', 2, 'Boulder - Cindra'),
      line('k1', 'p1', 3, 'Kallax'), line('v1', 'p2', 2, 'Vrac 5'), line('c1', 'p3', 2, 'Classeur'),
    ],
    locations: [place('Boulder - Cindra', 'deck', 'red'), place('Kallax'), place('Vrac 5'), place('Classeur')],
  });
  await computeBuild(page);
  const count = () => page.textContent('#build-pickup-count');
  // Le deck est protégé : le héros y est pris, le reste ailleurs.
  assert.equal(await count(), '4 endroits · 8 cartes');
  assert.equal(await page.isVisible('#build-deck-hint'), true);
  assert.match(await page.textContent('#build-deck-hint-text'), /Boulder - Cindra/);

  await page.click('#build-deck-hint-btn');
  await page.waitForFunction(() => document.querySelector('#build-pickup-count').textContent.startsWith('1 endroit'));
  assert.deepEqual(await texts(page, '.pickup-place-head b'), ['Boulder - Cindra']);
  assert.equal(await page.isChecked('#build-protect'), false);
  assert.equal(await page.isVisible('#build-deck-hint'), false);

  await page.check('#build-protect');
  await page.waitForFunction(() => document.querySelector('#build-pickup-count').textContent.startsWith('4 endroits'));
  assert.deepEqual(errors, []);
  await context.close();
});
