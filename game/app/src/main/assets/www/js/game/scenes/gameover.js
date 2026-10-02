import { WIDTH, COLORS } from '../config.js';
import { clear, text, button, centered } from '../ui.js';
import { titleScene } from './title.js';
import { playScene } from './play.js';

export function gameOverScene(game, score) {
  const best = Math.max(score, game.save.get('best', 0));
  const record = score > 0 && score === best && score > game.save.get('best', 0);
  game.save.set('best', best);
  const again = centered(360);
  const menu = centered(440);

  return {
    name: 'gameover',
    score,
    update() {
      const { input } = game;
      if (input.tapped(again) || input.wasPressed('Enter', 'Space')) game.scenes.reset(playScene(game));
      else if (input.tapped(menu)) game.scenes.reset(titleScene(game));
    },
    render(ctx) {
      clear(ctx);
      text(ctx, 'Partie terminée', WIDTH / 2, 180, { size: 32 });
      text(ctx, score, WIDTH / 2, 250, { size: 56, color: COLORS.star });
      text(ctx, record ? 'Nouveau record !' : `Record : ${best}`, WIDTH / 2, 300, { size: 18, color: COLORS.dim });
      button(ctx, again, 'Rejouer');
      button(ctx, menu, 'Menu', { color: '#2a3550' });
    },
    back() {
      game.scenes.reset(titleScene(game));
      return true;
    },
  };
}
