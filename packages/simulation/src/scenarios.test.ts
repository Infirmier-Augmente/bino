import { HospitalState, ScenarioEvent } from '@infirmier/domain';
import { describe, expect, it } from 'vitest';
import { initialState, SCENARIOS, sampleDictations, scenarioSummary } from './index';

describe.each(SCENARIOS.map((s) => [s.id, s] as const))('scénario %s', (_id, s) => {
  it('produit un état initial valide', () => {
    expect(() => HospitalState.parse(initialState(s))).not.toThrow();
  });

  it('a des événements valides, triés, après le début', () => {
    for (const e of s.events) {
      expect(() => ScenarioEvent.parse(e)).not.toThrow();
      expect(Date.parse(e.at)).toBeGreaterThanOrEqual(Date.parse(s.startsAt));
    }
    const times = s.events.map((e) => Date.parse(e.at));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('ne référence que des soignants et patients existants', () => {
    const nurseIds = new Set(s.nurses.map((n) => n.id));
    const patientIds = new Set(s.patients.map((p) => p.id));
    for (const e of s.events) {
      if (e.type === 'admit') patientIds.add(e.patientId);
      if ('nurseId' in e) expect(nurseIds.has(e.nurseId)).toBe(true);
      if (e.type === 'dictation' && e.expect?.patientId)
        expect(patientIds.has(e.expect.patientId)).toBe(true);
      if (e.type === 'priority') expect(patientIds.has(e.patientId)).toBe(true);
    }
  });

  it('a des identifiants de patients et des chambres uniques par service', () => {
    const ids = s.patients.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rooms = s.patients.map((p) => `${p.unitId}:${p.room}`);
    expect(new Set(rooms).size).toBe(rooms.length);
  });

  it('se résume pour le simulateur', () => {
    expect(scenarioSummary(s).eventCount).toBe(s.events.length);
  });
});

describe('registre', () => {
  it('a des identifiants uniques', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('expose des dictées d’exemple', () => {
    expect(sampleDictations().length).toBeGreaterThan(0);
    expect(sampleDictations('rea').every((d) => d.scenarioId.length > 0)).toBe(true);
  });
});
