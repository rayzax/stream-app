import { BrowserRouter, Routes, Route } from 'react-router-dom'
import TabBar from './components/TabBar'
import Login from './pages/Login'
import Main from './pages/Main'
import TV from './pages/TV'
import Movies from './pages/Movies'
import Search from './pages/Search'
import Player from './pages/Player'

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/tv" element={<><TV /><TabBar /></>} />
          <Route path="/movies" element={<><Movies /><TabBar /></>} />
          <Route path="/search" element={<><Search /><TabBar /></>} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="/" element={<><Main /><TabBar /></>} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
