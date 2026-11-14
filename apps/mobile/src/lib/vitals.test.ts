import { news2, type VitalSigns } from '@infirmier/domain';
import { describe, expect, it } from 'vitest';
import {
  decimalFr,
  formatPoints,
  parsePositive,
  parseVitalsForm,
  pointsTone,
  totalTone,
  vitalsRows,
  vitalsToForm,
} from './vitals';

const dupond: VitalSigns = {
  respiratoryRate: 24,
  spo2: 94,
  onOxygen: false,
  systolic: 98,
  diastolic: 62,
  heartRate: 108,
  temperature: 38.2,
  consciousness: 'A',
};

describe('tableau des constantes', () => {
  it('reprend les libellés, valeurs et points du prototype (M. Dupond, NEWS2 7)', () => {
    const score = news2(dupond);
    expect(score.total).toBe(7);
    expect(vitalsRows(dupond, score.points).map((r) => [r.label, r.value, r.points])).toEqual([
      ['Fréquence respiratoire', '24 /min', 2],
      ['SpO2', '94 %', 1],
      ['Oxygène', 'Air ambiant', 0],
      ['Tension artérielle', '98/62 mmHg', 2],
      ['Fréquence cardiaque', '108 /min', 1],
      ['Température', '38,2 °C', 1],
      ['Conscience', 'Alerte', 0],
    ]);
  });

  it('oxygène et conscience altérée', () => {
    const rows = vitalsRows(
      { ...dupond, onOxygen: true, consciousness: 'C' },
      news2({ ...dupond, onOxygen: true, consciousness: 'C' }).points,
    );
    expect(rows.find((r) => r.key === 'oxygen')?.value).toBe('Oui');
    expect(rows.find((r) => r.key === 'consciousness')?.value).toBe('Altérée');
  });

  it('points « +n » et couleurs (0 gris, 1 jaune, 2 orange, 3 rouge)', () => {
    expect(formatPoints(0)).toBe('0');
    expect(formatPoints(2)).toBe('+2');
    expect([0, 1, 2, 3].map(pointsTone)).toEqual(['none', 'low', 'mid', 'high']);
    expect([0, 1, 4, 5, 6, 7, 12].map(totalTone)).toEqual([
      'none',
      'low',
      'low',
      'mid',
      'mid',
      'high',
      'high',
    ]);
    expect(decimalFr(37)).toBe('37');
    expect(decimalFr(38.2)).toBe('38,2');
  });
});

describe('formulaire « Constantes »', () => {
  it('pré-remplit avec les constantes courantes, ou vide', () => {
    expect(vitalsToForm(dupond)).toMatchObject({ respiratoryRate: '24', temperature: '38.2' });
    expect(vitalsToForm(null)).toMatchObject({
      respiratoryRate: '',
      onOxygen: false,
      consciousness: 'A',
    });
  });

  it('accepte la virgule décimale et recalcule le score', () => {
    const form = { ...vitalsToForm(dupond), temperature: '39,5', respiratoryRate: '12' };
    const parsed = parseVitalsForm(form);
    expect(parsed?.temperature).toBe(39.5);
    expect(parsed ? news2(parsed).total : null).toBe(6);
  });

  it('refuse une valeur vide, nulle, négative ou non numérique', () => {
    expect(parsePositive('')).toBeNull();
    expect(parsePositive('0')).toBeNull();
    expect(parsePositive('-3')).toBeNull();
    expect(parsePositive('abc')).toBeNull();
    expect(parsePositive(' 18 ')).toBe(18);
    expect(parseVitalsForm({ ...vitalsToForm(dupond), heartRate: '' })).toBeNull();
  });
});
