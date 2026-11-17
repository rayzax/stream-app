import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WatchHistoryStore } from '../services/watchHistory.js';

interface RecordBody {
  streamId: number;
  type: 'vod' | 'series';
  name: string;
  logo: string;
  playStreamId: number;
  ext: string;
}

export async function watchHistoryRoutes(fastify: FastifyInstance, store: WatchHistoryStore): Promise<void> {
  fastify.post<{ Body: RecordBody }>('/api/watch-history', async (req: FastifyRequest<{ Body: RecordBody }>, reply) => {
    const { streamId, type, name, logo, playStreamId, ext } = req.body ?? {};
    if (!streamId || (type !== 'vod' && type !== 'series') || !name || !playStreamId || !ext) {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    await store.record(req.user!.id, { streamId, type, name, logo: logo ?? '', playStreamId, ext });
    return { ok: true };
  });

  fastify.get('/api/watch-history', async (req) => {
    const items = await store.list(req.user!.id);
    return { items };
  });
}
