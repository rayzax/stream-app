import type { FastifyInstance, FastifyRequest } from 'fastify';
import { issueStreamToken } from '@stream/proxy';
import type { AppConfig } from '../config.js';

async function homelabHealthy(homelabProxyUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${homelabProxyUrl.replace(/\/+$/, '')}/healthz`, { signal: AbortSignal.timeout(2_000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function streamRoutes(fastify: FastifyInstance, config: AppConfig): Promise<void> {
  fastify.post<{ Body: { streamId: number; type: 'live' | 'series'; ext?: string } }>(
    '/api/stream-token',
    async (req: FastifyRequest<{ Body: { streamId: number; type: 'live' | 'series'; ext?: string } }>, reply) => {
      const { streamId, type, ext } = req.body ?? {};
      if (!streamId || (type !== 'live' && type !== 'series')) {
        return reply.status(400).send({ error: 'invalid_request' });
      }

      const token = issueStreamToken(
        { sid: String(streamId), t: type, ext, sess: req.sessionId! },
        config.streamTokenHmacKey,
      );

      let via: 'homelab' | 'cloud' = 'cloud';
      let baseUrl = '';
      if (config.streamMode === 'homelab' && config.homelabProxyUrl) {
        if (await homelabHealthy(config.homelabProxyUrl)) {
          via = 'homelab';
          baseUrl = config.homelabProxyUrl.replace(/\/+$/, '');
        }
      }

      const path = `/stream/${type}?token=${token}`;
      return { url: `${baseUrl}${path}`, via, expiresInSeconds: 6 * 60 * 60 };
    },
  );
}
