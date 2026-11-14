import {
  type ApiContract,
  ApiErrorBody,
  type ApiInput,
  type ApiOutput,
  api,
  buildPath,
  type EndpointDef,
  type EndpointName,
} from './contract';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type IsEmpty<T> = keyof T extends never ? true : false;

export type ApiClient = {
  [K in EndpointName]: IsEmpty<ApiInput<K>> extends true
    ? (input?: ApiInput<K>, init?: { signal?: AbortSignal }) => Promise<ApiOutput<K>>
    : (input: ApiInput<K>, init?: { signal?: AbortSignal }) => Promise<ApiOutput<K>>;
};

export interface ApiClientOptions {
  /** URL de base de l'API, ou fonction (pour la changer à chaud depuis les réglages). */
  baseUrl: string | (() => string);
  fetch?: typeof fetch;
  /** Délai max d'un appel (ms). La structuration IA peut prendre ~30 s. */
  timeoutMs?: number;
}

function toQueryString(query: unknown): string {
  if (!query || typeof query !== 'object') return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/**
 * Client typé généré à partir du contrat. Exemple :
 *   const client = createApiClient({ baseUrl: 'http://localhost:8787' });
 *   const board = await client.unitBoard({ params: { unitId: 'rea' } });
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;

  async function call(
    def: EndpointDef,
    input: Record<string, unknown> = {},
    init?: { signal?: AbortSignal },
  ) {
    const base = typeof options.baseUrl === 'function' ? options.baseUrl() : options.baseUrl;
    const url =
      base.replace(/\/$/, '') +
      buildPath(def.path, input.params as Record<string, string> | undefined) +
      toQueryString(input.query);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    init?.signal?.addEventListener('abort', () => controller.abort());

    let res: Response;
    try {
      res = await doFetch(url, {
        method: def.method,
        headers: input.body !== undefined ? { 'content-type': 'application/json' } : undefined,
        body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      const aborted = controller.signal.aborted;
      throw new ApiError(
        0,
        aborted ? 'timeout' : 'network',
        aborted
          ? 'Le serveur met trop de temps à répondre.'
          : 'Serveur injoignable. Vérifie le réseau et l’adresse de l’API dans les réglages.',
        e,
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new ApiError(
          res.status,
          'invalid-json',
          'Réponse illisible du serveur.',
          text.slice(0, 200),
        );
      }
    }
    if (!res.ok) {
      const parsed = ApiErrorBody.safeParse(json);
      if (parsed.success) {
        const { code, message, details } = parsed.data.error;
        throw new ApiError(res.status, code, message, details);
      }
      throw new ApiError(res.status, 'http-error', `Erreur ${res.status}`, json);
    }
    const out = def.response.safeParse(json);
    if (!out.success) {
      throw new ApiError(
        res.status,
        'invalid-response',
        `Réponse inattendue du serveur pour ${def.method} ${def.path}. Mobile et API sont-ils à jour ?`,
        out.error.issues,
      );
    }
    return out.data;
  }

  const client: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(api) as [EndpointName, EndpointDef][]) {
    client[name] = (input?: Record<string, unknown>, init?: { signal?: AbortSignal }) =>
      call(def, input, init);
  }
  return client as ApiClient;
}

export type { ApiContract };
