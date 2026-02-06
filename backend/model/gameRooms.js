import mongoose from "mongoose";

const GameStatus = {
  waiting: "waiting",
  playing: "playing",
  finished: "finished",
  cancelled: "cancelled",
};
const gameType = {
  system: "system",
  user: "user",
};

const gameRoomSchema = new mongoose.Schema(
  {
    players: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // Players waiting for cashier approval (for user-hosted games)
    pendingPlayers: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // Players rejected by cashier
    rejectedPlayers: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    gameStatus: {
      type: String,
      enum: Object.values(GameStatus),
      required: true,
    },
    gameType: {
      type: String,
      enum: Object.values(gameType),
      required: true,
    },
    roomId: {
      type: String,
      unique: true,
    },
    hostUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Cashier who created the room
    stake: { type: Number, required: true },
    max_players: { type: Number, required: true },
    selectedCartelas: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Track number of cartelas requested by each pending player { odersplayerId: numberOfCartelas }
    playerCartelaRequests: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Track approved number of cartelas for each player { playerId: numberOfCartelas }
    approvedPlayerCartelas: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    bingoPattern: {
      type: String,
      enum: [
        "1line", "2line", "3line", "4line", // Line patterns
        "2lines", "3lines", "fullhouse", // Legacy values
        "anyVertical", "anyHorizontal", // Direction patterns
        "lPattern", "x", "centerT", "centerFourCorner" // Special patterns
      ],
      default: "1line",
    },
    callingSpeed: {
      type: Number, // milliseconds between calls
      default: 4000,
    },
    soundType: {
      type: String,
      enum: [
        "male", "female", "classic", // Legacy values
        "amharic-female", "amharic-male-1", "amharic-male-2", "amharic-male-3", // New sound packs
        "tigray-male"
      ],
      default: "amharic-male-1", // Default to the most commonly used
    },
    isPaused: {
      type: Boolean,
      default: false,
    },
    autoCall: {
      type: Boolean,
      default: false,
    },
    winner: {
      type: {
        userId: String,
        userName: String,
        cartelaId: Number,
        winningCells: [mongoose.Schema.Types.Mixed],
      },
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const UserModel = mongoose.model("GameRoom", gameRoomSchema);
export default UserModel;
