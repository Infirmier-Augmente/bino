import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEED_CR } from '../js/data.js';
import { groundSources, localSynth, normalizeSynth, remapIds } from '../js/synthesis.js';

const crs12 = SEED_CR.filter((c) => c.pid === 'p12');

test('une source introuvable dans le compte rendu est écartée', () => {
  const src = groundSources(
    [
      { cr: 'seed-12a', q: 'Pansement du drain sec.' },
      { cr: 'seed-12a', q: 'Pansement du drain souillé.' },
      { cr: 'inconnu', q: 'Nuit calme' },
    ],
    crs12,
  );
  assert.deepEqual(src, [{ cr: 'seed-12a', q: 'Pansement du drain sec.' }]);
});

test("une cible de l'IA sans source vérifiable disparaît, un R inventé redevient une question", () => {
  const s = normalizeSynth(
    {
      cibles: [
        { c: 'Inventée', D: { t: 'Chute à 15h', src: [{ cr: 'seed-12b', q: 'elle est tombée' }] } },
        {
          c: 'Douleur',
          D: {
            t: 'Douleur à 4/10.',
            src: [{ cr: 'seed-12a', q: 'Douleur abdominale à 4 sur 10' }],
          },
          R: { t: 'Douleur à 0/10.', src: [{ cr: 'seed-12b', q: 'douleur à 0 sur 10' }] },
        },
      ],
    },
    crs12,
  );
  assert.equal(s.cibles.length, 1);
  assert.equal(s.cibles[0].c, 'Douleur');
  assert.equal(s.cibles[0].R, null);
});

test('remapIds traduit cr1, cr2 vers les identifiants réels', () => {
  const r = remapIds({ cibles: [{ c: 'X', D: { t: 'x', src: [{ cr: 'cr2', q: 'q' }] } }] }, crs12);
  assert.equal(r.cibles[0].D.src[0].cr, 'seed-12b');
});

test('règles locales : la réévaluation écrite par un autre soignant complète la cible', () => {
  const s = localSynth(crs12);
  const douleur = s.cibles.find((c) => c.c === 'Douleur');
  assert.ok(douleur, 'cible Douleur présente');
  assert.match(douleur.R.t, /2 sur 10/);
  assert.deepEqual([...new Set([...douleur.D.src, ...douleur.R.src].map((x) => x.cr))].sort(), [
    'seed-12a',
    'seed-12b',
  ]);
  assert.ok(s.soins.some((x) => /drain/.test(x.t)));
});

test('règles locales : chaque élément garde au moins une source vérifiable', () => {
  for (const pid of ['p12', 'p15', 'p3', 'p19']) {
    const crs = SEED_CR.filter((c) => c.pid === pid);
    const s = localSynth(crs);
    const fields = [...s.cibles.flatMap((c) => [c.D, c.A, c.R]), ...s.todo, ...s.soins].filter(
      Boolean,
    );
    for (const f of fields) assert.ok(groundSources(f.src, crs).length > 0, `${pid} : ${f.t}`);
  }
});

test("« M. Petit » n'est pas coupé en deux, la sortie va dans les tâches", () => {
  const s = localSynth(SEED_CR.filter((c) => c.pid === 'p19'));
  assert.ok(!s.cibles.some((c) => c.D.t === 'Petit.'));
  assert.ok(s.todo.some((t) => /Sortie prévue demain/.test(t.t)));
});
