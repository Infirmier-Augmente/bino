import type {
  LiveSttOptions,
  LiveSttPort,
  LiveSttSession,
  SttPort,
  TranscriptionRequest,
} from '@infirmier/ai';

/**
 * Faux direct : un delta « mot<n> » par trame reçue, rattaché au segment en cours (`cut()` passe
 * au suivant) ; option : un delta EN RETARD pour le segment précédent après chaque coupure ;
 * panne simulée après `failAfterBytes`.
 */
export class FakeLiveSession implements LiveSttSession {
  bytes = 0;
  appends = 0;
  cuts = 0;
  finished = false;
  closed = false;
  private failed = false;

  constructor(
    private readonly options: LiveSttOptions,
    private readonly opts: { failAfterBytes: number | null; lateDelta: boolean },
  ) {
    setTimeout(() => options.onReady?.(), 0);
  }

  append(pcm16le: Uint8Array): void {
    if (this.failed || this.closed) return;
    this.bytes += pcm16le.byteLength;
    this.appends += 1;
    this.options.onDelta(` mot${this.appends}`, this.cuts);
    if (this.opts.failAfterBytes !== null && this.bytes >= this.opts.failAfterBytes) {
      this.failed = true;
      this.options.onError(new Error('panne simulée (clé sk-test-123 refusée)'));
    }
  }

  cut(): void {
    if (this.failed || this.closed) return;
    this.cuts += 1;
    if (this.opts.lateDelta) {
      const previous = this.cuts - 1;
      setTimeout(() => {
        if (!this.closed) this.options.onDelta(' (retard)', previous);
      }, 0);
    }
  }

  async finish(): Promise<void> {
    this.finished = true;
  }

  close(): void {
    this.closed = true;
  }
}

export class FakeLiveStt implements LiveSttPort {
  readonly id = 'fake-live';
  readonly ready = true;
  readonly sampleRate = 24_000;
  readonly sessions: FakeLiveSession[] = [];

  constructor(
    private readonly failAfterBytes: number | null = null,
    private readonly lateDelta = false,
  ) {}

  open(options: LiveSttOptions): LiveSttSession {
    const session = new FakeLiveSession(options, {
      failAfterBytes: this.failAfterBytes,
      lateDelta: this.lateDelta,
    });
    this.sessions.push(session);
    return session;
  }
}

export interface FakeFileSttOptions {
  /** Échec de l'appel n° `call` (0, 1, 2… dans l'ordre des appels, retentatives comprises). */
  fail?: (call: number, req: TranscriptionRequest) => boolean;
  /** Délai de réponse de l'appel n° `call` (ms). */
  delayMs?: (call: number, req: TranscriptionRequest) => number;
}

/** Faux STT fichier : garde les requêtes, répond « [<n> octets] » (taille du son du WAV). */
export function fakeFileStt(opts: FakeFileSttOptions = {}): SttPort & {
  requests: TranscriptionRequest[];
} {
  const requests: TranscriptionRequest[] = [];
  return {
    id: 'fake-stt',
    ready: true,
    requests,
    transcribe: async (req) => {
      const call = requests.length;
      requests.push(req);
      const delay = opts.delayMs?.(call, req) ?? 0;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      if (opts.fail?.(call, req)) throw new Error('STT 500');
      return { text: `[${req.audio.byteLength - 44} octets]`, durationSec: null };
    },
  };
}
