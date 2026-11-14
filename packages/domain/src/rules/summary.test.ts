import { describe, expect, it } from 'vitest';
import { makeTransmission } from '../__fixtures__/hospital';
import type { SourcedItem } from '../schemas/common';
import type { DarTarget, Transmission } from '../schemas/transmission';
import { completenessFlags } from './completeness';
import { asSentenceEnd, buildSummaryBullets } from './summary';

const TZ = 'Europe/Paris';
const NURSES = [
  { id: 'sophie', firstName: 'Sophie' },
  { id: 'karim', firstName: 'Karim' },
];

/** Élément dicté à la position `start` de la transmission `transmissionId`. */
function said(id: string, text: string, transmissionId: string, start: number): SourcedItem {
  return {
    id,
    text,
    sources: [{ kind: 'dictation', transmissionId, quote: text, start, end: start + text.length }],
    edited: false,
  };
}

function target(
  id: string,
  label: string,
  parts: { data?: SourcedItem[]; actions?: SourcedItem[]; results?: SourcedItem[] },
): DarTarget {
  return {
    id,
    label,
    appareil: 'douleur',
    data: parts.data ?? [],
    actions: parts.actions ?? [],
    results: parts.results ?? [],
    severity: null,
  };
}

// 8h10, Sophie : nuit calme (observation), douleur 4/10 + paracétamol (cible sans R), pansement (routine).
const morning: Transmission = makeTransmission({
  id: 'ta',
  nurseId: 'sophie',
  createdAt: '2026-11-14T08:10:00+01:00',
  content: {
    observations: [
      { ...said('o1', 'Nuit calme selon l’équipe de nuit', 'ta', 0), appareil: 'general' },
    ],
    targets: [
      target('c1', 'Douleur', {
        data: [said('d1', 'Douleur abdominale à 4 sur 10 au réveil.', 'ta', 40)],
        actions: [said('a1', 'Paracétamol donné à 8h.', 'ta', 80)],
      }),
    ],
    routine: [{ ...said('r1', 'Pansement du drain sec.', 'ta', 110), appareil: 'cutane' }],
  },
  review: { status: 'draft', by: null, at: null },
});
morning.flags = completenessFlags('ta', morning.content);

// 14h05, Karim : douleur réévaluée (R), repas, appel de la fille (info transverse).
const afternoon: Transmission = makeTransmission({
  id: 'tb',
  nurseId: 'karim',
  createdAt: '2026-11-14T14:05:00+01:00',
  content: {
    targets: [
      target('c2', 'douleur', {
        results: [said('r2', 'Douleur réévaluée à 2 sur 10 à 9h', 'tb', 10)],
      }),
    ],
    observations: [{ ...said('o2', 'Il a peu mangé à midi.', 'tb', 50), appareil: 'digestif' }],
    transverse: [
      { ...said('f1', 'Sa fille a appelé à 14h, inquiète.', 'tb', 80), field: 'famille' },
    ],
    todos: [said('td1', 'Constantes à recontrôler à 18h ?', 'tb', 120)],
  },
  review: { status: 'unreviewed', by: 'karim', at: '2026-11-14T14:06:00+01:00' },
});

describe('buildSummaryBullets', () => {
  const bullets = buildSummaryBullets({
    patientId: 'p12',
    transmissions: [afternoon, morning],
    nurses: NURSES,
    timeZone: TZ,
  });

  it('une puce par thème, de la plus récente à la plus ancienne, sans soins de routine', () => {
    expect(bullets.map((b) => b.theme)).toEqual([
      'Douleur',
      'Digestif',
      'Famille / proches',
      'À faire',
      'Général',
    ]);
    expect(bullets.some((b) => b.text.includes('Pansement'))).toBe(false);
  });

  it('fusionne la cible des deux comptes rendus (D, A puis R), texte repris tel quel', () => {
    const douleur = bullets[0];
    expect(douleur?.items.map((i) => i.id)).toEqual(['d1', 'a1', 'r2']);
    expect(douleur?.text).toBe(
      'Douleur abdominale à 4 sur 10 au réveil. Paracétamol donné à 8h. Douleur réévaluée à 2 sur 10 à 9h.',
    );
    expect(douleur?.contributors).toEqual([
      { nurseId: 'karim', firstName: 'Karim', at: '2026-11-14T14:05:00+01:00', time: '14h05' },
      { nurseId: 'sophie', firstName: 'Sophie', at: '2026-11-14T08:10:00+01:00', time: '8h10' },
    ]);
    expect(douleur?.lastAt).toBe('2026-11-14T14:05:00+01:00');
  });

  it('chaque élément garde ses sources, chaque puce a un identifiant stable', () => {
    for (const b of bullets) {
      for (const i of b.items) expect(i.sources.length).toBeGreaterThan(0);
    }
    expect(bullets[0]?.id).toBe('bullet:p12:douleur');
    const again = buildSummaryBullets({
      patientId: 'p12',
      transmissions: [morning, afternoon],
      nurses: NURSES,
      timeZone: TZ,
    });
    expect(again).toEqual(bullets);
  });

  it('n’ajoute un point que s’il manque une ponctuation de fin', () => {
    expect(asSentenceEnd(' Nuit calme ')).toBe('Nuit calme.');
    expect(asSentenceEnd('À recontrôler ?')).toBe('À recontrôler ?');
    expect(bullets.find((b) => b.theme === 'À faire')?.text).toBe(
      'Constantes à recontrôler à 18h ?',
    );
    expect(bullets.find((b) => b.theme === 'Général')?.text).toBe(
      'Nuit calme selon l’équipe de nuit.',
    );
  });

  it('la question « R manquant » est fermée par le R dicté plus tard (continuité des cibles)', () => {
    expect(bullets[0]?.question).toBeNull();
    const alone = buildSummaryBullets({
      patientId: 'p12',
      transmissions: [morning],
      nurses: NURSES,
      timeZone: TZ,
    });
    expect(alone.find((b) => b.theme === 'Douleur')?.question).toMatch(
      /^Résultat non renseigné pour « Douleur »/,
    );
    expect(alone.find((b) => b.theme === 'Général')?.question).toBeNull();
  });

  it('une question déjà traitée ne s’affiche plus', () => {
    const answered: Transmission = {
      ...morning,
      flags: morning.flags.map((f) => ({ ...f, status: 'answered' as const, answer: 'Mieux' })),
    };
    const out = buildSummaryBullets({
      patientId: 'p12',
      transmissions: [answered],
      nurses: NURSES,
      timeZone: TZ,
    });
    expect(out.find((b) => b.theme === 'Douleur')?.question).toBeNull();
  });

  it('un texte identique n’est pas répété, mais ses auteurs sont gardés', () => {
    const repeat = makeTransmission({
      id: 'tc',
      nurseId: 'karim',
      createdAt: '2026-11-14T15:00:00+01:00',
      content: {
        observations: [
          { ...said('o3', 'Nuit calme selon l’équipe de nuit.', 'tc', 0), appareil: 'general' },
        ],
      },
    });
    const out = buildSummaryBullets({
      patientId: 'p12',
      transmissions: [morning, repeat],
      nurses: NURSES,
      timeZone: TZ,
    });
    const general = out.find((b) => b.theme === 'Général');
    expect(general?.items).toHaveLength(1);
    expect(general?.items[0]?.sources).toHaveLength(2);
    expect(general?.contributors.map((c) => c.time)).toEqual(['15h00', '8h10']);
    expect(out[0]?.theme).toBe('Général');
  });

  it('attribue une saisie soignant, pas une donnée du dossier ; ignore les autres patients', () => {
    const answer: SourcedItem = {
      id: 'ans',
      text: 'Calmé après l’antalgique',
      sources: [{ kind: 'nurse', nurseId: 'sophie', at: '2026-11-14T16:20:00+01:00' }],
      edited: false,
    };
    const record: SourcedItem = {
      id: 'rec',
      text: 'Allergie à la pénicilline',
      sources: [{ kind: 'record', field: 'allergies', label: 'Dossier' }],
      edited: false,
    };
    const t = makeTransmission({
      id: 'td',
      nurseId: 'karim',
      createdAt: '2026-11-14T16:00:00+01:00',
      content: {
        targets: [target('c3', 'Agitation', { results: [answer] })],
        transverse: [{ ...record, field: 'allergies' }],
      },
    });
    const other = makeTransmission({
      id: 'te',
      patientId: 'p99',
      content: { todos: [said('x', 'Autre patient', 'te', 0)] },
    });
    const out = buildSummaryBullets({
      patientId: 'p12',
      transmissions: [t, other],
      nurses: [],
      timeZone: TZ,
    });
    expect(out.map((b) => b.theme)).toEqual(['Agitation', 'Allergies']);
    expect(out[0]?.contributors).toEqual([
      {
        nurseId: 'sophie',
        firstName: 'Un soignant',
        at: '2026-11-14T16:20:00+01:00',
        time: '16h20',
      },
    ]);
    expect(out[1]?.contributors).toEqual([]);
    expect(out[1]?.lastAt).toBe('2026-11-14T16:00:00+01:00');
  });

  it('la macro-cible d’entrée devient le thème « Entrée »', () => {
    const t = makeTransmission({
      id: 'tf',
      mode: 'admission',
      content: {
        admission: {
          motif: [said('m', 'Admise pour pyélonéphrite', 'tf', 0)],
          antecedents: [said('h', 'Diabète de type 2.', 'tf', 30)],
          histoire: [],
          autonomie: [],
          contexte: [],
        },
      },
    });
    const out = buildSummaryBullets({
      patientId: 'p12',
      transmissions: [t],
      nurses: NURSES,
      timeZone: TZ,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      theme: 'Entrée',
      text: 'Admise pour pyélonéphrite. Diabète de type 2.',
    });
  });

  it('aucune transmission : aucune puce', () => {
    expect(
      buildSummaryBullets({ patientId: 'p12', transmissions: [], nurses: NURSES, timeZone: TZ }),
    ).toEqual([]);
  });
});
