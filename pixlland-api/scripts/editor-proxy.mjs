import 'dotenv/config';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyHttpProxy from '@fastify/http-proxy';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.EDITOR_PORT || 3487);
const API_URL = process.env.PIXLLAND_API_URL || 'http://localhost:8787';
const editorDist = path.resolve(__dirname, '../../editor/dist');
const AUTO_ACCESS_TOKEN = process.env.PIXLLAND_EDITOR_ACCESS_TOKEN || process.env.PIXLLAND_ACCESS_TOKEN || '';

const app = Fastify({ logger: true });

await app.register(fastifyHttpProxy, {
  upstream: API_URL,
  prefix: '/api',
  rewritePrefix: '',
  httpMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  replyOptions: {
    rewriteRequestHeaders: (req, headers) => {
      // Preservar Authorization header da requisição original
      if (req.headers.authorization) {
        headers.authorization = req.headers.authorization;
      }
      return headers;
    }
  }
});

// Proxy only /editor/config.js to the API backend (the only dynamic /editor endpoint)
// Static files under /editor/* are served by fastifyStatic below.
app.get('/editor/config.js', async (request, reply) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const targetUrl = `${API_URL}/editor/config.js${url.search}`;
  try {
    const headers = {};
    if (request.headers.authorization) {
      headers.authorization = request.headers.authorization;
    }
    const resp = await fetch(targetUrl, { headers });
    reply.code(resp.status).type(resp.headers.get('content-type') || 'application/javascript').send(await resp.text());
  } catch (err) {
    reply.code(502).send('/* proxy error */');
  }
});

await app.register(fastifyStatic, {
  root: editorDist,
  prefix: '/',
  list: false,
  cacheControl: false
});

app.setNotFoundHandler((request, reply) => {
  // In dev, VS Code Simple Browser may not keep localStorage between sessions.
  // If a token is provided via env, redirect HTML entrypoints to include it.
  if (AUTO_ACCESS_TOKEN && request.method === 'GET') {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const hasToken = url.searchParams.has('access_token') || url.searchParams.has('token');
      const looksLikeAsset = /\.[a-z0-9]+$/i.test(url.pathname);
      if (!hasToken && !looksLikeAsset) {
        url.searchParams.set('access_token', AUTO_ACCESS_TOKEN);
        reply.redirect(302, url.pathname + '?' + url.searchParams.toString());
        return;
      }
    } catch {
      // ignore
    }
  }

  if (request.raw.url?.startsWith('/launch')) {
    reply.sendFile('launch/index.html');
    return;
  }
  if (request.raw.url?.startsWith('/api')) {
    reply.code(404).send({ error: 'api_not_found' });
    return;
  }
  reply.sendFile('index.html');
});

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
