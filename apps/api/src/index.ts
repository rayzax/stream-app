import { join } from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { streamProxyPlugin } from '@stream/proxy';
import { loadConfig } from './config.js';
import { requireSession, requireAdmin } from './lib/authGuard.js';
import { authRoutes } from './routes/auth.js';
import { catalogRoutes } from './routes/catalog.js';
import { streamRoutes } from './routes/stream.js';
import { adminRoutes } from './routes/admin.js';
import { watchHistoryRoutes } from './routes/watchHistory.js';
import { XtreamClient } from './services/xtreamClient.js';
import { CatalogCache } from './services/catalogCache.js';
import { UserStore } from './services/users.js';
import { GameMappingStore } from './services/gameMappings.js';
import { WatchHistoryStore } from './services/watchHistory.js';

const config = loadConfig();
const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: config.nodeEnv === 'production' ? false : true,
  credentials: true,
});
await fastify.register(cookie);

fastify.get('/healthz', async () => ({ status: 'ok' }));

const users = new UserStore();
const mappings = new GameMappingStore();
const watchHistory = new WatchHistoryStore();

// --- Auth (public: /api/login, /api/logout) ---------------------------------
await authRoutes(fastify, config, users);

// --- Session-gated API routes -----------------------------------------------
const xtream = new XtreamClient(config.xtream);
const catalog = new CatalogCache(config, xtream);

await fastify.register(async (instance) => {
  instance.addHook('preHandler', requireSession(config.sessionSigningKey, users));
  instance.get('/api/session', async (req) => ({ ok: true, user: req.user }));
  await catalogRoutes(instance, catalog);
  await streamRoutes(instance, config);
  await watchHistoryRoutes(instance, watchHistory);

  // Admin-only sub-group — same session requirement plus a role check.
  await instance.register(async (admin) => {
    admin.addHook('preHandler', requireAdmin);
    await adminRoutes(admin, users, mappings, catalog);
  });
});

// --- Stream proxy (public route, but gated by its own short-lived token) ---
// Mounted here for STREAM_MODE=cloudrun; in STREAM_MODE=homelab the player
// is issued a homelab URL instead and this still serves as the fallback.
await fastify.register(streamProxyPlugin, { xtream: config.xtream, hmacKey: config.streamTokenHmacKey });

// --- Static frontend (built React app) + SPA fallback -----------------------
const webDist = join(import.meta.dirname, '..', '..', 'web', 'dist');
await fastify.register(fastifyStatic, { root: webDist });
fastify.setNotFoundHandler(async (req, reply) => {
  if (req.raw.url?.startsWith('/api') || req.raw.url?.startsWith('/stream')) {
    return reply.status(404).send({ error: 'not_found' });
  }
  return reply.sendFile('index.html', webDist);
});

// --- Start listening first; the catalog populates in the background so a --
// --- slow/large upstream fetch never delays Cloud Run's startup probe. -----
try {
  await fastify.listen({ port: config.port, host: config.host });
  fastify.log.info(`Stream API listening on http://${config.host}:${config.port} (mode: ${config.streamMode})`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

async function bootstrapCatalog() {
  await catalog.refreshFull();
  if (!catalog.lastRefreshedAt) await catalog.loadFromGcs();
  await catalog.refreshSportsOnly();
}
bootstrapCatalog().catch((err) => fastify.log.error(err));
setInterval(() => catalog.refreshFull().catch((err) => fastify.log.error(err)), config.catalogRefreshMs);
setInterval(() => catalog.refreshSportsOnly().catch((err) => fastify.log.error(err)), config.sportsRefreshMs);
