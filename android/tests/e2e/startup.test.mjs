// Démarrage instantané (la liste de la dernière fois, puis la mise à jour) et
// progression des chargements (pourcentage, détail, pause du quota).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, texts, openPlace } from '../helpers/app.mjs';

after(close);

const progressText = (page) =>
  page.evaluate(() => {
    const node = document.querySelector('#progress');
    return node.hidden ? null : node.innerText.replace(/\s+/g, ' ').trim();
  });

test('la Collection de la dernière fois s’affiche avant toute réponse, puis se met à jour', async () => {
  const inv = [line('h', 'p4', 1, 'Boulder - Cindra'), line('a', 'p1', 3, 'Boulder - Cindra'), line('b', 'p3', 2, 'Vrac 1')];
  const first = await openApp({ inv, locations: [place('Boulder - Cindra', 'deck', 'red'), place('Vrac 1')] });
  await first.page.waitForFunction(() => /Dorinthea/.test(document.querySelector('[data-place="Boulder - Cindra"]')?.textContent));
  await first.page.waitForFunction(() => JSON.parse(localStorage.getItem('collection_cache') || '{}').deckInfo?.['Boulder - Cindra']);
  const cache = await first.page.evaluate(() => localStorage.getItem('collection_cache'));
  assert.deepEqual(first.errors, []);
  await first.context.close();

  // Nouveau lancement : un emplacement a été créé sur le site, et l'API est lente.
  const { page, context, errors } = await openApp({
    inv,
    locations: [place('Boulder - Cindra', 'deck', 'red'), place('Vrac 1'), place('Vrac 9')],
    storage: { collection_cache: cache },
    delay: 1500,
    waitFor: null,
  });
  await page.waitForSelector('[data-place="Vrac 1"]', { timeout: 1000 });
  // Le héros et le compte du deck sont là d'emblée.
  assert.deepEqual(await texts(page, '[data-place="Boulder - Cindra"] .deck-card-sub'), ['Dorinthea Ironsong · 4 cartes']);
  assert.ok(!(await texts(page, '#places-list .deck-card-name')).includes('Vrac 9'));

  // La mise à jour se fait en arrière-plan et se voit en haut.
  await page.waitForFunction(() => !document.querySelector('#progress').hidden, null, { timeout: 3000 });
  assert.match(await progressText(page), /Lecture des emplacements|Mise à jour des decks/);
  assert.equal(await page.$eval('#progress', (n) => n.classList.contains('is-background')), true);

  await page.waitForFunction(
    () => [...document.querySelectorAll('#places-list .deck-card-name')].some((n) => n.textContent === 'Vrac 9'),
    null,
    { timeout: 15000 },
  );
  await page.waitForFunction(() => document.querySelector('#progress').hidden, null, { timeout: 15000 });
  assert.deepEqual(errors, []);
  await context.close();
});

test('une autre clé d’API ignore la liste gardée', async () => {
  const cache = JSON.stringify({ key: 'autre', locations: [{ name: 'Ancien compte', icon: 'box', color: 'white' }], decks: [] });
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p1', 1, 'Vrac 1')],
    locations: [place('Vrac 1')],
    storage: { collection_cache: cache },
  });
  await page.waitForSelector('[data-place="Vrac 1"]');
  assert.ok(!(await texts(page, '#places-list .deck-card-name')).includes('Ancien compte'));
  assert.deepEqual(errors, []);
  await context.close();
});

test('ouvrir un gros emplacement montre le pourcentage et le nombre de lignes lues', async () => {
  const { page, context, errors } = await openApp({
    inv: Array.from({ length: 450 }, (_, i) => line(`v${i}`, `p${(i % 5) + 1}`, 1, 'Vrac 1')),
    locations: [place('Vrac 1')],
  });
  await page.waitForSelector('[data-place="Vrac 1"]');
  await page.evaluate(() => {
    window.__mockDelay = 400;
    window.__seen = [];
    const node = document.querySelector('#progress');
    new MutationObserver(() => {
      if (!node.hidden) window.__seen.push(node.innerText.replace(/\s+/g, ' ').trim());
    }).observe(node, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  await page.click('[data-place="Vrac 1"]');
  await page.waitForSelector('#deck:not([hidden])', { timeout: 15000 });
  const seen = await page.evaluate(() => window.__seen);
  assert.ok(seen.some((t) => /^Lecture de « Vrac 1 » · \d+ %/.test(t)), seen.join('\n'));
  assert.ok(seen.some((t) => /200 \/ 450 lignes/.test(t)), seen.join('\n'));
  // L'écran de chargement reprend l'avancement.
  assert.ok(seen.some((t) => / %/.test(t)));
  await page.waitForFunction(() => document.querySelector('#progress').hidden);
  assert.deepEqual(errors, []);
  await context.close();
});

test('une pause imposée par le quota CardNexus s’affiche avec son décompte', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p1', 3, 'Vrac 1'), line('b', 'p3', 2, 'Vrac 2')],
    locations: [place('Vrac 1'), place('Vrac 2')],
  });
  await page.waitForSelector('[data-place="Vrac 1"]');
  await page.evaluate(() => { window.__mock429 = 1; });
  await page.click('#places-count');
  await page.waitForFunction(
    () => /Quota CardNexus atteint : reprise dans \d+ s/.test(document.querySelector('#progress-detail').textContent),
    null,
    { timeout: 5000 },
  );
  assert.match(await page.textContent('#progress-label'), /^Comptage des cartes/);
  await page.waitForFunction(() => /au total/.test(document.querySelector('#places-note').textContent), null, { timeout: 10000 });
  assert.deepEqual(errors, []);
  await context.close();
});

test('déplacer des cartes affiche la progression du déplacement', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p1', 5, 'Vrac 1'), line('b', 'p3', 6, 'Vrac 1')],
    locations: [place('Vrac 1'), place('Vrac 2')],
  });
  await openPlace(page, 'Vrac 1');
  await page.click('#select-all');
  await page.selectOption('#destination', 'Vrac 2');
  await page.evaluate(() => { window.__mockDelay = 600; });
  await page.click('#apply-move');
  await page.waitForFunction(() => /^Déplacement des cartes/.test(document.querySelector('#progress-label').textContent) && !document.querySelector('#progress').hidden);
  await page.waitForFunction(() => document.querySelector('#progress').hidden, null, { timeout: 10000 });
  assert.deepEqual(errors, []);
  await context.close();
});
