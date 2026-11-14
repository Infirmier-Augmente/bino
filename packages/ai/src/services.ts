import type { AiStatus, Patient, PatientResolution } from '@infirmier/domain';
import { HeuristicClassifier } from './classifier/heuristic';
import { JevClassifier } from './classifier/jev';
import { LlmClassifier } from './classifier/llm';
import type { ClassifierPort } from './classifier/port';
import type { AiConfig } from './config';
import { HeuristicEngine } from './engine/heuristic/engine';
import { LlmStructuringEngine } from './engine/llm-engine';
import type { StructuringContext, StructuringEngine } from './engine/raw';
import { AiSdkLlm } from './llm/ai-sdk';
import type { LlmPort } from './llm/port';
import type { IdFactory } from './pipeline/assemble';
import { resolvePatient } from './pipeline/resolve-patient';
import { rateSeverity } from './pipeline/severity';
import { type StructureOutcome, structureDictation } from './pipeline/structure';
import { AiSdkStt } from './stt/ai-sdk';
import { OpenAiCompatibleStt } from './stt/openai-compatible';
import { NoStt, type SttPort } from './stt/port';

export interface AiServices {
  readonly config: AiConfig;
  readonly stt: SttPort;
  readonly classifier: ClassifierPort;
  status(version: string): AiStatus;
  structure(
    transmissionId: string,
    ctx: StructuringContext,
    ids?: IdFactory,
  ): Promise<StructureOutcome>;
  resolvePatient(
    transcript: string,
    patients: readonly Patient[],
    opts: { preferredPatientIds?: readonly string[]; ageOf: (p: Patient) => number },
  ): Promise<PatientResolution>;
}

export interface AiOverrides {
  llm?: LlmPort;
  classifier?: ClassifierPort;
  stt?: SttPort;
  fetch?: typeof fetch;
  logger?: Pick<Console, 'warn'>;
}

/**
 * Assemble les services IA à partir de la configuration (composition root).
 * Les surcharges permettent d'injecter des faux en test.
 */
export function createAiServices(config: AiConfig, overrides: AiOverrides = {}): AiServices {
  const fetchImpl = overrides.fetch ?? fetch;
  const heuristic = new HeuristicEngine();

  const llm: LlmPort | null =
    overrides.llm ?? (config.llm.provider === 'heuristic' ? null : new AiSdkLlm(config.llm));
  const primary: StructuringEngine = llm ? new LlmStructuringEngine(llm) : heuristic;
  const fallback: StructuringEngine | null = config.llm.fallback === 'heuristic' ? heuristic : null;

  const classifier: ClassifierPort =
    overrides.classifier ??
    (config.classifier.provider === 'jev'
      ? new JevClassifier(config.classifier, fetchImpl)
      : config.classifier.provider === 'llm' && llm
        ? new LlmClassifier(llm)
        : new HeuristicClassifier());

  const stt: SttPort =
    overrides.stt ??
    (config.stt.provider === 'none'
      ? new NoStt()
      : config.stt.provider === 'openai-compatible'
        ? new OpenAiCompatibleStt(config.stt, fetchImpl)
        : new AiSdkStt(config.stt));

  return {
    config,
    stt,
    classifier,
    status: (version) => ({
      version,
      llm: {
        provider: config.llm.provider,
        model: llm ? llm.id.split(':').slice(1).join(':') || config.llm.model : null,
        ready: true,
        fallback: fallback && fallback.id !== primary.id ? fallback.id : null,
      },
      stt: { provider: config.stt.provider, model: config.stt.model, ready: stt.ready },
      classifier: { provider: classifier.id, ready: true },
    }),
    async structure(transmissionId, ctx, ids) {
      const outcome = await structureDictation(transmissionId, ctx, {
        primary,
        fallback,
        timeoutMs: config.llm.timeoutMs,
        ids,
        logger: overrides.logger ?? console,
      });
      return { ...outcome, content: await rateSeverity(outcome.content, classifier) };
    },
    resolvePatient: (transcript, patients, opts) =>
      resolvePatient(transcript, patients, { classifier, ...opts }),
  };
}
