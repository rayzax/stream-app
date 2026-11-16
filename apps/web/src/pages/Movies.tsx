import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMovies, type MovieCategory, type MovieView } from '../lib/api';
import { Skeleton } from '../components/ui/skeleton';

type SortKey = 'added' | 'title';

function Poster({ movie }: { movie: MovieView }) {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      className="poster cursor-pointer text-left"
      onClick={() => navigate(`/player/vod/${movie.streamId}?ext=${movie.containerExtension}`)}
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

function PosterGridSkeleton() {
  return (
    <div className="grid grid--posters">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="poster">
          <Skeleton className="aspect-[2/3] w-full rounded-none" />
          <div className="poster-info">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Movies() {
  const [categories, setCategories] = useState<MovieCategory[] | null>(null);
  const [genre, setGenre] = useState<string>('All');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortKey>('added');
  const [error, setError] = useState(false);

  useEffect(() => {
    getMovies()
      .then((res) => setCategories(res.categories))
      .catch(() => setError(true));
  }, []);

  const allMovies = useMemo(() => {
    if (!categories) return [];
    const scoped = genre === 'All' ? categories : categories.filter((c) => c.categoryName === genre);
    return scoped.flatMap((c) => c.movies);
  }, [categories, genre]);

  const visibleMovies = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = q ? allMovies.filter((m) => m.name.toLowerCase().includes(q)) : allMovies;
    const sorted = [...filtered];
    if (sort === 'title') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else sorted.sort((a, b) => b.added - a.added);
    return sorted;
  }, [allMovies, filter, sort]);

  if (error) return <div className="error-state">Couldn't load movies.</div>;

  const genres = categories ? ['All', ...categories.map((c) => c.categoryName)] : [];

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Movies</h1>
        <div className="flex flex-wrap gap-2">
          <input
            className="field max-w-[280px]"
            placeholder="Filter movies"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select className="select w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="added">Recently added</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
      </div>
      {!categories ? (
        <PosterGridSkeleton />
      ) : (
        <>
          <div className="chip-row">
            {genres.map((g) => (
              <button key={g} className="chip" aria-pressed={genre === g} onClick={() => setGenre(g)}>
                {g.replace(/^US\|\s*/i, '')}
              </button>
            ))}
          </div>
          <div className="grid grid--posters">
            {visibleMovies.map((m) => (
              <Poster key={m.streamId} movie={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
