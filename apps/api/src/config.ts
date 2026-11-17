function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseUsFilterPatterns(): RegExp[] {
  const raw = process.env.US_FILTER_PATTERNS;
  // Default assumes the common Xtream convention of a leading region prefix
  // like "US| ..." (verified against this provider's real category list —
  // a loose "\bEN\b"/"English" match was tried first and wrongly pulled in
  // "ASIA| ENGLISH" etc., so prefix-anchoring matters here). Override via
  // US_FILTER_PATTERNS (comma-separated regexes) if your provider's
  // category names don't follow this convention.
  const defaults = ['^US\\s*\\|', '^USA\\s*\\|', '\\bUnited States\\b'];
  const patterns = raw ? raw.split(',').map((p) => p.trim()).filter(Boolean) : defaults;
  return patterns.map((p) => new RegExp(p, 'i'));
}

function parseVodExcludePatterns(): RegExp[] {
  const raw = process.env.VOD_EXCLUDE_PATTERNS;
  // VOD categories on this provider do NOT use the live-TV "US|" prefix
  // convention at all — they're named by streaming service (NETFLIX
  // MOVIES, AMAZON MOVIES, ...) with no region tag, by an explicit
  // "<code> - " prefix (including compound codes like "PT/BR - "), by a
  // bare region/service word with no dash at all (NORDIC, DANSKE, OSN+,
  // ...), or — for a large chunk of real categories — entirely in Arabic
  // script with no Latin marker whatsoever (verified against this
  // provider's real category list: ~90 categories like "أفلام عربية
  // حديثه"). No Latin-code regex can ever catch that last group, so
  // non-Latin script is matched directly. There's no reliable positive "is
  // US" signal for VOD, so the safe default is an EXCLUDE list rather than
  // an include list — showing too much beats showing nothing. "EN -"
  // (English) is deliberately NOT in this list. Override via
  // VOD_EXCLUDE_PATTERNS (comma-separated regexes); set it to an empty
  // value to disable VOD filtering entirely.
  const defaultCodes = [
    'AF', 'AL', 'BE', 'BG', 'BN', 'BR', 'CN', 'DE', 'ES', 'EX', 'FR', 'GR', 'IL', 'IN', 'IR', 'IT',
    'JP', 'KU', 'LA', 'MT', 'NL', 'PH', 'PK', 'PL', 'PT', 'QC', 'RO', 'RU', 'SO', 'TR',
  ];
  const codePrefix = `^(${defaultCodes.join('|')})(/(${defaultCodes.join('|')}))?\\s*-\\s`;
  // JS's "\b" only treats ASCII [A-Za-z0-9_] as word characters, so it
  // silently fails to match right next to "+" (OSN+) or a leading accented
  // letter (ÍSLANDS) — in both cases the boundary check falls between two
  // chars it considers non-word, which never satisfies \b. Those two are
  // matched without boundaries instead; everything else is plain ASCII and
  // safe to anchor normally.
  const bareWords = ['NORDIC', 'NORGE', 'DANSKE', 'SVENSKA', 'SUOMEN', 'VIAPLAY', 'ARABIA'];
  const bareWordPattern = `\\b(${bareWords.join('|')})\\b|OSN\\+|ÍSLANDS`;
  const nonLatinScript = '[\\u0590-\\u08FF]';
  const defaults = [codePrefix, bareWordPattern, nonLatinScript];
  const patterns = raw !== undefined ? raw.split(',').map((p) => p.trim()).filter(Boolean) : defaults;
  return patterns.map((p) => new RegExp(p, 'i'));
}

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  xtream: { server: string; username: string; password: string };
  sessionSigningKey: string;
  streamTokenHmacKey: string;
  cacheBucket: string;
  gcpProjectId: string;
  streamMode: 'cloudrun' | 'homelab';
  homelabProxyUrl: string;
  usFilterPatterns: RegExp[];
  vodExcludePatterns: RegExp[];
  catalogRefreshMs: number;
  sportsRefreshMs: number;
}

export function loadConfig(): AppConfig {
  const streamMode = (process.env.STREAM_MODE ?? 'cloudrun') as 'cloudrun' | 'homelab';
  if (streamMode !== 'cloudrun' && streamMode !== 'homelab') {
    throw new Error(`Invalid STREAM_MODE: ${streamMode}`);
  }

  return {
    port: parseInt(process.env.PORT ?? '8080', 10),
    host: process.env.HOST ?? '0.0.0.0',
    nodeEnv: process.env.NODE_ENV ?? 'production',
    xtream: {
      server: requireEnv('XTREAM_SERVER'),
      username: requireEnv('XTREAM_USERNAME'),
      password: requireEnv('XTREAM_PASSWORD'),
    },
    sessionSigningKey: requireEnv('SESSION_SIGNING_KEY'),
    streamTokenHmacKey: requireEnv('STREAM_TOKEN_HMAC_KEY'),
    cacheBucket: process.env.CACHE_BUCKET ?? '',
    gcpProjectId: process.env.GCP_PROJECT_ID ?? '',
    streamMode,
    homelabProxyUrl: process.env.HOMELAB_PROXY_URL ?? '',
    usFilterPatterns: parseUsFilterPatterns(),
    vodExcludePatterns: parseVodExcludePatterns(),
    catalogRefreshMs: Number(process.env.CATALOG_REFRESH_MS ?? 20 * 60 * 1000),
    sportsRefreshMs: Number(process.env.SPORTS_REFRESH_MS ?? 60 * 1000),
  };
}
