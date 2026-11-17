import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react';
import { getSports, getStreamToken, recordWatch, type SportsEntry } from '../lib/api';
import VideoPlayer from '../components/VideoPlayer';
import { BackIcon } from '../components/icons';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '../components/ui/drawer';
import { Button } from '../components/ui/button';
import { ScoreFlip } from '../components/ScoreFlip';

function OtherGamesList({ others, onPick }: { others: SportsEntry[]; onPick: (streamId: number) => void }) {
  return (
    <>
      {others.map((g) => (
        <a
          key={g.streamId}
          href="#"
          className="game"
          onClick={(e) => {
            e.preventDefault();
            onPick(g.streamId);
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="game-title">{g.homeTeam && g.awayTeam ? `${g.awayTeam} at ${g.homeTeam}` : g.name}</div>
            {g.homeScore !== undefined && (
              <div className="game-meta">
                <ScoreFlip value={g.awayScore!} /> <span className="score-sep" /> <ScoreFlip value={g.homeScore!} /> {g.clock}
              </div>
            )}
          </div>
          <span className="pill">LIVE</span>
        </a>
      ))}
    </>
  );
}

export default function Player() {
  const { type, id } = useParams<{ type: 'live' | 'series'; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const streamId = Number(id);
  const ext = searchParams.get('ext') ?? undefined;
  const name = searchParams.get('name') ?? undefined;
  const logo = searchParams.get('logo') ?? undefined;
  const seriesId = searchParams.get('seriesId');

  const [token, setToken] = useState<{ url: string; via: 'cloud' | 'homelab' } | null>(null);
  const [error, setError] = useState(false);
  const [sports, setSports] = useState<Record<string, SportsEntry[]> | null>(null);

  useEffect(() => {
    if (!streamId || !type) return;
    getStreamToken(streamId, type, ext)
      .then((res) => setToken({ url: res.url, via: res.via }))
      .catch(() => setError(true));
  }, [streamId, type, ext]);

  // Record a watch-history entry once playback is set up for an on-demand
  // title. The identity key is the series_id for an episode (so repeat
  // episodes of the same show consolidate into one "Continue Watching"
  // entry) but playback always resumes via this specific stream/episode.
  useEffect(() => {
    if (!token || !name || !ext || type !== 'series') return;
    recordWatch({
      streamId: seriesId ? Number(seriesId) : streamId,
      type,
      name,
      logo: logo ?? '',
      playStreamId: streamId,
      ext,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  const title = current ? (current.homeTeam && current.awayTeam ? `${current.awayTeam} at ${current.homeTeam}` : current.name) : name ?? '';
  const hasOthers = type === 'live' && !!league && others.length > 0;

  function goToGame(id: number) {
    navigate(`/player/live/${id}`);
  }

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
            <button onClick={() => navigate(-1)} aria-label="Back" className="ctl">
              <BackIcon />
            </button>
            <span className="muted" style={{ color: 'var(--muted)' }}>
              Back to {type === 'live' ? 'Sports' : 'Stream'}
            </span>
          </div>
          <div className="player-layout">
            <section className="player-main">
              {token ? <VideoPlayer src={token.url} isLive={type === 'live'} via={token.via} /> : <div className="video-wrap" />}
              {title && <h1 className="page-title">{title}</h1>}

              {/* Mobile: bottom-sheet trigger instead of a stacked sidebar. */}
              {hasOthers && (
                <Drawer>
                  <DrawerTrigger asChild>
                    <Button variant="ghost" className="md:hidden">
                      Other live {league!.replace('Live ', '')} ({others.length})
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Other live {league!.replace('Live ', '')}</DrawerTitle>
                    </DrawerHeader>
                    <div className="flex flex-col gap-2 overflow-y-auto px-5 pb-6">
                      <OtherGamesList others={others} onPick={goToGame} />
                    </div>
                  </DrawerContent>
                </Drawer>
              )}
            </section>

            {/* Desktop: sidebar (hidden on mobile via CSS, see index.css .player-aside). */}
            {hasOthers && (
              <aside className="player-aside">
                <h2 className="league-heading">Other live {league!.replace('Live ', '')}</h2>
                <OtherGamesList others={others} onPick={goToGame} />
              </aside>
            )}
          </div>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
