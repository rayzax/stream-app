import { Storage } from '@google-cloud/storage';
import type { AppConfig } from '../config.js';
import { XtreamClient, type XtreamCategory, type XtreamLiveStream, type XtreamVodStream } from './xtreamClient.js';
import { parseXmltv, nowNext, type EpgProgramme } from './epg.js';
import { fetchLiveGamesByLeague, SPORTS_LEAGUES, type LiveGame } from './espnScoreboard.js';
import { GameMappingStore, type GameMapping } from './gameMappings.js';

export interface ChannelView {
  streamId: number;
  name: string;
  logo: string;
  categoryName: string;
  now?: { title: string; start: string; stop: string };
  next?: { title: string; start: string; stop: string };
}

export interface MovieView {
  streamId: number;
  name: string;
  logo: string;
  categoryName: string;
  rating: string;
  containerExtension: string;
  added: number;
}

export interface SportsEntry {
  streamId: number;
  name: string;
  league: string;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: string;
  awayScore?: string;
  clock?: string;
  /** Set when this entry was pinned/overridden by an admin game mapping. */
  mappingId?: string;
}

interface CachedSnapshot {
  savedAt: string;
  liveCategories: XtreamCategory[];
  liveStreams: XtreamLiveStream[];
  vodCategories: XtreamCategory[];
  vodStreams: XtreamVodStream[];
  xmltv: string;
}

const CACHE_OBJECT = 'catalog-cache.json';

// "NFL 03: Team A vs Team B" / "NBA: Lakers @ Celtics" style provider event-channel names.
const EVENT_CHANNEL_RE = /^([A-Za-z]{2,10})\s*\d*\s*:?\s*(.+?)\s+(?:vs\.?|@|v\.?)\s+(.+)$/i;
const LEAGUE_TOKEN_TO_LABEL: Record<string, string> = {
  NFL: 'Live NFL',
  CFB: 'Live CFB',
  NCAAF: 'Live CFB',
  NBA: 'Live NBA',
  CBB: 'Live CBB',
  NCAAB: 'Live CBB',
  MLB: 'Live MLB',
  NHL: 'Live NHL',
  SOCCER: 'Live Soccer',
  EPL: 'Live Soccer',
  UFC: 'Live UFC/Boxing',
  BOXING: 'Live UFC/Boxing',
  MMA: 'Live UFC/Boxing',
};

function matchesUsFilter(name: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(name));
}

function teamsLooselyMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return norm(a).includes(norm(b)) || norm(b).includes(norm(a));
}

export class CatalogCache {
  private liveCategories: XtreamCategory[] = [];
  private liveStreams: XtreamLiveStream[] = [];
  private vodCategories: XtreamCategory[] = [];
  private vodStreams: XtreamVodStream[] = [];
  private epg: EpgProgramme[] = [];
  // Last-known-good RAW (pre-filter) values, so a partial refreshFull()
  // failure on one endpoint can fall back per-piece instead of all-or-nothing.
  private rawLiveCategories: XtreamCategory[] = [];
  private rawLiveStreams: XtreamLiveStream[] = [];
  private rawVodCategories: XtreamCategory[] = [];
  private rawVodStreams: XtreamVodStream[] = [];
  private rawXmltv = '';
  private liveGamesByLeague: Record<string, LiveGame[]> = {};
  private gameMappings: GameMapping[] = [];
  private lastFullRefresh: Date | null = null;
  private storage?: Storage;
  private mappingStore = new GameMappingStore();

  constructor(
    private config: AppConfig,
    private xtream: XtreamClient,
  ) {
    if (config.cacheBucket) {
      this.storage = new Storage();
    }
  }

  get lastRefreshedAt(): Date | null {
    return this.lastFullRefresh;
  }

  /**
   * Fetches the full Xtream catalog + XMLTV, filters to US content, persists
   * a last-good copy to GCS. Uses allSettled, not all — a single slow/failed
   * endpoint (XMLTV and the stream lists can be multi-MB for a large
   * catalog) no longer discards everything else that *did* succeed. Each
   * piece falls back to its last-known-good value on failure.
   */
  async refreshFull(): Promise<void> {
    const [liveCategoriesR, liveStreamsR, vodCategoriesR, vodStreamsR, xmltvR] = await Promise.allSettled([
      this.xtream.getLiveCategories(),
      this.xtream.getLiveStreams(),
      this.xtream.getVodCategories(),
      this.xtream.getVodStreams(),
      this.xtream.getXmltv(),
    ]);

    const failures: string[] = [];
    const pick = <T,>(label: string, result: PromiseSettledResult<T>, fallback: T): T => {
      if (result.status === 'fulfilled') return result.value;
      failures.push(label);
      console.error(`Catalog refresh: ${label} failed, keeping last-known value`, result.reason);
      return fallback;
    };

    const snapshot: CachedSnapshot = {
      savedAt: new Date().toISOString(),
      liveCategories: pick('get_live_categories', liveCategoriesR, this.rawLiveCategories),
      liveStreams: pick('get_live_streams', liveStreamsR, this.rawLiveStreams),
      vodCategories: pick('get_vod_categories', vodCategoriesR, this.rawVodCategories),
      vodStreams: pick('get_vod_streams', vodStreamsR, this.rawVodStreams),
      xmltv: pick('xmltv.php', xmltvR, this.rawXmltv),
    };

    const anySucceeded = failures.length < 5;
    if (anySucceeded) {
      this.applySnapshot(snapshot);
      this.lastFullRefresh = new Date();
      if (failures.length === 0) {
        await this.persistSnapshot(snapshot);
      }
    } else {
      console.error('Catalog refresh: every endpoint failed, trying last-good GCS snapshot');
      if (!this.lastFullRefresh) await this.loadFromGcs();
    }
  }

  /** Cheap refresh for the Sports tab: re-pulls ESPN scores + admin game mappings. */
  async refreshSportsOnly(): Promise<void> {
    const [liveGamesByLeague, gameMappings] = await Promise.all([
      fetchLiveGamesByLeague(),
      this.mappingStore.list().catch((err) => {
        console.error('Failed to load game mappings', err);
        return this.gameMappings; // keep last-known on transient Firestore error
      }),
    ]);
    this.liveGamesByLeague = liveGamesByLeague;
    this.gameMappings = gameMappings;
  }

  private applySnapshot(snapshot: CachedSnapshot): void {
    const usFilter = (c: XtreamCategory) => matchesUsFilter(c.category_name, this.config.usFilterPatterns);
    const liveCategories = snapshot.liveCategories.filter(usFilter);
    const liveCategoryIds = new Set(liveCategories.map((c) => c.category_id));
    const vodCategories = snapshot.vodCategories.filter(usFilter);
    const vodCategoryIds = new Set(vodCategories.map((c) => c.category_id));

    this.liveCategories = liveCategories;
    this.liveStreams = snapshot.liveStreams.filter((s) => liveCategoryIds.has(s.category_id));
    this.vodCategories = vodCategories;
    this.vodStreams = snapshot.vodStreams.filter((s) => vodCategoryIds.has(s.category_id));
    this.epg = parseXmltv(snapshot.xmltv);

    this.rawLiveCategories = snapshot.liveCategories;
    this.rawLiveStreams = snapshot.liveStreams;
    this.rawVodCategories = snapshot.vodCategories;
    this.rawVodStreams = snapshot.vodStreams;
    this.rawXmltv = snapshot.xmltv;
  }

  private async persistSnapshot(snapshot: CachedSnapshot): Promise<void> {
    if (!this.storage) return;
    try {
      const file = this.storage.bucket(this.config.cacheBucket).file(CACHE_OBJECT);
      await file.save(JSON.stringify(snapshot), { contentType: 'application/json' });
    } catch (err) {
      console.error('Failed to persist catalog snapshot to GCS', err);
    }
  }

  async loadFromGcs(): Promise<boolean> {
    if (!this.storage) return false;
    try {
      const file = this.storage.bucket(this.config.cacheBucket).file(CACHE_OBJECT);
      const [contents] = await file.download();
      const snapshot = JSON.parse(contents.toString('utf8')) as CachedSnapshot;
      this.applySnapshot(snapshot);
      console.log(`Loaded last-good catalog snapshot from GCS (saved ${snapshot.savedAt})`);
      return true;
    } catch (err) {
      console.error('No usable GCS snapshot to cold-start from', err);
      return false;
    }
  }

  categoriesTv(): XtreamCategory[] {
    return this.liveCategories;
  }

  channelsForCategory(categoryId: string): ChannelView[] {
    const now = new Date();
    return this.liveStreams
      .filter((s) => s.category_id === categoryId)
      .map((s) => {
        const channelId = s.epg_channel_id ?? '';
        const { now: n, next } = nowNext(this.epg, channelId, now);
        return {
          streamId: s.stream_id,
          name: s.name,
          logo: s.stream_icon,
          categoryName: this.liveCategories.find((c) => c.category_id === categoryId)?.category_name ?? '',
          now: n ? { title: n.title, start: n.start.toISOString(), stop: n.stop.toISOString() } : undefined,
          next: next ? { title: next.title, start: next.start.toISOString(), stop: next.stop.toISOString() } : undefined,
        };
      });
  }

  categoriesMovies(): XtreamCategory[] {
    return this.vodCategories;
  }

  moviesForCategory(categoryId: string): MovieView[] {
    return this.vodStreams
      .filter((s) => s.category_id === categoryId)
      .map((s) => ({
        streamId: s.stream_id,
        name: s.name,
        logo: s.stream_icon,
        categoryName: this.vodCategories.find((c) => c.category_id === categoryId)?.category_name ?? '',
        rating: s.rating,
        containerExtension: s.container_extension,
        added: Number(s.added) || 0,
      }));
  }

  async movieDetails(vodId: number) {
    return this.xtream.getVodInfo(vodId);
  }

  /** The Sports tab: live-right-now, grouped by league, with an empty-state per league with nothing live. */
  sportsNow(): Record<string, SportsEntry[]> {
    const now = new Date();
    const result: Record<string, SportsEntry[]> = {};
    for (const league of SPORTS_LEAGUES) result[league] = [];

    for (const stream of this.liveStreams) {
      const eventMatch = EVENT_CHANNEL_RE.exec(stream.name);
      const channelId = stream.epg_channel_id ?? '';
      const { now: nowProgramme } = nowNext(this.epg, channelId, now);

      let league: string | undefined;
      let teamA: string | undefined;
      let teamB: string | undefined;

      if (eventMatch) {
        const token = eventMatch[1].toUpperCase();
        league = LEAGUE_TOKEN_TO_LABEL[token];
        teamA = eventMatch[2].trim();
        teamB = eventMatch[3].trim();
      } else if (nowProgramme && /\b(NFL|NBA|MLB|NHL|NCAA|UFC|Boxing|Soccer)\b/i.test(nowProgramme.title)) {
        const guess = EVENT_CHANNEL_RE.exec(nowProgramme.title);
        if (guess) {
          league = LEAGUE_TOKEN_TO_LABEL[guess[1].toUpperCase()];
          teamA = guess[2].trim();
          teamB = guess[3].trim();
        }
      }

      if (!league) continue;

      const liveGame = (this.liveGamesByLeague[league] ?? []).find(
        (g) => (teamA && teamB && (teamsLooselyMatch(g.homeTeam, teamA) || teamsLooselyMatch(g.homeTeam, teamB))) ||
          teamsLooselyMatch(g.name, stream.name),
      );

      result[league].push({
        streamId: stream.stream_id,
        name: stream.name,
        league,
        homeTeam: liveGame?.homeTeam ?? teamB,
        awayTeam: liveGame?.awayTeam ?? teamA,
        homeScore: liveGame?.homeScore,
        awayScore: liveGame?.awayScore,
        clock: liveGame?.clock,
      });
    }

    // Admin-curated mappings take precedence over the heuristic guess for
    // that exact channel, and are added even when heuristics missed the
    // game entirely (e.g. a channel name the auto-detection can't parse).
    for (const mapping of this.gameMappings) {
      const bucket = result[mapping.league] ?? (result[mapping.league] = []);
      const atMatch = /^(.+?)\s+at\s+(.+)$/i.exec(mapping.label);
      const existingIndex = bucket.findIndex((e) => e.streamId === mapping.streamId);
      const overlay: SportsEntry = {
        streamId: mapping.streamId,
        name: mapping.label,
        league: mapping.league,
        awayTeam: atMatch?.[1]?.trim(),
        homeTeam: atMatch?.[2]?.trim(),
        mappingId: mapping.id,
      };
      if (existingIndex >= 0) {
        bucket[existingIndex] = { ...bucket[existingIndex], ...overlay };
      } else {
        bucket.unshift(overlay);
      }
    }

    return result;
  }

  search(query: string): Array<{ type: 'live' | 'vod'; streamId: number; name: string; categoryName: string }> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const liveMatches = this.liveStreams
      .filter((s) => s.name.toLowerCase().includes(q))
      .map((s) => ({
        type: 'live' as const,
        streamId: s.stream_id,
        name: s.name,
        categoryName: this.liveCategories.find((c) => c.category_id === s.category_id)?.category_name ?? '',
      }));
    const vodMatches = this.vodStreams
      .filter((s) => s.name.toLowerCase().includes(q))
      .map((s) => ({
        type: 'vod' as const,
        streamId: s.stream_id,
        name: s.name,
        categoryName: this.vodCategories.find((c) => c.category_id === s.category_id)?.category_name ?? '',
      }));
    return [...liveMatches, ...vodMatches];
  }
}
