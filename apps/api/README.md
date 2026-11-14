# @infirmier/api

Serveur Hono (Node) : composition des services métier, store JSON, pipeline IA, simulateur, CLI.

- `src/http/` : contrat appliqué (`contract-adapter.ts`), handlers (`routes.ts`), upload audio,
  dictée en direct (`live-transcription.ts`, WebSocket hors contrat ; logique dans
  `src/services/live-dictation.ts`).
- `src/server.ts` : serveur Node avec WebSocket (`ws`), utilisé par `main.ts` et les tests de la dictée en direct.
- `src/services/` : cas d'usage (`hospital-service.ts`), simulateur, horloge.
- `src/store/` : état de l'hôpital (JSON validé zod).
- `src/cli/sim.ts` + `src/eval/` : `pnpm sim list | run | eval`.
- Tests d'intégration : `src/http/*.test.ts` via `createTestApp()` (IA locale, horloge figée).

`pnpm dev:api` (rechargement à chaud). Variables : voir `.env.example`.
