# @infirmier/mobile

App Expo SDK 58 (iOS, Android, **web**). Téléphone : dictée et relecture. PC : vue relève.

- `src/app/` : écrans (Expo Router). `(app)/` = zone connectée (onglets / barre latérale).
- `src/ui/` : design system (tokens, primitives). Lire `docs/DESIGN.md` avant d'ajouter un composant.
- `src/features/` : briques métier (dictée, relecture, fiche, priorité, API).
- `src/lib/` : logique pure testée avec Vitest.

```bash
pnpm dev:app   # QR code → Expo Go (même Wi-Fi que l'API)
pnpm dev:web   # navigateur
```

Ajouter une dépendance : `npx expo install <paquet>` (versions compatibles SDK 58).
L'adresse de l'API est devinée (IP de la machine Expo / page web) ; sinon Réglages → Serveur.
