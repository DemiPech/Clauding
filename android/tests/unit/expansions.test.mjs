import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expansionGroup, groupExpansions } from '../../app/src/main/assets/www/js/expansions.js';

const exp = (name, cardCount = 20) => ({ id: name, name, cardCount });

test('chaque extension rejoint sa famille, comme sur FaBrary', () => {
  const cases = {
    'Welcome to Rathe': 'core',
    'Welcome to Rathe Unlimited': 'core',
    'Compendium of Rathe': 'core',
    'Armory Deck Legends: Prism': 'armory',
    'Armory Deck: Arakni': 'armory',
    'Mastery Pack: Guardian': 'mastery',
    'History Pack 1': 'history',
    'Viserai Silver Age Deck': 'silverAge',
    '1st Strike: Aurora': 'firstStrike',
    'Arakni, Web of Deceit Blitz Deck': 'blitz',
    'Ira Welcome Deck': 'welcome',
    'Classic Battles: Rhinar vs Dorinthea': 'classicBattles',
    'Round the Table: TCC x LSS': 'roundTable',
    'Promos': 'promo',
    'Bravo Hero Deck': 'heroDeck',
  };
  for (const [name, group] of Object.entries(cases)) assert.equal(expansionGroup(exp(name)), group, name);
  // Une grosse extension inconnue d'ici est une extension principale ; une petite, « Autres ».
  assert.equal(expansionGroup(exp('Une Nouvelle Extension', 220)), 'core');
  assert.equal(expansionGroup(exp('Fabled Collection', 12)), 'other');
});

test('groupes dans l’ordre, noms triés, filtre', () => {
  const list = [
    exp('Arakni Blitz Deck'), exp('Welcome to Rathe'), exp('Armory Deck: Arakni'), exp('Arcane Rising'),
    exp('1st Strike: Terra'), exp('Armory Deck Legends: Prism'), exp('1st Strike: Aurora'),
  ];
  const groups = groupExpansions(list);
  assert.deepEqual(groups.map((g) => g.label), ['Core Set', 'Armory Deck', '1st Strike', 'Blitz Deck']);
  assert.deepEqual(groups[0].expansions.map((e) => e.name), ['Arcane Rising', 'Welcome to Rathe']);
  assert.deepEqual(groups[1].expansions.map((e) => e.name), ['Armory Deck Legends: Prism', 'Armory Deck: Arakni']);
  assert.deepEqual(groupExpansions(list, 'arakni').map((g) => [g.label, g.expansions.length]), [['Armory Deck', 1], ['Blitz Deck', 1]]);
});
