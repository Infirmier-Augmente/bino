/** Messages de la dictée (toasts), en français, tutoiement entre soignants. */
export const MIC_REFUSED = 'Micro refusé : tu peux taper le texte.';
export const DICTATION_UNAVAILABLE = 'Dictée indisponible ici : utilise le micro du clavier.';
/** Dictée en direct : le texte définitif n'est pas arrivé, le texte affiché est ajouté. */
export const LIVE_KEPT = 'Texte définitif incomplet : le texte affiché est gardé, relis-le.';
export const LIVE_FAILED = 'Transcription impossible. Redicte ou tape le texte.';
/** L'API arrête d'elle-même au bout de `LIVE_MAX_SECONDS` (5 min) et transcrit. */
export const LIVE_MAX_REACHED = 'Dictée arrêtée après 5 minutes : le texte est ajouté.';
