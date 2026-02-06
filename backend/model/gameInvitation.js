import mongoose from "mongoose";

const gameInvitationSchema = new mongoose.Schema(
  {
    // The cashier who created the game
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The game room
    roomId: {
      type: String,
      required: true,
    },
    gameRoomRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameRoom",
    },
    // Game details
    stake: {
      type: Number,
      required: true,
    },
    maxPlayers: {
      type: Number,
      required: true,
    },
    // Status: active, started, expired, cancelled
    status: {
      type: String,
      enum: ["active", "started", "expired", "cancelled"],
      default: "active",
    },
    // When the game started (invitation expires)
    startedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for quick lookups
gameInvitationSchema.index({ cashierId: 1, status: 1 });
gameInvitationSchema.index({ roomId: 1 });

const GameInvitation = mongoose.model("GameInvitation", gameInvitationSchema);
export default GameInvitation;

