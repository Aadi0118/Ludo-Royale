import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import Board from './Board';
import Dice from './Dice';
import VoiceChat from './VoiceChat';
import { LogOut, Play } from 'lucide-react';

const Game = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(location.state?.initialGameState || null);
  const [error, setError] = useState('');
  const [isRolling, setIsRolling] = useState(false);
  const [lastRolledValue, setLastRolledValue] = useState(1);
  const [turnMessage, setTurnMessage] = useState('');
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    if (!isConnected) return;

    const handleGameUpdate = (state) => {
      console.log('Game Update:', state);
      setGameState(state);
    };

    const handleDiceRolled = (data) => {
      console.log('Dice Rolled:', data);
      // We can add a toast notification or animation trigger here
    };

    const handleGameWon = (data) => {
      alert(`Game Over! ${data.winner.name} won!`);
    };

    const handleAnimateMove = (data) => {
      setAnimationData(data);
      if (data.finalState) {
        setGameState(data.finalState);
      }
    };

    socket.on('game_update', handleGameUpdate);
    socket.on('dice_rolled', handleDiceRolled);
    socket.on('animate_move', handleAnimateMove);
    socket.on('game_won', handleGameWon);

    // If we land here directly without joining through Lobby (e.g., refresh), 
    // we need to rejoin. For now, just redirect to Lobby if no gameState after a small delay.
    const timeout = setTimeout(() => {
      if (!gameState) navigate('/');
    }, 2000);

    return () => {
      socket.off('game_update', handleGameUpdate);
      socket.off('dice_rolled', handleDiceRolled);
      socket.off('animate_move', handleAnimateMove);
      socket.off('game_won', handleGameWon);
      clearTimeout(timeout);
    };
  }, [isConnected, socket, gameState, navigate]);

  useEffect(() => {
    if (!isConnected) {
      navigate('/');
    }
  }, [isConnected, navigate]);

  // Keep track of the last valid dice value so the UI doesn't reset to 1 when turn is skipped
  useEffect(() => {
    if (gameState && gameState.diceValue > 0) {
      setLastRolledValue(gameState.diceValue);
    }
  }, [gameState?.diceValue]);

  const handleStartGame = () => {
    socket.emit('start_game');
  };

  const handleRollDice = () => {
    if (isRolling) return;
    setIsRolling(true);
    setTurnMessage('');
    
    socket.emit('roll_dice', (res) => {
      // If the backend returns the roll value, update our local state immediately for the UI
      if (res.success && res.diceValue) {
        setLastRolledValue(res.diceValue);
      }
      
      // Add artificial delay to let the roll animation play
      setTimeout(() => {
        setIsRolling(false);
        if (!res.success) {
          console.error(res.message);
        } else if (res.message) {
          // If there's a message like "No valid moves. Turn skipped."
          setTurnMessage(res.message);
          setTimeout(() => setTurnMessage(''), 3000);
        } else if (res.validMoves && res.validMoves.length === 1) {
          // Auto-move if exactly 1 valid move
          setTimeout(() => {
            handleMoveToken(res.validMoves[0]);
          }, 300);
        }
      }, 600);
    });
  };

  const handleMoveToken = (tokenId) => {
    socket.emit('move_token', { tokenId }, (res) => {
      if (!res.success) console.error(res.message);
    });
  };

  const handleLeave = () => {
    socket.emit('leave_room');
    navigate('/');
  };

  if (!gameState) return <div style={{textAlign: 'center', marginTop: '2rem'}}>Loading Game State...</div>;

  const isCreator = gameState.players.length > 0 && gameState.players[0].id === socket.id;
  const isMyTurn = gameState.currentPlayer && gameState.currentPlayer.id === socket.id;

  const renderPlayerPanel = (color, positionClass) => {
    // Find player with this color
    const player = gameState.players.find(p => p.color === color);
    const isThisTurn = gameState.currentPlayer && gameState.currentPlayer.color === color;
    const isMe = player && player.id === socket.id;
    
    // We only show the Dice if it is this player's turn, or maybe we just show it empty?
    // In the image, the dice box is empty if it's not their turn, or shows the last roll.
    // For simplicity, we show the dice if it's their turn, otherwise empty box.
    const canRoll = isThisTurn && isMe && !gameState.hasRolledDice && !animationData;

    return (
      <div className={`player-panel ${positionClass}`} style={{ borderColor: `var(--ludo-${color})`, boxShadow: isThisTurn ? `0 0 20px var(--ludo-${color})` : '' }}>
        <div className="player-name">
          {player ? (isMe ? 'You' : player.name) : 'Waiting...'}
        </div>
        
        <div className="avatar-box" style={{ borderColor: `var(--ludo-${color})` }}>
           <div className={`pawn pawn-${color}`} style={{
             width: '40px', height: '40px', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
             display: 'flex', alignItems: 'center', justifyContent: 'center'
           }}>
             <div style={{ width: '16px', height: '16px', background: '#fff', borderRadius: '50%' }}></div>
           </div>
        </div>

        <div 
          className="dice-container-box" 
          style={{ 
             cursor: canRoll ? 'pointer' : 'default',
             background: isThisTurn ? '#fff' : '#f8e1e1',
             transform: canRoll ? 'scale(1.1)' : 'scale(1)',
             transition: 'transform 0.2s',
             border: isThisTurn ? `4px solid var(--ludo-${color})` : '4px solid #ccc'
          }}
          onClick={canRoll ? handleRollDice : undefined}
        >
          {isThisTurn ? (
            <Dice value={lastRolledValue} rolling={isRolling} />
          ) : (
            <div style={{ color: '#ccc', fontWeight: 'bold' }}>-</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '10px', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '1000px', marginBottom: '1rem', gap: '10px' }}>
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Room: {gameState.roomId}</h2>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <VoiceChat socket={socket} roomId={roomId} gameState={gameState} />

          {gameState.state === 'WAITING' && isCreator && (
            <button className="btn" onClick={handleStartGame} style={{ background: '#22c55e', padding: '6px 12px', fontSize: '0.9rem' }}>
              <Play size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Start
            </button>
          )}
          <button className="btn" style={{ background: '#ef4444', padding: '6px 12px', fontSize: '0.9rem' }} onClick={handleLeave}>
            <LogOut size={16} /> Leave
          </button>
        </div>
      </div>

      <div className="game-container">
        {renderPlayerPanel('yellow', 'top-left')}
        {renderPlayerPanel('blue', 'top-right')}
        
        <div className="board-container" style={{ zIndex: 5 }}>
          <Board 
            gameState={gameState} 
            onMoveToken={handleMoveToken} 
            socketId={socket.id}
            animationData={animationData}
            onAnimationComplete={() => setAnimationData(null)}
          />
        </div>

        {renderPlayerPanel('green', 'bottom-left')}
        {renderPlayerPanel('red', 'bottom-right')}
      </div>
      
      {turnMessage && (
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '1rem 2rem', borderRadius: '8px', zIndex: 100, fontSize: '1.2rem', fontWeight: 'bold' }}>
          {turnMessage}
        </div>
      )}

      {isMyTurn && gameState.diceValue > 0 && !isRolling && !animationData && (
        <p style={{ marginTop: '2rem', color: '#fff', fontWeight: 'bold', fontSize: '1.2rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
          Your turn! Select a token to move.
        </p>
      )}

    </div>
  );
};

export default Game;
