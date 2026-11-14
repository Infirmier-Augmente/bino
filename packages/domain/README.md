# @infirmier/domain

Le modèle métier partagé par le mobile et le serveur. **Zéro dépendance runtime hors zod**, fonctions pures.

- `src/schemas/` : types zod (patient, transmission DAR sourcée, signalements, vues, état de l'hôpital).
- `src/rules/` : ancrage des sources (`grounding`), lexique soignant, rattachement patient,
  complétude, priorité (poids en clair), fiche de relève, temps local (postes), recherche.
- `src/interop/fhir.ts` : export FHIR R4.
- `src/api/` : **contrat d'API** (un endpoint = une entrée) et client typé.

Règle : pas d'I/O, pas d'horloge implicite (on passe `now`), pas de `fetch`. Tout se teste en unitaire.
