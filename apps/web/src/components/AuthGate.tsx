import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { checkSession } from '../lib/api';
import Header from './Header';
import TabBar from './TabBar';

export default function AuthGate() {
  const [status, setStatus] = useState<'checking' | 'authed' | 'anon'>('checking');

  useEffect(() => {
    checkSession()
      .then(() => setStatus('authed'))
      .catch(() => setStatus('anon'));
  }, []);

  if (status === 'checking') return <div className="loading">Loading…</div>;
  if (status === 'anon') return <Navigate to="/login" replace />;

  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
      <TabBar />
    </>
  );
}
