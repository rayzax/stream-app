import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyStreamToken } from './tokens.js';
import { liveUpstreamUrl, seriesUpstreamUrl, type XtreamCreds } from './xtreamUpstream.js';

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

/** Streams the upstream response straight through — used for both continuous live TS and VOD files. */
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

  // Continuous raw MPEG-TS passthrough (see xtreamUpstream.ts for why this
  // isn't real HLS). fetch() follows the upstream's 302 to the actual
  // stream automatically.
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
    return proxyBinary(upstreamRes, req, reply);
  });

  fastify.get<{ Querystring: { token: string } }>('/stream/series', async (req, reply) => {
    const verified = verifyStreamToken(req.query.token, hmacKey);
    if (!verified.ok || verified.payload.t !== 'series') {
      return reply.status(401).send({ error: 'invalid_token' });
    }
    const { sid, ext, sess } = verified.payload;
    const upstreamUrl = seriesUpstreamUrl(xtream, sid, ext ?? 'mp4');
    const controller = claimSession(sess, `series:${sid}`);
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
