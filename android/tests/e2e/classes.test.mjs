// Classes absentes de CardNexus (Pirate, Necromancer…) completees par Card
// Vault, gardees sur le telephone, et sans gener l'app quand Card Vault ne
// repond pas.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, texts, openPlace, back } from '../helpers/app.mjs';

after(close);

const { vaultItem } = await import('../fixtures/fabtcg-decklist.mjs');
const sections = (page) => texts(page, '#sections .section-head h2');

test('les cartes sans classe chez CardNexus prennent celle de Card Vault', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p1', 2, 'Vrac 1'), line('b', 'p3', 1, 'Vrac 1'), line('c', 'p5', 3, 'Vrac 1')],
    locations: [place('Vrac 1')],
    // CardNexus : Sink Below sans classe, Enlightened Strike « NotClassed ».
    classes: { p1: ['Brute'], p3: [], p5: ['NotClassed'] },
    vaultCards: [
      vaultItem('Sink Below', 1, 'Shadow Necromancer Defense Reaction', 'SEA001'),
      vaultItem('Enlightened Strike', 1, 'Pirate Action - Attack', 'SEA002'),
    ],
  });
  await openPlace(page, 'Vrac 1');
  // Par défaut, un emplacement de rangement est groupé par classe + talent.
  assert.equal(await page.$eval('#group-select', (e) => e.value), 'classTalent');
  assert.deepEqual(await sections(page), ['Brute', 'Pirate', 'Shadow Necromancer']);
  await page.selectOption('#group-select', 'class');
  assert.deepEqual(await sections(page), ['Brute', 'Necromancer', 'Pirate']);
  // Un seul passage dans l'index Card Vault (une page), pas une requête par carte.
  assert.equal(await page.evaluate(() => window.__vaultIndexCalls), 1);
  assert.equal(await page.evaluate(() => window.__vaultNameCalls || 0), 0);

  // Gardé sur le téléphone : un nouveau lancement ne redemande rien.
  // Rechargée, l'app rouvre directement l'emplacement (il est dans l'adresse).
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#app-title').textContent === 'Vrac 1' && !document.querySelector('#deck').hidden);
  assert.deepEqual(await sections(page), ['Brute', 'Pirate', 'Shadow Necromancer']);
  assert.equal(await page.evaluate(() => window.__cardVaultCalls || 0), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('Card Vault injoignable : la carte reste sans classe, sans erreur', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p1', 2, 'Vrac 1'), line('b', 'p3', 1, 'Vrac 1')],
    locations: [place('Vrac 1')],
    classes: { p1: ['Brute'], p3: [] },
  });
  await openPlace(page, 'Vrac 1');
  await page.selectOption('#group-select', 'class');
  assert.deepEqual(await sections(page), ['Brute', 'Sans classe']);
  assert.equal(await page.evaluate(() => localStorage.getItem('fabrary_classes')), null, 'rien de gardé');
  await back(page);
  assert.deepEqual(errors, []);
  await context.close();
});

test('une carte inconnue de Card Vault est notée, et pas recherchée tout de suite', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('b', 'p3', 1, 'Vrac 1')],
    locations: [place('Vrac 1')],
    classes: { p3: [] },
    vaultCards: [],
  });
  await openPlace(page, 'Vrac 1');
  await page.selectOption('#group-select', 'class');
  assert.deepEqual(await sections(page), ['Sans classe']);
  const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('fabrary_classes')));
  assert.equal(cache['sink-below-red'].missing, true);
  // Rechargée, l'app rouvre directement l'emplacement (il est dans l'adresse).
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#app-title').textContent === 'Vrac 1' && !document.querySelector('#deck').hidden);
  assert.equal(await page.evaluate(() => window.__cardVaultCalls || 0), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('talents inconnus de CardNexus (Revered, Reviled) : complétés, sans toucher à la classe', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p1', 2, 'Vrac 1'), line('b', 'p5', 1, 'Vrac 1')],
    locations: [place('Vrac 1')],
    classes: { p1: ['Warrior'], p5: ['Warrior'] },
    talents: { p1: [], p5: ['Light'] },
    // Card Vault dit autre chose pour la classe : celle de CardNexus est gardée.
    vaultCards: [vaultItem('Buckwild', 1, 'Revered Guardian Action - Attack', 'WTR001')],
  });
  await openPlace(page, 'Vrac 1');
  assert.deepEqual(await sections(page), ['Light Warrior', 'Revered Warrior']);
  // Enlightened Strike a déjà un talent chez CardNexus : seul Buckwild est cherché.
  const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('fabrary_classes')));
  assert.deepEqual(Object.keys(cache), ['buckwild-red']);
  assert.deepEqual(errors, []);
  await context.close();
});
