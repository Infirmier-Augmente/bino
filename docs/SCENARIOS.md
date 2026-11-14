# Simulateur d'hôpital et scénarios

Pas d'accès à un vrai hôpital pendant le hackathon : on en simule un. Tout est **fictif**.

## Ce qu'est un scénario

Un état initial (service, soignants, patients avec infos transverses) + une chronologie d'événements :

| Événement | Effet |
| --- | --- |
| `dictation` | Une dictée passe par la **vraie** chaîne (patient, DAR, sources), puis `review` : `validate`, `defer` ou `none` |
| `admit` | Un patient entre (suivi en général d'une dictée `mode: 'admission'`) |
| `priority` | ★ ou couleur manuelle |
| `narration` | Texte pour la personne qui fait la démo |

Chaque dictée peut porter des **attentes** (`expect`) : bon patient, cibles attendues, R manquant,
soins de routine, « à faire », chaînes interdites (inventions plausibles). Elles servent à l'évaluation.

## Scénarios fournis

| id | Contenu |
| --- | --- |
| `chir-bino` | **Scénario par défaut.** Chirurgie polyvalente, 11 chambres, poste de jour : la démo de l'équipe (prototype Bino). 3 IDE avec matricule (10482 Martine Dubois, 10401 Sophie Lemoine, 10415 Karim Haddad, mot de passe `bino`), constantes et dispositifs de chaque patient (NEWS2 7 pour M. Dupond, chambre 12), 11 comptes rendus de démo laissés « à relire », 2 exemples de dictée (« M. Dupond se dégrade », « Mme Berger, journée calme »). L'horloge finit à 17h45, après les dernières constantes. |
| `rea-box12` | Réa, 4 box, poste de jour. Exemple A du kit à 16h30 (Box 12), compte rendu « suivi nuit » (jargon), confusion, fièvre. La fiche du Box 12 doit ressembler à l'exemple B. |
| `medecine-journee` | Médecine, 12 patients, trame sommaire : douleur (DAR complet), chute, vomissements sans R, fièvre, confusion, noms proches (Martin / Martins) |
| `admission-nuit` | Réa de nuit : entrée en pleine nuit + dictée d'admission sans allergies, désaturation, agitation à 3h, dictée parlant de deux patients |

## Utiliser

Dans l'app : écran `/simulateur`, accessible par l'URL seulement (pas d'onglet). Il rejoue une
journée (**Rejouer la journée**), repart du début (**Partir du début**) ou avance d'un événement.
Après un changement de scénario, se connecter avec un matricule de ce scénario (affiché sur l'écran
de connexion). L'horloge se règle par l'API (`POST /simulation/clock`), plus depuis l'app.
Détail et pièges (fenêtre de relève, horloge qui avance) : [FONCTIONNEMENT.md §4](FONCTIONNEMENT.md#4-remettre-la-démo-à-zéro).

En ligne de commande :

```bash
pnpm sim list
pnpm sim run chir-bino        # rejoue et imprime vue service + fiches
pnpm sim eval                 # tous les scénarios, avec l'IA configurée dans .env
pnpm sim eval rea-box12 --json
```

`pnpm sim eval` sort en erreur si une **invention** est détectée : la CI l'exécute avec le moteur local.

## Écrire un scénario

1. Copier `packages/simulation/src/scenarios/rea-box12.ts`.
2. Utiliser `scenarioDay('2026-11-14')` pour les heures (`at('16:30')`, `at('02:10', 1)` après minuit),
   `patient({...})` et `record(...)` pour les infos du dossier.
3. Écrire les dictées **comme on parle** (« Alors le monsieur du 12… vers 16h… la noradré »).
4. Ajouter des `expect` réalistes, dont des `forbidden` (ce qu'une IA pourrait inventer).
5. Enregistrer dans `SCENARIOS` (`packages/simulation/src/index.ts`).
6. `pnpm --filter @infirmier/simulation test` vérifie la cohérence (ids, soignants, horaires).

Identifiants de patients uniques **entre tous les scénarios** (préfixer : `med-…`, `nuit-…`).
