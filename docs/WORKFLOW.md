# Workflow d'équipe

Objectif : 7 à 10 personnes qui avancent vite **sans casser ce qui marche**. Les règles courtes sont
dans [AGENTS.md](../AGENTS.md) §5 ; ici le détail.

## Le cycle d'une tâche

1. Prendre une tâche dans le kanban Notion (2 « En cours » max par personne).
2. `git switch main && git pull && git switch -c feat/<sujet-court>`
3. Coder **petit** : une PR = une intention. Si ça dépasse ~400 lignes hors données/tests, découper.
4. Tests au bon niveau (voir tableau ci-dessous), puis `pnpm check`.
5. Commit Conventional Commits : `feat(mobile): …`, `fix(ai): …` (commitlint refuse sinon).
6. `git push -u origin feat/<sujet>` → PR vers `main`, template rempli, captures si UI.
7. CI verte + 1 relecture → merge (squash). Supprimer la branche.

Les hooks (lefthook) s'installent avec `pnpm install` : Biome + détection de secrets au commit,
commitlint, typecheck + tests au push. **Ne jamais contourner avec `--no-verify`.**

À configurer une fois par le propriétaire du dépôt GitHub : protection de `main`
(PR obligatoire, CI `check` et `e2e` requises, 1 approbation, pas de push direct).

## Quel test écrire ?

| Je modifie… | Test minimal attendu |
| --- | --- |
| Une règle métier (`packages/domain`) | Unitaire Vitest à côté du fichier |
| Le pipeline IA, un prompt, un adaptateur | Unitaire avec faux LLM/fetch + `pnpm sim eval` avant/après dans la PR |
| Un endpoint / un service | Intégration `apps/api/src/http/*.test.ts` via le client typé |
| Un scénario | Rien à écrire : `scenarios.test.ts` valide tout scénario enregistré |
| Un écran / un parcours | E2E Playwright si parcours critique ; logique extraite dans `src/lib` + test Vitest |

## Chantiers parallèles conseillés (peu de conflits)

| Chantier | Fichiers principaux | Profil |
| --- | --- | --- |
| Qualité IA (prompts, eval) | `packages/ai/src/pipeline/prompts.ts`, scénarios | data / NLP |
| Moteur local (règles) | `packages/ai/src/engine/heuristic/*`, `domain/rules/lexicon.ts` | dev back |
| Continuité des cibles entre dictées | `apps/api/src/services/hospital-service.ts`, `packages/ai` | dev back |
| Dictée | `prototypes/bino/js/services/voice.js` et `POST /transcriptions` | navigateur + API |
| Vue relève | `prototypes/bino/js/views.js` | site |
| Scénarios et jeux de test terrain | `packages/simulation/src/scenarios/*` | profil soignant + dev |
| Pitch / démo | `docs/DEMO.md`, simulateur | produit / design |

Fichiers « carrefour » (beaucoup de monde y touche) : `contract.ts`, `routes.ts`, `schemas/*`.
Faire des PR courtes dessus et rebaser souvent.

## Revue de code : quoi regarder

- Les lignes rouges (AGENTS.md §2) tiennent-elles ? Une phrase affichée sans source = refus.
- Les types : pas de `any`, pas de `!`, zod aux frontières.
- Le texte UI : français simple, tutoiement, pas de jargon technique, pas de promesse marketing.
- Les tests couvrent le comportement, pas l'implémentation.

## Agents de code

Claude Code lit `CLAUDE.md` (qui importe `AGENTS.md`), Codex/Cursor lisent `AGENTS.md`,
Copilot lit `.github/copilot-instructions.md`. Un agent suit le même workflow qu'un humain :
branche, tests, `pnpm check`, PR. Demande-lui toujours le résultat de `pnpm check` avant de relire.
