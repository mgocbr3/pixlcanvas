import 'dotenv/config';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';

import { registerHealthRoutes } from './routes/health.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerSceneRoutes } from './routes/scenes.js';
import { registerAssetRoutes } from './routes/assets.js';
import { registerUserRoutes } from './routes/users.js';
import { registerEditorConfigRoutes } from './routes/config.js';

const app = Fastify({ logger: true });

const port = Number(process.env.PORT || 8787);
const corsOrigin = process.env.CORS_ORIGIN || '*';
const jwtSecret = process.env.SUPABASE_JWT_SECRET || '';

await app.register(cors, {
  origin: corsOrigin,
  credentials: true
});

if (!jwtSecret) {
  app.log.warn('SUPABASE_JWT_SECRET is not set. Auth will reject all protected routes.');
}

await app.register(jwt, {
  secret: jwtSecret || 'invalid'
});

registerHealthRoutes(app);
registerEditorConfigRoutes(app);
registerProjectRoutes(app);
registerSceneRoutes(app);
registerAssetRoutes(app);
registerUserRoutes(app);

app.get('/', async () => ({ name: 'pixlland-api', status: 'ok' }));

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
