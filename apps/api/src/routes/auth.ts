import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import type { AppConfig } from '../config.js';
import { createSessionCookie, isRateLimited, recordFailedAttempt, clearAttempts } from '../lib/session.js';

const COOKIE_NAME = 'stream_session';

export async function authRoutes(fastify: FastifyInstance, config: AppConfig): Promise<void> {
  fastify.post<{ Body: { password?: string } }>('/api/login', async (req, reply) => {
    const ip = req.ip;
    if (isRateLimited(ip)) {
      return reply.status(429).send({ error: 'too_many_attempts' });
    }

    const password = req.body?.password;
    if (!password || typeof password !== 'string') {
      recordFailedAttempt(ip);
      return reply.status(400).send({ error: 'password_required' });
    }

    const valid = await bcrypt.compare(password, config.appPasswordHash);
    if (!valid) {
      recordFailedAttempt(ip);
      return reply.status(401).send({ error: 'invalid_password' });
    }

    clearAttempts(ip);
    const { cookieValue } = createSessionCookie(config.sessionSigningKey);
    reply.setCookie(COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 90 * 24 * 60 * 60,
    });
    return { ok: true };
  });

  fastify.post('/api/logout', async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  });
}
