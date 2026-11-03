// Coller une liste (texte copié depuis FaBrary) : fiches Card Vault, montage,
// historique ; et un lien FaBrary qui n'ouvre plus rien oriente vers le collage.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, texts, back } from '../helpers/app.mjs';

after(close);

const { VAULT_CARDS, vaultItem } = await import('../fixtures/fabtcg-decklist.mjs');
const CARDS = [...VAULT_CARDS, vaultItem('Sink Below', 1, 'Generic Defense Reaction', 'WTR215')];

const TEXT = `Name: Fang Aggro
Hero: Fang, Dracai of Blades
Format: Classic Constructed

Arena cards
2x Obsidian Fire Vein
Deck cards
3x Buckwild (red)
2x Sink Below (red)
1x Mystery Card (blue)

Made with ❤️ at the FaBrary
See the full deck @ https://fabrary.net/decks/01M6HN6NA59YHATVWNMVF8D12H`;

const historyTitles = (page) => page.$$eval('#list-history-groups h2', (h) => h.map((x) => x.textContent));

test('liste collée : fiches Card Vault, lien FaBrary, montage et historique', async () => {
  const { page, context, errors } = await openApp({
    inv: [line('a', 'p1', 3, 'Vrac 1'), line('b', 'p3', 2, 'Vrac 1')],
    locations: [place('Vrac 1')],
    vaultCards: CARDS,
  });
  await page.click('[data-tab="search"]');
  await page.click('#paste-list summary');
  await page.click('#paste-open');
  assert.match(await page.textContent('#paste-note'), /Aucune carte reconnue/);

  await page.fill('#paste-text', TEXT);
  await page.click('#paste-open');
  await page.waitForSelector('#deck:not([hidden])');
  assert.equal(await page.textContent('#app-title'), 'Fang Aggro');
  assert.equal(await page.textContent('#deck-hero-line'), 'Fang, Dracai of Blades · Classic Constructed');
  // Héros + 2 armes + 3 + 2 + 1 = 9 cartes, 5 différentes (héros compris).
  assert.deepEqual(await texts(page, '#deck-stats .stat'), ['9 cartes', '5 différentes']);
  assert.match(await page.textContent('#deck-notes'), /non reconnues par Card Vault .*: Mystery Card\./);
  assert.equal(
    await page.$eval('#hero-art', (img) => img.getAttribute('src')),
    'https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/normal/HNT098.webp',
  );
  await page.click('#more-btn');
  assert.equal(await page.textContent('#fabrary-link'), 'Voir sur FaBrary ↗');
  assert.equal(await page.getAttribute('#fabrary-link', 'href'), 'https://fabrary.net/decks/01M6HN6NA59YHATVWNMVF8D12H');
  await back(page);

  // Le plan de montage fonctionne avec une liste collée.
  await page.click('#build-btn');
  await page.fill('#build-new-name', 'Fang');
  await page.click('#build-compute');
  await page.waitForSelector('#build-result:not([hidden])');
  assert.equal(await page.textContent('#build-pickup-count'), '1 endroit · 5 cartes');
  await back(page);
  await back(page);

  // Notée dans l'historique, et rouverte après un redémarrage.
  assert.deepEqual(await historyTitles(page), ['Fang, Dracai of Blades']);
  assert.match((await texts(page, '.history-list-meta'))[0], /liste collée/);
  await page.goto('https://appassets.androidplatform.net/index.html');
  await page.waitForSelector('#places:not([hidden])');
  await page.click('[data-tab="search"]');
  await page.click('.history-list-open');
  await page.waitForSelector('#deck:not([hidden])');
  assert.equal(await page.textContent('#app-title'), 'Fang Aggro');
  assert.deepEqual(errors, []);
  await context.close();
});

test('liste de plusieurs lignes collée dans le champ de recherche : ouverte directement', async () => {
  const { page, context, errors } = await openApp({ inv: [], locations: [place('Vrac 1')], vaultCards: CARDS });
  await page.click('[data-tab="search"]');
  await page.$eval('#deck-input', (input, text) => {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, '3x Buckwild (red)\n2x Sink Below (red)');
  await page.waitForSelector('#deck:not([hidden])');
  assert.equal(await page.textContent('#app-title'), 'Liste collée');
  assert.deepEqual(await texts(page, '#deck-stats .stat'), ['5 cartes', '2 différentes']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('lien FaBrary sans accès invité : le message propose de coller la liste', async () => {
  const { page, context, errors } = await openApp({ inv: [], locations: [place('Vrac 1')] });
  await page.evaluate(() => { window.__mockFabraryGone = true; });
  await page.click('[data-tab="search"]');
  await page.fill('#deck-input', 'https://fabrary.net/decks/01M6HN6NA59YHATVWNMVF8D12H');
  await page.click('#load-btn');
  await page.waitForSelector('#state-error:not([hidden])');
  assert.match(await page.textContent('#error-message'), /FaBrary ne permet plus .*« Coller une liste »/);
  assert.deepEqual(errors, []);
  await context.close();
});
