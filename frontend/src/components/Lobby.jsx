import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { Users, PlusCircle, LogIn } from 'lucide-react';

const Lobby = () => {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    if (!name.trim()) return setError('Please enter a name');
    
    socket.emit('create_room', { name }, (response) => {
      if (response.success) {
        navigate(`/game/${response.roomId}`, { state: { initialGameState: response.gameState } });
      } else {
        setError('Failed to create room');
      }
    });
  };

  const handleJoinRoom = () => {
    if (!name.trim()) return setError('Please enter a name');
    if (!roomCode.trim()) return setError('Please enter a room code');

    socket.emit('join_room', { roomId: roomCode.toUpperCase(), name }, (response) => {
      if (response.success) {
        navigate(`/game/${response.roomId}`, { state: { initialGameState: response.gameState } });
      } else {
        setError(response.message || 'Failed to join room');
      }
    });
  };

  return (
    <div className="glass-panel animate-slide-up" style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <Users size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
        <h2>Join the Battle</h2>
        <p className="text-muted">Create a new room or join an existing one</p>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input 
          className="input-field" 
          placeholder="Enter your name" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!isConnected}
        />
        
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button 
            className="btn" 
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            onClick={handleCreateRoom}
            disabled={!isConnected}
          >
            <PlusCircle size={20} /> Create Room
          </button>
        </div>

        <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '1rem 0' }}>OR</div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <input 
            className="input-field" 
            placeholder="Room Code" 
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            style={{ flex: 2 }}
            disabled={!isConnected}
          />
          <button 
            className="btn" 
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#10b981' }}
            onClick={handleJoinRoom}
            disabled={!isConnected}
          >
            <LogIn size={20} /> Join
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
