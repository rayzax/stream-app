import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTv, getTvGuide, type ChannelView, type TvCategory } from '../lib/api';
import { Skeleton } from '../components/ui/skeleton';

function progressPct(now?: { start: string; stop: string }): number {
  if (!now) return 0;
  const start = new Date(now.start).getTime();
  const stop = new Date(now.stop).getTime();
  const current = Date.now();
  if (stop <= start) return 0;
  return Math.min(100, Math.max(0, ((current - start) / (stop - start)) * 100));
}

function GuideRow({ channel }: { channel: ChannelView }) {
  const navigate = useNavigate();
  return (
    <button className="guide-row" onClick={() => navigate(`/player/live/${channel.streamId}`)}>
      <span className="guide-num">{channel.num}</span>
      <span className="guide-info">
        <span className="guide-network">{channel.name}</span>
        {channel.now ? (
          <>
            <span className="guide-now">
              <span>Now</span>
              <span>{channel.now.title}</span>
            </span>
            <div className="guide-track">
              <span style={{ width: `${progressPct(channel.now)}%` }} />
            </div>
          </>
        ) : (
          <span className="guide-now">
            <span>No guide data</span>
          </span>
        )}
        {channel.next && (
          <span className="guide-next">
            <span>Next</span>
            <span>{channel.next.title}</span>
          </span>
        )}
      </span>
    </button>
  );
}

function Guide() {
  const [channels, setChannels] = useState<ChannelView[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getTvGuide()
      .then((res) => setChannels(res.channels))
      .catch(() => setError(true));
  }, []);

  if (error) return <div className="error-state">Couldn't load the guide.</div>;
  if (!channels) {
    return (
      <div className="flex w-full flex-col gap-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="guide-list">
        {channels.map((ch) => (
          <GuideRow key={ch.streamId} channel={ch} />
        ))}
      </div>
    </div>
  );
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

function AllTv() {
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
  if (!categories) {
    return (
      <div className="tv-layout w-full">
        <div className="flex w-full flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid--tiles">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const categoryLabel = (c: TvCategory) => c.categoryName.replace(/^US\|\s*/i, '');

  return (
    <div className="tv-layout">
      {/* Mobile: sticky blurred chip row instead of a tall vertical list. */}
      <div className="tv-chip-row">
        {categories.map((c) => (
          <button
            key={c.categoryId}
            className="chip"
            aria-pressed={c.categoryId === selected}
            onClick={() => setSelected(c.categoryId)}
          >
            {categoryLabel(c)}
          </button>
        ))}
      </div>
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
            {categoryLabel(c)}
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

type TvView = 'all' | 'guide';

export default function TV() {
  const [view, setView] = useState<TvView>('all');

  return (
    <div className="flex w-full flex-col">
      <div className="flex gap-6 border-b border-border px-4 pt-3 md:px-0">
        {([
          ['all', 'All TV'],
          ['guide', 'Guide'],
        ] as const).map(([key, label]) => (
          <button key={key} className="tab" aria-current={view === key ? 'page' : undefined} onClick={() => setView(key)}>
            {label}
          </button>
        ))}
      </div>
      {view === 'all' ? <AllTv /> : <Guide />}
    </div>
  );
}
