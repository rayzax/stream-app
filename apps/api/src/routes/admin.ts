import type { FastifyInstance } from 'fastify';
import type { UserStore, Role } from '../services/users.js';
import type { GameMappingStore } from '../services/gameMappings.js';
import type { CatalogCache } from '../services/catalogCache.js';

export async function adminRoutes(
  fastify: FastifyInstance,
  users: UserStore,
  mappings: GameMappingStore,
  catalog: CatalogCache,
): Promise<void> {
  // --- Users -----------------------------------------------------------
  fastify.get('/api/admin/users', async () => {
    return { users: await users.list() };
  });

  fastify.post<{ Body: { username?: string; password?: string; role?: Role } }>('/api/admin/users', async (req, reply) => {
    const { username, password, role } = req.body ?? {};
    if (!username || !password || (role !== 'admin' && role !== 'user')) {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    if (password.length < 8) {
      return reply.status(400).send({ error: 'password_too_short' });
    }
    try {
      const user = await users.create(username, password, role);
      return reply.status(201).send({ user });
    } catch (err) {
      if ((err as { code?: string }).code === 'username_taken') {
        return reply.status(409).send({ error: 'username_taken' });
      }
      throw err;
    }
  });

  fastify.patch<{ Params: { id: string }; Body: { role?: Role; disabled?: boolean; password?: string } }>(
    '/api/admin/users/:id',
    async (req, reply) => {
      const { role, disabled, password } = req.body ?? {};

      // Guard against locking everyone out: can't demote/disable the last enabled admin.
      if ((role === 'user' || disabled === true)) {
        const target = await users.getById(req.params.id);
        if (target?.role === 'admin' && !target.disabled) {
          const adminCount = await users.countAdmins();
          if (adminCount <= 1) {
            return reply.status(400).send({ error: 'cannot_remove_last_admin' });
          }
        }
      }

      if (role) await users.setRole(req.params.id, role);
      if (typeof disabled === 'boolean') await users.setDisabled(req.params.id, disabled);
      if (password) {
        if (password.length < 8) return reply.status(400).send({ error: 'password_too_short' });
        await users.resetPassword(req.params.id, password);
      }
      return { ok: true };
    },
  );

  fastify.delete<{ Params: { id: string } }>('/api/admin/users/:id', async (req, reply) => {
    const target = await users.getById(req.params.id);
    if (target?.role === 'admin') {
      const adminCount = await users.countAdmins();
      if (adminCount <= 1) {
        return reply.status(400).send({ error: 'cannot_remove_last_admin' });
      }
    }
    await users.delete(req.params.id);
    return { ok: true };
  });

  // --- Game-to-channel mappings ------------------------------------------
  fastify.get('/api/admin/mappings', async () => {
    return { mappings: await mappings.list() };
  });

  // ESPN games currently live that don't have a channel yet (auto-detected
  // or admin-mapped) — what the category browser below is for fixing.
  fastify.get('/api/admin/unmapped-games', async () => {
    return { leagues: catalog.unmappedLiveGames() };
  });

  // Category browser: list of live-TV categories, then channels within one
  // (cheap — no guide/now-next lookup) so the admin can expand e.g. "US|
  // NFL PPV" and pick the exact channel for a game above.
  fastify.get('/api/admin/channel-categories', async () => {
    return { categories: catalog.categoriesTv().map((c) => ({ categoryId: c.category_id, categoryName: c.category_name })) };
  });

  fastify.get<{ Params: { categoryId: string } }>('/api/admin/channel-categories/:categoryId/channels', async (req) => {
    return { channels: catalog.channelsForCategoryBasic(req.params.categoryId) };
  });

  fastify.post<{ Body: { league?: string; label?: string; streamId?: number } }>(
    '/api/admin/mappings',
    async (req, reply) => {
      const { league, label, streamId } = req.body ?? {};
      if (!league || !label || !streamId) {
        return reply.status(400).send({ error: 'invalid_request' });
      }
      const mapping = await mappings.upsert({ league, label, streamId, createdBy: req.user!.username });
      return reply.status(201).send({ mapping });
    },
  );

  fastify.delete<{ Params: { id: string } }>('/api/admin/mappings/:id', async (req, reply) => {
    await mappings.delete(req.params.id);
    return { ok: true };
  });
}
