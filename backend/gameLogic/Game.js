const crypto = require('crypto');
const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

const COLORS = ['yellow', 'blue', 'red', 'green'];

const START_POSITIONS = {
  yellow: 0,
  blue: 13,
  red: 26,
  green: 39
};

const END_POSITIONS = {
  yellow: 50,
  blue: 11,
  red: 24,
  green: 37
};

const HOME_PATH_START = {
  yellow: 100,
  blue: 200,
  red: 300,
  green: 400
};

class Game {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = []; // Array of { id: socket.id, color: 'red', name: 'Player 1' }
    this.turnIndex = 0; // Index of the player in this.players array
    this.state = 'WAITING'; // WAITING, PLAYING, FINISHED
    this.diceValue = 0;
    this.tokens = this.initializeTokens();
    this.hasRolledDice = false; // Player can only move if they rolled
    this.sixCount = 0; // How many 6s rolled consecutively
    this.winner = null;
  }

  initializeTokens() {
    let tokens = {};
    COLORS.forEach(color => {
      tokens[color] = [
        { id: `${color}-0`, color, position: -1 }, // -1 means in base
        { id: `${color}-1`, color, position: -1 },
        { id: `${color}-2`, color, position: -1 },
        { id: `${color}-3`, color, position: -1 }
      ];
    });
    return tokens;
  }

  static rehydrate(dbGame) {
    const game = new Game(dbGame.roomId);
    game.players = dbGame.players || [];
    game.turnIndex = dbGame.turnIndex || 0;
    game.state = dbGame.state || 'WAITING';
    game.diceValue = dbGame.diceValue || 0;
    
    // Convert Mongoose mixed type to raw JS object if necessary
    if (dbGame.tokens) {
      game.tokens = JSON.parse(JSON.stringify(dbGame.tokens));
    } else {
      game.tokens = game.initializeTokens();
    }
    
    game.hasRolledDice = dbGame.hasRolledDice || false;
    game.sixCount = dbGame.sixCount || 0;
    
    if (dbGame.winner) {
      game.winner = JSON.parse(JSON.stringify(dbGame.winner));
    }
    
    return game;
  }

  addPlayer(player) {
    if (this.state !== 'WAITING') return false;
    if (this.players.length >= 4) return false;
    if (this.players.find(p => p.id === player.id)) return false;
    
    // Assign color based on length
    const assignedColor = COLORS[this.players.length];
    this.players.push({ ...player, color: assignedColor });
    
    if (this.players.length === 4) {
      this.state = 'PLAYING'; // Auto start for now if 4 players
    }
    return true;
  }

  removePlayer(playerId) {
    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx !== -1) {
      if (this.state === 'PLAYING') {
        if (idx < this.turnIndex) {
          this.turnIndex--;
        } else if (idx === this.turnIndex) {
          // Player whose turn it is left. Reset roll and handle wrap around
          this.hasRolledDice = false;
          this.sixCount = 0;
          this.diceValue = 0;
          if (this.turnIndex >= this.players.length - 1) {
            this.turnIndex = 0;
          }
        }
      }
      this.players.splice(idx, 1);
    }
    
    if (this.players.length < 2 && this.state === 'PLAYING') {
      this.state = 'FINISHED';
      // Remaining player wins by default
      this.winner = this.players[0] || null;
    }
  }

  start() {
    if (this.players.length >= 2) {
      this.state = 'PLAYING';
    }
  }

  getCurrentPlayer() {
    return this.players[this.turnIndex];
  }
  rollDice(playerId) {
    if (this.state !== 'PLAYING') return { success: false, message: 'Game not playing' };
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) return { success: false, message: 'Not your turn' };
    if (this.hasRolledDice) return { success: false, message: 'Already rolled' };

    this.diceValue = crypto.randomInt(1, 7);
    this.hasRolledDice = true;

    if (this.diceValue === 6) {
      this.sixCount++;
      if (this.sixCount === 3) {
        // Rolled three 6s, skip turn
        return { success: true, diceValue: 6, skipTurn: true, message: 'Rolled three 6s. Turn skipped.' };
      }
    } else {
      this.sixCount = 0;
    }

    // Check if player has any valid moves
    const validMoves = this.getValidMoves(currentPlayer.color, this.diceValue);
    if (validMoves.length === 0) {
      // Don't call this.nextTurn() immediately so clients can see the dice roll result
      // Server will handle the delay and call nextTurn.
      const getsAnotherTurn = (this.diceValue === 6);
      return { 
        success: true, 
        diceValue: this.diceValue, 
        noMoves: true, 
        getsAnotherTurn, 
        message: getsAnotherTurn ? 'No valid moves. Roll again!' : 'No valid moves. Turn skipped.' 
      };
    }

    return { success: true, diceValue: this.diceValue, validMoves };
  }

  getValidMoves(color, diceValue) {
    return this.tokens[color].filter(token => {
      // If token is in base, needs a 6 to come out
      if (token.position === -1) {
        return diceValue === 6;
      }
      
      // Calculate target position
      const targetPos = this.calculateTargetPosition(token, diceValue);
      // If targetPos is -2, it overshot home, invalid move
      if (targetPos === -2) return false;
      
      // If targetPos is 6 (home path index 5), it's valid (entering home)
      return true;
    }).map(t => t.id);
  }

  calculateTargetPosition(token, diceValue) {
    if (token.position === -1) {
      if (diceValue === 6) return START_POSITIONS[token.color];
      return -1;
    }

    // If on main path
    if (token.position >= 0 && token.position <= 51) {
      let distanceToEnd = END_POSITIONS[token.color] - token.position;
      // Handle wrap around (e.g. green going from 51 to 0)
      if (distanceToEnd < 0 && START_POSITIONS[token.color] !== 0) {
        distanceToEnd += 52;
      }

      if (diceValue <= distanceToEnd) {
        // Still on main path
        return (token.position + diceValue) % 52;
      } else {
        // Entering home path
        let remainingSteps = diceValue - distanceToEnd - 1; // -1 because entering home path takes 1 step
        if (remainingSteps > 5) return -2; // Overshot home
        return HOME_PATH_START[token.color] + remainingSteps;
      }
    }

    // If on home path
    if (token.position >= HOME_PATH_START[token.color]) {
      let currentHomePathPos = token.position - HOME_PATH_START[token.color];
      let targetHomePathPos = currentHomePathPos + diceValue;
      
      if (targetHomePathPos > 5) return -2; // Overshot home
      return HOME_PATH_START[token.color] + targetHomePathPos;
    }

    return -1;
  }

  moveToken(playerId, tokenId) {
    if (this.state !== 'PLAYING') return { success: false, message: 'Game not playing' };
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) return { success: false, message: 'Not your turn' };
    if (!this.hasRolledDice) return { success: false, message: 'Roll dice first' };

    const token = this.tokens[currentPlayer.color].find(t => t.id === tokenId);
    if (!token) return { success: false, message: 'Token not found' };

    const validMoves = this.getValidMoves(currentPlayer.color, this.diceValue);
    if (!validMoves.includes(tokenId)) return { success: false, message: 'Invalid move' };

    // Calculate step-by-step path for animation
    const path = [];
    if (token.position === -1) {
      path.push(START_POSITIONS[currentPlayer.color]);
    } else {
      for (let i = 1; i <= this.diceValue; i++) {
        path.push(this.calculateTargetPosition(token, i));
      }
    }

    const targetPos = path[path.length - 1];
    token.position = targetPos;

    let captured = false;
    let reachedHome = false;
    let capturedTokens = [];

    // Check for capture if on main path and not a safe zone
    if (targetPos >= 0 && targetPos <= 51 && !SAFE_ZONES.includes(targetPos)) {
      COLORS.forEach(color => {
        if (color !== currentPlayer.color) {
          this.tokens[color].forEach(t => {
            if (t.position === targetPos) {
              // Captured!
              t.position = -1;
              captured = true;
              capturedTokens.push({ color, id: t.id });
            }
          });
        }
      });
    }

    // Check if reached home
    if (targetPos === HOME_PATH_START[currentPlayer.color] + 5) {
      reachedHome = true;
    }

    // Check win condition
    if (this.checkWinCondition(currentPlayer.color)) {
      this.state = 'FINISHED';
      this.winner = currentPlayer;
      return { success: true, state: this.getGameState(), event: 'WIN', path, capturedTokens, color: currentPlayer.color, tokenId };
    }

    // Determine next turn
    if (this.diceValue === 6 || captured || reachedHome) {
      // Gets another turn
      this.hasRolledDice = false;
    } else {
      this.nextTurn();
    }

    return { success: true, state: this.getGameState(), event: 'MOVE', path, capturedTokens, color: currentPlayer.color, tokenId };
  }

  checkWinCondition(color) {
    const homeTarget = HOME_PATH_START[color] + 5;
    return this.tokens[color].every(token => token.position === homeTarget);
  }

  nextTurn() {
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
    this.hasRolledDice = false;
    this.sixCount = 0;
    this.diceValue = 0;
  }

  resetRoll() {
    this.hasRolledDice = false;
    this.diceValue = 0;
  }

  getGameState() {
    return {
      roomId: this.roomId,
      players: this.players,
      turnIndex: this.turnIndex,
      currentPlayer: this.players.length > 0 ? this.players[this.turnIndex] : null,
      state: this.state,
      diceValue: this.diceValue,
      tokens: this.tokens,
      winner: this.winner
    };
  }
}

module.exports = { Game, SAFE_ZONES, COLORS, START_POSITIONS, END_POSITIONS, HOME_PATH_START };
