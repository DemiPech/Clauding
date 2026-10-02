import { WIDTH, COLORS } from '../config.js';
import { clear, text } from '../ui.js';
import { createWorld, step } from '../world.js';
import { pauseScene } from './pause.js';
import { gameOverScene } from './gameover.js';

const PAUSE_BUTTON = { x: WIDTH - 52, y: 8, w: 44, h: 44 };

export function playScene(game) {
  const world = createWorld(game.rng);
  const pause = () => game.scenes.push(pauseScene(game));

  return {
    name: 'play',
    world,
    update(dt) {
      const { input, audio } = game;
      if (input.tapped(PAUSE_BUTTON) || input.wasPressed('Escape', 'KeyP')) {
        pause();
        return;
      }
      const move = (input.isDown('ArrowRight', 'KeyD') ? 1 : 0) - (input.isDown('ArrowLeft', 'KeyA') ? 1 : 0);
      const targetX = input.pointer.down ? input.pointer.x : null;

      for (const event of step(world, dt, { targetX, move })) {
        if (event === 'catch') audio.beep({ freq: 880, duration: 0.08, type: 'triangle' });
        if (event === 'hit') audio.beep({ freq: 160, duration: 0.25, type: 'sawtooth', slide: -80 });
        if (event === 'over') game.scenes.replace(gameOverScene(game, world.score));
      }
    },
    render(ctx) {
      clear(ctx);
      for (const item of world.items) {
        ctx.fillStyle = item.kind === 'star' ? COLORS.star : COLORS.bomb;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
        ctx.fill();
      }
      const p = world.player;
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, 7);
      ctx.fill();

      text(ctx, world.score, 20, 30, { size: 26, align: 'left' });
      text(ctx, '♥'.repeat(Math.max(world.lives, 0)), WIDTH / 2, 30, { size: 20, color: COLORS.bomb });
      // Bouton pause
      ctx.fillStyle = COLORS.text;
      ctx.fillRect(PAUSE_BUTTON.x + 13, PAUSE_BUTTON.y + 12, 6, 20);
      ctx.fillRect(PAUSE_BUTTON.x + 25, PAUSE_BUTTON.y + 12, 6, 20);
    },
    // Appli en arriere-plan ou bouton retour : pause.
    suspend: pause,
    back() {
      pause();
      return true;
    },
  };
}
