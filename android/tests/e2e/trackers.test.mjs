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
    // Raretés en japonais : Buckwild rouge commune et Marvel, Enlightened Strike majestic.
    window.__mockVaultRarities = {
      'buckwild-1': ['common', 'marvel'], 'buckwild-3': ['common'], 'sink-below-1': ['rare'],
      'dorinthea-ironsong': ['legendary'], 'enlightened-strike-1': ['majestic'], 'breaking-scales': ['rare'],
    };
    // Impressions de Buckwild rouge : deux en japonais (un Archive Pack et un deck), une en anglais.
    const print = (printId, language, rarity, product, date, finish = 'regular') => ({
      print_id: printId, print_language: language, rarity, is_published: true,
      print_set: { set_code: printId.replace(/^[A-Z]{2}_/, '').slice(0, 3), set_name: product },
      product: { product_name: product, release_date: date }, faces: [{ finish_type: finish }],
    });
    window.__mockVaultProducts = [
      { name: 'Archive Pack - Part the Mistveil [JA]', slug: 'archive-pack-part-the-mistveil-ja', language: 'ja', date: '2024-10-11', cards: ['buckwild-1', 'enlightened-strike-1', 'sink-below-1'] },
      { name: 'Armory Deck - Ira, Scarlet Revenger [JA]', slug: 'armory-deck-ira-ja', language: 'ja', date: '2025-07-11', cards: ['buckwild-1', 'buckwild-3', 'dorinthea-ironsong'] },
      // La version anglaise ne compte pas pour un suivi en japonais.
      { name: 'Armory Deck - Ira, Scarlet Revenger', slug: 'armory-deck-ira', language: 'en', date: '2025-07-11', cards: ['breaking-scales'] },
    ];
    window.__mockVaultPrints = {
      // Breaking Scales : dans aucun produit listé, sa fiche donne son deck.
      'breaking-scales': [print('JA_IRA001', 'ja', 'rare', 'Ira Welcome Deck (2024) [JA]', '2024-03-01')],
      'buckwild-1': [
        print('WTR001', 'en', 'common', 'Welcome to Rathe', '2019-10-11'),
        print('JA_MAP092', 'ja', 'common', 'Archive Pack - Part the Mistveil [JA]', '2024-10-11'),
        print('JA_ASR007', 'ja', 'common', 'Armory Deck - Ira, Scarlet Revenger [JA]', '2025-07-11'),
        print('JA_ASR007-MV', 'ja', 'marvel', 'Armory Deck - Ira, Scarlet Revenger [JA]', '2025-07-11', 'rainbow-foil'),
      ],
    };
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
    'Breaking Scales Equipment · Rare · 1 suffit 0 / 1 −1',
    'Buckwild Action · Commune, Marvel 2 / 3 −1',
    'Buckwild Action · Commune 0 / 3 −3',
    'Enlightened Strike Action · Majestic · Legendary · 1 suffit 0 / 1 −1',
  ]);

  // Où trouver Buckwild rouge en japonais : ses impressions japonaises, les plus récentes d'abord.
  await page.click('.completion-row:has-text("Commune, Marvel")');
  await page.waitForSelector('.tracker-prints li');
  assert.equal(await page.textContent('.tracker-prints-head'), 'Où la trouver en japonais :');
  assert.deepEqual(await texts(page, '.tracker-prints li'), [
    'Armory Deck - Ira, Scarlet Revenger [JA] JA_ASR007 · Commune · Standard · 2025',
    'Armory Deck - Ira, Scarlet Revenger [JA] JA_ASR007-MV · Marvel · Rainbow Foil · 2025',
    'Archive Pack - Part the Mistveil [JA] JA_MAP092 · Commune · Standard · 2024',
  ]);
  // Toucher de nouveau referme.
  await page.click('.completion-row:has-text("Commune, Marvel")');
  assert.equal(await page.isVisible('.tracker-prints li'), false);

  // Groupement par rareté : de la plus courante à la plus rare.
  await page.click('#tracker-status [data-status="all"]');
  await page.selectOption('#tracker-group', 'rarity');
  assert.deepEqual(await texts(page, '#tracker-list h2'), ['Commune', 'Rare', 'Majestic', 'Légendaire']);

  // Groupement par extension : une carte d'une seule extension sous celle-ci (la plus récente
  // d'abord), les autres sous « Plusieurs extensions ».
  await page.selectOption('#tracker-group', 'expansion');
  assert.deepEqual(await texts(page, '#tracker-list h2'), [
    'Armory Deck - Ira, Scarlet Revenger [JA]', 'Archive Pack - Part the Mistveil [JA]', 'Ira Welcome Deck (2024) [JA]', 'Plusieurs extensions',
  ]);
  const groupOf = (title) => page.$$eval('#tracker-list section', (sections, t) => {
    const section = sections.find((sec) => sec.querySelector('h2')?.textContent === t);
    return [...section.querySelectorAll('.completion-name')].map((n) => n.textContent);
  }, title);
  assert.deepEqual(await groupOf('Armory Deck - Ira, Scarlet Revenger [JA]'), ['Buckwild', 'Dorinthea Ironsong']);
  assert.deepEqual(await groupOf('Archive Pack - Part the Mistveil [JA]'), ['Enlightened Strike', 'Sink Below']);
  assert.deepEqual(await groupOf('Plusieurs extensions'), ['Buckwild']);
  assert.deepEqual(await groupOf('Ira Welcome Deck (2024) [JA]'), ['Breaking Scales']);
  await page.click('#tracker-status [data-status="missing"]');
  await page.selectOption('#tracker-group', 'none');
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
