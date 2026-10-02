// Les appels a CardNexus passent par le SDK officiel (js/vendor/cardnexus-sdk.js),
// puis par le pont natif : en-tetes, cle d'API, idempotence et reprises.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, toast, openPlace } from '../helpers/app.mjs';

after(close);

const requests = (page, filter) =>
  page.evaluate((source) => window.__requests.filter((r) => new RegExp(source).test(`${r.method} ${r.url}`)), filter);

test('requêtes du SDK : clé, en-têtes, idempotence stable après un 429, DELETE sans corps', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p1', 5, 'Vrac 1'), line('t', 'p3', 2, 'Corbeille')],
    locations: [place('Vrac 1'), place('Vrac 2'), place('Corbeille', 'box', 'black')],
  });

  await openPlace(page, 'Vrac 1');
  const [search] = await requests(page, '^POST .*/v1/inventory/search');
  assert.equal(search.headers.authorization, 'Bearer cnk_test');
  assert.ok(search.headers['x-scalar-lang'], 'en-têtes du SDK présents');
  assert.match(search.headers['content-type'], /application\/json/);

  // Un déplacement, rejoué après un 429 : la même clé d'idempotence.
  await page.click('#excess-btn');
  await toast(page, /en main/);
  await page.selectOption('#destination', 'Vrac 2');
  await page.evaluate(() => { window.__mock429 = 1; });
  await page.click('#apply-move');
  await toast(page, /Vrac 2/);
  const updates = await requests(page, '^POST .*/v1/inventory/bulk/update');
  assert.equal(updates.length, 2, 'un 429 puis la reprise');
  assert.ok(updates[0].headers['idempotency-key']);
  assert.equal(updates[0].headers['idempotency-key'], updates[1].headers['idempotency-key']);

  // Une suppression : DELETE sans corps (refusé par certaines piles HTTP Android).
  await page.evaluate(() => window.__appBack());
  await openPlace(page, 'Corbeille');
  await page.click('#select-all');
  await page.click('#delete-cards');
  await page.click('#confirm-ok');
  await toast(page, /supprimée/);
  const [del] = await requests(page, '^DELETE .*/v1/inventory/t$');
  assert.equal(del.body, null);
  assert.deepEqual(errors, []);
  await context.close();
});

test('une erreur de l’API devient un message lisible', async () => {
  const { page, context, errors } = await openApp({ inv: [line('a', 'p1', 1, 'Vrac 1')], locations: [place('Vrac 1')] });
  await page.waitForSelector('[data-place="Vrac 1"]');
  // Renommer vers un emplacement inconnu du faux serveur : 500 avec un message.
  await page.evaluate(() => { window.__mockLocations.length = 0; });
  await openPlace(page, 'Vrac 1');
  await page.click('#more-btn');
  await page.click('#rename-btn');
  await page.fill('#rename-input', 'Vrac 1 bis');
  await page.click('#rename-submit');
  await page.waitForFunction(() => /CardNexus a repondu 500\. 404 location/.test(document.querySelector('#rename-note').textContent));
  assert.deepEqual(errors, []);
  await context.close();
});
