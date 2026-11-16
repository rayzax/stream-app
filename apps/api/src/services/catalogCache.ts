import { Storage } from '@google-cloud/storage';
import type { AppConfig } from '../config.js';
import { XtreamClient, type XtreamCategory, type XtreamLiveStream, type XtreamVodStream } from './xtreamClient.js';
import { parseXmltv, buildEpgIndex, nowNextFromIndex, type EpgProgramme } from './epg.js';
import { fetchLiveGamesByLeague, SPORTS_LEAGUES, type LiveGame } from './espnScoreboard.js';
import { GameMappingStore, type GameMapping } from './gameMappings.js';

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

export interface ChannelView {
  streamId: number;
  num: number;
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

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Real provider channel names vary a lot in how they decorate the matchup
 * ("NFL  | 13 - SNF 8:20pm Steelers at Bengals", "Boxing 3 | Canelo vs
 * Mbilli  UK 2:00pm") — trying to parse out clean team names from that
 * with a single regex is brittle (and originally missed "at" as a
 * separator entirely, which is why NFL games never matched while NHL's
 * "@" happened to work). Instead: just detect the league from the leading
 * word, then confirm + attach clean data by checking whether BOTH of an
 * ESPN live game's team nicknames appear in the channel name — this also
 * naturally filters out the pre-game/post-game channels for the same PPV
 * lineup, since there's no "in-progress" ESPN game for those to match.
 */
function leadingLeagueToken(name: string): string | undefined {
  const m = /^([A-Za-z]{2,10})\b/.exec(name.trim());
  return m ? LEAGUE_TOKEN_TO_LABEL[m[1].toUpperCase()] : undefined;
}

function teamNicknameCandidates(fullTeamName: string): string[] {
  const words = fullTeamName.trim().split(/\s+/);
  const candidates: string[] = [words[words.length - 1]];
  if (words.length >= 2) candidates.push(words.slice(-2).join(' '));
  return candidates;
}

function channelMatchesLiveGame(channelName: string, game: LiveGame): boolean {
  const normChannel = normalizeForMatch(channelName);
  const matchesEither = (fullName: string) =>
    teamNicknameCandidates(fullName).some((c) => normChannel.includes(normalizeForMatch(c)));
  return matchesEither(game.homeTeam) && matchesEither(game.awayTeam);
}

export class CatalogCache {
  private liveCategories: XtreamCategory[] = [];
  private liveStreams: XtreamLiveStream[] = [];
  private vodCategories: XtreamCategory[] = [];
  private vodStreams: XtreamVodStream[] = [];
  // Pre-grouped/indexed derived structures — built ONCE per refresh instead
  // of being recomputed by scanning the full arrays on every request. With
  // a catalog this size (12k+ channels), the per-request versions of these
  // were blocking Node's single event loop for seconds at a time, stalling
  // unrelated requests (login included) while they ran.
  private liveCategoriesById = new Map<string, XtreamCategory>();
  private vodCategoriesById = new Map<string, XtreamCategory>();
  private liveStreamsByCategory = new Map<string, XtreamLiveStream[]>();
  private vodStreamsByCategory = new Map<string, XtreamVodStream[]>();
  private epgIndex = new Map<string, EpgProgramme[]>();
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
    // Live TV uses an include-list (this provider tags US channels with a
    // reliable "US|" prefix). VOD categories have no such tag — they're
    // named by streaming service with no region marker at all, or an
    // explicit "<code> - " prefix for foreign-language catalogs — so VOD
    // uses an exclude-list instead; see parseVodExcludePatterns().
    const liveFilter = (c: XtreamCategory) => matchesUsFilter(c.category_name, this.config.usFilterPatterns);
    const vodFilter = (c: XtreamCategory) => !matchesUsFilter(c.category_name, this.config.vodExcludePatterns);
    const liveCategories = snapshot.liveCategories.filter(liveFilter);
    const liveCategoryIds = new Set(liveCategories.map((c) => c.category_id));
    const vodCategories = snapshot.vodCategories.filter(vodFilter);
    const vodCategoryIds = new Set(vodCategories.map((c) => c.category_id));

    this.liveCategories = liveCategories;
    this.liveStreams = snapshot.liveStreams.filter((s) => liveCategoryIds.has(s.category_id));
    this.vodCategories = vodCategories;
    this.vodStreams = snapshot.vodStreams.filter((s) => vodCategoryIds.has(s.category_id));

    this.liveCategoriesById = new Map(liveCategories.map((c) => [c.category_id, c]));
    this.vodCategoriesById = new Map(vodCategories.map((c) => [c.category_id, c]));
    this.liveStreamsByCategory = groupBy(this.liveStreams, (s) => s.category_id);
    this.vodStreamsByCategory = groupBy(this.vodStreams, (s) => s.category_id);
    this.epgIndex = buildEpgIndex(parseXmltv(snapshot.xmltv));

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
    const categoryName = this.liveCategoriesById.get(categoryId)?.category_name ?? '';
    return (this.liveStreamsByCategory.get(categoryId) ?? [])
      .slice()
      .sort((a, b) => a.num - b.num)
      .map((s) => {
        const channelId = s.epg_channel_id ?? '';
        const { now: n, next } = nowNextFromIndex(this.epgIndex, channelId, now);
        return {
          streamId: s.stream_id,
          num: s.num,
          name: s.name,
          logo: s.stream_icon,
          categoryName,
          now: n ? { title: n.title, start: n.start.toISOString(), stop: n.stop.toISOString() } : undefined,
          next: next ? { title: next.title, start: next.start.toISOString(), stop: next.stop.toISOString() } : undefined,
        };
      });
  }

  categoriesMovies(): XtreamCategory[] {
    return this.vodCategories;
  }

  moviesForCategory(categoryId: string): MovieView[] {
    const categoryName = this.vodCategoriesById.get(categoryId)?.category_name ?? '';
    return (this.vodStreamsByCategory.get(categoryId) ?? []).map((s) => ({
      streamId: s.stream_id,
      name: s.name,
      logo: s.stream_icon,
      categoryName,
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
    const result: Record<string, SportsEntry[]> = {};
    for (const league of SPORTS_LEAGUES) result[league] = [];

    for (const stream of this.liveStreams) {
      const league = leadingLeagueToken(stream.name);
      if (!league) continue;

      const liveGames = this.liveGamesByLeague[league] ?? [];
      if (liveGames.length === 0) continue; // nothing in-progress in this league right now

      const matchedGame = liveGames.find((g) => channelMatchesLiveGame(stream.name, g));
      if (!matchedGame) continue; // likely a pre-game/post-game/network channel, not this live game

      result[league].push({
        streamId: stream.stream_id,
        name: stream.name,
        league,
        homeTeam: matchedGame.homeTeam,
        awayTeam: matchedGame.awayTeam,
        homeScore: matchedGame.homeScore,
        awayScore: matchedGame.awayScore,
        clock: matchedGame.clock,
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

  /**
   * For the Admin Portal: ESPN games currently in progress that don't yet
   * have a matching channel — either auto-detected (sportsNow()) or
   * already admin-mapped. This is what the admin picks a channel for.
   */
  unmappedLiveGames(): Record<string, LiveGame[]> {
    const covered = this.sportsNow();
    const result: Record<string, LiveGame[]> = {};
    for (const league of SPORTS_LEAGUES) {
      const games = this.liveGamesByLeague[league] ?? [];
      const coveredEntries = covered[league] ?? [];
      result[league] = games.filter(
        (g) =>
          !coveredEntries.some(
            (e) =>
              (e.homeTeam === g.homeTeam && e.awayTeam === g.awayTeam) ||
              (e.awayTeam && e.homeTeam && teamNicknameCandidates(g.homeTeam).some((c) => normalizeForMatch(e.homeTeam!).includes(normalizeForMatch(c))) &&
                teamNicknameCandidates(g.awayTeam).some((c) => normalizeForMatch(e.awayTeam!).includes(normalizeForMatch(c)))),
          ),
      );
    }
    return result;
  }

  /** Channels in a category, without the now/next guide lookup — for the Admin Portal's category browser. */
  channelsForCategoryBasic(categoryId: string): Array<{ streamId: number; num: number; name: string }> {
    return (this.liveStreamsByCategory.get(categoryId) ?? [])
      .slice()
      .sort((a, b) => a.num - b.num)
      .map((s) => ({ streamId: s.stream_id, num: s.num, name: s.name }));
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
        categoryName: this.liveCategoriesById.get(s.category_id)?.category_name ?? '',
      }));
    const vodMatches = this.vodStreams
      .filter((s) => s.name.toLowerCase().includes(q))
      .map((s) => ({
        type: 'vod' as const,
        streamId: s.stream_id,
        name: s.name,
        categoryName: this.vodCategoriesById.get(s.category_id)?.category_name ?? '',
      }));
    return [...liveMatches, ...vodMatches];
  }
}
