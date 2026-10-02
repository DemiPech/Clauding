// Prendre des cartes et les deplacer, comparer un deck a une liste, gerer
// l'excedent, les cartes sans emplacement, la suppression et les emplacements.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, stock, texts, toast, openPlace, menu, back } from '../helpers/app.mjs';

after(close);

test('comparer un deck a une liste FaBrary, deplacer, puis annuler', async () => {
  const { page, context, errors } = await openApp({
    inv: [
      line('l1', 'p4', 1, 'Deck A'), line('l2', 'p1', 2, 'Deck A'), line('l3', 'p1', 3, 'Binder'),
      line('l4', 'p5', 2, 'Deck A'), line('l5', 'p2', 3, 'Deck A'), line('l6', 'p3', 2, 'Binder'),
    ],
    locations: [place('Deck A', 'deck', 'red'), place('Binder', 'box', 'blue')],
  });
  await openPlace(page, 'Deck A');
  await menu(page, 'compare-btn');
  await page.fill('#compare-input', 'https://fabrary.net/decks/01ABCDEFGH');
  await page.click('#compare-submit');
  await page.waitForSelector('#build-result:not([hidden])');

  assert.deepEqual(await texts(page, '#build-stats .stat'), ['3 à faire entrer', '3 à sortir', '6 déjà en place']);
  assert.deepEqual(await texts(page, '#build-surplus-rows > li .build-row-head'), [
    '3× Buckwild liste : 2 1 à sortir ▸',
    '2× Enlightened Strike hors liste 2 à sortir ▸',
  ]);

  // Sans destination pour les cartes en trop, rien ne part.
  await page.click('#build-apply');
  assert.match(await page.textContent('#build-note'), /Choisissez où ranger/);

  await page.selectOption('#build-out', 'Binder');
  await page.click('#build-apply');
  assert.equal(await toast(page, /rangées/), '3 cartes rangées dans « Deck A » · 3 sorties vers « Binder »');
  assert.deepEqual(await stock(page), {
    'Deck A:p1': 3, 'Deck A:p2': 2, 'Deck A:p3': 2, 'Deck A:p4': 1,
    'Binder:p1': 2, 'Binder:p2': 1, 'Binder:p5': 2,
  });

  await page.click('[data-tab="history"]');
  const move = page.locator('.journal-entry', { hasText: 'Montage de deck' });
  await move.locator('.journal-head').click();
  await move.locator('text=Annuler ce déplacement').click();
  await page.click('#confirm-ok');
  assert.match(await toast(page, /remises/), /6 cartes remises en place/);
  assert.deepEqual(await stock(page), {
    'Deck A:p1': 2, 'Deck A:p2': 3, 'Deck A:p4': 1, 'Deck A:p5': 2, 'Binder:p1': 3, 'Binder:p3': 2,
  });
  assert.deepEqual(errors, []);
  await context.close();
});

test('« au-delà de 3 » prend l’excédent en gardant les foils, puis les cartes sans emplacement se rangent', async () => {
  const { page, context, errors } = await openApp({
    inv: [
      line('a1', 'p1', 3, 'Vrac 1'), line('a2', 'p1', 1, 'Vrac 1', { finish: 'Rainbow Foil' }),
      line('a3', 'p1', 1, 'Vrac 1', { condition: 'LP' }), line('b1', 'p3', 6, 'Vrac 1'), line('c1', 'p5', 2, 'Vrac 1'),
      line('u1', 'p2', 2, null), line('u2', 'p4', 1, null),
    ],
    locations: [place('Vrac 1'), place('Vrac 2')],
  });
  await openPlace(page, 'Vrac 1');
  assert.equal(await page.isVisible('#movebar'), false, 'barre du bas visible sans rien en main');

  await page.click('#excess-btn');
  assert.match(await toast(page, /en main/), /5 exemplaires en main \(2 cartes au-delà de 3\)/);
  assert.equal(await page.isVisible('#movebar'), true);
  await page.selectOption('#destination', 'Vrac 2');
  await page.click('#apply-move');
  await toast(page, /Vrac 2/);
  const afterExcess = await page.evaluate(() =>
    window.__inv.filter((l) => l.quantity && l.location === 'Vrac 1').map((l) => `${l.productId}${l.finish !== 'Standard' ? '*' : ''}${l.condition !== 'NM' ? 'LP' : ''}=${l.quantity}`).sort(),
  );
  // 5 Buckwild → 3 restent, dont le foil ; le LP est parti. 6 Sink Below → 3.
  assert.deepEqual(afterExcess, ['p1*=1', 'p1=2', 'p3=3', 'p5=2']);

  await back(page);
  await openPlace(page, '__sans_emplacement__', 'Sans emplacement');
  assert.equal(await page.textContent('#deck-hero-line'), 'Cartes à ranger');
  assert.equal(await page.$eval('#rename-btn', (e) => e.hidden), true);
  await page.click('#select-all');
  await page.selectOption('#destination', 'Vrac 2');
  await page.click('#apply-move');
  assert.match(await toast(page, /Vrac 2/), /3 cartes → Vrac 2/);
  const s = await stock(page);
  assert.equal(s['∅:p2'], undefined);
  assert.equal(s['Vrac 2:p2'], 2);
  assert.deepEqual(errors, []);
  await context.close();
});

test('corbeille : retirer les tags, supprimer un exemplaire puis tout', async () => {
  const { page, context, errors } = await openApp({
    inv: [
      line('t1', 'p1', 3, 'Corbeille', { tags: ['À vérifier'] }),
      line('t2', 'p3', 2, 'Corbeille', { tags: ['À vérifier', 'Trade'] }),
      line('t3', 'p5', 4, 'Corbeille'),
      line('t4', 'p2', 1, 'Corbeille', { forSale: true, tags: ['Trade'] }),
      line('k1', 'p1', 2, 'Vrac 1'),
    ],
    locations: [place('Corbeille', 'box', 'black'), place('Vrac 1')],
  });
  await openPlace(page, 'Corbeille');
  assert.equal(await page.$eval('#untag-btn', (e) => e.textContent), 'Retirer les tags (3 lignes)');
  await menu(page, 'untag-btn');
  assert.deepEqual(await texts(page, '#confirm-list li'), ['À vérifier — 2 lignes', 'Trade — 2 lignes']);
  await page.click('#confirm-ok');
  assert.equal(await toast(page, /Tags/), 'Tags retirés de 3 lignes dans « Corbeille »');
  assert.equal(await page.evaluate(() => window.__inv.some((l) => l.tags?.length)), false);

  // Un exemplaire de Buckwild, par le « + » ; annuler d'abord ne change rien.
  await page.click('[data-view="list"]');
  await page.locator('.card-slot', { hasText: 'Buckwild' }).first().locator('.pickup-btn').click();
  await page.locator('#line-picker-list button[aria-label="Un de plus"]').first().click();
  await page.click('#line-picker-close');
  await page.click('#delete-cards');
  await page.click('#confirm-cancel');
  assert.equal((await stock(page))['Corbeille:p1'], 3);
  await page.click('#delete-cards');
  await page.click('#confirm-ok');
  assert.equal(await toast(page, /supprimée/), '1 carte supprimée de la collection');
  assert.equal((await stock(page))['Corbeille:p1'], 2);

  await page.click('#select-all');
  await page.click('#delete-cards');
  assert.match(await page.textContent('#confirm-note'), /en vente : leur annonce sera retirée/);
  await page.click('#confirm-ok');
  assert.equal(await toast(page, /supprimées/), '9 cartes supprimées de la collection');
  assert.deepEqual(await stock(page), { 'Vrac 1:p1': 2 });
  assert.deepEqual(await texts(page, '#deck-stats .stat'), ['0 carte', '0 différente']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('renommer puis supprimer un emplacement en déplaçant ses cartes', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p4', 1, 'Tiroir DS 1'), line('b', 'p1', 3, 'Tiroir DS 1'), line('e', 'p1', 1, 'Vrac 2')],
    locations: [place('Tiroir DS 1'), place('Vrac 2')],
  });
  await openPlace(page, 'Tiroir DS 1');
  // Un emplacement de rangement : pas de héros, groupé par classe par défaut.
  assert.equal(await page.isVisible('#hero-art'), false);
  assert.equal(await page.$eval('#group-select', (e) => e.value), 'classTalent');
  assert.deepEqual(await texts(page, '#deck-stats .stat'), ['4 cartes', '2 différentes']);

  await menu(page, 'rename-btn');
  await page.fill('#rename-input', 'Tiroir Dragons');
  await page.click('#rename-submit');
  assert.match(await toast(page, /s'appelle/), /« Tiroir DS 1 » s'appelle maintenant « Tiroir Dragons »/);
  assert.equal(await page.textContent('#app-title'), 'Tiroir Dragons');

  await menu(page, 'delete-btn');
  await page.selectOption('#delete-target', 'Vrac 2');
  await page.click('#delete-submit');
  await page.waitForSelector('#places:not([hidden])');
  assert.match(await toast(page, /supprimé/), /« Tiroir Dragons » supprimé · 4 cartes → « Vrac 2 »/);
  assert.deepEqual(await stock(page), { 'Vrac 2:p1': 4, 'Vrac 2:p4': 1 });
  // « Sans emplacement » reste affiché tant que les comptes ne sont pas rechargés.
  const names = await texts(page, '#places-list .deck-card-name');
  assert.ok(names.includes('Vrac 2') && !names.some((n) => n.startsWith('Tiroir')), names.join(', '));
  assert.deepEqual(errors, []);
  await context.close();
});

test('« Sans emplacement » ne montre que les cartes vraiment sans emplacement', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('u1', 'p2', 2, null), line('bug1', 'p1', 1, 'Vrac 1'), line('bug2', 'p3', 3, 'Vrac 2')],
    locations: [place('Vrac 1'), place('Vrac 2')],
  });
  // CardNexus renvoie à tort des lignes rangées pour le filtre « sans emplacement ».
  await page.evaluate(() => { window.__mockNullFilterBug = true; });
  await openPlace(page, '__sans_emplacement__', 'Sans emplacement');
  assert.deepEqual(await texts(page, '#deck-stats .stat'), ['2 cartes', '1 différente']);
  assert.deepEqual(errors, []);
  await context.close();
});
