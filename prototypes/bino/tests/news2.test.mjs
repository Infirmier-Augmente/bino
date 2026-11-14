import assert from 'node:assert/strict';
import { test } from 'node:test';
import { news2 } from '../js/news2.js';

const base = { fr: 16, spo2: 97, o2: false, pas: 120, pad: 70, fc: 75, temp: 37, cons: 'A' };

test('patient normal : score 0, faible', () => {
  const n = news2(base);
  assert.equal(n.total, 0);
  assert.equal(n.level, 'faible');
});

test('Mme D. (chambre 12) : NEWS2 7, critique', () => {
  const n = news2({
    fr: 24,
    spo2: 94,
    o2: false,
    pas: 98,
    pad: 62,
    fc: 108,
    temp: 38.2,
    cons: 'A',
  });
  assert.deepEqual(n.p, { fr: 2, spo2: 1, o2: 0, pas: 2, fc: 1, temp: 1, cons: 0 });
  assert.equal(n.total, 7);
  assert.equal(n.level, 'critique');
});

test('Mme L. (chambre 15) : NEWS2 5, élevé', () => {
  const n = news2({
    fr: 22,
    spo2: 95,
    o2: false,
    pas: 132,
    pad: 78,
    fc: 102,
    temp: 38.4,
    cons: 'A',
  });
  assert.equal(n.total, 5);
  assert.equal(n.level, 'eleve');
});

test('un seul paramètre à 3 suffit pour « moyen »', () => {
  const n = news2({ ...base, cons: 'C' });
  assert.equal(n.total, 3);
  assert.equal(n.level, 'moyen');
});

test('bornes des seuils', () => {
  assert.equal(news2({ ...base, fr: 8 }).p.fr, 3);
  assert.equal(news2({ ...base, fr: 9 }).p.fr, 1);
  assert.equal(news2({ ...base, fr: 20 }).p.fr, 0);
  assert.equal(news2({ ...base, fr: 25 }).p.fr, 3);
  assert.equal(news2({ ...base, spo2: 91 }).p.spo2, 3);
  assert.equal(news2({ ...base, pas: 90 }).p.pas, 3);
  assert.equal(news2({ ...base, pas: 220 }).p.pas, 3);
  assert.equal(news2({ ...base, fc: 131 }).p.fc, 3);
  assert.equal(news2({ ...base, temp: 39.1 }).p.temp, 2);
  assert.equal(news2({ ...base, temp: 35 }).p.temp, 3);
  assert.equal(news2({ ...base, o2: true }).p.o2, 2);
});
