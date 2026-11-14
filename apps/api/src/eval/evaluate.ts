import {
  type DictationExpectation,
  normalize,
  type ScenarioEvent,
  type Transmission,
} from '@infirmier/domain';

/**
 * ÉVALUATION — compare la structuration produite aux attentes écrites dans les scénarios.
 * Indicateurs inspirés du kit Foch : bon patient, cibles attendues, R manquant bien signalé,
 * ZÉRO information inventée (chaînes interdites + éléments rejetés par l'ancrage).
 */

export interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface DictationEval {
  scenarioId: string;
  at: string;
  label: string;
  engine: string;
  degraded: boolean;
  durationMs: number;
  rejected: number;
  checks: Check[];
}

type DictationEvent = Extract<ScenarioEvent, { type: 'dictation' }>;

function allTexts(t: Transmission): string[] {
  const c = t.content;
  return [
    ...c.targets.flatMap((x) =>
      [x.label, ...x.data, ...x.actions, ...x.results].map((i) =>
        typeof i === 'string' ? i : i.text,
      ),
    ),
    ...c.observations.map((i) => i.text),
    ...c.routine.map((i) => i.text),
    ...c.todos.map((i) => i.text),
    ...c.transverse.map((i) => i.text),
  ];
}

export function evaluateDictation(
  scenarioId: string,
  event: DictationEvent,
  t: Transmission,
): DictationEval {
  const exp: DictationExpectation = event.expect ?? {};
  const checks: Check[] = [];

  if (exp.patientId !== undefined) {
    checks.push({
      name: 'patient',
      ok: t.patientId === exp.patientId,
      detail: `attendu ${exp.patientId}, obtenu ${t.patientId ?? 'aucun'}`,
    });
  }
  if (exp.ambiguous) {
    checks.push({
      name: 'ambiguïté signalée',
      ok: t.patientId === null,
      detail: `obtenu ${t.patientId ?? 'aucun'}`,
    });
  }
  for (const target of exp.targets ?? []) {
    const words = target.labelAnyOf.map(normalize);
    const found = t.content.targets.find((x) => words.some((w) => normalize(x.label).includes(w)));
    checks.push({
      name: `cible ${target.labelAnyOf[0]}`,
      ok: !!found && (!target.appareil || found.appareil === target.appareil),
      detail: found
        ? `${found.label} (${found.appareil})`
        : `cibles : ${t.content.targets.map((x) => x.label).join(', ') || 'aucune'}`,
    });
    if (found && target.missingResult !== undefined) {
      const missing = found.results.length === 0;
      checks.push({
        name: `R ${target.missingResult ? 'manquant signalé' : 'renseigné'} (${found.label})`,
        ok: missing === target.missingResult,
      });
    }
  }
  const anyIn = (list: string[], words: string[]) =>
    words.some((w) => list.some((x) => normalize(x).includes(normalize(w))));
  if (exp.routineAnyOf) {
    checks.push({
      name: 'soin de routine',
      ok: anyIn(
        t.content.routine.map((r) => r.text),
        exp.routineAnyOf,
      ),
    });
  }
  if (exp.todosAnyOf) {
    checks.push({
      name: 'à faire',
      ok: anyIn(
        t.content.todos.map((r) => r.text),
        exp.todosAnyOf,
      ),
    });
  }
  const texts = allTexts(t);
  for (const f of exp.forbidden ?? []) {
    const hit = texts.find(
      (x) =>
        normalize(x).includes(normalize(f)) &&
        !normalize(t.dictation.transcript).includes(normalize(f)),
    );
    checks.push({ name: `aucune invention « ${f} »`, ok: !hit, detail: hit });
  }

  return {
    scenarioId,
    at: event.at,
    label: event.label ?? event.text.slice(0, 40),
    engine: t.engine.structuring,
    degraded: t.engine.degraded,
    durationMs: t.engine.durationMs,
    rejected: t.engine.rejected.length,
    checks,
  };
}

export interface EvalSummary {
  dictations: number;
  checks: number;
  passed: number;
  patientAccuracy: number | null;
  inventions: number;
  rejectedStatements: number;
  degraded: number;
  avgDurationMs: number;
}

export function summarize(results: readonly DictationEval[]): EvalSummary {
  const checks = results.flatMap((r) => r.checks);
  const patient = checks.filter((c) => c.name === 'patient');
  return {
    dictations: results.length,
    checks: checks.length,
    passed: checks.filter((c) => c.ok).length,
    patientAccuracy: patient.length ? patient.filter((c) => c.ok).length / patient.length : null,
    inventions: checks.filter((c) => c.name.startsWith('aucune invention') && !c.ok).length,
    rejectedStatements: results.reduce((n, r) => n + r.rejected, 0),
    degraded: results.filter((r) => r.degraded).length,
    avgDurationMs: results.length
      ? Math.round(results.reduce((n, r) => n + r.durationMs, 0) / results.length)
      : 0,
  };
}
