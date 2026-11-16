import { Link } from 'react-router-dom'

export default function TabBar() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      backgroundColor: 'var(--surface)',
      borderTop: `1px solid var(--surface-2)`,
      padding: '12px 0',
      paddingBottom: `calc(12px + env(safe-area-inset-bottom, 0))`,
      gap: '10px',
    }}>
      <Link to="/" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', color: 'var(--text)' }}>
        Sports
      </Link>
      <Link to="/tv" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', color: 'var(--text)' }}>
        TV
      </Link>
      <Link to="/movies" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', color: 'var(--text)' }}>
        Movies
      </Link>
    </div>
  )
}
