const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  id: String,
  color: String,
  name: String
}, { _id: false });

const TokenSchema = new mongoose.Schema({
  id: String,
  color: String,
  position: Number
}, { _id: false });

const GameStateSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  players: [PlayerSchema],
  turnIndex: {
    type: Number,
    default: 0
  },
  state: {
    type: String,
    enum: ['WAITING', 'PLAYING', 'FINISHED'],
    default: 'WAITING'
  },
  diceValue: {
    type: Number,
    default: 0
  },
  tokens: {
    type: mongoose.Schema.Types.Mixed, // Storing the { yellow: [...], blue: [...] } object
    default: {}
  },
  hasRolledDice: {
    type: Boolean,
    default: false
  },
  sixCount: {
    type: Number,
    default: 0
  },
  winner: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Update the lastUpdatedAt field before saving
GameStateSchema.pre('save', function(next) {
  this.lastUpdatedAt = Date.now();
  next();
});

module.exports = mongoose.model('GameState', GameStateSchema);
