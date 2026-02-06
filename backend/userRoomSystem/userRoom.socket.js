import mongoose from "mongoose";
import { Server } from "socket.io";
import GameRoom from "../model/gameRooms.js";
import { checkWinningPattern } from "../utils/patternChecker.js";
import { bingoCards } from "../utils/bingoCards.js";
import GameHistory from "../model/gameHistory.js";
import { hydratePlayerSummaries } from "./utils/playerHelpers.js";
import Wallet from "../model/wallet.js";
import WalletTransaction from "../model/walletTransaction.js";
import Revenue from "../model/revenue.js";
import { awardGamePoints } from "../utils/points.js";
import { checkDailyStreak } from "../utils/streak.js";
import { logGameWin } from "../utils/walletTransaction.js";
import {
  atomicDeductBalanceAndBonus,
  logGameStartTransactions,
} from "../utils/walletOperations.js";
import GameInvitation from "../model/gameInvitation.js";
import CashierSubscription from "../model/cashierSubscription.js";
import BonusConfig from "../model/bonusConfig.js";
import User from "../model/user.js";

const GAME_START_COUNTDOWN = 10;

// In-memory storage for selected cartelas per room
// Structure: { roomId: { cartelaId: { userId, userName }, ... }, ... }
const roomCartelas = new Map();

// In-memory storage for called numbers and intervals per room (user-hosted games)
const calledNumbersByUserRoom = {};
const calledNumbersIntervalByUserRoom = {};

// In-memory storage for game start countdowns per room
// Structure: { roomId: { interval, roomId } }
const gameStartCountdowns = new Map();

// In-memory tracking of restart sessions per room
// Structure: { stayUserIds: Set<string>, timeoutId: NodeJS.Timeout, hostUserId: string }
const restartSessionsByRoom = new Map();

// In-memory storage for paused rooms
const pausedRooms = new Set();

// In-memory storage for room calling speeds
const roomCallingSpeeds = new Map();

/**
 * Record win-cut revenue, deduct from cashier wallet, and log stake transactions for a user-hosted room on game start.
 * Note: Stake is now debited per cartela selection; this logs the transactions only.
 * Win cut is deducted from the cashier's wallet.
 */
async function debitStakeForUserRoomPlayers(room) {
  try {
    const stake = Number(room?.stake || 0);
    if (stake <= 0) return;

    const roomKey = room?.roomId || String(room?._id || "");
    const cashierId = String(room?.hostUserId || room?.cashierId || "");

    // Get selected cartelas - prefer in-memory, fallback to DB
    let selectedCartelas =
      roomCartelas.get(roomKey) || room?.selectedCartelas || {};
    let totalSelected = Object.keys(selectedCartelas).length;

    if (!totalSelected || totalSelected < 0) totalSelected = 0;
    const pot = stake * totalSelected;
    if (pot <= 0) return;

    // Calculate win cut amount using the cashier's personal winCut percentage
    let winCutPercent = 10; // Default 10%
    if (cashierId) {
      try {
        const cashierUser = await User.findById(cashierId);
        if (cashierUser && cashierUser.winCut !== undefined && cashierUser.winCut !== null) {
          winCutPercent = Number(cashierUser.winCut);
        }
      } catch (userErr) {
        console.error("[winCut] Failed to fetch cashier winCut:", userErr.message);
      }
    }
    const winCutAmount = Math.max(0, (pot * winCutPercent) / 100);

    // Deduct win cut from cashier's wallet
    if (winCutAmount > 0 && cashierId) {
      try {
        const deductResult = await atomicDeductBalanceAndBonus(
          cashierId,
          winCutAmount,
          "WIN_CUT",
          {
            roomId: roomKey,
            gameType: "user",
            pot,
            winCutPercent,
            totalCartelas: totalSelected,
          }
        );

        if (deductResult.success) {
          console.log(
            `💰 [winCut] Deducted ${winCutAmount} birr from cashier ${cashierId} for room ${roomKey}`
          );
        } else {
          console.error(
            `❌ [winCut] Failed to deduct from cashier: ${deductResult.error}`
          );
        }
      } catch (walletErr) {
        console.error(
          "[winCut] Failed to deduct from cashier wallet:",
          walletErr.message
        );
      }
    }

    // Record user-game win cut revenue once per room at game start
    try {
      if (roomKey) {
        const existingRevenue = await Revenue.findOne({
          gameRoom: roomKey,
          reason: "user_game_win_cut",
        });
        if (!existingRevenue) {
          await Revenue.create({
            amount: winCutAmount,
            gameRoom: roomKey,
            stake: stake,
            players: room?.players || [],
            winner: null,
            reason: "user_game_win_cut",
          });
        }
      }
    } catch (revErr) {
      console.error(
        "[revenue] Failed to create user-game win-cut revenue:",
        revErr.message
      );
    }

    // Log stake transactions at game start
    try {
      const stakeDeductions = [];

      for (const [cartelaId, selection] of Object.entries(selectedCartelas)) {
        stakeDeductions.push({
          userId: selection.userId,
          stake: selection.stake || stake,
          cartelaId,
          deductedFromBalance:
            selection.deductedFromBalance || selection.stake || stake,
          deductedFromBonus: selection.deductedFromBonus || 0,
        });
      }

      if (stakeDeductions.length > 0) {
        const txResult = await logGameStartTransactions(
          stakeDeductions,
          roomKey,
          "user"
        );
        console.log(
          `💰 [userRoom] Logged ${txResult.logged} stake transactions for room ${roomKey}`
        );
      }
    } catch (txErr) {
      console.error(
        "[userRoom] Failed to log stake transactions:",
        txErr.message
      );
    }
  } catch (e) {
    console.error("[wallet] debitStakeForUserRoomPlayers error:", e.message);
  }
}

/**
 * Credit the winner's wallet for a user-hosted room.
 * Use prize = stake * (players - 1).
 */
async function creditPrizeToUserWinner(userId, amount, roomId = null) {
  try {
    if (!userId || typeof amount !== "number" || amount <= 0) return;
    let wallet = await Wallet.findOne({ user: String(userId) });
    if (wallet) {
      wallet.balance = (wallet.balance || 0) + amount;
      await wallet.save();
    } else {
      wallet = await Wallet.create({
        user: String(userId),
        balance: amount,
        bonus: 0,
      });
    }

    // Log wallet transaction (this will also update leaderboard stats)
    try {
      await logGameWin(userId, amount, roomId, "user");
    } catch (txErr) {
      console.error(
        "[walletTransaction] Failed to log user win:",
        txErr.message
      );
    }
  } catch (e) {
    console.error(
      `[wallet] Failed to credit prize for winner ${userId}:`,
      e.message
    );
  }
}

export default function initUserRoomSocket(io) {
  const userRoomNamespace = io.of("/user-rooms");
  userRoomNamespace.on("connection", (socket) => {
    // Subscribe to cashier invitation room (for receiving game invitations)
    socket.on("subscribe-to-cashier", async ({ cashierId, userId }) => {
      if (!cashierId || !userId) return;
      const cashierRoom = `cashier-${cashierId}`;
      socket.join(cashierRoom);
      socket.data = socket.data || {};
      socket.data.userId = userId;
      socket.data.subscribedCashiers = socket.data.subscribedCashiers || [];
      if (!socket.data.subscribedCashiers.includes(cashierId)) {
        socket.data.subscribedCashiers.push(cashierId);
      }
      console.log(
        `[userRoomSocket] User ${userId} subscribed to cashier ${cashierId}`
      );

      // Send any active invitations for this cashier (only if room is still waiting)
      try {
        const activeInvitations = await GameInvitation.find({
          cashierId,
          status: "active",
        }).sort({ createdAt: -1 });

        // Filter to only include invitations where room is still waiting
        const validInvitations = [];
        for (const invitation of activeInvitations) {
          const room = await GameRoom.findOne({
            roomId: invitation.roomId,
            gameType: "user",
            gameStatus: "waiting",
          });
          if (room) {
            validInvitations.push(invitation);
          } else {
            // Auto-cleanup: mark invitation as expired
            await GameInvitation.findByIdAndUpdate(invitation._id, {
              status: "expired",
            });
          }
        }

        if (validInvitations.length > 0) {
          // Only send the most recent valid invitation (one per cashier)
          socket.emit("active-invitations", {
            invitations: [validInvitations[0]],
          });
        }
      } catch (err) {
        console.error(
          "[userRoomSocket] Error fetching active invitations:",
          err.message
        );
      }
    });

    // Unsubscribe from cashier invitation room
    socket.on("unsubscribe-from-cashier", ({ cashierId }) => {
      if (!cashierId) return;
      const cashierRoom = `cashier-${cashierId}`;
      socket.leave(cashierRoom);
      if (socket.data?.subscribedCashiers) {
        socket.data.subscribedCashiers = socket.data.subscribedCashiers.filter(
          (id) => id !== cashierId
        );
      }
      console.log(
        `[userRoomSocket] Socket unsubscribed from cashier ${cashierId}`
      );
    });

    // Broadcast game invitation to all subscribers of a cashier
    socket.on(
      "broadcast-game-invitation",
      async ({ cashierId, invitation, cashierName }) => {
        if (!cashierId || !invitation) return;
        const cashierRoom = `cashier-${cashierId}`;
        userRoomNamespace.to(cashierRoom).emit("game-invitation", {
          ...invitation,
          cashierName,
          cashierId,
        });
        console.log(
          `[userRoomSocket] Broadcasted game invitation to cashier room ${cashierRoom}`
        );
      }
    );

    // Join approval room (for cashier to see pending players and for players to wait for approval)
    socket.on("join-approval-room", async ({ roomId, userId }) => {
      if (!roomId || !userId) return;
      const approvalRoom = `approval-${roomId}`;
      socket.join(approvalRoom);
      socket.data = socket.data || {};
      socket.data.userId = String(userId);
      socket.data.approvalRoomId = roomId;
      console.log(
        `[userRoomSocket] User ${userId} joined approval room ${approvalRoom}`
      );

      // Fetch and send current pending players
      try {
        const room = await GameRoom.findOne({ roomId, gameType: "user" })
          .populate("pendingPlayers")
          .populate("players");
        if (room) {
          // Hydrate pending players with cartela info
          const pendingPlayersHydrated = await hydratePlayerSummaries(room.pendingPlayers || []);
          const pendingWithCartelas = pendingPlayersHydrated.map(player => ({
            ...player,
            requestedCartelas: room.playerCartelaRequests?.[String(player._id)] || 1,
            expectedPayment: (room.playerCartelaRequests?.[String(player._id)] || 1) * room.stake,
          }));

          socket.emit("approval-room-state", {
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
        }
      } catch (err) {
        console.error(
          "[userRoomSocket] Error fetching approval room state:",
          err.message
        );
      }
    });

    // Cashier cancels the game from approval room
    socket.on("cancel-game", async ({ roomId, cashierId }) => {
      if (!roomId || !cashierId) return;
      const approvalRoom = `approval-${roomId}`;

      try {
        const room = await GameRoom.findOne({ roomId, gameType: "user" });
        if (!room) return;

        // Verify cashier owns this room
        if (String(room.hostUserId) !== String(cashierId)) {
          socket.emit("approval-error", {
            message: "Only the cashier can cancel the game.",
          });
          return;
        }

        // Mark room as cancelled
        room.gameStatus = "cancelled";
        await room.save();

        // Mark invitation as cancelled
        await GameInvitation.updateMany(
          { roomId, status: "active" },
          { status: "cancelled" }
        );

        // Notify all players in approval room that game was cancelled
        userRoomNamespace.to(approvalRoom).emit("game-cancelled", { roomId });

        // Also notify subscribers that the invitation is no longer valid
        const cashierRoom = `cashier-${cashierId}`;
        userRoomNamespace
          .to(cashierRoom)
          .emit("invitation-expired", { roomId });

        console.log(
          `[userRoomSocket] Game ${roomId} cancelled by cashier ${cashierId}`
        );
      } catch (err) {
        console.error("[userRoomSocket] Error cancelling game:", err.message);
        socket.emit("approval-error", { message: err.message });
      }
    });

    // Player requests to join (sends notification to cashier)
    socket.on("request-to-join", async ({ roomId, userId, userName }) => {
      if (!roomId || !userId) return;
      const approvalRoom = `approval-${roomId}`;

      try {
        const room = await GameRoom.findOne({ roomId, gameType: "user" });
        if (!room) {
          socket.emit("join-request-error", { message: "Room not found" });
          return;
        }

        // Add to pending players if not already there
        const userObjId = new mongoose.Types.ObjectId(userId);
        const userIdStr = String(userId);

        const isPending = room.pendingPlayers?.some(
          (p) => String(p) === userIdStr
        );
        const isApproved = room.players.some((p) => String(p) === userIdStr);
        const isRejected = room.rejectedPlayers?.some(
          (p) => String(p) === userIdStr
        );

        if (isApproved) {
          socket.emit("player-approved", { roomId, userId });
          return;
        }

        if (isRejected) {
          socket.emit("player-rejected", { roomId, userId });
          return;
        }

        if (!isPending) {
          if (!room.pendingPlayers) room.pendingPlayers = [];
          room.pendingPlayers.push(userObjId);
          await room.save();
        }

        // Get the number of cartelas this player requested
        const requestedCartelas = room.playerCartelaRequests?.[userIdStr] || 1;
        const expectedPayment = requestedCartelas * room.stake;

        // Notify cashier of new join request with cartela info
        userRoomNamespace.to(approvalRoom).emit("new-join-request", {
          roomId,
          player: { 
            _id: userId, 
            name: userName || "Unknown",
            requestedCartelas,
            expectedPayment,
          },
        });

        // Send updated pending list to approval room with cartela info
        const updatedRoom = await GameRoom.findOne({ roomId, gameType: "user" })
          .populate("pendingPlayers")
          .populate("players");

        // Hydrate pending players with cartela info
        const pendingPlayersHydrated = await hydratePlayerSummaries(updatedRoom.pendingPlayers || []);
        const pendingWithCartelas = pendingPlayersHydrated.map(player => ({
          ...player,
          requestedCartelas: updatedRoom.playerCartelaRequests?.[String(player._id)] || 1,
          expectedPayment: (updatedRoom.playerCartelaRequests?.[String(player._id)] || 1) * updatedRoom.stake,
        }));

        userRoomNamespace.to(approvalRoom).emit("pending-players-update", {
          pendingPlayers: pendingWithCartelas,
          players: await hydratePlayerSummaries(updatedRoom.players || []),
          playerCartelaRequests: updatedRoom.playerCartelaRequests || {},
        });

        console.log(
          `[userRoomSocket] Player ${userId} requested to join room ${roomId} with ${requestedCartelas} cartelas`
        );
      } catch (err) {
        console.error(
          "[userRoomSocket] Error processing join request:",
          err.message
        );
        socket.emit("join-request-error", { message: err.message });
      }
    });

    // Cashier approves a player
    socket.on("approve-player", async ({ roomId, playerId, cashierId }) => {
      if (!roomId || !playerId || !cashierId) return;
      const approvalRoom = `approval-${roomId}`;

      try {
        const room = await GameRoom.findOne({ roomId, gameType: "user" });
        if (!room) return;

        // Verify cashier owns this room
        if (String(room.hostUserId) !== String(cashierId)) {
          socket.emit("approval-error", {
            message: "Only the cashier can approve players.",
          });
          return;
        }

        const playerObjId = new mongoose.Types.ObjectId(playerId);
        const playerIdStr = String(playerId);

        // Find and remove from pending
        const pendingIndex = room.pendingPlayers?.findIndex(
          (p) => String(p) === playerIdStr
        );
        if (pendingIndex === -1 || pendingIndex === undefined) {
          socket.emit("approval-error", {
            message: "Player not found in pending list.",
          });
          return;
        }

        // Check if room is full
        if (room.players.length >= room.max_players) {
          socket.emit("approval-error", { message: "Room is full." });
          return;
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

        console.log(
          `[userRoomSocket] Player ${playerId} approved for room ${roomId} with ${requestedCartelas} cartelas`
        );

        // Notify the specific player they were approved
        userRoomNamespace
          .to(approvalRoom)
          .emit("player-approved", { roomId, playerId, approvedCartelas: requestedCartelas });

        // Send updated lists to approval room
        const updatedRoom = await GameRoom.findOne({ roomId, gameType: "user" })
          .populate("pendingPlayers")
          .populate("players");

        // Hydrate pending players with cartela info
        const pendingPlayersHydrated = await hydratePlayerSummaries(updatedRoom.pendingPlayers || []);
        const pendingWithCartelas = pendingPlayersHydrated.map(player => ({
          ...player,
          requestedCartelas: updatedRoom.playerCartelaRequests?.[String(player._id)] || 1,
          expectedPayment: (updatedRoom.playerCartelaRequests?.[String(player._id)] || 1) * updatedRoom.stake,
        }));

        userRoomNamespace.to(approvalRoom).emit("pending-players-update", {
          pendingPlayers: pendingWithCartelas,
          players: await hydratePlayerSummaries(updatedRoom.players || []),
        });

      } catch (err) {
        console.error("[userRoomSocket] Error approving player:", err.message);
        socket.emit("approval-error", { message: err.message });
      }
    });

    // Cashier rejects a player
    socket.on("reject-player", async ({ roomId, playerId, cashierId }) => {
      if (!roomId || !playerId || !cashierId) return;
      const approvalRoom = `approval-${roomId}`;

      try {
        const room = await GameRoom.findOne({ roomId, gameType: "user" });
        if (!room) return;

        // Verify cashier owns this room
        if (String(room.hostUserId) !== String(cashierId)) {
          socket.emit("approval-error", {
            message: "Only the cashier can reject players.",
          });
          return;
        }

        const playerObjId = new mongoose.Types.ObjectId(playerId);
        const playerIdStr = String(playerId);

        // Find and remove from pending
        const pendingIndex = room.pendingPlayers?.findIndex(
          (p) => String(p) === playerIdStr
        );
        if (pendingIndex === -1 || pendingIndex === undefined) {
          socket.emit("approval-error", {
            message: "Player not found in pending list.",
          });
          return;
        }

        // Move from pending to rejected
        room.pendingPlayers.splice(pendingIndex, 1);
        if (!room.rejectedPlayers) room.rejectedPlayers = [];
        room.rejectedPlayers.push(playerObjId);
        await room.save();

        // Notify the specific player they were rejected
        userRoomNamespace
          .to(approvalRoom)
          .emit("player-rejected", { roomId, playerId });

        // Send updated lists to approval room
        const updatedRoom = await GameRoom.findOne({ roomId, gameType: "user" })
          .populate("pendingPlayers")
          .populate("players");

        userRoomNamespace.to(approvalRoom).emit("pending-players-update", {
          pendingPlayers: await hydratePlayerSummaries(
            updatedRoom.pendingPlayers || []
          ),
          players: await hydratePlayerSummaries(updatedRoom.players || []),
        });

        console.log(
          `[userRoomSocket] Player ${playerId} rejected from room ${roomId}`
        );
      } catch (err) {
        console.error("[userRoomSocket] Error rejecting player:", err.message);
        socket.emit("approval-error", { message: err.message });
      }
    });

    // Cashier starts the game (moves everyone to waiting room)
    socket.on("start-approved-game", async ({ roomId, cashierId }) => {
      if (!roomId || !cashierId) return;
      const approvalRoom = `approval-${roomId}`;

      try {
        const room = await GameRoom.findOne({ roomId, gameType: "user" });
        if (!room) return;

        // Verify cashier owns this room
        if (String(room.hostUserId) !== String(cashierId)) {
          socket.emit("approval-error", {
            message: "Only the cashier can start the game.",
          });
          return;
        }

        // Check if there are enough players (cashier is NOT a player)
        if (room.players.length < 1) {
          socket.emit("approval-error", {
            message: "Need at least 1 player to start the game.",
          });
          return;
        }

        // Notify everyone in approval room to move to waiting room
        userRoomNamespace
          .to(approvalRoom)
          .emit("game-approved-start", { roomId });

        console.log(
          `[userRoomSocket] Game ${roomId} approved to start by cashier ${cashierId}`
        );
      } catch (err) {
        console.error(
          "[userRoomSocket] Error starting approved game:",
          err.message
        );
        socket.emit("approval-error", { message: err.message });
      }
    });

    // Join actual socket room for updates
    socket.on("join-waiting-room", async ({ roomId, userId }) => {
      socket.join(roomId);
      // Track identity on the socket for targeted emissions later
      try {
        if (!socket.data) socket.data = {};
        socket.data.userId = userId ? String(userId) : undefined;
        socket.data.roomId = roomId;
      } catch {}
      // Emit current player list for frontend sync
      const room = await GameRoom.findOne({
        roomId,
        gameType: "user",
      }).populate("players");
      if (room) {
        // Load selectedCartelas from database into memory
        if (
          room.selectedCartelas &&
          Object.keys(room.selectedCartelas).length > 0
        ) {
          roomCartelas.set(roomId, room.selectedCartelas);
        }

        userRoomNamespace.to(roomId).emit("player-joined", {
          players: await hydratePlayerSummaries(room.players || []),
        });

        // Streak check on joining a game
        try {
          const streakResult = await checkDailyStreak(userId);
          if (streakResult?.rewarded) {
            socket.emit("streak:bonus", {
              bonusPoints: streakResult.bonusPoints,
              target: streakResult.target,
              spinsAwarded: streakResult.spinsAwarded,
            });
          }
        } catch (streakErr) {
          console.error(
            "[streak] check error (user room join):",
            streakErr.message
          );
        }

        // Emit current cartelas state if available
        const cartelasState = roomCartelas.get(roomId) || {};
        if (Object.keys(cartelasState).length > 0) {
          socket.emit("cartelas-state", {
            allCartelas: cartelasState,
          });
        }
      }
    });

    // Triggered from REST after joinUserRoom, used to emit fresh data
    socket.on("player-joined-sync", async ({ roomId }) => {
      socket.join(roomId);
      const room = await GameRoom.findOne({
        roomId,
        gameType: "user",
      }).populate("players");
      if (room) {
        // Load selectedCartelas from database into memory
        if (
          room.selectedCartelas &&
          Object.keys(room.selectedCartelas).length > 0
        ) {
          roomCartelas.set(roomId, room.selectedCartelas);
        }

        userRoomNamespace.to(roomId).emit("player-joined", {
          players: await hydratePlayerSummaries(room.players || []),
        });

        // Emit current cartelas state if available
        const cartelasState = roomCartelas.get(roomId) || {};
        if (Object.keys(cartelasState).length > 0) {
          socket.emit("cartelas-state", {
            allCartelas: cartelasState,
          });
        }

        // If game is playing, send current called numbers
        if (room.gameStatus === "playing") {
          const numbers = calledNumbersByUserRoom[roomId] || [];
          socket.emit("calledNumbersUpdate", {
            roomId,
            calledNumbersCount: numbers.length,
            numbersList: numbers,
          });
        }
      }
    });

    // Join playing room (when navigating to playing screen)
    socket.on("join-playing-room", async ({ roomId, userId }) => {
      socket.join(roomId);
      // Track identity on the socket for targeted emissions later
      try {
        if (!socket.data) socket.data = {};
        socket.data.userId = userId ? String(userId) : undefined;
        socket.data.roomId = roomId;
      } catch {}

      const room = await GameRoom.findOne({
        roomId,
        gameType: "user",
      }).populate("players");

      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      // Load selectedCartelas from database
      if (
        room.selectedCartelas &&
        Object.keys(room.selectedCartelas).length > 0
      ) {
        roomCartelas.set(roomId, room.selectedCartelas);
      }

      // Send current state
      const cartelasState = roomCartelas.get(roomId) || {};
      socket.emit("cartelas-state", {
        allCartelas: cartelasState,
      });

      // Streak check when entering playing room directly
      try {
        const streakResult = await checkDailyStreak(userId);
        if (streakResult?.rewarded) {
          socket.emit("streak:bonus", {
            bonusPoints: streakResult.bonusPoints,
            target: streakResult.target,
            spinsAwarded: streakResult.spinsAwarded,
          });
        }
      } catch (streakErr) {
        console.error(
          "[streak] check error (user room playing):",
          streakErr.message
        );
      }

      // If game is playing, send current called numbers
      if (room.gameStatus === "playing") {
        const numbers = calledNumbersByUserRoom[roomId] || [];
        socket.emit("calledNumbersUpdate", {
          roomId,
          calledNumbersCount: numbers.length,
          numbersList: numbers,
        });
      }
    });

    // Handle starting the game (host) - starts 5 second countdown
    socket.on("start-game", async ({ roomId, userId }) => {
      if (!roomId || !userId) return;
      const room = await GameRoom.findOne({ roomId, gameType: "user" });
      if (!room) return;
      if (String(room.hostUserId) !== String(userId)) return;

      // Check if players count is at least 1 (cashier is NOT a player)
      if (!room.players || room.players.length < 1) {
        socket.emit("error", {
          message: "At least 1 player is required to start the game",
        });
        return;
      }

      // Validate cashier has enough funds for win cut before starting
      try {
        const selectedCartelas =
          roomCartelas.get(roomId) || room.selectedCartelas || {};
        const totalSelected = Object.keys(selectedCartelas).length;

        if (totalSelected > 0) {
          const pot = room.stake * totalSelected;
          
          // Get cashier's personal winCut percentage
          let winCutPercent = 10; // Default 10%
          try {
            const cashierUser = await User.findById(room.hostUserId);
            if (cashierUser && cashierUser.winCut !== undefined && cashierUser.winCut !== null) {
              winCutPercent = Number(cashierUser.winCut);
            }
          } catch (userErr) {
            console.error("[start-game] Failed to fetch cashier winCut:", userErr.message);
          }
          
          const winCutAmount = Math.ceil((pot * winCutPercent) / 100);

          const cashierWallet = await Wallet.findOne({
            user: String(room.hostUserId),
          });
          const cashierBalance =
            Number(cashierWallet?.balance || 0) +
            Number(cashierWallet?.bonus || 0);

          if (cashierBalance < winCutAmount) {
            socket.emit("error", {
              message: `Insufficient wallet balance to cover win cut. Required: ${winCutAmount} birr (${winCutPercent}% of ${pot} birr pot). Current balance: ${cashierBalance} birr.`,
              type: "insufficient_funds",
              data: {
                required: winCutAmount,
                current: cashierBalance,
                pot,
                winCutPercent,
              },
            });
            return;
          }
        }
      } catch (walletCheckErr) {
        console.error(
          "[start-game] Error checking cashier wallet:",
          walletCheckErr.message
        );
        socket.emit("error", {
          message: "Failed to verify cashier wallet balance",
        });
        return;
      }

      // Check if countdown is already running
      if (gameStartCountdowns.has(roomId)) {
        console.log(`Countdown already running for room ${roomId}`);
        return;
      }

      console.log(
        `⏰ Starting ${GAME_START_COUNTDOWN}-second countdown for room ${roomId}`
      );

      let secondsLeft = GAME_START_COUNTDOWN;

      // Broadcast initial countdown
      userRoomNamespace.to(roomId).emit("game-start-countdown", {
        roomId,
        seconds: secondsLeft,
      });

      // Track if auto-assignment has been done
      let autoAssigned = false;

      // Countdown interval
      const interval = setInterval(() => {
        secondsLeft--;

        // At 5 seconds, auto-assign cartelas to players who haven't selected any
        if (secondsLeft === 5 && !autoAssigned) {
          autoAssigned = true;
          GameRoom.findOne({ roomId, gameType: "user" })
            .populate("players")
            .then(async (room) => {
              if (!room) return;

              // Get current cartela selections
              const roomCartelasObj = roomCartelas.get(roomId) || {};
              const takenCartelaIds = new Set(
                Object.keys(roomCartelasObj).map(Number)
              );

              // Find available cartela numbers (1-150)
              const allCartelaIds = Array.from(
                { length: 150 },
                (_, i) => i + 1
              );
              const availableCartelas = allCartelaIds.filter(
                (id) => !takenCartelaIds.has(id)
              );

              // Find players without any cartelas selected
              const playersWithoutCartelas = room.players.filter((player) => {
                const playerId = String(player._id || player.id || player);
                const hasCartelas = Object.values(roomCartelasObj).some(
                  (cartela) => String(cartela.userId) === playerId
                );
                return !hasCartelas;
              });

              console.log(
                `🔒 Auto-assigning cartelas to ${playersWithoutCartelas.length} player(s)`
              );

              // Auto-assign available cartelas to players without any (randomly)
              const assignments = [];
              for (const player of playersWithoutCartelas) {
                if (availableCartelas.length === 0) break;

                const playerId = String(player._id || player.id || player);
                const playerName =
                  player.name || player.phoneNumber || playerId;

                // Randomly select from available cartelas
                const randomIndex = Math.floor(
                  Math.random() * availableCartelas.length
                );
                const assignedCartelaId = availableCartelas.splice(
                  randomIndex,
                  1
                )[0];

                // Add to in-memory storage
                if (!roomCartelas.has(roomId)) {
                  roomCartelas.set(roomId, {});
                }
                const currentCartelas = roomCartelas.get(roomId);
                currentCartelas[assignedCartelaId] = {
                  userId: playerId,
                  userName: playerName,
                };

                // Update database
                await GameRoom.findByIdAndUpdate(room._id, {
                  $set: { selectedCartelas: currentCartelas },
                });

                assignments.push({
                  userId: playerId,
                  cartelaId: assignedCartelaId,
                });

                console.log(
                  `✅ Auto-assigned cartela #${assignedCartelaId} to ${playerName}`
                );
              }

              // Broadcast assignments and lock selection
              if (assignments.length > 0) {
                const updatedCartelas = roomCartelas.get(roomId);
                userRoomNamespace.to(roomId).emit("cartelas-auto-assigned", {
                  roomId,
                  assignments,
                  allCartelas: updatedCartelas,
                });

                // Emit lock event for players who were auto-assigned
                userRoomNamespace.to(roomId).emit("cartela-selection-locked", {
                  roomId,
                  lockedPlayerIds: assignments.map((a) => a.userId),
                });
              }
            })
            .catch((err) => {
              console.error("Error auto-assigning cartelas:", err);
            });
        }

        if (secondsLeft <= 0) {
          // Countdown finished, start the game
          clearInterval(interval);
          gameStartCountdowns.delete(roomId);

          // Start the game
          GameRoom.findOne({ roomId, gameType: "user" })
            .then(async (room) => {
              if (!room) return;

              // Double-check player count before starting (cashier is NOT a player)
              if (room.players && room.players.length >= 1) {
                room.gameStatus = "playing";
                await room.save();

                // Mark invitation as started
                try {
                  await GameInvitation.findOneAndUpdate(
                    { roomId, status: "active" },
                    { status: "started", startedAt: new Date() }
                  );
                  // Notify subscribers that the invitation has expired
                  if (room.cashierId) {
                    const cashierRoom = `cashier-${room.cashierId}`;
                    userRoomNamespace
                      .to(cashierRoom)
                      .emit("invitation-expired", { roomId });
                  }
                } catch (invErr) {
                  console.error(
                    "[userRoomSocket] Error updating invitation status:",
                    invErr.message
                  );
                }

                // Record history for game start (playing)
                try {
                  const exists = await GameHistory.findOne({
                    roomId: room._id,
                    gameType: "user",
                    gameStatus: "playing",
                  });
                  if (!exists) {
                    // Debit stake from all non-host players' wallets
                    try {
                      await debitStakeForUserRoomPlayers(room);
                    } catch (walletErr) {
                      console.error(
                        "[wallet] Stake debit error (user room playing):",
                        walletErr.message
                      );
                    }
                    await GameHistory.create({
                      roomId: room._id,
                      gameType: "user",
                      players: room.players,
                      winner: null,
                      hostUserId: room.hostUserId,
                      stake: room.stake,
                      gameStatus: "playing",
                      max_players: room.max_players,
                    });
                  }
                } catch (err) {
                  console.error(
                    "[userRoomSocket] Game history (playing) save error:",
                    err.message
                  );
                }

                userRoomNamespace.to(roomId).emit("game-started", { roomId });

                // Start number calling automatically when game starts
                startNumberCallingInterval(userRoomNamespace, roomId);
                console.log(`✅ Game started for room ${roomId}`);
              } else {
                console.log(
                  `❌ Cannot start game: only ${
                    room.players?.length || 0
                  } player(s)`
                );
                userRoomNamespace.to(roomId).emit("game-start-cancelled", {
                  roomId,
                  reason: "Not enough players",
                });
              }
            })
            .catch((err) => {
              console.error("Error starting game:", err);
              gameStartCountdowns.delete(roomId);
            });
        } else {
          // Broadcast countdown update
          userRoomNamespace.to(roomId).emit("game-start-countdown", {
            roomId,
            seconds: secondsLeft,
          });
        }
      }, 1000);

      // Store countdown reference
      gameStartCountdowns.set(roomId, {
        interval,
        roomId,
      });
    });

    // Handle cartela selection (IN-MEMORY approach with atomic transactions)
    socket.on("select-cartela", async ({ roomId, userId, cartelaId }) => {
      if (!roomId || !userId || !cartelaId) return;

      console.log(`\n=== SELECT CARTELA (IN-MEMORY) ===`);
      console.log(
        `RoomId: ${roomId}, UserId: ${userId}, CartelaId: ${cartelaId}`
      );

      try {
        // Get player info from database (for username)
        const room = await GameRoom.findOne({
          roomId,
          gameType: "user",
        }).populate("players");
        if (!room) {
          console.log("Room not found");
          return;
        }

        // Prevent cashier from selecting cartelas (cashier is host, not a player)
        if (String(room.hostUserId) === String(userId)) {
          console.log(`Cashier ${userId} cannot select cartelas`);
          socket.emit("cartela-selection-error", {
            message: "Cashier cannot select cartelas",
            cartelaId,
          });
          return;
        }

        // Find player to get their name
        console.log(`Looking for player ${userId} in room.players:`, room.players?.map(p => ({
          _id: p?._id?.toString?.() || p?._id,
          id: p?.id,
          userId: p?.userId,
          name: p?.name,
          username: p?.username,
          phoneNumber: p?.phoneNumber,
          raw: typeof p === 'string' ? p : 'object'
        })));
        
        const player = room.players.find(
          (p) => {
            const playerId = String(p?._id || p?.id || p?.userId || p);
            return playerId === String(userId);
          }
        );
        
        // Get the best display name available
        let userName;
        if (player) {
          userName = player.name || player.username || player.phoneNumber || player.email;
          console.log(`Found player in room.players: ${userName}`);
        }
        
        // If still no name, try to fetch from User collection
        if (!userName) {
          try {
            const userDoc = await User.findById(userId);
            if (userDoc) {
              userName = userDoc.name || userDoc.username || userDoc.phoneNumber || userDoc.email;
              console.log(`Found player in User collection: ${userName}`);
            }
          } catch (userErr) {
            console.log(`Could not fetch user from DB: ${userErr.message}`);
          }
        }
        
        // Final fallback
        if (!userName) {
          userName = `Player ${String(userId).slice(-4)}`;
          console.log(`Using fallback name: ${userName}`);
        }
        
        console.log(`Final player name: ${userName}`);

        // Initialize room cartelas if needed
        if (!roomCartelas.has(roomId)) {
          roomCartelas.set(roomId, {});
          console.log(`Initialized cartelas storage for room ${roomId}`);
        }

        const roomCartelasObj = roomCartelas.get(roomId);
        console.log("Current room cartelas:", Object.keys(roomCartelasObj));

        // Get the player's approved cartela limit (default to 1 if not set)
        const approvedLimit = room.approvedPlayerCartelas?.[String(userId)] || 1;

        // Enforce the player's approved cartela limit
        const myCount = Object.values(roomCartelasObj).filter(
          (c) => String(c.userId) === String(userId)
        ).length;
        if (myCount >= approvedLimit) {
          socket.emit("cartela-selection-error", {
            message: `You can only select up to ${approvedLimit} cartela${approvedLimit > 1 ? 's' : ''} (based on your payment)`,
            cartelaId,
          });
          return;
        }

        // Check if cartela is already taken
        if (roomCartelasObj[cartelaId]) {
          const takenBy = roomCartelasObj[cartelaId];
          if (takenBy.userId !== userId) {
            console.log(
              `Cartela ${cartelaId} already taken by ${takenBy.userName}`
            );
            socket.emit("cartela-selection-error", {
              message: `This cartela is already selected by ${takenBy.userName}`,
              cartelaId,
            });
            return;
          } else {
            console.log(
              `Cartela ${cartelaId} already selected by this user, ignoring`
            );
            return;
          }
        }

        const stake = Number(room.stake || 0);

        // For cashier-hosted games (gameType: "user"), skip wallet deduction
        // Payment is handled offline/in-person by the cashier
        // This allows local players (stored in localStorage) to select cards without a wallet
        if (room.gameType === "user") {
          // Add cartela to in-memory storage (no wallet deduction needed)
          roomCartelasObj[cartelaId] = {
            userId,
            userName,
            stake,
            deductedFromBalance: 0,
            deductedFromBonus: 0,
          };

          // Update database with selected cartelas
          await GameRoom.findByIdAndUpdate(room._id, {
            $set: { selectedCartelas: roomCartelasObj },
          });

          console.log(
            `✅ Added cartela ${cartelaId} for user ${userName} (cashier game - no wallet deduction)`
          );
          console.log(
            `Total cartelas in room:`,
            Object.keys(roomCartelasObj).length
          );

          // Broadcast to all players in the room
          userRoomNamespace.to(roomId).emit("cartela-selected", {
            userId,
            cartelaId,
            allCartelas: roomCartelasObj,
            balanceAfter: null,
            bonusAfter: null,
          });

          console.log(`✅ Broadcasted to room ${roomId}`);
          console.log(`=== SELECT CARTELA END (CASHIER GAME) ===\n`);
          return;
        }

        // For system games with stake, use MongoDB transaction for atomicity and rollback support
        const session = await mongoose.startSession();

        try {
          session.startTransaction();

          // Atomic balance+bonus deduction with race condition protection
          // Transaction logging is SKIPPED - will be logged when game starts
          const deductResult = await atomicDeductBalanceAndBonus(
            userId,
            stake,
            "GAME_STAKE",
            { roomId, gameType: "user", stake, cartelaId },
            { session, skipTransactionLog: true }
          );

          if (!deductResult.success) {
            await session.abortTransaction();
            session.endSession();

            const errorMessage =
              deductResult.error === "insufficient_balance"
                ? "Insufficient balance to select this cartela"
                : deductResult.error === "wallet_not_found"
                ? "Wallet not found. Please contact support."
                : "Wallet error. Please try again";

            socket.emit("cartela-selection-error", {
              message: errorMessage,
              cartelaId,
            });
            return;
          }

          // Add cartela to in-memory storage with deduction details for game start logging
          roomCartelasObj[cartelaId] = {
            userId,
            userName,
            stake,
            deductedFromBalance: deductResult.deductedFromBalance,
            deductedFromBonus: deductResult.deductedFromBonus,
          };

          // Update database with selected cartelas within the same transaction
          await GameRoom.findByIdAndUpdate(
            room._id,
            { $set: { selectedCartelas: roomCartelasObj } },
            { session }
          );

          // Commit the transaction
          await session.commitTransaction();
          session.endSession();

          console.log(`✅ Added cartela ${cartelaId} for user ${userName}`);
          console.log(
            `Total cartelas in room:`,
            Object.keys(roomCartelasObj).length
          );
          console.log("All cartelas:", roomCartelasObj);

          // Broadcast to all players in the room
          userRoomNamespace.to(roomId).emit("cartela-selected", {
            userId,
            cartelaId,
            allCartelas: roomCartelasObj,
            balanceAfter: deductResult.balanceAfter,
            bonusAfter: deductResult.bonusAfter,
          });

          console.log(`✅ Broadcasted to room ${roomId}`);
          console.log(`=== SELECT CARTELA END ===\n`);
        } catch (txError) {
          // Rollback on any error - wallet deduction will be reverted
          await session.abortTransaction();
          session.endSession();

          // Revert in-memory state
          delete roomCartelasObj[cartelaId];

          console.error(
            "[select-cartela] Transaction failed, rolled back:",
            txError.message
          );
          socket.emit("cartela-selection-error", {
            message: "Transaction failed. Please try again",
            cartelaId,
          });
        }
      } catch (error) {
        console.error("Error selecting cartela:", error);
        socket.emit("cartela-selection-error", {
          message: "Failed to select cartela",
        });
      }
    });

    // Handle cartela deselection (IN-MEMORY approach with proper refund logging)
    socket.on("deselect-cartela", async ({ roomId, userId, cartelaId }) => {
      if (!roomId || !userId || !cartelaId) return;

      console.log(`\n=== DESELECT CARTELA (IN-MEMORY) ===`);
      console.log(
        `RoomId: ${roomId}, UserId: ${userId}, CartelaId: ${cartelaId}`
      );

      try {
        if (!roomCartelas.has(roomId)) {
          console.log("No cartelas found for this room");
          return;
        }

        const roomCartelasObj = roomCartelas.get(roomId);

        // Check if cartela exists and belongs to this user
        if (roomCartelasObj[cartelaId]) {
          if (roomCartelasObj[cartelaId].userId === userId) {
            const room = await GameRoom.findOne({ roomId, gameType: "user" });

            // For cashier games (gameType: "user"), no refund needed since we didn't deduct from wallet
            // Payment is handled offline by the cashier
            // Note: This handler is specifically for user-rooms namespace, so we skip wallet refunds
            console.log(
              `Cartela ${cartelaId} deselected (cashier game - no refund needed)`
            );

            delete roomCartelasObj[cartelaId];
            console.log(`✅ Removed cartela ${cartelaId}`);
            console.log(
              `Remaining cartelas:`,
              Object.keys(roomCartelasObj).length
            );

            // Update database with selected cartelas
            if (room) {
              await GameRoom.findByIdAndUpdate(room._id, {
                $set: { selectedCartelas: roomCartelasObj },
              });
            }

            // Broadcast to all players in the room
            userRoomNamespace.to(roomId).emit("cartela-deselected", {
              userId,
              cartelaId,
              allCartelas: roomCartelasObj,
              refunded: false,
              balanceAfter: null,
            });

            console.log(`✅ Broadcasted deselection to room ${roomId}`);
          } else {
            console.log(
              `Cartela ${cartelaId} belongs to another user, cannot deselect`
            );
          }
        } else {
          console.log(`Cartela ${cartelaId} not found in selections`);
        }

        console.log(`=== DESELECT CARTELA END ===\n`);
      } catch (error) {
        console.error("Error deselecting cartela:", error);
      }
    });

    // Request current cartela state
    socket.on("get-cartelas-state", async ({ roomId }) => {
      if (!roomId) return;

      console.log(`\n=== GET CARTELAS STATE (user room) ===`);
      console.log(`RoomId: ${roomId}`);

      try {
        let cartelasState = roomCartelas.get(roomId);

        // Fallback: if not loaded in memory, fetch from database
        if (!cartelasState) {
          const dbRoom = await GameRoom.findOne({ roomId, gameType: "user" });
          if (
            dbRoom &&
            dbRoom.selectedCartelas &&
            Object.keys(dbRoom.selectedCartelas).length > 0
          ) {
            cartelasState = dbRoom.selectedCartelas;
            roomCartelas.set(roomId, cartelasState);
          } else {
            cartelasState = {};
          }
        }
        console.log(`Sending ${Object.keys(cartelasState).length} cartelas`);
        console.log("Cartelas:", cartelasState);

        socket.emit("cartelas-state", {
          allCartelas: cartelasState,
        });
        console.log(`=== GET CARTELAS STATE END ===\n`);
      } catch (error) {
        console.error("Error getting cartelas state (user room):", error);
      }
    });

    // Number calling functionality
    socket.on("start-number-calling", ({ roomId, userId }) => {
      if (!roomId || !userId) return;

      // Only host can manually start number calling
      GameRoom.findOne({ roomId, gameType: "user" })
        .then((room) => {
          if (!room) return;
          if (String(room.hostUserId) !== String(userId)) {
            socket.emit("error", {
              message: "Only host can start number calling",
            });
            return;
          }
          startNumberCallingInterval(userRoomNamespace, roomId);
        })
        .catch((err) => console.error("Error checking room:", err));
    });

    socket.on("stop-number-calling", ({ roomId, userId }) => {
      if (!roomId || !userId) return;

      // Only host can stop number calling
      GameRoom.findOne({ roomId, gameType: "user" })
        .then(async (room) => {
          if (!room) return;
          if (String(room.hostUserId) !== String(userId)) {
            socket.emit("error", {
              message: "Only host can stop number calling",
            });
            return;
          }
          if (calledNumbersIntervalByUserRoom[roomId]) {
            clearInterval(calledNumbersIntervalByUserRoom[roomId]);
            delete calledNumbersIntervalByUserRoom[roomId];
          }

          // Mark game as cancelled and record history
          try {
            if (room.gameStatus !== "finished") {
              room.gameStatus = "cancelled";
              await room.save();

              const cancelledExists = await GameHistory.findOne({
                roomId: room._id,
                gameType: "user",
                gameStatus: "cancelled",
              });
              if (!cancelledExists) {
                const playingHistory = await GameHistory.findOne({
                  roomId: room._id,
                  gameType: "user",
                  gameStatus: "playing",
                });
                if (playingHistory) {
                  playingHistory.gameStatus = "cancelled";
                  await playingHistory.save();
                  console.log(
                    "✅ Game history updated from playing → cancelled"
                  );
                } else {
                  await GameHistory.create({
                    roomId: room._id,
                    gameType: "user",
                    players: room.players,
                    winner: null,
                    hostUserId: room.hostUserId,
                    stake: room.stake,
                    gameStatus: "cancelled",
                    max_players: room.max_players,
                  });
                }
              }

              // Notify clients as a finished game with no winner
              userRoomNamespace.to(roomId).emit("game-finished", {
                roomId,
                winner: { userId: null, userName: "No winner" },
                prize: 0,
              });
            }
          } catch (err) {
            console.error(
              "[userRoomSocket] stop-number-calling finalize error:",
              err.message
            );
          }
        })
        .catch((err) => console.error("Error checking room:", err));
    });

    // Get current called numbers for a room
    socket.on("get-called-numbers", ({ roomId }) => {
      if (!roomId) return;
      const numbers = calledNumbersByUserRoom[roomId] || [];
      socket.emit("calledNumbersUpdate", {
        roomId,
        calledNumbersCount: numbers.length,
        numbersList: numbers,
      });
    });

    // Host requests to restart the finished game
    socket.on("restart-game", async ({ roomId, userId }) => {
      try {
        if (!roomId || !userId) return;
        const room = await GameRoom.findOne({
          roomId,
          gameType: "user",
        }).populate("players");
        if (!room) {
          socket.emit("restart-error", { message: "Room not found" });
          return;
        }
        if (String(room.hostUserId) !== String(userId)) {
          socket.emit("restart-error", {
            message: "Only the host can restart the game.",
          });
          return;
        }
        if (room.gameStatus !== "finished" && room.gameStatus !== "cancelled") {
          socket.emit("restart-error", {
            message: "Game is not finished yet.",
          });
          return;
        }

        // Prevent duplicate restart sessions
        if (restartSessionsByRoom.has(roomId)) {
          socket.emit("restart-error", {
            message: "Restart already in progress.",
          });
          return;
        }

        // 1) Immediately reset core room state to 'waiting' for a fresh round
        //    - Clear number calling and in-memory state
        if (calledNumbersIntervalByUserRoom[roomId]) {
          clearInterval(calledNumbersIntervalByUserRoom[roomId]);
          delete calledNumbersIntervalByUserRoom[roomId];
        }
        delete calledNumbersByUserRoom[roomId];
        roomCartelas.delete(roomId);
        await GameRoom.findOneAndUpdate(
          { roomId, gameType: "user" },
          {
            $set: {
              gameStatus: "waiting",
              winner: null,
              selectedCartelas: {},
            },
          },
          { new: true }
        );

        // 2) Targeted emissions:
        //    - Immediately redirect host to waiting (no modal)
        //    - Ask non-host players to decide (modal)
        try {
          const socketsInRoom = await userRoomNamespace
            .in(roomId)
            .fetchSockets();
          for (const s of socketsInRoom) {
            const sUserId = String(s?.data?.userId || "");
            if (!sUserId) continue;
            if (sUserId === String(userId)) {
              s.emit("game-restarted", { roomId });
            } else {
              s.emit("game-restart-request", { roomId });
            }
          }
        } catch {}

        // Start a short window for players to confirm staying, then finalize restart
        const stayUserIds = new Set();
        const timeoutId = setTimeout(async () => {
          try {
            // Load the latest room and compute who stays
            const latestRoom = await GameRoom.findOne({
              roomId,
              gameType: "user",
            }).populate("players");
            if (!latestRoom) {
              return;
            }

            const hostId = String(latestRoom.hostUserId || "");
            const stake = Number(latestRoom.stake || 0);
            const playersArray = Array.isArray(latestRoom.players)
              ? latestRoom.players
              : [];
            const playerIdToEntry = new Map();
            const allPlayerIds = [];
            for (const p of playersArray) {
              const id = String(p?._id || p?.id || p?.userId || p || "");
              if (id) {
                playerIdToEntry.set(id, p);
                allPlayerIds.push(id);
              }
            }

            // Build sets for decision outcomes
            const approvedStayerIds = new Set();
            const declinedIds = new Set();
            const insufficientIds = new Set();

            // Host always stays (no balance check)
            if (hostId) approvedStayerIds.add(hostId);

            // Evaluate players (excluding host)
            for (const pid of allPlayerIds) {
              if (pid === hostId) continue;
              if (session.stayUserIds.has(pid)) {
                // Balance check for non-host players
                try {
                  const wallet = await Wallet.findOne({ user: pid });
                  const balance = Number(wallet?.balance || 0);
                  if (balance >= stake) {
                    approvedStayerIds.add(pid);
                  } else {
                    insufficientIds.add(pid);
                  }
                } catch {
                  insufficientIds.add(pid);
                }
              } else {
                // Did not confirm "stay" within the window (or chose No)
                declinedIds.add(pid);
              }
            }

            // Compute updated players array preserving original entry types
            const updatedPlayers = [];
            for (const keepId of approvedStayerIds) {
              if (playerIdToEntry.has(keepId)) {
                updatedPlayers.push(playerIdToEntry.get(keepId));
              } else {
                // Fallback if host not in players array for some reason
                if (keepId === hostId) updatedPlayers.push(hostId);
              }
            }

            // Reset room state for a new round and save filtered players
            // (status/winner/cartelas are already reset above; re-assert to be safe)
            latestRoom.gameStatus = "waiting";
            latestRoom.winner = null;
            latestRoom.selectedCartelas = {};
            latestRoom.players = updatedPlayers;
            await latestRoom.save();

            // Broadcast updated players list
            try {
              userRoomNamespace.to(roomId).emit("player-joined", {
                players: await hydratePlayerSummaries(updatedPlayers),
              });
            } catch {}

            // Targeted redirection: only emit to approved stayers (and host)
            try {
              const socketsInRoom = await userRoomNamespace
                .in(roomId)
                .fetchSockets();
              for (const s of socketsInRoom) {
                const sUserId = String(s?.data?.userId || "");
                if (!sUserId) continue;
                if (approvedStayerIds.has(sUserId)) {
                  s.emit("game-restarted", { roomId });
                } else {
                  const reason = declinedIds.has(sUserId)
                    ? "declined"
                    : insufficientIds.has(sUserId)
                    ? "insufficient_balance"
                    : "not_allowed";
                  s.emit("restart-kicked", { roomId, reason });
                  if (reason === "insufficient_balance") {
                    s.emit("restart-error", {
                      message:
                        "Insufficient balance to join the restarted game.",
                    });
                  }
                  try {
                    s.leave(roomId);
                  } catch {}
                }
              }
            } catch {}
          } catch (finalizeErr) {
            console.error(
              "[userRoomSocket] finalize restart error:",
              finalizeErr.message
            );
            socket.emit("restart-error", {
              message: "Failed to finalize restart.",
            });
          } finally {
            restartSessionsByRoom.delete(roomId);
          }
        }, 5000); // 5s window for players to respond

        restartSessionsByRoom.set(roomId, {
          stayUserIds,
          timeoutId,
          hostUserId: String(userId),
        });
      } catch (err) {
        console.error("[userRoomSocket] restart-game error:", err.message);
        socket.emit("restart-error", {
          message: err.message || "Restart failed",
        });
      }
    });

    // Player confirms they want to stay for the restarted game
    socket.on("stay-after-restart", async ({ roomId, userId }) => {
      try {
        if (!roomId || !userId) return;
        const session = restartSessionsByRoom.get(roomId);
        if (!session) return; // No active restart session; ignore
        const pid = String(userId);
        session.stayUserIds.add(pid);

        const room = await GameRoom.findOne({
          roomId,
          gameType: "user",
        }).populate("players");
        if (!room) return;

        const hostId = String(room.hostUserId || "");
        const stake = Number(room.stake || 0);

        // Balance check for non-hosts
        if (pid !== hostId) {
          try {
            const wallet = await Wallet.findOne({ user: pid });
            const balance = Number(wallet?.balance || 0);
            if (balance < stake) {
              socket.emit("restart-kicked", {
                roomId,
                reason: "insufficient_balance",
              });
              socket.emit("restart-error", {
                message: "Insufficient balance to join the restarted game.",
              });
              return;
            }
          } catch {
            socket.emit("restart-kicked", {
              roomId,
              reason: "insufficient_balance",
            });
            socket.emit("restart-error", {
              message: "Insufficient balance to join the restarted game.",
            });
            return;
          }
        }

        // Ensure player is in the room's players list
        const playersArray = Array.isArray(room.players) ? room.players : [];
        const exists = playersArray.some(
          (p) => String(p?._id || p?.id || p?.userId || p) === pid
        );
        if (!exists) {
          room.players = [...playersArray, pid];
          await room.save();
          try {
            userRoomNamespace.to(roomId).emit("player-joined", {
              players: await hydratePlayerSummaries(room.players),
            });
          } catch {}
        }

        // Immediately redirect this player to waiting
        socket.emit("game-restarted", { roomId });
      } catch (err) {
        console.error(
          "[userRoomSocket] stay-after-restart error:",
          err.message
        );
        socket.emit("restart-error", {
          message: err.message || "Failed to confirm restart",
        });
      }
    });

    // Player chooses to leave after a finished game (or declines restart)
    socket.on("leave-game-after-finish", async ({ roomId, userId }) => {
      try {
        if (!roomId || !userId) return;
        const room = await GameRoom.findOne({
          roomId,
          gameType: "user",
        }).populate("players");
        if (!room) return;
        // Allow during finished/cancelled or while a restart session is active (host already set to waiting)
        const restartActive = restartSessionsByRoom.has(roomId);
        if (
          !restartActive &&
          room.gameStatus !== "finished" &&
          room.gameStatus !== "cancelled"
        )
          return;

        const targetId = String(userId);
        const updatedPlayers = (
          Array.isArray(room.players) ? room.players : []
        ).filter((p) => String(p?._id || p?.id || p?.userId || p) !== targetId);
        if (updatedPlayers.length !== (room.players || []).length) {
          room.players = updatedPlayers;
          await room.save();
          // Broadcast updated player list to the room (used by waiting room UIs)
          userRoomNamespace.to(roomId).emit("player-joined", {
            players: await hydratePlayerSummaries(updatedPlayers),
          });
        }
      } catch (err) {
        console.error(
          "[userRoomSocket] leave-game-after-finish error:",
          err.message
        );
      }
    });

    // Update game settings (pattern, speed, sound) - only host can do this before game starts
    socket.on("update-game-settings", async ({ roomId, userId, settings }) => {
      try {
        if (!roomId || !userId) return;

        const room = await GameRoom.findOne({ roomId, gameType: "user" });
        if (!room) {
          socket.emit("settings-update-error", { message: "Room not found" });
          return;
        }

        // Only host can update settings
        if (String(room.hostUserId) !== String(userId)) {
          socket.emit("settings-update-error", {
            message: "Only the host can update settings",
          });
          return;
        }

        // Only allow updates in waiting state
        if (room.gameStatus !== "waiting") {
          socket.emit("settings-update-error", {
            message: "Cannot update settings during game",
          });
          return;
        }

        // Update allowed settings
        if (settings.bingoPattern) {
          const validPatterns = [
            "1line", "2line", "3line", "4line", // Line patterns
            "2lines", "3lines", "fullhouse", // Legacy values
            "anyVertical", "anyHorizontal", // Direction patterns
            "lPattern", "x", "centerT", "centerFourCorner" // Special patterns
          ];
          if (validPatterns.includes(settings.bingoPattern)) {
            room.bingoPattern = settings.bingoPattern;
          }
        }
        if (settings.callingSpeed) {
          const speed = parseInt(settings.callingSpeed);
          if (speed >= 2000 && speed <= 10000) {
            room.callingSpeed = speed;
          }
        }
        if (settings.soundType) {
          const validSounds = [
            "male", "female", "classic", // Legacy values
            "amharic-female", "amharic-male-1", "amharic-male-2", "amharic-male-3", // New sound packs
            "tigray-male"
          ];
          if (validSounds.includes(settings.soundType)) {
            room.soundType = settings.soundType;
          }
        }
        if (typeof settings.autoCall === "boolean") {
          room.autoCall = settings.autoCall;
        }

        await room.save();

        // Broadcast updated settings to all players in the room
        userRoomNamespace.to(roomId).emit("game-settings-updated", {
          roomId,
          bingoPattern: room.bingoPattern,
          callingSpeed: room.callingSpeed,
          soundType: room.soundType,
          autoCall: room.autoCall,
        });

        console.log(
          `[userRoomSocket] Game settings updated for room ${roomId}:`,
          {
            bingoPattern: room.bingoPattern,
            callingSpeed: room.callingSpeed,
            soundType: room.soundType,
            autoCall: room.autoCall,
          }
        );
      } catch (err) {
        console.error(
          "[userRoomSocket] update-game-settings error:",
          err.message
        );
        socket.emit("settings-update-error", {
          message: "Failed to update settings",
        });
      }
    });

    // Pause game (host only) - stops number calling temporarily
    socket.on("pause-game", async ({ roomId, userId }) => {
      try {
        if (!roomId || !userId) return;

        const room = await GameRoom.findOne({ roomId, gameType: "user" });
        if (!room) {
          socket.emit("pause-error", { message: "Room not found" });
          return;
        }

        if (String(room.hostUserId) !== String(userId)) {
          socket.emit("pause-error", {
            message: "Only the host can pause the game",
          });
          return;
        }

        if (room.gameStatus !== "playing") {
          socket.emit("pause-error", { message: "Game is not playing" });
          return;
        }

        pausedRooms.add(roomId);
        room.isPaused = true;
        await room.save();

        userRoomNamespace.to(roomId).emit("game-paused", { roomId });
        console.log(`[userRoomSocket] Game paused for room ${roomId}`);
      } catch (err) {
        console.error("[userRoomSocket] pause-game error:", err.message);
        socket.emit("pause-error", { message: "Failed to pause game" });
      }
    });

    // Resume game (host only) - resumes number calling
    socket.on("resume-game", async ({ roomId, userId }) => {
      try {
        if (!roomId || !userId) return;

        const room = await GameRoom.findOne({ roomId, gameType: "user" });
        if (!room) {
          socket.emit("resume-error", { message: "Room not found" });
          return;
        }

        if (String(room.hostUserId) !== String(userId)) {
          socket.emit("resume-error", {
            message: "Only the host can resume the game",
          });
          return;
        }

        if (room.gameStatus !== "playing") {
          socket.emit("resume-error", { message: "Game is not playing" });
          return;
        }

        pausedRooms.delete(roomId);
        room.isPaused = false;
        await room.save();

        userRoomNamespace.to(roomId).emit("game-resumed", { roomId });
        console.log(`[userRoomSocket] Game resumed for room ${roomId}`);
      } catch (err) {
        console.error("[userRoomSocket] resume-game error:", err.message);
        socket.emit("resume-error", { message: "Failed to resume game" });
      }
    });

    // Shuffle/play random audio (host only) - just broadcasts to clients to play random number audio
    socket.on("shuffle-audio", async ({ roomId, userId }) => {
      try {
        if (!roomId || !userId) return;

        const room = await GameRoom.findOne({ roomId, gameType: "user" });
        if (!room) return;

        if (String(room.hostUserId) !== String(userId)) {
          socket.emit("shuffle-error", {
            message: "Only the host can shuffle",
          });
          return;
        }

        // Generate a random number between 1-75 for the audio
        const randomNumber = Math.floor(Math.random() * 75) + 1;

        // Broadcast to all players in the room to play this audio
        userRoomNamespace.to(roomId).emit("play-shuffle-audio", {
          roomId,
          number: randomNumber,
          soundType: room.soundType || "amharic-male-1",
        });

        console.log(
          `[userRoomSocket] Shuffle audio triggered for room ${roomId}, number: ${randomNumber}`
        );
      } catch (err) {
        console.error("[userRoomSocket] shuffle-audio error:", err.message);
      }
    });

    // Check bingo pattern for user-hosted games
    socket.on("check-bingo-pattern", async ({ roomId, userId, cartelaId }) => {
      try {
        console.log("\n=== USER-ROOM: check-bingo-pattern ===");
        console.log("Room ID:", roomId);
        console.log("User ID:", userId);
        console.log("Cartela ID:", cartelaId);

        if (!roomId || !userId || !cartelaId) {
          console.log("❌ Missing required fields");
          socket.emit("bingo-check-error", {
            message: "Missing required fields",
          });
          return;
        }

        // Get room data from database
        const room = await GameRoom.findOne({ roomId, gameType: "user" });
        if (!room) {
          console.log("❌ Room not found");
          socket.emit("bingo-check-error", { message: "Room not found" });
          return;
        }

        // Check if room already has a winner
        if (room.winner) {
          console.log("❌ Room already has a winner");
          socket.emit("bingo-already-won", {
            message: "This game already has a winner",
            winner: room.winner,
          });
          return;
        }

        // Get cartela selections for this room
        const roomCartelasObj = roomCartelas.get(roomId) || {};
        const cartelaOwner = roomCartelasObj[String(cartelaId)];
        console.log("Cartela owner:", cartelaOwner);

        if (!cartelaOwner || String(cartelaOwner.userId) !== String(userId)) {
          console.log("❌ User doesn't own this cartela");
          socket.emit("bingo-check-error", {
            message: "You don't own this cartela",
          });
          return;
        }

        // Get called numbers and current number
        const calledNumbers = calledNumbersByUserRoom[roomId] || [];
        const currentNumber =
          calledNumbers.length > 0
            ? calledNumbers[calledNumbers.length - 1]
            : null;

        // Get the card
        const card = bingoCards[cartelaId - 1];
        if (!card) {
          console.log("❌ Card not found");
          socket.emit("bingo-check-error", { message: "Card not found" });
          return;
        }

        // Get the pattern for this room
        const pattern = room.bingoPattern || "1line";

        // Check the winning pattern
        const result = checkWinningPattern(
          card,
          calledNumbers,
          pattern,
          currentNumber
        );

        console.log("Bingo check result:", result);

        if (result.isWinner && result.status === "win") {
          // Winner! Update the room and broadcast
          let userName = cartelaOwner.userName;
          
          // If stored userName looks like an ID, try to get the real name
          const looksLikeId = !userName || 
            userName === "Unknown" || 
            /^[a-f0-9]{24}$/i.test(userName) || 
            /^\d{10,}$/.test(userName) ||
            userName.startsWith("Player ");
            
          if (looksLikeId) {
            try {
              const userDoc = await User.findById(userId);
              if (userDoc) {
                userName = userDoc.name || userDoc.username || userDoc.phoneNumber || userDoc.email || userName;
                console.log(`Winner name fetched from User collection: ${userName}`);
              }
            } catch (userErr) {
              console.log(`Could not fetch winner name: ${userErr.message}`);
            }
          }
          
          const winnerData = {
            userId: String(userId),
            userName,
            cartelaId: parseInt(cartelaId),
            winningCells: result.winningCells,
          };

          room.winner = winnerData;
          room.gameStatus = "finished";
          await room.save();

          console.log("🎉 Winner found:", winnerData);

          // Compute prize based on total selected cartelas in the room, minus win cut
          const totalSelectedCartelas = Object.keys(
            roomCartelas.get(roomId) || {}
          ).length;
          const rawPot =
            typeof room.stake === "number"
              ? room.stake * totalSelectedCartelas
              : 0;

          // Apply cashier's win cut (from their user profile)
          let prizeAmount = rawPot;
          try {
            // Get the cashier/host user to retrieve their specific win cut
            const cashierUserId = room.cashierId || room.hostUserId;
            let winCutPercent = 10; // Default 10% if not found
            
            if (cashierUserId) {
              const cashierUser = await User.findById(cashierUserId);
              if (cashierUser && cashierUser.winCut !== undefined && cashierUser.winCut !== null) {
                winCutPercent = Number(cashierUser.winCut);
              }
            }
            
            prizeAmount = Math.max(0, rawPot - (rawPot * winCutPercent) / 100);
            console.log(
              `💰 Prize calculation: rawPot=${rawPot}, cashierWinCut=${winCutPercent}%, netPrize=${prizeAmount}`
            );
          } catch (settingsErr) {
            console.error(
              "[winCut] Failed to get cashier's win cut, using full pot:",
              settingsErr.message
            );
            // Default to no cut on failure
          }

          let pointsAwarded = {};

          // Record game history (finished with winner)
          try {
            const exists = await GameHistory.findOne({
              roomId: room._id,
              gameType: "user",
              gameStatus: "finished",
            });
            if (!exists) {
              try {
                const participantIds = Array.isArray(room.players)
                  ? room.players.map((p) =>
                      String(p?._id || p?.id || p?.userId || p)
                    )
                  : [];
                const awardResult = await awardGamePoints({
                  playerIds: participantIds,
                  winnerId: String(userId),
                  gameType: "user",
                  roomId,
                });
                pointsAwarded = awardResult?.awarded || {};
              } catch (pointsErr) {
                console.error(
                  "[points] award error (user room winner):",
                  pointsErr.message
                );
              }
              // Credit winner's wallet once
              if (prizeAmount > 0) {
                try {
                  await creditPrizeToUserWinner(
                    String(userId),
                    prizeAmount,
                    roomId
                  );
                } catch (walletErr) {
                  console.error(
                    "[wallet] Prize credit error (user room finished):",
                    walletErr.message
                  );
                }
              }
              // Prefer updating existing 'playing' history to avoid duplicates
              const playingHistory = await GameHistory.findOne({
                roomId: room._id,
                gameType: "user",
                gameStatus: "playing",
              });
              if (playingHistory) {
                playingHistory.gameStatus = "finished";
                playingHistory.winner = winnerData;
                playingHistory.prize = prizeAmount;
                await playingHistory.save();
                console.log("✅ Game history updated from playing → finished");
              } else {
                await GameHistory.create({
                  roomId: room._id,
                  gameType: "user",
                  players: room.players,
                  winner: winnerData,
                  hostUserId: room.hostUserId,
                  stake: room.stake,
                  prize: prizeAmount,
                  gameStatus: "finished",
                  max_players: room.max_players,
                });
                console.log("✅ Game history saved (finished)");
              }

              // Always credit host share on game end (with winner)
              try {
                const settings = await Settings.getSettings();
                const hostSharePercent =
                  Number(settings?.userGames?.hostShare) >= 0
                    ? Number(settings.userGames.hostShare)
                    : 0;
                const totalSelectedCartelasForHost = Object.keys(
                  roomCartelas.get(roomId) || {}
                ).length;
                const pot =
                  typeof room.stake === "number"
                    ? room.stake * totalSelectedCartelasForHost
                    : 0;
                const hostShareAmount = Math.max(
                  0,
                  (pot * hostSharePercent) / 100
                );
                if (
                  hostShareAmount > 0 &&
                  room.hostUserId &&
                  String(room.hostUserId).length > 0
                ) {
                  const hostWallet = await Wallet.findOne({
                    user: String(room.hostUserId),
                  });
                  if (hostWallet) {
                    hostWallet.balance =
                      (hostWallet.balance || 0) + hostShareAmount;
                    await hostWallet.save();
                  } else {
                    await Wallet.create({
                      user: String(room.hostUserId),
                      balance: hostShareAmount,
                      bonus: 0,
                    });
                  }
                }
              } catch (hostErr) {
                console.error(
                  "[wallet] Host share credit error (user room finished):",
                  hostErr.message
                );
              }

              // Ensure win-cut revenue exists (if stake-debit stage missed it)
              try {
                const roomKey = room?.roomId || String(room?._id || "");
                if (roomKey) {
                  const existsRevenue = await Revenue.findOne({
                    gameRoom: roomKey,
                    reason: "user_game_win_cut",
                  });
                  if (!existsRevenue) {
                    const settings = await Settings.getSettings();
                    const winCutPercent =
                      Number(settings?.userGames?.winCut) >= 0
                        ? Number(settings.userGames.winCut)
                        : 0;
                    const totalSelectedCartelasForCut = Object.keys(
                      roomCartelas.get(roomId) || {}
                    ).length;
                    const pot =
                      typeof room.stake === "number"
                        ? room.stake * totalSelectedCartelasForCut
                        : 0;
                    const amount = Math.max(0, (pot * winCutPercent) / 100);
                    await Revenue.create({
                      amount,
                      gameRoom: roomKey,
                      stake: room.stake,
                      players: room.players,
                      winner: winnerData,
                      reason: "user_game_win_cut",
                    });
                  }
                }
              } catch (revErr) {
                console.error(
                  "[revenue] Failed to ensure user-game win-cut revenue (winner):",
                  revErr.message
                );
              }
            }
          } catch (historyErr) {
            console.error(
              "[userRoomSocket] Game history save error:",
              historyErr.message
            );
          }

          // Calculate bonus based on number of calls
          let bonusAmount = 0;
          try {
            if (room.hostUserId) {
              bonusAmount = await BonusConfig.calculateBonus(
                String(room.hostUserId),
                calledNumbers.length
              );
              if (bonusAmount > 0) {
                console.log(
                  `🎁 Bonus awarded: ${bonusAmount} Birr for winning in ${calledNumbers.length} calls`
                );
              }
            }
          } catch (bonusErr) {
            console.error("[bonus] Calculation error:", bonusErr.message);
          }

          userRoomNamespace.to(roomId).emit("bingo-winner", {
            roomId,
            winner: winnerData,
            prize: prizeAmount,
            pointsAwarded,
            bonusAmount,
            callCount: calledNumbers.length,
          });

          // Emit explicit game-finished event for user-hosted games
          userRoomNamespace.to(roomId).emit("game-finished", {
            roomId,
            winner: winnerData,
            prize: prizeAmount,
            pointsAwarded,
            bonusAmount,
            callCount: calledNumbers.length,
          });

          // Stop number calling and cleanup game data for this room
          if (calledNumbersIntervalByUserRoom[roomId]) {
            clearInterval(calledNumbersIntervalByUserRoom[roomId]);
            delete calledNumbersIntervalByUserRoom[roomId];
          }
          // Note: We keep calledNumbersByUserRoom and roomCartelas for history/display
          // They will be cleaned up when the room is deleted
        } else if (result.isWinner && result.status === "not_now") {
          // Pattern completed but current number not in it
          console.log("⚠️ Pattern completed but not_now");
          socket.emit("bingo-not-now", {
            message: "Pattern will win on next correct number",
          });
        } else {
          // Not a winner
          console.log("❌ Not a winner");
          socket.emit("bingo-no-win", {
            message: "No winning pattern found on this card",
          });
        }
      } catch (err) {
        console.error(
          "[userRoomSocket] check-bingo-pattern error:",
          err.message
        );
        socket.emit("bingo-check-error", { message: err.message });
      }
    });

    // Cleanup on disconnect
    socket.on("disconnect", () => {
      // Cleanup is handled per room, not per socket
      console.log(`[userRoomSocket] Socket ${socket.id} disconnected`);
    });
  });
}

/**
 * Call a random number for a user-hosted room
 */
function callRandomNumberForUserRoom(namespace, roomId) {
  if (!calledNumbersByUserRoom[roomId]) {
    calledNumbersByUserRoom[roomId] = [];
  }
  // Bingo is 1-75
  const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
  const alreadyCalled = calledNumbersByUserRoom[roomId];
  const remaining = allNumbers.filter((n) => !alreadyCalled.includes(n));
  if (remaining.length === 0) return false;
  const number = remaining[Math.floor(Math.random() * remaining.length)];
  calledNumbersByUserRoom[roomId].push(number);
  namespace.to(roomId).emit("calledNumbersUpdate", {
    roomId,
    calledNumbersCount: calledNumbersByUserRoom[roomId].length,
    numbersList: calledNumbersByUserRoom[roomId],
  });
  return true;
}

/**
 * Start number calling interval for a user-hosted room
 */
async function startNumberCallingInterval(
  namespace,
  roomId,
  customSpeed = null
) {
  if (calledNumbersIntervalByUserRoom[roomId]) return; // Already running

  // Get speed from room settings if not provided
  let speed = customSpeed;
  if (!speed) {
    try {
      const room = await GameRoom.findOne({ roomId, gameType: "user" });
      speed = room?.callingSpeed || 4000;
    } catch (err) {
      speed = 4000;
    }
  }
  roomCallingSpeeds.set(roomId, speed);
  pausedRooms.delete(roomId); // Ensure not paused when starting

  calledNumbersByUserRoom[roomId] = [];
  calledNumbersIntervalByUserRoom[roomId] = setInterval(async () => {
    // Skip if paused
    if (pausedRooms.has(roomId)) return;

    const hasRemaining = callRandomNumberForUserRoom(namespace, roomId);
    if (!hasRemaining) {
      clearInterval(calledNumbersIntervalByUserRoom[roomId]);
      delete calledNumbersIntervalByUserRoom[roomId];
      roomCallingSpeeds.delete(roomId);
      pausedRooms.delete(roomId);
      console.log(`[userRoomSocket] All numbers called for room ${roomId}`);
      // If no winner by the time all numbers are called, finalize as finished (no winner)
      try {
        const room = await GameRoom.findOne({ roomId, gameType: "user" });
        if (room && !room.winner) {
          room.gameStatus = "finished";
          await room.save();
          // Save finished history without winner (prefer updating existing 'playing')
          const finishedExists = await GameHistory.findOne({
            roomId: room._id,
            gameType: "user",
            gameStatus: "finished",
          });
          let pointsAwarded = {};
          if (!finishedExists) {
            try {
              const participantIds = Array.isArray(room.players)
                ? room.players.map((p) =>
                    String(p?._id || p?.id || p?.userId || p)
                  )
                : [];
              const awardResult = await awardGamePoints({
                playerIds: participantIds,
                gameType: "user",
                roomId,
              });
              pointsAwarded = awardResult?.awarded || {};
            } catch (pointsErr) {
              console.error(
                "[points] award error (user room no-winner):",
                pointsErr.message
              );
            }
            const playingHistory = await GameHistory.findOne({
              roomId: room._id,
              gameType: "user",
              gameStatus: "playing",
            });
            if (playingHistory) {
              playingHistory.gameStatus = "finished";
              playingHistory.winner = null;
              playingHistory.prize = 0;
              await playingHistory.save();
              console.log(
                "✅ Game history updated from playing → finished (no-winner)"
              );
            } else {
              await GameHistory.create({
                roomId: room._id,
                gameType: "user",
                players: room.players,
                winner: null,
                hostUserId: room.hostUserId,
                stake: room.stake,
                prize: 0,
                gameStatus: "finished",
                max_players: room.max_players,
              });
            }
          }
          // Always credit host share on game end (no winner)
          try {
            const settings = await Settings.getSettings();
            const hostSharePercent =
              Number(settings?.userGames?.hostShare) >= 0
                ? Number(settings.userGames.hostShare)
                : 0;
            const totalSelectedCartelasNoWinner = Object.keys(
              roomCartelas.get(roomId) || {}
            ).length;
            const pot =
              typeof room.stake === "number"
                ? room.stake * totalSelectedCartelasNoWinner
                : 0;
            const hostShareAmount = Math.max(0, (pot * hostSharePercent) / 100);
            if (
              hostShareAmount > 0 &&
              room.hostUserId &&
              String(room.hostUserId).length > 0
            ) {
              const hostWallet = await Wallet.findOne({
                user: String(room.hostUserId),
              });
              if (hostWallet) {
                hostWallet.balance =
                  (hostWallet.balance || 0) + hostShareAmount;
                await hostWallet.save();
              } else {
                await Wallet.create({
                  user: String(room.hostUserId),
                  balance: hostShareAmount,
                  bonus: 0,
                });
              }
            }
          } catch (hostErr) {
            console.error(
              "[wallet] Host share credit error (user room no-winner):",
              hostErr.message
            );
          }

          // Create revenue entries:
          // 1) Ensure win-cut revenue exists
          // 2) Record no-winner revenue for the full prize pot
          try {
            const roomKey = roomId || String(room?._id || "");
            // Pot is based on selected cartelas (cashier is NOT a player)
            const selectedCartelas =
              roomCartelas.get(roomKey) || room?.selectedCartelas || {};
            const totalSelected = Object.keys(selectedCartelas).length;
            const pot =
              typeof room.stake === "number" ? room.stake * totalSelected : 0;

            // 1) Ensure win cut revenue
            const winCutExists = await Revenue.findOne({
              gameRoom: roomKey,
              reason: "user_game_win_cut",
            });
            if (!winCutExists) {
              const settings = await Settings.getSettings();
              const winCutPercent =
                Number(settings?.userGames?.winCut) >= 0
                  ? Number(settings.userGames.winCut)
                  : 0;
              const amount = Math.max(0, (pot * winCutPercent) / 100);
              await Revenue.create({
                amount,
                gameRoom: roomKey,
                stake: room.stake,
                players: room.players,
                winner: null,
                reason: "user_game_win_cut",
              });
            }

            // 2) No-winner prize revenue
            const noWinnerExists = await Revenue.findOne({
              gameRoom: roomKey,
              reason: "user_game_no_winner",
            });
            if (!noWinnerExists && pot > 0) {
              await Revenue.create({
                amount: pot,
                gameRoom: roomKey,
                stake: room.stake,
                players: room.players,
                winner: null,
                reason: "user_game_no_winner",
              });
            }
          } catch (revErr) {
            console.error(
              "[revenue] Failed to create user-game revenue (no-winner):",
              revErr.message
            );
          }
          // Notify clients
          namespace.to(roomId).emit("game-finished", {
            roomId,
            winner: { userId: null, userName: "No winner" },
            prize: 0,
            pointsAwarded,
          });
        }
      } catch (err) {
        console.error(
          "[userRoomSocket] finalize no-winner error:",
          err.message
        );
      }
    }
  }, speed); // Call a number at configured speed

  console.log(
    `[userRoomSocket] Started number calling for user room ${roomId} at ${speed}ms intervals`
  );
}

// Cleanup function for finished games
export function cleanupUserRoomGame(roomId) {
  if (calledNumbersIntervalByUserRoom[roomId]) {
    clearInterval(calledNumbersIntervalByUserRoom[roomId]);
    delete calledNumbersIntervalByUserRoom[roomId];
  }
  delete calledNumbersByUserRoom[roomId];
  roomCartelas.delete(roomId);
  pausedRooms.delete(roomId);
  roomCallingSpeeds.delete(roomId);
  console.log(`[userRoomSocket] Cleaned up game data for room ${roomId}`);
}
