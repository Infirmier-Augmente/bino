import type { InputMethod, SampleDictation, SummaryBullet } from '@infirmier/domain';

/** Le texte dicté s'ajoute À LA FIN du compte rendu, séparé par une espace. */
export function appendDictation(previous: string, addition: string): string {
  return `${previous.trim()} ${addition.trim()}`.trim();
}

/** L'API refuse une dictée de moins de 3 caractères : même message que « vide ». */
export function isReportEmpty(text: string): boolean {
  return text.trim().length < 3;
}

export type DraftEvent = 'typed' | 'voice-device' | 'voice-server' | 'sample';

/**
 * Comment le compte rendu a été saisi (envoyé à l'API, sert aux indicateurs) : la dernière
 * dictée l'emporte ; corriger un exemple au clavier en fait une saisie clavier.
 */
export function nextInputMethod(previous: InputMethod, event: DraftEvent): InputMethod {
  if (event === 'sample') return 'simulation';
  if (event === 'typed') return previous === 'simulation' ? 'keyboard' : previous;
  return event;
}

/** Exemple de dictée proposé pour ce patient, tant qu'aucun compte rendu n'a déjà ce texte. */
export function sampleFor(
  samples: readonly SampleDictation[],
  patientId: string,
  transcripts: readonly string[],
): SampleDictation | null {
  const done = new Set(transcripts.map((t) => t.trim()));
  return (
    samples.find(
      (s) => s.patientId === patientId && s.mode === 'transmission' && !done.has(s.text.trim()),
    ) ?? null
  );
}

/** « Douleur : Douleur à 2 sur 10. » */
export function bulletText(b: Pick<SummaryBullet, 'theme' | 'text'>): string {
  return `${b.theme} : ${b.text}`;
}

/** Comme le prototype : 6 puces au plus, les plus récentes ; le reste se déplie (rien n'est perdu). */
export const VISIBLE_BULLETS = 6;

export function splitBullets<T>(
  bullets: readonly T[],
  expanded: boolean,
  max = VISIBLE_BULLETS,
): { shown: readonly T[]; hidden: number } {
  if (expanded || bullets.length <= max) return { shown: bullets, hidden: 0 };
  return { shown: bullets.slice(0, max), hidden: bullets.length - max };
}

/** « Voir les 2 autres puces » / « Voir l'autre puce ». */
export function moreBulletsLabel(hidden: number): string {
  return hidden === 1 ? 'Voir l’autre puce' : `Voir les ${hidden} autres puces`;
}

/** « Karim 14h05 · Sophie 8h10 » (déjà dédoublonné et trié par le serveur). */
export function contributorsLine(b: Pick<SummaryBullet, 'contributors'>): string {
  return b.contributors.map((c) => `${c.firstName} ${c.time}`).join(' · ');
}
