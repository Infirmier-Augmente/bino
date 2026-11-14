<h1 align="center">Bino</h1>

<p align="center">
  <em>Le binôme des infirmiers.</em>
</p>

<p align="center">
  <img src="assets/bino/logo-icon.png" alt="Logo Bino" width="96">
</p>

<p align="center">Rendre à Martine le temps que l'administratif prend aux patients.</p>

<p align="left">
  <a href="https://bino.noiseless-sunflower.workers.dev"><b>Essayer →</b></a>
</p>

Matricule `10482`, mot de passe `bino`. Patients fictifs.

<table>
  <tr>
    <td align="center" width="25%"><img src="docs/images/connexion.png" alt="Connexion" width="180"><br><sub>Connexion</sub></td>
    <td align="center" width="25%"><img src="docs/images/patients.png" alt="Patients" width="180"><br><sub>Patients</sub></td>
    <td align="center" width="25%"><img src="docs/images/compte-rendu.png" alt="Compte rendu" width="180"><br><sub>Compte rendu</sub></td>
    <td align="center" width="25%"><img src="docs/images/transmissions.png" alt="Transmissions" width="180"><br><sub>Transmissions</sub></td>
  </tr>
</table>

## Lancer

```bash
npm install
npx expo start
```

- `w` ouvre l'app web.
- Expo Go (téléphone) : scanner le QR code.

SDK Expo 57, le SDK que Expo Go ouvre aujourd'hui pendant la transition vers le 58. Même code pour iOS, Android et le web.

```bash
npm run lint
npm test
npm run typecheck
```

## Carte

```
app/                     routes expo-router
  (tabs)/patients        priorisation
  (tabs)/dictee          dictée puis validation
  (tabs)/synthese        rapport par patient
  (tabs)/releve/         passation ; lecture.tsx est /releve/lecture
  patient/[id]           détail
  alert/[id]             détail NEWS2, valider ou ajuster
  onboarding             premier lancement
src/theme                tokens (couleurs, espaces, rayons, typos, ombres)
src/components           cartes, badges, Bino (SVG), éditeurs
src/domain               NEWS2, patients, relève — fonctions pures
src/mocks                vacation du 13 novembre, Chirurgie
src/services             fonctions async. C'est ici qu'on remplace les mocks.
src/context              état (validation, synthèse, relève)
assets/bino              logo, mascotte, poses (PNG). Le visage est dessiné en SVG.
```

Onglets en bas sur téléphone. Barre latérale à partir de 900 px. Patients et Synthèse passent en deux colonnes.
