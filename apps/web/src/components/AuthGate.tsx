import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { checkSession, type CurrentUser } from '../lib/api';
import { AuthContext } from '../lib/AuthContext';
import Header from './Header';
import TabBar from './TabBar';

export default function AuthGate() {
  const [user, setUser] = useState<CurrentUser | null | 'checking'>('checking');

  useEffect(() => {
    checkSession()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null));
  }, []);

  if (user === 'checking') return <div className="loading">Loading…</div>;
  if (user === null) return <Navigate to="/login" replace />;

  return (
    <AuthContext.Provider value={user}>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
      <TabBar />
    </AuthContext.Provider>
  );
}
