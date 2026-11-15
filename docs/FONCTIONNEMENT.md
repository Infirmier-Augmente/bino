# Fonctionnement de l'app (front « Bino »)

Chaque IDE écrit ou dicte ses **comptes rendus (CR)** au fil du poste, depuis la fiche du patient.
L'onglet Transmissions › Tous prépare la relève : une carte par patient, des puces sourcées avec
leur auteur et leur heure, une priorité de 1 à 4.

> **Données 100 % fictives.** Patients, soignants, constantes et CR viennent du scénario
> `chir-bino` (`packages/simulation`). Ne saisis aucune donnée réelle.

Ce document décrit ce que l'app affiche, écran par écran, puis ce qui se passe derrière. Lancer
l'app : [README](../README.md). Script du jury : [DEMO.md](DEMO.md). Choix et raisons :
[DECISIONS.md](DECISIONS.md) (P10 à P16, T20, T21, T23).

## 1. Écran par écran

Code des écrans : `apps/mobile/src/app/`. Même app sur téléphone et sur ordinateur : une colonne
de 440 px au plus, centrée, onglets **Patients** et **Transmissions** en bas.

### « Qui es-tu ? » (`connexion.tsx`)

- Mascotte Bino, titre **« Qui es-tu ? »**, « Touche ton prénom pour commencer. », puis une carte par
  soignant du scénario chargé : nom et « IDE · service ». **Un toucher** et on arrive sur Patients :
  pas de mot de passe ni d'écran « Connexion réussie » (DECISIONS P14).
- Soignants du scénario `chir-bino` (service Chirurgie polyvalente) : Martine Dubois, Sophie
  Lemoine, Karim Haddad (IDE).
- Le soignant choisi signe ses comptes rendus (Mes CR, « Karim 14h05 » sous les puces). Ce n'est
  pas une authentification : n'importe qui peut choisir n'importe quel nom (CPS / e-CPS en V2).
- Si le serveur ne répond pas : lien « Serveur injoignable : régler l'adresse » vers `/serveur`.
- L'API garde `POST /session/login` (matricule + `DEMO_PASSWORD`), que ce front n'utilise plus.

### Patients (`(app)/patients.tsx`)

- En-tête : mascotte, **prénom** du soignant, « Date : 14/11/2026 » (date du serveur, dans le
  fuseau du service), lien **Déconnexion**.
- « Patients » + compteur, menu **Trier : Chambre / Nom** (choix gardé sur l'appareil).
- Une carte par patient du service : « M. Jean Dupond », « 68 ans · Post-opératoire de colectomie,
  J2 » (jour d'hospitalisation), pastille « CHAMB 12 ».
- Ni priorité ni NEWS2 ici : ils sont dans Transmissions › Tous.
- La liste se rafraîchit seule toutes les 5 s (dans l'app native, tirer vers le bas aussi).
  Toucher un patient ouvre la fiche « Nouveau compte rendu ».

### Nouveau compte rendu (`patient/[patientId].tsx`)

Écran plein écran qui monte du bas. De haut en bas :

1. Croix **Fermer** (ou Échap sur le web), titre, nom du patient, « Chambre 12 · 68 ans ».
2. Bouton **Dossier médical** (replié par défaut). Déplié (`features/report/MedicalRecord.tsx`) :
   - tableau des constantes : fréquence respiratoire, SpO2, oxygène, tension artérielle,
     fréquence cardiaque, température, conscience ; pour chaque ligne la valeur et les **points
     NEWS2** (« +2 », « 0 »), puis **Total NEWS2** et « Constantes de 17h40 » ;
   - « Pas encore de constantes relevées. » s'il n'y en a pas ;
   - bouton **Modifier les constantes** (ou **Saisir les constantes**) ;
   - motif, antécédents, allergies (« Aucune connue » ou « Non renseignées » si inconnu), puis, s'ils
     existent : précautions, dispositifs avec leur jour de pose (« Drain abdominal (J2) »),
     nouvelle prescription, famille.
3. Grande zone de texte (« Ce que tu as vu et fait, comme à la relève. »). Pendant la dictée, elle
   n'est plus modifiable et prend une bordure magenta : le texte déjà écrit, puis la dictée,
   segment par segment (`features/report/LiveTranscript.tsx`). Un segment s'affiche d'abord en
   **texte provisoire** gris italique, mot à mot ; chaque nouveau mot apparaît en fondu en montant
   de 4 px (180 ms). Après la pause qui le termine, son **texte définitif** le remplace en bleu nuit,
   surligné en bleu ciel qui s'efface (600 ms). « Réduire les animations » : rien ne bouge. Si la
   zone est encore vide : « Parle : le texte s'affiche au fil de la dictée. » (ou « Parle : le texte
   s'affichera à l'arrêt. » quand le texte n'arrive qu'à la fin).
4. Sous la zone, la ligne d'état : « Enregistrement 0:07 » (durée écoulée), puis « Finalisation… »
   (dictée en direct : le temps de finaliser le dernier segment) ou « Transcription en cours… »
   (transcription à la fin).
5. **Micro** rond magenta de 72 px (`features/report/MicButton.tsx`) : toucher pour dicter, toucher
   à nouveau pour arrêter. Dès le toucher (4 à 12 ms mesurés), il passe à l'icône carré et
   « Enregistrement » s'affiche, avant même l'accès au micro. Retour haptique au début et à l'arrêt
   (sur le web : vibration du navigateur quand elle existe, pas sur Safari iOS). Pendant
   l'enregistrement, un halo suit le niveau réel du micro (pas avec la reconnaissance du
   navigateur) ; tant que personne ne parle, une onde lente montre qu'il écoute. Réglage « Réduire
   les animations » : halo de taille fixe dont seule l'intensité suit la voix, pas d'onde. Après
   l'arrêt : roue de chargement jusqu'au texte. Le texte reconnu s'ajoute **à la fin** de la zone,
   jamais à la place.
6. Puce **Exemple : …** sur deux patients (chambre 12 « M. Dupond se dégrade », chambre 10
   « Mme Berger, journée calme ») : remplit la zone avec un CR d'exemple. Elle disparaît une fois
   ce texte enregistré pour ce patient.
7. **Valider**, fixé en bas.

**Feuille « Constantes »** (`features/report/VitalsSheet.tsx`) : FR, SpO2, TA systolique, TA
diastolique, FC, température, puis **Oxygène** (Air ambiant / Sous O2) et **Conscience** (Alerte /
Confusion / altérée). Le **nouveau score NEWS2** se recalcule à chaque frappe (règle du domaine
`news2`). Une valeur vide ou non positive affiche « – ». **Enregistrer** : toast « Constantes
enregistrées · NEWS2 5. », la feuille se ferme, le dossier se rouvre à jour. Valeur invalide :
« Vérifie les valeurs saisies. ». Aucune borne physiologique n'est vérifiée.

**Valider** : termine la dictée en cours (attend le texte final ou la transcription), puis :

- texte de moins de 3 caractères : toast « Dicte ou écris d'abord le compte rendu. » ;
- sinon le CR est envoyé, la fiche se ferme et la popup **« Compte rendu fait »** s'affiche
  1,8 s ;
- échec : toast « L'enregistrement a échoué. Réessaie dans un instant. », le texte reste.

Le bouton est inactif pendant « Finalisation… » et « Transcription en cours… ». Ce que « Valider »
fait côté serveur : §2.6.

### Transmissions (`(app)/transmissions.tsx`)

Titre, lien **Déconnexion**, sélecteur **Mes CR | Tous** (Mes CR à l'ouverture).

**Mes CR** (`features/transmissions/MyReports.tsx`) : les CR du soignant connecté sur le poste, du
plus récent au plus ancien. Pour chacun : patient, pastille chambre, heure, **texte intégral tel
qu'il a été écrit ou dicté**. Pas de suppression ni de modification.

**Tous** (`features/transmissions/TeamSummaries.tsx`, `SummaryCard.tsx`) :

- menu **Trier : Priorité / Chambre / Nom** (Priorité par défaut, choix gardé sur l'appareil) ;
- une carte par patient, barre gauche à la couleur de sa priorité ;
- en tête de carte : nom, pastille chambre, bouton **Priorité n** ;
- toucher **Priorité n** déplie dans la carte une rangée de cercles **1 2 3 4** ; le niveau
  actuel est plein. Toucher un chiffre enregistre le choix (toast « Priorité 2 enregistrée. »),
  replie la rangée et retrie la liste ;
- la raison de la priorité n'est pas affichée à l'écran : elle est dans le libellé lu par le
  lecteur d'écran (« M. Jean Dupond : Priorité 1 (NEWS2 7 · FR 24, TA 98/62). Changer la
  priorité ») ;
- les **puces** : « Thème : texte », puis l'auteur et l'heure (« Karim 14h05 · Sophie 8h10 »).
  Aucune question à l'IDE sous les puces : on ne remet pas en cause ce qu'elle a dit (P16) ;
- 6 puces au plus, les plus récentes ; « Voir les 2 autres puces » (ou « Voir l'autre puce »)
  déplie le reste, « Afficher moins » replie ;
- « Aucun compte rendu aujourd'hui. » si le patient n'a pas de CR sur le poste ;
- en bas : « Puces de la plus récente à la plus ancienne ; chacune vient d'un compte rendu
  (auteur et heure dessous). À relire avant la relève. »

### Déconnexion

Lien en haut à droite de Patients et de Transmissions, sans confirmation. L'app oublie le
soignant, ses brouillons et les données en cache, puis revient à Connexion. Les tris restent.

### Écrans utilitaires (par l'URL seulement)

| URL | Rôle |
| --- | --- |
| `/serveur` | Adresse de l'API : **Tester et enregistrer**, **Adresse automatique**. Accessible sans connexion. |
| `/simulateur` | État du simulateur (heure simulée, événement n / total, **Événement suivant**) et, par scénario, **Rejouer la journée** et **Partir du début**. Voir §4. |

## 2. En coulisses

### 2.1 D'où viennent les données

Toutes les vues sont calculées par le serveur à la lecture, sans IA, par les règles pures de
`packages/domain`. Le mobile n'importe que `@infirmier/domain` (types + client typé).

| Écran | Endpoint (`api.<nom>`) | Ce qui en sort | Rafraîchi |
| --- | --- | --- | --- |
| Qui es-tu ? | `session` (GET `/session`) | soignants et services du scénario chargé | à la demande |
| Patients | `unitBoard` (GET `/units/:unitId/board`) | patients du service, date du serveur | toutes les 5 s |
| Fiche | `patientDetail` (GET `/patients/:patientId`) | dossier, constantes, `news2`, dispositifs (`devices`, J+n), CR du patient | toutes les 5 s |
| Fiche | `samples` (GET `/simulation/samples`) | CR d'exemple | à l'ouverture |
| Fiche, micro | `config` (GET `/config`), WebSocket `/transcriptions/live`, POST `/transcriptions` | direct (`sttLive`) et STT serveur (`stt`) prêts ou non ; par segment, texte provisoire puis définitif ; texte transcrit | à l'ouverture ; pendant la dictée ; à l'arrêt du micro |
| Fiche, Valider | `createTransmission` (POST `/transmissions`) | le CR enregistré (statut `draft`) | après écriture : tout se rafraîchit |
| Constantes | `updateVitals` (PUT `/patients/:patientId/vitals`) | dossier recalculé | idem |
| Mes CR | `nurseReports` (GET `/nurses/:nurseId/reports`) | CR du soignant sur le poste | toutes les 5 s |
| Tous | `unitSummaries` (GET `/units/:unitId/summaries`) | une carte par patient : priorité, NEWS2, puces | toutes les 5 s |
| Tous, cercles | `updatePriority` (PATCH `/patients/:patientId/priority`, `manualLevel`) | priorité recalculée | idem |
| `/serveur` | `health` | réponse du serveur | à la demande |
| `/simulateur` | `scenarios`, `simulationStatus`, `loadScenario`, `stepScenario` | état du simulateur | toutes les 5 s |

Les dates et heures viennent de l'horloge du serveur (simulée en démo) et du fuseau du service
(`rules/time.ts`), jamais de l'horloge de l'appareil.

### 2.2 « Le poste » = la fenêtre de relève

Mes CR, Tous et la priorité ne prennent que les CR de la **fenêtre de relève**
(`handoverWindow`) : le poste en cours (7h45 → 19h45, 19h45 → 7h45), sauf pendant les 2 h qui
suivent 7h45 et 19h45, où l'on montre le poste qui vient de finir. Le texte « Aucun compte rendu
aujourd'hui » désigne donc ce poste, pas la journée calendaire. Le dossier (`patientDetail`)
garde tous les CR du patient.

### 2.3 NEWS2 (`packages/domain/src/rules/news2.ts`)

Score NEWS2 (Royal College of Physicians, 2017), échelle SpO2 n° 1, seuils repris du prototype
Bino. **Aide au calcul** : les entrées et les points de chaque paramètre sont toujours affichés.

| Paramètre | 3 | 2 | 1 | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR (/min) | ≤ 8 | | 9–11 | 12–20 | | 21–24 | ≥ 25 |
| SpO2 (%) | ≤ 91 | 92–93 | 94–95 | ≥ 96 | | | |
| Oxygène | | | | air ambiant | | sous O2 | |
| PA systolique (mmHg) | ≤ 90 | 91–100 | 101–110 | 111–219 | | | ≥ 220 |
| FC (/min) | ≤ 40 | | 41–50 | 51–90 | 91–110 | 111–130 | ≥ 131 |
| Température (°C) | ≤ 35,0 | | 35,1–36,0 | 36,1–38,0 | 38,1–39,0 | ≥ 39,1 | |
| Conscience | | | | Alerte | | | Confusion / altérée (V, P, U comptent comme C) |

La diastolique est affichée mais ne compte pas. Niveau (convention de la démo) : total ≥ 7 →
priorité 1 ; 5–6 → priorité 2 ; 3–4, ou un paramètre à 3 points → priorité 3 ; sinon
priorité 4. Raison courte : « NEWS2 7 · FR 24, TA 98/62 » (jusqu'à 3 paramètres à 2 points ou
plus). Couleur des points dans le dossier : 0 gris, 1 jaune, 2 orange, 3 rouge ; total ≥ 7 rouge,
≥ 5 orange, ≥ 1 jaune.

Les constantes sont horodatées et sourcées : « dossier » (`record`) pour celles du scénario,
« soignant » (`nurse`, avec son identifiant et l'heure) pour une saisie dans la feuille.

⚠ Score clinique : à revoir avant tout usage réel (voir [PRODUCT.md](PRODUCT.md), « Réglementaire »).

### 2.4 Priorité (`packages/domain/src/rules/priority.ts`)

| Priorité | Niveau interne | Couleur |
| --- | --- | --- |
| 1 | `rouge` | rouge `#DC0000` |
| 2 | `orange` | rouge `#DC0000` (même couleur que 1, comme le prototype) |
| 3 | `jaune` | jaune `#F5B700` |
| 4 | `vert` | vert `#1B8A4A` |

La couleur est toujours doublée du libellé « Priorité n ».

Ordre de décision pour chaque patient :

1. **Choix manuel** d'un soignant (cercles 1 à 4) : il prime toujours, même sous le niveau NEWS2.
2. Sinon, la **suggestion** (`suggestPriority`), recalculée à chaque lecture, jamais stockée :
   - gravité de chaque cible DAR du poste (classifieur Jev ou LLM, sinon lexique) : urgente →
     1, préoccupante → 2, surveillance → 3 ;
   - **plancher NEWS2** : la suggestion ne descend jamais sous le niveau NEWS2 ; raison
     « NEWS2 n · … », sourcée par les constantes ;
   - entrée de moins de 24 h → au moins 3 ;
   - CR « mis de côté » (`unreviewed`) → au moins 3. Les CR enregistrés par « Valider » restent
     des brouillons (`draft`) et ne comptent pas ici (T20) ;
   - R manquant, examen programmé, allergies non renseignées : ajoutent du score, pas de niveau.

Tri « Priorité » de Tous (`apps/mobile/src/lib/sort.ts`) : priorité, puis score de la
suggestion, puis NEWS2, puis chambre. L'étoile ★ n'est pas utilisée dans ce tri. Le front ne
propose pas de revenir à la suggestion après un choix manuel (l'API le permet : §3).

### 2.5 Puces de « Tous » (`packages/domain/src/rules/summary.ts`)

Construites **sans IA générative** (P12) à partir des éléments sourcés des CR du poste, toute
l'équipe, tous statuts (à relire, validés, non relus) :

- une transmission donne des groupes : une **cible DAR** (son libellé ; D, A puis R), une
  **observation** (thème = appareil, ex. « Neuro »), un **« À faire »**, une **info transverse**
  (ex. « Famille / proches », « Examens programmés »), la macro-cible d'**« Entrée »** ;
- les **soins de routine** ne sont pas repris ;
- **filet de sécurité** (P17, `rules/summary-coverage.ts`) : toute phrase du CR qu'aucun élément
  structuré ne cite (une valeur que l'IA aurait écartée, une phrase oubliée) est reprise **mot pour
  mot** sous **« Autres informations »**, sourcée par sa position dans le CR. Seule la courte phrase
  qui nomme le patient (« Chambre 3, Mme Keller. ») est ignorée. Rien de ce que l'IDE a dit ne se
  perd ;
- même thème dans plusieurs CR → une seule puce ; un texte identique n'est pas répété, ses
  sources s'ajoutent ;
- le texte de la puce = les éléments mis bout à bout (« Thème : élément. élément. »). Rien
  d'autre n'est écrit ;
- dessous, **qui et quand** : l'auteur de chaque CR cité et son heure, ou le soignant qui a saisi,
  du plus récent au plus ancien ;
- **aucune question** (P16) : la puce n'a plus de champ `question`. Les questions (R manquant,
  imprécisions) restent calculées sur les transmissions, dans l'API (§3) ;
- puces triées de la plus récente à la plus ancienne ; le front en montre 6, puis « Voir les n
  autres puces ».

Les éléments eux-mêmes viennent de la structuration du CR (LLM ou moteur local), qui a déjà
passé l'**ancrage** : chaque élément cite un extrait retrouvé dans le texte du CR, avec les mêmes
chiffres, sinon il est écarté (`rules/grounding.ts`).

### 2.6 Ce que fait « Valider »

| Fait | Ne fait pas |
| --- | --- |
| `POST /transmissions` : `patientId` de la fiche (pas de recherche du patient dans le texte), `nurseId` du soignant, `mode: 'transmission'`, moyen de saisie (`keyboard`, `voice-server` y compris la dictée en direct, `voice-device` ou `simulation` pour un exemple) | Ne **valide** pas la transmission : `review.status` reste `draft` (« À relire »), jamais de validation automatique (P11) |
| Côté serveur : structuration DAR (LLM, repli moteur local), ancrage des sources, questions (R manquant…), gravité des cibles | N'écrit **rien dans le dossier** : les infos transverses extraites (allergies, précautions…) ne sont versées qu'à la validation (`applyTransverseUpdates`) |
| CR signé (`nurseId`) et horodaté (`createdAt`, horloge du serveur) | N'envoie rien au DPI : l'export ne prend que les transmissions validées (T18) |
| Le CR apparaît dans Mes CR (texte brut) et dans Tous (puces) | Ne ferme aucune question : elles restent ouvertes (répondables par l'API) |

Avec un LLM, l'enregistrement prend environ 2 s (délai max `LLM_TIMEOUT_MS`, puis moteur local).
Le bouton affiche un chargement pendant ce temps.

### 2.7 Dictée (`features/report/useReportDictation.ts`, `lib/dictation-engine.ts`)

Ordre de choix du moteur, d'après `GET /config` :

1. **Dictée en direct** si `sttLive.ready` (`STT_PROVIDER=openai` avec `STT_API_KEY`,
   `STT_LIVE_MODEL` différent de `none`) : au toucher, l'app ouvre le WebSocket
   `/transcriptions/live` et le micro en même temps et envoie le son en continu (PCM 16 bits mono
   24 kHz). L'API découpe la dictée en **segments** aux pauses de la voix (0,7 s de silence, 3 s
   au moins, 15 s au plus). Le texte provisoire du segment en cours (`gpt-live-transcribe`)
   s'affiche mot à mot, environ 1,3 s derrière la voix, souvent avec les nombres en lettres. Dès la
   pause, l'API retranscrit le segment avec `STT_MODEL` (recommandé `gpt-transcribe` : nombres en
   chiffres), en donnant le texte qui précède en contexte : son texte définitif remplace le
   provisoire 0,3 à 1,1 s après la pause, pendant qu'on continue de parler. À l'arrêt :
   « Finalisation… » le temps du dernier segment, puis le texte affiché s'ajoute à la zone (22 ms
   mesurés quand tout était déjà finalisé). Rien n'est réécrit à la fin (DECISIONS T23).
2. Sinon, **transcription à la fin** si `stt.ready` (`STT_PROVIDER` = `openai`, `groq` ou
   `openai-compatible`) : l'app enregistre (`expo-audio`), envoie l'audio à `POST /transcriptions`
   à l'arrêt, le texte arrive **à la fin**. Si l'envoi échoue : « Réessayer l'envoi de la dictée ».
3. Sinon, **reconnaissance vocale du navigateur** (web seulement, `fr-FR`) : texte partiel affiché
   pendant la dictée, chaque phrase reconnue ajoutée à la zone.
4. Sinon, le micro place le curseur dans la zone et affiche « Dictée indisponible ici : utilise le
   micro du clavier. ».

Replis de la dictée en direct (`features/dictation/useLiveDictation.ts`) :

- connexion refusée ou pas ouverte en 4 s, ou direct non configuré côté API : l'app passe sans rien
  dire à la transcription à la fin (moteur 2). Ce qui a été dit avant la bascule n'est pas repris ;
- direct en panne pendant la dictée : les segments sont quand même retranscrits par `STT_MODEL` ;
- segment en échec : un nouvel essai, puis son texte provisoire le remplace ;
- segment sans parole : pas transcrit, rien n'est ajouté ;
- texte final absent (connexion coupée, ou rien 20 s après l'arrêt) : le texte affiché (définitif là où il est arrivé, provisoire
  ailleurs) est ajouté, toast « Texte définitif incomplet : le texte affiché est gardé, relis-le. »
  (sans texte : un message d'erreur) ;
- 5 min au plus (`LIVE_MAX_SECONDS`) : l'API arrête et transcrit, toast « Dictée arrêtée après
  5 minutes : le texte est ajouté. » ;
- fiche fermée pendant la dictée : la dictée s'arrête, le texte arrive quand même dans le
  brouillon.

Capture du son : `features/dictation/usePcmCapture.ts` sur iOS / Android (`useAudioStream`
d'`expo-audio`, **implémenté mais pas encore testé sur un appareil**) ; `usePcmCapture.web.ts` dans
le navigateur (Web Audio, son rééchantillonné en 24 kHz par `lib/pcm.ts`).

Dans un navigateur de téléphone, le micro n'est autorisé qu'en **HTTPS** (voir [DEMO.md](DEMO.md)).
Le WebSocket suit l'adresse de l'API (`https` → `wss`) et passe par un tunnel `cloudflared` (vérifié).

### 2.8 Brouillons et session

- **Brouillon par patient, en mémoire seulement** (`features/report/drafts.ts`) : fermer la fiche
  ou changer d'onglet ne perd pas le texte. Recharger la page ou relancer l'app le perd (choix
  voulu : rien n'est écrit sur l'appareil). Effacé après un « Valider » réussi et à la déconnexion.
- **Gardé sur l'appareil** (`features/session/store.ts`, AsyncStorage / `localStorage`) : le
  soignant connecté et son service, l'adresse de l'API choisie dans `/serveur`, les deux tris.
  Aucune donnée patient n'est écrite sur l'appareil.

### 2.9 Lignes rouges (AGENTS.md §2)

| Règle | Comment c'est tenu dans ce front |
| --- | --- |
| L'IA ne décide rien | « Valider » enregistre sans valider la structuration IA ; rien n'est versé au dossier ni exporté sans `validate`. La priorité manuelle prime. Limite : le front ne distingue pas à l'écran une priorité suggérée d'une priorité choisie (seulement dans le libellé du lecteur d'écran). |
| Zéro information inventée | Puces faites d'éléments ancrés dans le texte des CR, auteur et heure dessous, aucune phrase générée par le résumé ; Mes CR montre le texte brut. Constantes horodatées et sourcées. |
| Des questions, pas des verdicts | Tenu **dans l'API seulement** : le front n'affiche aucune question (P16), on ne remet pas en cause ce que dit l'IDE. Les questions (R manquant, imprécision, info transverse manquante, patient ambigu) restent calculées sur les transmissions (§3). Aucun verdict à l'écran : NEWS2 est montré avec ses entrées. |
| Priorité = suggestion explicable | Chaque raison est calculée (`suggestion.reasons`) et lue par le lecteur d'écran ; NEWS2 sert de plancher à la suggestion seulement. |
| Données 100 % fictives | Scénario `chir-bino` inventé (11 patients, 3 IDE). |
| Aucune clé dans le repo / indépendance fournisseur | Les appels IA restent côté serveur, derrière les ports de `@infirmier/ai`. La dictée en direct envoie le son à l'API (WebSocket), jamais au fournisseur. Le mobile ne dépend que de `@infirmier/domain`. |

## 3. Fonctions gardées dans le backend mais pas affichées

Retirées du front (P10), toujours dans l'API et testées (`apps/api/src/http/*.test.ts`) :

| Fonction | Endpoint(s) |
| --- | --- |
| Relecture d'une transmission : valider, « Plus tard » (non relue), corriger ou retirer une phrase | `reviewTransmission`, `editTransmission`, `getTransmission` |
| Questions à l'IDE (R manquant, imprécisions…), calculées sur chaque transmission ; y répondre ou l'écarter (la réponse devient le R, sourcé par le soignant) | `getTransmission`, `answerFlag` |
| Rattacher ou corriger le patient d'une dictée sans patient présélectionné | `assignPatient` |
| Supprimer un brouillon | `deleteTransmission` |
| Étoile ★, revenir à la suggestion (`manualLevel: null`) | `updatePriority` |
| Fiche de relève par patient (par appareil ou sommaire, infos transverses, « à faire ») | `patientHandover` |
| Vue service triée ★ puis Rouge → Vert, récap « taille SMS » | `unitBoard` (utilisé par Patients sans le tri), `unitPatients`, `unitRecap` |
| Recherche sourcée dans les dictées | `unitSearch` |
| Entrée d'un patient + dictée d'admission (macro-cible d'entrée) | `admitPatient`, `createTransmission` (`mode: 'admission'`) |
| Export FHIR R4 vers le DPI simulé (transmissions validées seulement) | `patientFhir`, `exportToDpi`, `dpiInbox` |
| Horloge du simulateur (réelle ou simulée, heure donnée), rejeu jusqu'à une heure | `setClock`, `loadScenario` (`until` = une heure) |
| Évaluation de l'IA, rejeu en ligne de commande | `pnpm sim eval`, `pnpm sim run <id>` |

## 4. Remettre la démo à zéro

| Moyen | Effet |
| --- | --- |
| Ouvrir `/simulateur` (taper l'URL, ex. `http://localhost:8081/simulateur`) → carte *Chirurgie — journée de Martine, Sophie et Karim* → **Rejouer la journée** | L'hôpital est remplacé par le scénario, les 11 CR de démo repassent par la vraie chaîne (IA configurée), l'horloge simulée repart de 17h45 |
| Même carte → **Partir du début** | Scénario à 7h50, sans aucun CR (pour tout dicter en direct) |
| Arrêter l'API, supprimer `.data/state.json`, relancer | Premier démarrage : `DEFAULT_SCENARIO` (défaut `chir-bino`) rejoué selon `SIM_BOOT` (défaut `end`) |
| `POST /simulation/load` `{"scenarioId": "chir-bino", "until": "end"}` | Comme « Rejouer la journée » (c'est ce que font les tests E2E avant chaque test) |

À savoir :

- Rejouer un scénario remplace tout : patients, CR, choix de priorité, constantes saisies. Les
  brouillons en mémoire de l'appareil restent.
- L'horloge simulée avance en temps réel. Vers 21h45 simulées (environ 4 h après un rejeu), la
  fenêtre de relève passe au poste de nuit : Mes CR et Tous se vident. Rejouer la journée.
- Après un changement de scénario (`rea-box12`, `medecine-journee`, `admission-nuit`), se
  déconnecter puis choisir un soignant de ce scénario sur « Qui es-tu ? ». Le simulateur déconnecte d'office si le soignant n'existe plus **dans son service**
  (le même identifiant, ex. `martine`, peut exister dans un autre service : il est alors déconnecté
  aussi, `lib/session.ts`).
- `DEMO_PASSWORD` (`.env`) ne sert qu'à `POST /session/login`, que le front n'utilise plus.
