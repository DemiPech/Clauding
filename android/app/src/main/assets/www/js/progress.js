/**
 * Progression des chargements, affichée en haut de l'écran.
 *
 * Une tâche (startTask) couvre une opération que l'utilisateur attend : ouvrir
 * un emplacement, compter la collection, calculer un plan… Le code qui lit les
 * données reçoit un « rapporteur » et y signale où il en est (report, de 0 à
 * 1). `sub(a, b)` découpe une étape en morceaux : lire les lignes de 0 à 70 %,
 * puis le catalogue de 70 à 100 %, par exemple.
 *
 * Les tâches d'arrière-plan (mise à jour au démarrage, photo automatique) ne
 * s'affichent que si rien d'autre n'est en cours.
 */

const tasks = [];
const listeners = new Set();
let pause = null;

const emit = () => {
  const state = progressState();
  for (const listener of listeners) listener(state);
};

const clamp = (value) => Math.min(1, Math.max(0, Number(value) || 0));

function reporter(task, from, to) {
  const at = (fraction) => from + (to - from) * clamp(fraction);
  return {
    /** Avancement de cette étape (0 à 1), avec un détail facultatif (« 400 / 1 200 lignes »). */
    report(fraction, detail) {
      // Jamais de recul : deux étapes qui se chevauchent ne font pas reculer la barre.
      task.fraction = Math.max(task.fraction, at(fraction));
      task.determinate = true;
      if (detail !== undefined) task.detail = detail;
      emit();
    },
    detail(text) {
      task.detail = text;
      emit();
    },
    sub(a, b) {
      return reporter(task, at(a), at(b));
    },
  };
}

/** Un rapporteur qui ne montre rien, pour le code appelé hors de toute tâche. */
export const silent = {
  report() {},
  detail() {},
  sub() {
    return silent;
  },
};

/**
 * Démarre une tâche affichée. Renvoie son rapporteur, avec `end()` à appeler
 * quoi qu'il arrive (ou passer par `track`).
 */
export function startTask(label, { background = false } = {}) {
  const task = { label, background, fraction: 0, determinate: false, detail: '', startedAt: Date.now() };
  tasks.push(task);
  emit();
  return Object.assign(reporter(task, 0, 1), {
    end() {
      const index = tasks.indexOf(task);
      if (index >= 0) tasks.splice(index, 1);
      emit();
    },
  });
}

/** Exécute `run(rapporteur)` dans une tâche affichée. */
export async function track(label, run, options) {
  const task = startTask(label, options);
  try {
    return await run(task);
  } finally {
    task.end();
  }
}

/** CardNexus impose une pause (quota de requêtes) : on l'affiche avec son décompte. */
export function pauseFor(ms, reason) {
  const until = Date.now() + ms;
  pause = { until, reason };
  emit();
  setTimeout(() => {
    if (pause?.until === until) {
      pause = null;
      emit();
    }
  }, ms);
}

/**
 * Ce qu'il faut afficher : la plus ancienne tâche au premier plan (celle que
 * l'on attend depuis le plus longtemps), sinon la plus ancienne en arrière-plan.
 */
export function progressState() {
  const foreground = tasks.filter((task) => !task.background);
  const pool = foreground.length ? foreground : tasks;
  return {
    task: pool[0] || null,
    others: Math.max(0, pool.length - 1),
    background: !foreground.length,
    pause: pause && pause.until > Date.now() ? pause : null,
  };
}

export function onProgress(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** « 1 234 » : les nombres des détails, lisibles. */
export const formatCount = (n) => Number(n).toLocaleString('fr-FR');
