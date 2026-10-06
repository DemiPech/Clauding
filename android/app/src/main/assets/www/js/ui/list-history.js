// Historique des listes consultées (FaBrary et fabtcg.com), dans l'onglet
// Chercher : groupé par héros, filtrable par héros, et chaque liste se retire.
import { escapeHtml, isListSource } from './core.js';

const STORAGE = 'list_history';
const MAX_ENTRIES = 300;

const $ = (sel) => document.querySelector(sel);
const node = $('#list-history');
const chips = $('#list-history-heroes');
const groups = $('#list-history-groups');

/** Le héros affiché dans les filtres (null : tous). */
let heroFilter = null;
let openList = () => {};

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    // Mémoire pleine : l'historique n'est simplement pas mis à jour.
  }
}

/** Ce qui identifie une liste : son lien fabtcg.com, ou son identifiant FaBrary. */
const refOf = (deck) => (deck.source === 'fabtcg' ? deck.url : deck.deckId);

/** Une liste vient d'être ouverte : elle passe en tête de l'historique. */
export function recordListVisit(deck) {
  if (!isListSource(deck?.source)) return;
  const ref = refOf(deck);
  const entry = {
    ref,
    source: deck.source,
    name: deck.name,
    hero: deck.hero?.name || null,
    heroImage: deck.hero?.imageUrl || null,
    author: deck.author || null,
    format: deck.format || null,
    visitedAt: new Date().toISOString(),
  };
  write([entry, ...read().filter((e) => e.ref !== ref)]);
}

export function removeListVisit(ref) {
  write(read().filter((e) => e.ref !== ref));
  renderListHistory();
}

const NO_HERO = 'Sans héros';
const heroOf = (entry) => entry.hero || NO_HERO;

/**
 * Les listes consultées, par héros : le héros consulté le plus récemment en
 * premier, et dans chaque héros, la liste la plus récente en premier.
 */
export function renderListHistory() {
  const list = read();
  node.hidden = !list.length;
  if (!list.length) return;

  const heroes = [];
  for (const entry of list) if (!heroes.includes(heroOf(entry))) heroes.push(heroOf(entry));
  if (heroFilter && !heroes.includes(heroFilter)) heroFilter = null;

  const chip = (hero, label, count) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.dataset.hero = hero ?? '';
    button.textContent = count == null ? label : `${label} (${count})`;
    button.classList.toggle('is-active', hero === heroFilter);
    return button;
  };
  chips.replaceChildren(
    chip(null, `Tous (${list.length})`),
    ...heroes.map((hero) => chip(hero, hero, list.filter((e) => heroOf(e) === hero).length)),
  );
  chips.hidden = heroes.length < 2;

  groups.replaceChildren(
    ...heroes
      .filter((hero) => !heroFilter || hero === heroFilter)
      .map((hero) => {
        const entries = list.filter((e) => heroOf(e) === hero);
        const section = document.createElement('section');
        section.className = 'picker';
        section.innerHTML = `
          <div class="section-head">
            <h2>${escapeHtml(hero)}</h2>
            <span class="section-count">${entries.length}</span>
          </div>
        `;
        const ul = document.createElement('ul');
        ul.className = 'history-lists';
        ul.append(...entries.map(entryNode));
        section.append(ul);
        return section;
      }),
  );
}

function entryNode(entry) {
  const li = document.createElement('li');
  li.className = 'history-list';
  li.dataset.ref = entry.ref;
  const date = new Date(entry.visitedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const meta = [entry.author, entry.format, entry.source === 'fabtcg' ? 'fabtcg.com' : 'FaBrary', date]
    .filter(Boolean)
    .join(' · ');
  li.innerHTML = `
    <button type="button" class="history-list-open" data-act="open">
      ${entry.heroImage ? `<img class="history-list-art" alt="" loading="lazy" src="${escapeHtml(entry.heroImage)}" />` : ''}
      <span class="history-list-body">
        <span class="history-list-name">${escapeHtml(entry.name)}</span>
        <span class="history-list-meta">${escapeHtml(meta)}</span>
      </span>
    </button>
    <button type="button" class="icon-btn history-list-remove" data-act="remove" aria-label="Retirer de l'historique">×</button>
  `;
  li.querySelector('img')?.addEventListener('error', (event) => event.target.remove());
  return li;
}

/** Montre ou cache l'historique (il s'efface devant des résultats de recherche). */
export function setListHistoryVisible(visible) {
  if (visible) renderListHistory();
  else node.hidden = true;
}

/** `open(ref)` : ouvrir une liste de l'historique. */
export function listenForListHistory(open) {
  openList = open;
  chips.addEventListener('click', (event) => {
    const button = event.target.closest('[data-hero]');
    if (!button) return;
    heroFilter = button.dataset.hero || null;
    renderListHistory();
  });
  groups.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    const li = event.target.closest('[data-ref]');
    if (!button || !li) return;
    if (button.dataset.act === 'remove') removeListVisit(li.dataset.ref);
    else openList(li.dataset.ref);
  });
}
