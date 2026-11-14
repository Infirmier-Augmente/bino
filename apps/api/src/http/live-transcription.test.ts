import type { AddressInfo } from 'node:net';
import type { AiOverrides } from '@infirmier/ai';
import { LIVE_TRANSCRIPTION_PATH, LiveServerMessage } from '@infirmier/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { startServer } from '../server';
import { bytesOf, frames, pcm, quiet, voice } from '../testing/fake-audio';
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

const STOP = JSON.stringify({ type: 'stop' });
/**
 * Deux phrases séparées d'une pause d'1 s : segment 0 = 4,2 s (au-delà du minimum de 3 s, coupé
 * 0,7 s après le début de la pause), segment 1 = 2,3 s (le dernier peut être plus court).
 */
const FIRST = pcm(voice(3500), quiet(1000));
const SECOND = pcm(voice(2000));

async function until(cond: () => boolean): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > 2000) throw new Error('condition jamais atteinte');
    await new Promise((r) => setTimeout(r, 10));
  }
}

const send = (client: Client, audio: Uint8Array) => {
  for (const f of frames(audio)) client.ws.send(f);
};

describe('GET /transcriptions/live (WebSocket)', () => {
  it('provisoire par segment, segment définitif PENDANT la dictée, puis final', async () => {
    const live = new FakeLiveStt();
    const stt = fakeFileStt();
    const client = await connect(await serveApp({ liveStt: live, stt }));
    // Le son part tout de suite, sans attendre « ready » (il est gardé côté serveur).
    send(client, FIRST);
    expect(await client.waitFor('ready')).toEqual({ type: 'ready', engine: 'fake-live' });
    expect(await client.waitFor('segment')).toEqual({
      type: 'segment',
      segment: 0,
      text: `[${bytesOf(4200)} octets]`,
      engine: 'fake-stt',
    });
    send(client, SECOND);
    await until(() => client.messages.filter((m) => m.type === 'delta').length === 65);
    client.ws.send(STOP);
    expect(await client.waitFor('final')).toEqual({
      type: 'final',
      text: `[${bytesOf(4200)} octets] [${bytesOf(2300)} octets]`,
      durationSec: 6.5,
      engine: 'fake-stt',
    });
    expect(await client.closed).toEqual({ code: 1000, reason: 'final' });

    const bySegment = (n: number) =>
      client.messages.filter((m) => m.type === 'delta' && m.segment === n).length;
    expect([bySegment(0), bySegment(1)]).toEqual([42, 23]);
    expect(client.messages.filter((m) => m.type === 'segment').map((m) => m.segment)).toEqual([
      0, 1,
    ]);
    const req = stt.requests[1];
    expect(req?.mimeType).toBe('audio/wav');
    expect(req?.language).toBe('fr');
    expect(req?.prompt).toMatch(
      /^Transmissions infirmières\. Vocabulaire : .*\n\n\[201600 octets\]$/s,
    );
    expect(String.fromCharCode(...(req?.audio ?? new Uint8Array()).subarray(0, 4))).toBe('RIFF');
    expect(live.sessions[0]).toMatchObject({ cuts: 1, finished: true, closed: true });
  });

  it('sans direct configuré : « error » puis fermeture (l’app repasse par POST /transcriptions)', async () => {
    const stt = fakeFileStt();
    const client = await connect(await serveApp({ stt }));
    const error = await client.waitFor('error');
    expect(error).toMatchObject({ type: 'error', message: expect.stringMatching(/en direct/) });
    expect((await client.closed).code).toBe(1011);
    expect(stt.requests).toHaveLength(0);
  });

  it('panne du direct en cours de dictée : les segments sont quand même finalisés', async () => {
    const live = new FakeLiveStt(4800);
    const stt = fakeFileStt();
    const client = await connect(await serveApp({ liveStt: live, stt }));
    send(client, FIRST);
    send(client, SECOND);
    client.ws.send(STOP);
    const final = await client.waitFor('final');
    expect(final).toMatchObject({
      text: `[${bytesOf(4200)} octets] [${bytesOf(2300)} octets]`,
      engine: 'fake-stt',
    });
    expect(client.messages.filter((m) => m.type === 'delta')).toHaveLength(1);
    expect(client.messages.some((m) => m.type === 'error')).toBe(false);
    expect(live.sessions[0]?.bytes).toBe(4800);
  });

  it('message texte inconnu ignoré ; transcription en échec → texte provisoire, pas d’erreur', async () => {
    const stt = fakeFileStt({ fail: () => true });
    const client = await connect(await serveApp({ liveStt: new FakeLiveStt(), stt }));
    send(client, pcm(voice(300)));
    client.ws.send('{"type":"pause"}');
    client.ws.send('pas du json');
    client.ws.send(STOP);
    expect(await client.waitFor('segment')).toEqual({
      type: 'segment',
      segment: 0,
      text: 'mot1 mot2 mot3',
      engine: 'fake-live',
    });
    expect(await client.waitFor('final')).toMatchObject({ text: 'mot1 mot2 mot3' });
    expect((await client.closed).code).toBe(1000);
    expect(stt.requests).toHaveLength(2);
  });

  it('l’app se déconnecte avant l’arrêt : tout est libéré, rien n’est transcrit', async () => {
    const live = new FakeLiveStt();
    const stt = fakeFileStt();
    const client = await connect(await serveApp({ liveStt: live, stt }));
    send(client, pcm(voice(100)));
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
