/**
 * Logique de la demo, sans dessin ni entree : un etat et une fonction step().
 * Testable seule (tests/unit/world.test.mjs). Remplacer ce fichier par la
 * logique de votre jeu.
 */
import { RULES, WIDTH, HEIGHT } from './config.js';
import { clamp, rand, circleRectOverlap } from '../engine/math.js';

export function createWorld(rng = Math.random) {
  return {
    rng,
    time: 0,
    score: 0,
    lives: RULES.lives,
    spawnIn: RULES.spawnEvery,
    player: { x: WIDTH / 2 - RULES.playerW / 2, y: RULES.playerY, w: RULES.playerW, h: RULES.playerH },
    items: [],
    over: false,
  };
}

export const fallSpeed = (world) => RULES.fallSpeed + world.score * RULES.speedPerPoint;

/**
 * Avance le monde de dt secondes. targetX : abscisse visee par le centre du
 * joueur (doigt), ou null. move : -1, 0 ou 1 (clavier).
 * Renvoie les evenements du pas : 'catch', 'hit', 'over'.
 */
export function step(world, dt, { targetX = null, move = 0 } = {}) {
  const events = [];
  if (world.over) return events;
  world.time += dt;

  const p = world.player;
  const maxMove = RULES.playerSpeed * dt;
  let dx = move * maxMove;
  if (targetX !== null) dx = clamp(targetX - (p.x + p.w / 2), -maxMove, maxMove);
  p.x = clamp(p.x + dx, 0, WIDTH - p.w);

  world.spawnIn -= dt;
  if (world.spawnIn <= 0) {
    const r = RULES.radius;
    world.items.push({
      kind: world.rng() < RULES.bombChance ? 'bomb' : 'star',
      x: rand(r, WIDTH - r, world.rng),
      y: -r,
      r,
    });
    world.spawnIn += Math.max(RULES.spawnMin, RULES.spawnEvery - world.score * 0.01);
  }

  const speed = fallSpeed(world);
  for (const item of world.items) {
    item.y += speed * dt;
    if (circleRectOverlap(item, p)) {
      item.dead = true;
      if (item.kind === 'star') {
        world.score += 1;
        events.push('catch');
      } else {
        world.lives -= 1;
        events.push('hit');
      }
    } else if (item.y - item.r > HEIGHT) {
      item.dead = true;
    }
  }
  world.items = world.items.filter((item) => !item.dead);

  if (world.lives <= 0) {
    world.over = true;
    events.push('over');
  }
  return events;
}
