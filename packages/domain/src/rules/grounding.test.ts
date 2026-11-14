import { describe, expect, it } from 'vitest';
import { EXAMPLE_A } from '../__fixtures__/hospital';
import { groundStatement, locateQuote, numbersAreGrounded } from './grounding';
import { extractNumbers, normalizeWithMap } from './text';

describe('normalizeWithMap', () => {
  it('retire accents, ponctuation et casse en gardant les positions d’origine', () => {
    const src = 'Extubé, à 10h !';
    const n = normalizeWithMap(src);
    expect(n.value).toBe('extube a 10h');
    expect(src[n.map[0] ?? -1]).toBe('E');
    expect(src[n.map[n.value.length - 1] ?? -1]).toBe('h');
  });
});

describe('extractNumbers', () => {
  it('lit les chiffres, décimales et nombres en lettres', () => {
    expect(extractNumbers('lunettes à 3 litres vers 16h30')).toEqual(
      expect.arrayContaining([3, 16, 30]),
    );
    expect(extractNumbers('trois litres, dix-sept heures')).toEqual(
      expect.arrayContaining([3, 17]),
    );
    expect(extractNumbers('PAS 1,5')).toEqual(expect.arrayContaining([1.5]));
  });
  it('ignore les notations O2 / FiO2 / SpO2', () => {
    expect(extractNumbers('O2 aux lunettes, FiO2 et SpO2')).toEqual([]);
  });
});

describe('locateQuote', () => {
  it('retrouve un extrait exact malgré accents et ponctuation', () => {
    const loc = locateQuote(EXAMPLE_A, 'il a ete extube vers 10h');
    expect(loc).not.toBeNull();
    expect(loc?.quote).toBe('il a été extubé vers 10h');
    expect(loc?.score).toBe(1);
  });

  it('tolère une petite variation de transcription', () => {
    const loc = locateQuote(EXAMPLE_A, 'il a arraché la SNG');
    expect(loc).not.toBeNull();
    expect(loc?.quote).toContain('arraché');
  });

  it('refuse un extrait absent de la dictée', () => {
    expect(locateQuote(EXAMPLE_A, 'saturation à 96 % sous lunettes')).toBeNull();
  });
});

describe('numbersAreGrounded', () => {
  it('accepte une reformulation fidèle', () => {
    expect(numbersAreGrounded('O2 aux lunettes 3 L/min.', 'sous lunettes à 3 litres')).toBe(true);
    expect(numbersAreGrounded('Extubé à 10 h.', 'extubé vers dix heures')).toBe(true);
    expect(numbersAreGrounded('Une séance de kiné.', 'la kiné est passée')).toBe(true);
  });
  it('refuse un chiffre inventé ou modifié', () => {
    expect(numbersAreGrounded('O2 5 L/min.', 'lunettes à 3 litres')).toBe(false);
    expect(numbersAreGrounded('SpO2 96 %.', 'sécrétions sèches')).toBe(false);
  });
});

describe('groundStatement', () => {
  it('produit une source avec offsets exacts', () => {
    const r = groundStatement('t1', EXAMPLE_A, {
      text: 'Kiné passée.',
      quote: 'la kiné est passée',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(EXAMPLE_A.slice(r.source.start, r.source.end)).toBe('la kiné est passée');
  });
  it('signale les raisons de rejet', () => {
    expect(groundStatement('t1', EXAMPLE_A, { text: 'x', quote: '' })).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(
      groundStatement('t1', EXAMPLE_A, { text: 'Fièvre', quote: 'il a de la fièvre' }),
    ).toEqual({
      ok: false,
      reason: 'quote-not-found',
    });
    expect(
      groundStatement('t1', EXAMPLE_A, {
        text: 'Lunettes 4 L/min',
        quote: 'sous lunettes à 3 litres',
      }),
    ).toEqual({ ok: false, reason: 'number-mismatch' });
  });
});

describe('ancrage : cas limites (relecture de code)', () => {
  it('refuse un extrait coupé au milieu d’un nombre ou d’un mot', () => {
    expect(locateQuote('tension à 125', 'tension à 12')?.quote).not.toBe('tension à 12');
    expect(
      groundStatement('t', 'tension à 125', { text: 'Tension à 12.', quote: 'tension à 12' }).ok,
    ).toBe(false);
    expect(locateQuote('Patient à 10 mg', 'à 1')).toBeNull();
  });
  it('ne découpe pas les décimales', () => {
    expect(numbersAreGrounded('Diurèse 5 L.', 'diurèse 1,5 L')).toBe(false);
    expect(numbersAreGrounded('Diurèse 1,5 L.', 'diurèse 1,5 L')).toBe(true);
  });
  it('« une » compte quand l’extrait est chiffré', () => {
    expect(numbersAreGrounded('Une ampoule de morphine.', 'deux ampoules de morphine')).toBe(false);
    expect(
      numbersAreGrounded('Une ampoule de morphine.', 'on lui a fait une ampoule de morphine'),
    ).toBe(true);
  });
});
