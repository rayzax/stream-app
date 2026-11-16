import { useNavigate } from 'react-router-dom';
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react';
import { getSports, type SportsEntry } from '../lib/api';
import { usePolling } from '../hooks/usePolling';
import { PlayIcon, GlobeIcon } from '../components/icons';
import { ScoreFlip } from '../components/ScoreFlip';
import EmblaRow from '../components/EmblaRow';
import { Skeleton } from '../components/ui/skeleton';

const LEAGUE_ORDER = ['Live NFL', 'Live CFB', 'Live NBA', 'Live CBB', 'Live MLB', 'Live NHL', 'Live Soccer', 'Live UFC/Boxing'];

function GameCard({ entry }: { entry: SportsEntry }) {
  const navigate = useNavigate();
  const matchup = entry.homeTeam && entry.awayTeam ? `${entry.awayTeam} at ${entry.homeTeam}` : entry.name;
  const hasScore = entry.homeScore !== undefined && entry.awayScore !== undefined;

  return (
    <div className="card card--live min-w-[260px] shrink-0 basis-[260px]">
      <span className="pill">LIVE</span>
      <div className="matchup">{matchup}</div>
      {hasScore && (
        <div className="score-row">
          <span className="score">
            <ScoreFlip value={entry.awayScore!} /> <span className="score-sep" /> <ScoreFlip value={entry.homeScore!} />
          </span>
          {entry.clock && <span className="clock">{entry.clock}</span>}
        </div>
      )}
      <button className="play" onClick={() => navigate(`/player/live/${entry.streamId}`)}>
        <PlayIcon /> Watch
      </button>
    </div>
  );
}

function LeagueSkeleton() {
  return (
    <div className="flex gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card min-w-[260px] shrink-0 basis-[260px]">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function Main() {
  const { data, loading, error } = usePolling(getSports, 60_000);

  if (error && !data) return <div className="error-state">Couldn't load sports right now.</div>;

  const leagues = data?.leagues ?? {};
  const orderedLeagues = [...LEAGUE_ORDER, ...Object.keys(leagues).filter((l) => !LEAGUE_ORDER.includes(l))];

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <div className="page">
          <div className="page-head">
            <h1 className="page-title">Sports — Live now</h1>
          </div>
          {orderedLeagues.map((league) => {
            const games = leagues[league] ?? [];
            return (
              <section key={league} className="league-section">
                <h2 className="league-heading">
                  {league.replace('Live ', '')}
                  <span className="league-count">{games.length > 0 ? `${games.length} live` : ''}</span>
                </h2>
                {loading && !data ? (
                  <LeagueSkeleton />
                ) : games.length === 0 ? (
                  <div className="empty-state flex items-center gap-2">
                    <GlobeIcon className="shrink-0 opacity-50" width={16} height={16} />
                    Nothing live right now.
                  </div>
                ) : (
                  <EmblaRow>
                    {games.map((g) => (
                      <GameCard key={g.streamId} entry={g} />
                    ))}
                  </EmblaRow>
                )}
              </section>
            );
          })}
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
