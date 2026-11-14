import type { Flag, RejectedStatement, TransmissionContent } from '@infirmier/domain';
import type { StructuringContext, StructuringEngine } from '../engine/raw';
import { assemble, type IdFactory, randomIds } from './assemble';

export interface StructureOutcome {
  content: TransmissionContent;
  flags: Flag[];
  rejected: RejectedStatement[];
  engine: string;
  degraded: boolean;
  durationMs: number;
  error: string | null;
}

export interface StructureOptions {
  primary: StructuringEngine;
  fallback: StructuringEngine | null;
  timeoutMs: number;
  ids?: IdFactory;
  logger?: Pick<Console, 'warn'>;
}

/**
 * Structure une dictée : moteur principal (LLM) avec délai max, puis repli
 * automatique sur le moteur local si besoin. L'IDE voit toujours un résultat,
 * et l'UI signale le "mode dégradé".
 */
export async function structureDictation(
  transmissionId: string,
  ctx: StructuringContext,
  opts: StructureOptions,
): Promise<StructureOutcome> {
  const t0 = Date.now();
  const ids = opts.ids ?? randomIds;
  try {
    const raw = await opts.primary.structure(ctx, AbortSignal.timeout(opts.timeoutMs));
    const r = assemble(raw, transmissionId, ctx.transcript, ids);
    return {
      ...r,
      engine: opts.primary.id,
      degraded: false,
      durationMs: Date.now() - t0,
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!opts.fallback || opts.fallback.id === opts.primary.id) throw e;
    opts.logger?.warn(
      `[ai] ${opts.primary.id} indisponible (${message}) → repli ${opts.fallback.id}`,
    );
    const raw = await opts.fallback.structure(ctx);
    const r = assemble(raw, transmissionId, ctx.transcript, ids);
    return {
      ...r,
      engine: opts.fallback.id,
      degraded: true,
      durationMs: Date.now() - t0,
      error: message,
    };
  }
}
