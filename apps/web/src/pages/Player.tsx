import { useParams } from 'react-router-dom'

export default function Player() {
  const { id } = useParams<{ id: string }>()

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg)',
      color: 'var(--text)',
    }}>
      <div style={{
        textAlign: 'center',
      }}>
        <h1>Player</h1>
        <p>Player page placeholder for id: {id}</p>
      </div>
    </div>
  )
}
