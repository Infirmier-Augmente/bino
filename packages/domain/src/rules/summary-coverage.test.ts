import { describe, expect, it } from 'vitest';
import { makeTransmission } from '../__fixtures__/hospital';
import type { SourcedItem } from '../schemas/common';
import type { Transmission } from '../schemas/transmission';
import { buildSummaryBullets } from './summary';
import {
  isIdentificationSentence,
  splitSentences,
  UNSTRUCTURED_THEME,
  uncoveredItems,
} from './summary-coverage';

/** Élément qui cite exactement `quote` dans la dictée de `t`. */
function quoting(t: Pick<Transmission, 'id' | 'dictation'>, quote: string): SourcedItem {
  const start = t.dictation.transcript.indexOf(quote);
  return {
    id: `i-${start}`,
    text: quote,
    edited: false,
    sources: [{ kind: 'dictation', transmissionId: t.id, quote, start, end: start + quote.length }],
  };
}

function dictated(id: string, transcript: string): Transmission {
  return makeTransmission({
    id,
    nurseId: 'martine',
    createdAt: '2026-11-14T18:15:00+01:00',
    dictation: { transcript, inputMethod: 'voice-server', durationSec: 4 },
  });
}

describe('phrases de la dictée', () => {
  it('découpe sur . ! ? ; et les retours à la ligne, positions exactes', () => {
    const text = 'Chambre 3, Mme Keller. Fièvre à 48 degrés ! À revoir ; ok\nPansement fait.';
    const s = splitSentences(text);
    expect(s.map((x) => x.text)).toEqual([
      'Chambre 3, Mme Keller.',
      'Fièvre à 48 degrés !',
      'À revoir ;',
      'ok',
      'Pansement fait.',
    ]);
    for (const x of s) expect(text.slice(x.start, x.end)).toBe(x.text);
  });

  it('« M. », « Dr. » et les nombres décimaux ne coupent pas une phrase', () => {
    expect(splitSentences('Vu par M. Dupond et le Dr. Martin, T 38.2 ce soir.')).toHaveLength(1);
  });

  it('la phrase qui nomme le patient est reconnue (et seulement si elle est courte)', () => {
    expect(isIdentificationSentence('Chambre 12, M. Dupond.')).toBe(true);
    expect(isIdentificationSentence('Box 12.')).toBe(true);
    expect(isIdentificationSentence('Mme Keller.')).toBe(true);
    expect(isIdentificationSentence('Fièvre à 48 degrés.')).toBe(false);
    expect(
      isIdentificationSentence('Chambre 12, il est plus essoufflé qu’à 14h, FR 24, sat 94.'),
    ).toBe(false);
  });
});

describe('rien de ce que l’IDE a dit ne se perd', () => {
  it('structuration vide (valeur jugée « incohérente ») : la phrase est reprise mot pour mot', () => {
    const t = dictated('t48', 'Chambre 3, Mme Keller. Fievre est à 48 degrés.');
    const items = uncoveredItems(t);
    expect(items.map((i) => i.text)).toEqual(['Fievre est à 48 degrés.']);
    const src = items[0]?.sources[0];
    expect(src?.kind).toBe('dictation');
    if (src?.kind === 'dictation') {
      expect(t.dictation.transcript.slice(src.start, src.end)).toBe(src.quote);
    }
  });

  it('seules les phrases qu’aucun élément ne cite sont ajoutées (routine comprise)', () => {
    const t = dictated('tp', 'Douleur à 6 sur 10. Pansement refait. Sa fille a appelé.');
    t.content.targets = [
      {
        id: 'c',
        label: 'Douleur',
        appareil: 'douleur',
        data: [quoting(t, 'Douleur à 6 sur 10')],
        actions: [],
        results: [],
        severity: null,
      },
    ];
    t.content.routine = [{ ...quoting(t, 'Pansement refait'), appareil: 'cutane' }];
    expect(uncoveredItems(t).map((i) => i.text)).toEqual(['Sa fille a appelé.']);
  });

  it('dans « Tous » : une puce « Autres informations », avec l’auteur et l’heure', () => {
    const t = dictated('t48', 'Chambre 3, Mme Keller. Fievre est à 48 degrés.');
    t.patientId = 'p3';
    const bullets = buildSummaryBullets({
      patientId: 'p3',
      transmissions: [t],
      nurses: [{ id: 'martine', firstName: 'Martine' }],
      timeZone: 'Europe/Paris',
    });
    expect(bullets).toHaveLength(1);
    expect(bullets[0]).toMatchObject({
      theme: UNSTRUCTURED_THEME,
      text: 'Fievre est à 48 degrés.',
      contributors: [{ firstName: 'Martine', time: '18h15' }],
    });
  });
});
