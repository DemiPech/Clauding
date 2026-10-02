/**
 * Sons generes (WebAudio), sans fichier : de quoi avoir du retour sonore des
 * le depart. Pour de vrais sons, charger des fichiers (assets/www/sounds/)
 * avec fetch() + decodeAudioData() et les jouer avec un AudioBufferSourceNode.
 *
 * Le navigateur n'autorise le son qu'apres un geste : unlock() est appele au
 * premier toucher.
 */
export function createAudio(store) {
  let ctx = null;
  let muted = store.get('muted', false);

  return {
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      store.set('muted', muted);
      return muted;
    },
    unlock() {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!ctx && Ctor) ctx = new Ctor();
      ctx?.resume?.();
    },
    suspend() {
      ctx?.suspend?.();
    },
    /** Un bip : frequence (Hz), duree (s), forme d'onde, volume (0..1), glissando (Hz). */
    beep({ freq = 440, duration = 0.1, type = 'square', volume = 0.15, slide = 0 } = {}) {
      if (muted || !ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t + duration);
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duration);
    },
  };
}
