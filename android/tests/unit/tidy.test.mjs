// Plan de rangement des vracs : un nom de carte n'est jamais coupe, et les
// groupes (classe, talent, extension) occupent le moins d'endroits possible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTidy } from '../../app/src/main/assets/www/js/tidy.js';

let id = 0;
const card = (name, cls, exp = 'HNT', talents = []) =>
  ({ slug: name.toLowerCase().replace(/\W+/g, '-'), name, classes: cls ? [cls] : [], talents, expansion: exp });
const L = (c, location, quantity) => ({ inventoryId: `l${(id += 1)}`, location, quantity, card: c });

const ignite = card('Ignite', 'Ninja', 'HNT', ['Draconic']);
const blade = card('Burning Blade Dance', 'Ninja', 'HNT', ['Draconic']);
const enl = card('Enlightened Strike', null, 'WTR');
const sink = card('Sink Below', null, 'WTR');
const snatch = card('Snatch', null, 'WTR');
const crush = card('Crippling Crush', 'Guardian', 'WTR');
const lines = [
  L(ignite, 'Vrac 1', 3), L(ignite, 'Vrac 2', 1), L(ignite, 'Vrac 3', 2),
  L(blade, 'Vrac 2', 4), L(enl, 'Vrac 1', 2), L(enl, 'Vrac 3', 1),
  L(sink, 'Vrac 3', 6), L(snatch, 'Vrac 1', 2), L(crush, 'Vrac 2', 3), L(crush, 'Vrac 1', 1),
];
const places = ['Vrac 1', 'Vrac 2', 'Vrac 3'];

/** Ou chaque nom finit apres application du plan. */
function finalPlaces(plan) {
  const moved = new Map(plan.moves.map((m) => [m.line.inventoryId, m.to]));
  const where = new Map();
  for (const l of lines) {
    const at = moved.get(l.inventoryId) || l.location;
    where.set(l.card.slug, [...(where.get(l.card.slug) || []), at]);
  }
  return where;
}

for (const mode of ['name', 'class', 'talent', 'classTalent', 'expansion']) {
  test(`mode ${mode} : chaque nom finit en un seul endroit`, () => {
    for (const [slug, at] of finalPlaces(planTidy(lines, places, mode))) {
      assert.equal(new Set(at).size, 1, `${slug} reste eparpille : ${at}`);
    }
  });
}

test('par nom : chaque carte rejoint l’endroit qui en a le plus', () => {
  const plan = planTidy(lines, places, 'name');
  assert.equal(plan.stats.splitBefore, 3);
  assert.equal(finalPlaces(plan).get('ignite')[0], 'Vrac 1');
  assert.equal(finalPlaces(plan).get('crippling-crush')[0], 'Vrac 2');
  assert.equal(plan.stats.toMove, 5);
});

test('par classe : une classe par vrac ici', () => {
  const layout = planTidy(lines, places, 'class').layout;
  for (const box of layout) assert.equal(box.groups.length, 1, `${box.place} : ${box.groups.map((g) => g.group)}`);
});

test("un endroit deja range ne bouge pas", () => {
  const tidy = [L(ignite, 'Vrac 1', 3), L(sink, 'Vrac 2', 2)];
  assert.equal(planTidy(tidy, ['Vrac 1', 'Vrac 2'], 'name').moves.length, 0);
});
