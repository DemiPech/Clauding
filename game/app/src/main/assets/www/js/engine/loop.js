/**
 * Boucle de jeu a pas fixe.
 *
 * update(dt) est toujours appele avec le meme dt (step), quel que soit le
 * rythme de l'ecran : la physique reste identique a 60 Hz comme a 120 Hz.
 * render(alpha) est appele une fois par image ; alpha (0..1) indique ou l'on
 * en est entre deux pas, pour interpoler si besoin.
 *
 * Une image tres longue (app en arriere-plan, ralentissement) est plafonnee a
 * maxDelta pour eviter de rattraper des centaines de pas d'un coup.
 */
export function createLoop({
  update,
  render,
  step = 1 / 60,
  maxDelta = 0.25,
  now = () => performance.now(),
  raf = (cb) => requestAnimationFrame(cb),
  caf = (id) => cancelAnimationFrame(id),
}) {
  let running = false;
  let last = 0;
  let acc = 0;
  let handle = 0;

  /** Une image : renvoie le nombre de pas de simulation effectues. */
  function frame(time) {
    const delta = Math.min(Math.max((time - last) / 1000, 0), maxDelta);
    last = time;
    acc += delta;
    let steps = 0;
    while (acc >= step) {
      update(step);
      acc -= step;
      steps += 1;
    }
    render(acc / step);
    if (running) handle = raf(frame);
    return steps;
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = now();
      acc = 0;
      handle = raf(frame);
    },
    stop() {
      running = false;
      caf(handle);
    },
    get running() {
      return running;
    },
    frame,
  };
}
