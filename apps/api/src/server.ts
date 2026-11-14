import type { AddressInfo } from 'node:net';
import { type ServerType, serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';

/** Taille max d'une trame WebSocket reçue (100 ms de son = 4,8 ko : la marge est large). */
export const MAX_WS_FRAME_BYTES = 1024 * 1024;

type FetchCallback = Parameters<typeof serve>[0]['fetch'];

/**
 * Serveur HTTP Node de l'API, avec la prise en charge des WebSocket (dictée en direct).
 * Utilisé par `main.ts` et par les tests d'intégration qui ont besoin d'un vrai port.
 */
export function startServer(
  app: { fetch: FetchCallback },
  options: { port: number; hostname?: string },
  onListening?: (info: AddressInfo) => void,
): ServerType {
  return serve(
    {
      fetch: app.fetch,
      port: options.port,
      hostname: options.hostname,
      websocket: {
        server: new WebSocketServer({ noServer: true, maxPayload: MAX_WS_FRAME_BYTES }),
      },
    },
    onListening,
  );
}
