# @infirmier/ai

Couche IA **indépendante des fournisseurs**, côté serveur uniquement. Voir `docs/AI_PROVIDERS.md`.

- `src/llm/` : `LlmPort` + adaptateur AI SDK + registre des fournisseurs.
- `src/stt/` : `SttPort` (AI SDK, serveur compatible OpenAI, aucun).
- `src/classifier/` : `ClassifierPort` (Jev, LLM, règles).
- `src/engine/` : moteurs de structuration (LLM, heuristique) → format brut `{ text, quote }`.
- `src/pipeline/` : prompts, ancrage (`assemble`), repli (`structure`), patient, gravité.
- `src/services.ts` : assemblage à partir de la configuration (`createAiServices`).

Modifier un prompt → `pnpm sim eval` avant/après, résultat dans la PR.
