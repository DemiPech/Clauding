/**
 * Entrees : toucher / souris (pointeur unique) et clavier.
 *
 * Les etats "pressed" (appui depuis le dernier pas) durent jusqu'a endStep(),
 * appele apres chaque update() : un appui n'est jamais perdu, meme si une
 * image ne contient aucun pas de simulation, ni compte deux fois.
 *
 * toGame(clientX, clientY) convertit les coordonnees de l'ecran en
 * coordonnees du jeu (voir view.js).
 */
export function createInput(target, toGame, keyTarget = window) {
  const pointer = { x: 0, y: 0, down: false, pressed: false, released: false };
  const held = new Set();
  const pressed = new Set();
  const listeners = [];

  const on = (node, type, fn, options) => {
    node.addEventListener(type, fn, options);
    listeners.push(() => node.removeEventListener(type, fn, options));
  };

  const move = (event) => {
    const point = toGame(event.clientX, event.clientY);
    pointer.x = point.x;
    pointer.y = point.y;
  };

  on(target, 'pointerdown', (event) => {
    event.preventDefault();
    target.setPointerCapture?.(event.pointerId);
    move(event);
    pointer.down = true;
    pointer.pressed = true;
  });
  on(target, 'pointermove', move);
  const up = (event) => {
    move(event);
    if (pointer.down) pointer.released = true;
    pointer.down = false;
  };
  on(target, 'pointerup', up);
  on(target, 'pointercancel', up);

  on(keyTarget, 'keydown', (event) => {
    if (!held.has(event.code)) pressed.add(event.code);
    held.add(event.code);
  });
  on(keyTarget, 'keyup', (event) => held.delete(event.code));
  on(keyTarget, 'blur', () => held.clear());

  return {
    pointer,
    /** Une touche est enfoncee (codes KeyboardEvent.code : 'ArrowLeft', 'Space'...). */
    isDown: (...codes) => codes.some((code) => held.has(code)),
    /** Une touche vient d'etre enfoncee. */
    wasPressed: (...codes) => codes.some((code) => pressed.has(code)),
    /** Le doigt vient de toucher dans ce rectangle (tous les rectangles si absent). */
    tapped(rect) {
      if (!pointer.pressed) return false;
      if (!rect) return true;
      return pointer.x >= rect.x && pointer.x <= rect.x + rect.w
        && pointer.y >= rect.y && pointer.y <= rect.y + rect.h;
    },
    endStep() {
      pointer.pressed = false;
      pointer.released = false;
      pressed.clear();
    },
    /** Oublie tout (changement de scene, mise en pause). */
    reset() {
      pointer.down = false;
      held.clear();
      this.endStep();
    },
    destroy() {
      listeners.forEach((off) => off());
    },
  };
}
