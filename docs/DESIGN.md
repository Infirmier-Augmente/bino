# Design

## Principes

1. **Un geste, pas une tâche de plus.** Dicter = 1 bouton toujours à portée de pouce. Valider = 1 geste.
2. **Lisible après 12 h de poste.** Police **Atkinson Hyperlegible** (conçue pour la lisibilité, chiffres
   et lettres non ambigus), corps 16 px minimum, contrastes AA, cibles tactiles ≥ 48 px.
3. **La source est toujours à un toucher.** Toute phrase structurée s'ouvre sur son extrait de dictée.
4. **Questions, pas verdicts.** Ce qui manque s'affiche en ambre, formulé comme une question.
5. **L'IDE garde la main.** Priorité « suggérée » vs « choisie », toujours expliquée, toujours modifiable.
6. **Même app, deux postures.** Téléphone en mobilité (onglets en bas), PC du poste de soins pour la
   relève (barre latérale, maître-détail, mode réunion).

## Tokens (`apps/mobile/src/ui/theme.ts`)

| Rôle | Clair | Usage |
| --- | --- | --- |
| Fond / surface | `#F3F5F4` / `#FFFFFF` | calme, légèrement vert-gris |
| Encre | `#14201E`, secondaire `#46534F` | texte |
| Accent (pétrole) | `#0E5E58` | **une seule** action principale par écran |
| Enregistrement | `#B3261E` | uniquement le micro actif |
| Question | `#7A4A00` sur `#FFF0D4` | R manquant, questions à l'IDE, « non relue » |
| Triage | rouge / orange / jaune / vert | **uniquement** la priorité, toujours avec libellé + pastille |

Thème sombre complet : utile à l'équipe de nuit, pas décoratif.

Échelle typographique contrastée (display 30, title 22, heading 18, body 16, label 14, caption 13).
Espacements 4 → 48. Rayons 6 / 10 / 14. Bordures fines plutôt qu'ombres.

## Ce qu'on s'interdit (référence : impeccable.style/slop)

- Dégradés violets / cyan, texte en dégradé, halos lumineux, glassmorphism, néon en mode sombre.
- Cartes imbriquées, bordure latérale colorée décorative, bordure épaisse sur élément arrondi.
- Icône dans un carré arrondi au-dessus d'un titre, petite étiquette au-dessus d'un titre, badge au-dessus du titre principal.
- Inter / Geist par défaut, lettres compressées, texte minuscule, texte gris sur fond coloré.
- Point qui pulse, rebonds, marquee : **on n'anime qu'une activité réelle** (enregistrement en cours).
- Grilles de cartes identiques, chiffres héros, espacements tous égaux.
- Emoji décoratifs dans l'UI, promesses marketing, tirets cadratins partout.

## Composants (`apps/mobile/src/ui`)

`Text`, `Button` (primary / secondary / ghost / record / danger), `IconButton`, `Section` (jamais
imbriquée), `ListRow`, `Segmented`, `PriorityBadge`, `StarToggle`, `RoomNumber`, `Badge`, `Banner`,
`TextField`, `Screen` (zone sûre + largeur de lecture + pied d'actions), toasts.

Métier (`apps/mobile/src/features`) : `SourcedLine` (phrase + source), `DarBlock`, `FlagQuestion`,
`TranscriptView` (dictée surlignée), `HandoverSheetView`, `PatientRow`, `PriorityControl`.

## Écrire pour l'UI

Français simple, tutoiement entre soignants, verbes d'action (« Dicter », « Valider », « Plus tard »).
Pas de « IA » partout : on dit ce que fait l'outil (« Rangé par deepseek-chat », « Mode dégradé »).
