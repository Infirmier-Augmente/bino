import { describe, expect, it } from 'vitest';
import {
  createLiveClient,
  formatElapsed,
  liveFailureAction,
  liveResultText,
  liveTranscriptionUrl,
  parseLiveMessage,
} from './live-transcription';

const frame = (n: number) => new Int16Array([n]).buffer;

function setup() {
  const sent: (ArrayBuffer | string)[] = [];
  const events: string[] = [];
  const client = createLiveClient(
    { send: (d) => sent.push(d) },
    {
      onProvisional: (t) => events.push(`provisoire:${t}`),
      onFinal: (t) => events.push(`final:${t}`),
      onFailure: (m) => events.push(`échec:${m ?? '-'}`),
    },
  );
  return { client, sent, events };
}

describe('liveTranscriptionUrl', () => {
  it('http → ws, https → wss, chemin du protocole partagé', () => {
    expect(liveTranscriptionUrl('http://192.168.1.20:8787')).toBe(
      'ws://192.168.1.20:8787/transcriptions/live',
    );
    expect(liveTranscriptionUrl('https://api.demo.fr/')).toBe(
      'wss://api.demo.fr/transcriptions/live',
    );
  });
});

describe('parseLiveMessage', () => {
  it('valide les messages avec le schéma partagé', () => {
    expect(parseLiveMessage('{"type":"delta","text":" sat"}')).toEqual({
      type: 'delta',
      text: ' sat',
    });
    expect(parseLiveMessage('{"type":"inconnu"}')).toBeNull();
    expect(parseLiveMessage('pas du json')).toBeNull();
    expect(parseLiveMessage(new ArrayBuffer(2))).toBeNull();
  });
});

describe('createLiveClient', () => {
  it('garde le son capté avant l’ouverture et l’envoie dans l’ordre, arrêt compris', () => {
    const { client, sent } = setup();
    const a = frame(1);
    const b = frame(2);
    client.sendAudio(a);
    client.sendAudio(b);
    client.stop();
    client.sendAudio(frame(3)); // après l'arrêt : ignoré
    expect(sent).toEqual([]);
    client.opened();
    expect(sent).toEqual([a, b, '{"type":"stop"}']);
  });

  it('une fois ouvert, envoie directement', () => {
    const { client, sent } = setup();
    client.opened();
    const a = frame(1);
    client.sendAudio(a);
    expect(sent).toEqual([a]);
  });

  it('concatène le provisoire, puis le définitif le remplace', () => {
    const { client, events } = setup();
    client.received('{"type":"ready","engine":"openai"}');
    expect(client.ready).toBe(true);
    client.received('{"type":"delta","text":"Sat"}');
    client.received('{"type":"delta","text":" quatre-vingt-quatorze"}');
    client.received('{"type":"final","text":"Sat 94 %.","durationSec":3,"engine":"openai"}');
    client.closed();
    expect(events).toEqual([
      'provisoire:Sat',
      'provisoire:Sat quatre-vingt-quatorze',
      'final:Sat 94 %.',
    ]);
    expect(client.provisional).toBe('Sat quatre-vingt-quatorze');
  });

  it('erreur ou fermeture sans définitif : un seul échec signalé', () => {
    const { client, events } = setup();
    client.received('{"type":"error","message":"Fournisseur indisponible."}');
    client.closed();
    expect(events).toEqual(['échec:Fournisseur indisponible.']);
    const other = setup();
    other.client.closed();
    expect(other.events).toEqual(['échec:-']);
  });
});

describe('fin de la dictée en direct', () => {
  it('le définitif remplace le provisoire ; le provisoire ne sert qu’en secours', () => {
    expect(liveResultText('sat quatre-vingt-quatorze', ' Sat 94 %. ')).toBe('Sat 94 %.');
    expect(liveResultText(' sat quatre-vingt ', null)).toBe('sat quatre-vingt');
    expect(liveResultText('sat', '   ')).toBe('sat');
  });
  it('bascule sur l’enregistrement seulement si rien n’a démarré', () => {
    const base = { ready: false, stopped: false, provisional: '' };
    expect(liveFailureAction(base)).toBe('fallback');
    expect(liveFailureAction({ ...base, ready: true })).toBe('keep-provisional');
    expect(liveFailureAction({ ...base, stopped: true })).toBe('keep-provisional');
    expect(liveFailureAction({ ...base, provisional: 'Box 12' })).toBe('keep-provisional');
  });
  it('durée affichée', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(7_900)).toBe('0:07');
    expect(formatElapsed(83_000)).toBe('1:23');
    expect(formatElapsed(725_000)).toBe('12:05');
    expect(formatElapsed(-5)).toBe('0:00');
  });
});
