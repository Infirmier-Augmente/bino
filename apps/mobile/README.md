# @infirmier/mobile

App Expo SDK 58 (iOS, Android, **web**), identité « Bino ». Même app sur téléphone et sur
ordinateur : une colonne centrée de 440 px au plus, onglets en bas.

Parcours : « Qui es-tu ? » (un toucher sur son prénom, sans mot de passe) → onglets
**Patients** (fiche « Nouveau compte rendu », dossier médical, constantes NEWS2) et
**Transmissions** (« Mes CR » / « Tous », priorité 1 à 4). « Valider » enregistre le compte rendu ;
la structuration IA reste « à relire » côté serveur.

- `src/app/` : écrans (Expo Router). `(app)/` = zone connectée (onglets). Utilitaires accessibles
  par l'URL seulement : `/serveur` (adresse de l'API), `/simulateur` (remettre la démo à zéro).
- `src/ui/` : design system (tokens `theme.ts`, primitives, contrôles, feuilles, toasts).
- `src/features/` : briques métier (API, session, dictée, fiche, transmissions).
- `src/lib/` : logique de présentation pure (tris, formats, NEWS2 affiché…) testée avec Vitest.

```bash
pnpm dev:app   # QR code → Expo Go (même Wi-Fi que l'API)
pnpm dev:web   # navigateur
```

Ajouter une dépendance : `npx expo install <paquet>` (versions compatibles SDK 58).
L'adresse de l'API est devinée (IP de la machine Expo / page web) ; sinon `/serveur`
(lien proposé sur l'écran de connexion quand le serveur ne répond pas).
