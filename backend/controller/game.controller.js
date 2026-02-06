import GameRoom from "../model/gameRooms.js";
import GameHistory from "../model/gameHistory.js";
import User from "../model/user.js";
import Wallet from "../model/wallet.js";

// GET all system rooms with waiting status
export const getSystemWaitingRooms = async (req, res) => {
  try {
    const rooms = await GameRoom.find({
      gameType: "system",
      gameStatus: "waiting",
    })
      .sort({ createdAt: 1 }) // Oldest first
      .lean();

    // Transform to match frontend format
    const formattedRooms = rooms.map((room) => ({
      id: String(room._id),
      _id: String(room._id),
      betAmount: room.stake,
      maxPlayers: room.max_players,
      joinedPlayers: Array.isArray(room.players) ? room.players : [],
      status: room.gameStatus,
      createdAt: room.createdAt ? new Date(room.createdAt) : new Date(),
      type: room.gameType,
      expiresAt: null,
    }));

    res.json({ rooms: formattedRooms });
  } catch (error) {
    console.error("Error fetching system waiting rooms:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET game history (admin, agent, cashier)
export const getGameHistory = async (req, res) => {
  try {
    // Check if user has valid role
    const validRoles = ["admin", "agent", "cashier"];
    if (req.user && !validRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Access denied. Invalid role." });
    }

    const userRole = req.user.role;
    const userId = req.user._id;

    const { page = 1, limit = 50, startDate, endDate, agentId, cashierId, status, gameType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build cashier IDs filter based on role hierarchy
    let cashierIds = [];
    let agentIds = [];

    if (userRole === "admin") {
      // Admin sees all agents they created and all cashiers under those agents
      const agents = await User.find({ role: "agent", createdBy: userId }).select("_id");
      agentIds = agents.map(a => a._id);
      
      // If agentId filter is provided, only get cashiers under that agent
      if (agentId) {
        const cashiers = await User.find({ role: "cashier", createdBy: agentId }).select("_id");
        cashierIds = cashiers.map(c => c._id);
      } else {
        const cashiers = await User.find({ role: "cashier", createdBy: { $in: agentIds } }).select("_id");
        cashierIds = cashiers.map(c => c._id);
      }
    } else if (userRole === "agent") {
      // Agent sees all cashiers they created
      const cashiers = await User.find({ role: "cashier", createdBy: userId }).select("_id");
      cashierIds = cashiers.map(c => c._id);
    } else if (userRole === "cashier") {
      // Cashier sees only their own games
      cashierIds = [userId];
    }

    // Build query with role-based filtering
    const query = {};
    
    // Filter by cashierId based on role
    if (userRole === "admin") {
      // Admin sees: system games (cashierId is null) + games from their cashiers
      if (cashierId) {
        // If specific cashierId filter is provided, verify it belongs to admin's agents
        const cashierIdStr = String(cashierId);
        const cashierIdsStr = cashierIds.map(id => String(id));
        if (cashierIdsStr.includes(cashierIdStr)) {
          query.cashierId = cashierId;
        } else {
          // Invalid cashierId, return empty results
          query.cashierId = { $in: [] };
        }
      } else {
        // Admin sees system games (null cashierId) OR games from their cashiers
        if (cashierIds.length > 0) {
          query.$or = [
            { cashierId: null }, // System games
            { cashierId: { $in: cashierIds } } // Games from admin's cashiers
          ];
        } else {
          // No cashiers yet, but admin should still see system games
          query.cashierId = null;
        }
      }
    } else if (cashierIds.length > 0) {
      // For agent and cashier roles, filter by cashierIds
      query.cashierId = { $in: cashierIds };
    } else {
      // No cashiers found for agent, return empty results
      query.cashierId = { $in: [] };
    }
    
    // Game status filtering
    if (status) {
      query.gameStatus = status;
    }
    
    // Game type filtering
    if (gameType) {
      query.gameType = gameType;
    }
    
    // Date range filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Fetch game history with pagination
    const [games, total] = await Promise.all([
      GameHistory.find(query)
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(parseInt(limit))
        .populate("hostUserId", "name phoneNumber")
        .populate("cashierId", "name phoneNumber")
        .lean(),
      GameHistory.countDocuments(query),
    ]);

    // Format the response
    const formattedGames = games.map((game) => ({
      id: String(game._id),
      roomId: game.roomId,
      gameType: game.gameType,
      gameStatus: game.gameStatus,
      stake: game.stake,
      maxPlayers: game.max_players,
      playerCount: Array.isArray(game.players) ? game.players.length : 0,
      players: Array.isArray(game.players) ? game.players : [],
      winner: game.winner,
      prize: game.prize,
      hostUserId: game.hostUserId
        ? String(game.hostUserId._id || game.hostUserId)
        : null,
      hostName: game.hostUserId?.name || null,
      cashierId: game.cashierId
        ? String(game.cashierId._id || game.cashierId)
        : null,
      cashierName: game.cashierId?.name || null,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    }));

    res.json({
      games: formattedGames,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching game history:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET dashboard statistics (role-based: admin, agent, cashier)
export const getDashboardStats = async (req, res) => {
  try {
    // Check if user has valid role
    const validRoles = ["admin", "agent", "cashier"];
    if (req.user && !validRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Access denied. Invalid role." });
    }

    const userRole = req.user.role;
    const userId = req.user._id;

    // Calculate date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Build cashier IDs filter based on role hierarchy
    let cashierIds = [];
    let agentIds = [];

    if (userRole === "admin") {
      // Admin sees all agents they created and all cashiers under those agents
      const agents = await User.find({ role: "agent", createdBy: userId }).select("_id");
      agentIds = agents.map(a => a._id);
      
      const cashiers = await User.find({ role: "cashier", createdBy: { $in: agentIds } }).select("_id");
      cashierIds = cashiers.map(c => c._id);
    } else if (userRole === "agent") {
      // Agent sees all cashiers they created
      const cashiers = await User.find({ role: "cashier", createdBy: userId }).select("_id");
      cashierIds = cashiers.map(c => c._id);
    } else if (userRole === "cashier") {
      // Cashier sees only their own games
      cashierIds = [userId];
    }

    // Build game query filter based on cashierIds
    let gameFilter = {};
    if (userRole === "admin") {
      // Admin sees: system games (cashierId is null) + games from their cashiers
      if (cashierIds.length > 0) {
        gameFilter.$or = [
          { cashierId: null }, // System games
          { cashierId: { $in: cashierIds } } // Games from admin's cashiers
        ];
      } else {
        // No cashiers yet, but admin should still see system games
        gameFilter.cashierId = null;
      }
    } else if (cashierIds.length > 0) {
      // For agent and cashier roles, filter by cashierIds
      gameFilter.cashierId = { $in: cashierIds };
    } else {
      // No cashiers found for agent, return empty results
      gameFilter.cashierId = { $in: [] };
    }
    
    const finishedGameFilter = { ...gameFilter, gameStatus: "finished" };

    // Helper function to get game stats for a date range
    const getGameStats = async (startDate, endDate, filter = {}) => {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lt = endDate;

      const query = { ...filter };
      if (startDate || endDate) query.createdAt = dateFilter;

      const [count, revenueData] = await Promise.all([
        GameHistory.countDocuments({ ...query, gameStatus: "finished" }),
        GameHistory.aggregate([
          { $match: { ...query, gameStatus: "finished" } },
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: { $multiply: ["$stake", { $size: { $ifNull: ["$players", []] } }] },
              },
            },
          },
        ]),
      ]);

      return {
        games: count,
        revenue: revenueData[0]?.totalRevenue || 0,
      };
    };

    // Get stats for different periods
    const [dailyStats, weeklyStats, monthlyStats, totalStats] = await Promise.all([
      getGameStats(today, tomorrow, gameFilter),
      getGameStats(weekAgo, tomorrow, gameFilter),
      getGameStats(monthAgo, tomorrow, gameFilter),
      getGameStats(null, null, gameFilter),
    ]);

    // Get active games count
    const activeGames = await GameHistory.countDocuments({
      ...gameFilter,
      gameStatus: { $in: ["playing", "waiting"] },
    });

    // Role-specific counts
    let totalAgents = 0;
    let totalCashiers = 0;
    let walletBalance = 0;
    let walletBonus = 0;

    if (userRole === "admin") {
      totalAgents = await User.countDocuments({ role: "agent", createdBy: userId });
      totalCashiers = await User.countDocuments({ role: "cashier", createdBy: { $in: agentIds } });
    } else if (userRole === "agent") {
      totalCashiers = await User.countDocuments({ role: "cashier", createdBy: userId });
      // Get agent's wallet balance
      const wallet = await Wallet.findOne({ user: userId });
      if (wallet) {
        walletBalance = wallet.balance || 0;
        walletBonus = wallet.bonus || 0;
      }
    } else if (userRole === "cashier") {
      // Get cashier's wallet balance
      const wallet = await Wallet.findOne({ user: userId });
      if (wallet) {
        walletBalance = wallet.balance || 0;
        walletBonus = wallet.bonus || 0;
      }
    }

    // Get recent activity (last 5 finished games)
    const recentGames = await GameHistory.find({
      ...finishedGameFilter,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("hostUserId", "name")
      .populate("cashierId", "name")
      .lean();

    const recentActivity = recentGames.map((game) => {
      const playerCount = Array.isArray(game.players) ? game.players.length : 0;
      const winnerName = game.winner?.userName || game.winner?.name || "No winner";
      return {
        id: String(game._id),
        message: `${playerCount} players played in ${game.gameType === "system" ? "System" : "User"} game`,
        winner: winnerName,
        stake: game.stake,
        prize: game.prize,
        cashier: game.cashierId?.name || "N/A",
        createdAt: game.createdAt,
      };
    });

    // Get live games
    const liveGamesData = await GameHistory.find({
      ...gameFilter,
      gameStatus: { $in: ["playing", "waiting"] },
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    const liveGames = liveGamesData.map((game) => {
      const playerCount = Array.isArray(game.players) ? game.players.length : 0;
      return {
        id: String(game._id),
        roomId: String(game.roomId).slice(-8),
        playerCount,
        maxPlayers: game.max_players,
        stake: game.stake,
        status: game.gameStatus,
        gameType: game.gameType,
      };
    });

    // Build response based on role
    const response = {
      role: userRole,
      stats: {
        dailyGames: { value: dailyStats.games },
        weeklyGames: { value: weeklyStats.games },
        monthlyGames: { value: monthlyStats.games },
        totalGames: { value: totalStats.games },
        dailyRevenue: { value: dailyStats.revenue },
        weeklyRevenue: { value: weeklyStats.revenue },
        monthlyRevenue: { value: monthlyStats.revenue },
        totalRevenue: { value: totalStats.revenue },
        activeGames: { value: activeGames },
      },
      recentActivity,
      liveGames,
    };

    // Add role-specific stats
    if (userRole === "admin") {
      response.stats.totalAgents = { value: totalAgents };
      response.stats.totalCashiers = { value: totalCashiers };
    } else if (userRole === "agent") {
      response.stats.totalCashiers = { value: totalCashiers };
      response.stats.walletBalance = { value: walletBalance };
      response.stats.walletBonus = { value: walletBonus };
    } else if (userRole === "cashier") {
      response.stats.walletBalance = { value: walletBalance };
      response.stats.walletBonus = { value: walletBonus };
    }

    res.json(response);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Server error" });
  }
};
