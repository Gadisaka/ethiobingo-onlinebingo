import CashierSubscription from "../model/cashierSubscription.js";
import GameInvitation from "../model/gameInvitation.js";
import GameRoom from "../model/gameRooms.js";
import User from "../model/user.js";

// Generate a unique 6-digit cashier code
const generateCashierCode = async () => {
  let code;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 10;

  while (exists && attempts < maxAttempts) {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    const existingCashier = await User.findOne({ cashierCode: code });
    exists = !!existingCashier;
    attempts++;
  }

  if (exists) {
    throw new Error("Could not generate unique cashier code");
  }

  return code;
};

// Search cashiers by code or name
export const searchCashiers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res
        .status(400)
        .json({ message: "Search query must be at least 2 characters" });
    }

    const cashiers = await User.find({
      role: "cashier",
      isActive: true,
      cashierCode: { $exists: true, $ne: null },
      $or: [
        { cashierCode: { $regex: query, $options: "i" } },
        { name: { $regex: query, $options: "i" } },
      ],
    })
      .select("_id name cashierCode")
      .limit(10);

    res.json({ cashiers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get cashier by code
export const getCashierByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const cashier = await User.findOne({
      cashierCode: code,
      role: "cashier",
      isActive: true,
    }).select("_id name cashierCode");

    if (!cashier) {
      return res.status(404).json({ message: "Cashier not found" });
    }

    res.json({ cashier });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Subscribe to a cashier
export const subscribeToCashier = async (req, res) => {
  try {
    const { userId, cashierCode } = req.body;

    if (!userId || !cashierCode) {
      return res
        .status(400)
        .json({ message: "userId and cashierCode are required" });
    }

    // Find cashier by code
    const cashier = await User.findOne({
      cashierCode,
      role: "cashier",
      isActive: true,
    });

    if (!cashier) {
      return res.status(404).json({ message: "Cashier not found" });
    }

    // Check if already subscribed
    const existingSubscription = await CashierSubscription.findOne({
      userId,
      cashierId: cashier._id,
    });

    if (existingSubscription) {
      if (existingSubscription.isActive) {
        return res
          .status(400)
          .json({ message: "Already subscribed to this cashier" });
      }
      // Reactivate subscription
      existingSubscription.isActive = true;
      await existingSubscription.save();
      return res.json({
        message: "Subscription reactivated",
        subscription: existingSubscription,
        cashier: {
          _id: cashier._id,
          name: cashier.name,
          cashierCode: cashier.cashierCode,
        },
      });
    }

    // Create new subscription
    const subscription = await CashierSubscription.create({
      userId,
      cashierId: cashier._id,
    });

    res.status(201).json({
      message: "Subscribed successfully",
      subscription,
      cashier: {
        _id: cashier._id,
        name: cashier.name,
        cashierCode: cashier.cashierCode,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: "Already subscribed to this cashier" });
    }
    res.status(500).json({ message: err.message });
  }
};

// Unsubscribe from a cashier
export const unsubscribeFromCashier = async (req, res) => {
  try {
    const { userId, cashierId } = req.body;

    if (!userId || !cashierId) {
      return res
        .status(400)
        .json({ message: "userId and cashierId are required" });
    }

    const subscription = await CashierSubscription.findOneAndUpdate(
      { userId, cashierId },
      { isActive: false },
      { new: true }
    );

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    res.json({ message: "Unsubscribed successfully", subscription });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get user's subscriptions (list of cashiers they're subscribed to)
export const getMySubscriptions = async (req, res) => {
  try {
    const { userId } = req.params;

    const subscriptions = await CashierSubscription.find({
      userId,
      isActive: true,
    }).populate("cashierId", "_id name cashierCode");

    const cashiers = subscriptions
      .filter((sub) => sub.cashierId)
      .map((sub) => ({
        _id: sub.cashierId._id,
        name: sub.cashierId.name,
        cashierCode: sub.cashierId.cashierCode,
        subscribedAt: sub.createdAt,
      }));

    res.json({ cashiers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get subscribers for a cashier
export const getCashierSubscribers = async (req, res) => {
  try {
    const { cashierId } = req.params;

    const subscriptions = await CashierSubscription.find({
      cashierId,
      isActive: true,
    }).populate("userId", "_id name phoneNumber");

    const subscribers = subscriptions
      .filter((sub) => sub.userId)
      .map((sub) => ({
        _id: sub.userId._id,
        name: sub.userId.name,
        phoneNumber: sub.userId.phoneNumber,
        subscribedAt: sub.createdAt,
      }));

    res.json({ subscribers, count: subscribers.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get active invitations for a cashier (for subscribed players)
export const getCashierInvitations = async (req, res) => {
  try {
    const { cashierId } = req.params;

    // Find active invitations
    const invitations = await GameInvitation.find({
      cashierId,
      status: "active",
    }).sort({ createdAt: -1 });

    // Filter out invitations where room is no longer waiting
    const validInvitations = [];
    for (const invitation of invitations) {
      const room = await GameRoom.findOne({
        roomId: invitation.roomId,
        gameType: "user",
        gameStatus: "waiting",
      });

      if (room) {
        validInvitations.push(invitation);
      } else {
        // Auto-cleanup: mark invitation as expired if room is not waiting
        await GameInvitation.findByIdAndUpdate(invitation._id, {
          status: "expired",
        });
      }
    }

    res.json({ invitations: validInvitations });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Assign cashier code to a cashier (called when creating cashier or on first game access)
export const assignCashierCode = async (req, res) => {
  try {
    const { cashierId } = req.body;

    const cashier = await User.findById(cashierId);
    if (!cashier) {
      return res.status(404).json({ message: "Cashier not found" });
    }

    if (cashier.role !== "cashier") {
      return res.status(400).json({ message: "User is not a cashier" });
    }

    if (cashier.cashierCode) {
      return res.json({
        cashierCode: cashier.cashierCode,
        message: "Code already assigned",
      });
    }

    const code = await generateCashierCode();
    cashier.cashierCode = code;
    await cashier.save();

    res.json({ cashierCode: code, message: "Code assigned successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get or create cashier code for current user
export const getOrCreateMyCashierCode = async (req, res) => {
  try {
    const { userId } = req.params;

    const cashier = await User.findById(userId);
    if (!cashier) {
      return res.status(404).json({ message: "User not found" });
    }

    if (cashier.role !== "cashier") {
      return res.status(400).json({ message: "User is not a cashier" });
    }

    if (cashier.cashierCode) {
      return res.json({ cashierCode: cashier.cashierCode });
    }

    const code = await generateCashierCode();
    cashier.cashierCode = code;
    await cashier.save();

    res.json({ cashierCode: code });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Reset cashier code and remove all subscribers
export const resetCashierCode = async (req, res) => {
  try {
    const { userId } = req.params;

    const cashier = await User.findById(userId);
    if (!cashier) {
      return res.status(404).json({ message: "User not found" });
    }

    if (cashier.role !== "cashier") {
      return res.status(400).json({ message: "User is not a cashier" });
    }

    // Remove all active subscriptions for this cashier
    const deleteResult = await CashierSubscription.deleteMany({
      cashierId: cashier._id,
    });

    // Generate new unique code
    const newCode = await generateCashierCode();
    cashier.cashierCode = newCode;
    await cashier.save();

    res.json({
      cashierCode: newCode,
      message: "Code reset successfully",
      subscribersRemoved: deleteResult.deletedCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export { generateCashierCode };
