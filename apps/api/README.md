# @infirmier/api

Serveur Hono (Node) : composition des services métier, store JSON, pipeline IA, simulateur, CLI.

- `src/http/` : contrat appliqué (`contract-adapter.ts`), handlers (`routes.ts`), upload audio.
- `src/services/` : cas d'usage (`hospital-service.ts`), simulateur, horloge.
- `src/store/` : état de l'hôpital (JSON validé zod).
- `src/cli/sim.ts` + `src/eval/` : `pnpm sim list | run | eval`.
- Tests d'intégration : `src/http/*.test.ts` via `createTestApp()` (IA locale, horloge figée).

`pnpm dev:api` (rechargement à chaud). Variables : voir `.env.example`.
