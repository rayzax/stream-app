import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import AuthGate from './components/AuthGate';
import Login from './pages/Login';

// Lazy-loaded, including Main (Sports) — it's the default route, but it's
// also the heaviest page (Embla + Motion for the score-flip), so it stays
// code-split like the rest rather than inflating the initial bundle.
const Main = lazy(() => import('./pages/Main'));
const TV = lazy(() => import('./pages/TV'));
const Stream = lazy(() => import('./pages/Stream'));
const SeriesDetail = lazy(() => import('./pages/SeriesDetail'));
const Search = lazy(() => import('./pages/Search'));
const Player = lazy(() => import('./pages/Player'));
const Admin = lazy(() => import('./pages/Admin'));

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        {/* Sonner only (~10KB gz) — Motion is intentionally NOT mounted here.
            LazyMotion+MotionConfig alone measured ~30KB gz at the root, which
            blows the ≤20KB animation-JS budget by itself; Main.tsx and
            Player.tsx (the only two consumers of Motion, via ScoreFlip) each
            wrap it locally so pages that never render a score never pay for it. */}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--surface-3)',
              color: 'var(--text)',
              border: '1px solid var(--border-strong)',
            },
          }}
        />
        <Suspense fallback={<div className="loading">Loading…</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AuthGate />}>
              <Route path="/" element={<Main />} />
              <Route path="/tv" element={<TV />} />
              <Route path="/stream" element={<Stream />} />
              <Route path="/series/:id" element={<SeriesDetail />} />
              <Route path="/search" element={<Search />} />
              <Route path="/player/:type/:id" element={<Player />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}

export default App;
