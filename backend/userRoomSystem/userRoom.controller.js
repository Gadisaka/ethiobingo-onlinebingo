import GameRoom from "../model/gameRooms.js";
import generateRoomId from "./utils/roomIdGenerator.js";
import mongoose from "mongoose";
import { hydratePlayerSummaries } from "./utils/playerHelpers.js";
import GameInvitation from "../model/gameInvitation.js";
import CashierSubscription from "../model/cashierSubscription.js";
import User from "../model/user.js";
import Wallet from "../model/wallet.js";
import Settings from "../model/settings.js";

export const createUserRoom = async (req, res) => {
  try {
    const { stake, max_players, hostUserId } = req.body;
    if (!stake || !max_players || !hostUserId) {
      return res
        .status(400)
        .json({ message: "stake, max_players, and hostUserId are required." });
    }

    // Verify the host is a cashier
    const host = await User.findById(hostUserId);
    if (!host) {
      return res.status(404).json({ message: "Host user not found." });
    }
    if (host.role !== "cashier") {
      return res
        .status(403)
        .json({ message: "Only cashiers can create game rooms." });
    }

    // Get settings for validation and win cut percentage
    const settings = await Settings.getSettings();
    const userGameSettings = settings?.userGames || {};
    
    // Validate stake limits
    const minStake = Number(userGameSettings.minStake) || 5;
    const maxStake = Number(userGameSettings.maxStake) || 500;
    if (stake < minStake || stake > maxStake) {
      return res.status(400).json({
        message: `Stake must be between ${minStake} and ${maxStake} birr.`,
        data: { minStake, maxStake, providedStake: stake },
      });
    }

    // Validate player limits
    const minPlayers = Number(userGameSettings.minPlayers) || 2;
    const maxPlayersLimit = Number(userGameSettings.maxPlayers) || 50;
    if (max_players < minPlayers || max_players > maxPlayersLimit) {
      return res.status(400).json({
        message: `Max players must be between ${minPlayers} and ${maxPlayersLimit}.`,
        data: { minPlayers, maxPlayers: maxPlayersLimit, providedMaxPlayers: max_players },
      });
    }

    // Use cashier's own winCut (from their user profile, not global settings)
    const winCutPercent =
      host.winCut !== undefined && host.winCut !== null
        ? Number(host.winCut)
        : 10; // Default to 10% if not set

    // Calculate maximum potential win cut (worst case: all max_players join)
    // Pot = stake × max_players (cashier is NOT a player)
    const maxPotentialPot = stake * max_players;
    const maxWinCut = Math.ceil((maxPotentialPot * winCutPercent) / 100);

    // Validate cashier has enough funds for the potential win cut
    const cashierWallet = await Wallet.findOne({ user: hostUserId });
    const cashierBalance =
      Number(cashierWallet?.balance || 0) + Number(cashierWallet?.bonus || 0);

    if (cashierBalance < maxWinCut) {
      return res.status(400).json({
        message: `Insufficient wallet balance. You need at least ${maxWinCut} birr to cover the potential win cut (${winCutPercent}% of max pot ${maxPotentialPot} birr). Current balance: ${cashierBalance} birr.`,
        data: {
          currentBalance: cashierBalance,
          requiredAmount: maxWinCut,
          winCutPercent,
          maxPotentialPot,
        },
      });
    }

    let roomId, exists;
    let retries = 5;
    do {
      roomId = generateRoomId();
      exists = await GameRoom.findOne({ roomId });
      retries--;
    } while (exists && retries > 0);
    if (exists) {
      return res.status(500).json({
        message: "Could not generate a unique room ID. Please try again.",
      });
    }
    const hostObjId = new mongoose.Types.ObjectId(hostUserId);

    // Cancel any existing active invitations from this cashier
    await GameInvitation.updateMany(
      { cashierId: hostObjId, status: "active" },
      { status: "cancelled" }
    );

    // Cancel any existing waiting rooms from this cashier (mark as cancelled)
    await GameRoom.updateMany(
      { hostUserId: hostObjId, gameType: "user", gameStatus: "waiting" },
      { gameStatus: "cancelled" }
    );

    // Create room WITHOUT cashier in players array (cashier is host, not a player)
    const newRoom = await GameRoom.create({
      players: [], // Cashier is NOT a player
      gameStatus: "waiting",
      gameType: "user",
      hostUserId: hostObjId,
      stake,
      max_players,
      roomId,
      cashierId: hostObjId, // Track which cashier created this room
    });

    // Create game invitation for subscribed players
    const invitation = await GameInvitation.create({
      cashierId: hostObjId,
      roomId: newRoom.roomId,
      gameRoomRef: newRoom._id,
      stake,
      maxPlayers: max_players,
      status: "active",
    });

    // Get list of subscribed player IDs for socket broadcast
    const subscriptions = await CashierSubscription.find({
      cashierId: hostObjId,
      isActive: true,
    }).select("userId");
    const subscriberIds = subscriptions.map((sub) => String(sub.userId));

    return res.status(201).json({
      room: newRoom,
      invitation,
      subscriberIds, // Frontend/socket can use this to notify subscribers
      cashierName: host.name,
      cashierCode: host.cashierCode,
      winCutInfo: {
        winCutPercent,
        maxPotentialWinCut: maxWinCut,
        cashierBalance,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Request to join a room (adds to pendingPlayers for cashier approval)
export const joinUserRoom = async (req, res) => {
  try {
    const { roomId, userId, numberOfCartelas = 1 } = req.body;
    
    console.log(`[joinUserRoom] Received: roomId=${roomId}, userId=${userId}, numberOfCartelas=${numberOfCartelas}`);
    
    if (!roomId || !userId) {
      return res
        .status(400)
        .json({ message: "roomId and userId are required." });
    }

    // Validate numberOfCartelas (1-4)
    const cartelaCount = Math.max(1, Math.min(4, parseInt(numberOfCartelas) || 1));
    console.log(`[joinUserRoom] Validated cartelaCount=${cartelaCount}`);

    const room = await GameRoom.findOne({ roomId, gameType: "user" });
    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    const userObjId = new mongoose.Types.ObjectId(userId);
    const userIdStr = String(userId);

    // Check if already approved
    const isApproved = room.players.some((p) =>
      p.equals ? p.equals(userObjId) : String(p) === userIdStr
    );
    if (isApproved) {
      return res
        .status(200)
        .json({ message: "Already approved.", room, status: "approved" });
    }

    // Check if already pending - update cartela count if different
    const isPending = room.pendingPlayers?.some((p) =>
      p.equals ? p.equals(userObjId) : String(p) === userIdStr
    );
    if (isPending) {
      // Update the cartela count even if already pending
      if (!room.playerCartelaRequests) room.playerCartelaRequests = {};
      room.playerCartelaRequests[userIdStr] = cartelaCount;
      room.markModified('playerCartelaRequests');
      await room.save();

      return res.status(200).json({
        message: "Already pending approval. Cartela count updated.",
        room,
        status: "pending",
        numberOfCartelas: cartelaCount,
        expectedPayment: cartelaCount * room.stake,
      });
    }

    // Check if was rejected
    const isRejected = room.rejectedPlayers?.some((p) =>
      p.equals ? p.equals(userObjId) : String(p) === userIdStr
    );
    if (isRejected) {
      return res.status(403).json({
        message: "You were rejected from this room.",
        status: "rejected",
      });
    }

    // Check if room is full
    if (room.players.length >= room.max_players) {
      return res.status(403).json({ message: "Room is full." });
    }

    // Add to pending players
    if (!room.pendingPlayers) room.pendingPlayers = [];
    room.pendingPlayers.push(userObjId);

    // Store the number of cartelas this player requested
    if (!room.playerCartelaRequests) room.playerCartelaRequests = {};
    room.playerCartelaRequests[userIdStr] = cartelaCount;
    room.markModified('playerCartelaRequests');

    await room.save();

    res.status(200).json({
      message: "Join request sent. Waiting for cashier approval.",
      room,
      status: "pending",
      numberOfCartelas: cartelaCount,
      expectedPayment: cartelaCount * room.stake,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Approve a player (cashier only)
export const approvePlayer = async (req, res) => {
  try {
    const { roomId, playerId, cashierId } = req.body;
    if (!roomId || !playerId || !cashierId) {
      return res
        .status(400)
        .json({ message: "roomId, playerId, and cashierId are required." });
    }

    const room = await GameRoom.findOne({ roomId, gameType: "user" });
    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    // Verify cashier owns this room
    if (String(room.hostUserId) !== String(cashierId)) {
      return res
        .status(403)
        .json({ message: "Only the cashier can approve players." });
    }

    const playerObjId = new mongoose.Types.ObjectId(playerId);
    const playerIdStr = String(playerId);

    // Check if player is in pending list
    const pendingIndex = room.pendingPlayers?.findIndex((p) =>
      p.equals ? p.equals(playerObjId) : String(p) === playerIdStr
    );

    if (pendingIndex === -1 || pendingIndex === undefined) {
      return res
        .status(404)
        .json({ message: "Player not found in pending list." });
    }

    // Check if room is full
    if (room.players.length >= room.max_players) {
      return res.status(403).json({ message: "Room is full." });
    }

    // Get the number of cartelas this player requested (default to 1)
    const requestedCartelas = room.playerCartelaRequests?.[playerIdStr] || 1;

    // Move from pending to approved
    room.pendingPlayers.splice(pendingIndex, 1);
    room.players.push(playerObjId);

    // Transfer cartela count from requests to approved
    if (!room.approvedPlayerCartelas) room.approvedPlayerCartelas = {};
    room.approvedPlayerCartelas[playerIdStr] = requestedCartelas;
    room.markModified('approvedPlayerCartelas');

    // Clean up the request entry
    if (room.playerCartelaRequests && room.playerCartelaRequests[playerIdStr]) {
      delete room.playerCartelaRequests[playerIdStr];
      room.markModified('playerCartelaRequests');
    }

    await room.save();

    const updatedRoom = await GameRoom.findById(room._id)
      .populate("players")
      .populate("pendingPlayers");

    res.json({
      message: "Player approved.",
      room: updatedRoom,
      players: await hydratePlayerSummaries(updatedRoom.players || []),
      pendingPlayers: await hydratePlayerSummaries(
        updatedRoom.pendingPlayers || []
      ),
      approvedCartelas: requestedCartelas,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Reject a player (cashier only)
export const rejectPlayer = async (req, res) => {
  try {
    const { roomId, playerId, cashierId } = req.body;
    if (!roomId || !playerId || !cashierId) {
      return res
        .status(400)
        .json({ message: "roomId, playerId, and cashierId are required." });
    }

    const room = await GameRoom.findOne({ roomId, gameType: "user" });
    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    // Verify cashier owns this room
    if (String(room.hostUserId) !== String(cashierId)) {
      return res
        .status(403)
        .json({ message: "Only the cashier can reject players." });
    }

    const playerObjId = new mongoose.Types.ObjectId(playerId);
    const playerIdStr = String(playerId);

    // Check if player is in pending list
    const pendingIndex = room.pendingPlayers?.findIndex((p) =>
      p.equals ? p.equals(playerObjId) : String(p) === playerIdStr
    );

    if (pendingIndex === -1 || pendingIndex === undefined) {
      return res
        .status(404)
        .json({ message: "Player not found in pending list." });
    }

    // Move from pending to rejected
    room.pendingPlayers.splice(pendingIndex, 1);
    if (!room.rejectedPlayers) room.rejectedPlayers = [];
    room.rejectedPlayers.push(playerObjId);
    await room.save();

    const updatedRoom = await GameRoom.findById(room._id).populate(
      "pendingPlayers"
    );

    res.json({
      message: "Player rejected.",
      room: updatedRoom,
      pendingPlayers: await hydratePlayerSummaries(
        updatedRoom.pendingPlayers || []
      ),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get pending players for a room (cashier only)
export const getPendingPlayers = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await GameRoom.findOne({ roomId, gameType: "user" })
      .populate("pendingPlayers")
      .populate("players");

    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    // Hydrate pending players with their cartela request counts
    const pendingPlayersHydrated = await hydratePlayerSummaries(room.pendingPlayers || []);
    const pendingWithCartelas = pendingPlayersHydrated.map(player => ({
      ...player,
      requestedCartelas: room.playerCartelaRequests?.[String(player._id)] || 1,
      expectedPayment: (room.playerCartelaRequests?.[String(player._id)] || 1) * room.stake,
    }));

    res.json({
      pendingPlayers: pendingWithCartelas,
      players: await hydratePlayerSummaries(room.players || []),
      playerCartelaRequests: room.playerCartelaRequests || {},
      room: {
        roomId: room.roomId,
        stake: room.stake,
        max_players: room.max_players,
        gameStatus: room.gameStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Check player's approval status
export const checkApprovalStatus = async (req, res) => {
  try {
    const { roomId, userId } = req.params;

    const room = await GameRoom.findOne({ roomId, gameType: "user" });
    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    const userIdStr = String(userId);

    // Check if approved
    const isApproved = room.players.some((p) => String(p) === userIdStr);
    if (isApproved) {
      return res.json({ status: "approved" });
    }

    // Check if pending
    const isPending = room.pendingPlayers?.some((p) => String(p) === userIdStr);
    if (isPending) {
      return res.json({ status: "pending" });
    }

    // Check if rejected
    const isRejected = room.rejectedPlayers?.some(
      (p) => String(p) === userIdStr
    );
    if (isRejected) {
      return res.json({ status: "rejected" });
    }

    return res.json({ status: "not_found" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getUserRoomById = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await GameRoom.findOne({ roomId, gameType: "user" })
      .populate("hostUserId")
      .populate("players");
    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }
    const roomObject = room.toObject();
    roomObject.players = await hydratePlayerSummaries(roomObject.players || []);
    
    // Debug log to verify approvedPlayerCartelas is present
    console.log(`[getUserRoomById] Room ${roomId} approvedPlayerCartelas:`, roomObject.approvedPlayerCartelas);
    
    res.json({ room: roomObject });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
