import { createHmac, timingSafeEqual } from 'node:crypto';

export type StreamType = 'live' | 'series';

export interface StreamTokenPayload {
  /** Xtream stream_id ('series' is the episode's own stream id). */
  sid: string;
  /** Container extension for a series episode (e.g. "mp4", "mkv"); ignored for live. */
  ext?: string;
  t: StreamType;
  /** App session id — lets the proxy enforce one active upstream per session. */
  sess: string;
  /** Unix seconds expiry. */
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadB64: string, hmacKey: string): string {
  return createHmac('sha256', hmacKey).update(payloadB64).digest('base64url');
}

/** Issues a signed, short-lived stream token. Called by the app's API, never by the browser directly. */
export function issueStreamToken(
  payload: Omit<StreamTokenPayload, 'exp'>,
  hmacKey: string,
  ttlSeconds = 6 * 60 * 60,
): string {
  const full: StreamTokenPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const payloadB64 = b64url(JSON.stringify(full));
  const sig = sign(payloadB64, hmacKey);
  return `${payloadB64}.${sig}`;
}

export type VerifyResult =
  | { ok: true; payload: StreamTokenPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

/** Verifies a stream token. Used by the proxy (Cloud Run or homelab) on every request. */
export function verifyStreamToken(token: string, hmacKey: string): VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [payloadB64, sig] = parts;

  const expectedSig = sign(payloadB64, hmacKey);
  const sigBuf = Buffer.from(sig, 'base64url');
  const expectedBuf = Buffer.from(expectedSig, 'base64url');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload: StreamTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, payload };
}
