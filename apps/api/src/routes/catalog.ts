import type { FastifyInstance } from 'fastify';
import type { CatalogCache } from '../services/catalogCache.js';

export async function catalogRoutes(fastify: FastifyInstance, cache: CatalogCache): Promise<void> {
  fastify.get('/api/sports', async () => {
    return { leagues: cache.sportsNow(), lastRefreshed: cache.lastRefreshedAt };
  });

  fastify.get('/api/tv', async () => {
    const categories = cache.categoriesTv().map((c) => ({
      categoryId: c.category_id,
      categoryName: c.category_name,
      channels: cache.channelsForCategory(c.category_id),
    }));
    return { categories };
  });

  fastify.get('/api/tv/guide', async () => {
    return { channels: cache.channelsForGuide() };
  });

  fastify.get('/api/movies', async () => {
    const categories = cache.categoriesMovies().map((c) => ({
      categoryId: c.category_id,
      categoryName: c.category_name,
      movies: cache.moviesForCategory(c.category_id),
    }));
    return { categories };
  });

  fastify.get<{ Params: { id: string } }>('/api/movies/:id', async (req, reply) => {
    const vodId = Number(req.params.id);
    if (!Number.isFinite(vodId)) return reply.status(400).send({ error: 'invalid_id' });
    try {
      return await cache.movieDetails(vodId);
    } catch {
      return reply.status(502).send({ error: 'upstream_error' });
    }
  });

  fastify.get<{ Querystring: { q?: string } }>('/api/search', async (req) => {
    const results = cache.search(req.query.q ?? '');
    return {
      live: results.filter((r) => r.type === 'live'),
      vod: results.filter((r) => r.type === 'vod'),
    };
  });
}
