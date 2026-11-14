import type {
  LiveSttOptions,
  LiveSttPort,
  LiveSttSession,
  SttPort,
  TranscriptionRequest,
} from '@infirmier/ai';

/** Faux direct : un delta « mot<n> » par trame reçue ; panne simulée après `failAfterBytes`. */
export class FakeLiveSession implements LiveSttSession {
  bytes = 0;
  appends = 0;
  finished = false;
  closed = false;
  private failed = false;

  constructor(
    private readonly options: LiveSttOptions,
    private readonly failAfterBytes: number | null,
  ) {
    setTimeout(() => options.onReady?.(), 0);
  }

  append(pcm16le: Uint8Array): void {
    if (this.failed || this.closed) return;
    this.bytes += pcm16le.byteLength;
    this.appends += 1;
    this.options.onDelta(` mot${this.appends}`);
    if (this.failAfterBytes !== null && this.bytes >= this.failAfterBytes) {
      this.failed = true;
      this.options.onError(new Error('panne simulée (clé sk-test-123 refusée)'));
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

  constructor(private readonly failAfterBytes: number | null = null) {}

  open(options: LiveSttOptions): LiveSttSession {
    const session = new FakeLiveSession(options, this.failAfterBytes);
    this.sessions.push(session);
    return session;
  }
}

/** Faux STT fichier : garde les requêtes, répond « Texte final (<n> octets de son) ». */
export function fakeFileStt(opts: { fail?: boolean } = {}): SttPort & {
  requests: TranscriptionRequest[];
} {
  const requests: TranscriptionRequest[] = [];
  return {
    id: 'fake-stt',
    ready: true,
    requests,
    transcribe: async (req) => {
      requests.push(req);
      if (opts.fail) throw new Error('STT 500');
      return {
        text: `Texte final (${req.audio.byteLength - 44} octets de son)`,
        durationSec: null,
      };
    },
  };
}
