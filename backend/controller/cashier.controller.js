import User from "../model/user.js";
import Wallet from "../model/wallet.js";
import WalletTransaction from "../model/walletTransaction.js";
import mongoose from "mongoose";

// GET all cashiers (agent only - shows cashiers created by this agent)
export const getAllCashiers = async (req, res) => {
  try {
    // Check if user is agent
    if (req.user && req.user.role !== "agent") {
      return res
        .status(403)
        .json({ message: "Access denied. Agent privileges required." });
    }

    const { page = 1, limit = 50, search, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query - only cashiers created by this agent
    const query = { role: "cashier", createdBy: req.user._id };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // Fetch cashiers with pagination
    const [cashiers, total] = await Promise.all([
      User.find(query)
        .select("-pin") // Exclude PIN from response
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    // Get wallet balances for cashiers
    const wallets = await Wallet.find({
      user: { $in: cashiers.map((u) => u._id) },
    }).lean();
    const walletMap = {};
    wallets.forEach((w) => {
      walletMap[String(w.user)] = w.balance || 0;
    });

    // Format the response
    const formattedCashiers = cashiers.map((user) => {
      return {
        id: String(user._id),
        name: user.name,
        phoneNumber: user.phoneNumber,
        isVerified: user.isVerified,
        isActive: user.isActive,
        role: user.role || "cashier",
        sharePercent: user.sharePercent || 10,
        walletBalance: walletMap[String(user._id)] || 0,
        lastLogin: user.lastLogin || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    });

    res.json({
      success: true,
      cashiers: formattedCashiers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching cashiers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cashiers",
      error: error.message,
    });
  }
};

// GET single cashier by ID (agent only)
export const getCashier = async (req, res) => {
  try {
    // Check if user is agent
    if (req.user && req.user.role !== "agent") {
      return res
        .status(403)
        .json({ message: "Access denied. Agent privileges required." });
    }

    const cashier = await User.findById(req.params.id).select("-pin");

    // Verify cashier exists and was created by this agent
    if (
      !cashier ||
      cashier.role !== "cashier" ||
      String(cashier.createdBy) !== String(req.user._id)
    ) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found",
      });
    }

    const wallet = await Wallet.findOne({ user: cashier._id }).lean();

    res.json({
      success: true,
      data: {
        id: String(cashier._id),
        name: cashier.name,
        phoneNumber: cashier.phoneNumber,
        lastLogin: cashier.lastLogin || null,
        isVerified: cashier.isVerified,
        isActive: cashier.isActive,
        role: cashier.role,
        createdAt: cashier.createdAt,
        updatedAt: cashier.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching cashier:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cashier",
      error: error.message,
    });
  }
};

// POST create new cashier (agent only)
export const createCashier = async (req, res) => {
  try {
    // Check if user is agent
    if (req.user && req.user.role !== "agent") {
      return res
        .status(403)
        .json({ message: "Access denied. Agent privileges required." });
    }

    const { name, phoneNumber, pin } = req.body;

    // Validate required fields
    if (!name || !phoneNumber || !pin) {
      return res.status(400).json({
        success: false,
        message: "Name, phone number, and PIN are required",
      });
    }

    // Check if phone number already exists
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this phone number already exists",
      });
    }

    const { sharePercent = 10 } = req.body;

    // Validate sharePercent
    if (sharePercent < 1 || sharePercent > 100) {
      return res.status(400).json({
        success: false,
        message: "Share percent must be between 1 and 100",
      });
    }

    // Create cashier user with createdBy reference and sharePercent
    const cashier = await User.create({
      name,
      phoneNumber,
      pin,
      role: "cashier",
      createdBy: req.user._id,
      sharePercent,
      isActive: true,
      isVerified: true,
      balance: 0,
      points: 0,
    });

    // Create wallet for cashier
    await Wallet.create({
      user: cashier._id,
      balance: 0,
      bonus: 0,
    });

    res.status(201).json({
      success: true,
      message: "Cashier created successfully",
      data: {
        id: String(cashier._id),
        name: cashier.name,
        phoneNumber: cashier.phoneNumber,
        role: cashier.role,
        isActive: cashier.isActive,
        isVerified: cashier.isVerified,
        createdAt: cashier.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating cashier:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create cashier",
      error: error.message,
    });
  }
};

// PUT update cashier (agent only)
export const updateCashier = async (req, res) => {
  try {
    // Check if user is agent
    if (req.user && req.user.role !== "agent") {
      return res
        .status(403)
        .json({ message: "Access denied. Agent privileges required." });
    }

    const { name, phoneNumber, pin, isActive } = req.body;

    const cashier = await User.findById(req.params.id);

    // Verify cashier exists and was created by this agent
    if (
      !cashier ||
      cashier.role !== "cashier" ||
      String(cashier.createdBy) !== String(req.user._id)
    ) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found",
      });
    }

    // Update fields if provided
    if (name) cashier.name = name;
    if (phoneNumber) {
      // Check if phone number is already taken by another user
      const existingUser = await User.findOne({
        phoneNumber,
        _id: { $ne: req.params.id },
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Phone number already in use",
        });
      }
      cashier.phoneNumber = phoneNumber;
    }
    if (pin) {
      cashier.pin = pin; // Will be hashed by pre-save hook
    }
    if (isActive !== undefined) cashier.isActive = isActive;

    await cashier.save();

    res.json({
      success: true,
      message: "Cashier updated successfully",
      data: {
        id: String(cashier._id),
        name: cashier.name,
        phoneNumber: cashier.phoneNumber,
        isActive: cashier.isActive,
        updatedAt: cashier.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating cashier:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update cashier",
      error: error.message,
    });
  }
};

// DELETE cashier (agent only) - Permanently deletes the cashier
export const deleteCashier = async (req, res) => {
  try {
    // Check if user is agent
    if (req.user && req.user.role !== "agent") {
      return res
        .status(403)
        .json({ message: "Access denied. Agent privileges required." });
    }

    const cashier = await User.findById(req.params.id);

    // Verify cashier exists and was created by this agent
    if (
      !cashier ||
      cashier.role !== "cashier" ||
      String(cashier.createdBy) !== String(req.user._id)
    ) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found",
      });
    }

    // Delete associated wallet if it exists
    if (cashier.wallet) {
      await Wallet.findByIdAndDelete(cashier.wallet);
    } else {
      // Also check if wallet exists by user reference
      await Wallet.deleteOne({ user: cashier._id });
    }

    // Permanently delete the cashier
    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Cashier deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting cashier:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete cashier",
      error: error.message,
    });
  }
};

// POST top-up cashier wallet (agent only) - Uses share multiplier
// Deducts from agent wallet and credits to cashier wallet
export const topUpCashierWallet = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if user is agent
    if (req.user && req.user.role !== "agent") {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(403)
        .json({ message: "Access denied. Agent privileges required." });
    }

    const { amount } = req.body;
    const cashierId = req.params.id;
    const agentId = String(req.user._id);

    if (!amount || amount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number",
      });
    }

    const cashier = await User.findById(cashierId).session(session);

    // Verify cashier exists and was created by this agent
    if (
      !cashier ||
      cashier.role !== "cashier" ||
      String(cashier.createdBy) !== agentId
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Cashier not found",
      });
    }

    // Calculate actual amount using share multiplier
    // If sharePercent is 10%, then agent adding 10 birr = cashier gets 100 birr
    const sharePercent = cashier.sharePercent || 10;
    const actualAmount = (amount / sharePercent) * 100;

    // Get agent wallet and check balance
    // Agent wallet is reduced by the SAME amount credited to cashier (actualAmount)
    let agentWallet = await Wallet.findOne({ user: agentId }).session(session);
    if (!agentWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Agent wallet not found",
      });
    }

    const agentBalance = Number(agentWallet.balance || 0);
    if (agentBalance < actualAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance in agent wallet. Current balance: ${agentBalance} birr, Required: ${actualAmount} birr`,
        data: {
          currentBalance: agentBalance,
          requiredAmount: actualAmount,
        },
      });
    }

    // Deduct from agent wallet - same amount as credited to cashier
    const updatedAgentWallet = await Wallet.findOneAndUpdate(
      { user: agentId, balance: { $gte: actualAmount } },
      { $inc: { balance: -actualAmount } },
      { new: true, session }
    );

    if (!updatedAgentWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message:
          "Failed to deduct from agent wallet. Insufficient balance or concurrent modification.",
      });
    }

    // Find or create cashier wallet
    let cashierWallet = await Wallet.findOne({ user: cashierId }).session(
      session
    );
    if (!cashierWallet) {
      cashierWallet = await Wallet.create(
        [
          {
            user: cashierId,
            balance: 0,
            bonus: 0,
          },
        ],
        { session, ordered: true }
      );
      cashierWallet = cashierWallet[0];
    }

    // Credit to cashier wallet
    const updatedCashierWallet = await Wallet.findOneAndUpdate(
      { user: cashierId },
      { $inc: { balance: actualAmount } },
      { new: true, session }
    );

    // Log transactions for both agent and cashier
    await WalletTransaction.create(
      [
        {
          user: agentId,
          amount: -actualAmount,
          type: "CASHIER_TOPUP",
          balanceAfter: updatedAgentWallet.balance,
          meta: {
            cashierId: String(cashierId),
            cashierName: cashier.name,
            sharePercent,
            inputAmount: amount,
            creditedToCashier: actualAmount,
          },
        },
        {
          user: String(cashierId),
          amount: actualAmount,
          type: "AGENT_TOPUP",
          balanceAfter: updatedCashierWallet.balance,
          meta: {
            agentId,
            agentName: req.user.name,
            sharePercent,
            deductedFromAgent: actualAmount,
          },
        },
      ],
      { session, ordered: true }
    );

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: `Wallet topped up successfully. Deducted ${actualAmount} birr from agent, credited ${actualAmount} birr to cashier`,
      data: {
        inputAmount: amount,
        deductedFromAgent: actualAmount,
        sharePercent,
        creditedToCashier: actualAmount,
        agentNewBalance: updatedAgentWallet.balance,
        cashierNewBalance: updatedCashierWallet.balance,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error topping up cashier wallet:", error);
    res.status(500).json({
      success: false,
      message: "Failed to top up wallet",
      error: error.message,
    });
  }
};

// GET my win cut (cashier only)
export const getMyWinCut = async (req, res) => {
  try {
    // Check if user is cashier
    if (req.user && req.user.role !== "cashier") {
      return res
        .status(403)
        .json({ message: "Access denied. Cashier privileges required." });
    }

    const cashier = await User.findById(req.user._id).select("winCut").lean();
    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found",
      });
    }

    res.json({
      success: true,
      data: {
        winCut: cashier.winCut ?? 10, // Default to 10% if not set
      },
    });
  } catch (error) {
    console.error("Error fetching win cut:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch win cut",
      error: error.message,
    });
  }
};

// PUT update my win cut (cashier only)
export const updateMyWinCut = async (req, res) => {
  try {
    // Check if user is cashier
    if (req.user && req.user.role !== "cashier") {
      return res
        .status(403)
        .json({ message: "Access denied. Cashier privileges required." });
    }

    const { winCut } = req.body;

    // Validate winCut
    if (winCut === undefined || winCut === null) {
      return res.status(400).json({
        success: false,
        message: "Win cut percentage is required",
      });
    }

    const winCutNum = Number(winCut);
    if (isNaN(winCutNum) || winCutNum < 0 || winCutNum > 100) {
      return res.status(400).json({
        success: false,
        message: "Win cut must be a number between 0 and 100",
      });
    }

    const cashier = await User.findByIdAndUpdate(
      req.user._id,
      { winCut: winCutNum },
      { new: true }
    );

    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found",
      });
    }

    res.json({
      success: true,
      message: "Win cut updated successfully",
      data: {
        winCut: cashier.winCut,
      },
    });
  } catch (error) {
    console.error("Error updating win cut:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update win cut",
      error: error.message,
    });
  }
};
