// Petits outils de dessin partages par les scenes.
import { COLORS, WIDTH, HEIGHT } from './config.js';

export function clear(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, COLORS.bgTop);
  gradient.addColorStop(1, COLORS.bg);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

export function text(ctx, value, x, y, { size = 20, color = COLORS.text, align = 'center', weight = 'bold' } = {}) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), x, y);
}

/** Un bouton : rectangle {x, y, w, h} + libelle. Le toucher se teste avec input.tapped(rect). */
export function button(ctx, rect, label, { color = COLORS.accent, size = 20 } = {}) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fill();
  text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2, { size });
}

export const centered = (y, w = 200, h = 56) => ({ x: (WIDTH - w) / 2, y, w, h });

export function dim(ctx, alpha = 0.6) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}
