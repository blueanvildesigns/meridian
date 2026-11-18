// Serves webapp/dist with firebase.json's headers and rewrites applied.
// Usage: node scripts/serve-dist.ts [port]
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { headersFor, loadHosting, rewriteFor } from './firebaseHosting.ts';

const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const config = loadHosting();
const root = resolve(fileURLToPath(new URL('../../', import.meta.url)), config.public);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
};

function fileAt(urlPath: string): string | undefined {
  const target = normalize(join(root, decodeURIComponent(urlPath)));
  if (target !== root && !target.startsWith(root + sep)) return undefined; // path traversal
  try {
    const stat = statSync(target);
    if (stat.isFile()) return target;
    if (stat.isDirectory()) {
      const index = join(target, 'index.html');
      if (statSync(index).isFile()) return index;
    }
  } catch {
    // not found
  }
  return undefined;
}

createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  let file = fileAt(path);
  if (!file) {
    const dest = rewriteFor(config, path);
    file = dest ? fileAt(dest) : undefined;
  }
  let headers: Record<string, string>;
  try {
    headers = headersFor(config, path);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end(String(err));
    return;
  }
  if (!file) {
    // Firebase serves /404.html from the public root when nothing matches, with the headers
    // for /404.html rather than the request path (observed on a preview channel, 2026-11-18).
    const notFound = fileAt('/404.html');
    res.writeHead(404, {
      ...headersFor(config, '/404.html'),
      'content-type': TYPES['.html'] ?? 'text/html',
    });
    if (notFound) createReadStream(notFound).pipe(res);
    else res.end('Not found');
    return;
  }
  res.writeHead(200, {
    ...headers,
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`Serving ${root} with firebase.json headers at http://localhost:${port}`);
});
