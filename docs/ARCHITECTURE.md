# Architecture

## Vue d'ensemble

```mermaid
flowchart LR
  subgraph Mobile["apps/mobile — Expo (iOS, Android, web), front Bino"]
    C["Connexion"] --> PA["Patients"]
    PA --> F["Fiche : dossier, constantes,\ncompte rendu"]
    T["Transmissions :\nMes CR / Tous"]
    S["Utilitaires :\n/simulateur, /serveur"]
  end
  subgraph API["apps/api — Hono (Node)"]
    H["HTTP : contrat validé"] --> UC["Cas d'usage\nHospitalService, TeamService"]
    WS["WebSocket\n/transcriptions/live"]
    UC --> ST[("Store JSON\nvalidé zod")]
    SIM["SimulationService"] --> UC
  end
  subgraph AI["packages/ai — ports + adaptateurs"]
    P["Pipeline"] --> LLM["LlmPort\n(AI SDK : DeepSeek, OpenAI…)"]
    P --> CL["ClassifierPort\n(Jev, LLM, règles)"]
    P --> HE["Moteur heuristique\n(repli)"]
    STT["SttPort\n(Whisper, gpt-transcribe, Groq, auto-hébergé)"]
    LIVE["LiveSttPort\n(OpenAI Realtime)"]
  end
  DOM["packages/domain\nschémas, règles pures,\ncontrat d'API, client typé"]
  SCN["packages/simulation\nhôpital fictif, scénarios"]
  Mobile -- "client typé (contrat)" --> H
  UC --> P
  H --> STT
  Mobile -- "son PCM (dictée en direct)" --> WS
  WS --> LIVE
  WS --> STT
  SIM --> SCN
  Mobile -.-> DOM
  API -.-> DOM
  AI -.-> DOM
```

## Paquets et règles de dépendance

| Paquet | Rôle | Dépend de |
| --- | --- | --- |
| `packages/domain` | Schémas zod, règles **pures** (ancrage, complétude, priorité, NEWS2, résumé d'équipe, fiche, temps, FHIR, recherche), contrat d'API + client | zod |
| `packages/ai` | Ports IA, adaptateurs, pipeline de structuration. **Serveur uniquement** | domain |
| `packages/simulation` | Hôpital fictif + scénarios (données) | domain |
| `apps/api` | Composition : services, store, HTTP, simulateur, CLI | domain, ai, simulation |
| `apps/mobile` | UI | domain (types + client) |
| `e2e` | Playwright | domain (client) |

Les paquets internes exposent leur **source TypeScript** (`main: src/index.ts`) : pas d'étape de build,
Metro, Vitest et tsx les consomment directement.

## Contrat d'API typé

`packages/domain/src/api/contract.ts` déclare chaque endpoint (méthode, chemin, schémas zod des
paramètres, query, corps et réponse).

- **Serveur** : `registerContract()` enregistre tout, valide les entrées (400 lisible) **et les sorties**
  (une réponse hors contrat = 500 + log). Le type `Handlers` oblige à implémenter chaque endpoint.
- **Client** : `createApiClient()` génère `api.<nom>(input)` typé ; la réponse est validée à l'exécution.
  Une dérive mobile/serveur casse immédiatement avec un message clair, pas silencieusement.

Endpoints ajoutés pour le front Bino (`apps/api/src/services/team-service.ts`, vues calculées par
`packages/domain/src/rules/{team,summary,news2}.ts`, testés dans `apps/api/src/http/team.test.ts`) :

| Nom | Route | Rôle |
| --- | --- | --- |
| `login` | POST `/session/login` | Connexion de démo : matricule d'un soignant du scénario chargé + `DEMO_PASSWORD` (401 sinon). Aucun jeton émis |
| `unitSummaries` | GET `/units/:unitId/summaries` | Onglet « Tous » : par patient présent, priorité (plancher NEWS2), NEWS2, puces sourcées du poste |
| `nurseReports` | GET `/nurses/:nurseId/reports` | « Mes CR » : CR du soignant sur la fenêtre de relève, du plus récent au plus ancien |
| `updateVitals` | PUT `/patients/:patientId/vitals` | Constantes saisies, horodatées et sourcées par le soignant ; renvoie le dossier recalculé |

Deux routes sont **hors du contrat JSON** : `POST /transcriptions` (envoi de fichier,
`apps/api/src/http/transcription.ts`) et le WebSocket `GET /transcriptions/live` (dictée en direct,
`apps/api/src/http/live-transcription.ts`, voir plus bas). Le protocole du WebSocket est quand même
partagé et typé : `packages/domain/src/api/live-transcription.ts` (messages validés par zod des deux
côtés). Son état est dans `GET /config` (`sttLive`).

`patientDetail` renvoie aussi `news2` et `devices` (jour de pose « J2 »). Le front utilise en plus
`config`, `session`, `unitBoard`, `patientDetail`, `samples`, `createTransmission`, `updatePriority`,
`health` et les endpoints du simulateur. Les autres (relecture, questions, fiche de relève,
recherche, récap, admission, export FHIR, horloge) restent disponibles sans écran : liste dans
[FONCTIONNEMENT.md §3](FONCTIONNEMENT.md#3-fonctions-gardées-dans-le-backend-mais-pas-affichées).

## Pipeline IA d'une dictée

```mermaid
sequenceDiagram
  participant M as Mobile
  participant S as HospitalService
  participant R as Rattachement patient
  participant E as Moteur (LLM ou local)
  participant G as Ancrage des sources
  participant C as Classifieur
  M->>S: transcript (+ patient présélectionné ?)
  S->>R: règles (box, nom, genre) puis classifieur si doute
  R-->>S: résolu / ambigu (on demandera) / inconnu
  S->>E: structurer (contexte minimal, sans nom)
  E-->>S: format brut {text, quote} par élément
  S->>G: chaque quote existe-t-elle ? chiffres identiques ?
  G-->>S: éléments sourcés + rejetés
  S->>C: gravité suggérée des cibles
  S-->>M: Transmission (brouillon) + questions
```

Points clés :

- **Format brut commun** (`engine/raw.ts`) : tous les moteurs renvoient `{ text, quote }`. Le LLM ne
  produit jamais directement ce qui est affiché.
- **Ancrage** (`domain/rules/grounding.ts`) : l'extrait doit être retrouvé dans la dictée (tolérance
  accents/ponctuation/petites fautes) et **tous les nombres** du texte doivent figurer dans l'extrait.
  Sinon : rejet, tracé dans `engine.rejected`.
- **Repli** : délai max (`LLM_TIMEOUT_MS`) puis moteur heuristique ; la transmission porte
  `engine.degraded = true`, l'UI le dit.
- **Complétude** déterministe : cible sans R → question. Les questions d'imprécision du LLM sont
  limitées et toujours formulées en questions. Elles restent sur la transmission (relecture,
  `answerFlag`) : le front Bino n'en affiche aucune (DECISIONS P16).
- **Priorité** : règles explicables (`PRIORITY_WEIGHTS`) + gravité suggérée (Jev Score / LLM / lexique)
  + **plancher NEWS2** sur la suggestion. Couleur manuelle et ★ priment toujours.
- **Fiche de relève** et **résumé « Tous »** : assemblés sans IA à partir des éléments sourcés des
  transmissions structurées (`rules/handover.ts`, `rules/summary.ts`).
- Le front Bino crée la transmission avec le patient présélectionné et ne la valide jamais :
  elle reste `draft` (DECISIONS P11).

## Dictée en direct

```mermaid
sequenceDiagram
  participant M as Mobile
  participant W as API /transcriptions/live
  participant L as LiveSttPort (gpt-live-transcribe)
  participant F as SttPort (STT_MODEL)
  M->>W: ouverture + son PCM 16 bits mono 24 kHz (trames binaires), dès le toucher
  W->>L: session de transcription, son relayé
  L-->>W: morceaux de texte
  W-->>M: delta (texte provisoire)
  M->>W: message « stop » (arrêt du micro)
  W->>F: tout l'enregistrement (WAV)
  F-->>W: texte final
  W-->>M: final (remplace le provisoire), puis fermeture
```

- **Clés côté serveur** : l'app n'appelle jamais un fournisseur. Elle ouvre `ws(s)://<api>/transcriptions/live`
  (`apps/mobile/src/lib/live-transcription.ts`) ; l'API ouvre la session chez le fournisseur avec sa
  clé (WebSocket natif de Node, en-tête `Authorization`).
- **Indépendance fournisseur** : l'API ne connaît que `LiveSttPort` (texte provisoire) et `SttPort`
  (texte final). Changer de fournisseur = un adaptateur dans `packages/ai/src/stt/`.
- **Deux passes** (DECISIONS T23) : le provisoire suit la voix ; le final est retranscrit sur tout
  l'enregistrement, avec les nombres en chiffres, et c'est lui qui part à la structuration.
- **Rien n'est perdu** : le son capté avant l'ouverture de la connexion attend en file côté app ;
  celui reçu avant l'ouverture de la session fournisseur est gardé côté API. Si le direct tombe en
  panne, l'API continue d'enregistrer et produit le final.
- **Découpage** : `LiveDictation` (`apps/api/src/services/live-dictation.ts`) ne dépend pas du
  transport et se teste sans réseau. `apps/api/src/http/live-transcription.ts` la branche sur
  `upgradeWebSocket` de `@hono/node-server` ; `apps/api/src/server.ts` crée le serveur Node avec
  `ws` (T24). Sans WebSocket, la route répond 426.
- **Tests** : `app.request()` ne sait pas ouvrir de WebSocket ; `apps/api/src/http/live-transcription.test.ts`
  démarre un vrai serveur sur un port éphémère, avec de faux ports IA (`apps/api/src/testing/fake-live.ts`).
- **Limites** : 300 s par dictée (`LIVE_MAX_SECONDS`), trames de 1 Mio au plus. Une ligne de log
  par dictée (durée, octets, moteurs), jamais le son, le texte ni une clé.

## Temps

Tout est en heure locale du service via `Intl` (`rules/time.ts`), y compris sous Hermes.
`handoverWindow()` : pendant les 2 h qui suivent 7h45 / 19h45, on montre le poste qui vient de finir.
Cette fenêtre borne la fiche de relève, la priorité, « Mes CR » et « Tous ».
L'horloge peut être **simulée** (scénarios) : elle avance en temps réel depuis son point d'ancrage.
Le mobile affiche la date et les heures du serveur dans le fuseau du service, jamais celles de l'appareil.

## Persistance

Un seul document `HospitalState` (zod), en mémoire, sauvegardé en JSON (`DATA_DIR/state.json`,
écriture atomique différée). Un fichier incompatible avec le schéma est mis de côté, jamais écrasé.
Choix assumé pour le hackathon (zéro migration). Pour la production : implémenter le même store
sur Postgres hébergé HDS, sans toucher aux routes.

## Mobile

- **Expo SDK 58**, Expo Router (fichiers dans `src/app`), React Native Web pour le navigateur.
- Routes :

  | Route | Fichier | Rôle |
  | --- | --- | --- |
  | `/` | `index.tsx` | Redirige vers Patients si connecté, sinon Connexion |
  | `/connexion`, `/connexion-reussie` | `connexion.tsx`, `connexion-reussie.tsx` | Connexion de démo (`login`) |
  | `/patients`, `/transmissions` | `(app)/patients.tsx`, `(app)/transmissions.tsx` | Onglets ; `(app)/_layout.tsx` renvoie à Connexion sans session |
  | `/patient/[patientId]` | `patient/[patientId].tsx` | Fiche « Nouveau compte rendu », écran qui monte du bas |
  | `/serveur`, `/simulateur` | `serveur.tsx`, `simulateur.tsx` | Utilitaires, accessibles par l'URL seulement |

- Données serveur : **TanStack Query**. Rafraîchissement toutes les **5 s** (`unitBoard`,
  `patientDetail`, `nurseReports`, `unitSummaries`, `simulationStatus`), et au retour sur la
  fenêtre ; toute écriture invalide les vues.
- État local : **Zustand**. Session persistée (AsyncStorage : soignant, service, adresse de l'API,
  tris) ; brouillons de CR par patient **en mémoire seulement** (`features/report/drafts.ts`).
- Pas de bibliothèque de style : **tokens** (`src/ui/theme.ts`) + primitives maison, fiables sur
  toutes les plateformes. Identité Bino : [DESIGN.md](DESIGN.md).
- Dictée (`src/lib/dictation-engine.ts`) : dictée en direct si `sttLive.ready` → sinon enregistrement
  `expo-audio` + `/transcriptions` si un STT serveur est configuré → sinon Web Speech API (texte en
  direct, web seulement) → sinon micro du clavier. Le texte reconnu s'ajoute à la fin du brouillon.
- Capture du son en direct (`src/features/dictation/`) : `usePcmCapture.ts` sur iOS / Android
  (`useAudioStream` d'`expo-audio`, **pas encore testé sur un appareil**), `usePcmCapture.web.ts` sur
  le web (`getUserMedia` + AudioWorklet, repli ScriptProcessor). Le son est rééchantillonné en
  24 kHz et converti en 16 bits par `src/lib/pcm.ts`.
- Mise en page : une **colonne de 440 px** au plus, centrée (`COLUMN_MAX_WIDTH`, `src/app/_layout.tsx`),
  onglets en bas sur toutes les tailles d'écran. Pas de barre latérale ni de vue PC distincte
  (vérifié par `e2e/tests/bureau.spec.ts`).
- Logique de présentation pure (tris, formats, lignes du dossier, affichage NEWS2) dans `src/lib`,
  testée avec Vitest ; les règles métier (NEWS2, résumé, priorité) restent dans `packages/domain`.

## Sécurité (prototype)

- Clés uniquement côté serveur (`.env`, jamais dans l'app ni le dépôt ; hook de détection). La
  dictée en direct passe aussi par l'API : aucun jeton de fournisseur dans l'app.
- Le LLM ne reçoit pas l'identité du patient (sexe, âge, motif seulement) — la dictée elle-même peut
  contenir un nom : pseudonymisation avant envoi = piste V2.
- CORS ouvert pour la démo : à restreindre au réseau de l'hôpital.
- Connexion de démo seulement : aucun jeton, chaque écriture porte un `nurseId` dont le serveur
  vérifie l'existence, pas l'identité de l'appelant. Authentification réelle (CPS / e-CPS) : V2.
