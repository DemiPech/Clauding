// Suivis de collection : création à la main (Ninja imprimées en japonais),
// complétion d'après la collection, cache, modification et suppression.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, line, place, texts, back } from '../helpers/app.mjs';

after(close);

const { vaultItem } = await import('../fixtures/fabtcg-decklist.mjs');
const LEGENDARY = { printed_rules_text: '**Legendary** _(You may only have 1 Enlightened Strike in your deck.)_' };
const VAULT = [
  vaultItem('Buckwild', 1, 'Ninja Action - Attack', 'WTR001'),
  vaultItem('Buckwild', 3, 'Ninja Action - Attack', 'WTR003'),
  // Sink Below sous deux identifiants (deux versions) : une seule carte à suivre.
  vaultItem('Sink Below', 1, 'Ninja Defense Reaction', 'WTR215'),
  { ...vaultItem('Sink Below', 1, 'Ninja Defense Reaction', 'MST215'), card_id: 'sink-below-1--inner-chi-1' },
  vaultItem('Dorinthea Ironsong', null, 'Ninja Hero - Young', 'WTR113'),
  vaultItem('Enlightened Strike', 1, 'Ninja Action - Attack', 'WTR159', null, LEGENDARY),
  // Ligne de type vide sur l'impression de référence : complétée par la fiche de la carte.
  vaultItem('Breaking Scales', null, '', 'R-WTR080'),
  // Pas d'impression japonaise : hors du suivi.
  vaultItem('Pummel', 1, 'Ninja Action - Attack', 'HVY001'),
  // Pas Ninja : hors du suivi.
  vaultItem('Beast Mode', 1, 'Brute Action', 'HVY003'),
];
const JA = ['breaking-scales', 'buckwild-1', 'buckwild-3', 'sink-below-1', 'sink-below-1--inner-chi-1', 'dorinthea-ironsong', 'enlightened-strike-1', 'beast-mode-1'];
const INV = [
  line('a', 'p1', 2, 'Classeur', { language: 'ja' }), line('b', 'p1', 1, 'Vrac 1'), // Buckwild rouge : 2 JA + 1 EN
  line('c', 'p3', 3, 'Classeur', { language: 'ja' }), // Sink Below : 3 JA
  line('d', 'p4', 1, 'Classeur', { language: 'ja' }), // Dorinthea : 1 JA
];

const rowsText = (page) => texts(page, '.completion-row');

test('suivi « Ninja en japonais » créé à la main, calculé, gardé, modifié, supprimé', async () => {
  const { page, context, errors } = await openApp({ inv: INV, locations: [place('Classeur'), place('Vrac 1')], vaultCards: VAULT });
  await page.evaluate((ja) => {
    window.__mockVaultLanguages = { ja };
    window.__mockVaultCores = { 'breaking-scales': { types: ['Equipment'], classes: ['Ninja'], talents: [] } };
  }, JA);
  await page.click('[data-tab="tools"]');
  await page.click('#tool-trackers');
  assert.equal(await page.textContent('#app-title'), 'Suivis de collection');
  assert.equal(await page.isVisible('#trackers-empty'), true);

  // Création : classe Ninja, imprimées en japonais, exemplaires japonais seulement.
  await page.click('#trackers-new');
  await page.waitForSelector('#tracker-classes [data-value="Ninja"]');
  assert.equal(await page.isVisible('#tracker-owned-field'), false, 'sans langue, pas de choix');
  await page.click('#tracker-classes [data-value="Ninja"]');
  await page.selectOption('#tracker-language', 'ja');
  await page.check('#tracker-owned-language');
  await page.click('#tracker-save');
  await page.waitForSelector('#tracker-result:not([hidden])');

  assert.equal(await page.textContent('#tracker-title'), 'Ninja en japonais', 'nom tiré des critères');
  assert.match(await page.textContent('#tracker-criteria'), /^Ninja · imprimées en japonais · exemplaires en japonais/);
  // Objectifs 1 (équipement) + 3 + 3 + 3 + 1 (héros) + 1 (Legendary) = 12 ; possédés 0 + 2 + 0 + 3 + 1 + 0 = 6.
  assert.deepEqual(await texts(page, '#tracker-stats .stat'), [
    '50 % complété', '2 / 6 cartes complètes', '6 / 12 exemplaires', '6 exemplaires manquants', '3 cartes absentes',
  ]);
  await page.selectOption('#tracker-group', 'none');
  assert.deepEqual(await rowsText(page), [
    'Breaking Scales Equipment · 1 suffit 0 / 1 −1',
    'Buckwild Action 2 / 3 −1',
    'Buckwild Action 0 / 3 −3',
    'Enlightened Strike Action · Legendary · 1 suffit 0 / 1 −1',
  ]);
  await page.click('#tracker-status [data-status="complete"]');
  assert.deepEqual(await texts(page, '.completion-name'), ['Dorinthea Ironsong', 'Sink Below']);
  await page.click('#tracker-status [data-status="all"]');
  assert.equal((await rowsText(page)).length, 6);

  // Liste des suivis : progression affichée.
  await back(page);
  await page.waitForFunction(() => /%/.test(document.querySelector('.tracker-item-progress')?.textContent || ''));
  assert.match(await page.textContent('.tracker-item'), /Ninja en japonais.*50 % · 2 \/ 6 cartes complètes/s);

  // Redémarrage : le résultat revient sans relire Card Vault ni la collection.
  await page.goto('https://appassets.androidplatform.net/index.html');
  await page.waitForSelector('#places:not([hidden])');
  await page.evaluate((ja) => { window.__mockVaultLanguages = { ja }; }, JA);
  await page.click('[data-tab="tools"]');
  await page.click('#tool-trackers');
  await page.click('.tracker-item');
  await page.waitForSelector('#tracker-result:not([hidden])');
  assert.match(await page.textContent('#tracker-note'), /^Calculé le /);
  assert.equal(await page.evaluate(() => window.__cardVaultCalls || 0), 0);

  // Modification : tous les exemplaires comptent (le Buckwild anglais aussi).
  await page.click('#tracker-modify');
  await page.waitForSelector('#tracker-classes [data-value="Ninja"].is-active');
  await page.uncheck('#tracker-owned-language');
  await page.fill('#tracker-name', 'Ninja JP');
  await page.click('#tracker-save');
  await page.waitForFunction(() => document.querySelector('#tracker-title').textContent === 'Ninja JP');
  await page.waitForFunction(() => document.querySelector('#tracker-stats .stat')?.textContent === '58,3 % complété');
  // Les cartes Card Vault viennent du cache (IndexedDB) : seule la collection est relue.
  assert.equal(await page.evaluate(() => window.__requests.filter((r) => r.url.includes('advanced-search')).length), 0);

  // Suppression.
  await page.click('#tracker-modify');
  await page.click('#tracker-delete');
  await page.waitForSelector('#trackers-list:not([hidden])');
  assert.equal(await page.isVisible('#trackers-empty'), true);
  await back(page);
  assert.equal(await page.isVisible('#tools-view'), true);
  assert.deepEqual(errors, []);
  await context.close();
});
