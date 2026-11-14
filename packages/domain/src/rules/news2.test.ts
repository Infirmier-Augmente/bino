import { describe, expect, it } from 'vitest';
import type { VitalSigns } from '../schemas/hospital';
import { news2, patientNews2 } from './news2';

// Cas repris des tests du prototype Bino (`tests/news2.test.mjs`, branche demo).
// Correspondance des niveaux : critique → rouge, eleve → orange, moyen → jaune, faible → vert.

const base: VitalSigns = {
  respiratoryRate: 16,
  spo2: 97,
  onOxygen: false,
  systolic: 120,
  diastolic: 70,
  heartRate: 75,
  temperature: 37,
  consciousness: 'A',
};

describe('news2 (échelle SpO2 n° 1)', () => {
  it('patient normal : score 0, vert', () => {
    const n = news2(base);
    expect(n.total).toBe(0);
    expect(n.level).toBe('vert');
    expect(n.reason).toBe('NEWS2 0');
  });

  it('M. Dupond (chambre 12) : NEWS2 7, rouge', () => {
    const n = news2({
      respiratoryRate: 24,
      spo2: 94,
      onOxygen: false,
      systolic: 98,
      diastolic: 62,
      heartRate: 108,
      temperature: 38.2,
      consciousness: 'A',
    });
    expect(n.points).toEqual({
      respiratoryRate: 2,
      spo2: 1,
      oxygen: 0,
      systolic: 2,
      heartRate: 1,
      temperature: 1,
      consciousness: 0,
    });
    expect(n.total).toBe(7);
    expect(n.level).toBe('rouge');
    expect(n.reason).toBe('NEWS2 7 · FR 24, TA 98/62');
  });

  it('Mme Laurent (chambre 15) : NEWS2 5, orange', () => {
    const n = news2({
      respiratoryRate: 22,
      spo2: 95,
      onOxygen: false,
      systolic: 132,
      diastolic: 78,
      heartRate: 102,
      temperature: 38.4,
      consciousness: 'A',
    });
    expect(n.total).toBe(5);
    expect(n.level).toBe('orange');
    expect(n.reason).toBe('NEWS2 5 · FR 22');
  });

  it('M. Moreau (chambre 7) sous O2 : NEWS2 6, orange', () => {
    const n = news2({
      respiratoryRate: 22,
      spo2: 94,
      onOxygen: true,
      systolic: 118,
      diastolic: 70,
      heartRate: 96,
      temperature: 37.6,
      consciousness: 'A',
    });
    expect(n.total).toBe(6);
    expect(n.level).toBe('orange');
    expect(n.reason).toBe('NEWS2 6 · FR 22, sous O2');
  });

  it('un seul paramètre à 3 suffit pour jaune', () => {
    const n = news2({ ...base, consciousness: 'C' });
    expect(n.total).toBe(3);
    expect(n.level).toBe('jaune');
    expect(n.reason).toBe('NEWS2 3 · conscience altérée');
  });

  it('bornes des seuils', () => {
    expect(news2({ ...base, respiratoryRate: 8 }).points.respiratoryRate).toBe(3);
    expect(news2({ ...base, respiratoryRate: 9 }).points.respiratoryRate).toBe(1);
    expect(news2({ ...base, respiratoryRate: 20 }).points.respiratoryRate).toBe(0);
    expect(news2({ ...base, respiratoryRate: 25 }).points.respiratoryRate).toBe(3);
    expect(news2({ ...base, spo2: 91 }).points.spo2).toBe(3);
    expect(news2({ ...base, systolic: 90 }).points.systolic).toBe(3);
    expect(news2({ ...base, systolic: 220 }).points.systolic).toBe(3);
    expect(news2({ ...base, heartRate: 131 }).points.heartRate).toBe(3);
    expect(news2({ ...base, temperature: 39.1 }).points.temperature).toBe(2);
    expect(news2({ ...base, temperature: 35 }).points.temperature).toBe(3);
    expect(news2({ ...base, onOxygen: true }).points.oxygen).toBe(2);
  });

  it('la diastolique ne compte pas, la raison garde au plus 3 paramètres lourds', () => {
    expect(news2({ ...base, diastolic: 30 }).total).toBe(0);
    const n = news2({
      ...base,
      respiratoryRate: 26,
      spo2: 90,
      systolic: 85,
      heartRate: 135,
      temperature: 34.5,
    });
    expect(n.reason).toBe('NEWS2 15 · FR 26, SpO2 90 %, TA 85/70');
  });

  it('pas de relevé : pas de NEWS2', () => {
    expect(patientNews2({ vitals: null })).toBeNull();
    const measured = {
      ...base,
      measuredAt: '2026-11-14T16:00:00+01:00',
      source: { kind: 'record' as const, field: 'vitals', label: 'Dossier' },
    };
    expect(patientNews2({ vitals: measured })?.total).toBe(0);
  });
});
