import type { AddressInfo } from 'node:net';
import type { AiOverrides } from '@infirmier/ai';
import { LIVE_TRANSCRIPTION_PATH, LiveServerMessage } from '@infirmier/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { startServer } from '../server';
import { FakeLiveStt, fakeFileStt } from '../testing/fake-live';
import { createTestApp } from '../testing/test-app';

/**
 * Tests d'intégration de GET /transcriptions/live : vrai serveur Node sur un port éphémère,
 * vrai client WebSocket, ports IA factices (aucun fournisseur appelé).
 */

const servers: { close(cb?: () => void): unknown; closeAllConnections?: () => void }[] = [];

afterEach(async () => {
  for (const s of servers.splice(0)) {
    s.closeAllConnections?.();
    await new Promise<void>((resolve) => s.close(() => resolve()));
  }
});

async function serveApp(ai: AiOverrides): Promise<string> {
  const { app } = createTestApp({ ai });
  const port = await new Promise<number>((resolve) => {
    const server = startServer(app, { port: 0, hostname: '127.0.0.1' }, (info: AddressInfo) =>
      resolve(info.port),
    );
    servers.push(server);
  });
  return `ws://127.0.0.1:${port}${LIVE_TRANSCRIPTION_PATH}`;
}

interface Client {
  ws: WebSocket;
  messages: LiveServerMessage[];
  closed: Promise<{ code: number; reason: string }>;
  waitFor(type: LiveServerMessage['type']): Promise<LiveServerMessage>;
}

async function connect(url: string): Promise<Client> {
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  const messages: LiveServerMessage[] = [];
  const listeners: (() => void)[] = [];
  ws.onmessage = (ev) => {
    messages.push(LiveServerMessage.parse(JSON.parse(String(ev.data))));
    for (const l of listeners) l();
  };
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    ws.onclose = (ev) => resolve({ code: ev.code, reason: ev.reason });
  });
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error('connexion WebSocket impossible'));
  });
  const waitFor = (type: LiveServerMessage['type']) =>
    new Promise<LiveServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`pas de message « ${type} »`)), 2000);
      const check = () => {
        const found = messages.find((m) => m.type === type);
        if (!found) return;
        clearTimeout(timer);
        resolve(found);
      };
      listeners.push(check);
      check();
    });
  return { ws, messages, closed, waitFor };
}

/** 100 ms de son PCM16 24 kHz mono. */
const frame = (fill = 1) => new Uint8Array(4800).fill(fill);

async function until(cond: () => boolean): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > 2000) throw new Error('condition jamais atteinte');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('GET /transcriptions/live (WebSocket)', () => {
  it('relaie le texte provisoire, puis remplace par la transcription de tout le son', async () => {
    const live = new FakeLiveStt();
    const stt = fakeFileStt();
    const client = await connect(await serveApp({ liveStt: live, stt }));
    // Le son part tout de suite, sans attendre « ready » (il est gardé côté serveur).
    for (let i = 0; i < 3; i++) client.ws.send(frame(i + 1));
    expect(await client.waitFor('ready')).toEqual({ type: 'ready', engine: 'fake-live' });
    await until(() => client.messages.filter((m) => m.type === 'delta').length === 3);
    expect(client.messages.filter((m) => m.type === 'delta').map((m) => m.text)).toEqual([
      ' mot1',
      ' mot2',
      ' mot3',
    ]);

    client.ws.send(JSON.stringify({ type: 'stop' }));
    expect(await client.waitFor('final')).toEqual({
      type: 'final',
      text: 'Texte final (14400 octets de son)',
      durationSec: 0.3,
      engine: 'fake-stt',
    });
    expect(await client.closed).toEqual({ code: 1000, reason: 'final' });

    const req = stt.requests[0];
    expect(req?.mimeType).toBe('audio/wav');
    expect(req?.language).toBe('fr');
    expect(req?.prompt).toMatch(/^Transmissions infirmières\. Vocabulaire : /);
    const wav = req?.audio ?? new Uint8Array();
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF');
    expect([wav[44], wav[44 + 4800], wav[44 + 9600]]).toEqual([1, 2, 3]);
    const session = live.sessions[0];
    expect(session).toMatchObject({ bytes: 14400, finished: true, closed: true });
  });

  it('sans direct configuré : « error » puis fermeture (l’app repasse par POST /transcriptions)', async () => {
    const stt = fakeFileStt();
    const client = await connect(await serveApp({ stt }));
    const error = await client.waitFor('error');
    expect(error).toMatchObject({ type: 'error', message: expect.stringMatching(/en direct/) });
    expect((await client.closed).code).toBe(1011);
    expect(stt.requests).toHaveLength(0);
  });

  it('panne du direct en cours de dictée : le son est gardé, « final » arrive quand même', async () => {
    const live = new FakeLiveStt(4800);
    const stt = fakeFileStt();
    const client = await connect(await serveApp({ liveStt: live, stt }));
    for (let i = 0; i < 4; i++) client.ws.send(frame());
    client.ws.send(JSON.stringify({ type: 'stop' }));
    const final = await client.waitFor('final');
    expect(final).toMatchObject({ text: 'Texte final (19200 octets de son)', engine: 'fake-stt' });
    expect(client.messages.filter((m) => m.type === 'delta')).toHaveLength(1);
    expect(client.messages.some((m) => m.type === 'error')).toBe(false);
    expect(live.sessions[0]?.bytes).toBe(4800);
  });

  it('message texte inconnu ignoré ; échec de la transcription finale → « error »', async () => {
    const stt = fakeFileStt({ fail: true });
    const client = await connect(await serveApp({ liveStt: new FakeLiveStt(), stt }));
    client.ws.send(frame());
    client.ws.send('{"type":"pause"}');
    client.ws.send('pas du json');
    client.ws.send(JSON.stringify({ type: 'stop' }));
    const error = await client.waitFor('error');
    expect(error).toMatchObject({ message: expect.stringMatching(/texte provisoire/) });
    expect((await client.closed).code).toBe(1011);
    expect(stt.requests).toHaveLength(1);
  });

  it('l’app se déconnecte avant l’arrêt : tout est libéré, rien n’est transcrit', async () => {
    const live = new FakeLiveStt();
    const stt = fakeFileStt();
    const client = await connect(await serveApp({ liveStt: live, stt }));
    client.ws.send(frame());
    await client.waitFor('delta');
    client.ws.close();
    await until(() => live.sessions[0]?.closed === true);
    expect(stt.requests).toHaveLength(0);
  });

  it('sans WebSocket : 426 ; /config expose l’état du direct', async () => {
    const { app, client } = createTestApp({ ai: { liveStt: new FakeLiveStt() } });
    const res = await app.request(LIVE_TRANSCRIPTION_PATH);
    expect(res.status).toBe(426);
    expect((await client.config()).sttLive).toEqual({ provider: 'none', model: null, ready: true });
    const offline = createTestApp();
    expect((await offline.client.config()).sttLive.ready).toBe(false);
  });
});
