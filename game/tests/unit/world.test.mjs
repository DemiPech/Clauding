// Logique de la demo : deplacement, apparition, captures, fin de partie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step } from '../../app/src/main/assets/www/js/game/world.js';
import { RULES, WIDTH } from '../../app/src/main/assets/www/js/game/config.js';
import { seeded } from '../../app/src/main/assets/www/js/engine/math.js';

const DT = 1 / 60;
const run = (world, seconds, input) => {
  const events = [];
  for (let t = 0; t < seconds; t += DT) events.push(...step(world, DT, input));
  return events;
};

test('le joueur suit le doigt sans sortir de l’écran', () => {
  const world = createWorld(seeded(1));
  run(world, 1, { targetX: 9999 });
  assert.equal(world.player.x, WIDTH - RULES.playerW);
  run(world, 1, { targetX: 100 });
  assert.ok(Math.abs(world.player.x + RULES.playerW / 2 - 100) < 1e-6);
  run(world, 1, { move: -1 });
  assert.equal(world.player.x, 0);
});

test('une étoile sur le joueur rapporte un point, une bombe coûte une vie', () => {
  const world = createWorld(seeded(1));
  const center = world.player.x + world.player.w / 2;
  world.spawnIn = 99;
  world.items.push({ kind: 'star', x: center, y: world.player.y - 5, r: 12 });
  assert.deepEqual(step(world, DT), ['catch']);
  world.items.push({ kind: 'bomb', x: center, y: world.player.y - 5, r: 12 });
  assert.deepEqual(step(world, DT), ['hit']);
  assert.equal(world.score, 1);
  assert.equal(world.lives, RULES.lives - 1);
  assert.equal(world.items.length, 0);
});

test('les objets apparaissent et disparaissent en bas', () => {
  const world = createWorld(seeded(2));
  world.player.x = -1000; // hors d'atteinte
  run(world, 2);
  assert.ok(world.items.length > 0);
  run(world, 30);
  assert.ok(world.items.every((item) => item.y < 700));
});

test('plus de vies : partie terminée, le monde ne bouge plus', () => {
  const world = createWorld(seeded(3));
  world.lives = 1;
  world.spawnIn = 99;
  world.items.push({ kind: 'bomb', x: world.player.x + 10, y: world.player.y, r: 12 });
  assert.deepEqual(step(world, DT), ['hit', 'over']);
  assert.deepEqual(step(world, DT), []);
});

test('même graine, même partie', () => {
  const a = createWorld(seeded(42));
  const b = createWorld(seeded(42));
  run(a, 20, { move: 1 });
  run(b, 20, { move: 1 });
  assert.deepEqual({ ...a, rng: 0 }, { ...b, rng: 0 });
});
