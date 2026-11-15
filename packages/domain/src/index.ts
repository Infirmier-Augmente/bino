// Point d'entrée unique de @infirmier/domain.
// Tout ce qui est exporté ici est utilisable côté mobile ET serveur (zéro dépendance runtime hors zod).

export * from './api/client';
export * from './api/contract';
export * from './api/live-transcription';
export * from './interop/fhir';
export * from './rules/completeness';
export * from './rules/grounding';
export * from './rules/handover';
export * from './rules/lexicon';
export * from './rules/news2';
export * from './rules/patient';
export * from './rules/patient-matching';
export * from './rules/priority';
export * from './rules/search';
export * from './rules/summary';
export * from './rules/summary-coverage';
export * from './rules/team';
export * from './rules/text';
export * from './rules/time';
export * from './schemas/common';
export * from './schemas/hospital';
export * from './schemas/simulation';
export * from './schemas/transmission';
export * from './schemas/views';
