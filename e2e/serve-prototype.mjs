#!/usr/bin/env node
// Sert le prototype et relaie /api/bino vers l'API, comme le Worker en production.
// Usage : node e2e/serve-prototype.mjs <dossier> <port> <origine-api>
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'prototypes/bino');
const port = Number(process.argv[3] ?? 8092);
const api = (process.argv[4] ?? 'http://127.0.0.1:8789').replace(/\/$/, '');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

function sessionId(cookie) {
  const match = /(?:^|;\s*)bino_session=([0-9a-f-]{36})/i.exec(cookie ?? '');
  return match?.[1] ?? randomUUID();
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname.startsWith('/api/bino')) {
    const sid = sessionId(req.headers.cookie);
    const dest = `${api}${url.pathname.slice('/api/bino'.length)}${url.search}`;
    const headers = { 'x-bino-session': sid };
    const type = req.headers['content-type'];
    if (typeof type === 'string') headers['content-type'] = type;
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const upstream = await fetch(dest, {
      method: req.method,
      headers,
      body: hasBody ? await readBody(req) : undefined,
    });
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'set-cookie': `bino_session=${sid}; Path=/; HttpOnly; SameSite=Lax`,
    });
    res.end(payload);
    return;
  }

  const safe = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, safe === '/' ? 'index.html' : safe);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('introuvable');
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`prototype → http://127.0.0.1:${port} (${root}) api ${api}`);
});
