import User from "../model/user.js";
import Wallet from "../model/wallet.js";

// GET all agents (admin only)
export const getAllSubAdmins = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const { page = 1, limit = 50, search, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query - only agent role (created by this admin)
    const query = { role: "agent", createdBy: req.user._id };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // Fetch sub-admins with pagination
    const [subAdmins, total] = await Promise.all([
      User.find(query)
        .select("-pin") // Exclude PIN from response
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    // Get wallet balances for agents
    const wallets = await Wallet.find({ user: { $in: subAdmins.map(u => u._id) } }).lean();
    const walletMap = {};
    wallets.forEach(w => {
      walletMap[String(w.user)] = w.balance || 0;
    });

    // Format the response
    const formattedSubAdmins = subAdmins.map((user) => {
      return {
        id: String(user._id),
        name: user.name,
        phoneNumber: user.phoneNumber,
        isVerified: user.isVerified,
        isActive: user.isActive,
        role: user.role || "agent",
        sharePercent: user.sharePercent || 10,
        walletBalance: walletMap[String(user._id)] || 0,
        lastLogin: user.lastLogin || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    });

    res.json({
      success: true,
      subAdmins: formattedSubAdmins,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching sub-admins:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sub-admins",
      error: error.message,
    });
  }
};

// GET single agent by ID (admin only)
export const getSubAdmin = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const subAdmin = await User.findById(req.params.id).select("-pin");

    // Verify agent exists and was created by this admin
    if (!subAdmin || subAdmin.role !== "agent" || String(subAdmin.createdBy) !== String(req.user._id)) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    const wallet = await Wallet.findOne({ user: subAdmin._id }).lean();

    res.json({
      success: true,
      data: {
        id: String(subAdmin._id),
        name: subAdmin.name,
        phoneNumber: subAdmin.phoneNumber,
        lastLogin: subAdmin.lastLogin || null,
        isVerified: subAdmin.isVerified,
        isActive: subAdmin.isActive,
        role: subAdmin.role,
        createdAt: subAdmin.createdAt,
        updatedAt: subAdmin.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching sub-admin:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sub-admin",
      error: error.message,
    });
  }
};

// POST create new agent (admin only)
export const createSubAdmin = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const { name, phoneNumber, pin, sharePercent = 10 } = req.body;

    // Validate required fields
    if (!name || !phoneNumber || !pin) {
      return res.status(400).json({
        success: false,
        message: "Name, phone number, and PIN are required",
      });
    }

    // Validate sharePercent
    if (sharePercent < 1 || sharePercent > 100) {
      return res.status(400).json({
        success: false,
        message: "Share percent must be between 1 and 100",
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

    // Create agent user with createdBy reference and sharePercent
    const subAdmin = await User.create({
      name,
      phoneNumber,
      pin,
      role: "agent",
      createdBy: req.user._id,
      sharePercent,
      isActive: true,
      isVerified: true,
      balance: 0,
      points: 0,
    });

    // Create wallet for agent
    await Wallet.create({
      user: subAdmin._id,
      balance: 0,
      bonus: 0,
    });

    res.status(201).json({
      success: true,
      message: "Agent created successfully",
      data: {
        id: String(subAdmin._id),
        name: subAdmin.name,
        phoneNumber: subAdmin.phoneNumber,
        role: subAdmin.role,
        sharePercent: subAdmin.sharePercent,
        isActive: subAdmin.isActive,
        isVerified: subAdmin.isVerified,
        createdAt: subAdmin.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create agent",
      error: error.message,
    });
  }
};

// PUT update agent (admin only)
export const updateSubAdmin = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const { name, phoneNumber, pin, isActive } = req.body;

    const subAdmin = await User.findById(req.params.id);

    // Verify agent exists and was created by this admin
    if (!subAdmin || subAdmin.role !== "agent" || String(subAdmin.createdBy) !== String(req.user._id)) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    const { sharePercent } = req.body;

    // Update fields if provided
    if (name) subAdmin.name = name;
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
      subAdmin.phoneNumber = phoneNumber;
    }
    if (pin) {
      subAdmin.pin = pin; // Will be hashed by pre-save hook
    }
    if (isActive !== undefined) subAdmin.isActive = isActive;
    if (sharePercent !== undefined) {
      if (sharePercent < 1 || sharePercent > 100) {
        return res.status(400).json({
          success: false,
          message: "Share percent must be between 1 and 100",
        });
      }
      subAdmin.sharePercent = sharePercent;
    }

    await subAdmin.save();

    res.json({
      success: true,
      message: "Agent updated successfully",
      data: {
        id: String(subAdmin._id),
        name: subAdmin.name,
        phoneNumber: subAdmin.phoneNumber,
        isActive: subAdmin.isActive,
        updatedAt: subAdmin.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating agent:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update agent",
      error: error.message,
    });
  }
};

// DELETE agent (admin only) - Permanently deletes the agent and their cashiers
export const deleteSubAdmin = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const subAdmin = await User.findById(req.params.id);

    // Verify agent exists and was created by this admin
    if (!subAdmin || subAdmin.role !== "agent" || String(subAdmin.createdBy) !== String(req.user._id)) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // Don't allow deleting the currently logged-in user
    if (String(subAdmin._id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    // Delete all cashiers created by this agent
    const cashiers = await User.find({ role: "cashier", createdBy: subAdmin._id });
    for (const cashier of cashiers) {
      if (cashier.wallet) {
        await Wallet.findByIdAndDelete(cashier.wallet);
      } else {
        await Wallet.deleteOne({ user: cashier._id });
      }
      await User.findByIdAndDelete(cashier._id);
    }

    // Delete associated wallet if it exists
    if (subAdmin.wallet) {
      await Wallet.findByIdAndDelete(subAdmin.wallet);
    } else {
      // Also check if wallet exists by user reference
      await Wallet.deleteOne({ user: subAdmin._id });
    }

    // Permanently delete the agent
    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Agent and associated cashiers deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting agent:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete agent",
      error: error.message,
    });
  }
};

// POST top-up agent wallet (admin only) - Uses share multiplier
export const topUpAgentWallet = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const { amount } = req.body;
    const agentId = req.params.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number",
      });
    }

    const agent = await User.findById(agentId);

    // Verify agent exists and was created by this admin
    if (!agent || agent.role !== "agent" || String(agent.createdBy) !== String(req.user._id)) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // Calculate actual amount using share multiplier
    // If sharePercent is 10%, then admin adding 10 birr = agent gets 100 birr
    const sharePercent = agent.sharePercent || 10;
    const actualAmount = (amount / sharePercent) * 100;

    // Find or create wallet
    let wallet = await Wallet.findOne({ user: agentId });
    if (!wallet) {
      wallet = await Wallet.create({
        user: agentId,
        balance: 0,
        bonus: 0,
      });
    }

    // Update wallet balance
    wallet.balance += actualAmount;
    await wallet.save();

    res.json({
      success: true,
      message: `Wallet topped up successfully. Added ${amount} birr (${sharePercent}% share) = ${actualAmount} birr credited`,
      data: {
        addedAmount: amount,
        sharePercent,
        creditedAmount: actualAmount,
        newBalance: wallet.balance,
      },
    });
  } catch (error) {
    console.error("Error topping up agent wallet:", error);
    res.status(500).json({
      success: false,
      message: "Failed to top up wallet",
      error: error.message,
    });
  }
};

// GET all cashiers under admin's agents (admin only)
export const getAllCashiersForAdmin = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const { page = 1, limit = 50, search, isActive, agentId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get all agents created by this admin
    const agents = await User.find({ role: "agent", createdBy: req.user._id }).select("_id");
    const agentIds = agents.map(a => a._id);

    // Build query - cashiers under admin's agents
    const query = { role: "cashier", createdBy: { $in: agentIds } };

    // Filter by specific agent if provided
    if (agentId) {
      query.createdBy = agentId;
    }

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
        .select("-pin")
        .populate("createdBy", "name phoneNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    // Get wallet balances
    const wallets = await Wallet.find({ user: { $in: cashiers.map(c => c._id) } }).lean();
    const walletMap = {};
    wallets.forEach(w => {
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
        role: user.role,
        sharePercent: user.sharePercent || 10,
        walletBalance: walletMap[String(user._id)] || 0,
        agentId: user.createdBy ? String(user.createdBy._id) : null,
        agentName: user.createdBy?.name || "N/A",
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
    console.error("Error fetching cashiers for admin:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cashiers",
      error: error.message,
    });
  }
};
