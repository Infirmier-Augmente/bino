# Design

Identité « Bino », reprise des maquettes de l'équipe (DECISIONS P10, T21). Les valeurs viennent de
`apps/mobile/src/ui/theme.ts` : en cas d'écart, le code fait foi.

> **Écart en attente d'une décision d'équipe.** AGENTS.md §9 demande toujours la police
> **Atkinson Hyperlegible** et interdit la « bordure latérale colorée décorative ». Le front utilise
> **Nunito + Plus Jakarta Sans** et une **barre gauche de 4 px** sur les cartes (bleu ciel sur
> Patients, couleur de priorité sur Tous). AGENTS.md n'est pas modifié tant que l'équipe n'a pas
> tranché (T21).

## Principes

1. **Un geste par compte rendu.** Toucher le patient, écrire ou dicter, **Valider**.
2. **Lisible après 12 h de poste.** Texte bleu nuit sur blanc. Lecture en 15 à 17 px (compte rendu
   17, champs 16, corps et puces 15). Les petits textes (11 à 13 px) sont réservés aux mentions
   secondaires : auteur et heure, indices, onglets. Cibles tactiles de 44 px au moins.
3. **La source reste visible.** Sous chaque puce : qui l'a dit et à quelle heure.
4. **Pas de question à l'IDE.** Le front ne remet pas en cause ce qu'elle a écrit ou dicté : aucune
   question sous les puces (DECISIONS P16). Les questions restent dans l'API (relecture).
5. **L'IDE garde la main.** Priorité modifiable d'un toucher ; NEWS2 toujours affiché avec ses
   entrées et ses points.
6. **Une seule app.** Une colonne de 440 px au plus, centrée, onglets en bas, sur téléphone comme
   sur ordinateur. Thème clair seulement (`userInterfaceStyle: light`).

## Couleurs

| Rôle | Valeur | Usage |
| --- | --- | --- |
| Bleu nuit (encre) | `#002244` | texte, contour de la pilule « Dossier médical », puces |
| Magenta (marque) | `#FF0066`, appuyé `#D6005A` | action principale : **Valider**, **Se connecter**, micro et son halo, bordure de la zone pendant la dictée, onglet et segment actifs, compteur, liens texte |
| Bleu ciel | `#5BB8F0`, fond à 18 % | pastille « CHAMB 12 », barre des cartes patient ; à 25 %, surlignage d'un segment dicté qui devient définitif (s'efface en 600 ms) |
| Fond, cartes | `#FFFFFF` | page, cartes (filet 1 px, pas d'ombre) |
| Texte secondaire | `#5F5F5F` | sous-titres, auteur et heure, libellés du dossier, ligne d'état de la dictée, texte provisoire de la dictée (en italique ; le définitif passe en bleu nuit) |
| Filets | `rgba(0,34,68,0.1)`, tableau `#EEF1F4` | contour des cartes, séparateurs |
| Champ | bordure `#C3CCD5`, focus `#9FD3F6` | saisie (contour bleu clair au focus) |
| Avertissement | `#9A4A06`, fond `#FDF1E3` (`warnSoft`) | ton `warn`, prévu pour les bandeaux d'avertissement ; plus utilisé à l'écran depuis le retrait des questions sous les puces (P16) |
| Erreur | `#DC0000` | messages d'erreur |
| Succès | `#13804A` (fond `rgba(34,181,115,0.14)`) | coche de la popup « Compte rendu fait », « Connexion OK » |
| Voile | `rgba(0,20,40,0.45)` | derrière la feuille et la popup |

### Priorité : toujours « Priorité n »

| Libellé | Fond | Texte | Cercle non choisi |
| --- | --- | --- | --- |
| Priorité 1 | `#DC0000` | blanc | `#DC0000` |
| Priorité 2 | `#DC0000` | blanc | `#DC0000` |
| Priorité 3 | `#F5B700` | `#1A1A1A` | `#8A6500` (plus foncé, pour la lisibilité) |
| Priorité 4 | `#1B8A4A` | blanc | `#1B8A4A` |

Les priorités 1 et 2 partagent le rouge du prototype : seul le libellé « Priorité n » les distingue.
La couleur n'est donc **jamais seule** : bouton « Priorité n », cercles numérotés 1 à 4, barre de la
carte. Ces couleurs ne servent qu'à la priorité (Transmissions › Tous).

### Points NEWS2

0 gris `#5F5F5F`, 1 jaune `#F5B700`, 2 orange `#F57C00`, 3 rouge `#DC0000` ; total ≥ 7 rouge,
≥ 5 orange, ≥ 1 jaune. La couleur double toujours un chiffre (« +2 »). Le jaune sur blanc a un
contraste faible (environ 1,8:1) : il ne porte jamais seul l'information.

## Typographie

- **Nunito** (400, 500, 700) pour le texte, **Plus Jakarta Sans** (600, 700) pour les titres, chargées
  avec `@expo-google-fonts/*` dans `src/app/_layout.tsx`.
- Échelle (`type` dans `theme.ts`) : titre d'écran 30, titre de fiche 28, prénom 24, popup 22, nom du
  patient dans la fiche 20, nom dans la liste et titre de liste 18, compte rendu 17, champ et bouton
  16, corps, puce et toast 15, sous-titre et tableau 14, petit texte, libellé et pastille 13, pied et
  source 12, étiquette et onglet 11.
- Espacements 4, 8, 12, 16, 20, 24, 32. Rayons 8, 12, 16, 20 et pilule. Cartes : rayon 20.
- Nombres à la française : « 38,2 °C », « 14h05 », « 14/11/2026 ».

## Composants (`apps/mobile/src/ui`)

| Fichier | Composants |
| --- | --- |
| `primitives.tsx` | `Text` (variante + ton : navy, sec, magenta, white, error, warn, success), `Button` (primaire magenta 52 px, secondaire blanc bordé ; `sm` = 44 px), `TextButton` (lien magenta, « Déconnexion »), `IconButton` (44 × 44, « Fermer »), `Spinner` |
| `controls.tsx` | `Segmented` (« Mes CR » / « Tous »), `SortMenu` (« Trier : Chambre ▾ »), `Field` (libellé + champ), `ChoiceField` (choix entre deux valeurs : oxygène, conscience) |
| `surfaces.tsx` | `Card` (option `bar` : barre gauche de 4 px), `RoomChip` (« CHAMB 12 »), `CountBadge`, `Chip` (exemple de dictée), `TogglePill` (« Dossier médical »), `Mascot` (Bino, image décorative ignorée par le lecteur d'écran) |
| `overlays.tsx` | `BottomSheet` (feuille « Constantes »), `DoneProvider` / `useDonePopup` (popup « Compte rendu fait », 1,8 s) |
| `toast.tsx` | `ToastProvider` / `useToast` (message en bas, fond bleu nuit, 4 s) |
| `UtilityScreen.tsx`, `a11y.ts` | écrans `/serveur` et `/simulateur` ; attributs ARIA sur le web, touche Échap |

Métier (`apps/mobile/src/features`) : `PatientRow`, `MedicalRecord`, `VitalsSheet`, `ReportComposer`,
`MicButton`, `DictationStatusLine`, `MyReports`, `SummaryCard`, `TeamSummaries`. Icônes :
`lucide-react-native`. Mascotte : `apps/mobile/assets/bino/` (poses salue, présente, pouce).

## Mouvement

On n'anime qu'une activité réelle : l'enregistrement et le texte qui arrive. Dès le toucher, le
micro passe à l'icône « carré », la zone de texte prend une bordure magenta et « Enregistrement
0:07 » s'affiche, avec un retour haptique au début et à l'arrêt. Le halo du micro suit le niveau
réel de la voix (sauf avec la reconnaissance du navigateur) ; tant que personne ne parle, une onde
lente (1,4 s) montre que le micro écoute et s'efface dès que la voix est captée. « Réduire les
animations » : halo de taille fixe, seule son intensité suit la voix, pas d'onde. Pendant
« Finalisation… », une transcription ou un envoi : roue de chargement. La fiche monte du bas
(transition d'écran).

Texte dicté (`features/report/LiveTranscript.tsx`) : chaque nouveau mot provisoire apparaît en
fondu en montant de 4 px (180 ms ; seuls les 6 derniers mots d'un segment sont animés). Quand un
segment devient définitif, il passe du gris italique au bleu nuit, surligné en bleu ciel qui
s'efface (600 ms) : on voit la phrase se poser. Les mots sont des blocs dans le flux du texte : un
mot animé ne fait pas bouger les autres. « Réduire les animations » : rien ne bouge, le texte
change d'un coup.

## Ce qu'on s'interdit (référence : impeccable.style/slop)

- Dégradés violets / cyan, texte en dégradé, halos lumineux décoratifs, glassmorphism.
- Cartes imbriquées, bordure épaisse sur élément arrondi. Barre latérale colorée décorative : voir
  l'écart signalé en haut de page.
- Icône dans un carré arrondi au-dessus d'un titre, petite étiquette au-dessus d'un titre.
- Inter / Geist par défaut, lettres compressées, texte gris sur fond coloré.
- Point qui pulse sans activité réelle (seule l'onde du micro pendant l'enregistrement), rebonds,
  marquee.
- Grilles de cartes identiques, chiffres héros.
- Emoji décoratifs dans l'UI, promesses marketing.

## Écrire pour l'UI

- Français simple, phrases courtes, tutoiement entre soignants (« Entre ton matricule et ton mot de
  passe. », « Dicte ou écris d'abord le compte rendu. »).
- Verbes d'action sur les boutons : « Se connecter », « Continuer », « Valider », « Enregistrer ».
- Priorité : toujours « Priorité n », jamais une couleur seule.
- Ce qui est inconnu s'écrit « Non renseigné(e)s », jamais « Aucun » (« Aucune connue » seulement si
  le dossier le dit).
- On ne pose pas de question à l'IDE sur ce qu'elle a dit (P16).
- On ne dit pas « IA » à l'écran : on dit ce qui se passe (« Enregistrement », « Finalisation… »,
  « Transcription en cours… »).
