import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export interface SessionPayload {
  sid: string;
  exp: number;
}

const SESSION_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days — long-lived by design (phone, infrequent re-login)

function sign(payloadB64: string, key: string): string {
  return createHmac('sha256', key).update(payloadB64).digest('base64url');
}

export function createSessionCookie(signingKey: string): { cookieValue: string; sessionId: string } {
  const sid = randomUUID();
  const payload: SessionPayload = { sid, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(payloadB64, signingKey);
  return { cookieValue: `${payloadB64}.${sig}`, sessionId: sid };
}

export function verifySessionCookie(cookieValue: string | undefined, signingKey: string): SessionPayload | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;

  const expectedSig = sign(payloadB64, signingKey);
  const sigBuf = Buffer.from(sig, 'base64url');
  const expectedBuf = Buffer.from(expectedSig, 'base64url');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// Best-effort in-memory login rate limiter. Per-process only (see README
// "known limitations") — acceptable for a single-user app on a service
// pinned to max_instance_count = 1.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}
