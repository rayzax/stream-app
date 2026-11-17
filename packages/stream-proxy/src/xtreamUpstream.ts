export interface XtreamCreds {
  server: string; // e.g. "https://operator2.barfik.org" (provider is HTTP-only in practice, but keep this generic)
  username: string;
  password: string;
}

/**
 * Upstream URL for a live stream. Requests the raw .ts endpoint directly —
 * on this provider (and apparently typical of this class of Xtream panel),
 * the .m3u8 "HLS" output is a non-functional wrapper: it always declares
 * exactly one 10-second segment followed by #EXT-X-ENDLIST, but the
 * segment it points at is actually a genuinely continuous, never-ending
 * MPEG-TS stream (confirmed: a 60s fetch only got partway through and kept
 * growing). HLS players stall trying to fully buffer a "segment" that never
 * finishes. The .ts endpoint redirects (302) straight to that same
 * continuous `video/mp2t` stream, which is exactly what mpegts.js is
 * built to play — see VideoPlayer.tsx.
 */
export function liveUpstreamUrl(creds: XtreamCreds, streamId: string): string {
  const base = creds.server.replace(/\/+$/, '');
  return `${base}/live/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${encodeURIComponent(streamId)}.ts`;
}

/** Upstream URL for a series episode — a direct file passthrough, same as a VOD movie would be, under "/series/". */
export function seriesUpstreamUrl(creds: XtreamCreds, episodeId: string, ext: string): string {
  const base = creds.server.replace(/\/+$/, '');
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
  return `${base}/series/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${encodeURIComponent(episodeId)}.${safeExt}`;
}
