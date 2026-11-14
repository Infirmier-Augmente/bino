// Accès à l'IA, dans cet ordre :
// 1. dans Claude (artifact), la capacité « sample » fournie par la page ;
// 2. sur Cloudflare, le Worker (/api/ai) qui garde la clé en secret côté serveur ;
// 3. ailleurs, une clé API Anthropic saisie par le testeur dans Réglages ;
// 4. sinon, rien : l'app passe en règles locales.
import { DEFAULT_MODEL, settings } from '../settings.js';

let sample = null;
let server = false;

export async function init() {
  if (window.claude?.use) {
    try {
      sample = await window.claude.use('sample');
    } catch (_e) {
      sample = null;
    }
  } else {
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      server = r.ok && !!(await r.json())?.ai;
    } catch {
      server = false;
    }
  }
  return mode();
}

export const insideClaude = () => !!window.claude?.use;

export function mode() {
  if (sample) return 'claude';
  if (server) return 'server';
  if (settings.apiKey) return 'api';
  return 'off';
}

export async function ask(prompt, { tier = 'default', maxTokens = 1500 } = {}) {
  if (sample) {
    const o = await sample(prompt, { modelTier: tier });
    return o.text || '';
  }
  if (server) {
    const r = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, maxTokens }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(j.error || `API ${r.status}`);
      err.code = r.status === 429 ? 'rate_limited' : 'api_error';
      throw err;
    }
    return j.text || '';
  }
  if (settings.apiKey) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: settings.model || DEFAULT_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      const err = new Error(`API ${r.status}`);
      err.code = r.status === 429 ? 'rate_limited' : r.status === 401 ? 'bad_key' : 'api_error';
      err.detail = detail;
      throw err;
    }
    const j = await r.json();
    return (j.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }
  const err = new Error('IA indisponible');
  err.code = 'off';
  throw err;
}

export async function askJSON(prompt, opts = {}) {
  if (sample && typeof sample.json === 'function')
    return sample.json(prompt, { modelTier: opts.tier || 'default' });
  const t = await ask(prompt, opts);
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Réponse sans JSON');
  return JSON.parse(m[0]);
}
