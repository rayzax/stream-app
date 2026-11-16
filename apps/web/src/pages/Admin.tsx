import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCurrentUser } from '../lib/AuthContext';
import {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminListMappings,
  adminCreateMapping,
  adminDeleteMapping,
  adminListUnmappedGames,
  adminListChannelCategories,
  adminListChannelsInCategory,
  type AdminUser,
  type GameMapping,
  type LiveGame,
  type ChannelCategorySummary,
  type ChannelSummary,
} from '../lib/api';
import { TrashIcon, PlusIcon, UserIcon, ShieldIcon } from '../components/icons';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';

const LEAGUES = ['Live NFL', 'Live CFB', 'Live NBA', 'Live CBB', 'Live MLB', 'Live NHL', 'Live Soccer', 'Live UFC/Boxing'];

/** A small local tab switcher, same visual language as the app's own nav tabs. */
function SectionTabs({ value, onChange }: { value: 'users' | 'mappings'; onChange: (v: 'users' | 'mappings') => void }) {
  return (
    <div className="flex gap-6 border-b border-border">
      {(
        [
          ['users', 'Users', UserIcon],
          ['mappings', 'Game mappings', ShieldIcon],
        ] as const
      ).map(([key, label, Icon]) => (
        <button
          key={key}
          className="tab"
          aria-current={value === key ? 'page' : undefined}
          onClick={() => onChange(key)}
        >
          <Icon className="mr-1.5 inline-block" width={16} height={16} />
          {label}
        </button>
      ))}
    </div>
  );
}

function UserRowSkeleton() {
  return (
    <div className="card card--compact flex-row items-center gap-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

function UsersSection({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [creating, setCreating] = useState(false);

  function reload() {
    adminListUsers().then((r) => setUsers(r.users)).catch(() => toast.error('Failed to load users.'));
  }
  useEffect(reload, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await adminCreateUser(newUsername, newPassword, newRole);
      toast.success(`User "${newUsername}" created.`);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      reload();
    } catch (err) {
      const status = (err as { status?: number }).status;
      toast.error(status === 409 ? 'That username is already taken.' : 'Could not create user (password must be 8+ characters).');
    } finally {
      setCreating(false);
    }
  }

  async function toggleRole(u: AdminUser) {
    try {
      await adminUpdateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' });
      reload();
    } catch {
      toast.error('Could not change that user’s role (at least one enabled admin is required).');
    }
  }

  async function toggleDisabled(u: AdminUser) {
    try {
      await adminUpdateUser(u.id, { disabled: !u.disabled });
      reload();
    } catch {
      toast.error('Could not update that user (at least one enabled admin is required).');
    }
  }

  async function removeUser(u: AdminUser) {
    if (!confirm(`Delete user "${u.username}"? This can't be undone.`)) return;
    try {
      await adminDeleteUser(u.id);
      toast.success(`User "${u.username}" deleted.`);
      reload();
    } catch {
      toast.error('Could not delete that user (at least one enabled admin is required).');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={createUser} className="card flex flex-row flex-wrap items-center gap-3">
        <input className="field max-w-[200px]" placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
        <input className="field max-w-[200px]" type="password" placeholder="Password (8+ chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        <select className="select w-auto" value={newRole} onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <Button type="submit" disabled={creating}>
          <PlusIcon width={16} height={16} /> Add user
        </Button>
      </form>

      {!users ? (
        <div className="flex flex-col gap-2">
          <UserRowSkeleton />
          <UserRowSkeleton />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <div key={u.id} className="card card--compact flex-row flex-wrap items-center gap-3">
              <div className="flex min-w-[180px] flex-1 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3">
                  <UserIcon width={18} height={18} className="text-muted" />
                </div>
                <div className="min-w-0">
                  <div className="row-name">
                    {u.username}
                    {u.id === currentUserId && <span className="row-meta"> (you)</span>}
                  </div>
                  <div className="row-meta">
                    {u.disabled ? 'Disabled' : 'Active'} · joined {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag">{u.role}</span>
                <button className="chip" aria-pressed={false} onClick={() => toggleRole(u)}>
                  Make {u.role === 'admin' ? 'user' : 'admin'}
                </button>
                <button className="chip" aria-pressed={u.disabled} onClick={() => toggleDisabled(u)}>
                  {u.disabled ? 'Enable' : 'Disable'}
                </button>
                <Button variant="ghost" size="icon" aria-label="Delete user" onClick={() => removeUser(u)}>
                  <TrashIcon width={16} height={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A channel the admin has clicked, waiting for them to pick which unmapped game it covers. */
interface PendingChannel {
  streamId: number;
  name: string;
  categoryName: string;
}

function guessLeagueFromCategory(categoryName: string): string | undefined {
  const upper = categoryName.toUpperCase();
  return LEAGUES.find((l) => upper.includes(l.replace('Live ', '').split('/')[0].toUpperCase()));
}

function GamePicker({ channel, unmapped, onPick, onCancel }: {
  channel: PendingChannel;
  unmapped: Record<string, LiveGame[]>;
  onPick: (league: string, game: LiveGame) => void;
  onCancel: () => void;
}) {
  const guessedLeague = guessLeagueFromCategory(channel.categoryName);
  const orderedLeagues = guessedLeague ? [guessedLeague, ...LEAGUES.filter((l) => l !== guessedLeague)] : LEAGUES;
  const anyGames = orderedLeagues.some((l) => (unmapped[l] ?? []).length > 0);

  return (
    <div className="card--live card mt-2">
      <div className="row-name">Map "{channel.name}" to which live game?</div>
      {!anyGames && <div className="empty-state">No unmapped live games right now — check back when something's live.</div>}
      {orderedLeagues.map((l) => {
        const games = unmapped[l] ?? [];
        if (games.length === 0) return null;
        return (
          <div key={l} className="flex flex-col gap-1">
            <div className="tile-label">{l.replace('Live ', '')}</div>
            {games.map((g) => (
              <button key={`${g.homeTeam}-${g.awayTeam}`} type="button" className="row min-h-11 cursor-pointer" onClick={() => onPick(l, g)}>
                <span className="row-name">
                  {g.awayTeam} at {g.homeTeam}
                </span>
                <span className="row-meta">
                  {g.awayScore}–{g.homeScore} {g.clock}
                </span>
              </button>
            ))}
          </div>
        );
      })}
      <button className="chip" aria-pressed={false} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function MappingsSection() {
  const [mappings, setMappings] = useState<GameMapping[] | null>(null);
  const [unmapped, setUnmapped] = useState<Record<string, LiveGame[]> | null>(null);
  const [categories, setCategories] = useState<ChannelCategorySummary[] | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [channelsByCategory, setChannelsByCategory] = useState<Record<string, ChannelSummary[]>>({});
  const [categoryFilter, setCategoryFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [pendingChannel, setPendingChannel] = useState<PendingChannel | null>(null);

  function reload() {
    adminListMappings().then((r) => setMappings(r.mappings)).catch(() => toast.error('Failed to load mappings.'));
    adminListUnmappedGames().then((r) => setUnmapped(r.leagues)).catch(() => {});
  }
  useEffect(reload, []);
  useEffect(() => {
    adminListChannelCategories()
      .then((r) => setCategories(r.categories))
      .catch(() => toast.error('Failed to load channel categories.'));
  }, []);

  const unmappedCount = useMemo(() => Object.values(unmapped ?? {}).reduce((sum, g) => sum + g.length, 0), [unmapped]);

  async function toggleExpand(categoryId: string) {
    if (expandedCategoryId === categoryId) {
      setExpandedCategoryId(null);
      return;
    }
    setExpandedCategoryId(categoryId);
    setChannelFilter('');
    if (!channelsByCategory[categoryId]) {
      try {
        const res = await adminListChannelsInCategory(categoryId);
        setChannelsByCategory((prev) => ({ ...prev, [categoryId]: res.channels }));
      } catch {
        toast.error('Failed to load channels for that category.');
      }
    }
  }

  async function pickGame(league: string, game: LiveGame) {
    if (!pendingChannel) return;
    try {
      await adminCreateMapping(league, `${game.awayTeam} at ${game.homeTeam}`, pendingChannel.streamId);
      toast.success(`Mapped to ${game.awayTeam} at ${game.homeTeam}.`);
      setPendingChannel(null);
      reload();
    } catch {
      toast.error('Could not save that mapping.');
    }
  }

  async function removeMapping(id: string) {
    await adminDeleteMapping(id);
    reload();
  }

  const visibleCategories = categories?.filter((c) => c.categoryName.toLowerCase().includes(categoryFilter.trim().toLowerCase())) ?? [];
  const expandedChannels = expandedCategoryId ? channelsByCategory[expandedCategoryId] ?? [] : [];
  const filteredExpandedChannels = channelFilter.trim()
    ? expandedChannels.filter((c) => c.name.toLowerCase().includes(channelFilter.trim().toLowerCase()))
    : expandedChannels;

  return (
    <div className="flex flex-col gap-6">
      <div className={unmappedCount > 0 ? 'card card--live' : 'card'}>
        {unmapped === null ? (
          <Skeleton className="h-5 w-64" />
        ) : unmappedCount === 0 ? (
          <span className="text-muted">No unmapped live games right now.</span>
        ) : (
          <span>
            <span className="pill mr-2 align-middle">{unmappedCount}</span>
            live game{unmappedCount === 1 ? '' : 's'} without a mapped channel. Expand the matching PPV category below
            (e.g. "US| NFL PPV"), find the channel, and map it.
          </span>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold">Browse channels</h3>
        <input className="field max-w-[320px]" placeholder="Filter categories, e.g. PPV" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} />

        {!categories ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {visibleCategories.map((c) => (
              <div key={c.categoryId}>
                <a
                  href="#"
                  className="cat"
                  aria-current={expandedCategoryId === c.categoryId}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleExpand(c.categoryId);
                  }}
                >
                  {c.categoryName}
                </a>
                {expandedCategoryId === c.categoryId && (
                  <div className="mt-1 flex flex-col gap-1 pl-4">
                    <input
                      className="field max-w-[280px]"
                      placeholder="Filter channels in this category"
                      value={channelFilter}
                      onChange={(e) => setChannelFilter(e.target.value)}
                    />
                    {expandedChannels.length === 0 ? (
                      <div className="flex flex-col gap-1 pt-1">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : (
                      <div className="flex max-h-[280px] flex-col gap-1 overflow-y-auto">
                        {filteredExpandedChannels.map((ch) => (
                          <button
                            key={ch.streamId}
                            type="button"
                            className="row min-h-10 cursor-pointer"
                            onClick={() => setPendingChannel({ streamId: ch.streamId, name: ch.name, categoryName: c.categoryName })}
                          >
                            <span className="row-meta shrink-0">{ch.num}</span>
                            <span className="row-name">{ch.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {pendingChannel && pendingChannel.categoryName === c.categoryName && unmapped && (
                      <GamePicker channel={pendingChannel} unmapped={unmapped} onPick={pickGame} onCancel={() => setPendingChannel(null)} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold">Current mappings</h3>
        {!mappings ? (
          <Skeleton className="h-14 w-full" />
        ) : mappings.length === 0 ? (
          <div className="empty-state">No mappings yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {mappings.map((m) => (
              <div key={m.id} className="row cursor-default">
                <div className="min-w-0 flex-1">
                  <div className="row-name">{m.label}</div>
                  <div className="row-meta">
                    {m.league.replace('Live ', '')} · stream {m.streamId} · by {m.createdBy}
                  </div>
                </div>
                <Button variant="ghost" size="icon" aria-label="Delete mapping" onClick={() => removeMapping(m.id)}>
                  <TrashIcon width={16} height={16} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function Admin() {
  const user = useCurrentUser();
  const [section, setSection] = useState<'users' | 'mappings'>('users');
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Admin portal</h1>
      </div>
      <SectionTabs value={section} onChange={setSection} />
      {section === 'users' ? <UsersSection currentUserId={user.id} /> : <MappingsSection />}
    </div>
  );
}
