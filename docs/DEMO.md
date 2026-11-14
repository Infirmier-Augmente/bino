# Script de démo (≈ 5 min)

Parcours du front « Bino » sur le scénario `chir-bino` (Chirurgie polyvalente, 11 patients).
Comportement détaillé : [FONCTIONNEMENT.md](FONCTIONNEMENT.md).

## Préparation (avant de monter sur scène)

1. `.env` : `LLM_PROVIDER=deepseek` + clé, `CLASSIFIER_PROVIDER=jev` + clé (sinon moteur local),
   `STT_PROVIDER=openai` + `STT_API_KEY` + `STT_MODEL=gpt-transcribe` pour la dictée en direct
   (`STT_LIVE_MODEL` vide = `gpt-live-transcribe`), sinon reconnaissance du navigateur. Au démarrage,
   l'API affiche « STT openai (gpt-transcribe), direct gpt-live-transcribe ».
   Garder `DEFAULT_SCENARIO=chir-bino`, `SIM_BOOT=end`, `DEMO_PASSWORD=bino` (valeurs par défaut).
2. `pnpm dev:api` puis `pnpm dev:web` (PC). Au premier démarrage, l'API rejoue `chir-bino` : les
   11 CR de démo passent par l'IA configurée (environ 2 s chacun avec un LLM). Un
   `.data/state.json` déjà présent est gardé : dans ce cas, remettre à zéro (étape 4).
3. Téléphone, au choix :
   - **Expo Go** (`pnpm dev:app`, même Wi-Fi) : le micro marche sans HTTPS. La capture de la dictée
     en direct sur l'app native n'est pas encore testée sur un appareil : la répéter avant ;
   - **navigateur du téléphone** : le micro n'y est autorisé qu'en **HTTPS**. Ouvrir deux tunnels,
     ex. `cloudflared tunnel --url http://localhost:8081` (app) et
     `cloudflared tunnel --url http://localhost:8787` (API). Ouvrir l'adresse HTTPS de l'app, aller
     sur `/serveur`, coller l'adresse HTTPS de l'API, **Tester et enregistrer** (une page HTTPS ne
     peut pas appeler une API en HTTP). Le WebSocket de la dictée en direct passe par le tunnel de
     l'API (`wss://`, vérifié).
4. Moins de 4 h avant : ouvrir `/simulateur` (taper l'URL) → carte *Chirurgie — journée de Martine,
   Sophie et Karim* → **Rejouer la journée**. L'horloge simulée repart de 17h45 ; vers 21h45
   simulées, Tous et Mes CR passent au poste de nuit et se vident.
5. Téléphone : sur l'écran Connexion (se déconnecter si besoin). PC : connecté en Karim
   (**10415** / `bino`), sur Transmissions › Tous. L'app web garde la session par navigateur :
   pour deux soignants sur un même PC, utiliser deux navigateurs.

## Déroulé

| Temps | Écran | Ce qu'on fait et ce qu'on dit |
| --- | --- | --- |
| 0:00 | — | « Martine, 12 h de poste, écrit ses transmissions après l'heure. Le premier besoin du terrain : du temps. » |
| 0:20 | Téléphone, Connexion | **10482** / `bino` → « Connexion réussie » → **Continuer**. « Un matricule pour la démo ; la carte CPS en V2. » |
| 0:30 | Patients | « Ses 11 patients, par chambre. Pas de tâche en plus : elle touche celui qu'elle vient de voir. » Toucher **M. Jean Dupond** (CHAMB 12). |
| 0:45 | Fiche, Dossier médical | Déplier : « Constantes de 17h40, NEWS2 7 : FR 24, +2 ; tension 98/62, +2. Le score montre ses entrées : une aide au calcul, pas un verdict. » |
| 1:15 | Fiche, micro | Toucher le micro : il change tout de suite, petite vibration sur téléphone (pas dans Safari iOS), « Enregistrement 0:01 ». Dicter (ou la puce **Exemple : M. Dupond se dégrade**) : « Chambre 12, M. Dupond. Il est plus essoufflé qu'à 14h… » Le texte s'affiche en gris pendant qu'on parle. Arrêter : « Finalisation… », puis le texte final, chiffres compris, le remplace en 1 à 2 s. « Le texte gris aide à suivre ; on garde celui retranscrit sur toute la dictée. » |
| 1:50 | Fiche | **Valider** → « Compte rendu fait ». « Signé, horodaté, un geste. » |
| 2:00 | Transmissions › Mes CR | « Son compte rendu en tête, tel qu'elle l'a dit. » |
| 2:15 | Tous, carte M. Dupond | « Les CR de Sophie à 8h10, de Karim à 14h05 et de Martine, rangés par thème. Sous chaque puce : qui et quand. Le résumé n'écrit rien : il regroupe des éléments sourcés. Et il ne lui pose pas de questions : on ne remet pas en cause ce qu'elle a dit. » |
| 3:00 | Tous, priorités | « M. Dupond est en Priorité 1 : le NEWS2 sert de plancher à la suggestion. » Sur M. Louis Garnier (CHAMB 14), toucher **Priorité n**, puis **1** → « Priorité 1 enregistrée. », la liste se retrie. « Le choix de l'infirmière prime toujours. » |
| 3:40 | PC, Karim sur Tous | « Sur le PC du poste, le CR de Martine est déjà là (rafraîchi toutes les 5 s). On ne supprime pas la relève orale : on la prépare. » |
| 4:10 | — | « Valider n'a rien signé à sa place : la structuration de l'IA reste à relire. Relecture, fiche de relève, export FHIR vers le DPI : prêts dans l'API pour la suite. » |
| 4:40 | — | « Aucun fournisseur imposé : DeepSeek aujourd'hui, un modèle hébergé HDS demain, une ligne de config. » |

## Pépites à placer

- « Qui va m'offrir ma pizza ? » : on garde le moment collectif de la relève.
- « L'IA ne décide rien : elle range et résume, l'infirmière garde la main. »
- Analogie Word : un correcteur qui souligne en rouge rend aveugle au reste → pas de verdict à
  l'écran, ni de question qui remet en cause ce qu'elle a dit.
- Mesuré le 14/11 sur 26 dictées (réa, médecine, nuit) : 133/133 vérifications, 0 information inventée.

## Si quelque chose casse

- LLM injoignable ou trop lent : le serveur bascule seul sur le moteur local et le CR est enregistré
  (ce front n'affiche pas de badge « mode dégradé »).
- Micro refusé ou indisponible : puce **Exemple** (chambres 12 et 10), ou micro du clavier.
- Transcription échouée (transcription à la fin) : **Réessayer l'envoi de la dictée** sous le micro.
- Dictée en direct : connexion refusée → l'app enregistre puis transcrit, sans rien dire. Texte final
  absent au bout de 20 s → le texte gris est gardé, à relire.
- Dictée en direct qui ne démarre pas sur l'app native : `STT_LIVE_MODEL=none` dans `.env`, relancer
  l'API (l'app enregistre puis transcrit).
- Téléphone sans données : lien « Serveur injoignable : régler l'adresse » sur la connexion, ou `/serveur`.
- Tous vide, ou état bizarre : `/simulateur` → **Rejouer la journée** (carte Chirurgie).
