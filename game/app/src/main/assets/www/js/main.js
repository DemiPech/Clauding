/**
 * Point d'entree : assemble le moteur (boucle, vue, entrees, son, sauvegarde)
 * et lance la premiere scene.
 *
 * Tout ce qu'une scene peut utiliser passe par l'objet `game` :
 *   game.scenes  pile de scenes       game.input  toucher et clavier
 *   game.audio   sons                 game.save   sauvegarde
 *   game.rng     hasard (remplacable par seeded() pour rejouer une partie)
 */
import { WIDTH, HEIGHT, SAVE_PREFIX } from './game/config.js';
import { createLoop } from './engine/loop.js';
import { Scenes } from './engine/scenes.js';
import { createInput } from './engine/input.js';
import { createView } from './engine/view.js';
import { createStore } from './engine/storage.js';
import { createAudio } from './engine/audio.js';
import { titleScene } from './game/scenes/title.js';

const canvas = document.getElementById('screen');
const view = createView(canvas, WIDTH, HEIGHT);
const save = createStore(SAVE_PREFIX);

const game = {
  view,
  save,
  scenes: new Scenes(),
  input: createInput(canvas, view.toGame),
  audio: createAudio(save),
  rng: Math.random,
};

canvas.addEventListener('pointerdown', () => game.audio.unlock());
window.addEventListener('keydown', () => game.audio.unlock());

const loop = createLoop({
  update(dt) {
    game.scenes.update(dt);
    game.input.endStep();
  },
  render() {
    game.scenes.render(view.ctx);
  },
});

/** Appele par MainActivity quand l'app passe en arriere-plan. */
function suspend() {
  game.scenes.current?.suspend?.();
  game.input.reset();
  game.audio.suspend();
}

window.__appPause = suspend;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) suspend();
});

/** Bouton retour Android : true si le jeu l'a gere, false pour quitter. */
window.__appBack = () => game.scenes.back();

// Pour les tests et le debogage (chrome://inspect sur une version debug).
window.__game = game;

game.scenes.push(titleScene(game));
loop.start();
