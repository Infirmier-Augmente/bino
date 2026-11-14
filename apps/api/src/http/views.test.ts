import { describe, expect, it } from 'vitest';
import { createTestApp, EXAMPLE_A } from '../testing/test-app';

describe('lecture : session, vue service, fiche, recherche', () => {
  it('session et configuration IA', async () => {
    const { client } = createTestApp();
    expect(await client.health()).toEqual({ ok: true });
    const session = await client.session();
    expect(session.units.map((u) => u.id)).toEqual(['rea']);
    expect(session.nurses.length).toBeGreaterThan(0);
    const config = await client.config();
    expect(config.llm.provider).toBe('heuristic');
    expect(config.stt.ready).toBe(false);
  });

  it('vue service triée : ★ puis Rouge → Vert, et priorité manuelle', async () => {
    const { client } = createTestApp();
    await client.createTransmission({
      body: {
        unitId: 'rea',
        nurseId: 'martine',
        mode: 'transmission',
        inputMethod: 'keyboard',
        transcript: EXAMPLE_A,
      },
    });
    let board = await client.unitBoard({ params: { unitId: 'rea' } });
    expect(board.rows[0]?.patient.id).toBe('rea-12');
    expect(board.rows[0]?.priority.level).toBe('orange');

    const starred = await client.updatePriority({
      params: { patientId: 'rea-11' },
      body: { nurseId: 'martine', starred: true },
    });
    expect(starred.priority.starred).toBe(true);
    board = await client.unitBoard({ params: { unitId: 'rea' } });
    expect(board.rows[0]?.patient.id).toBe('rea-11');

    const manual = await client.updatePriority({
      params: { patientId: 'rea-14' },
      body: { nurseId: 'martine', manualLevel: 'rouge' },
    });
    expect(manual.priority).toMatchObject({ level: 'rouge', origin: 'manuelle' });
    const reset = await client.updatePriority({
      params: { patientId: 'rea-14' },
      body: { nurseId: 'martine', manualLevel: null },
    });
    expect(reset.priority.origin).toBe('suggeree');
  });

  it('fiche de relève et récap SMS', async () => {
    const { client } = createTestApp();
    await client.createTransmission({
      body: {
        unitId: 'rea',
        nurseId: 'martine',
        mode: 'transmission',
        inputMethod: 'keyboard',
        transcript: EXAMPLE_A,
      },
    });
    const sheet = await client.patientHandover({ params: { patientId: 'rea-12' } });
    expect(sheet.patient.roomLabel).toBe('Box 12');
    expect(sheet.patient.dayOfStay).toBe('J5');
    expect(sheet.headline.length).toBeGreaterThan(0);
    expect(sheet.sections.find((s) => s.key === 'respiratoire')?.items.length).toBeGreaterThan(0);
    expect(sheet.transverse.find((l) => l.field === 'precautions')?.summary).toBe('Contact (BMR)');
    const recap = await client.unitRecap({ params: { unitId: 'rea' } });
    expect(recap.find((r) => r.patientId === 'rea-12')?.text).toMatch(
      /^Box 12 M\. Durand · ORANGE/,
    );
  });

  it('recherche sourcée dans les dictées', async () => {
    const { client } = createTestApp();
    const t = await client.createTransmission({
      body: {
        unitId: 'rea',
        nurseId: 'martine',
        mode: 'transmission',
        inputMethod: 'keyboard',
        transcript: EXAMPLE_A,
      },
    });
    const hits = await client.unitSearch({ params: { unitId: 'rea' }, query: { q: 'SNG' } });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ transmissionId: t.id, patientLabel: 'Box 12 · M. Durand' });
  });

  it('export FHIR vers le DPI simulé', async () => {
    const { client } = createTestApp();
    await expect(
      client.exportToDpi({ params: { patientId: 'rea-12' }, body: { nurseId: 'martine' } }),
    ).rejects.toMatchObject({ status: 422 });
    await client.createTransmission({
      body: {
        unitId: 'rea',
        nurseId: 'martine',
        mode: 'transmission',
        inputMethod: 'keyboard',
        transcript: EXAMPLE_A,
      },
    });
    const preview = await client.patientFhir({ params: { patientId: 'rea-12' } });
    expect(preview.resourceType).toBe('Bundle');
    const exp = await client.exportToDpi({
      params: { patientId: 'rea-12' },
      body: { nurseId: 'martine' },
    });
    expect(exp.transmissionIds).toHaveLength(1);
    expect((await client.dpiInbox()).map((e) => e.id)).toEqual([exp.id]);
  });

  it('erreurs lisibles : 404 et route inconnue', async () => {
    const { client, app } = createTestApp();
    await expect(client.patientDetail({ params: { patientId: 'nope' } })).rejects.toMatchObject({
      status: 404,
      code: 'not-found',
    });
    const res = await app.request('/nimporte-quoi');
    expect(res.status).toBe(404);
  });

  it('admission d’un nouveau patient puis dictée en mode admission', async () => {
    const { client } = createTestApp();
    const p = await client.admitPatient({
      body: {
        unitId: 'rea',
        room: '16',
        lastName: 'Petit',
        firstName: 'Odette',
        sex: 'F',
        birthDate: '1940-05-05',
        admissionReason: 'Détresse respiratoire',
        assignedNurseId: 'martine',
      },
    });
    await expect(
      client.admitPatient({
        body: {
          unitId: 'rea',
          room: '16',
          lastName: 'X',
          firstName: 'Y',
          sex: 'M',
          birthDate: '1950-01-01',
          admissionReason: '',
        },
      }),
    ).rejects.toMatchObject({ status: 409 });
    const t = await client.createTransmission({
      body: {
        unitId: 'rea',
        nurseId: 'martine',
        mode: 'admission',
        inputMethod: 'keyboard',
        patientId: p.id,
        transcript:
          'Admise pour une détresse respiratoire sur pneumopathie. Antécédents de BPCO. Elle vit seule à domicile. Marche avec une canne.',
      },
    });
    expect(t.content.admission?.motif.length).toBe(1);
    expect(t.flags.some((f) => f.id.endsWith(':admission:allergies'))).toBe(true);
  });
});
