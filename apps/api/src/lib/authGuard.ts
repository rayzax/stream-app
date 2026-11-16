import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifySessionCookie } from './session.js';

declare module 'fastify' {
  interface FastifyRequest {
    sessionId?: string;
  }
}

export function requireSession(signingKey: string) {
  return async function authGuard(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const cookieValue = req.cookies?.stream_session;
    const session = verifySessionCookie(cookieValue, signingKey);
    if (!session) {
      reply.status(401).send({ error: 'unauthenticated' });
      return;
    }
    req.sessionId = session.sid;
  };
}
