// Parcours complet : titre, partie, pause (bouton retour), fin, record.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, close, scenes, tapGame, waitScenes } from '../helpers/app.mjs';

after(close);

test('le canvas remplit l’écran en gardant les proportions du jeu', async () => {
  const { page, context, errors } = await openGame();
  const box = await page.locator('#screen').boundingBox();
  assert.equal(Math.round(box.width), 390);
  assert.equal(Math.round(box.height), Math.round((390 * 640) / 360));
  assert.ok(box.y > 0); // bandes au-dessus et en dessous, centre
  assert.deepEqual(await scenes(page), ['title']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('jouer, mettre en pause par le bouton retour, reprendre', async () => {
  const { page, context, errors } = await openGame();
  // A l'ecran titre, retour quitte l'app.
  assert.equal(await page.evaluate(() => window.__appBack()), false);

  await tapGame(page, 180, 368); // Jouer
  await waitScenes(page, ['play']);

  // Le joueur suit le doigt.
  const box = await page.locator('#screen').boundingBox();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.waitForFunction(() => {
    const p = window.__game.scenes.current.world.player;
    return p.x + p.w / 2 > 300;
  });
  await page.mouse.up();

  assert.equal(await page.evaluate(() => window.__appBack()), true);
  await waitScenes(page, ['play', 'pause']);
  const time = await page.evaluate(() => window.__game.scenes.stack[0].world.time);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__game.scenes.stack[0].world.time), time, 'figé en pause');

  assert.equal(await page.evaluate(() => window.__appBack()), true);
  await waitScenes(page, ['play']);

  // L'app passe en arriere-plan : pause automatique.
  await page.evaluate(() => window.__appPause());
  assert.deepEqual(await scenes(page), ['play', 'pause']);

  await tapGame(page, 180, 408); // Menu
  await waitScenes(page, ['title']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('fin de partie : le record est enregistré et affiché', async () => {
  const { page, context, errors } = await openGame({ storage: { 'game.best': '2' } });
  await page.keyboard.press('Enter');
  await waitScenes(page, ['play']);

  await page.evaluate(() => {
    const { world } = window.__game.scenes.current;
    world.score = 5;
    world.lives = 1;
    world.spawnIn = 99;
    const p = world.player;
    world.items.push({ kind: 'bomb', x: p.x + p.w / 2, y: p.y, r: 12 });
  });
  await waitScenes(page, ['gameover']);
  assert.equal(await page.evaluate(() => localStorage.getItem('game.best')), '5');

  await tapGame(page, 180, 388); // Rejouer
  await waitScenes(page, ['play']);
  assert.equal(await page.evaluate(() => window.__game.scenes.current.world.score), 0);
  assert.deepEqual(errors, []);
  await context.close();
});
