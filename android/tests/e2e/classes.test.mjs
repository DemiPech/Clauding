// Classes absentes de CardNexus (Pirate, Necromancer…) completees par FaBrary,
// gardees sur le telephone, et sans gener l'app quand FaBrary ne repond pas.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, texts, openPlace, back } from '../helpers/app.mjs';

after(close);

const sections = (page) => texts(page, '#sections .section-head h2');

test('les cartes sans classe chez CardNexus prennent celle de FaBrary', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p1', 2, 'Vrac 1'), line('b', 'p3', 1, 'Vrac 1'), line('c', 'p5', 3, 'Vrac 1')],
    locations: [place('Vrac 1')],
    // CardNexus : Sink Below sans classe, Enlightened Strike « NotClassed ».
    classes: { p1: ['Brute'], p3: [], p5: ['NotClassed'] },
  });
  await page.evaluate(() => {
    window.__mockFabraryCards = {
      'sink-below-red': { classes: ['NECROMANCER'], talents: ['SHADOW'] },
      'enlightened-strike-red': { classes: ['Pirate'], talents: [] },
    };
  });
  await openPlace(page, 'Vrac 1');
  assert.deepEqual(await sections(page), ['Brute', 'Necromancer', 'Pirate']);
  // Les talents manquants viennent aussi de FaBrary.
  await page.selectOption('#group-select', 'classTalent');
  assert.ok((await sections(page)).includes('Shadow Necromancer'));
  assert.equal(await page.evaluate(() => window.__fabraryCardCalls), 1, 'une seule requête pour les deux cartes');

  // Gardé sur le téléphone : un nouveau lancement ne redemande rien.
  // Rechargée, l'app rouvre directement l'emplacement (il est dans l'adresse).
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#app-title').textContent === 'Vrac 1' && !document.querySelector('#deck').hidden);
  assert.deepEqual(await sections(page), ['Brute', 'Necromancer', 'Pirate']);
  assert.equal(await page.evaluate(() => window.__fabraryCardCalls || 0), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('FaBrary injoignable : la carte reste sans classe, sans erreur', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p1', 2, 'Vrac 1'), line('b', 'p3', 1, 'Vrac 1')],
    locations: [place('Vrac 1')],
    classes: { p1: ['Brute'], p3: [] },
  });
  await page.evaluate(() => { window.__mockFabraryDown = true; });
  await openPlace(page, 'Vrac 1');
  assert.deepEqual(await sections(page), ['Brute', 'Sans classe']);
  assert.equal(await page.evaluate(() => localStorage.getItem('fabrary_classes')), null, 'rien de gardé');
  await back(page);
  assert.deepEqual(errors, []);
  await context.close();
});

test('une carte inconnue de FaBrary est notée, et pas redemandée tout de suite', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('b', 'p3', 1, 'Vrac 1')],
    locations: [place('Vrac 1')],
    classes: { p3: [] },
  });
  await openPlace(page, 'Vrac 1');
  assert.deepEqual(await sections(page), ['Sans classe']);
  const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('fabrary_classes')));
  assert.equal(cache['sink-below-red'].missing, true);
  // Rechargée, l'app rouvre directement l'emplacement (il est dans l'adresse).
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#app-title').textContent === 'Vrac 1' && !document.querySelector('#deck').hidden);
  assert.equal(await page.evaluate(() => window.__fabraryCardCalls || 0), 0);
  assert.deepEqual(errors, []);
  await context.close();
});
