import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifySessionCookie } from './session.js';
import type { UserRecord } from '../services/users.js';
import type { UserStore } from '../services/users.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserRecord;
    /** Alias for user.id — kept distinct since the stream-proxy only cares about this. */
    sessionId?: string;
  }
}

export function requireSession(signingKey: string, users: UserStore) {
  return async function authGuard(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const cookieValue = req.cookies?.stream_session;
    const session = verifySessionCookie(cookieValue, signingKey);
    if (!session) {
      reply.status(401).send({ error: 'unauthenticated' });
      return;
    }
    const user = await users.getById(session.uid);
    if (!user || user.disabled) {
      reply.status(401).send({ error: 'unauthenticated' });
      return;
    }
    req.user = user;
    req.sessionId = user.id;
  };
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (req.user?.role !== 'admin') {
    reply.status(403).send({ error: 'forbidden' });
  }
}
