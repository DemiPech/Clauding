// Pile de scenes : cycle de vie, overlay, bouton retour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scenes } from '../../app/src/main/assets/www/js/engine/scenes.js';

const log = [];
const scene = (name, extra = {}) => ({
  name,
  enter: () => log.push(`enter ${name}`),
  exit: () => log.push(`exit ${name}`),
  pause: () => log.push(`pause ${name}`),
  resume: () => log.push(`resume ${name}`),
  update: () => log.push(`update ${name}`),
  render: () => log.push(`render ${name}`),
  ...extra,
});

test('push / pop préviennent les scènes concernées', () => {
  log.length = 0;
  const s = new Scenes();
  s.push(scene('a'));
  s.push(scene('b'));
  s.pop();
  assert.deepEqual(log, ['enter a', 'pause a', 'enter b', 'exit b', 'resume a']);
  assert.deepEqual(s.names, ['a']);
});

test('seul le sommet est mis à jour ; un overlay laisse voir la scène du dessous', () => {
  const s = new Scenes();
  s.push(scene('a'));
  s.push(scene('b'));
  s.push(scene('menu', { overlay: true }));
  log.length = 0;
  s.update(0.01);
  s.render(null);
  assert.deepEqual(log, ['update menu', 'render b', 'render menu']);
});

test('reset vide la pile, replace ne change que le sommet', () => {
  const s = new Scenes();
  s.push(scene('a'));
  s.push(scene('b'));
  s.replace(scene('c'));
  assert.deepEqual(s.names, ['a', 'c']);
  s.reset(scene('d'));
  assert.deepEqual(s.names, ['d']);
});

test('back() : false sans gestionnaire (l’app quitte)', () => {
  const s = new Scenes();
  s.push(scene('a'));
  assert.equal(s.back(), false);
  s.push(scene('b', { back: () => true }));
  assert.equal(s.back(), true);
});
