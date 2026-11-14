# Journal des décisions

Format court : décision, pourquoi, alternative écartée, quand la revoir. Ajouter une ligne à chaque
choix structurant (une PR qui change une décision met à jour ce fichier).

## Produit

| # | Décision | Pourquoi | Alternatives écartées / à revoir |
| --- | --- | --- | --- |
| P1 | **Push-to-talk**, pas d'écoute continue | Synthèse : confidentialité, bruit, mélange de patients, coût | Écoute ambiante, pin's : vision |
| P2 | Le « challenge » de l'IA = **questions** (R manquant, imprécisions) | Biais d'automatisation (analogie Word), responsabilité, dispositif médical | IA qui juge le contenu clinique |
| P3 | **Priorité suggérée et expliquée**, couleur manuelle + ★ priment | « L'IA ne décide rien » ; adoption | Score opaque |
| P4 | On **prépare** la relève orale, on ne la remplace pas | « La pizza » : moment collectif apprécié | Relève 100 % écrite |
| P5 | Cible de démo : **réanimation** (kit Foch documenté) + un scénario **médecine** | Le kit décrit la réa, l'équipe imaginait un service : on montre les deux trames | Choisir une seule cible |
| P6 | Fenêtre de relève : le poste qui vient de finir reste affiché **2 h** après 7h45 / 19h45 | À 19h50 on transmet le poste de jour | Couper net à l'heure |
| P7 | « À faire » = ce que l'IDE a dicté, au conditionnel ; **pas de lecture des prescriptions** | Synthèse : périmètre, paradigme | Checklists générées |
| P8 | Recherche = **extraits sourcés** façon Ctrl+F, pas de réponse synthétique | « C'est à l'infirmière de conclure » | RAG génératif |
| P9 | Données **100 % fictives**, hôpital simulé rejouable | Kit Foch, RGPD | — |

## Technique

| # | Décision | Pourquoi | Alternatives écartées / à revoir |
| --- | --- | --- | --- |
| T1 | **Monorepo pnpm + Turborepo**, paquets internes en source TS | Un seul `pnpm install`, types partagés, pas de build interne | Dépôts séparés, npm workspaces |
| T2 | **Expo SDK 58** (iOS, Android, web) avec Expo Router, une seule app pour téléphone et PC | Demande explicite ; démo sur PC ou téléphone ; Expo Go pour toute l'équipe | Next.js + app séparée |
| T3 | `node-linker=hoisted` | Fiabilité Metro / autolinking en monorepo | Liens isolés pnpm |
| T4 | API **Hono** sur Node + **contrat zod maison** (client typé + validation entrées/sorties) | Typage bout en bout sans couplage de types serveur, dérive détectée à l'exécution, upload multipart simple | tRPC (FormData natif délicat), ts-rest (compat zod 4), Hono RPC (pas de validation de réponse) |
| T5 | **AI SDK (Vercel)** derrière un port `LlmPort` | Multi-fournisseurs, sorties structurées validées ; remplaçable | SDK d'un fournisseur |
| T6 | **Format brut `{text, quote}` + ancrage** obligatoire après tout moteur | Zéro invention garantie par le code, pas par le prompt | Faire confiance au LLM |
| T7 | **Moteur heuristique** de secours, déterministe | Démo sans réseau, tests reproductibles, dev sans clé, mode dégradé | Mock figé |
| T8 | **Jev (TypeSafe)** pour les jugements typés (patient ambigu, gravité), derrière `ClassifierPort` | Probabilités calibrées, rapide (~200 ms), pas de génération | LLM seul (probabilités auto-déclarées) |
| T9 | Store **JSON validé zod** (pas de SQL) | Zéro migration à 7 devs en 48 h ; un fichier incompatible est mis de côté | Drizzle + SQLite/Postgres : à faire pour la prod (HDS) |
| T10 | Rafraîchissement **polling 5 s** (TanStack Query) | Robuste sur toutes les plateformes | SSE/WebSocket (polyfill RN) |
| T11 | Dictée : Web Speech (navigateur) → STT serveur → clavier | Fonctionne partout sans module natif ; Expo Go suffit | `expo-speech-recognition` (dev build) : V2 |
| T12 | Styles : **tokens + primitives maison** | Fiable iOS/Android/web, pas de chaîne de build CSS | NativeWind, Tamagui, Unistyles (dev build) |
| T13 | **Biome** (lint + format), lefthook, commitlint, CI GitHub | Un outil rapide, mêmes règles pour tous, humains et agents | ESLint + Prettier |
| T14 | Tests : Vitest (unitaire, intégration via `app.request` + client réel), Playwright (E2E sur export web) | Pyramide rapide ; E2E = build de prod | Jest partout, Detox/Maestro (natif) : V2 |
| T15 | **TypeScript 6** (attendu par Expo 58) partout | Une seule version | TS 7 (non supporté par Expo au 14/11) |
| T16 | `AGENTS.md` = source unique ; `CLAUDE.md` l'importe | Tous les agents de code et humains lisent les mêmes règles | Fichiers divergents par outil |

## Pistes V2 identifiées

- **Continuité des cibles** : quand une dictée ultérieure apporte le résultat (« sat 95 % sous 3 L »),
  le rattacher à la cible ouverte (fournir les cibles ouvertes au LLM, champ `followUps`).
- **Pseudonymisation** du transcript avant envoi au LLM (remplacer noms/chambres puis réinjecter).
- **Dictée native sur l'appareil** (`expo-speech-recognition`, nécessite un dev build).
- Store Postgres HDS, authentification (CPS / e-CPS), journal d'audit.
- Questions de cohérence inter-dictées (« incohérent avec ta note de 14h »), toujours sourcées.
