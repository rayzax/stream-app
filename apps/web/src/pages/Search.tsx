import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { search, type SearchResult } from '../lib/api';
import { SearchIcon } from '../components/icons';

export default function Search() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [results, setResults] = useState<{ live: SearchResult[]; vod: SearchResult[] } | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults(null);
      return;
    }
    const handle = setTimeout(() => {
      search(query).then(setResults).catch(() => setResults({ live: [], vod: [] }));
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  const groups: Array<{ title: string; items: SearchResult[] }> = results
    ? [
        { title: 'Live TV', items: results.live },
        { title: 'Movies', items: results.vod },
      ].filter((g) => g.items.length > 0)
    : [];

  return (
    <div className="page" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
      <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <SearchIcon />
        <input
          autoFocus
          type="search"
          placeholder="Search channels, movies, games"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>
      {q.trim() && <div className="empty-state">Results for "{q.trim()}"</div>}
      {q.trim() && results && groups.length === 0 && <div className="empty-state">No matches.</div>}
      {groups.map((group) => (
        <div key={group.title} className="results-group">
          <h2 className="results-heading">
            {group.title} <span className="league-count">{group.items.length}</span>
          </h2>
          {group.items.map((item) => (
            <div
              key={`${item.type}-${item.streamId}`}
              className="row"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/player/${item.type === 'live' ? 'live' : 'vod'}/${item.streamId}`)}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row-name">{item.name}</div>
                <div className="row-meta">{item.categoryName.replace(/^US\|\s*/i, '')}</div>
              </div>
              <span className={item.type === 'live' ? 'tag-live' : 'tag'}>{item.type === 'live' ? 'LIVE' : 'MOVIE'}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
