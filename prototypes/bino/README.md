# Bino · prototype web (le binôme des infirmiers)

Démo du hackathon IA santé ARS × AdoptAI (novembre 2026), défi Hôpital Foch « infirmier augmenté ».

Bino suit les maquettes papier de l'équipe, aux couleurs du logo (rose Bino, bleu ciel). Connexion par matricule de démo. **Patients** : logo Bino, « Bonjour Prénom », la date, 11 patients triables par **chambre** ou **nom** (pas de priorité sur le dashboard). Un patient ouvre **Nouveau compte rendu** : **Dossier médical**, grande zone de texte, **micro**, **Valider** en bas, puis « ✓ Compte rendu fait ». **Transmissions** : **Mes CR** du plus récent au plus ancien ; **Tous** : résumé en puces par patient, du plus récent au plus ancien, triable par priorité, chambre ou nom ; la priorité 1 à 4 (proposée par l'IA) se change dans la carte via une rangée 1 2 3 4 ; **document complet** à copier ou télécharger.

Le détail de chaque écran, des règles (priorités, NEWS2, zéro information inventée) et du stockage est dans [`FONCTIONNEMENT.md`](FONCTIONNEMENT.md).

> **Données entièrement fictives.** Ne jamais saisir de données réelles de patients : la démo n'est ni hébergée HDS ni conforme RGPD pour des données de santé.

---

## Tester en 30 secondes

**Sur téléphone ou ordinateur :** ouvrez le lien de démo partagé par l'équipe (artifact Claude), ou lancez-le en local (voir plus bas).

Sur iPhone : Safari › Partager › « Sur l'écran d'accueil » pour l'avoir comme une app.

**Parcours de démo conseillé (2 minutes)**

1. Connectez-vous (matricule 10401, mot de passe `bino`). **Patients** : rangés par chambre ; **Trier** : par chambre ou par nom.
2. Touchez M. Jean Dupond (12) : **Nouveau compte rendu**. Ouvrez **Dossier médical** pour voir constantes et NEWS2.
3. Dictez au **micro** (ou écrivez, ou touchez l'exemple), puis **Valider** : « Compte rendu fait ».
4. **Transmissions › Mes CR** : vos comptes rendus, le plus récent en haut. **Tous** : le résumé en puces de toute l'équipe, le plus récent en haut ; touchez « Priorité 3 » de M. Garnier : la rangée 1 2 3 4 s'ouvre dans la carte, choisissez 1 ; **Document complet** pour la relève.

---

## Fonctionnalités

| Écran | Ce qu'on peut faire |
| --- | --- |
| Patients | Logo + prénom + date ; tri par **chambre** ou **nom** ; pas de priorité affichée |
| Nouveau compte rendu | **Dossier médical** (constantes, NEWS2 détaillé, infos, saisie manuelle) ; compte rendu au **micro** ou au clavier ; **Valider** puis « Compte rendu fait » |
| Transmissions | **Mes CR** du plus récent au plus ancien (pas de suppression) ; **Tous** : résumé en puces par patient, du plus récent au plus ancien, auteur et heure sous chaque puce ; **Trier** par priorité, chambre ou nom ; **Priorité 1 à 4** proposée par l'IA (raison factuelle, jamais sous le NEWS2, repli NEWS2), modifiable dans la carte (rangée 1 2 3 4) ; **Document complet** (copier, télécharger) |

### Ce qui marche où

| | Dans Claude (lien artifact) | Cloudflare / local |
| --- | --- | --- |
| Comptes rendus | **Partagés en temps réel** entre tous ceux qui ouvrent le lien | Sur cet appareil seulement |
| Document global | Synthèse par l'IA de Claude | Règles locales (ou clé API Anthropic) |
| « Bonjour … » | Martine par défaut, ou le soignant choisi | Idem |
| Dictée vocale | Chrome ordinateur | Chrome (Android, ordinateur), Safari iOS ; sinon micro du clavier |

Dans Claude, pour que l'équipe puisse écrire, partagez le lien en **Contributeur** (les Lecteurs voient sans écrire).



---

## Lancer en local

Il faut un petit serveur web (les modules JavaScript ne marchent pas en ouvrant le fichier directement).

```bash
cd prototypes/bino
npm start                    # http://localhost:8080
# ou, sans Node :
python3 -m http.server 8080
```

Pour tester sur un téléphone du même Wi-Fi : `http://<IP-de-votre-ordinateur>:8080`. La dictée vocale du navigateur demande HTTPS : utilisez plutôt le lien de démo.

```bash
npm test                     # tests NEWS2, structuration, FHIR (Node 22+)
npm run mock-fhir            # régénère le DPI simulé
```

---

## Place dans le monorepo

Ce dossier est un **prototype autonome** : il n'est pas dans le workspace pnpm et n'importe aucun package
(`domain`, `ai`…). Il sert à montrer vite le parcours et l'identité visuelle Bino, et à tester des idées
(menu Constantes, import DPI FHIR, relève écoutée) avant de les porter dans `apps/mobile` en suivant
`AGENTS.md`. Le lint de l'équipe (Biome) passe sur ce dossier.

## Architecture

Aucune étape de build : HTML, CSS et modules JavaScript natifs.

```
index.html               page unique, barre d'onglets
css/styles.css           identité visuelle Bino (Plus Jakarta Sans, Nunito, magenta, bleu ciel, bleu nuit)
js/app.js                état, actions, feuilles (constantes, réglages)
js/views.js              rendu : en-tête, Patients, popup patient, Transmissions
js/store.js              comptes rendus, synthèses, constantes : base partagée (Claude) ou localStorage
js/synthesis.js          synthèse DAR multi-soignants : prompt IA, règles locales, vérification des sources
js/document.js           document de transmission global (vue, texte à copier, fichier HTML)
js/triage.js             priorités 1 à 4 : prompt IA, garde-fous, repli NEWS2
js/news2.js              calcul NEWS2 (échelle SpO2 n°1)
js/structure.js          dictée → DAR : prompt IA, règles locales de secours, extraction des constantes
js/data.js               patients et dictées d'exemple (fictifs)
js/services/ai.js        IA : Claude (artifact) › clé API Anthropic › désactivée
js/services/voice.js     dictée et synthèse vocale : Claude › Web Speech API
js/services/fhir.js      lecture des constantes (Observation vital-signs, codes LOINC)
mock-fhir/               DPI simulé : un Bundle FHIR R4 par patient
scripts/                 générateur du DPI simulé
tests/                   tests Node (node --test)
```

### Brancher un vrai DPI (pour plus tard)

Le bouton « Import DPI » a été retiré de la fiche patient à la demande de l'équipe ; le module FHIR (`js/services/fhir.js`, testé) et le DPI simulé restent prêts. Pour le rebrancher, dans ⚙, remplacez `./mock-fhir` par l'URL de base d'un serveur FHIR R4. L'app appelle :

```
GET {base}/Observation?patient={id}&category=vital-signs&_sort=-date&_count=50
```

Codes LOINC lus : 9279-1 (FR), 59408-5 / 2708-6 (SpO2), 85354-9 avec 8480-6 / 8462-4 (TA), 8867-4 (FC), 8310-5 (T), 3151-8 (débit d'O2), 67775-7 (conscience ACVPU). Le serveur doit autoriser les appels du navigateur (CORS). L'identifiant FHIR de chaque patient est le champ `fhirId` de `js/data.js`.

### Clé API (optionnel)

La clé saisie dans ⚙ reste dans le navigateur du testeur et sert à appeler directement l'API Anthropic. Prenez une clé de test à budget limité, ne la commitez jamais, et n'utilisez que les données fictives.

---

## Choix de conception

- **Rien n'est inventé.** Un champ non dit reste vide et devient une relance. Le R (résultat) est le plus oublié : Bino le signale au lieu de le deviner.
- **L'humain valide tout.** Les propositions se corrigent d'un appui ; rien n'est versé au dossier sans validation.
- **Aucun geste en plus.** On parle comme à la relève ; l'outil range.
- **Le DPI reste la source de vérité.** Un futur import montrera l'écart avant d'écraser.
- **Une seule vérité pour la relève.** Chacun écrit ses comptes rendus ; la transmission finale les fusionne et garde la trace de qui a dit quoi.

## Pistes suivantes

Relève orale enregistrée et retranscrite, relève « différentielle » par infirmier, trames par service, export FHIR des transmissions validées (`DocumentReference`), hébergement HDS et analyse d'impact.
