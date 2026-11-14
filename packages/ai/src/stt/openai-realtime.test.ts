import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LiveSttOptions } from './live-port';
import {
  OpenAiRealtimeLiveStt,
  type RealtimeSocketFactory,
  type RealtimeSocketHandlers,
  realtimeTranscriptionUrl,
} from './openai-realtime';

/** Faux WebSocket : aucun réseau, on pilote les évènements du fournisseur à la main. */
interface FakeSocket {
  url: string;
  headers: Record<string, string>;
  handlers: RealtimeSocketHandlers;
  sent: { type: string; audio?: string; session?: unknown }[];
  closed: boolean;
  emit(event: unknown): void;
}

function fakeSockets() {
  const sockets: FakeSocket[] = [];
  const factory: RealtimeSocketFactory = (url, headers, handlers) => {
    const socket: FakeSocket = {
      url,
      headers,
      handlers,
      sent: [],
      closed: false,
      emit: (event) => handlers.onMessage(JSON.stringify(event)),
    };
    sockets.push(socket);
    return {
      send: (data) => socket.sent.push(JSON.parse(data)),
      close: () => {
        socket.closed = true;
      },
    };
  };
  return { factory, sockets };
}

function setup(batchMs = 100) {
  const { factory, sockets } = fakeSockets();
  const port = new OpenAiRealtimeLiveStt(
    { model: 'gpt-live-transcribe', apiKey: 'sk-test', baseUrl: null },
    factory,
    batchMs,
  );
  const deltas: string[] = [];
  const errors: Error[] = [];
  const onReady = vi.fn();
  const options: LiveSttOptions = {
    language: 'fr',
    prompt: 'Transmissions infirmières.',
    onReady,
    onDelta: (t) => deltas.push(t),
    onError: (e) => errors.push(e),
  };
  const session = port.open(options);
  const socket = sockets[0];
  if (!socket) throw new Error('socket non créé');
  return { port, session, socket, deltas, errors, onReady };
}

const bytes = (n: number, fill = 1) => new Uint8Array(n).fill(fill);
const DELTA = 'conversation.item.input_audio_transcription.delta';
const COMPLETED = 'conversation.item.input_audio_transcription.completed';

function sentAudio(socket: FakeSocket): number {
  return socket.sent
    .filter((m) => m.type === 'input_audio_buffer.append')
    .reduce((n, m) => n + Buffer.from(m.audio ?? '', 'base64').byteLength, 0);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('OpenAiRealtimeLiveStt', () => {
  it('ouvre une session de transcription authentifiée, sans VAD serveur', () => {
    const { port, socket, onReady } = setup();
    expect(port.id).toBe('openai-realtime:gpt-live-transcribe');
    expect(socket.url).toBe('wss://api.openai.com/v1/realtime?intent=transcription');
    expect(socket.headers).toEqual({ Authorization: 'Bearer sk-test' });
    expect(onReady).not.toHaveBeenCalled();
    socket.handlers.onOpen();
    expect(onReady).toHaveBeenCalledOnce();
    expect(socket.sent[0]).toEqual({
      type: 'session.update',
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24_000 },
            transcription: {
              model: 'gpt-live-transcribe',
              language: 'fr',
              prompt: 'Transmissions infirmières.',
            },
            turn_detection: null,
          },
        },
      },
    });
  });

  it('garde le son reçu avant l’ouverture et l’envoie après la configuration', () => {
    const { session, socket } = setup();
    session.append(bytes(1000, 7));
    session.append(bytes(2000, 8));
    expect(socket.sent).toHaveLength(0);
    socket.handlers.onOpen();
    expect(socket.sent.map((m) => m.type)).toEqual(['session.update', 'input_audio_buffer.append']);
    const audio = Buffer.from(socket.sent[1]?.audio ?? '', 'base64');
    expect(audio.byteLength).toBe(3000);
    expect(audio[0]).toBe(7);
    expect(audio[2999]).toBe(8);
  });

  it('regroupe le son par paquets d’environ 100 ms', () => {
    const { session, socket } = setup(100);
    socket.handlers.onOpen();
    // 20 ms à 24 kHz = 960 octets ; 100 ms = 4 800 octets.
    for (let i = 0; i < 10; i++) session.append(bytes(960));
    const appends = socket.sent.filter((m) => m.type === 'input_audio_buffer.append');
    expect(appends).toHaveLength(2);
    expect(sentAudio(socket)).toBe(9600);
  });

  it('n’envoie que des échantillons entiers (octet orphelin gardé pour la suite)', () => {
    const { session, socket } = setup(0);
    socket.handlers.onOpen();
    session.append(bytes(3));
    expect(sentAudio(socket)).toBe(2);
    session.append(bytes(3));
    expect(sentAudio(socket)).toBe(6);
  });

  it('relaie les deltas, ignore les évènements inconnus ou mal formés', () => {
    const { socket, deltas, errors } = setup();
    socket.handlers.onOpen();
    socket.emit({ type: 'session.updated', session: {} });
    socket.emit({ type: DELTA, item_id: 'i1', delta: 'Chambre 12,' });
    socket.emit({ type: DELTA, item_id: 'i1', delta: 42 });
    socket.emit({ type: DELTA, item_id: 'i1', delta: '' });
    socket.emit({ type: DELTA, item_id: 'i1', delta: ' FR 24' });
    expect(deltas).toEqual(['Chambre 12,', ' FR 24']);
    expect(errors).toHaveLength(0);
  });

  it('finish : envoie le reste, commit, puis attend la transcription de la fin', async () => {
    const { session, socket } = setup(1000);
    socket.handlers.onOpen();
    session.append(bytes(9600));
    let done = false;
    const finished = session.finish().then(() => {
      done = true;
    });
    expect(socket.sent.slice(-2).map((m) => m.type)).toEqual([
      'input_audio_buffer.append',
      'input_audio_buffer.commit',
    ]);
    await Promise.resolve();
    expect(done).toBe(false);
    socket.emit({ type: COMPLETED, item_id: 'i1', transcript: 'Chambre 12, FR 24.' });
    await finished;
    expect(done).toBe(true);
    session.append(bytes(4800));
    expect(sentAudio(socket)).toBe(9600);
  });

  it('finish avant l’ouverture : commit dès que la session est prête', async () => {
    const { session, socket } = setup();
    session.append(bytes(9600));
    const finished = session.finish();
    socket.handlers.onOpen();
    expect(socket.sent.map((m) => m.type)).toEqual([
      'session.update',
      'input_audio_buffer.append',
      'input_audio_buffer.commit',
    ]);
    socket.emit({ type: COMPLETED, transcript: 'ok' });
    await finished;
  });

  it('finish sans assez de son : pas de commit (refusé par le fournisseur), résolu tout de suite', async () => {
    const { session, socket } = setup();
    socket.handlers.onOpen();
    session.append(bytes(100));
    await session.finish();
    expect(socket.sent.some((m) => m.type === 'input_audio_buffer.commit')).toBe(false);
  });

  it('finish se résout au bout du délai si la fin n’arrive jamais', async () => {
    vi.useFakeTimers();
    const { session, socket } = setup();
    socket.handlers.onOpen();
    session.append(bytes(9600));
    const finished = session.finish(2000);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(finished).resolves.toBeUndefined();
  });

  it('erreur du fournisseur : signalée une fois, session fermée, finish résolu', async () => {
    const { session, socket, errors, deltas } = setup();
    socket.handlers.onOpen();
    session.append(bytes(9600));
    socket.emit({
      type: 'error',
      error: { type: 'invalid_request_error', code: 'invalid_api_key', message: 'Clé refusée' },
    });
    expect(errors.map((e) => e.message)).toEqual([
      'Erreur du fournisseur de transcription en direct (invalid_api_key : Clé refusée)',
    ]);
    expect(socket.closed).toBe(true);
    socket.emit({ type: DELTA, delta: 'trop tard' });
    socket.handlers.onError(new Error('encore'));
    session.append(bytes(9600));
    await session.finish();
    expect(errors).toHaveLength(1);
    expect(deltas).toEqual([]);
  });

  it('connexion impossible ou coupure : erreur signalée', () => {
    const refused = setup();
    refused.socket.handlers.onError(new Error('WebSocket fournisseur : connexion impossible'));
    expect(refused.errors.map((e) => e.message)).toEqual([
      'WebSocket fournisseur : connexion impossible',
    ]);

    const cut = setup();
    cut.socket.handlers.onOpen();
    cut.socket.handlers.onClose(1006, '');
    expect(cut.errors.map((e) => e.message)).toEqual(['Fournisseur déconnecté (code 1006).']);
  });

  it('message illisible du fournisseur : erreur', () => {
    const { socket, errors } = setup();
    socket.handlers.onOpen();
    socket.handlers.onMessage('pas du json');
    expect(errors).toHaveLength(1);
  });

  it('close : ferme le socket, plus aucun rappel ensuite', async () => {
    const { session, socket, deltas, errors } = setup();
    socket.handlers.onOpen();
    const finished = session.finish();
    session.close();
    await finished;
    expect(socket.closed).toBe(true);
    socket.emit({ type: DELTA, delta: 'ignoré' });
    socket.handlers.onClose(1000, '');
    expect(deltas).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('URL Realtime dérivée de STT_BASE_URL', () => {
    expect(realtimeTranscriptionUrl('https://proxy.example/v1/')).toBe(
      'wss://proxy.example/v1/realtime?intent=transcription',
    );
    expect(realtimeTranscriptionUrl('http://localhost:9000/v1')).toBe(
      'ws://localhost:9000/v1/realtime?intent=transcription',
    );
  });
});
