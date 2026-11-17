import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getMovies,
  getSeries,
  getWatchHistory,
  type MovieCategory,
  type MovieView,
  type SeriesCategory,
  type SeriesView,
  type WatchHistoryEntry,
} from '../lib/api';
import { Skeleton } from '../components/ui/skeleton';
import { SearchIcon } from '../components/icons';
import EmblaRow from '../components/EmblaRow';

type ContentType = 'movies' | 'series';

function MoviePoster({ movie }: { movie: MovieView }) {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      className="poster min-w-[150px] shrink-0 basis-[150px] cursor-pointer text-left"
      onClick={() =>
        navigate(
          `/player/vod/${movie.streamId}?ext=${movie.containerExtension}&name=${encodeURIComponent(movie.name)}&logo=${encodeURIComponent(movie.logo ?? '')}`,
        )
      }
    >
      <div className="poster-art">
        {movie.logo ? (
          <img
            src={movie.logo}
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
        <div className="poster-title">{movie.name}</div>
        {movie.rating && <div className="poster-meta">★ {movie.rating}</div>}
        {movie.containerExtension?.toLowerCase() === 'mkv' && (
          <div className="poster-meta text-live">May not play in browser</div>
        )}
      </div>
    </button>
  );
}

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
      onClick={() => navigate(`/player/${entry.type}/${entry.playStreamId}?ext=${entry.ext}&name=${encodeURIComponent(entry.name)}&logo=${encodeURIComponent(entry.logo ?? '')}`)}
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
  const [type, setType] = useState<ContentType>('movies');
  const [movieCategories, setMovieCategories] = useState<MovieCategory[] | null>(null);
  const [seriesCategories, setSeriesCategories] = useState<SeriesCategory[] | null>(null);
  const [history, setHistory] = useState<WatchHistoryEntry[] | null>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    getMovies()
      .then((res) => setMovieCategories(res.categories))
      .catch(() => setError(true));
    getSeries()
      .then((res) => setSeriesCategories(res.categories))
      .catch(() => setError(true));
    getWatchHistory()
      .then((res) => setHistory(res.items))
      .catch(() => setHistory([]));
  }, []);

  const q = filter.trim().toLowerCase();

  const movieRows = useMemo(() => {
    if (!movieCategories) return null;
    return movieCategories
      .map((c) => ({ categoryName: c.categoryName, items: q ? c.movies.filter((m) => m.name.toLowerCase().includes(q)) : c.movies }))
      .filter((c) => c.items.length > 0);
  }, [movieCategories, q]);

  const seriesRows = useMemo(() => {
    if (!seriesCategories) return null;
    return seriesCategories
      .map((c) => ({ categoryName: c.categoryName, items: q ? c.series.filter((s) => s.name.toLowerCase().includes(q)) : c.series }))
      .filter((c) => c.items.length > 0);
  }, [seriesCategories, q]);

  const newMovies = useMemo(() => {
    if (!movieCategories) return [];
    return movieCategories
      .flatMap((c) => c.movies)
      .sort((a, b) => b.added - a.added)
      .slice(0, 20);
  }, [movieCategories]);

  const newSeries = useMemo(() => {
    if (!seriesCategories) return [];
    return seriesCategories
      .flatMap((c) => c.series)
      .sort((a, b) => b.added - a.added)
      .slice(0, 20);
  }, [seriesCategories]);

  if (error) return <div className="error-state">Couldn't load Stream.</div>;

  const loading = type === 'movies' ? !movieRows : !seriesRows;
  const rows = type === 'movies' ? movieRows : seriesRows;
  const newItems = type === 'movies' ? newMovies : newSeries;
  const searching = q.length > 0;
  const historyForType = history?.filter((h) => h.type === (type === 'movies' ? 'vod' : 'series')) ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Stream</h1>
        <div className="search field max-w-[320px]" role="search">
          <SearchIcon />
          <input
            type="search"
            placeholder={`Search ${type === 'movies' ? 'movies' : 'TV series'}`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-6 border-b border-border">
        {([
          ['movies', 'Movies'],
          ['series', 'TV Series'],
        ] as const).map(([key, label]) => (
          <button key={key} className="tab" aria-current={type === key ? 'page' : undefined} onClick={() => setType(key)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <RowSkeleton />
      ) : (
        <>
          {!searching && historyForType.length > 0 && (
            <section className="league-section">
              <h2 className="league-heading">Continue Watching</h2>
              <EmblaRow>
                {historyForType.map((h) => (
                  <HistoryPoster key={`${h.type}-${h.streamId}`} entry={h} />
                ))}
              </EmblaRow>
            </section>
          )}

          {!searching && newItems.length > 0 && (
            <section className="league-section">
              <h2 className="league-heading">New Releases</h2>
              <EmblaRow>
                {type === 'movies'
                  ? (newItems as MovieView[]).map((m) => <MoviePoster key={m.streamId} movie={m} />)
                  : (newItems as SeriesView[]).map((s) => <SeriesPoster key={s.seriesId} series={s} />)}
              </EmblaRow>
            </section>
          )}

          {rows && rows.length === 0 && <div className="empty-state">No matches.</div>}

          {rows?.map((row) => (
            <section key={row.categoryName} className="league-section">
              <h2 className="league-heading">{row.categoryName.replace(/^US\|\s*/i, '')}</h2>
              <EmblaRow>
                {type === 'movies'
                  ? (row.items as MovieView[]).map((m) => <MoviePoster key={m.streamId} movie={m} />)
                  : (row.items as SeriesView[]).map((s) => <SeriesPoster key={s.seriesId} series={s} />)}
              </EmblaRow>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
