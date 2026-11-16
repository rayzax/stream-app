import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthGate from './components/AuthGate';
import Login from './pages/Login';
import Main from './pages/Main';

const TV = lazy(() => import('./pages/TV'));
const Movies = lazy(() => import('./pages/Movies'));
const Search = lazy(() => import('./pages/Search'));
const Player = lazy(() => import('./pages/Player'));

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Suspense fallback={<div className="loading">Loading…</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AuthGate />}>
              <Route path="/" element={<Main />} />
              <Route path="/tv" element={<TV />} />
              <Route path="/movies" element={<Movies />} />
              <Route path="/search" element={<Search />} />
              <Route path="/player/:type/:id" element={<Player />} />
            </Route>
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}

export default App;
