# Bino · prototype web (le binôme des infirmiers)

Démo du hackathon IA santé ARS × AdoptAI (novembre 2026), défi Hôpital Foch « infirmier augmenté ».

Bino, en deux onglets. **Patients** : la liste triée par NEWS2 ; une fiche par patient avec ses données en déroulant, un micro et une zone de saisie pour les **comptes rendus**. **Transmission finale** : pour chaque patient, la synthèse DAR de ce que **toute l'équipe** a écrit dans la journée, chaque phrase reliée au compte rendu d'origine. Rien n'est inventé ; ce qui n'a pas été dit reste une question.

> **Données entièrement fictives.** Ne jamais saisir de données réelles de patients : la démo n'est ni hébergée HDS ni conforme RGPD pour des données de santé.

---

## Tester en 30 secondes

**Sur téléphone ou ordinateur :** ouvrez le lien de démo partagé par l'équipe (artifact Claude), ou lancez-le en local (voir plus bas).

Sur iPhone : Safari › Partager › « Sur l'écran d'accueil » pour l'avoir comme une app.

**Parcours de démo conseillé (2 minutes)**

1. **Patients** : la chambre 12 est en tête, NEWS2 7 (critique). Touchez-la.
2. **Données du patient ▾** : constantes et détail du NEWS2, allergies, dispositifs. **Constantes ▾** › **Récupérer depuis le DPI** : le score passe à 9.
3. **Compte rendu** : dictez au micro (ou au clavier), ou touchez l'exemple « Hélène Durand se dégrade », puis **Enregistrer**.
4. **Transmission finale** › **Tout synthétiser** : une synthèse DAR par patient, fusionnant les comptes rendus de Sophie, Karim et le vôtre. **Sources ›** montre qui a dit quoi.
5. **Valider** la synthèse. Si quelqu'un ajoute ou supprime un compte rendu ensuite, Bino propose **Mettre à jour**.
6. **Écouter** ou **Copier** la transmission finale pour la relève.

Le bouton ⚙ (en haut à droite) donne accès aux réglages et à la réinitialisation de la démo.

---

## Fonctionnalités

| Écran | Ce qu'on peut faire |
| --- | --- |
| Patients | Liste triée par NEWS2, nombre de comptes rendus du jour, synchronisation de tout le service avec le DPI |
| Fiche patient | **Données du patient** en déroulant (constantes, NEWS2 détaillé, motif, ATCD, allergies, dispositifs, prescription), menu **Constantes ▾** (DPI ou saisie manuelle), **compte rendu** au micro ou au clavier, comptes rendus du jour signés |
| Transmission finale | Synthèse DAR par patient à partir des comptes rendus de toute l'équipe, sources par phrase, « à faire », soins faits, validation signée, alerte si des comptes rendus ont changé, écoute et copie |

### Ce qui marche où

| | Dans Claude (lien artifact) | Cloudflare / local |
| --- | --- | --- |
| Comptes rendus | **Partagés en temps réel** entre tous ceux qui ouvrent le lien (signés avec leur compte) | Sur cet appareil seulement (prénom saisi dans ⚙) |
| Synthèse par IA | Oui, fournie par Claude | Avec une clé API Anthropic saisie dans ⚙ ; sinon règles locales |
| Dictée vocale | Chrome ordinateur | Chrome (Android, ordinateur), Safari iOS ; sinon micro du clavier |
| Lecture à voix haute | Chrome ordinateur | La plupart des navigateurs |
| Import DPI | DPI simulé | DPI simulé ou vrai serveur FHIR (⚙) |

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
js/views.js              rendu : Patients, fiche patient, Transmission finale
js/store.js              comptes rendus, synthèses, constantes : base partagée (Claude) ou localStorage
js/synthesis.js          transmission finale : prompt IA, règles locales, vérification des sources
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
