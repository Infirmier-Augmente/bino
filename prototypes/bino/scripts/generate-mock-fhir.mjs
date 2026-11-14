// Génère le DPI simulé : un Bundle FHIR R4 de constantes par patient (données fictives).
// Usage : node scripts/generate-mock-fhir.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const DAY = '2026-11-14';
const TZ = '+01:00';

// Pour chaque patient fictif de js/data.js : la série de 8h, puis une série plus récente
// (valeurs de l'app ajustées ci-dessous), pour que l'import DPI montre des changements.
import { seed } from '../js/data.js';

const LATER = {
  p12: { at: '18:05', fr: 24, spo2: 95, o2: 2, pas: 100, pad: 60, fc: 110, temp: 38.3 },
  p15: { at: '18:00', fr: 20, spo2: 96, fc: 96, temp: 38.7, pas: 128, pad: 76 },
  p10: { at: '17:50', fr: 16, spo2: 97, pas: 114, pad: 70, fc: 84, temp: 36.9 },
  p3: { at: '17:45', fr: 18, spo2: 96, pas: 124, pad: 70, fc: 82, temp: 38.3, cons: 'C' },
  p19: { at: '17:30', pas: 124, pad: 78, fc: 68, temp: 36.7 },
  p7: { at: '17:55', fr: 20, spo2: 95, o2: 2 },
  p21: { at: '18:10', fc: 104, temp: 38.1 },
  p14: { at: '17:40', cons: 'A' },
  p18: { at: '18:00', fc: 96, temp: 37.9 },
};
const serie = (v, at, patch = {}) => ({
  at,
  fr: v.fr,
  spo2: v.spo2,
  o2: v.o2 ? 2 : 0,
  pas: v.pas,
  pad: v.pad,
  fc: v.fc,
  temp: v.temp,
  cons: v.cons,
  ...patch,
});
const PATIENTS = Object.fromEntries(
  seed().patients.map((p) => [
    p.fhirId,
    [serie(p.prev, '08:00'), serie(p.v, LATER[p.id]?.at || '17:30', { ...LATER[p.id] })],
  ]),
);

const loinc = (code, display) => ({
  coding: [{ system: 'http://loinc.org', code, display }],
  text: display,
});
const category = [
  {
    coding: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'vital-signs',
        display: 'Vital Signs',
      },
    ],
  },
];
const qty = (value, unit, code) => ({ value, unit, system: 'http://unitsofmeasure.org', code });

function observations(pid, s, i) {
  const base = (suffix, code, extra) => ({
    resourceType: 'Observation',
    id: `${pid}-${suffix}-${i}`,
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/vitalsigns'] },
    status: 'final',
    category,
    code,
    subject: { reference: `Patient/${pid}` },
    effectiveDateTime: `${DAY}T${s.at}:00${TZ}`,
    ...extra,
  });
  return [
    base('rr', loinc('9279-1', 'Respiratory rate'), { valueQuantity: qty(s.fr, '/min', '/min') }),
    base('spo2', loinc('59408-5', 'Oxygen saturation in Arterial blood by Pulse oximetry'), {
      valueQuantity: qty(s.spo2, '%', '%'),
    }),
    base('o2', loinc('3151-8', 'Inhaled oxygen flow rate'), {
      valueQuantity: qty(s.o2, 'L/min', 'L/min'),
    }),
    base('bp', loinc('85354-9', 'Blood pressure panel with all children optional'), {
      component: [
        {
          code: loinc('8480-6', 'Systolic blood pressure'),
          valueQuantity: qty(s.pas, 'mmHg', 'mm[Hg]'),
        },
        {
          code: loinc('8462-4', 'Diastolic blood pressure'),
          valueQuantity: qty(s.pad, 'mmHg', 'mm[Hg]'),
        },
      ],
    }),
    base('hr', loinc('8867-4', 'Heart rate'), { valueQuantity: qty(s.fc, '/min', '/min') }),
    base('temp', loinc('8310-5', 'Body temperature'), { valueQuantity: qty(s.temp, 'Cel', 'Cel') }),
    base('acvpu', loinc('67775-7', 'Level of responsiveness'), {
      valueCodeableConcept: {
        coding: [
          {
            system: 'urn:bino:acvpu',
            code: s.cons === 'A' ? 'A' : 'C',
            display: s.cons === 'A' ? 'Alert' : 'New confusion',
          },
        ],
        text: s.cons === 'A' ? 'Alert' : 'Confusion',
      },
    }),
  ];
}

mkdirSync(new URL('../mock-fhir/Observation/', import.meta.url), { recursive: true });
for (const [pid, series] of Object.entries(PATIENTS)) {
  const entries = series
    .flatMap((s, i) => observations(pid, s, i))
    .map((resource) => ({ fullUrl: `urn:bino:Observation/${resource.id}`, resource }));
  const bundle = {
    resourceType: 'Bundle',
    id: `vitals-${pid}`,
    type: 'searchset',
    total: entries.length,
    entry: entries,
  };
  writeFileSync(
    new URL(`../mock-fhir/Observation/vitals-${pid}.json`, import.meta.url),
    `${JSON.stringify(bundle, null, 2)}\n`,
  );
}
writeFileSync(
  new URL('../mock-fhir/metadata.json', import.meta.url),
  `${JSON.stringify(
    {
      resourceType: 'CapabilityStatement',
      status: 'active',
      kind: 'instance',
      fhirVersion: '4.0.1',
      software: { name: 'Bino — DPI simulé (données fictives)' },
      format: ['json'],
    },
    null,
    2,
  )}\n`,
);
console.log('DPI simulé généré pour', Object.keys(PATIENTS).length, 'patients.');
