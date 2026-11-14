# Script de démo (≈ 5 min)

## Préparation (avant de monter sur scène)

1. `.env` : `LLM_PROVIDER=deepseek` + clé, `CLASSIFIER_PROVIDER=jev` + clé (sinon moteur local),
   `STT_PROVIDER=openai` + clé pour la transcription (sinon reconnaissance du navigateur).
2. `pnpm dev:api` puis `pnpm dev:web` (PC). Sur le téléphone (même Wi-Fi) : ouvrir
   `http://<IP-du-PC>:8081` dans Chrome/Safari, ou Expo Go via `pnpm dev:app`. Dans un navigateur
   de téléphone, le micro n'est autorisé qu'en **HTTPS** (tunnel, ex. `cloudflared tunnel --url`).
   Réglages → Serveur si l'adresse de l'API n'est pas trouvée.
3. Simulateur → **« Préparer la démo (16h25) »** sur *Réa — journée de Martine* : la journée est rejouée
   jusqu'à 16h25, l'exemple A reste à dicter en direct.
4. PC : onglet Relève. Téléphone : connecté en tant que Martine.

## Déroulé

| Temps | Écran | Ce qu'on dit |
| --- | --- | --- |
| 0:00 | — | « Martine, 12 h de poste, écrit ses transmissions après l'heure. Le premier besoin du terrain : du temps. » |
| 0:30 | Téléphone, liste | « Ses patients, triés. Un seul bouton : Dicter. » |
| 0:45 | Dictée | Dicter (ou « Exemples » → *exemple A du kit*) : « Alors monsieur du box 12… » Le texte s'affiche en direct. |
| 1:30 | Relecture | « Le bon patient. Deux cibles DAR. Le **R n'est pas inventé** : il est posé en question. Je touche une phrase : voici l'extrait exact de ma dictée. » |
| 2:15 | Relecture | Répondre au R : « SpO2 95 % sous 3 L, bien toléré » → Valider. « 1 geste. Rien n'est versé sans moi. » |
| 2:45 | PC, Relève | Simulateur → horloge 19h40. « La relève : ★ puis Rouge → Vert, la couleur est une suggestion **expliquée**, Martine garde la main. » |
| 3:15 | Fiche Box 12 | « La fiche de l'exemple B du kit, construite toute seule pendant le poste. Infos transverses : BMR, allergies. » |
| 3:45 | Mode réunion + récap SMS | « On ne supprime pas la relève orale, on la prépare. Pour qui l'a ratée : le récap. » |
| 4:15 | Entrée | « Le DPI bloque l'admission sans cible : ici, dictée libre → macro-cible d'entrée, et l'outil demande les allergies. » |
| 4:40 | Export DPI | « On ne remplace pas le DPI : export FHIR. Couche au-dessus de l'existant. » |
| 5:00 | — | « Aucun fournisseur imposé : DeepSeek aujourd'hui, un modèle hébergé HDS demain, une ligne de config. » |

## Pépites à placer

- « Qui va m'offrir ma pizza ? » : on garde le moment collectif de la relève.
- « L'IA ne décide rien : elle range, résume et vous dit ce qui manque. »
- Analogie Word : un correcteur qui souligne en rouge rend aveugle au reste → on pose des questions.
- Mesuré sur nos scénarios : 133/133 vérifications, 0 information inventée.

## Si quelque chose casse

- Pas de réseau / LLM HS : l'app bascule seule en moteur local (badge « Mode dégradé »).
- Micro refusé : « Exemples de dictée » (mode démo) ou clavier.
- État bizarre : Simulateur → « Rejouer la journée ».
