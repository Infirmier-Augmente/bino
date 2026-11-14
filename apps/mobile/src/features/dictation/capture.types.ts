/** Capture du micro en PCM 16 bits mono 24 kHz (dictée en direct), commune web et natif. */
export interface PcmCaptureHandlers {
  /** Trame PCM 16 bits little-endian, mono, 24 kHz (~100 ms). */
  onChunk(chunk: ArrayBuffer): void;
  /** Niveau du micro, de 0 (silence) à 1 (voix forte), à chaque morceau capté. */
  onLevel(level: number): void;
}

export type CaptureErrorKind = 'refused' | 'unavailable';

/** Échec de démarrage du micro : refusé par l'IDE, ou indisponible sur cet appareil. */
export class CaptureError extends Error {
  constructor(readonly kind: CaptureErrorKind) {
    super(kind === 'refused' ? 'Micro refusé' : 'Micro indisponible');
  }
}

export interface PcmCapture {
  /** Démarre le micro ; rejette avec une `CaptureError`. */
  start(handlers: PcmCaptureHandlers): Promise<void>;
  /** Arrête le micro (même pendant le démarrage) ; le son restant passe à `onChunk` avant. */
  stop(): void;
}
