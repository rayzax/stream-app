import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { SearchIcon, UserIcon, ShieldIcon } from './icons';
import { Button } from './ui/button';
import { logout } from '../lib/api';
import { useCurrentUser } from '../lib/AuthContext';

const TABS = [
  { to: '/', label: 'Sports' },
  { to: '/tv', label: 'Live TV' },
  { to: '/stream', label: 'Stream' },
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
      <NavLink to="/" className="brand" viewTransition>
        SyvStrm
      </NavLink>
      <nav className="tabs">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end className="tab" viewTransition>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <form className="search header-search" onSubmit={submitSearch} role="search">
        <SearchIcon />
        <input
          type="search"
          placeholder="Search channels, shows, games"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search"
        />
      </form>
      <button className="header-search-btn" aria-label="Search" onClick={() => navigate('/search')}>
        <SearchIcon />
      </button>
      {user.role === 'admin' && (
        <Button variant="ghost" size="icon" className="ml-1 rounded-full" aria-label="Admin portal" onClick={() => navigate('/admin')}>
          <ShieldIcon />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="ml-1 rounded-full" aria-label="Log out" onClick={handleLogout}>
        <UserIcon />
      </Button>
    </header>
  );
}
