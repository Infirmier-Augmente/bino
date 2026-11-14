import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seed } from '../js/data.js';
import { localTriage, newsReason, normalizeTriage } from '../js/triage.js';

const items = () => seed().patients.map((p) => ({ p, v: p.v, crs: [] }));

test('sans IA : classement par niveau NEWS2, raison factuelle', () => {
  const t = localTriage(items());
  assert.equal(t.length, 11);
  assert.equal(t[0].id, 'p12');
  assert.equal(t[0].niveau, 'critique');
  assert.match(t[0].raison, /^NEWS2 7 · /);
});

test("l'IA ne peut pas descendre un patient sous son NEWS2", () => {
  const t = normalizeTriage(
    { patients: [{ id: 'p12', niveau: 'faible', raison: 'RAS' }] },
    items(),
  );
  assert.equal(t.find((x) => x.id === 'p12').niveau, 'critique');
});

test("l'IA peut faire monter un patient, avec sa raison", () => {
  const t = normalizeTriage(
    { patients: [{ id: 'p14', niveau: 'eleve', raison: 'Désorienté, a tenté de se lever seul' }] },
    items(),
  );
  const g = t.find((x) => x.id === 'p14');
  assert.equal(g.niveau, 'eleve');
  assert.match(g.raison, /Désorienté/);
});

test('identifiants inconnus ignorés, doublons retirés, oubliés ajoutés', () => {
  const t = normalizeTriage(
    {
      patients: [
        { id: 'p7', niveau: 'eleve', raison: 'x' },
        { id: 'p7', niveau: 'faible', raison: 'y' },
        { id: 'zzz', niveau: 'critique', raison: 'inventé' },
      ],
    },
    items(),
  );
  assert.equal(t.length, 11);
  assert.equal(t[0].id, 'p7');
  assert.ok(!t.some((x) => x.id === 'zzz'));
});

test('niveau invalide : on retombe sur le NEWS2', () => {
  const t = normalizeTriage({ patients: [{ id: 'p19', niveau: 'urgentissime' }] }, items());
  const p = t.find((x) => x.id === 'p19');
  assert.equal(p.niveau, 'faible');
  assert.match(p.raison, /^NEWS2 0/);
});

test('raison NEWS2 : les paramètres qui pèsent le plus', () => {
  assert.equal(
    newsReason({ fr: 24, spo2: 94, o2: false, pas: 98, pad: 62, fc: 108, temp: 38.2, cons: 'A' }),
    'NEWS2 7 · FR 24, TA 98/62',
  );
});
