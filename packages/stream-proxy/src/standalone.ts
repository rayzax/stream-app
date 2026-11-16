// Standalone entrypoint used by the homelab Docker image. Cloud Run runs
// this same proxy logic mounted inside apps/api instead (see apps/api/src/index.ts).
import Fastify from 'fastify';
import { streamProxyPlugin } from './proxy.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

const fastify = Fastify({ logger: true });

fastify.get('/healthz', async () => ({ status: 'ok' }));

await fastify.register(streamProxyPlugin, {
  xtream: {
    server: requireEnv('XTREAM_SERVER'),
    username: requireEnv('XTREAM_USERNAME'),
    password: requireEnv('XTREAM_PASSWORD'),
  },
  hmacKey: requireEnv('STREAM_TOKEN_HMAC_KEY'),
});

const port = Number(process.env.PORT ?? 8181);
fastify.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`homelab stream proxy listening on ${address}`);
});
