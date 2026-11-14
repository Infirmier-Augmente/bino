import { describe, expect, it } from 'vitest';
import { item, makePatient, makeTransmission, REA } from '../__fixtures__/hospital';
import { searchTransmissions } from '../rules/search';
import { buildFhirBundle } from './fhir';

describe('buildFhirBundle', () => {
  it('exporte une Composition par transmission, statut selon validation', () => {
    const validated = makeTransmission({
      id: 'tv',
      review: { status: 'validated', by: 'martine', at: '2026-11-14T16:40:00+01:00' },
      content: {
        targets: [
          {
            id: 'c1',
            label: 'Sevrage ventilatoire',
            appareil: 'respiratoire',
            data: [item('d', 'Extubé à 10h.')],
            actions: [],
            results: [],
            severity: null,
          },
        ],
      },
    });
    const draft = makeTransmission({ id: 'td' });
    const bundle = buildFhirBundle({
      unit: REA,
      patient: makePatient(),
      nurses: [
        {
          id: 'martine',
          unitId: 'rea',
          matricule: '20482',
          firstName: 'Martine',
          lastName: 'Roux',
          role: 'IDE',
        },
      ],
      transmissions: [validated, draft],
      now: new Date('2026-11-14T19:30:00+01:00'),
      bundleId: 'b1',
    });
    expect(bundle.resourceType).toBe('Bundle');
    const compositions = (bundle.entry ?? [])
      .map((e) => e.resource)
      .filter((r) => r?.resourceType === 'Composition');
    expect(compositions).toHaveLength(2);
    const [c1, c2] = compositions as unknown as {
      status: string;
      section?: { title?: string; text?: { div: string } }[];
    }[];
    expect(c1?.status).toBe('final');
    expect(c2?.status).toBe('preliminary');
    expect(c1?.section?.[0]?.title).toBe('Cible : Sevrage ventilatoire');
    expect(c1?.section?.[0]?.text?.div).toContain('<em>Non renseigné</em>');
  });
});

describe('searchTransmissions', () => {
  it('renvoie des extraits sourcés, pas une réponse inventée', () => {
    const t = makeTransmission({
      dictation: {
        transcript: 'Box 12 : on lui a donné du Doliprane à 14h, douleur soulagée.',
        inputMethod: 'keyboard',
        durationSec: null,
      },
    });
    const hits = searchTransmissions([t], 'doliprane', () => 'Box 12');
    expect(hits).toHaveLength(1);
    const h = hits[0];
    expect(h?.snippet.slice(h.matchStart, h.matchEnd)).toBe('Doliprane');
    expect(searchTransmissions([t], 'morphine', () => '')).toEqual([]);
  });
});
