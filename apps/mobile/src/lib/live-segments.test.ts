import type { LiveServerMessage } from '@infirmier/domain';
import { describe, expect, it } from 'vitest';
import {
  type LiveSegments,
  liveDisplayText,
  reduceSegments,
  segmentText,
  tokenize,
} from './live-segments';

const delta = (segment: number, text: string): LiveServerMessage => ({
  type: 'delta',
  segment,
  text,
});
const final = (segment: number, text: string): LiveServerMessage => ({
  type: 'segment',
  segment,
  text,
  engine: 'test',
});
const run = (msgs: LiveServerMessage[], from: LiveSegments = []) =>
  msgs.reduce(reduceSegments, from);

describe('reduceSegments', () => {
  it('concatène les deltas de chaque segment', () => {
    const s = run([delta(0, 'Chambre'), delta(0, ' dou'), delta(0, 'ze,'), delta(1, ' FR')]);
    expect(s).toEqual([
      { index: 0, provisional: 'Chambre douze,', final: null },
      { index: 1, provisional: ' FR', final: null },
    ]);
  });

  it('le définitif remplace le provisoire de SON segment, les suivants restent provisoires', () => {
    const s = run([
      delta(0, 'sat quatre-vingt-quatorze'),
      delta(1, ' pouls cent'),
      final(0, 'Sat 94.'),
    ]);
    expect(liveDisplayText(s)).toBe('Sat 94. pouls cent');
    expect(s[1]?.final).toBeNull();
  });

  it('ignore les deltas d’un segment déjà définitif', () => {
    const before = run([delta(0, 'a'), final(0, 'A.')]);
    expect(reduceSegments(before, delta(0, ' b'))).toBe(before);
  });

  it('messages dans le désordre : chaque segment à sa place', () => {
    const s = run([delta(2, ' trois'), final(0, 'Un.'), delta(1, ' deux')]);
    expect(s.map((x) => x.index)).toEqual([0, 1, 2]);
    expect(liveDisplayText(s)).toBe('Un. deux trois');
  });

  it('garde les objets inchangés (seul le segment modifié est nouveau)', () => {
    const a = run([delta(0, 'un'), delta(1, ' deux')]);
    const b = reduceSegments(a, delta(1, ' trois'));
    expect(b[0]).toBe(a[0]);
    expect(b[1]).not.toBe(a[1]);
    expect(reduceSegments(b, { type: 'ready', engine: 'x' })).toBe(b);
    expect(reduceSegments(b, delta(1, ''))).toBe(b);
  });

  it('un définitif vide efface le provisoire (bruit, hésitation)', () => {
    const s = run([delta(0, 'Box 12.'), delta(1, ' euh'), final(1, '')]);
    expect(liveDisplayText(s)).toBe('Box 12.');
  });
});

describe('texte affiché', () => {
  it('espaces normalisés, une seule espace entre segments', () => {
    expect(segmentText({ index: 0, provisional: '  FR   24 ', final: null })).toBe('FR 24');
    expect(
      liveDisplayText([
        { index: 0, provisional: '', final: 'Sat 94.' },
        { index: 1, provisional: ' ', final: null },
        { index: 2, provisional: ' pouls', final: null },
      ]),
    ).toBe('Sat 94. pouls');
  });
});

describe('tokenize', () => {
  it('mots avec la ponctuation collée, espaces multiples ignorés', () => {
    expect(tokenize(' Sat 94,  pouls 108. ')).toEqual([
      { kind: 'word', text: 'Sat' },
      { kind: 'word', text: '94,' },
      { kind: 'word', text: 'pouls' },
      { kind: 'word', text: '108.' },
    ]);
  });
  it('garde les retours à la ligne et les lignes vides', () => {
    expect(tokenize('Box 12.\n\nDouleur')).toEqual([
      { kind: 'word', text: 'Box' },
      { kind: 'word', text: '12.' },
      { kind: 'break', blank: false },
      { kind: 'break', blank: true },
      { kind: 'word', text: 'Douleur' },
    ]);
    expect(tokenize('')).toEqual([]);
  });
  it('un texte qui s’allonge garde le rang de ses mots (clés stables)', () => {
    const a = tokenize('Chambre dou');
    const b = tokenize('Chambre douze, FR');
    expect(b.slice(0, a.length).map((t) => t.kind)).toEqual(a.map((t) => t.kind));
    expect(b[0]).toEqual(a[0]);
    expect(b).toHaveLength(3);
  });
});
