import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
    },
    pin: { type: String },
    balance: { type: Number, default: 0 },
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet" },
    hostedGames: [{ type: mongoose.Schema.Types.ObjectId, ref: "GameRoom" }],
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    points: { type: Number, default: 0 },
    current_streak: { type: Number, default: 0 },
    last_active_date: { type: Date, default: null },
    available_spins: { type: Number, default: 0 },
    referralNumber: { type: String },
    role: {
      type: String,
      enum: ["user", "admin", "agent", "cashier"],
      default: "user",
    },
    // Reference to the user who created this account (for agent/cashier hierarchy)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Share percentage (for agents/cashiers) - used for wallet top-up multiplier
    // e.g., 10 means 10% share, so admin adding 10 birr = agent gets 100 birr
    sharePercent: {
      type: Number,
      default: 10, // Default 10% share
      min: 1,
      max: 100,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    // Unique code for cashiers - used by players to subscribe
    cashierCode: {
      type: String,
      unique: true,
      sparse: true, // Allow null values without unique constraint violation
    },
    // For local players (players who don't sign up with phone/OTP)
    localPlayerId: {
      type: String,
      unique: true,
      sparse: true, // Allow null values without unique constraint violation
    },
    isLocalPlayer: {
      type: Boolean,
      default: false,
    },
    // Win cut percentage for cashiers - deducted from pot before payout
    winCut: {
      type: Number,
      default: 10, // Default 10% win cut
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

// Hash PIN before save if it was modified
userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("pin") || !this.pin) {
      return next();
    }
    // If already bcrypt-hashed, skip (bcrypt hashes start with $2)
    if (typeof this.pin === "string" && this.pin.startsWith("$2")) {
      return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(String(this.pin), salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePin = async function (candidatePin) {
  if (!this.pin) return false;
  // If stored as bcrypt hash
  if (typeof this.pin === "string" && this.pin.startsWith("$2")) {
    return bcrypt.compare(String(candidatePin), this.pin);
  }
  // Fallback for legacy plaintext pins (allows existing users to log in)
  return String(this.pin) === String(candidatePin);
};

const UserModel = mongoose.model("User", userSchema);
export default UserModel;
