export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Nombre aleatoire dans [min, max[ ; rng injectable pour des tests reproductibles. */
export const rand = (min, max, rng = Math.random) => min + (max - min) * rng();

/** Generateur pseudo-aleatoire a graine (mulberry32). */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Collision entre deux cercles {x, y, r}. */
export const circlesOverlap = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (a.r + b.r) ** 2;

/** Collision entre deux rectangles {x, y, w, h}. */
export const rectsOverlap = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Collision entre un cercle {x, y, r} et un rectangle {x, y, w, h}. */
export function circleRectOverlap(c, r) {
  const nx = clamp(c.x, r.x, r.x + r.w);
  const ny = clamp(c.y, r.y, r.y + r.h);
  return (c.x - nx) ** 2 + (c.y - ny) ** 2 < c.r ** 2;
}
