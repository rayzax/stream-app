import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMovies, type MovieCategory, type MovieView } from '../lib/api';

type SortKey = 'added' | 'title';

function Poster({ movie }: { movie: MovieView }) {
  const navigate = useNavigate();
  return (
    <button
      className="poster"
      style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border)' }}
      onClick={() => navigate(`/player/vod/${movie.streamId}?ext=${movie.containerExtension}`)}
    >
      <div className="poster-art">
        {movie.logo ? <img src={movie.logo} alt="" loading="lazy" /> : '[POSTER]'}
      </div>
      <div className="poster-info">
        <div className="poster-title">{movie.name}</div>
        {movie.rating && <div className="poster-meta">★ {movie.rating}</div>}
        {movie.containerExtension?.toLowerCase() === 'mkv' && (
          <div className="poster-meta" style={{ color: 'var(--live)' }}>
            May not play in browser
          </div>
        )}
      </div>
    </button>
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
  if (!categories) return <div className="loading">Loading movies…</div>;

  const genres = ['All', ...categories.map((c) => c.categoryName)];

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Movies</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="field"
            style={{ maxWidth: 280 }}
            placeholder="Filter movies"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select className="select" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="added">Recently added</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
      </div>
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
    </div>
  );
}
