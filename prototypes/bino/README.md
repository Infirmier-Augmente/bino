# Bino · prototype web (le binôme des infirmiers)

Démo du hackathon IA santé ARS × AdoptAI (novembre 2026), défi Hôpital Foch « infirmier augmenté ».

Bino transforme ce que l'infirmier dit en transmissions ciblées **DAR**, prépare la **relève** pour l'équipe suivante, calcule le **NEWS2** et récupère les constantes depuis le **DPI** (FHIR). L'infirmier valide toujours : rien n'est inventé, chaque ligne renvoie à la phrase dite.

> **Données entièrement fictives.** Ne jamais saisir de données réelles de patients : la démo n'est ni hébergée HDS ni conforme RGPD pour des données de santé.

---

## Tester en 30 secondes

**Sur téléphone ou ordinateur :** ouvrez le lien de démo partagé par l'équipe (artifact Claude), ou lancez-le en local (voir plus bas).

Sur iPhone : Safari › Partager › « Sur l'écran d'accueil » pour l'avoir comme une app.

**Parcours de démo conseillé (2 minutes)**

1. **Patients** : la chambre 12 est en tête, NEWS2 7 (critique). Touchez-la.
2. Bouton **Constantes ▾** › **Récupérer depuis le DPI** : comparez les valeurs, importez, le score passe à 9.
3. **Dicter une transmission** › exemple « Mme D. se dégrade » › **Structurer** : 2 cibles DAR, les résultats manquants sont signalés sans être inventés.
4. Complétez un R à la voix ou au clavier, puis **Valider**. Les R restés vides deviennent des relances dans **Alertes**.
5. **Alertes** › NEWS2 critique › **Préparer l'appel SAED** : message prêt à lire au médecin.
6. **Relève** : synthèse par priorité, ce qui a changé depuis 8h, tâches, **Écouter**, questions à Bino, addendum après 19h45.

Le bouton ⚙ (en haut à droite) donne accès aux réglages et à la réinitialisation de la démo.

---

## Fonctionnalités

| Écran | Ce qu'on peut faire |
| --- | --- |
| Patients | Liste triée par NEWS2, synchronisation de tout le service avec le DPI, fiche patient avec détail du score |
| Constantes ▾ | **Récupérer depuis le DPI** (FHIR R4), **saisie manuelle** avec score recalculé en direct, **dicter les constantes** (« FR 22, sat 95, tension 120 sur 70 ») |
| Transmission | Dictée ou saisie, structuration en cibles DAR, source de chaque ligne (« Entendu › »), correction d'un appui, constantes dictées qui mettent à jour le NEWS2 |
| Relève | Compteurs, contrôle avant transmission, points clés par priorité, différences depuis le matin, tâches, lecture à voix haute, questions, addendum |
| Alertes | NEWS2 élevé ou critique, nouvelle prescription, dispositif à J4, relance des résultats non réévalués, appel SAED |

### Ce qui marche où

| | Dans Claude (lien artifact) | En local / hébergé |
| --- | --- | --- |
| Structuration et questions par IA | Oui, fournie par Claude | Avec une clé API Anthropic saisie dans ⚙ ; sinon règles locales |
| Dictée vocale | Chrome ordinateur | Chrome (Android, ordinateur), Safari iOS ; sinon micro du clavier |
| Lecture de la relève | Chrome ordinateur | Navigateurs avec synthèse vocale (la plupart) |
| Import DPI | DPI simulé | DPI simulé ou vrai serveur FHIR (⚙) |

Les deux dictées d'exemple (chambres 12 et 8) donnent toujours le même résultat, même sans IA : c'est la valeur sûre pour une présentation.

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
css/styles.css           identité visuelle Bino (Roboto, magenta, bleu ciel, bleu nuit)
js/app.js                écrans, feuilles, actions
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
- **Le bon format au bon moment.** DAR pour les transmissions (méthode IFSI), SAED pour l'appel au médecin (HAS).

## Pistes suivantes

Relève orale enregistrée et retranscrite, relève « différentielle » par infirmier, trames par service, export FHIR des transmissions validées (`DocumentReference`), hébergement HDS et analyse d'impact.
