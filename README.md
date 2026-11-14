# Infirmier augmenté

> Martine dicte ses transmissions en sortant de la chambre. L'IA les range en transmissions ciblées
> **DAR**, chaque phrase liée à l'extrait de dictée d'origine. Elle valide d'un geste. À la relève de
> 19h45, la fiche de chaque patient est prête et le service est trié par priorité.
> **On ne remplace pas la relève : on la prépare.**

Hackathon IA santé ARS × AdoptAI (13–15 nov. 2026) · défi Hôpital Foch « infirmier augmenté ».
Données **100 % fictives**.

## Démarrer en 3 commandes

```bash
pnpm install
```

```bash
cp .env.example .env
```

```bash
pnpm dev
```

- API : http://localhost:8787 (au premier démarrage, une journée de réanimation fictive est rejouée).
- App web : appuie sur `w` dans le terminal Expo (ou `pnpm dev:web`). Sur téléphone : scanne le QR code avec **Expo Go** (même Wi-Fi).
- Sans clé d'API, l'IA tourne en **moteur local** (déterministe). Pour l'IA réelle, renseigne `LLM_PROVIDER` / `LLM_API_KEY` dans `.env` (voir [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md)).

Prérequis : Node ≥ 22.12 et pnpm (`corepack enable`).

## Ce que fait le produit

| Moment | Ce que voit l'infirmière | Où dans le code |
| --- | --- | --- |
| Entre deux chambres | Un bouton **Dicter**, le texte s'affiche pendant qu'elle parle | `apps/mobile/src/app/dictee.tsx` |
| Juste après | Transmissions **DAR** rangées, R manquant posé en **question**, chaque phrase renvoie à son extrait | `apps/mobile/src/app/transmission/[transmissionId].tsx`, `packages/ai` |
| 1 geste | **Valider** (versé au dossier) ou **Plus tard** (« non relue ») | `apps/api/src/services/hospital-service.ts` |
| Entrée d'un patient | Dictée libre → **macro-cible d'entrée** (le blocage « pas de cible adaptée » disparaît) | `apps/mobile/src/app/admission.tsx` |
| À la relève | **Vue service** triée ★ puis Rouge → Vert (suggestion expliquée), **fiche par patient** (exemple B du kit), récap « taille SMS », mode réunion sur grand écran | `apps/mobile/src/app/(app)/releve.tsx`, `packages/domain/src/rules/handover.ts` |
| Intégration | Export **FHIR R4** vers un DPI simulé | `packages/domain/src/interop/fhir.ts` |
| Démo / tests | **Simulateur** d'hôpital : journées rejouables, évaluation de l'IA | `packages/simulation`, `pnpm sim` |

## Lignes rouges (testées)

1. **L'IA ne décide rien** : elle structure, résume, signale. L'IDE valide et reste responsable.
2. **Zéro information inventée** : un extrait introuvable dans la dictée ou un chiffre modifié = phrase écartée.
3. **Des questions, pas des verdicts** (« Résultat non renseigné : quelle réévaluation ? »).
4. **Aucune dépendance à un fournisseur d'IA** : DeepSeek, OpenAI, Mistral, Anthropic, Google, Groq, Ollama, OVHcloud, Scaleway, Jev… se changent dans `.env`.

## Commandes utiles

```bash
pnpm check                 # lint + types + tests (obligatoire avant de pousser)
pnpm test:e2e              # parcours Playwright (lance API + app web)
pnpm sim list              # scénarios de l'hôpital simulé
pnpm sim run rea-box12     # rejoue une journée et affiche la relève dans le terminal
pnpm sim eval              # évalue l'IA (bon patient, DAR, R manquant, zéro invention)
```

## Documentation

| Fichier | Pour quoi |
| --- | --- |
| [AGENTS.md](AGENTS.md) | **À lire en premier** (humains et agents de code) : règles, carte du code, workflow |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Le problème, Martine, le parcours, le périmètre MVP / V2 / vision |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Comment c'est construit et pourquoi |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | Travailler à 7+ sans se marcher dessus : branches, PR, tests, chantiers parallèles |
| [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md) | Brancher un LLM, un speech-to-text, un classifieur (Jev) |
| [docs/SCENARIOS.md](docs/SCENARIOS.md) | Le simulateur d'hôpital, écrire un scénario, évaluer l'IA |
| [docs/DESIGN.md](docs/DESIGN.md) | Principes d'interface, tokens, ce qu'on s'interdit |
| [docs/DEMO.md](docs/DEMO.md) | Script de démo pour le jury |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Journal des décisions d'architecture et produit |
