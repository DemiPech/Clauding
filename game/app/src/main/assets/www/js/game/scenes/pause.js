import { WIDTH } from '../config.js';
import { text, button, centered, dim } from '../ui.js';
import { titleScene } from './title.js';

export function pauseScene(game) {
  const resume = centered(300);
  const quit = centered(380);

  return {
    name: 'pause',
    overlay: true,
    update() {
      const { input } = game;
      if (input.tapped(resume) || input.wasPressed('Escape', 'KeyP', 'Enter')) game.scenes.pop();
      else if (input.tapped(quit)) game.scenes.reset(titleScene(game));
    },
    render(ctx) {
      dim(ctx);
      text(ctx, 'Pause', WIDTH / 2, 220, { size: 36 });
      button(ctx, resume, 'Reprendre');
      button(ctx, quit, 'Menu', { color: '#2a3550' });
    },
    back() {
      game.scenes.pop();
      return true;
    },
  };
}
