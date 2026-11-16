import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { SearchIcon, UserIcon, ShieldIcon } from './icons';
import { logout } from '../lib/api';
import { useCurrentUser } from '../lib/AuthContext';

const TABS = [
  { to: '/', label: 'Sports' },
  { to: '/tv', label: 'TV' },
  { to: '/movies', label: 'Movies' },
];

export default function Header() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [q, setQ] = useState('');

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  }

  return (
    <header className="app-header">
      <NavLink to="/" className="brand">
        Stream
      </NavLink>
      <nav className="tabs">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end className="tab">
            {t.label}
          </NavLink>
        ))}
      </nav>
      <form className="search header-search" onSubmit={submitSearch} role="search">
        <SearchIcon />
        <input
          type="search"
          placeholder="Search channels, movies, games"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search"
        />
      </form>
      <button className="header-search-btn" aria-label="Search" onClick={() => navigate('/search')}>
        <SearchIcon />
      </button>
      {user.role === 'admin' && (
        <button
          onClick={() => navigate('/admin')}
          aria-label="Admin portal"
          style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', marginLeft: 4 }}
        >
          <ShieldIcon />
        </button>
      )}
      <button
        onClick={handleLogout}
        aria-label="Log out"
        style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', marginLeft: 4 }}
      >
        <UserIcon />
      </button>
    </header>
  );
}
