// Ranger les vracs, compter les cartes par emplacement (avec un 429 rejoué),
// déplacer depuis la recherche, et filtrer Flesh and Blood seulement.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, texts, toast, stock } from '../helpers/app.mjs';

after(close);

test('déplacer depuis la recherche puis ranger les vracs par classe', async () => {
  const { page, context, errors } = await openApp({
    inv: [
      line('a', 'p1', 3, 'Vrac 1'), line('b', 'p1', 1, 'Vrac 2'), line('c', 'p2', 2, 'Vrac 3'), line('d', 'p2', 1, 'Vrac 1'),
      line('e', 'p3', 4, 'Vrac 2'), line('f', 'p3', 1, 'Vrac 3'), line('g', 'p5', 2, 'Vrac 3'), line('h', 'p5', 2, 'Vrac 1'),
      line('k', 'p3', 3, 'Kallax - WTR'), line('z', 'p4', 1, 'Deck A'), line('z2', 'p1', 2, 'Deck A'),
    ],
    locations: [
      place('Deck A', 'deck', 'red'), place('Kallax - WTR', 'box', 'blue'),
      place('Vrac 1'), place('Vrac 2'), place('Vrac 3'), place('Classeur Blanc'),
    ],
    classes: { p1: ['Brute'], p2: ['Brute'], p3: ['Generic'], p4: ['Warrior'], p5: ['Ninja'] },
  });

  await page.click('[data-tab="search"]');
  await page.fill('#deck-input', 'buck');
  await page.click('#load-btn');
  await page.waitForSelector('#places-search-results .result-card');
  await page.locator('#places-search-results .line-row', { hasText: 'Vrac 2' }).locator('button[aria-label="Un de plus"]').click();
  await page.selectOption('#destination', 'Vrac 1');
  await page.click('#apply-move');
  await toast(page, /Vrac 1/);
  const moved = await stock(page);
  assert.equal(moved['Vrac 2:p1'], undefined);
  assert.equal(moved['Vrac 1:p1'], 4);

  await page.click('[data-tab="tools"]');
  await page.click('#open-tidy');
  await page.waitForSelector('#tidy:not([hidden]) #tidy-places input');
  // Par défaut : les vracs seulement (ni deck, ni kallax, ni classeur).
  assert.deepEqual(
    await page.$$eval('#tidy-places input', (els) => els.filter((e) => e.checked).map((e) => e.value)),
    ['Vrac 1', 'Vrac 2', 'Vrac 3'],
  );
  await page.click('#tidy-compute');
  await page.waitForSelector('#tidy-result:not([hidden])');
  assert.deepEqual(await texts(page, '#tidy-stats .stat'), ['5 à déplacer', "3 cartes éparpillées aujourd'hui", '16 cartes rangées']);

  await page.click('[data-tidy-mode="class"]');
  await page.waitForFunction(() => document.querySelector('#tidy-layout .tidy-groups')?.textContent.includes('('));
  await page.click('#tidy-apply');
  await toast(page, /rangée/);
  // Chaque carte ne se trouve plus que dans un seul vrac.
  const spots = await page.evaluate(() => {
    const where = {};
    for (const l of window.__inv) {
      if (l.quantity && /^Vrac/.test(l.location)) (where[l.productId] ??= new Set()).add(l.location);
    }
    return Object.fromEntries(Object.entries(where).map(([k, v]) => [k, v.size]));
  });
  assert.ok(Object.values(spots).every((n) => n === 1), JSON.stringify(spots));
  await page.click('#tidy-compute');
  await page.waitForSelector('#tidy-result:not([hidden])');
  assert.equal((await texts(page, '#tidy-stats .stat'))[0], '0 à déplacer');
  assert.deepEqual(errors, []);
  await context.close();
});

test('compter les cartes de chaque emplacement malgré un 429', async () => {
  const { page, context, errors } = await openApp({
    inv: [
      ...Array.from({ length: 450 }, (_, i) => line(`v${i}`, `p${(i % 5) + 1}`, 1, 'Vrac 1')),
      line('a', 'p1', 3, 'Vrac 2'), line('b', 'p3', 2, null), line('c', 'p4', 1, 'Deck A'),
    ],
    locations: [place('Deck A', 'deck', 'red'), place('Vrac 1'), place('Vrac 2'), place('Vrac 3')],
  });
  await page.waitForSelector('[data-place="Vrac 1"]');
  await page.evaluate(() => { window.__searchCalls = 0; window.__mock429 = 1; });
  await page.click('#places-count');
  await page.waitForFunction(() => /au total/.test(document.querySelector('#places-note').textContent), null, { timeout: 30000 });
  assert.match(await page.textContent('#places-note'), /456 cartes au total\. 2 n'ont aucun emplacement/);
  assert.deepEqual(await texts(page, '#places-list .deck-card'), [
    'Sans emplacement 2 cartes', 'Deck A Dorinthea Ironsong · 1 carte', 'Vrac 1 450 cartes', 'Vrac 2 3 cartes', 'Vrac 3 0 carte',
  ]);

  await page.click('[data-place="Vrac 1"]');
  await page.waitForSelector('#deck:not([hidden])');
  assert.deepEqual(await texts(page, '#deck-stats .stat'), ['450 cartes', '5 différentes']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('Flesh and Blood seulement : les autres jeux sont ignorés', async () => {
  const { page, context, errors } = await openApp({
    inv: [
      line('a', 'p1', 3, 'Vrac 1', { game: 'fab' }), line('k', 'pk1', 9, 'Vrac 1', { game: 'pokemon' }),
      line('k2', 'pk1', 4, null, { game: 'pokemon' }), line('b', 'p3', 2, 'Vrac 2', { game: 'fab' }),
    ],
    locations: [place('Vrac 1'), place('Vrac 2')],
    storage: {
      collection_snapshot: JSON.stringify({
        at: '2026-09-01T00:00:00Z', cards: 12, counts: { 'p1|Standard|NM|en|Vrac 1': 3, 'pk1|Standard|NM|en|Vrac 1': 9 },
      }),
    },
  });
  await page.click('#places-count');
  await page.waitForFunction(() => /au total/.test(document.querySelector('#places-note').textContent));
  assert.match(await page.textContent('#places-note'), /^5 cartes au total\./);
  assert.deepEqual(await texts(page, '#places-list .deck-card'), ['Vrac 1 3 cartes', 'Vrac 2 2 cartes']);

  await page.click('[data-place="Vrac 1"]');
  await page.waitForSelector('#deck:not([hidden])');
  assert.deepEqual(await texts(page, '#deck-stats .stat'), ['3 cartes', '1 différente']);
  await page.click('#more-btn');
  await page.click('#delete-btn');
  await page.waitForFunction(() => /autres jeux/.test(document.querySelector('#delete-note').textContent));
  await page.click('#delete-cancel');

  await page.click('[data-tab="history"]');
  await page.click('[data-history-tab="changes"]');
  await page.click('#snapshot-now');
  assert.match(await toast(page, /photo/), /Première photo/);
  const snap = await page.evaluate(() => JSON.parse(localStorage.getItem('collection_snapshot')));
  assert.equal(snap.scope, 'fab');
  await page.click('[data-history-tab="recent"]');
  await page.waitForSelector('#recent-list .recent-line');
  const recent = await texts(page, '#recent-list .recent-line');
  assert.equal(recent.length, 2);
  assert.ok(!recent.some((t) => /Pikachu/.test(t)));
  assert.deepEqual(errors, []);
  await context.close();
});
