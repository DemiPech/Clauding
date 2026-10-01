// Barre de progression sous la barre du haut : ce qui se charge, et où on en est.
import { onProgress, progressState } from '../progress.js';

const SHOW_DELAY_MS = 300;

const node = document.querySelector('#progress');
const fill = document.querySelector('#progress-fill');
const label = document.querySelector('#progress-label');
const detail = document.querySelector('#progress-detail');
const loadingDetail = document.querySelector('#state-loading-progress');

let showTimer = null;
let pauseTicker = null;

const percent = (task) => Math.floor(task.fraction * 100);

/** Le texte principal : « Lecture de « Vrac 1 » · 45 % ». */
function headline({ task, others }) {
  const pct = task.determinate ? ` · ${percent(task)} %` : '';
  const more = others ? ` (+${others})` : '';
  return `${task.label}${pct}${more}`;
}

function secondLine({ task, pause }) {
  if (pause) {
    const seconds = Math.max(1, Math.ceil((pause.until - Date.now()) / 1000));
    return `${pause.reason} : reprise dans ${seconds} s`;
  }
  return task.detail;
}

function draw(state) {
  if (!state.task) return hide();
  node.hidden = false;
  node.classList.toggle('is-indeterminate', !state.task.determinate);
  node.classList.toggle('is-background', state.background);
  fill.style.width = state.task.determinate ? `${percent(state.task)}%` : '';
  label.textContent = headline(state);
  detail.textContent = secondLine(state);

  // L'écran « Récupération… » reprend le même avancement, en plus grand.
  const big = [state.task.determinate ? `${percent(state.task)} %` : '', secondLine(state)];
  loadingDetail.textContent = state.background ? '' : big.filter(Boolean).join(' · ');

  // Une pause du quota : le décompte avance même sans nouvelle donnée.
  if (state.pause && !pauseTicker) {
    pauseTicker = setInterval(() => {
      const current = progressState();
      if (!current.pause) {
        clearInterval(pauseTicker);
        pauseTicker = null;
      }
      if (!node.hidden) draw(current);
    }, 1000);
  }
}

function hide() {
  clearTimeout(showTimer);
  showTimer = null;
  node.hidden = true;
  loadingDetail.textContent = '';
}

/**
 * Un chargement servi par le cache dure quelques millisecondes : on n'affiche
 * la barre qu'au-delà d'un court délai, pour éviter qu'elle clignote.
 */
function update(state) {
  if (!state.task) return hide();
  if (!node.hidden) return draw(state);
  if (!showTimer) {
    showTimer = setTimeout(() => {
      showTimer = null;
      draw(progressState());
    }, SHOW_DELAY_MS);
  }
}

export function listenForProgress() {
  onProgress(update);
}
