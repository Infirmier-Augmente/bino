# Infirmier augmenté

> En sortant de la chambre, Martine ouvre la fiche du patient et écrit ou dicte son compte rendu.
> L'IA le range en transmissions ciblées **DAR**, chaque élément lié à l'extrait d'origine, et le
> laisse « à relire ». À la relève, l'onglet **Tous** montre une carte par patient : des puces
> sourcées (qui, à quelle heure), le résultat manquant posé en question et une priorité de 1 à 4
> qu'elle peut changer.
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

- API : http://localhost:8787. Au premier démarrage (sans `.data/state.json` valide), une journée de
  chirurgie fictive est rejouée (scénario `chir-bino`, 11 patients, 3 IDE).
- App web : appuie sur `w` dans le terminal Expo (ou `pnpm dev:web`). Sur téléphone : scanne le QR code avec **Expo Go** (même Wi-Fi).
  Dans un navigateur de téléphone, le micro exige HTTPS (voir [docs/DEMO.md](docs/DEMO.md)).
- Sans clé d'API, l'IA tourne en **moteur local** (déterministe). Pour l'IA réelle, renseigne `LLM_PROVIDER` / `LLM_API_KEY` dans `.env` (voir [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md)).

Prérequis : Node ≥ 22.12 et pnpm (`corepack enable`).

### Comptes de démo

Mot de passe `bino` pour tous (`DEMO_PASSWORD` dans `.env`). Ce n'est pas une authentification réelle.

| Matricule | Soignant |
| --- | --- |
| 10482 | Martine Dubois · IDE |
| 10401 | Sophie Lemoine · IDE |
| 10415 | Karim Haddad · IDE |

## Le parcours

Connexion (matricule + mot de passe) → Connexion réussie → onglets **Patients** et **Transmissions**.
Toucher un patient ouvre la fiche **Nouveau compte rendu** : dossier médical, zone de texte, micro,
**Valider**. Détail écran par écran et règles : [docs/FONCTIONNEMENT.md](docs/FONCTIONNEMENT.md).

| Moment | Ce que voit l'infirmière | Où dans le code |
| --- | --- | --- |
| Prise de poste | Connexion par **matricule** + mot de passe de démo | `apps/mobile/src/app/connexion.tsx`, `apps/api/src/services/team-service.ts` |
| Entre deux chambres | Fiche **Nouveau compte rendu** : elle écrit, ou dicte au **micro** (le texte arrive à la fin de l'enregistrement avec la transcription serveur, en direct avec celle du navigateur) | `apps/mobile/src/app/patient/[patientId].tsx`, `apps/mobile/src/features/report` |
| Dans la fiche | **Dossier médical** : constantes avec les points **NEWS2** de chaque paramètre, dispositifs (J+n), allergies… ; feuille **Constantes** avec score recalculé en direct | `apps/mobile/src/features/report`, `packages/domain/src/rules/news2.ts` |
| 1 geste | **Valider** : compte rendu signé et horodaté, popup « Compte rendu fait ». L'IA le range en **DAR** sourcé, R manquant posé en **question** ; il reste « à relire », jamais validé à sa place | `packages/ai`, `apps/api/src/services/hospital-service.ts` |
| Pendant le poste | **Mes CR** : ses comptes rendus, texte intégral, du plus récent au plus ancien | `apps/mobile/src/features/transmissions/MyReports.tsx` |
| À la relève | **Tous** : une carte par patient, puces sourcées par thème avec auteur et heure, question « R manquant » sous sa puce, **Priorité 1 à 4** (suggestion avec plancher NEWS2, le choix manuel prime) | `apps/mobile/src/features/transmissions`, `packages/domain/src/rules/{summary,team,priority}.ts` |
| Démo / tests | **Simulateur** d'hôpital : journées rejouables (`/simulateur`, par l'URL), évaluation de l'IA | `packages/simulation`, `pnpm sim` |

Gardé dans l'API mais pas affiché par ce front : relecture et validation des transmissions,
réponse aux questions, étoile ★, entrée d'un patient, fiche de relève, recherche sourcée, récap « taille SMS »,
export **FHIR R4** vers un DPI simulé (voir [FONCTIONNEMENT.md §3](docs/FONCTIONNEMENT.md#3-fonctions-gardées-dans-le-backend-mais-pas-affichées)).

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
pnpm sim run chir-bino     # rejoue une journée et affiche la relève dans le terminal
pnpm sim eval              # évalue l'IA (bon patient, DAR, R manquant, zéro invention)
```

## Documentation

| Fichier | Pour quoi |
| --- | --- |
| [AGENTS.md](AGENTS.md) | **À lire en premier** (humains et agents de code) : règles, carte du code, workflow |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Le problème, Martine, le parcours, le périmètre MVP / V2 / vision |
| [docs/FONCTIONNEMENT.md](docs/FONCTIONNEMENT.md) | Ce que fait l'app, écran par écran ; d'où viennent les données ; NEWS2, priorité, puces ; remise à zéro de la démo |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Comment c'est construit et pourquoi |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | Travailler à 7+ sans se marcher dessus : branches, PR, tests, chantiers parallèles |
| [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md) | Brancher un LLM, un speech-to-text, un classifieur (Jev) |
| [docs/SCENARIOS.md](docs/SCENARIOS.md) | Le simulateur d'hôpital, écrire un scénario, évaluer l'IA |
| [docs/DESIGN.md](docs/DESIGN.md) | Identité Bino : principes, tokens, composants, ce qu'on s'interdit |
| [docs/DEMO.md](docs/DEMO.md) | Script de démo pour le jury |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Journal des décisions d'architecture et produit |
