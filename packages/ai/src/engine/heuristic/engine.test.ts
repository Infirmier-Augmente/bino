import { describe, expect, it } from 'vitest';
import { assemble, sequentialIds } from '../../pipeline/assemble';
import { structureHeuristically } from './engine';
import { segment } from './segment';

const EXAMPLE_A =
  'Alors monsieur du box 12. Neuro, Glasgow 15, plus de sédation depuis ce matin. Respi, il a été extubé vers 10h, là il est sous lunettes à 3 litres, sécrétions sèches, la kiné est passée. Hémodynamique stable, la noradré a été arrêtée hier soir. J’ai refait le pansement du KT central, c’est propre. Par contre vers 16h il était agité, il a arraché sa SNG, j’ai appelé l’interne, on l’a reposée et la radio de contrôle est OK.';

const texts = (list: { text: string }[]) => list.map((s) => s.text);

describe('segment', () => {
  it('découpe en propositions sans casser les nombres décimaux', () => {
    const clauses = segment('Température 37,8. Sat à 94 %, sous 2 L.');
    expect(clauses.map((c) => c.text)).toEqual(['Température 37,8', 'Sat à 94 %', 'sous 2 L']);
  });
  it('conserve les positions exactes', () => {
    for (const c of segment(EXAMPLE_A)) expect(EXAMPLE_A.slice(c.start, c.end)).toBe(c.text);
  });
});

describe('moteur heuristique — exemple A du kit Foch', () => {
  const raw = structureHeuristically({
    transcript: EXAMPLE_A,
    mode: 'transmission',
    patient: null,
  });

  it('crée les cibles "Sevrage ventilatoire" et "Agitation"', () => {
    expect(raw.targets.map((t) => t.label)).toEqual(['Sevrage ventilatoire', 'Agitation']);
  });

  it('range le sevrage en DAR sans inventer de résultat', () => {
    const t = raw.targets[0];
    expect(t?.appareil).toBe('respiratoire');
    expect(texts(t?.data ?? []).join(' ')).toMatch(
      /extubé vers 10h.*lunettes à 3 litres.*sécrétions sèches/i,
    );
    expect(texts(t?.actions ?? [])).toEqual(['La kiné est passée.']);
    expect(t?.results).toEqual([]);
  });

  it('range l’agitation : D agitation + SNG, A interne + repose, R radio OK', () => {
    const t = raw.targets[1];
    expect(texts(t?.data ?? []).join(' ')).toMatch(/agité.*arraché sa SNG/i);
    expect(texts(t?.actions ?? []).join(' ')).toMatch(/appelé l’interne.*reposée/i);
    expect(texts(t?.results ?? []).join(' ')).toMatch(/radio de contrôle est OK/i);
  });

  it('met le pansement de KT en soin de routine et Glasgow en surveillance', () => {
    expect(texts(raw.routine).join(' ')).toMatch(/refait le pansement du KT central, c’est propre/);
    expect(raw.observations.find((o) => /Glasgow 15/.test(o.text))?.appareil).toBe('neuro');
    expect(raw.observations.find((o) => /Hémodynamique stable/.test(o.text))?.appareil).toBe(
      'hemodynamique',
    );
  });

  it('ignore la désignation du patient', () => {
    const all = [...raw.observations, ...raw.routine, ...raw.targets.flatMap((t) => t.data)];
    expect(all.some((s) => /box 12/i.test(s.quote))).toBe(false);
  });

  it('passe intégralement la porte anti-invention, avec un R manquant signalé', () => {
    const r = assemble(raw, 't1', EXAMPLE_A, sequentialIds());
    expect(r.rejected).toEqual([]);
    expect(r.flags.filter((f) => f.kind === 'missing-result').map((f) => f.question)).toEqual([
      'Résultat non renseigné pour « Sevrage ventilatoire » : quelle réévaluation (saturation, tolérance) ?',
    ]);
  });
});

describe('moteur heuristique — autres situations', () => {
  it('repère à-faire et infos transverses', () => {
    const raw = structureHeuristically({
      transcript:
        'Chambre 8. Elle est allergique à la pénicilline. Scanner prévu demain à jeun. Bilan sanguin à 6h à faire. Sa fille est passée cet après-midi, elle a été informée.',
      mode: 'transmission',
      patient: null,
    });
    expect(raw.transverse.map((t) => t.field)).toEqual(['allergies', 'examens', 'famille']);
    expect(texts(raw.todos)).toEqual(['Bilan sanguin à 6h à faire.']);
  });

  it('structure une admission en macro-cible d’entrée', () => {
    const raw = structureHeuristically({
      transcript:
        'Entrée de madame Petit en chambre 4. Admise pour une décompensation cardiaque. Antécédents d’hypertension et de diabète. Elle vit seule à domicile. Marche avec un déambulateur. Essoufflée au moindre effort.',
      mode: 'admission',
      patient: null,
    });
    expect(raw.admission?.motif.length).toBe(1);
    expect(raw.admission?.antecedents.length).toBe(1);
    expect(raw.admission?.contexte.length).toBe(1);
    expect(raw.admission?.autonomie.length).toBe(1);
  });
});

describe('moteur heuristique : rien de clinique ne disparaît (relecture de code)', () => {
  const all = (raw: ReturnType<typeof structureHeuristically>) =>
    [
      ...raw.observations,
      ...raw.routine,
      ...raw.todos,
      ...raw.transverse,
      ...raw.targets.flatMap((t) => [...t.data, ...t.actions, ...t.results]),
    ].map((s) => s.quote);

  it('garde « patiente très fatiguée » et les phrases avec « madame » hors tête', () => {
    const raw = structureHeuristically({
      transcript:
        'Box 12, patiente très fatiguée, elle a peu mangé. Madame Durand ne veut plus parler, patiente prostrée.',
      mode: 'transmission',
      patient: null,
    });
    const quotes = all(raw).join(' | ');
    expect(quotes).toContain('patiente très fatiguée');
    expect(quotes).toContain('patiente prostrée');
  });

  it('une proposition courte après une info transverse la complète (pas d’élément orphelin)', () => {
    const raw = structureHeuristically({
      transcript: 'Allergie pénicilline, OK.',
      mode: 'transmission',
      patient: null,
    });
    expect(raw.transverse.map((t) => t.quote)).toEqual(['Allergie pénicilline, OK']);
    expect(raw.observations).toEqual([]);
  });
});
