import { z } from 'zod';
import type { AiConfig } from '../config';
import type { SttPort, TranscriptionRequest, TranscriptionResult } from './port';

const Response = z.object({ text: z.string(), duration: z.number().optional() });

/**
 * STT sur n'importe quel serveur compatible `/audio/transcriptions` d'OpenAI :
 * faster-whisper-server / speaches, whisper.cpp server, LocalAI… (auto-hébergé = piste HDS).
 */
export class OpenAiCompatibleStt implements SttPort {
  readonly id: string;
  readonly ready = true;

  constructor(
    private readonly cfg: AiConfig['stt'],
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.id = `openai-compatible:${cfg.model ?? 'whisper'}`;
  }

  async transcribe(req: TranscriptionRequest): Promise<TranscriptionResult> {
    const form = new FormData();
    const ext = req.mimeType.includes('webm')
      ? 'webm'
      : req.mimeType.includes('wav')
        ? 'wav'
        : 'm4a';
    form.append('file', new Blob([req.audio], { type: req.mimeType }), `dictee.${ext}`);
    form.append('model', this.cfg.model ?? 'whisper-1');
    form.append('language', req.language ?? 'fr');
    form.append('response_format', 'json');
    if (req.prompt) form.append('prompt', req.prompt);
    const base = (this.cfg.baseUrl ?? '').replace(/\/$/, '');
    const res = await this.fetchImpl(`${base}/audio/transcriptions`, {
      method: 'POST',
      headers: this.cfg.apiKey ? { authorization: `Bearer ${this.cfg.apiKey}` } : undefined,
      body: form,
      signal: req.signal,
    });
    if (!res.ok) throw new Error(`STT ${res.status} : ${(await res.text()).slice(0, 200)}`);
    const data = Response.parse(await res.json());
    return { text: data.text.trim(), durationSec: data.duration ?? null };
  }
}
