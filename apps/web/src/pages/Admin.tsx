import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
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
import { TrashIcon, PlusIcon } from '../components/icons';

const LEAGUES = ['Live NFL', 'Live CFB', 'Live NBA', 'Live CBB', 'Live MLB', 'Live NHL', 'Live Soccer', 'Live UFC/Boxing'];

function UsersSection({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [creating, setCreating] = useState(false);

  function reload() {
    adminListUsers().then((r) => setUsers(r.users)).catch(() => setError('Failed to load users.'));
  }
  useEffect(reload, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await adminCreateUser(newUsername, newPassword, newRole);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      reload();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 409 ? 'That username is already taken.' : 'Could not create user (password must be 8+ characters).');
    } finally {
      setCreating(false);
    }
  }

  async function toggleRole(u: AdminUser) {
    setError(null);
    try {
      await adminUpdateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' });
      reload();
    } catch {
      setError('Could not change that user’s role (at least one enabled admin is required).');
    }
  }

  async function toggleDisabled(u: AdminUser) {
    setError(null);
    try {
      await adminUpdateUser(u.id, { disabled: !u.disabled });
      reload();
    } catch {
      setError('Could not update that user (at least one enabled admin is required).');
    }
  }

  async function removeUser(u: AdminUser) {
    if (!confirm(`Delete user "${u.username}"? This can't be undone.`)) return;
    setError(null);
    try {
      await adminDeleteUser(u.id);
      reload();
    } catch {
      setError('Could not delete that user (at least one enabled admin is required).');
    }
  }

  return (
    <section className="league-section">
      <h2 className="league-heading">Users</h2>
      {error && <div className="login-error">{error}</div>}

      <form onSubmit={createUser} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="field" style={{ maxWidth: 200 }} placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
        <input className="field" style={{ maxWidth: 200 }} type="password" placeholder="Password (8+ chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        <select className="select" style={{ width: 'auto' }} value={newRole} onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn" type="submit" disabled={creating}>
          <PlusIcon /> Add user
        </button>
      </form>

      {!users ? (
        <div className="loading">Loading users…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((u) => (
            <div key={u.id} className="row" style={{ cursor: 'default' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-name">
                  {u.username}
                  {u.id === currentUserId && <span className="row-meta"> (you)</span>}
                </div>
                <div className="row-meta">{u.disabled ? 'Disabled' : 'Active'} · joined {new Date(u.createdAt).toLocaleDateString()}</div>
              </div>
              <span className="tag">{u.role}</span>
              <button className="chip" aria-pressed={false} onClick={() => toggleRole(u)}>
                Make {u.role === 'admin' ? 'user' : 'admin'}
              </button>
              <button className="chip" aria-pressed={u.disabled} onClick={() => toggleDisabled(u)}>
                {u.disabled ? 'Enable' : 'Disable'}
              </button>
              <button className="ctl" aria-label="Delete user" onClick={() => removeUser(u)}>
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
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
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row-name">Map "{channel.name}" to which live game?</div>
      {!anyGames && <div className="empty-state">No unmapped live games right now — check back when something's live.</div>}
      {orderedLeagues.map((l) => {
        const games = unmapped[l] ?? [];
        if (games.length === 0) return null;
        return (
          <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="tile-label">{l.replace('Live ', '')}</div>
            {games.map((g) => (
              <button key={`${g.homeTeam}-${g.awayTeam}`} type="button" className="row" style={{ cursor: 'pointer', minHeight: 44 }} onClick={() => onPick(l, g)}>
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
  const [error, setError] = useState<string | null>(null);

  function reload() {
    adminListMappings().then((r) => setMappings(r.mappings)).catch(() => setError('Failed to load mappings.'));
    adminListUnmappedGames().then((r) => setUnmapped(r.leagues)).catch(() => {});
  }
  useEffect(reload, []);
  useEffect(() => {
    adminListChannelCategories()
      .then((r) => setCategories(r.categories))
      .catch(() => setError('Failed to load channel categories.'));
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
        setError('Failed to load channels for that category.');
      }
    }
  }

  async function pickGame(league: string, game: LiveGame) {
    if (!pendingChannel) return;
    setError(null);
    try {
      await adminCreateMapping(league, `${game.awayTeam} at ${game.homeTeam}`, pendingChannel.streamId);
      setPendingChannel(null);
      reload();
    } catch {
      setError('Could not save that mapping.');
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
    <section className="league-section">
      <h2 className="league-heading">Game → channel mappings</h2>
      <div className="empty-state">
        {unmapped === null
          ? 'Checking for live games without a mapped channel…'
          : unmappedCount === 0
            ? 'No unmapped live games right now.'
            : `${unmappedCount} live game${unmappedCount === 1 ? '' : 's'} without a mapped channel. Expand the matching PPV category below (e.g. "US| NFL PPV"), find the channel, and map it.`}
      </div>
      {error && <div className="login-error">{error}</div>}

      <input className="field" style={{ maxWidth: 320 }} placeholder="Filter categories, e.g. PPV" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} />

      {!categories ? (
        <div className="loading">Loading categories…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  <input
                    className="field"
                    style={{ maxWidth: 280 }}
                    placeholder="Filter channels in this category"
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value)}
                  />
                  {expandedChannels.length === 0 ? (
                    <div className="loading">Loading channels…</div>
                  ) : (
                    <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {filteredExpandedChannels.map((ch) => (
                        <button
                          key={ch.streamId}
                          type="button"
                          className="row"
                          style={{ cursor: 'pointer', minHeight: 40 }}
                          onClick={() => setPendingChannel({ streamId: ch.streamId, name: ch.name, categoryName: c.categoryName })}
                        >
                          <span className="row-meta" style={{ flexShrink: 0 }}>
                            {ch.num}
                          </span>
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

      <h3 className="league-heading" style={{ fontSize: 15 }}>
        Current mappings
      </h3>
      {!mappings ? (
        <div className="loading">Loading mappings…</div>
      ) : mappings.length === 0 ? (
        <div className="empty-state">No mappings yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mappings.map((m) => (
            <div key={m.id} className="row" style={{ cursor: 'default' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-name">{m.label}</div>
                <div className="row-meta">
                  {m.league.replace('Live ', '')} · stream {m.streamId} · by {m.createdBy}
                </div>
              </div>
              <button className="ctl" aria-label="Delete mapping" onClick={() => removeMapping(m.id)}>
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Admin() {
  const user = useCurrentUser();
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Admin portal</h1>
      </div>
      <UsersSection currentUserId={user.id} />
      <MappingsSection />
    </div>
  );
}
