import 'dotenv/config';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyHttpProxy from '@fastify/http-proxy';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.EDITOR_PORT || 3487);
const API_URL = process.env.PIXLLAND_API_URL || 'http://localhost:8788';
const editorDist = path.resolve(__dirname, '../../editor/dist');

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

await app.register(fastifyStatic, {
  root: editorDist,
  prefix: '/',
  list: false,
  cacheControl: false
});

app.setNotFoundHandler((request, reply) => {
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
