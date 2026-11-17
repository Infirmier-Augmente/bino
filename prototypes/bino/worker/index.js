// Bino sur Cloudflare : sert l'app (assets statiques) et deux petites API.
//   /api/state, /api/op : ancien stockage commun. Le site public ne s'en sert plus :
//                         chaque navigateur a sa copie du scénario, via /api/bino.
//   /api/ai, /api/health : appel à l'IA côté serveur, avec la clé gardée en secret Cloudflare
//                          (ANTHROPIC_API_KEY). Aucune clé dans le code ni dans le navigateur.
// Données 100 % fictives : l'app est une démo publique, aucune donnée réelle ne doit y être saisie.
import { DurableObject } from 'cloudflare:workers';

const LEVELS = ['critique', 'eleve', 'moyen'];
const LIMITS = {
  crText: 2000, // caractères par compte rendu
  crCount: 500, // comptes rendus au total
  json: 60000, // taille max d'une synthèse ou d'une proposition de priorités
  prompt: 40000, // caractères par prompt IA
  maxTokens: 2000,
};
const DEFAULT_MODEL = 'claude-sonnet-5-5';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const bad = (msg, status = 400) => json({ error: msg }, status);
// Résultats renvoyés par le Durable Object (objets simples), convertis en réponses HTTP par le Worker.
const ok = (data) => ({ status: 200, data });
const ko = (error, status = 400) => ({ status, data: { error } });
const toResponse = (r) =>
  r.status === 204 ? new Response(null, { status: 204 }) : json(r.data, r.status);
const size = (x) => JSON.stringify(x ?? null).length;
const isPid = (x) => typeof x === 'string' && /^p\d{1,3}$/.test(x);
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x, max) => String(x ?? '').slice(0, max);

export class Ward extends DurableObject {
  async load() {
    const s = this.ctx.storage;
    const [cr, syn, vit, prio, meta] = await Promise.all([
      s.get('cr'),
      s.get('syn'),
      s.get('vit'),
      s.get('prio'),
      s.get('meta'),
    ]);
    return {
      cr: cr || [],
      syn: syn || {},
      vit: vit || {},
      prio: prio || { ai: null, manual: {} },
      meta: meta || { rev: 0, seeded: false },
    };
  }

  async save(st, keys) {
    st.meta.rev += 1;
    const put = Object.fromEntries(keys.map((k) => [k, st[k]]));
    put.meta = st.meta;
    await this.ctx.storage.put(put);
  }

  view(st) {
    return {
      rev: st.meta.rev,
      seeded: st.meta.seeded,
      cr: st.cr,
      syn: st.syn,
      vit: st.vit,
      prio: st.prio,
    };
  }

  async state(since) {
    const st = await this.load();
    if (since !== null && Number(since) === st.meta.rev) return { status: 204, data: null };
    return ok(this.view(st));
  }

  async op(body) {
    if (!isObj(body)) return ko('Requête invalide');
    const st = await this.load();
    const { op } = body;

    if (op === 'seed') {
      // Comptes rendus de démo, versés une seule fois quand le service est vide.
      if (st.meta.seeded || st.cr.length) return ok(this.view(st));
      const items = Array.isArray(body.cr) ? body.cr.slice(0, 60) : [];
      st.cr = items
        .filter((c) => isObj(c) && isPid(c.pid) && c.text)
        .map((c, i) => ({
          id: str(c.id || `seed${i}`, 40),
          pid: c.pid,
          text: str(c.text, LIMITS.crText),
          at: str(c.at, 40),
          t: str(c.t, 10),
          byName: str(c.byName, 80),
        }));
      st.meta.seeded = true;
      await this.save(st, ['cr']);
      return ok(this.view(st));
    }

    if (op === 'addCr') {
      if (!isPid(body.pid) || !String(body.text || '').trim()) return ko('Compte rendu invalide');
      if (st.cr.length >= LIMITS.crCount) return ko('Démo pleine : réinitialisez-la', 409);
      const now = new Date();
      st.cr.push({
        id: `c${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        pid: body.pid,
        text: str(body.text, LIMITS.crText).trim(),
        at: now.toISOString(),
        t: str(body.t, 10),
        byName: str(body.byName, 80),
      });
      await this.save(st, ['cr']);
      return ok(this.view(st));
    }

    if (op === 'deleteCr') {
      st.cr = st.cr.filter((c) => c.id !== body.id);
      await this.save(st, ['cr']);
      return ok(this.view(st));
    }

    if (op === 'saveSynth' || op === 'validateSynth') {
      if (!isPid(body.pid)) return ko('Patient invalide');
      if (op === 'saveSynth') {
        if (!isObj(body.syn) || size(body.syn) > LIMITS.json) return ko('Synthèse invalide');
        st.syn[body.pid] = body.syn;
      } else {
        if (!st.syn[body.pid]) return ok(this.view(st));
        st.syn[body.pid] = {
          ...st.syn[body.pid],
          validatedAt: new Date().toISOString(),
          validatedT: str(body.t, 10),
          validatedName: str(body.byName, 80),
        };
      }
      await this.save(st, ['syn']);
      return ok(this.view(st));
    }

    if (op === 'saveVitals') {
      if (!isPid(body.pid) || !isObj(body.v) || size(body.v) > 2000)
        return ko('Constantes invalides');
      st.vit[body.pid] = body.v;
      await this.save(st, ['vit']);
      return ok(this.view(st));
    }

    if (op === 'savePrioAI') {
      if (!isObj(body.ai) || size(body.ai) > LIMITS.json) return ko('Priorités invalides');
      st.prio = { ...st.prio, ai: body.ai };
      await this.save(st, ['prio']);
      return ok(this.view(st));
    }

    if (op === 'setManualLevel') {
      if (!isPid(body.pid)) return ko('Patient invalide');
      const manual = { ...(st.prio.manual || {}) };
      const level = body.level === 'faible' ? 'moyen' : body.level;
      if (LEVELS.includes(level)) manual[body.pid] = level;
      else delete manual[body.pid];
      st.prio = { ...st.prio, manual };
      await this.save(st, ['prio']);
      return ok(this.view(st));
    }

    if (op === 'reset') {
      // Remise à zéro de la démo, seulement avec le code gardé en secret Cloudflare (RESET_CODE).
      if (!this.env.RESET_CODE || body.code !== this.env.RESET_CODE)
        return ko('Code de réinitialisation refusé', 403);
      await this.ctx.storage.deleteAll();
      const fresh = await this.load();
      return ok(this.view(fresh));
    }

    return ko('Opération inconnue');
  }

  // Compteur d'appels IA par jour (UTC) : protège le budget de la clé sur un lien public.
  async aiQuota(limit) {
    const day = new Date().toISOString().slice(0, 10);
    const q = (await this.ctx.storage.get('aiQuota')) || { day, n: 0 };
    if (q.day !== day) {
      q.day = day;
      q.n = 0;
    }
    if (q.n >= limit) return false;
    q.n += 1;
    await this.ctx.storage.put('aiQuota', q);
    return true;
  }
}

async function askAnthropic(env, prompt, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.AI_MODEL || DEFAULT_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) return bad(`IA indisponible (${r.status})`, r.status === 429 ? 429 : 502);
  const j = await r.json();
  const text = (j.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return json({ text });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Le navigateur appelle /api/bino/… sur ce Worker. Lui seul connaît le mini, et ajoute le secret.
function visitorId(request) {
  const raw = request.headers.get('cookie') ?? '';
  const match = raw.match(/(?:^|;\s*)bino_session=([0-9a-f-]{36})/i);
  return match?.[1] ?? crypto.randomUUID();
}

async function proxyBino(request, env, url) {
  if (!env.API_ORIGIN || !env.API_EDGE_SECRET) return bad('API non reliée', 503);
  const path = url.pathname.slice('/api/bino'.length) || '/';
  const dest = new URL(path + url.search, env.API_ORIGIN);
  const sid = visitorId(request);
  const headers = new Headers();
  const type = request.headers.get('content-type');
  if (type) headers.set('content-type', type);
  headers.set('x-bino-edge', env.API_EDGE_SECRET);
  headers.set('x-bino-session', sid);
  const init = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD')
    init.body = await request.arrayBuffer();
  const r = await fetch(dest, init);
  const out = new Headers();
  out.set('content-type', r.headers.get('content-type') || 'application/json; charset=utf-8');
  out.set('cache-control', 'no-store');
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  out.set(
    'set-cookie',
    `bino_session=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
  );
  return new Response(r.body, { status: r.status, headers: out });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/bino')) return proxyBino(request, env, url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const ward = env.WARD.get(env.WARD.idFromName('service-chirurgie'));
    const route = `${request.method} ${url.pathname}`;

    if (route === 'GET /api/health') return json({ store: true, ai: !!env.ANTHROPIC_API_KEY });
    if (route === 'GET /api/state')
      return toResponse(await ward.state(url.searchParams.get('since')));
    if (route === 'POST /api/op') return toResponse(await ward.op(await readJson(request)));

    if (route === 'POST /api/ai') {
      if (!env.ANTHROPIC_API_KEY) return bad('IA non configurée', 503);
      const body = await readJson(request);
      const prompt = String(body?.prompt || '');
      if (!prompt || prompt.length > LIMITS.prompt) return bad('Prompt invalide');
      const limit = Number(env.AI_DAILY_LIMIT) || 400;
      if (!(await ward.aiQuota(limit))) return bad("Quota d'IA du jour atteint", 429);
      const maxTokens = Math.min(Math.max(Number(body?.maxTokens) || 1500, 64), LIMITS.maxTokens);
      return askAnthropic(env, prompt, maxTokens);
    }

    return bad('Introuvable', 404);
  },
};
