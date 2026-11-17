// Bino sur Cloudflare : sert l'app et relaie /api/bino vers l'API du mini.
// Le Worker est le seul à connaître le tunnel et à ajouter le secret.
import { SHARED_SESSION } from '../shared-session.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const bad = (msg, status = 400) => json({ error: msg }, status);

function visitorId() {
  return SHARED_SESSION;
}

async function proxyBino(request, env, url) {
  if (!env.API_ORIGIN || !env.API_EDGE_SECRET) return bad('API non reliée', 503);
  const path = url.pathname.slice('/api/bino'.length) || '/';
  const dest = new URL(path + url.search, env.API_ORIGIN);
  const sid = visitorId();
  const headers = new Headers();
  const type = request.headers.get('content-type');
  if (type) headers.set('content-type', type);
  headers.set('x-bino-edge', env.API_EDGE_SECRET);
  headers.set('x-bino-session', sid);
  const init = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD')
    init.body = await request.arrayBuffer();
  const upstream = await fetch(dest, init);
  const out = new Headers();
  out.set(
    'content-type',
    upstream.headers.get('content-type') || 'application/json; charset=utf-8',
  );
  out.set('cache-control', 'no-store');
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  out.set(
    'set-cookie',
    `bino_session=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
  );
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/bino')) return proxyBino(request, env, url);
    if (url.pathname.startsWith('/api/')) return bad('Introuvable', 404);
    return env.ASSETS.fetch(request);
  },
};
