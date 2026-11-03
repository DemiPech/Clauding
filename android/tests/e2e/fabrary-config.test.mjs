// FaBrary change de pool d'identités : l'app relit sa configuration sur fabrary.net.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, close, place, openFabrary } from '../helpers/app.mjs';

after(close);

const NEW_POOL = 'us-east-2:11111111-2222-4333-8444-555555555555';
const NEW_API = 'https://abcdefghijklmnopqrstuvwxyz.appsync-api.us-east-2.amazonaws.com/graphql';
// Comme un site Vite : la page charge un script, qui charge le morceau de configuration.
const SITE = {
  '/': '<!doctype html><html><head><script type="module" crossorigin src="/assets/index-a1b2.js"></script></head><body><div id="root"></div></body></html>',
  '/assets/index-a1b2.js': 'const routes=()=>import("./config-c3d4.js");console.log("app")',
  '/assets/config-c3d4.js': `export const aws={aws_cognito_identity_pool_id:"${NEW_POOL}",aws_appsync_graphqlEndpoint:"${NEW_API}",aws_appsync_region:"us-east-2"};`,
};

test('pool FaBrary disparu : configuration relue sur le site, gardée, liste ouverte', async () => {
  const { page, context, errors } = await openApp({ inv: [], locations: [place('Vrac 1')] });
  await page.evaluate(({ pool, site }) => {
    window.__mockFabraryPool = pool;
    window.__mockFabrarySite = site;
  }, { pool: NEW_POOL, site: SITE });

  await openFabrary(page);
  assert.equal(await page.textContent('#app-title'), 'Liste test');
  // La nouvelle API est appelée, et la configuration est gardée.
  const calls = await page.evaluate(() => window.__requests.filter((r) => r.url.includes('appsync-api')).map((r) => r.url));
  assert.equal(calls.at(-1), NEW_API);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fabrary_config')));
  assert.equal(stored.identityPoolId, NEW_POOL);
  assert.equal(stored.endpoint, NEW_API);

  // Au redémarrage (la liste se rouvre d'elle-même), plus besoin de relire le site.
  await page.addInitScript(({ pool, site }) => {
    window.__mockFabraryPool = pool;
    window.__mockFabrarySite = site;
  }, { pool: NEW_POOL, site: SITE });
  await page.reload();
  await page.waitForSelector('#deck:not([hidden])');
  assert.equal(await page.textContent('#app-title'), 'Liste test');
  assert.equal(await page.evaluate(() => window.__fabrarySiteCalls || 0), 0);
  const after = await page.evaluate(() => window.__requests.filter((r) => /cognito|appsync/.test(r.url)).map((r) => r.body || r.url));
  assert.ok(after.some((b) => b.includes(NEW_POOL)), 'le nouveau pool sert directement');
  assert.deepEqual(errors, []);
  await context.close();
});

test('configuration introuvable sur le site : message clair', async () => {
  const { page, context, errors } = await openApp({ inv: [], locations: [place('Vrac 1')] });
  await page.evaluate(() => {
    window.__mockFabraryPool = 'us-east-2:99999999-2222-4333-8444-555555555555';
    window.__mockFabrarySite = { '/': '<html><body>maintenance</body></html>' };
  });
  await page.click('[data-tab="search"]');
  await page.fill('#deck-input', 'https://fabrary.net/decks/01ABCDEFGH');
  await page.click('#load-btn');
  await page.waitForSelector('#state-error:not([hidden])');
  assert.match(await page.textContent('#error-message'), /FaBrary a changé sa configuration/);
  assert.deepEqual(errors, []);
  await context.close();
});
