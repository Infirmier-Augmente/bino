import type { SttPort } from '@infirmier/ai';
import { sttVocabulary } from '@infirmier/domain';
import type { Hono } from 'hono';
import { AppError } from './errors';

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * POST /transcriptions (multipart, champ "audio") → { text, durationSec, engine }.
 * Hors contrat JSON car c'est un envoi de fichier. Client : apps/mobile/src/features/dictation/useServerDictation.ts.
 */
export function registerTranscription(app: Hono, stt: SttPort): void {
  app.post('/transcriptions', async (c) => {
    if (!stt.ready) {
      throw new AppError(
        503,
        'stt-unavailable',
        'Pas de transcription serveur configurée : utilise la dictée du clavier ou du navigateur.',
      );
    }
    const form = await c.req.formData().catch(() => null);
    const file = form?.get('audio');
    if (!file || typeof file === 'string') {
      throw new AppError(400, 'audio-required', 'Fichier audio manquant (champ « audio »).');
    }
    if (file.size > MAX_BYTES)
      throw new AppError(400, 'audio-too-large', 'Enregistrement trop long.');
    const audio = new Uint8Array(await file.arrayBuffer());
    const result = await stt.transcribe({
      audio,
      mimeType: file.type || 'audio/m4a',
      language: 'fr',
      prompt: `Transmissions infirmières. Vocabulaire : ${sttVocabulary()}`,
    });
    return c.json({ text: result.text, durationSec: result.durationSec, engine: stt.id });
  });
}
