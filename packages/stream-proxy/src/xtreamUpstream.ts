export interface XtreamCreds {
  server: string; // e.g. "https://operator2.barfik.org" (provider is HTTP-only in practice, but keep this generic)
  username: string;
  password: string;
}

/** Upstream URL for a live stream, requesting HLS (.m3u8) output. */
export function liveUpstreamUrl(creds: XtreamCreds, streamId: string): string {
  const base = creds.server.replace(/\/+$/, '');
  return `${base}/live/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${encodeURIComponent(streamId)}.m3u8`;
}

/** Upstream URL for a VOD title. */
export function vodUpstreamUrl(creds: XtreamCreds, streamId: string, ext: string): string {
  const base = creds.server.replace(/\/+$/, '');
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
  return `${base}/movie/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${encodeURIComponent(streamId)}.${safeExt}`;
}

/** Resolves a (possibly relative) segment/playlist URI found inside an upstream .m3u8 against the upstream's own URL. */
export function resolveSegmentUrl(upstreamPlaylistUrl: string, uri: string): URL {
  return new URL(uri, upstreamPlaylistUrl);
}
