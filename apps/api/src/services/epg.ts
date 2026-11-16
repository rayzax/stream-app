import { XMLParser } from 'fast-xml-parser';

export interface EpgProgramme {
  channelId: string;
  title: string;
  start: Date;
  stop: Date;
}

// Real-world XMLTV guides carry thousands of HTML entities across programme
// descriptions — fast-xml-parser's default anti-DoS caps (tuned for
// arbitrary untrusted XML) are too tight for this trusted, configured
// provider's EPG. Raise them generously rather than disabling entity
// processing outright.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  processEntities: {
    enabled: true,
    maxTotalExpansions: 200_000,
    maxExpandedLength: 5_000_000,
  },
});

/** XMLTV timestamps look like "20231101120000 +0000". */
function parseXmltvTime(value: string): Date {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/.exec(value.trim());
  if (!match) return new Date(NaN);
  const [, y, mo, d, h, mi, s, tz] = match;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${tz ? `${tz.slice(0, 3)}:${tz.slice(3)}` : 'Z'}`;
  return new Date(iso);
}

export function parseXmltv(xml: string): EpgProgramme[] {
  const doc = parser.parse(xml);
  const rawProgrammes = doc?.tv?.programme;
  if (!rawProgrammes) return [];
  const list = Array.isArray(rawProgrammes) ? rawProgrammes : [rawProgrammes];

  return list
    .map((p): EpgProgramme | null => {
      const channelId = p['@_channel'];
      const start = p['@_start'];
      const stop = p['@_stop'];
      const title = typeof p.title === 'object' ? p.title['#text'] ?? '' : p.title ?? '';
      if (!channelId || !start || !stop) return null;
      return { channelId, title: String(title), start: parseXmltvTime(start), stop: parseXmltvTime(stop) };
    })
    .filter((p): p is EpgProgramme => p !== null);
}

/**
 * Groups + sorts programmes by channel ONCE. Doing this once per catalog
 * refresh instead of filtering/sorting the full (potentially huge) EPG for
 * every channel on every request is the difference between O(channels ×
 * programmes) per request and O(programmes) once — the former was blocking
 * Node's event loop long enough to stall unrelated requests (e.g. login)
 * while 12k+ channels' worth of "now/next" got recomputed synchronously.
 */
export function buildEpgIndex(programmes: EpgProgramme[]): Map<string, EpgProgramme[]> {
  const byChannel = new Map<string, EpgProgramme[]>();
  for (const p of programmes) {
    const list = byChannel.get(p.channelId);
    if (list) list.push(p);
    else byChannel.set(p.channelId, [p]);
  }
  for (const list of byChannel.values()) {
    list.sort((a, b) => a.start.getTime() - b.start.getTime());
  }
  return byChannel;
}

export function nowNextFromIndex(index: Map<string, EpgProgramme[]>, channelId: string, at: Date = new Date()) {
  const forChannel = index.get(channelId);
  if (!forChannel) return { now: undefined, next: undefined };
  const now = forChannel.find((p) => p.start <= at && at < p.stop);
  const next = forChannel.find((p) => p.start > at);
  return { now, next };
}
