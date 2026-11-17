# Bino : ce que fait l'app, en détail

Bino est le binôme numérique des infirmiers (IDE) : chacun écrit ou dicte ses **comptes rendus (CR)**
au fil du poste, et l'app prépare la **transmission finale** de toute l'équipe pour la relève.
Prototype du hackathon IA santé ARS × AdoptAI (défi Hôpital Foch, novembre 2026).

> **Données 100 % fictives.** Patients, soignants, constantes et comptes rendus sont inventés.
> Aucune donnée réelle ne doit être saisie dans l'app.

Ce document décrit le comportement visible écran par écran, puis ce qui se passe derrière
(IA, règles, stockage). Le `README.md` explique comment lancer l'app.

---

## 1. Connexion

- Écran d'accueil avec la mascotte Bino : **matricule** + **mot de passe**.
- Comptes de démo (mot de passe `bino` pour tous) :

  | Matricule | Soignant              |
  | --------- | --------------------- |
  | 10401     | Martine Dubois · IDE  |
  | 10482     | Sophie Lemoine · IDE  |
  | 10415     | Karim Haddad · IDE    |

- Une fois connecté : écran « Connexion réussie » puis **Continuer**.
- Le mot de passe n'est jamais enregistré ; seuls le matricule et le nom restent dans le navigateur.
- **Déconnexion** en haut à droite des deux onglets.
- Le nom du soignant connecté sert à signer ses comptes rendus (« Mes CR » = ceux qu'il a signés).

## 2. Onglet Patients (dashboard)

- **En-tête** : mascotte Bino, « Bonjour Prénom » (soignant connecté), `Date : jj/mm/aaaa`.
- **Liste des 11 patients** du service, avec un compteur. Chaque ligne affiche :
  - le nom ;
  - l'âge et le motif d'hospitalisation ;
  - la chambre (`ch12`).
- **Trier** : par **chambre** (par défaut) ou par **nom** de famille. Le choix est mémorisé.
- **Pas de priorité sur le dashboard** : elle se gère dans Transmissions › Tous.
- Toucher un patient ouvre la fiche **Nouveau compte rendu**.

## 3. Fiche « Nouveau compte rendu »

Plein écran, du haut vers le bas :

1. Titre **Nouveau compte rendu**, nom du patient, `Chambre n · âge`.
2. **Dossier médical** (bouton dépliable) :
   - tableau des constantes (FR, SpO2, O2, TA, FC, température, conscience) avec les points
     **NEWS2** de chaque paramètre et le total ;
   - **Modifier les constantes** : saisie manuelle, le NEWS2 se recalcule en direct ;
   - motif, antécédents, allergies, précautions, dispositifs (avec le jour J), nouvelle
     prescription, famille.
3. **Grande zone de texte** : le compte rendu, écrit « comme à la relève ».
4. **Micro** centré : dictée vocale qui remplit la zone de texte (toucher à nouveau pour arrêter).
   Pour deux patients (M. Dupond ch12, Mme Berger ch10), un exemple de CR peut être inséré.
5. **Valider**, fixé en bas : enregistre le CR, puis la popup « ✓ Compte rendu fait », puis
   retour à la liste.

Le CR enregistré est horodaté et signé. Il ne s'affiche plus dans la fiche : on le retrouve dans
Transmissions › Mes CR. Chaque nouveau CR relance le calcul des priorités (voir §6).

## 4. Onglet Transmissions › Mes CR

- Les comptes rendus **écrits par le soignant connecté** aujourd'hui (liste seule, sans phrase
  d'en-tête).
- Ordre : **du plus récent au plus ancien**.
- Chaque CR : patient, chambre, heure, texte intégral.
- Pas de suppression (traçabilité de ce qui a été transmis).

## 5. Onglet Transmissions › Tous

La transmission finale de **toute l'équipe**, une carte par patient.

- Cartes rangées par **priorité** (1 en haut), sans menu de tri.
- **Carte patient** :
  - nom + chambre ;
  - bouton **Priorité n**, à la couleur de son niveau ;
  - **résumé en puces**, fusionnant les CR de tous les soignants : une puce par thème
    (douleur, respiratoire, alimentation…), **de la plus récente à la plus ancienne** ;
  - sous chaque puce, **qui l'a dit et à quelle heure** (ex. `Karim 14h05 · Sophie 8h10`),
    du plus récent au plus ancien ;
  - « Aucun compte rendu aujourd'hui » si rien n'a été écrit.
- **Changer la priorité** : toucher **Priorité n** déplie juste en dessous, **dans la carte**,
  une petite rangée de cercles **1 2 3 4** (pas de nouvelle fenêtre).
  - Le niveau actuel est rempli de sa couleur.
  - Toucher un chiffre enregistre le choix, replie la rangée et réordonne la liste.
  - La raison de la priorité n'est plus affichée à l'écran : elle reste dans l'infobulle du
    bouton et dans le libellé lu par les lecteurs d'écran.
- Pendant le calcul des résumés : « Mise à jour des résumés 2/5 ».

### Les priorités

| Priorité | Niveau interne | Sens              | Couleur                |
| -------- | -------------- | ----------------- | ---------------------- |
| 1        | critique       | la plus urgente   | rose Bino foncé        |
| 2        | élevé          | à voir rapidement | rose clair             |
| 3        | moyen          | à surveiller      | bleu ciel              |
| 4        | faible         | stable            | gris                   |

Les couleurs suivent le logo (rose `#FF0066`, bleu ciel `#5BB8F0`, bleu nuit `#002244`) et sont
toujours doublées du libellé « Priorité n ».

## 6. Calcul de la priorité

Ordre de décision pour chaque patient :

1. **Choix manuel de l'infirmière** : il prime toujours.
2. Sinon, **proposition de l'IA** : elle classe tous les patients d'après les constantes et les CR
   du jour, avec une **raison courte et factuelle** (6 à 14 mots, uniquement des faits présents).
3. Sinon (IA indisponible), **niveau NEWS2**, avec la raison `NEWS2 n · paramètres qui pèsent`.

Garde-fous appliqués à la réponse de l'IA (`js/triage.js`) :

- l'IA ne peut **jamais descendre un patient sous le niveau de son NEWS2** (elle peut le monter
  si un CR est inquiétant) ;
- identifiants inconnus et doublons ignorés, niveaux invalides remplacés par le NEWS2 ;
- un patient oublié est ajouté avec sa raison NEWS2.

Le calcul est relancé automatiquement quand les constantes ou les CR changent (signature des
données), et à l'ouverture de l'app.

**Seuils NEWS2** (`js/news2.js`, convention de la démo) : 7 et plus = critique (priorité 1),
5 à 6 = élevé (2), 3 à 4 ou un paramètre à 3 points = moyen (3), sinon faible (4).

## 7. Document complet (transmission de relève)

> Le bouton **Document complet** a été retiré de l'écran Tous à la demande de l'équipe. Le module
> (`js/document.js`, testé) et les actions de l'app restent en place pour le remettre au besoin.

Ce qu'il fait quand il est branché :

- synthétise chaque patient qui a des CR (plusieurs en parallèle, avec l'avancement affiché) ;
- assemble un document daté avec :
  - l'en-tête du service, le nombre de CR et les soignants contributeurs ;
  - un encadré **Priorités** (patients en priorité 1 et 2, avec NEWS2) ;
  - par patient, rangé par priorité : chambre, priorité, constantes et NEWS2, puis
    **transmissions ciblées DAR** (Données, Actions, Résultats) et « à faire » ;
- **un résultat (R) manquant devient une question** (« Résultat non renseigné : quelle
  réévaluation ? »), jamais une supposition ;
- actions : **Copier** (texte brut) ou **Télécharger** (fichier HTML imprimable).

## 8. Synthèse et règle « zéro information inventée »

Pour chaque patient, la synthèse (`js/synthesis.js`) reçoit les CR numérotés (`cr1`, `cr2`…)
avec heure et auteur, et doit rendre des puces (6 au plus), des cibles DAR, des soins et des
« à faire ».

Chaque élément doit citer **au moins un extrait exact** d'un CR :

- l'extrait est vérifié : il doit se trouver mot pour mot dans le CR cité (casse et espaces
  normalisés) ;
- un élément sans extrait valable est **écarté** ;
- une cible sans Données (D) est écartée.

La synthèse est mise en cache et refaite seulement si la liste des CR du patient change (ou si
le format de synthèse évolue).

**Sans IA**, des règles locales (`js/structure.js`) découpent les CR en phrases, les rangent par
thème (douleur, respiratoire, hyperthermie, élimination, alimentation, famille, constantes…) et extraient les constantes
dictées (FR, SpO2, TA, FC, température). Le résultat est moins fin mais reste sourcé.

## 9. D'où vient l'IA

Le navigateur envoie la dictée à l'API (`POST /transmissions`). L'API structure la note (OpenRouter, repli sur les règles locales) et ne garde une phrase que si l'extrait est dans la dictée. Le Worker ne contient pas de clé de modèle.

## 10. Dictée vocale

`js/services/voice.js` :

- dans Claude, la capacité `dictation` ;
- sinon, l'API Web Speech du navigateur (Chrome ordinateur ou Android, Safari iOS) ;
- sinon, le micro du clavier du téléphone fonctionne aussi dans la zone de texte.

## 11. Stockage

Chaque navigateur a sa copie du scénario, servie par l'API via `/api/bino`. Le Worker ne garde pas les notes. Si l'API ne répond pas, la liste reste vide.

## 12. Lignes rouges

| Règle | Dans Bino |
| --- | --- |
| L'IA ne décide rien | La note reste à relire tant que l'infirmière ne confirme pas la relève |
| Zéro information inventée | L'API écarte une phrase dont l'extrait n'est pas dans la dictée |
| Priorité = suggestion | Le choix manuel prime |
| Données fictives | Scénario de réanimation, quatre patients |
| Aucune clé dans le repo | OpenRouter est sur le mini ; le Worker ne reçoit que le secret du tunnel |

## 13. Carte des fichiers

```
index.html, css/styles.css, js/   le site
js/store.js, js/bino-api.js       lecture et écriture vers l'API
worker/index.js                   fichiers statiques et relais /api/bino
tests/                            score NEWS2
```

## 14. Vérifier

```bash
cd prototypes/bino
node --test tests/*.test.mjs
```
