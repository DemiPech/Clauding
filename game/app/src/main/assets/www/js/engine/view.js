/**
 * Resolution virtuelle : le jeu dessine toujours sur width x height unites,
 * le canvas est mis a l'echelle pour tenir dans l'ecran (bandes noires si
 * le rapport differe) et reste net sur les ecrans haute densite.
 */
export function fitScale(screenW, screenH, width, height) {
  const scale = Math.min(screenW / width, screenH / height);
  const w = width * scale;
  const h = height * scale;
  return { scale, w, h, left: (screenW - w) / 2, top: (screenH - h) / 2 };
}

export function createView(canvas, width, height) {
  const ctx = canvas.getContext('2d');
  let fit = fitScale(window.innerWidth, window.innerHeight, width, height);

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    fit = fitScale(window.innerWidth, window.innerHeight, width, height);
    canvas.style.width = `${fit.w}px`;
    canvas.style.height = `${fit.h}px`;
    canvas.style.left = `${fit.left}px`;
    canvas.style.top = `${fit.top}px`;
    canvas.width = Math.round(fit.w * dpr);
    canvas.height = Math.round(fit.h * dpr);
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  window.addEventListener('resize', resize);
  resize();

  return {
    ctx,
    width,
    height,
    /** Coordonnees ecran (clientX/Y) vers coordonnees du jeu. */
    toGame(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * width,
        y: ((clientY - rect.top) / rect.height) * height,
      };
    },
    resize,
  };
}
