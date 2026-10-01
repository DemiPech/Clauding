/**
 * Lance l'interface de l'app dans Chromium, comme dans la WebView Android.
 *
 * Les fichiers de assets/www sont servis sous la meme origine que dans l'app
 * (https://appassets.androidplatform.net/), et le pont natif (window.AndroidApp)
 * est remplace par mock-bridge.js : un faux FaBrary et un faux inventaire
 * CardNexus en memoire, que les tests inspectent via window.__inv.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.resolve(HERE, '../../app/src/main/assets/www');
const MOCK_BRIDGE = path.join(HERE, 'mock-bridge.js');
const ORIGIN = 'https://appassets.androidplatform.net';
const MIME = { html: 'text/html', css: 'text/css', js: 'text/javascript' };

let browser;

export async function launch() {
  browser ??= await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  return browser;
}

export async function close() {
  await browser?.close();
  browser = undefined;
}

/** Une ligne d'inventaire simulee. */
export const line = (id, productId, quantity, location, extra = {}) => ({
  id,
  productId,
  quantity,
  location,
  finish: 'Standard',
  condition: 'NM',
  language: 'en',
  forSale: false,
  tags: [],
  updatedAt: '2026-09-30T10:00:00Z',
  ...extra,
});

export const place = (name, icon = 'box', color = 'white') => ({ name, icon, color });

/**
 * Ouvre l'app sur une collection simulee.
 * `inv` : lignes (line()), `locations` : emplacements (place()), `classes`,
 * `talents`, `exp` : attributs des produits p1..p5, `delay` : latence de chaque
 * requete simulee (ms), `storage` : localStorage initial (la photo automatique
 * est coupee par defaut).
 */
export async function openApp({
  inv,
  locations,
  classes,
  talents,
  exp,
  delay,
  storage = {},
  waitFor = '#places:not([hidden])',
} = {}) {
  const context = await (await launch()).newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await context.route(`${ORIGIN}/**`, (route) => {
    const file = path.join(WWW, new URL(route.request().url()).pathname);
    if (!file.startsWith(WWW) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: MIME[file.split('.').pop()], body: fs.readFileSync(file) });
  });
  // Les images des cartes ne sont pas utiles aux tests.
  await context.route('https://content.fabrary.net/**', (route) => route.fulfill({ status: 404, body: '' }));

  await context.addInitScript(
    ({ inv, locations, classes, talents, exp, delay, storage }) => {
      const defaults = { snapshot_interval_h: '0', ...storage };
      for (const [key, value] of Object.entries(defaults)) {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      }
      if (inv) window.__mockInv = inv;
      if (locations) window.__mockLocations = locations;
      if (classes) window.__mockClasses = classes;
      if (talents) window.__mockTalents = talents;
      if (exp) window.__mockExp = exp;
      if (delay != null) window.__mockDelay = delay;
    },
    { inv, locations, classes, talents, exp, delay, storage },
  );
  await context.addInitScript({ path: MOCK_BRIDGE });

  await page.goto(`${ORIGIN}/index.html`);
  if (waitFor) await page.waitForSelector(waitFor);
  return { page, context, errors };
}

/** Etat de l'inventaire simule : "emplacement:produit=quantite", trie. */
export const stock = (page) =>
  page.evaluate(() =>
    window.__inv
      .filter((l) => l.quantity > 0)
      .reduce((acc, l) => {
        const key = `${l.location ?? '∅'}:${l.productId}`;
        acc[key] = (acc[key] || 0) + l.quantity;
        return acc;
      }, {}),
  );

/** Textes visibles des elements correspondant au selecteur. */
export const texts = (page, selector) =>
  page.$$eval(selector, (nodes) =>
    nodes.filter((n) => n.offsetParent).map((n) => n.innerText.replace(/\s+/g, ' ').trim()),
  );

/** Attend le bandeau dont le texte correspond, le lit puis le ferme. */
export async function toast(page, pattern = /./) {
  await page.waitForFunction(
    (source) => {
      const node = document.querySelector('#toast');
      return !node.hidden && new RegExp(source).test(document.querySelector('#toast-message').textContent);
    },
    pattern.source,
  );
  const message = await page.textContent('#toast-message');
  if (await page.isVisible('#toast-close')) await page.click('#toast-close');
  return message;
}

/** Ouvre un emplacement de la Collection et attend son affichage (titre `title`). */
export async function openPlace(page, name, title = name) {
  await page.click(`[data-place="${name}"]`);
  await page.waitForFunction(
    (n) => !document.querySelector('#deck').hidden && document.querySelector('#app-title').textContent === n,
    title,
  );
}

/** Charge une liste FaBrary par l'onglet Chercher. */
export async function openFabrary(page) {
  await page.click('[data-tab="search"]');
  await page.fill('#deck-input', 'https://fabrary.net/decks/01ABCDEFGH');
  await page.click('#load-btn');
  await page.waitForSelector('#deck:not([hidden])');
}

/** Ouvre le menu ⋯ et choisit une action. */
export async function menu(page, actionId) {
  await page.click('#more-btn');
  await page.click(`#${actionId}`);
}

/** Simule le bouton retour Android. */
export const back = (page) => page.evaluate(() => window.__appBack());
