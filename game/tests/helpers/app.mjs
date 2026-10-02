/**
 * Lance le jeu dans Chromium, comme dans la WebView Android : les fichiers de
 * assets/www sont servis sous la meme origine que dans l'app.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.resolve(HERE, '../../app/src/main/assets/www');
const ORIGIN = 'https://appassets.androidplatform.net';
const MIME = { html: 'text/html', css: 'text/css', js: 'text/javascript' };

let browser;

export async function close() {
  await browser?.close();
  browser = undefined;
}

export async function openGame({ storage = {} } = {}) {
  browser ??= await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await context.route(`${ORIGIN}/**`, (route) => {
    let pathname = new URL(route.request().url()).pathname;
    if (pathname === '/') pathname = '/index.html';
    const file = path.join(WWW, pathname);
    if (!file.startsWith(WWW) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: MIME[file.split('.').pop()], body: fs.readFileSync(file) });
  });
  await context.addInitScript((values) => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  }, storage);

  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => window.__game?.scenes.names.length);
  return { page, context, errors };
}

/** Pile de scenes courante. */
export const scenes = (page) => page.evaluate(() => window.__game.scenes.names);

/** Touche l'ecran aux coordonnees du jeu (x, y). */
export async function tapGame(page, x, y) {
  const box = await page.locator('#screen').boundingBox();
  await page.touchscreen.tap(box.x + (x / 360) * box.width, box.y + (y / 640) * box.height);
}

/** Attend que la pile de scenes soit celle-ci. */
export const waitScenes = (page, names) =>
  page.waitForFunction((expected) => window.__game.scenes.names.join() === expected, names.join());
