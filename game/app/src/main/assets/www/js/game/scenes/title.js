import { WIDTH, COLORS } from '../config.js';
import { clear, text, button, centered } from '../ui.js';
import { playScene } from './play.js';

export function titleScene(game) {
  const play = centered(340);
  const sound = centered(420, 200, 44);
  let t = 0;

  return {
    name: 'title',
    update(dt) {
      t += dt;
      if (game.input.tapped(sound)) {
        game.audio.toggleMute();
        game.audio.beep({ freq: 660 });
      } else if (game.input.tapped(play) || game.input.wasPressed('Enter', 'Space')) {
        game.audio.beep({ freq: 520, slide: 300 });
        game.scenes.reset(playScene(game));
      }
    },
    render(ctx) {
      clear(ctx);
      text(ctx, 'Attrape-étoiles', WIDTH / 2, 180 + Math.sin(t * 2) * 6, { size: 36 });
      text(ctx, 'Attrape les étoiles, évite les bombes', WIDTH / 2, 230, { size: 15, color: COLORS.dim, weight: 'normal' });
      button(ctx, play, 'Jouer');
      button(ctx, sound, game.audio.muted ? 'Son : coupé' : 'Son : activé', { color: '#2a3550', size: 16 });
      text(ctx, `Record : ${game.save.get('best', 0)}`, WIDTH / 2, 520, { size: 18, color: COLORS.star });
    },
    // A l'ecran titre, retour quitte l'app.
    back: () => false,
  };
}
