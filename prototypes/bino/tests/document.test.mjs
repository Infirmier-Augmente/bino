import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEED_CR, seed } from '../js/data.js';
import { buildModel, docFile, docText } from '../js/document.js';
import { localSynth } from '../js/synthesis.js';

const authorOf = (c) => c.byName || 'Un soignant';

function model() {
  const ps = seed().patients;
  const items = ps.map((p) => {
    const crs = SEED_CR.filter((c) => c.pid === p.id);
    return { p, v: p.v, crs, syn: crs.length ? localSynth(crs) : null };
  });
  return buildModel(items, {
    date: '14/11/2026',
    time: '19h30',
    author: 'Martine Dubois · IDE',
    service: 'Chirurgie · poste de jour',
    authorOf,
  });
}

test('le document couvre tous les patients et compte les comptes rendus', () => {
  const m = model();
  assert.equal(m.rows.length, 11);
  assert.equal(m.crCount, SEED_CR.length);
  assert.deepEqual(m.nurses.sort(), [
    'Karim Haddad · IDE',
    'Martine Dubois · IDE',
    'Sophie Lemoine · IDE',
  ]);
});

test('les priorités reprennent les NEWS2 critiques et élevés', () => {
  const ids = model().attention.map((r) => r.p.id);
  assert.ok(ids.includes('p12'));
  assert.ok(ids.includes('p7'));
  assert.ok(!ids.includes('p19'));
});

test('le texte copié contient les patients, les sources et rien d’inventé', () => {
  const t = docText(model());
  assert.match(t, /CHAMB 12 · M\. Jean Dupond/);
  assert.match(t, /Aucun compte rendu aujourd'hui\./); // Mme Berger, ch10
  assert.match(t, /Sortie prévue demain/);
});

test('le fichier téléchargé est une page HTML autonome', () => {
  const f = docFile(model());
  assert.ok(f.startsWith('<!DOCTYPE html>'));
  assert.match(f, /<style>/);
  assert.match(f, /Transmission du service/);
});
