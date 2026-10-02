/**
 * Pile de scenes (titre, partie, pause, fin...).
 *
 * Une scene est un objet aux methodes toutes facultatives :
 *   enter()   arrivee sur la pile        exit()    depart de la pile
 *   pause()   une scene passe dessus     resume()  elle redevient au sommet
 *   update(dt), render(ctx)
 *   back()    bouton retour Android : true si gere, false pour quitter l'app
 * et de deux proprietes : name (pour le debogage et les tests) et overlay
 * (true : la scene du dessous reste dessinee, comme un menu de pause).
 *
 * Seule la scene du sommet recoit update() : en dessous, tout est fige.
 */
export class Scenes {
  constructor() {
    this.stack = [];
  }

  get current() {
    return this.stack[this.stack.length - 1];
  }

  get names() {
    return this.stack.map((scene) => scene.name);
  }

  push(scene) {
    this.current?.pause?.();
    this.stack.push(scene);
    scene.enter?.();
  }

  pop() {
    const scene = this.stack.pop();
    scene?.exit?.();
    this.current?.resume?.();
    return scene;
  }

  /** Remplace la scene du sommet. */
  replace(scene) {
    this.stack.pop()?.exit?.();
    this.stack.push(scene);
    scene.enter?.();
  }

  /** Vide la pile et repart de cette scene (retour au titre, nouvelle partie). */
  reset(scene) {
    while (this.stack.length) this.stack.pop().exit?.();
    this.push(scene);
  }

  update(dt) {
    this.current?.update?.(dt);
  }

  /** Dessine depuis la derniere scene opaque jusqu'au sommet. */
  render(ctx) {
    let first = this.stack.length - 1;
    while (first > 0 && this.stack[first].overlay) first -= 1;
    for (let i = Math.max(first, 0); i < this.stack.length; i += 1) this.stack[i].render?.(ctx);
  }

  back() {
    return Boolean(this.current?.back?.());
  }
}
