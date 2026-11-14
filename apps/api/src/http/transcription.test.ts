import { describe, expect, it } from 'vitest';
import { createTestApp } from '../testing/test-app';

function audioForm() {
  const form = new FormData();
  form.append(
    'audio',
    new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }),
    'dictee.webm',
  );
  return form;
}

describe('POST /transcriptions', () => {
  it('503 explicite sans STT configuré', async () => {
    const { app } = createTestApp();
    const res = await app.request('/transcriptions', { method: 'POST', body: audioForm() });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('stt-unavailable');
  });

  it('transcrit via le port STT', async () => {
    const { app } = createTestApp({
      ai: {
        stt: {
          id: 'fake-stt',
          ready: true,
          transcribe: async (req) => ({ text: `ok ${req.audio.length} octets`, durationSec: 1.5 }),
        },
      },
    });
    const res = await app.request('/transcriptions', { method: 'POST', body: audioForm() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'ok 3 octets', durationSec: 1.5, engine: 'fake-stt' });
  });
});
