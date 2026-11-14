import type { VitalSigns } from '@infirmier/domain';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../testing/test-app';

/** Journée Bino rejouée jusqu'au bout : 11 comptes rendus « À relire », horloge à 17h45. */
async function bootedBino() {
  const app = createTestApp({ scenarioId: 'chir-bino' });
  await app.client.loadScenario({ body: { scenarioId: 'chir-bino', until: 'end' } });
  return app;
}

// M. Dupond se dégrade (exemple du prototype) : NEWS2 7.
const DEGRADED: VitalSigns = {
  respiratoryRate: 24,
  spo2: 94,
  onOxygen: false,
  systolic: 98,
  diastolic: 62,
  heartRate: 108,
  temperature: 38.2,
  consciousness: 'A',
};

describe('POST /session/login — connexion de démo', () => {
  it('matricule + mot de passe partagé → soignant et service', async () => {
    const { client } = createTestApp({ scenarioId: 'chir-bino' });
    const r = await client.login({ body: { matricule: '10482', password: 'bino' } });
    expect(r.nurse).toMatchObject({ id: 'martine', firstName: 'Martine', lastName: 'Dubois' });
    expect(r.unit.id).toBe('chir');
  });

  it('mot de passe insensible à la casse et aux espaces autour', async () => {
    const { client } = createTestApp({ scenarioId: 'chir-bino' });
    const r = await client.login({ body: { matricule: ' 10401 ', password: '  BiNo ' } });
    expect(r.nurse.id).toBe('sophie');
  });

  it('mauvais mot de passe ou matricule inconnu → 401, même message', async () => {
    const { client } = createTestApp({ scenarioId: 'chir-bino' });
    const wrong = { status: 401, code: 'invalid-credentials' };
    await expect(
      client.login({ body: { matricule: '10482', password: 'binoo' } }),
    ).rejects.toMatchObject(wrong);
    await expect(
      client.login({ body: { matricule: '99999', password: 'bino' } }),
    ).rejects.toMatchObject({ ...wrong, message: 'Matricule ou mot de passe incorrect.' });
  });

  it('seuls les soignants du scénario chargé se connectent', async () => {
    const { client } = createTestApp({ scenarioId: 'rea-box12' });
    await expect(
      client.login({ body: { matricule: '10482', password: 'bino' } }),
    ).rejects.toMatchObject({ status: 401 });
    const r = await client.login({ body: { matricule: '20482', password: 'bino' } });
    expect(r).toMatchObject({ nurse: { id: 'martine', lastName: 'Roux' }, unit: { id: 'rea' } });
  });
});

describe('PUT /patients/:id/vitals — constantes et NEWS2', () => {
  it('dossier : NEWS2 des constantes, dispositifs avec leur jour', async () => {
    const { client } = createTestApp({ scenarioId: 'chir-bino' });
    const d = await client.patientDetail({ params: { patientId: 'chir-12' } });
    expect(d.news2).toMatchObject({
      total: 7,
      level: 'rouge',
      reason: 'NEWS2 7 · FR 24, TA 98/62',
    });
    expect(d.devices.map((x) => `${x.label} ${x.day}`)).toEqual([
      'Drain abdominal J2',
      'Voie veineuse périphérique J2',
    ]);
    expect(d.summary.dayOfStay).toBe('J2');
  });

  it('saisie : horodatée, sourcée par le soignant, plancher NEWS2 visible partout', async () => {
    const { client } = createTestApp({ scenarioId: 'chir-bino' });
    const before = await client.unitBoard({ params: { unitId: 'chir' } });
    expect(before.rows.find((r) => r.patient.id === 'chir-10')?.priority.level).toBe('jaune');

    const d = await client.updateVitals({
      params: { patientId: 'chir-10' },
      body: { nurseId: 'martine', vitals: DEGRADED },
    });
    const at = '2026-11-14T16:35:00+01:00';
    expect(d.patient.vitals).toEqual({
      ...DEGRADED,
      measuredAt: at,
      source: { kind: 'nurse', nurseId: 'martine', at },
    });
    expect(d.news2?.total).toBe(7);
    expect(d.priority).toMatchObject({ level: 'rouge', origin: 'suggeree' });
    expect(d.priority.suggestion.reasons[0]).toEqual({
      label: 'NEWS2 7 · FR 24, TA 98/62',
      weight: 35,
      sources: [{ kind: 'nurse', nurseId: 'martine', at }],
    });

    const board = await client.unitBoard({ params: { unitId: 'chir' } });
    expect(board.rows.find((r) => r.patient.id === 'chir-10')?.priority.level).toBe('rouge');
    const summaries = await client.unitSummaries({ params: { unitId: 'chir' } });
    const row = summaries.rows.find((r) => r.patient.id === 'chir-10');
    expect(row).toMatchObject({ priority: { level: 'rouge' }, news2: { total: 7 } });
    const sheet = await client.patientHandover({ params: { patientId: 'chir-10' } });
    expect(sheet.priority.level).toBe('rouge');
    const recap = await client.unitRecap({ params: { unitId: 'chir' } });
    expect(recap.find((r) => r.patientId === 'chir-10')?.text).toMatch(
      /^Chambre 10 Mme Berger · ROUGE/,
    );
  });

  it('le choix manuel prime sur le NEWS2', async () => {
    const { client } = createTestApp({ scenarioId: 'chir-bino' });
    await client.updatePriority({
      params: { patientId: 'chir-12' },
      body: { nurseId: 'karim', manualLevel: 'vert' },
    });
    const summaries = await client.unitSummaries({ params: { unitId: 'chir' } });
    const row = summaries.rows.find((r) => r.patient.id === 'chir-12');
    expect(row?.priority).toMatchObject({ level: 'vert', origin: 'manuelle' });
    expect(row?.priority.suggestion.level).toBe('rouge');
    // Trié avec les patients en vert (après tous les autres), plus en tête de liste.
    const levels = summaries.rows.map((r) => r.priority.level);
    const index = summaries.rows.findIndex((r) => r.patient.id === 'chir-12');
    expect(levels.slice(index).every((l) => l === 'vert')).toBe(true);
    expect(levels.slice(0, index).includes('vert')).toBe(false);
  });

  it('constantes invalides → 400 ; soignant inconnu → 404', async () => {
    const { client } = createTestApp({ scenarioId: 'chir-bino' });
    await expect(
      client.updateVitals({
        params: { patientId: 'chir-12' },
        body: { nurseId: 'martine', vitals: { ...DEGRADED, spo2: -1 } },
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      client.updateVitals({
        params: { patientId: 'chir-12' },
        body: { nurseId: 'personne', vitals: DEGRADED },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('GET /nurses/:id/reports — « Mes CR »', () => {
  it('seulement les comptes rendus du soignant, du plus récent au plus ancien', async () => {
    const { client } = await bootedBino();
    const mine = await client.nurseReports({ params: { nurseId: 'martine' } });
    expect(mine.map((r) => `${r.time} ${r.patient?.displayName}`)).toEqual([
      '15h30 Mme Perrin',
      '13h15 M. Garnier',
      '10h20 M. Moreau',
    ]);
    expect(mine[0]?.transcript).toMatch(/^Chambre 21, Mme Perrin\. Sonde nasogastrique/);
    expect(mine.every((r) => r.status === 'draft')).toBe(true);
    const karim = await client.nurseReports({ params: { nurseId: 'karim' } });
    expect(karim.map((r) => r.time)).toEqual(['16h00', '14h40', '14h05', '12h30']);
    await expect(client.nurseReports({ params: { nurseId: 'personne' } })).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('GET /units/:id/summaries — onglet « Tous »', () => {
  it('une carte par patient, puces sourcées de toute l’équipe, la plus récente d’abord', async () => {
    const { client } = await bootedBino();
    const s = await client.unitSummaries({ params: { unitId: 'chir' } });
    expect(s.rows).toHaveLength(11);
    expect(s.now).toBe('2026-11-14T17:45:00+01:00');

    const dupond = s.rows[0];
    expect(dupond?.patient.id).toBe('chir-12');
    expect(dupond?.priority.level).toBe('rouge');
    expect(dupond?.reportCount).toBe(2);
    const douleur = dupond?.bullets[0];
    expect(douleur?.theme).toBe('Douleur');
    expect(douleur?.text).toMatch(/^Douleur abdominale à 4 sur 10 au réveil\./);
    expect(douleur?.text).toMatch(/Douleur réévaluée à 2 sur 10 à 9h après le paracétamol\.$/);
    expect(douleur?.contributors.map((c) => `${c.firstName} ${c.time}`)).toEqual([
      'Karim 14h05',
      'Sophie 8h10',
    ]);
    // Pas de question à l'IDE dans le résumé (décision P16).
    expect(douleur).not.toHaveProperty('question');

    for (const row of s.rows) {
      const times = row.bullets.map((b) => Date.parse(b.lastAt));
      expect([...times].sort((a, b) => b - a)).toEqual(times);
      for (const b of row.bullets) {
        expect(b.items.length).toBeGreaterThan(0);
        for (const i of b.items) expect(i.sources.length).toBeGreaterThan(0);
      }
    }
    const berger = s.rows.find((r) => r.patient.id === 'chir-10');
    expect(berger).toMatchObject({ reportCount: 0, bullets: [] });
  });

  it('un R manquant reste une question sur la transmission, jamais sous la puce ; la réponse de l’IDE s’ajoute à la puce', async () => {
    const { client } = await bootedBino();
    const garnier = (await client.unitSummaries({ params: { unitId: 'chir' } })).rows.find(
      (r) => r.patient.id === 'chir-14',
    );
    const bullet = garnier?.bullets.find((b) => b.theme === 'Confusion');
    expect(bullet).toBeDefined();
    for (const b of garnier?.bullets ?? []) expect(b).not.toHaveProperty('question');

    const g = (await client.patientDetail({ params: { patientId: 'chir-14' } })).transmissions[0];
    const flag = g?.flags.find((f) => f.kind === 'missing-result');
    expect(flag?.status).toBe('open');
    expect(flag?.question).toMatch(/^Résultat non renseigné pour « Confusion »/);
    await client.answerFlag({
      params: { transmissionId: g?.id ?? '', flagId: flag?.id ?? '' },
      body: { nurseId: 'sophie', answer: 'Calme et orienté à 17h' },
    });
    const after = (await client.unitSummaries({ params: { unitId: 'chir' } })).rows.find(
      (r) => r.patient.id === 'chir-14',
    );
    const confusion = after?.bullets.find((b) => b.theme === bullet?.theme);
    expect(confusion?.text).toMatch(/Calme et orienté à 17h\.$/);
    expect(confusion?.contributors.map((c) => `${c.firstName} ${c.time}`)).toEqual([
      'Sophie 17h45',
      'Martine 13h15',
    ]);
  });

  it('les comptes rendus restent « À relire » et ne montent pas la priorité', async () => {
    const { client } = await bootedBino();
    const board = await client.unitBoard({ params: { unitId: 'chir' } });
    expect(board.totals).toMatchObject({ total: 11, draft: 11, validated: 0 });
    for (const row of board.rows) {
      expect(row.priority.suggestion.reasons.some((r) => r.label.includes('non relue'))).toBe(
        false,
      );
    }
  });
});
