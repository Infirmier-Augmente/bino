import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { seed } from '../js/data.js';
import { bundleToVitals, fetchVitals, isMock, vitalsUrl } from '../js/services/fhir.js';

const dir = new URL('../mock-fhir/Observation/', import.meta.url);
const load = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));

test('chaque patient de la démo a un dossier dans le DPI simulé', () => {
  const files = readdirSync(dir);
  for (const p of seed().patients) assert.ok(files.includes(`vitals-${p.fhirId}.json`), p.fhirId);
});

test('garde la valeur la plus récente de chaque constante', () => {
  const r = bundleToVitals(load('vitals-bino-p12.json'));
  assert.deepEqual(r.v, {
    fr: 24,
    spo2: 95,
    o2: true,
    pas: 100,
    pad: 60,
    fc: 110,
    temp: 38.3,
    cons: 'A',
  });
  assert.ok(r.atIso.includes('T18:05'));
});

test('ACVPU : une confusion devient « C »', () => {
  assert.equal(bundleToVitals(load('vitals-bino-p3.json')).v.cons, 'C');
});

test('ignore les observations annulées ou en erreur', () => {
  const b = {
    entry: [
      {
        resource: {
          resourceType: 'Observation',
          status: 'entered-in-error',
          code: { coding: [{ code: '8867-4' }] },
          valueQuantity: { value: 200 },
          effectiveDateTime: '2026-11-14T19:00:00+01:00',
        },
      },
    ],
  };
  assert.deepEqual(bundleToVitals(b).v, {});
});

test('URL : DPI simulé ou vrai serveur FHIR', () => {
  assert.equal(isMock('./mock-fhir'), true);
  assert.equal(
    vitalsUrl('./mock-fhir', 'bino-p12'),
    './mock-fhir/Observation/vitals-bino-p12.json',
  );
  assert.equal(isMock('https://hapi.example/fhir'), false);
  assert.equal(
    vitalsUrl('https://hapi.example/fhir/', 'abc'),
    'https://hapi.example/fhir/Observation?patient=abc&category=vital-signs&_sort=-date&_count=50',
  );
});

test('fetchVitals signale un DPI injoignable', async () => {
  const fake = async () => ({ ok: false, status: 503 });
  await assert.rejects(fetchVitals({ fhirId: 'x' }, './mock-fhir', fake), /HTTP 503/);
});
