import { describe, expect, it } from 'vitest';
import { aiConfigFromEnv, DEFAULT_STT_LIVE_MODEL } from './config';
import { createAiServices } from './services';

describe('aiConfigFromEnv : transcription en direct', () => {
  it('désactivée sans STT serveur', () => {
    expect(aiConfigFromEnv({}).sttLive).toEqual({
      provider: 'none',
      model: null,
      apiKey: null,
      baseUrl: null,
    });
  });

  it('activée avec STT_PROVIDER=openai, même clé, modèle par défaut', () => {
    const cfg = aiConfigFromEnv({
      STT_PROVIDER: 'openai',
      STT_MODEL: 'gpt-transcribe',
      STT_API_KEY: 'sk-test',
    });
    expect(DEFAULT_STT_LIVE_MODEL).toBe('gpt-live-transcribe');
    expect(cfg.sttLive).toEqual({
      provider: 'openai',
      model: 'gpt-live-transcribe',
      apiKey: 'sk-test',
      baseUrl: null,
    });
    expect(cfg.stt.model).toBe('gpt-transcribe');
  });

  it('STT_LIVE_MODEL choisit le modèle ; « none » désactive', () => {
    const env = { STT_PROVIDER: 'openai', STT_API_KEY: 'sk-test' };
    expect(aiConfigFromEnv({ ...env, STT_LIVE_MODEL: 'autre-modele' }).sttLive.model).toBe(
      'autre-modele',
    );
    expect(aiConfigFromEnv({ ...env, STT_LIVE_MODEL: 'none' }).sttLive.provider).toBe('none');
  });

  it('pas de direct avec un autre fournisseur STT', () => {
    expect(aiConfigFromEnv({ STT_PROVIDER: 'groq', STT_API_KEY: 'k' }).sttLive.provider).toBe(
      'none',
    );
  });

  it('GET /config : état du direct exposé (sans ouvrir de connexion)', () => {
    const on = createAiServices(
      aiConfigFromEnv({ STT_PROVIDER: 'openai', STT_API_KEY: 'sk-test' }),
    );
    expect(on.status('t').sttLive).toEqual({
      provider: 'openai',
      model: 'gpt-live-transcribe',
      ready: true,
    });
    expect(on.liveStt.id).toBe('openai-realtime:gpt-live-transcribe');
    const off = createAiServices(aiConfigFromEnv({}));
    expect(off.status('t').sttLive).toEqual({ provider: 'none', model: null, ready: false });
  });
});
