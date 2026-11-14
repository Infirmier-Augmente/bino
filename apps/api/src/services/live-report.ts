import type { SegmentCutReason } from '@infirmier/ai';
import type { FinalizedSegment } from './segment-finalizer';

/** Ligne de log d'une dictée en direct : durées, segments, latences, moteurs. Jamais de texte. */

export interface SegmentStat {
  reason: SegmentCutReason;
  durationSec: number;
}

export interface SessionStats {
  audioSec: number;
  bytes: number;
  wallMs: number;
  /** Moteur du direct, null s'il n'a pas pu s'ouvrir. */
  live: string | null;
  liveChars: number;
  liveError: string | null;
  segments: readonly SegmentStat[];
  results: readonly FinalizedSegment[];
  outcome: string;
}

const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
/** Au-delà, seules la médiane et le max des latences sont donnés. */
const MAX_LISTED = 12;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export function describeSession(s: SessionStats): string {
  const live = s.live
    ? `direct ${s.live} ${s.liveChars} car.${s.liveError ? ` (en panne : ${s.liveError})` : ''}`
    : `direct indisponible${s.liveError ? ` (${s.liveError})` : ''}`;
  const parts = [
    `[live] ${s.audioSec.toFixed(1)} s de son (${s.bytes} octets) en ${sec(s.wallMs)}`,
    live,
  ];
  if (s.segments.length > 0) {
    const reasons = (['pause', 'max', 'end'] as const)
      .map((r) => `${r} ${s.segments.filter((x) => x.reason === r).length}`)
      .join(', ');
    const lengths = s.segments.map((x) => x.durationSec.toFixed(1)).join('/');
    parts.push(`${s.segments.length} segments (${reasons} ; ${lengths} s)`);
  }
  const transcribed = s.results.filter((r) => r.source === 'stt');
  if (transcribed.length > 0) {
    const latencies = transcribed.map((r) => r.latencyMs);
    const each =
      transcribed.length <= MAX_LISTED
        ? `${latencies.map((l) => (l / 1000).toFixed(1)).join('/')} s, `
        : '';
    parts.push(
      `définitif après la coupure : ${each}médiane ${sec(median(latencies))}, max ${sec(Math.max(...latencies))}`,
    );
  }
  const fallbacks = s.results.filter((r) => r.source === 'provisional').length;
  if (fallbacks > 0) parts.push(`${fallbacks} repli(s) sur le provisoire`);
  parts.push(s.outcome);
  return parts.join(' · ');
}
