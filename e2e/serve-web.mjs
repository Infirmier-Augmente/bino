#!/usr/bin/env node
// Petit serveur statique pour l'export web Expo (SPA : toute route inconnue → index.html).
// Usage : node e2e/serve-web.mjs <dossier> <port>
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'apps/mobile/dist');
const port = Number(process.argv[3] ?? 8081);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const safe = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, safe);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(root, 'index.html');
  }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`web → http://localhost:${port} (${root})`));
