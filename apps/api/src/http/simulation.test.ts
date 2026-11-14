import { describe, expect, it } from 'vitest';
import { createTestApp } from '../testing/test-app';

describe('simulateur', () => {
  it('liste les scénarios et des dictées d’exemple', async () => {
    const { client } = createTestApp();
    const list = await client.scenarios();
    expect(list.map((s) => s.id)).toContain('rea-box12');
    const samples = await client.samples({ query: { unitId: 'rea' } });
    expect(samples.some((s) => s.label.includes('exemple A'))).toBe(true);
  });

  it('charge, joue pas à pas, rejoue jusqu’au bout', async () => {
    const { client } = createTestApp();
    let st = await client.loadScenario({ body: { scenarioId: 'rea-box12', until: 'start' } });
    expect(st.cursor).toBe(0);
    expect(st.now).toBe('2026-11-14T07:50:00+01:00');
    st = await client.stepScenario({ body: { count: 2 } });
    expect(st.cursor).toBe(2);
    expect(st.log).toHaveLength(2);
    expect(st.now.startsWith('2026-11-14T09:10')).toBe(true);

    st = await client.loadScenario({ body: { scenarioId: 'rea-box12', until: 'end' } });
    expect(st.cursor).toBe(st.total);
    expect(st.nextEvent).toBeNull();
    const board = await client.unitBoard({ params: { unitId: 'rea' } });
    expect(board.rows[0]?.patient.id).toBe('rea-10'); // ★ posée à 14h
    expect(board.totals.total).toBeGreaterThanOrEqual(5);
  });

  it('rejoue jusqu’à une heure donnée (préparer la démo)', async () => {
    const { client } = createTestApp();
    const st = await client.loadScenario({
      body: { scenarioId: 'rea-box12', until: '2026-11-14T16:25:00+01:00' },
    });
    expect(st.now).toBe('2026-11-14T16:25:00+01:00');
    expect(st.nextEvent?.label).toMatch(/exemple A/);
  });

  it('horloge réelle / simulée', async () => {
    const { client } = createTestApp();
    const st = await client.setClock({
      body: { mode: 'simulated', now: '2026-11-14T19:40:00+01:00' },
    });
    expect(st.clockMode).toBe('simulated');
    expect(st.now).toBe('2026-11-14T19:40:00+01:00');
    expect((await client.setClock({ body: { mode: 'real' } })).clockMode).toBe('real');
  });

  it('chaque scénario se rejoue sans erreur avec le moteur local', async () => {
    const { client } = createTestApp();
    for (const s of await client.scenarios()) {
      const st = await client.loadScenario({ body: { scenarioId: s.id, until: 'end' } });
      expect(st.cursor).toBe(s.eventCount);
    }
  });
});
