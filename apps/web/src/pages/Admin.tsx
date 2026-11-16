import { useEffect, useState, type FormEvent } from 'react';
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
  getTv,
  getSports,
  type AdminUser,
  type GameMapping,
  type ChannelView,
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

function MappingsSection() {
  const [mappings, setMappings] = useState<GameMapping[] | null>(null);
  const [channels, setChannels] = useState<ChannelView[]>([]);
  const [channelFilter, setChannelFilter] = useState('');
  const [league, setLeague] = useState(LEAGUES[0]);
  const [label, setLabel] = useState('');
  const [streamId, setStreamId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    adminListMappings().then((r) => setMappings(r.mappings)).catch(() => setError('Failed to load mappings.'));
  }
  useEffect(reload, []);
  useEffect(() => {
    getTv().then((r) => setChannels(r.categories.flatMap((c) => c.channels)));
  }, []);
  // Surface currently-detected live games too, so the admin can see what
  // the heuristic already found (and fix anything wrong/missing).
  const [detected, setDetected] = useState<Record<string, { name: string; streamId: number }[]>>({});
  useEffect(() => {
    getSports().then((r) => {
      const flat: Record<string, { name: string; streamId: number }[]> = {};
      for (const [lg, entries] of Object.entries(r.leagues)) {
        flat[lg] = entries.map((e) => ({ name: e.name, streamId: e.streamId }));
      }
      setDetected(flat);
    });
  }, []);

  const filteredChannels = channelFilter.trim()
    ? channels.filter((c) => c.name.toLowerCase().includes(channelFilter.trim().toLowerCase())).slice(0, 20)
    : [];

  async function createMapping(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!streamId || !label.trim()) {
      setError('Pick a channel and enter a game label.');
      return;
    }
    try {
      await adminCreateMapping(league, label.trim(), streamId);
      setLabel('');
      setStreamId(null);
      setChannelFilter('');
      reload();
    } catch {
      setError('Could not save that mapping.');
    }
  }

  async function removeMapping(id: string) {
    await adminDeleteMapping(id);
    reload();
  }

  return (
    <section className="league-section">
      <h2 className="league-heading">Game → channel mappings</h2>
      <div className="empty-state">
        Pin a specific channel to a game label (e.g. "Bears at Packers") — this overrides or supplements the
        automatic detection on the Sports tab.
      </div>
      {error && <div className="login-error">{error}</div>}

      <form onSubmit={createMapping} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
        <select className="select" value={league} onChange={(e) => setLeague(e.target.value)}>
          {LEAGUES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <input className="field" placeholder="Game label, e.g. Bears at Packers" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input
          className="field"
          placeholder={streamId ? `Channel selected (stream ${streamId}) — type to change` : 'Search channels by name'}
          value={channelFilter}
          onChange={(e) => {
            setChannelFilter(e.target.value);
            setStreamId(null);
          }}
        />
        {filteredChannels.length > 0 && !streamId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
            {filteredChannels.map((c) => (
              <button
                key={c.streamId}
                type="button"
                className="row"
                style={{ cursor: 'pointer', minHeight: 40 }}
                onClick={() => {
                  setStreamId(c.streamId);
                  setChannelFilter(c.name);
                }}
              >
                <span className="row-name">{c.name}</span>
              </button>
            ))}
          </div>
        )}
        <button className="btn" type="submit" style={{ alignSelf: 'flex-start' }}>
          <PlusIcon /> Save mapping
        </button>
      </form>

      {detected[league]?.length > 0 && (
        <div className="empty-state">
          Currently detected in {league}: {detected[league].map((d) => d.name).join(', ')}
        </div>
      )}

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
