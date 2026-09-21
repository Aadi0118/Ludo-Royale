import { Routes, Route } from 'react-router-dom'
import Lobby from './components/Lobby'
import Game from './components/Game'
import { useSocket } from './context/SocketContext'

function App() {
  const { isConnected } = useSocket();

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">LUDO ROYALE</h1>
        <p className="text-muted">
          {isConnected ? <span style={{color: '#22c55e'}}>● Connected</span> : <span style={{color: '#ef4444'}}>● Disconnected</span>}
        </p>
      </header>
      
      <main className="container">
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/game/:roomId" element={<Game />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
