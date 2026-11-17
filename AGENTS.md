# AGENTS.md — à lire AVANT toute modification

> Ce fichier est lu automatiquement par les agents de code (Claude Code via `CLAUDE.md`, Codex, Cursor, Copilot…).
> Il fait aussi office de règlement pour les humains de l'équipe. **Il prime sur tes habitudes.**
> Si une règle te bloque, propose de la changer dans une PR dédiée : ne la contourne pas.

## 1. Le produit en 30 secondes

**Infirmier augmenté** (hackathon IA santé ARS × AdoptAI, défi Hôpital Foch, nov. 2026).

Martine, infirmière (IDE), 12 h de poste, relève à 7h45 et 19h45. Elle perd du temps à écrire ses
transmissions après coup, et la relève repose sur sa mémoire. Notre réponse :

1. **Dictée au fil de l'eau** : en sortant de la chambre, un bouton, elle dicte (« Box 12, extubé à 10h… »).
2. **L'IA range** : transcription → bon patient → transmissions ciblées **DAR** (Données, Actions, Résultats),
   soins de routine, « à faire » et infos transverses, **chaque phrase liée à l'extrait de dictée d'origine**.
3. **Elle valide en 1 clic** ou marque « non relue ».
4. **À la relève** : une fiche par patient est prête, la vue service est triée ★ puis Rouge → Vert.
   On ne supprime pas la relève orale, **on la prépare**.

Sources produit : `docs/PRODUCT.md` (synthèse Notion « Synthèse des échanges » + kit d'immersion Foch).

## 2. Lignes rouges (non négociables, testées)

| Règle                                                                                                                                                                    | Où c'est garanti                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| **L'IA ne décide rien.** Elle structure, résume et signale. L'IDE valide et reste responsable.                                                                           | `review.status`, rien n'est versé au dossier sans `validate` |
| **Zéro information inventée.** Toute phrase affichée a ≥ 1 source (`SourcedItem.sources`). Un extrait introuvable dans la dictée ou un chiffre modifié = phrase rejetée. | `packages/domain/src/rules/grounding.ts` + tests             |
| **Des questions, pas des verdicts.** Un manque (ex. R non renseigné) devient une question à l'IDE.                                                                       | `rules/completeness.ts`                                      |
| **La priorité est une suggestion explicable.** Chaque point a une raison ; la couleur manuelle et l'étoile ★ priment.                                                    | `rules/priority.ts`                                          |
| **Données 100 % fictives.** Aucune donnée réelle de patient, nulle part (code, tests, captures, logs).                                                                   | `packages/simulation`                                        |
| **Aucune clé d'API dans le repo.** Les clés vont dans `.env` (ignoré). Un hook bloque les commits suspects.                                                              | `scripts/check-secrets.mjs`                                  |
| **Indépendance fournisseur IA.** Aucun code métier n'importe un SDK de fournisseur. Tout passe par les ports de `@infirmier/ai`.                                         | `packages/ai/src/*/port.ts`                                  |

## 3. Carte du code

```
apps/
  api/        Serveur Hono (Node). Composition root : services métier, store, routes HTTP, simulateur, CLI.
prototypes/
  bino/       Site déployé. Téléphone et ordinateur, même pages.
packages/
  domain/     Modèle métier : schémas zod, règles PURES, contrat d'API typé + client. Zéro dépendance hors zod.
  ai/         Ports IA (LLM, speech-to-text, classifieur) + adaptateurs + pipeline (structuration DAR…).
  simulation/ Hôpital simulé : services, soignants, patients fictifs, scénarios rejouables.
e2e/          Tests Playwright du site déployé (API avec le moteur local).
docs/         Produit, architecture, workflow, IA, scénarios, design, décisions (ADR).
```

**Règles de dépendances (à respecter, elles évitent le plat de spaghettis) :**

- `domain` ne dépend de RIEN (sauf zod). Pas de `fetch`, pas d'horloge implicite, pas d'I/O : fonctions pures.
- `ai` → `domain`. Jamais l'inverse. Le métier ne connaît que les interfaces (`LlmPort`, `SttPort`, `ClassifierPort`).
- `simulation` → `domain`.
- `api` → `domain`, `ai`, `simulation`. C'est le seul endroit qui assemble tout.
- Le site (`prototypes/bino`) n'importe aucun paquet : il parle à l'API en HTTP. Les clés restent sur le mini.

## 4. Commandes

```bash
pnpm install          # une fois (installe aussi les hooks git)
cp .env.example .env  # puis renseigne tes clés (jamais commitées)
pnpm dev              # API (http://localhost:8787)
pnpm dev:api          # API seule
pnpm dev:web          # site statique (http://localhost:8080)

pnpm check            # lint + typecheck + tests unitaires/intégration : OBLIGATOIRE avant de pousser
pnpm lint:fix         # corrige le formatage (Biome)
pnpm test:e2e         # Playwright : le site contre l'API locale
pnpm live             # un appel réel OpenRouter (structuration + transcription)
pnpm sim list         # scénarios disponibles
pnpm sim run rea-box12            # rejoue un scénario et affiche la fiche de relève
pnpm sim eval                     # évalue la structuration IA sur tous les scénarios (indicateurs du kit)
```

## 5. Workflow (strict)

1. **Une tâche = une branche** courte : `feat/<sujet>`, `fix/<sujet>`, `docs/<sujet>` depuis `main` à jour.
2. **Commits Conventional Commits** avec scope (vérifié par commitlint) :
   `feat(mobile): …`, `fix(ai): …`, `test(api): …`, `docs(docs): …`.
   Scopes autorisés : `domain`, `ai`, `simulation`, `api`, `mobile`, `e2e`, `docs`, `ci`, `repo`, `deps`.
3. **Hooks automatiques** : pre-commit (Biome + détection de secrets), commit-msg (commitlint), pre-push (typecheck + tests).
   Ne jamais utiliser `--no-verify`.
4. **PR obligatoire vers `main`**, petite (< 400 lignes hors tests/données si possible), template rempli,
   CI verte, **1 relecture** par une autre personne. Pas de push direct sur `main`.
5. **Definition of Done** : code typé (aucun `any`), tests ajoutés au bon niveau (voir §7), `pnpm check` vert,
   doc mise à jour si tu changes un comportement visible ou une règle, captures d'écran dans la PR si UI.
6. Conflit sur un fichier partagé (`contract.ts`, `routes.ts`, schémas) : rebase tôt, souvent.

## 6. Recettes (où modifier quoi)

| Je veux…                         | Fichiers                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ajouter un endpoint              | `packages/domain/src/api/contract.ts` → `apps/api/src/http/routes.ts` → test d'intégration `apps/api/src/http/*.test.ts` → appel mobile `api.<nom>()` |
| Changer un champ métier          | schéma zod dans `packages/domain/src/schemas/*` → corriger les erreurs TS qui apparaissent → adapter les fixtures de `packages/simulation`            |
| Ajouter un fournisseur LLM / STT | `packages/ai/src/llm/providers.ts` ou `packages/ai/src/stt/*` + doc `docs/AI_PROVIDERS.md`. Rien d'autre ne bouge.                                    |
| Modifier les prompts             | `packages/ai/src/pipeline/prompts.ts` puis `pnpm sim eval` pour comparer avant/après                                                                  |
| Ajuster la priorisation          | `PRIORITY_WEIGHTS` dans `packages/domain/src/rules/priority.ts` + tests                                                                               |
| Enrichir le lexique soignant     | `packages/domain/src/rules/lexicon.ts` (profite au prompt, au STT et au moteur de secours)                                                            |
| Ajouter un scénario              | `packages/simulation/src/scenarios/*.ts` + l'enregistrer dans `index.ts` (voir `docs/SCENARIOS.md`)                                                   |
| Ajouter un écran                 | `prototypes/bino` (HTML, `js/views.js`, `css/styles.css`) ; voir `docs/DESIGN.md`                                                                    |

## 7. Tests : quoi tester, où

| Niveau      | Outil                              | Où                                  | Quand                                                                    |
| ----------- | ---------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| Unitaire    | Vitest                             | `packages/*/src/**/*.test.ts`       | Toute règle métier, tout parsing, tout adaptateur IA (avec faux `fetch`) |
| Intégration | Vitest + `app.request()`           | `apps/api/src/**/*.test.ts`         | Tout endpoint : vraie pile HTTP + store en mémoire + IA heuristique      |
| Scénarios   | Vitest                             | `apps/api/src/simulation/*.test.ts` | Les scénarios de démo restent rejouables et cohérents                    |
| E2E         | Playwright                         | `e2e/proto/*.spec.ts`               | Parcours du site : connexion, liste, dictée, validation                  |
| IA réelle   | `pnpm live`                        | `apps/api/src/cli/live.ts`          | Job CI : une structuration et une transcription OpenRouter               |

Les tests unitaires, d'intégration et de bout en bout n'appellent pas de fournisseur. Ils utilisent le moteur
`heuristic` ou des faux. Le job « IA réelle (OpenRouter) » est le seul appel réseau, et `pnpm sim eval`
reste l'évaluation locale des scénarios.

## 8. Conventions de code

- TypeScript **strict** partout (`noUncheckedIndexedAccess`), **pas de `any`**, pas de `!` non-null.
- **zod aux frontières** (HTTP, env, LLM, fichiers) ; à l'intérieur, on fait confiance aux types.
- Vocabulaire métier en français dans le domaine (`cible`, `releve`, `appareil`, `DAR`) ; le reste en anglais.
- **Textes UI en français**, phrases courtes, tutoiement entre soignants (« Valider », « Dicter »).
- Fichiers < ~300 lignes ; une fonction = une responsabilité ; pas de logique métier dans les composants React
  (elle va dans `domain` ou dans un hook).
- Dates : ISO 8601 avec fuseau. Heure locale du service via `rules/time.ts` (jamais `new Date().getHours()`).
- Pas de nouvelle dépendance sans justification dans la PR.

## 9. Design (résumé, détail dans `docs/DESIGN.md`)

Interface clinique, calme, lisible après 12 h de poste. Police **Atkinson Hyperlegible** (conçue pour la
lisibilité). Couleurs de triage réservées au triage, toujours doublées d'un libellé. Interdits (« AI slop ») :
dégradés violets, glassmorphism, texte en dégradé, cartes imbriquées, bordure latérale colorée décorative,
icône dans un carré au-dessus d'un titre, emoji décoratifs, point qui pulse sans raison, Inter partout,
promesses marketing (« révolutionnaire », « boostez »). Animer uniquement une activité réelle (enregistrement).

## 10. Consignes spécifiques aux agents IA

- Lis ce fichier, puis le `README.md` du package que tu modifies.
- Avant de dire « fini » : `pnpm check` doit passer. Si tu touches l'UI : `pnpm test:e2e`.
- Ne modifie pas les lignes rouges (§2) ni ce fichier sans demande explicite.
- Ne touche jamais à `.env`, aux clés, ni aux dossiers `ios/` `android/` (générés).
- Préfère modifier une règle pure + son test plutôt que d'ajouter de la logique dans un écran.
