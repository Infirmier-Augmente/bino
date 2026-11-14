import { upgradeWebSocket } from '@hono/node-server';
import type { LiveSttPort, SttPort } from '@infirmier/ai';
import { LIVE_TRANSCRIPTION_PATH } from '@infirmier/domain';
import type { Hono } from 'hono';
import { LiveDictation } from '../services/live-dictation';
import { dictationPrompt } from './transcription';

const OPEN = 1;

export interface LiveTranscriptionDeps {
  live: LiveSttPort;
  stt: SttPort;
  log?: (line: string) => void;
}

/**
 * GET /transcriptions/live (WebSocket) : dictée en direct, protocole dans
 * `packages/domain/src/api/live-transcription.ts`. Nécessite le serveur Node de `server.ts`
 * (`app.request()` ne sait pas ouvrir de WebSocket). Sans WebSocket : 426.
 */
export function registerLiveTranscription(app: Hono, deps: LiveTranscriptionDeps): void {
  app.get(
    LIVE_TRANSCRIPTION_PATH,
    upgradeWebSocket(() => {
      let dictation: LiveDictation | null = null;
      return {
        onOpen: (_event, ws) => {
          dictation = new LiveDictation({
            live: deps.live,
            stt: deps.stt,
            prompt: dictationPrompt(),
            log: deps.log,
            send: (message) => {
              if (ws.readyState === OPEN) ws.send(JSON.stringify(message));
            },
            close: (code, reason) => {
              if (ws.readyState === OPEN) ws.close(code, reason);
            },
          });
          dictation.start();
        },
        onMessage: (event) => {
          const data = event.data;
          if (typeof data === 'string') dictation?.onText(data);
          else if (!(data instanceof Blob)) dictation?.onAudio(new Uint8Array(data));
        },
        onClose: () => dictation?.onClientClose(),
        onError: () => dictation?.onClientClose(),
      };
    }),
    (c) =>
      c.json(
        {
          error: {
            code: 'websocket-required',
            message: `Connexion WebSocket attendue sur ${LIVE_TRANSCRIPTION_PATH}.`,
          },
        },
        426,
      ),
  );
}
