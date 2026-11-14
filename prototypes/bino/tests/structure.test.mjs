import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXAMPLES, seed } from '../js/data.js';
import { news2 } from '../js/news2.js';
import { extractVitals, localAnswer, localStructure, normalize } from '../js/structure.js';

test('repère les constantes dans une dictée orale', () => {
  const v = extractVitals(EXAMPLES[0].text);
  assert.deepEqual(v, {
    fr: 24,
    spo2: 94,
    pas: 98,
    pad: 62,
    fc: 108,
    temp: 38.2,
    o2: false,
    cons: 'A',
  });
});

test('repère oxygène et confusion', () => {
  const v = extractVitals(
    'Sous lunettes à 2 litres, sat 93, il est confus ce soir, température 37,9',
  );
  assert.equal(v.o2, true);
  assert.equal(v.spo2, 93);
  assert.equal(v.cons, 'C');
  assert.equal(v.temp, 37.9);
});

test('ignore une température invraisemblable', () => {
  assert.equal(extractVitals('T 12 au réveil').temp, undefined);
});

test('règles locales : cibles, actions et résultats manquants', () => {
  const r = localStructure(
    "Chambre 3. Elle est confuse ce soir, désorientée. J'ai prévenu l'interne. Pansement refait. Douleur à 4 sur 10, j'ai donné le paracétamol.",
  );
  const names = r.cibles.map((c) => c.c);
  assert.ok(names.includes('Agitation / confusion'));
  assert.ok(names.includes('Douleur'));
  assert.ok(
    r.cibles.every((c) => c.R === null),
    'aucun résultat inventé',
  );
  assert.equal(r.diag.length, 1);
});

test('règles locales : un résultat dit est classé en R', () => {
  const r = localStructure(
    'Douleur à 6 sur 10. Morphine donnée. Douleur réévaluée à 2 sur 10 après.',
  );
  const d = r.cibles.find((c) => c.c === 'Douleur');
  assert.ok(d.R && /2 sur 10/.test(d.R));
});

test("normalize nettoie une réponse d'IA incomplète", () => {
  const r = normalize({
    cibles: [{ c: 'X', D: 'd' }, { c: 'vide' }],
    diag: ['a'],
    v: { fr: 20, foo: 1, temp: null },
  });
  assert.equal(r.cibles.length, 1);
  assert.deepEqual(r.diag, [{ t: 'a', s: null }]);
  assert.deepEqual(r.v, { fr: 20 });
});

test('réponse locale : qui voir en premier', () => {
  const ps = seed().patients.sort((a, b) => news2(b.v).total - news2(a.v).total);
  assert.match(localAnswer('Qui voir en premier ?', ps), /chambre 12/);
});
