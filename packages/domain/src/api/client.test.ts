import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';
import { buildPath } from './contract';

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
}

describe('buildPath', () => {
  it('remplace et encode les paramètres', () => {
    expect(buildPath('/patients/:patientId/fhir', { patientId: 'a b' })).toBe(
      '/patients/a%20b/fhir',
    );
    expect(() => buildPath('/patients/:patientId', {})).toThrow(/patientId/);
  });
});

describe('createApiClient', () => {
  it('construit URL, query et valide la réponse', async () => {
    const f = fakeFetch(200, []);
    const client = createApiClient({
      baseUrl: 'http://api.test/',
      fetch: f as unknown as typeof fetch,
    });
    const hits = await client.unitSearch({ params: { unitId: 'rea' }, query: { q: 'SNG' } });
    expect(hits).toEqual([]);
    expect(f.mock.calls[0]?.[0]).toBe('http://api.test/units/rea/search?q=SNG');
  });

  it('remonte les erreurs métier du serveur', async () => {
    const f = fakeFetch(404, { error: { code: 'not-found', message: 'Patient introuvable' } });
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: f as unknown as typeof fetch,
    });
    await expect(client.patientDetail({ params: { patientId: 'x' } })).rejects.toMatchObject({
      status: 404,
      code: 'not-found',
      message: 'Patient introuvable',
    });
  });

  it('détecte une réponse qui ne respecte pas le contrat', async () => {
    const f = fakeFetch(200, { ok: 'oui' });
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: f as unknown as typeof fetch,
    });
    const err = await client.health().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('invalid-response');
  });

  it('transforme une panne réseau en message lisible', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: f as unknown as typeof fetch,
    });
    await expect(client.health()).rejects.toMatchObject({ code: 'network' });
  });
});
