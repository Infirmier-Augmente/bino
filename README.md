<h1 align="center">Bino</h1>

<p align="center">
  <em>Le binôme des infirmiers.</em>
</p>

<p align="center">
  <img src="assets/bino/logo-icon.png" alt="Logo Bino" width="96">
</p>

<p align="left">
  <a href="https://bino.noiseless-sunflower.workers.dev"><b>Essayer →</b></a>
</p>

Matricule `10482`, mot de passe `bino`. C'est Martine. Les patients sont fictifs.

Bino rassemble ce qui est éparpillé (dossier, prescriptions, transmissions, protocoles, pharmacie, statut infectieux), transcrit la voix, et propose une synthèse courte que l'infirmière valide.

L'information est dispersée, l'infirmière perd du temps de soin à la chercher et à la transmettre. La relève est l'écran principal : un tap produit la passation du jour, triée par NEWS2, prête à lire.

Chaque alerte montre pourquoi. Chaque sortie de l'IA est une proposition. L'infirmier a le dernier mot.

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
