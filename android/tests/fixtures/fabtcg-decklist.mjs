// Page de decklist fabtcg.com reduite a sa structure reelle (octobre 2026) :
// champs du joueur (intitule <h3> puis valeur <p>), sections de la liste en
// <li class="card-item"> (« <span>3x</span> Nom (red) » + image officielle),
// et la meme liste affichee une seconde fois plus bas.
const IMG = 'https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/normal';
const item = (qty, label, code) => `
  <li class="card-item group">
    <div class="card-name"><span>${qty}x</span> ${label}</div>
    <div class="card-image"><img src="${IMG}/${code}.webp" alt="${label}"></div>
  </li>`;
const list = (count) => `
  <section class="hero-section"><div class="list-view-container">
    <h3>Hero / Weapon / Equipment${count ? ' (4)' : ''}</h3>
    <ul class="cards-container">
      ${item(1, 'Fang, Dracai of Blades', 'HNT098')}${item(2, 'Obsidian Fire Vein', 'HNT100')}${item(1, 'Mystery Helm', 'XXX001')}
    </ul></div></section>
  <section class="pitch-section">
    <div class="list-view-container"><h3 class="bg-[darkred] text-gold">Pitch 1</h3><ul class="cards-container">
      ${item(3, 'Buckwild (red)', 'WTR001')}${item(3, "Hunt&#8217;s End (red)", 'HNT103')}
    </ul></div>
    <div class="list-view-container"><h3>Pitch 2</h3><ul class="cards-container">${item(2, 'Blunten (yel)', 'PEN049')}</ul></div>
    <div class="list-view-container"><h3>Pitch 3</h3><ul class="cards-container">${item(2, 'Buckwild (blu)', 'WTR003')}</ul></div>
  </section>`;

export const FABTCG_PATH = '/decklists/michel-verissimo-da-silva-luiz-fang-dracai-of-blades-100th-calling-atlanta/';
export const FABTCG_URL = `https://fabtcg.com${FABTCG_PATH}`;
export const FABTCG_PAGE = `<!DOCTYPE html><html><head>
<title>Michel Verissimo da Silva Luiz - Fang, Dracai of Blades - 100th Calling Atlanta - Flesh and Blood TCG</title>
<script>var decks = {"hero":[{"display_string":"1 x Fang, Dracai of Blades"}]};</script></head><body>
<a href="#main">Skip to content</a>
<h1>Michel Verissimo da Silva Luiz - Fang, Dracai of Blades - 100th Calling Atlanta</h1>
<div class="player-grid">
  <div><h3>Rank</h3><p class="rank">13th</p></div>
  <div><h3>Country/Region</h3><p><i class="br flag"></i> Brazil</p></div>
  <div><h3>Date</h3><p>October 3, 2026</p></div>
  <div><h3>Player</h3><p>Michel Verissimo da Silva Luiz (29114217)</p></div>
  <div><h3>Event</h3><p>100th Calling Atlanta</p></div>
  <div><h3>Format</h3><p>Classic Constructed</p></div>
  <div><h3>Hero</h3><p>Fang, Dracai of Blades</p></div>
</div>
${list(false)}
<div class="grid-view">${list(true)}</div>
</body></html>`;

/** Fiches FaBrary des cartes de la page (Mystery Helm : inconnue de FaBrary). */
export const FABRARY_CARDS = {
  'fang-dracai-of-blades': { name: 'Fang, Dracai of Blades', types: ['Hero'], classes: ['Warrior'], talents: ['Draconic'], defaultImage: 'HNT098', life: 20, intellect: 4 },
  'obsidian-fire-vein': { name: 'Obsidian Fire Vein', types: ['Weapon'], subtypes: ['Dagger'], classes: ['Warrior'], defaultImage: 'HNT100' },
  'buckwild-red': { name: 'Buckwild', pitch: 1, types: ['Action'], subtypes: ['Attack'], classes: ['Brute'], defaultImage: 'WTR001' },
  'buckwild-blue': { name: 'Buckwild', pitch: 3, types: ['Action'], subtypes: ['Attack'], classes: ['Brute'], defaultImage: 'WTR003' },
  'hunts-end-red': { name: "Hunt's End", pitch: 1, types: ['Attack Reaction'], classes: ['Warrior'], defaultImage: 'HNT103' },
  'blunten-yellow': { name: 'Blunten', pitch: 2, types: ['Block'], classes: ['Warrior'], defaultImage: 'PEN049' },
};
