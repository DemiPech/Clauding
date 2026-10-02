// Boucle a pas fixe : meme simulation quel que soit le rythme des images.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLoop } from '../../app/src/main/assets/www/js/engine/loop.js';

const make = (opts = {}) => {
  const calls = { updates: [], renders: [] };
  const loop = createLoop({
    update: (dt) => calls.updates.push(dt),
    render: (alpha) => calls.renders.push(alpha),
    step: 0.01,
    now: () => 0,
    raf: () => 1,
    caf: () => {},
    ...opts,
  });
  loop.start();
  return { loop, calls };
};

test('le nombre de pas suit le temps écoulé, pas le nombre d’images', () => {
  const { loop, calls } = make();
  assert.equal(loop.frame(25), 2); // 25 ms = 2 pas, reste 5 ms
  assert.equal(loop.frame(30), 1); // +5 ms = 10 ms
  assert.equal(loop.frame(31), 0);
  assert.equal(calls.updates.length, 3);
  assert.ok(calls.updates.every((dt) => dt === 0.01));
  assert.equal(calls.renders.length, 3);
});

test('alpha donne la fraction de pas restante', () => {
  const { loop, calls } = make();
  loop.frame(15);
  assert.ok(Math.abs(calls.renders[0] - 0.5) < 1e-9);
});

test('une très longue image est plafonnée', () => {
  const { loop } = make({ maxDelta: 0.1 });
  assert.equal(loop.frame(5000), 10);
});

test('stop() arrête de redemander des images', () => {
  let requested = 0;
  const { loop } = make({ raf: () => (requested += 1) });
  loop.frame(10);
  loop.stop();
  loop.frame(20);
  assert.equal(requested, 2); // start() + la premiere image
  assert.equal(loop.running, false);
});
