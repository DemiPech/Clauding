// Sauvegarde, collisions, mise a l'echelle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../app/src/main/assets/www/js/engine/storage.js';
import { circlesOverlap, rectsOverlap, circleRectOverlap, clamp } from '../../app/src/main/assets/www/js/engine/math.js';
import { fitScale } from '../../app/src/main/assets/www/js/engine/view.js';

const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
};

test('sauvegarde : valeurs JSON préfixées, défaut si absent ou illisible', () => {
  const storage = memory();
  const store = createStore('g.', storage);
  assert.equal(store.get('best', 0), 0);
  store.set('best', 12);
  assert.equal(storage.data.get('g.best'), '12');
  assert.equal(store.get('best', 0), 12);
  storage.setItem('g.broken', '{oops');
  assert.equal(store.get('broken', 'def'), 'def');
});

test('sauvegarde : un stockage indisponible ne plante pas', () => {
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const store = createStore('g.', broken);
  assert.equal(store.get('a', 1), 1);
  assert.equal(store.set('a', 2), false);
});

test('collisions', () => {
  assert.ok(circlesOverlap({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 }));
  assert.ok(!circlesOverlap({ x: 0, y: 0, r: 5 }, { x: 11, y: 0, r: 5 }));
  assert.ok(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 }));
  assert.ok(!rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 }));
  assert.ok(circleRectOverlap({ x: 15, y: 5, r: 6 }, { x: 0, y: 0, w: 10, h: 10 }));
  assert.ok(!circleRectOverlap({ x: 15, y: 15, r: 6 }, { x: 0, y: 0, w: 10, h: 10 }));
  assert.equal(clamp(5, 0, 3), 3);
});

test('mise à l’échelle : tient dans l’écran, centrée', () => {
  assert.deepEqual(fitScale(720, 1280, 360, 640), { scale: 2, w: 720, h: 1280, left: 0, top: 0 });
  const wide = fitScale(1000, 640, 360, 640);
  assert.equal(wide.scale, 1);
  assert.equal(wide.left, 320);
});
