const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // We'll restrict this in production
    methods: ['GET', 'POST']
  }
});

// In production, serve the React frontend
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
} else {
  // Basic route for development
  app.get('/', (req, res) => {
    res.send('Ludo Server is running');
  });
}

const { Game } = require('./gameLogic/Game');

const activeGames = new Map(); // roomId -> Game instance

// Socket.io logic
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('create_room', (data, callback) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const game = new Game(roomId);
    
    const player = { id: socket.id, name: data.name || 'Player 1' };
    game.addPlayer(player);
    activeGames.set(roomId, game);
    
    socket.join(roomId);
    socket.roomId = roomId; // store on socket for easy access

    callback({ success: true, roomId, gameState: game.getGameState() });
    io.to(roomId).emit('game_update', game.getGameState());
  });

  socket.on('join_room', ({ roomId, name }, callback) => {
    const game = activeGames.get(roomId);
    if (!game) return callback({ success: false, message: 'Room not found' });
    
    const player = { id: socket.id, name: name || `Player ${game.players.length + 1}` };
    const success = game.addPlayer(player);
    
    if (!success) return callback({ success: false, message: 'Room full or already joined' });

    socket.join(roomId);
    socket.roomId = roomId;
    
    callback({ success: true, roomId, gameState: game.getGameState() });
    io.to(roomId).emit('game_update', game.getGameState());
  });

  socket.on('start_game', () => {
    const game = activeGames.get(socket.roomId);
    if (game && game.players[0].id === socket.id) { // Only creator can start
      game.start();
      io.to(socket.roomId).emit('game_update', game.getGameState());
    }
  });

  socket.on('roll_dice', (callback) => {
    const game = activeGames.get(socket.roomId);
    if (!game) return callback({ success: false });

    const result = game.rollDice(socket.id);
    if (result.success) {
      io.to(socket.roomId).emit('dice_rolled', {
        playerId: socket.id,
        diceValue: result.diceValue,
        validMoves: result.validMoves || []
      });
      io.to(socket.roomId).emit('game_update', game.getGameState());

      if (result.noMoves) {
        setTimeout(() => {
          // If the game still exists
          const currentGame = activeGames.get(socket.roomId);
          if (currentGame) {
            if (result.getsAnotherTurn) {
              currentGame.resetRoll();
            } else {
              currentGame.nextTurn();
            }
            io.to(socket.roomId).emit('game_update', currentGame.getGameState());
          }
        }, 1500);
      }
    }
    callback(result);
  });

  socket.on('move_token', ({ tokenId }, callback) => {
    const game = activeGames.get(socket.roomId);
    if (!game) return callback({ success: false });

    const result = game.moveToken(socket.id, tokenId);
    if (result.success) {
      // Emit animation data to clients
      io.to(socket.roomId).emit('animate_move', {
        tokenId: result.tokenId,
        color: result.color,
        path: result.path,
        capturedTokens: result.capturedTokens,
        finalState: game.getGameState()
      });

      // Calculate delay based on path length and captures
      // 300ms per step (starting at 300ms), plus 500ms if there is a capture
      const moveTime = (result.path ? result.path.length + 1 : 1) * 300;
      const captureTime = (result.capturedTokens && result.capturedTokens.length > 0) ? 500 : 0;
      const totalDelay = moveTime + captureTime;

      setTimeout(() => {
        const currentGame = activeGames.get(socket.roomId);
        if (currentGame) {
          io.to(socket.roomId).emit('game_update', currentGame.getGameState());
          if (result.event === 'WIN') {
            io.to(socket.roomId).emit('game_won', { winner: currentGame.winner });
          }
        }
      }, totalDelay);
    }
    callback(result);
  });

  socket.on('leave_room', (callback) => {
    if (socket.roomId) {
      const game = activeGames.get(socket.roomId);
      if (game) {
        game.removePlayer(socket.id);
        if (game.players.length === 0) {
          activeGames.delete(socket.roomId); // Clean up
        } else {
          io.to(socket.roomId).emit('game_update', game.getGameState());
        }
      }
      socket.leave(socket.roomId);
      socket.roomId = null;
    }
    if (callback) callback({ success: true });
  });

  // WebRTC Signaling
  socket.on('webrtc_offer', ({ target, offer }) => {
    io.to(target).emit('webrtc_offer', {
      sender: socket.id,
      offer
    });
  });

  socket.on('webrtc_answer', ({ target, answer }) => {
    io.to(target).emit('webrtc_answer', {
      sender: socket.id,
      answer
    });
  });

  socket.on('webrtc_ice_candidate', ({ target, candidate }) => {
    io.to(target).emit('webrtc_ice_candidate', {
      sender: socket.id,
      candidate
    });
  });

  socket.on('webrtc_ping', ({ roomId }) => {
    socket.to(roomId).emit('webrtc_ping', { sender: socket.id });
  });

  socket.on('webrtc_pong', ({ target }) => {
    io.to(target).emit('webrtc_pong', { sender: socket.id });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if (socket.roomId) {
      const game = activeGames.get(socket.roomId);
      if (game) {
        game.removePlayer(socket.id);
        if (game.players.length === 0) {
          activeGames.delete(socket.roomId); // Clean up
        } else {
          io.to(socket.roomId).emit('game_update', game.getGameState());
        }
      }
    }
  });
});

const PORT = process.env.PORT || 5000;

// Uncomment when MongoDB is ready
// mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => {
//     console.log('Connected to MongoDB');
//     server.listen(PORT, () => {
//       console.log(`Server running on port ${PORT}`);
//     });
//   })
//   .catch(err => console.log(err));

// Temporary server start without MongoDB
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
