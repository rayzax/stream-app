import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSeriesDetails, type SeriesDetails, type SeriesEpisode } from '../lib/api';
import { BackIcon, PlayIcon } from '../components/icons';
import { Skeleton } from '../components/ui/skeleton';

export default function SeriesDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const seriesId = Number(id);
  const [details, setDetails] = useState<SeriesDetails | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!seriesId) return;
    getSeriesDetails(seriesId)
      .then((res) => {
        setDetails(res);
        const firstSeason = res.seasons[0]?.season_number ?? Number(Object.keys(res.episodes)[0]);
        setSeason(firstSeason);
      })
      .catch(() => setError(true));
  }, [seriesId]);

  if (error) return <div className="error-state">Couldn't load this series.</div>;
  if (!details) {
    return (
      <div className="page">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-20 w-full" />
      </div>
    );
  }

  const name = details.info.name ?? '';
  const logo = details.info.cover ?? '';
  const seasons = details.seasons.length > 0
    ? details.seasons
    : Object.keys(details.episodes).map((n) => ({ season_number: Number(n), name: `Season ${n}`, episode_count: details.episodes[n]?.length ?? 0 }));
  const episodes: SeriesEpisode[] = season !== null ? details.episodes[String(season)] ?? [] : [];

  function playEpisode(ep: SeriesEpisode) {
    const params = new URLSearchParams({
      ext: ep.container_extension,
      name: `${name} — ${ep.title}`,
      logo,
      seriesId: String(seriesId),
    });
    navigate(`/player/series/${ep.id}?${params.toString()}`);
  }

  return (
    <div className="page">
      <button onClick={() => navigate(-1)} aria-label="Back" className="ctl">
        <BackIcon />
      </button>
      <div className="series-head">
        {logo && <img className="series-cover" src={logo} alt="" />}
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">{name}</h1>
          {details.info.genre && <div className="poster-meta">{details.info.genre}</div>}
          {details.info.plot && <p className="series-plot">{details.info.plot}</p>}
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto border-b border-border">
        {seasons.map((s) => (
          <button
            key={s.season_number}
            className="tab"
            aria-current={season === s.season_number ? 'page' : undefined}
            onClick={() => setSeason(s.season_number)}
          >
            {s.name || `Season ${s.season_number}`}
          </button>
        ))}
      </div>

      <div className="episode-list">
        {episodes.map((ep) => (
          <button key={ep.id} className="row cursor-pointer text-left" onClick={() => playEpisode(ep)}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="row-name">
                {ep.episode_num}. {ep.title}
              </div>
              {ep.info?.plot && <div className="row-meta">{ep.info.plot}</div>}
            </div>
            <PlayIcon className="shrink-0" />
          </button>
        ))}
        {episodes.length === 0 && <div className="empty-state">No episodes listed for this season.</div>}
      </div>
    </div>
  );
}
