import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyStreamToken } from './tokens.js';
import { liveUpstreamUrl, vodUpstreamUrl, resolveSegmentUrl, type XtreamCreds } from './xtreamUpstream.js';

export interface StreamProxyOptions {
  xtream: XtreamCreds;
  hmacKey: string;
}

interface ActiveStream {
  controller: AbortController;
  /** sid+type, so re-requesting the SAME stream doesn't abort itself. */
  key: string;
}

// Best-effort, per-process only — see README "known limitations" (no shared
// store; reliable only when this proxy runs as a single instance, which is
// why Cloud Run max_instance_count is pinned to 1 for this service).
const activeBySession = new Map<string, ActiveStream>();

function claimSession(sessionId: string, key: string): AbortController {
  const existing = activeBySession.get(sessionId);
  if (existing && existing.key !== key) {
    existing.controller.abort();
  }
  const controller = new AbortController();
  activeBySession.set(sessionId, { controller, key });
  return controller;
}

function releaseSession(sessionId: string, controller: AbortController) {
  const current = activeBySession.get(sessionId);
  if (current && current.controller === controller) {
    activeBySession.delete(sessionId);
  }
}

function isPlaylist(contentType: string | null, url: string): boolean {
  return (contentType ?? '').includes('mpegurl') || url.endsWith('.m3u8');
}

async function rewriteAndSendPlaylist(
  upstreamUrl: string,
  token: string,
  upstreamRes: Response,
  reply: FastifyReply,
): Promise<void> {
  const text = await upstreamRes.text();
  const rewritten = text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      const resolved = resolveSegmentUrl(upstreamUrl, trimmed);
      const encoded = Buffer.from(resolved.toString()).toString('base64url');
      // Query params, not path segments: tokens/encoded URLs regularly run
      // >100 chars, and a single path SEGMENT over ~100 chars gets silently
      // 404'd (seen on Cloud Run's default domain — likely GFE-level path
      // canonicalization, not a Fastify limit) while query strings of the
      // same or greater length work fine.
      return `/stream/seg?token=${token}&u=${encoded}`;
    })
    .join('\n');
  reply
    .header('content-type', 'application/vnd.apple.mpegurl')
    .header('cache-control', 'no-store')
    .send(rewritten);
}

async function proxyBinary(upstreamRes: Response, req: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(upstreamRes.status);
  for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const value = upstreamRes.headers.get(header);
    if (value) reply.header(header, value);
  }
  reply.header('cache-control', 'no-store');
  if (!upstreamRes.body) {
    reply.send();
    return;
  }
  reply.send(upstreamRes.body as unknown as NodeJS.ReadableStream);
}

export async function streamProxyPlugin(fastify: FastifyInstance, opts: StreamProxyOptions): Promise<void> {
  const { xtream, hmacKey } = opts;

  fastify.get<{ Querystring: { token: string } }>('/stream/live', async (req, reply) => {
    const verified = verifyStreamToken(req.query.token, hmacKey);
    if (!verified.ok || verified.payload.t !== 'live') {
      return reply.status(401).send({ error: 'invalid_token' });
    }
    const { sid, sess } = verified.payload;
    const upstreamUrl = liveUpstreamUrl(xtream, sid);
    const controller = claimSession(sess, `live:${sid}`);
    req.raw.on('close', () => releaseSession(sess, controller));

    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(upstreamUrl, { signal: controller.signal });
    } catch {
      return reply.status(502).send({ error: 'upstream_unreachable' });
    }
    if (!upstreamRes.ok) {
      return reply.status(502).send({ error: 'upstream_error', status: upstreamRes.status });
    }
    return rewriteAndSendPlaylist(upstreamUrl, req.query.token, upstreamRes, reply);
  });

  fastify.get<{ Querystring: { token: string; u: string } }>('/stream/seg', async (req, reply) => {
    const verified = verifyStreamToken(req.query.token, hmacKey);
    if (!verified.ok) {
      return reply.status(401).send({ error: 'invalid_token' });
    }
    let upstreamUrl: string;
    try {
      upstreamUrl = Buffer.from(req.query.u, 'base64url').toString('utf8');
      // Only ever fetch something derived from our own configured Xtream server.
      if (!upstreamUrl.startsWith(xtream.server.replace(/\/+$/, ''))) {
        throw new Error('origin_mismatch');
      }
    } catch {
      return reply.status(400).send({ error: 'bad_segment_ref' });
    }

    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(upstreamUrl, {
        headers: req.headers.range ? { range: req.headers.range as string } : undefined,
      });
    } catch {
      return reply.status(502).send({ error: 'upstream_unreachable' });
    }
    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return reply.status(502).send({ error: 'upstream_error', status: upstreamRes.status });
    }

    if (isPlaylist(upstreamRes.headers.get('content-type'), upstreamUrl)) {
      return rewriteAndSendPlaylist(upstreamUrl, req.query.token, upstreamRes, reply);
    }
    return proxyBinary(upstreamRes, req, reply);
  });

  fastify.get<{ Querystring: { token: string } }>('/stream/vod', async (req, reply) => {
    const verified = verifyStreamToken(req.query.token, hmacKey);
    if (!verified.ok || verified.payload.t !== 'vod') {
      return reply.status(401).send({ error: 'invalid_token' });
    }
    const { sid, ext, sess } = verified.payload;
    const upstreamUrl = vodUpstreamUrl(xtream, sid, ext ?? 'mp4');
    const controller = claimSession(sess, `vod:${sid}`);
    req.raw.on('close', () => releaseSession(sess, controller));

    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(upstreamUrl, {
        signal: controller.signal,
        headers: req.headers.range ? { range: req.headers.range as string } : undefined,
      });
    } catch {
      return reply.status(502).send({ error: 'upstream_unreachable' });
    }
    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return reply.status(502).send({ error: 'upstream_error', status: upstreamRes.status });
    }
    return proxyBinary(upstreamRes, req, reply);
  });
}
