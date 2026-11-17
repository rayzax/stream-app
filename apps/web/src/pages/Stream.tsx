import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSeries, getWatchHistory, type SeriesCategory, type SeriesView, type WatchHistoryEntry } from '../lib/api';
import { Skeleton } from '../components/ui/skeleton';
import { SearchIcon } from '../components/icons';
import EmblaRow from '../components/EmblaRow';

function SeriesPoster({ series }: { series: SeriesView }) {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      className="poster min-w-[150px] shrink-0 basis-[150px] cursor-pointer text-left"
      onClick={() => navigate(`/series/${series.seriesId}`)}
    >
      <div className="poster-art">
        {series.logo ? (
          <img
            src={series.logo}
            alt=""
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className="transition-[filter,opacity] duration-300"
            style={{ filter: loaded ? 'blur(0)' : 'blur(8px)', opacity: loaded ? 1 : 0.4 }}
          />
        ) : (
          '[POSTER]'
        )}
      </div>
      <div className="poster-info">
        <div className="poster-title">{series.name}</div>
        {series.rating && <div className="poster-meta">★ {series.rating}</div>}
      </div>
    </button>
  );
}

function HistoryPoster({ entry }: { entry: WatchHistoryEntry }) {
  const navigate = useNavigate();
  return (
    <button
      className="poster min-w-[150px] shrink-0 basis-[150px] cursor-pointer text-left"
      onClick={() =>
        navigate(
          `/player/${entry.type}/${entry.playStreamId}?ext=${entry.ext}&name=${encodeURIComponent(entry.name)}&logo=${encodeURIComponent(entry.logo ?? '')}`,
        )
      }
    >
      <div className="poster-art">{entry.logo ? <img src={entry.logo} alt="" loading="lazy" /> : '[POSTER]'}</div>
      <div className="poster-info">
        <div className="poster-title">{entry.name}</div>
      </div>
    </button>
  );
}

function RowSkeleton() {
  return (
    <EmblaRow>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="poster min-w-[150px] shrink-0 basis-[150px]">
          <Skeleton className="aspect-[2/3] w-full rounded-none" />
          <div className="poster-info">
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </EmblaRow>
  );
}

export default function Stream() {
  const [categories, setCategories] = useState<SeriesCategory[] | null>(null);
  const [history, setHistory] = useState<WatchHistoryEntry[] | null>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    getSeries()
      .then((res) => setCategories(res.categories))
      .catch(() => setError(true));
    getWatchHistory()
      .then((res) => setHistory(res.items))
      .catch(() => setHistory([]));
  }, []);

  const q = filter.trim().toLowerCase();

  const rows = useMemo(() => {
    if (!categories) return null;
    return categories
      .map((c) => ({ categoryName: c.categoryName, items: q ? c.series.filter((s) => s.name.toLowerCase().includes(q)) : c.series }))
      .filter((c) => c.items.length > 0);
  }, [categories, q]);

  const newSeries = useMemo(() => {
    if (!categories) return [];
    return categories
      .flatMap((c) => c.series)
      .sort((a, b) => b.added - a.added)
      .slice(0, 20);
  }, [categories]);

  if (error) return <div className="error-state">Couldn't load Stream.</div>;

  const searching = q.length > 0;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Stream</h1>
        <div className="search field max-w-[320px]" role="search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search TV series"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {!rows ? (
        <RowSkeleton />
      ) : (
        <>
          {!searching && history && history.length > 0 && (
            <section className="league-section">
              <h2 className="league-heading">Continue Watching</h2>
              <EmblaRow>
                {history.map((h) => (
                  <HistoryPoster key={`${h.type}-${h.streamId}`} entry={h} />
                ))}
              </EmblaRow>
            </section>
          )}

          {!searching && newSeries.length > 0 && (
            <section className="league-section">
              <h2 className="league-heading">New Releases</h2>
              <EmblaRow>
                {newSeries.map((s) => (
                  <SeriesPoster key={s.seriesId} series={s} />
                ))}
              </EmblaRow>
            </section>
          )}

          {rows.length === 0 && (
            <div className="empty-state">{searching ? 'No matches.' : 'Nothing here yet.'}</div>
          )}

          {rows.map((row) => (
            <section key={row.categoryName} className="league-section">
              <h2 className="league-heading">{row.categoryName.replace(/^US\|\s*/i, '')}</h2>
              <EmblaRow>
                {row.items.map((s) => (
                  <SeriesPoster key={s.seriesId} series={s} />
                ))}
              </EmblaRow>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
