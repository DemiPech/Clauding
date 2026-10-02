// Reglages du jeu : c'est ici que l'on commence a modifier.

/** Resolution virtuelle (portrait). Pour du paysage, inverser et changer le manifeste. */
export const WIDTH = 360;
export const HEIGHT = 640;

/** Prefixe des cles de sauvegarde en localStorage. */
export const SAVE_PREFIX = 'game.';

export const COLORS = {
  bg: '#0e1320',
  bgTop: '#16213a',
  text: '#f2f5fa',
  dim: '#8a96ad',
  accent: '#3a7bd5',
  star: '#ffd447',
  bomb: '#ff5a5f',
  player: '#5ad1a4',
};

/** Regles de la demo "Attrape-etoiles". */
export const RULES = {
  lives: 3,
  playerY: 580,
  playerW: 70,
  playerH: 14,
  playerSpeed: 900, // unites / s, au clavier ou en suivant le doigt
  spawnEvery: 0.8, // s entre deux objets au depart
  spawnMin: 0.3, // ... et au plus vite
  fallSpeed: 160, // unites / s au depart
  speedPerPoint: 4, // acceleration par etoile attrapee
  bombChance: 0.3,
  radius: 12,
};
