# Bino · prototype web (le binôme des infirmiers)

Démo du hackathon IA santé ARS × AdoptAI (novembre 2026), défi Hôpital Foch « infirmier augmenté ».

Bino suit les maquettes papier de l'équipe. **Patients** : « Bonjour Martine » (l'infirmière simulée), la date, 11 patients avec la chambre à droite. Un toucher ouvre la **fiche patient** : **Dossier médical** et **Import DPI**, zone de compte rendu, **micro**, **Valider**, puis « ✓ Compte rendu fait ». Le compte rendu part dans **Transmissions › Mes CR**. Dans **Tous** : les comptes rendus de toute l'équipe, un filtre par soignant et la **génération d'un document de transmission global** (copier, télécharger).

> **Données entièrement fictives.** Ne jamais saisir de données réelles de patients : la démo n'est ni hébergée HDS ni conforme RGPD pour des données de santé.

---

## Tester en 30 secondes

**Sur téléphone ou ordinateur :** ouvrez le lien de démo partagé par l'équipe (artifact Claude), ou lancez-le en local (voir plus bas).

Sur iPhone : Safari › Partager › « Sur l'écran d'accueil » pour l'avoir comme une app.

**Parcours de démo conseillé (2 minutes)**

1. **Patients** : « Bonjour Martine ». Touchez M. Jean Dupond (ch12).
2. **Import DPI** : comparez les valeurs, importez, le NEWS2 passe à 9. **Dossier médical** montre le détail.
3. Dictez au **micro** (ou écrivez, ou touchez l'exemple), puis **Valider** : « Compte rendu fait ».
4. **Transmissions › Mes CR** : votre compte rendu, avec ceux de Martine plus tôt dans la journée.
5. **Tous** › **Générer le document** : la transmission de tout le service, patient par patient, priorités en tête. **Copier** ou **Télécharger**.
6. L'avatar permet de **devenir Sophie ou Karim** pour montrer que chacun a « ses » CR.

L'avatar (en haut à droite) ouvre le profil : soignant simulé (Martine, Sophie, Karim), serveur DPI, réinitialisation de la démo.

---

## Fonctionnalités

| Écran | Ce qu'on peut faire |
| --- | --- |
| Patients | « Bonjour Martine » + date, 11 patients triés par NEWS2 (couleur à gauche), chambre à droite, synchronisation du service avec le DPI |
| Fiche patient | Boutons **Dossier médical** (constantes, NEWS2 détaillé, motif, ATCD, allergies, dispositifs, prescription, saisie manuelle) et **Import DPI** ; compte rendu au **micro** ou au clavier ; **Valider** puis « Compte rendu fait » |
| Transmissions | **Mes CR / Tous**, filtre par soignant, suppression de ses propres CR ; dans **Tous**, **document de transmission global** (synthèse DAR par patient à partir des CR de l'équipe, priorités, sources), à copier ou télécharger |

### Ce qui marche où

| | Dans Claude (lien artifact) | Cloudflare / local |
| --- | --- | --- |
| Comptes rendus | **Partagés en temps réel** entre tous ceux qui ouvrent le lien | Sur cet appareil seulement |
| Document global | Synthèse par l'IA de Claude | Règles locales (ou clé API Anthropic) |
| « Bonjour … » | Martine par défaut, ou le soignant choisi | Idem |
| Dictée vocale | Chrome ordinateur | Chrome (Android, ordinateur), Safari iOS ; sinon micro du clavier |
| Import DPI | DPI simulé | DPI simulé ou vrai serveur FHIR (profil) |

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
js/app.js                état, actions, feuilles (constantes, DPI, réglages)
js/views.js              rendu : en-tête, Patients, popup patient, Transmissions
js/store.js              comptes rendus, synthèses, constantes : base partagée (Claude) ou localStorage
js/synthesis.js          synthèse DAR multi-soignants : prompt IA, règles locales, vérification des sources
js/document.js           document de transmission global (vue, texte à copier, fichier HTML)
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

### Brancher un vrai DPI

Dans ⚙, remplacez `./mock-fhir` par l'URL de base d'un serveur FHIR R4. L'app appelle :

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
- **Le DPI reste la source de vérité.** L'import montre l'écart avant d'écraser.
- **Une seule vérité pour la relève.** Chacun écrit ses comptes rendus ; la transmission finale les fusionne et garde la trace de qui a dit quoi.

## Pistes suivantes

Relève orale enregistrée et retranscrite, relève « différentielle » par infirmier, trames par service, export FHIR des transmissions validées (`DocumentReference`), hébergement HDS et analyse d'impact.
