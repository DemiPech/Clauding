// Historique : journal des actions (et annulation), photos de la collection
// et cartes modifiées récemment.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, texts, toast, stock, openPlace, back } from '../helpers/app.mjs';

after(close);

test('journal : déplacement et suppression, annulation, survit au rechargement', async () => {
  const { page, context, errors } = await openApp({
    inv: [
      line('a', 'p1', 5, 'Vrac 1', { updatedAt: '2026-09-30T14:02:00Z' }),
      line('b', 'p3', 2, 'Vrac 1', { updatedAt: '2026-09-29T09:15:00Z' }),
      line('c', 'p5', 1, 'Corbeille', { updatedAt: '2026-09-20T18:00:00Z' }),
    ],
    locations: [place('Vrac 1'), place('Vrac 2'), place('Corbeille', 'box', 'black')],
  });
  await openPlace(page, 'Vrac 1');
  await page.click('#excess-btn');
  await toast(page, /en main/);
  await page.selectOption('#destination', 'Vrac 2');
  await page.click('#apply-move');
  await toast(page, /Vrac 2/);
  await back(page);
  await openPlace(page, 'Corbeille');
  await page.click('#select-all');
  await page.click('#delete-cards');
  await page.click('#confirm-ok');
  await toast(page, /supprimée/);
  await back(page);

  await page.click('[data-tab="history"]');
  await page.waitForSelector('#history:not([hidden]) .journal-entry');
  assert.equal((await texts(page, '.journal-entry .journal-kind')).length, 2);

  const move = page.locator('.journal-entry', { hasText: 'Déplacement' });
  await move.locator('.journal-head').click();
  assert.ok((await move.locator('.journal-details li').allTextContents()).some((t) => t.includes('Buckwild')));
  await move.locator('text=Annuler ce déplacement').click();
  await page.click('#confirm-ok');
  assert.match(await toast(page, /remises/), /2 cartes remises en place/);
  assert.deepEqual(await stock(page), { 'Vrac 1:p1': 5, 'Vrac 1:p3': 2 });

  await page.click('[data-history-tab="recent"]');
  await page.waitForSelector('#recent-list .recent-line');

  await page.reload();
  await page.waitForSelector('#places:not([hidden])');
  await page.click('[data-tab="history"]');
  assert.ok((await page.$$('.journal-entry')).length >= 2);
  assert.deepEqual(errors, []);
  await context.close();
});

test('photos : changements faits ailleurs, puis aucun changement', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p1', 5, 'Vrac 3'), line('b', 'p3', 3, 'Vrac 5'), line('c', 'p5', 2, null)],
    locations: [place('Vrac 3'), place('Vrac 5'), place('Boulder - Cindra', 'deck', 'red')],
  });
  await page.click('[data-tab="history"]');
  await page.click('[data-history-tab="changes"]');
  await page.click('#snapshot-now');
  assert.match(await toast(page, /photo/), /Première photo/);

  await page.evaluate(() => {
    const inv = window.__inv;
    const a = inv.find((l) => l.id === 'a');
    a.quantity = 3;
    inv.push({ ...a, id: 'a2', quantity: 2, location: 'Boulder - Cindra' });
    inv.find((l) => l.id === 'b').quantity = 2;
    inv.find((l) => l.id === 'c').location = 'Vrac 5';
    inv.push({ ...a, id: 'n', productId: 'p2', quantity: 3, location: 'Vrac 5', finish: 'Rainbow Foil' });
  });
  await page.click('#snapshot-now');
  const message = await toast(page, /changement/);
  assert.match(message, /changement/);
  const changes = (await texts(page, '#changes-list .journal-day')).join(' ');
  assert.match(changes, /Buckwild/);
  assert.match(changes, /Sink Below/);
  assert.match(changes, /Boulder - Cindra/);

  await page.click('#snapshot-now');
  await toast(page, /Aucun changement/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('collection_changes')).length), 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test('photo automatique au lancement quand la dernière est trop vieille', async () => {
  const old = JSON.stringify({ at: '2026-09-01T00:00:00Z', scope: 'fab', cards: 5, counts: { 'p1|Standard|NM|en|Vrac 1': 5 } });
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p1', 5, 'Vrac 1')],
    locations: [place('Vrac 1')],
    storage: { snapshot_interval_h: '24', collection_snapshot: old },
  });
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('collection_snapshot')).at !== '2026-09-01T00:00:00Z',
    null,
    { timeout: 20000 },
  );
  assert.deepEqual(errors, []);
  await context.close();
});
