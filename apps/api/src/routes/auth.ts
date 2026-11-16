import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import type { AppConfig } from '../config.js';
import { createSessionCookie, isRateLimited, recordFailedAttempt, clearAttempts } from '../lib/session.js';
import type { UserStore } from '../services/users.js';

const COOKIE_NAME = 'stream_session';

export async function authRoutes(fastify: FastifyInstance, config: AppConfig, users: UserStore): Promise<void> {
  fastify.post<{ Body: { username?: string; password?: string } }>('/api/login', async (req, reply) => {
    const ip = req.ip;
    if (isRateLimited(ip)) {
      return reply.status(429).send({ error: 'too_many_attempts' });
    }

    const { username, password } = req.body ?? {};
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      recordFailedAttempt(ip);
      return reply.status(400).send({ error: 'username_and_password_required' });
    }

    const user = await users.getByUsernameWithHash(username);
    if (!user || user.disabled) {
      recordFailedAttempt(ip);
      return reply.status(401).send({ error: 'invalid_credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      recordFailedAttempt(ip);
      return reply.status(401).send({ error: 'invalid_credentials' });
    }

    clearAttempts(ip);
    const { cookieValue } = createSessionCookie(config.sessionSigningKey, user.id);
    reply.setCookie(COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 90 * 24 * 60 * 60,
    });
    return { ok: true, user: { id: user.id, username: user.username, role: user.role } };
  });

  fastify.post('/api/logout', async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  });
}
