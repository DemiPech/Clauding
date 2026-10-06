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
  // Par défaut, un emplacement de rangement est groupé par classe + talent.
  assert.equal(await page.$eval('#group-select', (e) => e.value), 'classTalent');
  assert.deepEqual(await sections(page), ['Brute', 'Pirate', 'Shadow Necromancer']);
  await page.selectOption('#group-select', 'class');
  assert.deepEqual(await sections(page), ['Brute', 'Necromancer', 'Pirate']);
  // Buckwild est inconnue de FaBrary : le lot échoue, puis le reste est redemandé.
  assert.equal(await page.evaluate(() => window.__fabraryCardCalls), 2, 'le lot, puis le lot sans la carte inconnue');

  // Gardé sur le téléphone : un nouveau lancement ne redemande rien.
  // Rechargée, l'app rouvre directement l'emplacement (il est dans l'adresse).
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#app-title').textContent === 'Vrac 1' && !document.querySelector('#deck').hidden);
  assert.deepEqual(await sections(page), ['Brute', 'Pirate', 'Shadow Necromancer']);
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
  await page.selectOption('#group-select', 'class');
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
  await page.selectOption('#group-select', 'class');
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

test('talents inconnus de CardNexus (Revered, Reviled) : complétés, sans toucher à la classe', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p1', 2, 'Vrac 1'), line('b', 'p5', 1, 'Vrac 1')],
    locations: [place('Vrac 1')],
    classes: { p1: ['Warrior'], p5: ['Warrior'] },
    talents: { p1: [], p5: ['Light'] },
  });
  await page.evaluate(() => {
    // FaBrary dit autre chose pour la classe : celle de CardNexus est gardée.
    window.__mockFabraryCards = { 'buckwild-red': { classes: ['Guardian'], talents: ['REVERED'] } };
  });
  await openPlace(page, 'Vrac 1');
  assert.deepEqual(await sections(page), ['Light Warrior', 'Revered Warrior']);
  // Enlightened Strike a déjà un talent chez CardNexus : seul Buckwild est demandé.
  const asked = await page.evaluate(() =>
    window.__requests
      .filter((r) => r.url.includes('appsync') && r.body.includes('getCard'))
      .flatMap((r) => Object.values(JSON.parse(r.body).variables)),
  );
  assert.deepEqual(asked, ['buckwild-red']);
  assert.deepEqual(errors, []);
  await context.close();
});
