export interface LiveGame {
  league: string;
  name: string; // "Team A vs Team B"
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  clock: string;
  period: string;
}

const ESPN_LEAGUES: Record<string, string> = {
  'Live NFL': 'football/nfl',
  'Live CFB': 'football/college-football',
  'Live NBA': 'basketball/nba',
  'Live CBB': 'basketball/mens-college-basketball',
  'Live MLB': 'baseball/mlb',
  'Live NHL': 'hockey/nhl',
  'Live Soccer': 'soccer/usa.1',
  'Live UFC/Boxing': 'mma/ufc',
};

interface EspnCompetitor {
  homeAway: 'home' | 'away';
  score?: string;
  team: { displayName: string };
}

interface EspnEvent {
  name: string;
  status: { type: { state: string }; displayClock?: string; period?: number };
  competitions: Array<{ competitors: EspnCompetitor[] }>;
}

interface EspnScoreboardResponse {
  events?: EspnEvent[];
}

async function fetchLeague(leagueLabel: string, path: string): Promise<LiveGame[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = (await res.json()) as EspnScoreboardResponse;
    const events = data.events ?? [];
    return events
      .filter((e) => e.status?.type?.state === 'in')
      .map((e): LiveGame | null => {
        const competitors = e.competitions?.[0]?.competitors ?? [];
        const home = competitors.find((c) => c.homeAway === 'home');
        const away = competitors.find((c) => c.homeAway === 'away');
        if (!home || !away) return null;
        return {
          league: leagueLabel,
          name: e.name,
          homeTeam: home.team.displayName,
          awayTeam: away.team.displayName,
          homeScore: home.score ?? '0',
          awayScore: away.score ?? '0',
          clock: e.status.displayClock ?? '',
          period: e.status.period ? String(e.status.period) : '',
        };
      })
      .filter((g): g is LiveGame => g !== null);
  } catch {
    return [];
  }
}

/** Fetches all leagues in parallel. A single league's failure doesn't affect the others. */
export async function fetchLiveGamesByLeague(): Promise<Record<string, LiveGame[]>> {
  const entries = await Promise.all(
    Object.entries(ESPN_LEAGUES).map(async ([label, path]) => [label, await fetchLeague(label, path)] as const),
  );
  return Object.fromEntries(entries);
}

export const SPORTS_LEAGUES = Object.keys(ESPN_LEAGUES);
