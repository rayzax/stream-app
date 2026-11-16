import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTv, type ChannelView, type TvCategory } from '../lib/api';

function progressPct(now?: { start: string; stop: string }): number {
  if (!now) return 0;
  const start = new Date(now.start).getTime();
  const stop = new Date(now.stop).getTime();
  const current = Date.now();
  if (stop <= start) return 0;
  return Math.min(100, Math.max(0, ((current - start) / (stop - start)) * 100));
}

function ChannelTile({ channel }: { channel: ChannelView }) {
  const navigate = useNavigate();
  return (
    <button className="tile" style={{ textAlign: 'left', border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate(`/player/live/${channel.streamId}`)}>
      <div className="tile-head">
        <span className="tile-number">{channel.num}</span>
        <span className="tile-name">{channel.name}</span>
      </div>
      {channel.now && (
        <>
          <span className="tile-label">Now</span>
          <span className="tile-show">{channel.now.title}</span>
          <div className="track">
            <span style={{ width: `${progressPct(channel.now)}%` }} />
          </div>
        </>
      )}
      {channel.next && (
        <>
          <span className="tile-label">Next</span>
          <span className="tile-show">{channel.next.title}</span>
        </>
      )}
    </button>
  );
}

export default function TV() {
  const [categories, setCategories] = useState<TvCategory[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    getTv()
      .then((res) => {
        setCategories(res.categories);
        setSelected(res.categories[0]?.categoryId ?? null);
      })
      .catch(() => setError(true));
  }, []);

  const activeCategory = useMemo(() => categories?.find((c) => c.categoryId === selected), [categories, selected]);
  const filteredChannels = useMemo(() => {
    if (!activeCategory) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return activeCategory.channels;
    return activeCategory.channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [activeCategory, filter]);

  if (error) return <div className="error-state">Couldn't load the channel guide.</div>;
  if (!categories) return <div className="loading">Loading channels…</div>;

  return (
    <div className="tv-layout">
      <aside className="tv-sidebar">
        <div className="tv-sidebar-label">Categories</div>
        {categories.map((c) => (
          <a
            key={c.categoryId}
            href="#"
            className="cat"
            aria-current={c.categoryId === selected}
            onClick={(e) => {
              e.preventDefault();
              setSelected(c.categoryId);
            }}
          >
            {c.categoryName.replace(/^US\|\s*/i, '')}
          </a>
        ))}
      </aside>
      <section className="tv-main">
        <div className="page-head">
          <h1 className="page-title">{activeCategory?.categoryName.replace(/^US\|\s*/i, '') ?? ''}</h1>
          <input
            className="field"
            style={{ maxWidth: 320 }}
            placeholder="Filter channels"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="grid grid--tiles">
          {filteredChannels.map((ch) => (
            <ChannelTile key={ch.streamId} channel={ch} />
          ))}
        </div>
      </section>
    </div>
  );
}
