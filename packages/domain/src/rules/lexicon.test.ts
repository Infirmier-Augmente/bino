import { describe, expect, it } from 'vitest';
import {
  detectAppareil,
  detectTargetRule,
  expandAbbreviation,
  isNegated,
  lexicalSeverity,
} from './lexicon';
import { normalize } from './text';

describe('detectTargetRule', () => {
  it('reconnaît les événements qui justifient une cible', () => {
    expect(detectTargetRule('vers 16h il était agité')?.label).toBe('Agitation');
    expect(detectTargetRule('il a été extubé vers 10h')?.label).toBe('Sevrage ventilatoire');
    expect(detectTargetRule('retrouvée au sol ce matin')?.label).toBe('Chute');
  });
  it('ignore les négations ("pas de douleur", "non algique", "sans fièvre")', () => {
    expect(detectTargetRule('Pas de douleur.')).toBeNull();
    expect(detectTargetRule('GCS 15, non algique')).toBeNull();
    expect(detectTargetRule('sans fièvre depuis hier')).toBeNull();
    expect(detectTargetRule('pas de douleur mais une fièvre à 39')?.label).toBe('Hyperthermie');
  });
  it('repère une fièvre exprimée en chiffres', () => {
    expect(detectTargetRule('Elle a fait 38,9 à 8h')?.label).toBe('Hyperthermie');
    expect(detectTargetRule('température à 37,2')).toBeNull();
  });
});

describe('lexique', () => {
  it('détecte l’appareil', () => {
    expect(detectAppareil('sous lunettes à 3 litres')).toBe('respiratoire');
    expect(detectAppareil('diurèse correcte')).toBe('renal');
  });
  it('développe les abréviations et leurs variantes', () => {
    expect(expandAbbreviation('SNG')?.meaning).toMatch(/nasogastrique/);
    expect(expandAbbreviation('noradré')?.abbr).toBe('Noradré');
  });
  it('isNegated', () => {
    expect(isNegated(normalize('pas de douleur'), 'douleur')).toBe(true);
    expect(isNegated(normalize('douleur au bras, pas de douleur thoracique'), 'douleur')).toBe(
      false,
    );
  });
  it('gravité lexicale', () => {
    expect(lexicalSeverity('désaturation à 85')).toBe('urgent');
    expect(lexicalSeverity('RAS')).toBe('routine');
  });
});
