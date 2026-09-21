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
const GameState = require('./models/GameState');

const activeGames = new Map(); // roomId -> Game instance

// Helper function to save a game to MongoDB
async function saveGameToDB(game) {
  if (!process.env.MONGO_URI) return; // Skip if no DB
  try {
    const state = game.getGameState();
    await GameState.findOneAndUpdate(
      { roomId: game.roomId },
      {
        roomId: game.roomId,
        players: state.players,
        turnIndex: state.turnIndex,
        state: state.state,
        diceValue: state.diceValue,
        tokens: state.tokens,
        hasRolledDice: state.hasRolledDice,
        sixCount: state.sixCount,
        winner: state.winner
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Failed to save game to DB:', error);
  }
}

// Socket.io logic
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('create_room', async (data, callback) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const game = new Game(roomId);
    
    const player = { id: socket.id, name: data.name || 'Player 1' };
    game.addPlayer(player);
    activeGames.set(roomId, game);
    
    socket.join(roomId);
    socket.roomId = roomId; // store on socket for easy access

    await saveGameToDB(game);

    callback({ success: true, roomId, gameState: game.getGameState() });
    io.to(roomId).emit('game_update', game.getGameState());
  });

  socket.on('join_room', async ({ roomId, name }, callback) => {
    let game = activeGames.get(roomId);
    
    // If not in memory, try loading from DB
    if (!game && process.env.MONGO_URI) {
      try {
        const dbGame = await GameState.findOne({ roomId });
        if (dbGame) {
          game = Game.rehydrate(dbGame);
          activeGames.set(roomId, game);
        }
      } catch (error) {
        console.error('Failed to load game from DB:', error);
      }
    }

    if (!game) return callback({ success: false, message: 'Room not found' });
    
    // Ensure we don't add duplicate players (e.g., refreshing tab)
    const existingPlayer = game.players.find(p => p.id === socket.id);
    if (!existingPlayer) {
      const player = { id: socket.id, name: name || `Player ${game.players.length + 1}` };
      const success = game.addPlayer(player);
      if (!success) return callback({ success: false, message: 'Room full or already joined' });
    }

    socket.join(roomId);
    socket.roomId = roomId;
    
    await saveGameToDB(game);

    callback({ success: true, roomId, gameState: game.getGameState() });
    io.to(roomId).emit('game_update', game.getGameState());
  });

  socket.on('start_game', async () => {
    const game = activeGames.get(socket.roomId);
    if (game && game.players[0].id === socket.id) { // Only creator can start
      game.start();
      await saveGameToDB(game);
      io.to(socket.roomId).emit('game_update', game.getGameState());
    }
  });

  socket.on('roll_dice', async (callback) => {
    const game = activeGames.get(socket.roomId);
    if (!game) return callback({ success: false });

    const result = game.rollDice(socket.id);
    if (result.success) {
      await saveGameToDB(game);
      
      io.to(socket.roomId).emit('dice_rolled', {
        playerId: socket.id,
        diceValue: result.diceValue,
        validMoves: result.validMoves || []
      });
      io.to(socket.roomId).emit('game_update', game.getGameState());

      if (result.noMoves) {
        setTimeout(async () => {
          // If the game still exists
          const currentGame = activeGames.get(socket.roomId);
          if (currentGame) {
            if (result.getsAnotherTurn) {
              currentGame.resetRoll();
            } else {
              currentGame.nextTurn();
            }
            await saveGameToDB(currentGame);
            io.to(socket.roomId).emit('game_update', currentGame.getGameState());
          }
        }, 1500);
      }
    }
    callback(result);
  });

  socket.on('move_token', async ({ tokenId }, callback) => {
    const game = activeGames.get(socket.roomId);
    if (!game) return callback({ success: false });

    const result = game.moveToken(socket.id, tokenId);
    if (result.success) {
      await saveGameToDB(game);

      // Emit animation data to clients
      io.to(socket.roomId).emit('animate_move', {
        tokenId: result.tokenId,
        color: result.color,
        path: result.path,
        capturedTokens: result.capturedTokens,
        finalState: game.getGameState()
      });

      // Calculate delay based on path length and captures
      const moveTime = (result.path ? result.path.length + 1 : 1) * 300;
      const captureTime = (result.capturedTokens && result.capturedTokens.length > 0) ? 500 : 0;
      const totalDelay = moveTime + captureTime;

      setTimeout(async () => {
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

  socket.on('leave_room', async (callback) => {
    if (socket.roomId) {
      const game = activeGames.get(socket.roomId);
      if (game) {
        game.removePlayer(socket.id);
        if (game.players.length === 0) {
          activeGames.delete(socket.roomId); // Clean up from memory
        } else {
          await saveGameToDB(game);
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

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
    if (socket.roomId) {
      const game = activeGames.get(socket.roomId);
      if (game) {
        game.removePlayer(socket.id);
        if (game.players.length === 0) {
          activeGames.delete(socket.roomId); // Clean up from memory
        } else {
          await saveGameToDB(game);
          io.to(socket.roomId).emit('game_update', game.getGameState());
        }
      }
    }
  });
});

const PORT = process.env.PORT || 5000;

if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch(err => console.log(err));
} else {
  // Fallback to memory-only if MONGO_URI is not provided
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (Memory-only mode)`);
  });
}
