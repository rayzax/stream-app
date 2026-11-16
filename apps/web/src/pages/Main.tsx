import { useNavigate } from 'react-router-dom';
import { getSports, type SportsEntry } from '../lib/api';
import { usePolling } from '../hooks/usePolling';
import { PlayIcon } from '../components/icons';

const LEAGUE_ORDER = ['Live NFL', 'Live CFB', 'Live NBA', 'Live CBB', 'Live MLB', 'Live NHL', 'Live Soccer', 'Live UFC/Boxing'];

function GameCard({ entry }: { entry: SportsEntry }) {
  const navigate = useNavigate();
  const matchup = entry.homeTeam && entry.awayTeam ? `${entry.awayTeam} at ${entry.homeTeam}` : entry.name;
  const hasScore = entry.homeScore !== undefined && entry.awayScore !== undefined;

  return (
    <div className="card">
      <span className="pill">LIVE</span>
      <div className="matchup">{matchup}</div>
      {hasScore && (
        <div className="score-row">
          <span className="score">
            {entry.awayScore} – {entry.homeScore}
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

export default function Main() {
  const { data, loading, error } = usePolling(getSports, 60_000);

  if (loading && !data) return <div className="loading">Loading live sports…</div>;
  if (error && !data) return <div className="error-state">Couldn't load sports right now.</div>;

  const leagues = data?.leagues ?? {};
  const orderedLeagues = [...LEAGUE_ORDER, ...Object.keys(leagues).filter((l) => !LEAGUE_ORDER.includes(l))];

  return (
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
            {games.length === 0 ? (
              <div className="empty-state">Nothing live right now.</div>
            ) : (
              <div className="grid">
                {games.map((g) => (
                  <GameCard key={g.streamId} entry={g} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
