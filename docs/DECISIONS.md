# Journal des décisions

Format court : décision, pourquoi, alternative écartée, quand la revoir. Ajouter une ligne à chaque
choix structurant (une PR qui change une décision met à jour ce fichier).

## Produit

| # | Décision | Pourquoi | Alternatives écartées / à revoir |
| --- | --- | --- | --- |
| P1 | **Push-to-talk**, pas d'écoute continue | Synthèse : confidentialité, bruit, mélange de patients, coût | Écoute ambiante, pin's : vision |
| P2 | Le « challenge » de l'IA = **questions** (R manquant, imprécisions) | Biais d'automatisation (analogie Word), responsabilité, dispositif médical | IA qui juge le contenu clinique. Depuis P16 : questions calculées dans l'API, plus affichées dans le front |
| P3 | **Priorité suggérée et expliquée**, couleur manuelle + ★ priment | « L'IA ne décide rien » ; adoption | Score opaque |
| P4 | On **prépare** la relève orale, on ne la remplace pas | « La pizza » : moment collectif apprécié | Relève 100 % écrite |
| P5 | Cible de démo : **réanimation** (kit Foch documenté) + un scénario **médecine** | Le kit décrit la réa, l'équipe imaginait un service : on montre les deux trames | Choisir une seule cible |
| P6 | Fenêtre de relève : le poste qui vient de finir reste affiché **2 h** après 7h45 / 19h45 | À 19h50 on transmet le poste de jour | Couper net à l'heure |
| P7 | « À faire » = ce que l'IDE a dicté, au conditionnel ; **pas de lecture des prescriptions** | Synthèse : périmètre, paradigme | Checklists générées |
| P8 | Recherche = **extraits sourcés** façon Ctrl+F, pas de réponse synthétique | « C'est à l'infirmière de conclure » | RAG génératif |
| P9 | Données **100 % fictives**, hôpital simulé rejouable | Kit Foch, RGPD | — |
| P10 | **Front « Bino »** (maquettes de l'équipe, branche `demo`) : 2 onglets Patients / Transmissions, fiche « Nouveau compte rendu », priorité 1 à 4 | Parcours validé par l'équipe sur maquettes papier ; un geste par compte rendu | Ancien front (relecture DAR, relève PC, recherche, DPI) : retiré du front, **gardé dans le backend** |
| P11 | **« Valider » enregistre le compte rendu** (signé, horodaté) ; la structuration IA reste « À relire », jamais validée automatiquement | « L'IA ne décide rien » : valider d'un toucher signerait un contenu IA jamais vu et écrirait des allergies extraites dans le dossier | Créer + valider en un toucher |
| P12 | Résumé « Tous » **sans IA générative** : une puce par thème faite d'éléments sourcés des CR, auteur et heure dessous ; aucune question sous les puces (P16) | Zéro information inventée, traçabilité « qui a dit quoi » | Synthèse LLM multi-CR (il faudrait un ancrage multi-sources) ; question « R manquant » sous sa puce (version d'origine, retirée par P16) |
| P13 | **NEWS2** affiché (entrées et points) et utilisé comme **plancher de la priorité suggérée** ; le choix manuel prime | Demande de l'équipe (prototype Bino) ; aide au calcul explicable | ⚠ Score clinique : à revoir avant tout usage réel (dispositif médical, voir PRODUCT « Réglementaire ») |
| P14 | **« Qui es-tu ? »** : on choisit son prénom parmi les soignants du scénario, sans mot de passe (d'abord : matricule + mot de passe partagé `DEMO_PASSWORD`, gardé dans l'API via `POST /session/login`) | Parcours des maquettes ; « Mes CR » par soignant | Authentification réelle CPS / e-CPS : V2 |
| P15 | Scénario par défaut **`chir-bino`** (chirurgie, 11 patients, 3 IDE) | Rejoue la démo de l'équipe à l'identique ; réa et médecine restent disponibles | — |
| P16 | **Pas de question à l'IDE dans le front** : `SummaryBullet.question` retiré du contrat, `rules/summary.ts` n'en attache plus, `SummaryCard` n'en montre aucune | Demande de l'équipe : ne pas challenger les infirmières sur ce qu'elles disent (« la température a monté » ne doit pas appeler « de combien ? ») | Question sous la puce (P12 d'origine). **Reste dans l'API**, sans écran : `rules/completeness.ts`, questions d'imprécision du LLM, `answerFlag`, `pnpm sim eval`. ⚠ AGENTS.md §2 « Des questions, pas des verdicts » n'est donc plus tenu que dans l'API : à confirmer ou ajuster par l'équipe dans une PR dédiée |

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
| T11 | Dictée : **STT serveur** (si configuré) → Web Speech (navigateur) → clavier. Depuis T23, la dictée en direct passe en premier | Même moteur sur tous les appareils, vocabulaire soignant transmis ; Web Speech répète des mots sur Chrome Android. Fonctionne sans module natif, Expo Go suffit | Web Speech en premier (texte en direct, mais qualité variable) ; `expo-speech-recognition` (dev build) : V2 |
| T12 | Styles : **tokens + primitives maison** | Fiable iOS/Android/web, pas de chaîne de build CSS | NativeWind, Tamagui, Unistyles (dev build) |
| T13 | **Biome** (lint + format), lefthook, commitlint, CI GitHub | Un outil rapide, mêmes règles pour tous, humains et agents | ESLint + Prettier |
| T14 | Tests : Vitest (unitaire, intégration via `app.request` + client réel), Playwright (E2E sur export web) | Pyramide rapide ; E2E = build de prod | Jest partout, Detox/Maestro (natif) : V2 |
| T15 | **TypeScript 6** (attendu par Expo 58) partout | Une seule version | TS 7 (non supporté par Expo au 14/11) |
| T16 | `AGENTS.md` = source unique ; `CLAUDE.md` l'importe | Tous les agents de code et humains lisent les mêmes règles | Fichiers divergents par outil |
| T17 | **Relecture de code indépendante** (agent sans contexte) avant livraison ; chaque bug confirmé = test de non-régression | 13 points trouvés dont 4 sur les lignes rouges (ancrage, export de brouillons, réponse sur note validée, patient non modifiable) : tous corrigés | — |
| T18 | Export DPI : **uniquement les transmissions validées** | « Rien n'est versé au dossier sans validation » | Exporter les brouillons en `preliminary` |
| T19 | Continuité des cibles **au niveau de la vue** (fiche, compteurs, priorité) | Ne jamais modifier une transmission signée ; la réévaluation reste sourcée dans la dictée qui l'apporte | Écrire le R dans la transmission d'origine |
| T20 | Priorité : le bonus « non relue » ne vaut plus que pour les transmissions **mises de côté** (`unreviewed`), pas pour les brouillons | Dans Bino tous les CR restent `draft` : le bonus ferait monter tout patient ayant un CR | Garder le bonus sur `draft` |
| T21 | Polices **Nunito + Plus Jakarta Sans**, couleurs du logo Bino, colonne de 440 px sur grand écran | Fidélité aux maquettes de l'équipe | Atkinson Hyperlegible (AGENTS.md §9 à mettre à jour si l'équipe confirme) |
| T22 | Branche de référence consultée en **`git worktree`** dans `.reference/` (ignoré par git et Biome) | Comparer au prototype sans fusionner deux historiques | `git merge` de `demo` |
| T23 | **Dictée en direct découpée aux pauses**. Le son part à l'API (WebSocket `/transcriptions/live`), qui le découpe en segments aux pauses de la voix (`PcmSegmenter` : 0,7 s de silence, 3 s minimum, 15 s maximum). Pendant qu'on parle : texte provisoire du segment par `gpt-live-transcribe` (`LiveSttPort`). Dès la pause : `SttPort` (`STT_MODEL`, recommandé `gpt-transcribe`) retranscrit le segment, avec le texte qui précède en contexte, et ce texte définitif remplace son provisoire. À l'arrêt, `final` réunit les segments : pas de deuxième passe sur tout l'enregistrement | Mesuré le 14/11 : `gpt-live-transcribe` suit la voix mais écrit souvent les nombres en lettres (l'ancrage rejetterait « SpO2 94 % ») ; `gpt-transcribe` met les chiffres. Par segment, le texte devient juste **pendant** la dictée (0,3 à 1,1 s après chaque pause, via un tunnel `cloudflared`), rien n'est réécrit à la fin et l'arrêt est quasi immédiat (22 ms quand tout est déjà finalisé). **3 s minimum** : isolé, un segment de 1,8 s, « pouls cent huit », revenait « Pouce en huit » à chaque essai, juste une fois fusionné ; avec 3 s, « Pouls 108 ». L'app n'appelle jamais le fournisseur : clés côté serveur | Deux passes (provisoire, puis tout l'enregistrement retranscrit à l'arrêt : texte réécrit à la fin, 1,1 à 1,7 s d'attente) ; segments de 1,5 s minimum (premier réglage) ; une seule passe en direct (chiffres en lettres) ; jeton éphémère et connexion directe de l'app au fournisseur. Coût : les deux modèles (0,017 + 0,0045 $/min). ⚠ Capture native (iOS/Android) pas encore testée sur un appareil |
| T24 | Dépendance **`ws`** (+ `@types/ws`) dans `apps/api` : `WebSocketServer` passé à `serve()` de `@hono/node-server` v2, route via son `upgradeWebSocket` intégré (`apps/api/src/server.ts`) | `@hono/node-ws` exige `@hono/node-server` v1 (pair `^1.19.11`) ; l'API est en v2. `ws` était déjà dans `node_modules` sans être déclaré par l'API ; il l'est maintenant | `@hono/node-ws` |

## Pistes V2 identifiées

- **Continuité des cibles, étape 2** : fournir au LLM les cibles ouvertes du patient pour qu'il
  rattache explicitement une réévaluation à la bonne cible (aujourd'hui : même libellé).
- **Pseudonymisation** du transcript avant envoi au LLM (remplacer noms/chambres puis réinjecter).
- **Dictée native sur l'appareil** (`expo-speech-recognition`, nécessite un dev build).
- **Dictée en direct** : tester la capture native (`useAudioStream`) sur iPhone et Android ; un
  adaptateur `LiveSttPort` auto-hébergé (piste HDS).
- Store Postgres HDS, authentification (CPS / e-CPS), journal d'audit.
- Questions de cohérence inter-dictées (« incohérent avec ta note de 14h »), toujours sourcées. À
  rediscuter avec l'équipe : P16 retire les questions du front.
