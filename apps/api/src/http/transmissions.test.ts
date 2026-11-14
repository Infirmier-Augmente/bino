import { ApiError } from '@infirmier/domain';
import { describe, expect, it } from 'vitest';
import { createTestApp, EXAMPLE_A } from '../testing/test-app';

const base = {
  unitId: 'rea',
  nurseId: 'martine',
  mode: 'transmission',
  inputMethod: 'keyboard',
} as const;

describe('POST /transmissions — de la dictée aux transmissions DAR', () => {
  it('rattache l’exemple A au Box 12 et range en DAR, sourcé, à relire', async () => {
    const { client } = createTestApp();
    const t = await client.createTransmission({ body: { ...base, transcript: EXAMPLE_A } });
    expect(t.patientId).toBe('rea-12');
    expect(t.resolution.status).toBe('resolved');
    expect(t.review.status).toBe('draft');
    expect(t.content.targets.map((x) => x.label)).toEqual(['Sevrage ventilatoire', 'Agitation']);
    expect(t.engine.rejected).toEqual([]);
    for (const target of t.content.targets) {
      for (const item of [...target.data, ...target.actions, ...target.results]) {
        const src = item.sources[0];
        expect(src?.kind).toBe('dictation');
        if (src?.kind === 'dictation') expect(EXAMPLE_A.slice(src.start, src.end)).toBe(src.quote);
      }
    }
    expect(t.flags.some((f) => f.kind === 'missing-result')).toBe(true);
  });

  it('demande le patient quand la dictée ne le précise pas, puis accepte le rattachement', async () => {
    const { client } = createTestApp();
    const t = await client.createTransmission({
      body: { ...base, transcript: 'Il a bien mangé à midi, transit repris.' },
    });
    expect(t.patientId).toBeNull();
    const flag = t.flags.find((f) => f.kind === 'patient-ambiguous');
    expect(flag?.status).toBe('open');
    await expect(
      client.reviewTransmission({
        params: { transmissionId: t.id },
        body: { nurseId: 'martine', decision: 'validate' },
      }),
    ).rejects.toMatchObject({ status: 422, code: 'patient-required' });
    const assigned = await client.assignPatient({
      params: { transmissionId: t.id },
      body: { nurseId: 'martine', patientId: 'rea-14' },
    });
    expect(assigned.patientId).toBe('rea-14');
    expect(assigned.flags.find((f) => f.kind === 'patient-ambiguous')?.status).toBe('answered');
  });

  it('respecte la présélection depuis la fiche patient', async () => {
    const { client } = createTestApp();
    const t = await client.createTransmission({
      body: { ...base, transcript: 'RAS, pansement refait propre.', patientId: 'rea-10' },
    });
    expect(t.patientId).toBe('rea-10');
    expect(t.resolution.method).toBe('preselection');
  });

  it('signale une dictée qui parle de deux patients', async () => {
    const { client } = createTestApp();
    const t = await client.createTransmission({
      body: { ...base, transcript: 'Box 12 RAS. Box 14 a vomi vers 14h.' },
    });
    expect(t.flags.some((f) => f.kind === 'multiple-patients')).toBe(true);
  });

  it('refuse une dictée vide avec un message lisible', async () => {
    const { client } = createTestApp();
    const err = await client
      .createTransmission({ body: { ...base, transcript: ' ' } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).message).toMatch(/dictée est vide/);
  });
});

describe('relecture : corriger, compléter, valider', () => {
  it('compléter le R depuis la question l’ajoute comme résultat sourcé "IDE"', async () => {
    const { client } = createTestApp();
    const t = await client.createTransmission({ body: { ...base, transcript: EXAMPLE_A } });
    const flag = t.flags.find((f) => f.kind === 'missing-result');
    if (!flag) throw new Error('flag attendu');
    const after = await client.answerFlag({
      params: { transmissionId: t.id, flagId: flag.id },
      body: { nurseId: 'martine', answer: 'SpO2 95 % sous 3 L, bien toléré.' },
    });
    const target = after.content.targets.find((x) => x.id === flag.targetId);
    expect(target?.results.at(-1)?.text).toBe('SpO2 95 % sous 3 L, bien toléré.');
    expect(target?.results.at(-1)?.sources[0]?.kind).toBe('nurse');
    expect(after.flags.find((f) => f.id === flag.id)?.status).toBe('answered');
  });

  it('modifier une formulation la marque comme éditée ; supprimer une cible retire sa question', async () => {
    const { client } = createTestApp();
    const t = await client.createTransmission({ body: { ...base, transcript: EXAMPLE_A } });
    const sevrage = t.content.targets[0];
    const item = sevrage?.data[0];
    if (!sevrage || !item) throw new Error('cible attendue');
    const edited = await client.editTransmission({
      params: { transmissionId: t.id },
      body: {
        nurseId: 'martine',
        edits: [{ itemId: item.id, text: 'Extubé à 10h.' }],
        removals: [],
      },
    });
    const e = edited.content.targets[0]?.data[0];
    expect(e?.text).toBe('Extubé à 10h.');
    expect(e?.edited).toBe(true);
    expect(e?.sources.map((s) => s.kind)).toEqual(['dictation', 'nurse']);

    const removed = await client.editTransmission({
      params: { transmissionId: t.id },
      body: { nurseId: 'martine', edits: [], removals: [sevrage.id] },
    });
    expect(removed.content.targets.map((x) => x.label)).toEqual(['Agitation']);
    expect(removed.flags.some((f) => f.targetId === sevrage.id)).toBe(false);
  });

  it('valider verse les infos transverses au dossier ; ensuite plus de modification', async () => {
    const { client } = createTestApp();
    const t = await client.createTransmission({
      body: {
        ...base,
        transcript: 'Box 14, madame Lefèvre. Sa fille nous dit qu’elle est allergique à l’iode.',
      },
    });
    expect(t.content.transverse.map((x) => x.field)).toContain('allergies');
    await client.reviewTransmission({
      params: { transmissionId: t.id },
      body: { nurseId: 'martine', decision: 'validate' },
    });
    const detail = await client.patientDetail({ params: { patientId: 'rea-14' } });
    expect(detail.patient.transverse.allergies.status).toBe('connues');
    await expect(
      client.editTransmission({
        params: { transmissionId: t.id },
        body: { nurseId: 'martine', edits: [], removals: [] },
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      client.deleteTransmission({ params: { transmissionId: t.id } }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('"non relue" reste visible et compte dans la relève', async () => {
    const { client } = createTestApp();
    const t = await client.createTransmission({ body: { ...base, transcript: EXAMPLE_A } });
    const deferred = await client.reviewTransmission({
      params: { transmissionId: t.id },
      body: { nurseId: 'martine', decision: 'defer' },
    });
    expect(deferred.review.status).toBe('unreviewed');
    const sheet = await client.patientHandover({ params: { patientId: 'rea-12' } });
    expect(sheet.counts.unreviewed).toBe(1);
  });
});
