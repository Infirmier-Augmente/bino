import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { type TranscriptionModel, transcribe } from 'ai';
import type { AiConfig } from '../config';
import type { SttPort, TranscriptionRequest, TranscriptionResult } from './port';

/** STT via l'AI SDK (OpenAI Whisper, Groq Whisper…). */
export class AiSdkStt implements SttPort {
  readonly id: string;
  readonly ready = true;
  private readonly model: TranscriptionModel;

  constructor(cfg: AiConfig['stt']) {
    const model = cfg.model ?? 'whisper-1';
    const apiKey = cfg.apiKey ?? undefined;
    const baseURL = cfg.baseUrl ?? undefined;
    switch (cfg.provider) {
      case 'openai':
        this.model = createOpenAI({ apiKey, baseURL }).transcription(model);
        break;
      case 'groq':
        this.model = createGroq({ apiKey, baseURL }).transcription(model);
        break;
      default:
        throw new Error(`Fournisseur STT non géré par AiSdkStt : ${cfg.provider}`);
    }
    this.id = `${cfg.provider}:${model}`;
  }

  async transcribe(req: TranscriptionRequest): Promise<TranscriptionResult> {
    const result = await transcribe({
      model: this.model,
      audio: req.audio,
      abortSignal: req.signal,
      providerOptions: {
        openai: { language: req.language ?? 'fr', prompt: req.prompt },
        groq: { language: req.language ?? 'fr', prompt: req.prompt },
      },
    });
    return { text: result.text.trim(), durationSec: result.durationInSeconds ?? null };
  }
}
