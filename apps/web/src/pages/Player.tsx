import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getSports, getStreamToken, type SportsEntry } from '../lib/api';
import VideoPlayer from '../components/VideoPlayer';
import { BackIcon } from '../components/icons';

export default function Player() {
  const { type, id } = useParams<{ type: 'live' | 'vod'; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const streamId = Number(id);
  const ext = searchParams.get('ext') ?? undefined;

  const [token, setToken] = useState<{ url: string; via: 'cloud' | 'homelab' } | null>(null);
  const [error, setError] = useState(false);
  const [sports, setSports] = useState<Record<string, SportsEntry[]> | null>(null);

  useEffect(() => {
    if (!streamId || !type) return;
    getStreamToken(streamId, type, ext)
      .then((res) => setToken({ url: res.url, via: res.via }))
      .catch(() => setError(true));
  }, [streamId, type, ext]);

  useEffect(() => {
    if (type === 'live') getSports().then((res) => setSports(res.leagues)).catch(() => {});
  }, [type]);

  const { league, others, current } = useMemo(() => {
    if (!sports) return { league: null as string | null, others: [] as SportsEntry[], current: null as SportsEntry | null };
    for (const [leagueName, entries] of Object.entries(sports)) {
      const found = entries.find((e) => e.streamId === streamId);
      if (found) return { league: leagueName, others: entries.filter((e) => e.streamId !== streamId), current: found };
    }
    return { league: null, others: [], current: null };
  }, [sports, streamId]);

  if (error) return <div className="error-state">Couldn't start playback.</div>;

  const title = current ? (current.homeTeam && current.awayTeam ? `${current.awayTeam} at ${current.homeTeam}` : current.name) : '';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="ctl">
          <BackIcon />
        </button>
        <span className="muted" style={{ color: 'var(--muted)' }}>Back to {type === 'live' ? 'Sports' : 'Movies'}</span>
      </div>
      <div className="player-layout">
        <section className="player-main">
          {token ? (
            <VideoPlayer src={token.url} isLive={type === 'live'} via={token.via} />
          ) : (
            <div className="video-wrap" />
          )}
          {title && <h1 className="page-title">{title}</h1>}
        </section>
        {type === 'live' && league && others.length > 0 && (
          <aside className="player-aside">
            <h2 className="league-heading">Other live {league.replace('Live ', '')}</h2>
            {others.map((g) => (
              <a
                key={g.streamId}
                href="#"
                className="game"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/player/live/${g.streamId}`);
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="game-title">{g.homeTeam && g.awayTeam ? `${g.awayTeam} at ${g.homeTeam}` : g.name}</div>
                  {g.homeScore !== undefined && (
                    <div className="game-meta">
                      {g.awayScore}–{g.homeScore} {g.clock}
                    </div>
                  )}
                </div>
                <span className="pill">LIVE</span>
              </a>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}
