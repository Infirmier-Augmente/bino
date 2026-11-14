import { describe, expect, it } from 'vitest';
import { item, makePatient, makeTransmission, REA } from '../__fixtures__/hospital';
import type { Patient, Vitals } from '../schemas/hospital';
import type { DarTarget } from '../schemas/transmission';
import { buildUnitBoard } from './handover';
import { effectivePriority, PRIORITY_WEIGHTS, suggestPriority } from './priority';
import { deviceDay } from './time';

const NOW = new Date('2026-11-14T17:45:00+01:00');

const VITALS_SOURCE = { kind: 'record', field: 'vitals', label: 'Dossier patient' } as const;

function vitals(overrides: Partial<Vitals> = {}): Vitals {
  return {
    respiratoryRate: 16,
    spo2: 97,
    onOxygen: false,
    systolic: 120,
    diastolic: 70,
    heartRate: 75,
    temperature: 37,
    consciousness: 'A',
    measuredAt: '2026-11-14T16:00:00+01:00',
    source: VITALS_SOURCE,
    ...overrides,
  };
}

/** Patient hospitalisé depuis longtemps, allergies renseignées : rien ne monte la priorité. */
function calmPatient(overrides: Partial<Patient> = {}): Patient {
  const p = makePatient({ admittedAt: '2026-11-01T10:00:00+01:00', ...overrides });
  p.transverse.allergies.status = 'aucune';
  return p;
}

// NEWS2 7 (rouge) : FR 24, SpO2 94, TA 98/62, FC 108, T 38,2 (M. Dupond du prototype).
const DUPOND = vitals({
  respiratoryRate: 24,
  spo2: 94,
  systolic: 98,
  diastolic: 62,
  heartRate: 108,
  temperature: 38.2,
});

const agitation: DarTarget = {
  id: 'c-agit',
  label: 'Agitation',
  appareil: 'neuro',
  data: [item('d1', 'Agitation vers 16h, arrachage de la SNG.')],
  actions: [],
  results: [item('r1', 'Calme après l’appel de l’interne.')],
  severity: { level: 'urgent', confidence: null, engine: 'test' },
};

describe('NEWS2 : plancher de la priorité suggérée', () => {
  it('relève la suggestion au niveau du NEWS2, avec une raison sourcée par les constantes', () => {
    const patient = calmPatient({ vitals: DUPOND });
    const s = suggestPriority({ patient, shiftTransmissions: [], now: NOW });
    expect(s.level).toBe('rouge');
    expect(s.reasons[0]).toEqual({
      label: 'NEWS2 7 · FR 24, TA 98/62',
      weight: 7 * PRIORITY_WEIGHTS.news2Point,
      sources: [VITALS_SOURCE],
    });
    expect(s.score).toBe(7 * PRIORITY_WEIGHTS.news2Point);
  });

  it('ne baisse jamais une suggestion plus haute que le NEWS2', () => {
    const patient = calmPatient({ vitals: vitals() });
    const t = makeTransmission({
      content: { targets: [agitation] },
      review: { status: 'validated', by: 'martine', at: null },
    });
    const s = suggestPriority({ patient, shiftTransmissions: [t], now: NOW });
    expect(s.level).toBe('rouge');
    expect(s.reasons.map((r) => r.label)).toContain('NEWS2 0');
  });

  it('sans relevé, pas de raison NEWS2', () => {
    const s = suggestPriority({ patient: calmPatient(), shiftTransmissions: [], now: NOW });
    expect(s.level).toBe('vert');
    expect(s.reasons.some((r) => r.label.startsWith('NEWS2'))).toBe(false);
  });

  it('le choix manuel prime sur le NEWS2', () => {
    const patient = calmPatient({
      vitals: DUPOND,
      priority: { starred: false, manualLevel: 'vert', updatedAt: null, updatedBy: 'martine' },
    });
    const eff = effectivePriority(
      patient,
      suggestPriority({ patient, shiftTransmissions: [], now: NOW }),
    );
    expect(eff).toMatchObject({ level: 'vert', origin: 'manuelle' });
    expect(eff.suggestion.level).toBe('rouge');
  });

  it('à niveau égal, le NEWS2 le plus haut passe devant dans la vue service', () => {
    const p5 = calmPatient({
      id: 'a',
      room: '1',
      vitals: vitals({ respiratoryRate: 22, spo2: 95, heartRate: 102, temperature: 38.4 }),
    });
    const p6 = calmPatient({
      id: 'b',
      room: '2',
      vitals: vitals({ respiratoryRate: 22, spo2: 94, onOxygen: true, heartRate: 96 }),
    });
    const board = buildUnitBoard({ unit: REA, patients: [p5, p6], transmissions: [], now: NOW });
    expect(board.rows.map((r) => [r.patient.id, r.priority.level])).toEqual([
      ['b', 'orange'],
      ['a', 'orange'],
    ]);
  });
});

describe('transmissions non relues', () => {
  it('un brouillon (« À relire ») ne monte plus la priorité', () => {
    const patient = calmPatient();
    const draft = makeTransmission({ review: { status: 'draft', by: null, at: null } });
    const s = suggestPriority({ patient, shiftTransmissions: [draft], now: NOW });
    expect(s.level).toBe('vert');
    expect(s.reasons).toEqual([]);
  });

  it('une transmission mise de côté (« non relue ») monte au moins au jaune', () => {
    const patient = calmPatient();
    const deferred = makeTransmission({
      review: { status: 'unreviewed', by: 'martine', at: '2026-11-14T16:40:00+01:00' },
    });
    const s = suggestPriority({ patient, shiftTransmissions: [deferred], now: NOW });
    expect(s.level).toBe('jaune');
    expect(s.reasons.map((r) => r.label)).toEqual(['1 transmission non relue']);
  });
});

describe('deviceDay', () => {
  it('J0 le jour de la pose, puis un jour par jour calendaire (heure locale)', () => {
    expect(deviceDay('2026-11-14T08:00:00+01:00', NOW, 'Europe/Paris')).toBe('J0');
    expect(deviceDay('2026-11-12T23:30:00+01:00', NOW, 'Europe/Paris')).toBe('J2');
    expect(deviceDay('2026-11-10T09:00:00+01:00', NOW, 'Europe/Paris')).toBe('J4');
  });
  it('jamais négatif', () => {
    expect(deviceDay('2026-11-15T08:00:00+01:00', NOW, 'Europe/Paris')).toBe('J0');
  });
});
