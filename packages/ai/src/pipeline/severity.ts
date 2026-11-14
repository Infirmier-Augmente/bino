import {
  type DarTarget,
  lexicalSeverity,
  type Severity,
  SeverityLevel,
  type TransmissionContent,
} from '@infirmier/domain';
import type { ClassifierPort } from '../classifier/port';

const LEVELS = SeverityLevel.options;
const LEVEL_DESCRIPTIONS = [
  'Soin ou constat de routine, rien à signaler à l’équipe suivante',
  'Élément à surveiller par l’équipe suivante, sans urgence',
  'Événement préoccupant qui doit être évoqué en priorité à la relève',
  'Situation urgente ou instable nécessitant une attention immédiate',
] as const;

/**
 * Gravité SUGGÉRÉE de chaque cible (sert au tri de la relève, jamais affichée comme un verdict).
 * Classifieur sémantique si disponible, sinon lexique.
 */
export async function rateSeverity(
  content: TransmissionContent,
  classifier: ClassifierPort,
): Promise<TransmissionContent> {
  if (content.targets.length === 0) return content;
  const lexical = (t: DarTarget): Severity => ({
    level: lexicalSeverity([t.label, ...t.data.map((d) => d.text)].join(' ')),
    confidence: null,
    engine: 'lexique',
  });
  if (!classifier.semantic) {
    return { ...content, targets: content.targets.map((t) => ({ ...t, severity: lexical(t) })) };
  }
  try {
    const questions = Object.fromEntries(
      content.targets.map((t) => [
        t.id,
        {
          type: 'score' as const,
          instructions: `Pour la relève infirmière, quelle est l'importance de la cible « ${t.label} » décrite dans \`cibles.${t.id}\` ?`,
          levels: LEVEL_DESCRIPTIONS,
        },
      ]),
    );
    const state = {
      cibles: Object.fromEntries(
        content.targets.map((t) => [
          t.id,
          {
            cible: t.label,
            donnees: t.data.map((d) => d.text),
            actions: t.actions.map((a) => a.text),
            resultats: t.results.map((r) => r.text),
          },
        ]),
      ),
    };
    const answers = await classifier.ask(state, questions, AbortSignal.timeout(8_000));
    return {
      ...content,
      targets: content.targets.map((t) => {
        const a = answers[t.id];
        if (!a) return { ...t, severity: lexical(t) };
        const idx = Math.max(0, Math.min(LEVELS.length - 1, Math.round(a.score)));
        return {
          ...t,
          severity: {
            level: LEVELS[idx] ?? 'routine',
            confidence: a.confidence,
            engine: classifier.id,
          },
        };
      }),
    };
  } catch {
    return { ...content, targets: content.targets.map((t) => ({ ...t, severity: lexical(t) })) };
  }
}
