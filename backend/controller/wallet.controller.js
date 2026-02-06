import mongoose from "mongoose";
import Wallet from "../model/wallet.js";
import User from "../model/user.js";
import WalletTransaction from "../model/walletTransaction.js";

export const getMyWallet = async (req, res) => {
  try {
    // Admin users do not have wallets
    if (req.user.role === "admin") {
      return res.status(403).json({
        message: "Admin users do not have wallets",
        balance: 0,
        bonus: 0,
        total: 0,
      });
    }

    const userId = String(req.user._id);
    let wallet =
      (await Wallet.findOne({ user: userId })) ||
      (req.user.wallet ? await Wallet.findById(req.user.wallet) : null);

    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        bonus: 0,
      });
    } else {
      // Ensure numeric fields
      if (typeof wallet.balance !== "number") wallet.balance = 0;
      if (typeof wallet.bonus !== "number") wallet.bonus = 0;
      await wallet.save();
    }

    // Back-link the wallet to the user if missing
    if (!req.user.wallet || String(req.user.wallet) !== String(wallet._id)) {
      await User.findByIdAndUpdate(userId, { $set: { wallet: wallet._id } });
    }

    const response = {
      balance: wallet.balance,
      bonus: wallet.bonus,
      total: Number(wallet.balance || 0) + Number(wallet.bonus || 0),
      walletId: wallet._id,
    };
    res.json(response);
  } catch (err) {
    console.error("[wallet.controller] getMyWallet error:", err.message);
    res.status(500).json({ message: "Failed to load wallet" });
  }
};

// GET wallet transaction history
export const getWalletTransactions = async (req, res) => {
  try {
    const userIdStr = String(req.user._id);
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    // Build query that matches both ObjectId and string formats
    let userQuery;
    if (mongoose.Types.ObjectId.isValid(userIdStr)) {
      const userIdObj = new mongoose.Types.ObjectId(userIdStr);
      userQuery = { $or: [{ user: userIdObj }, { user: userIdStr }] };
    } else {
      userQuery = { user: userIdStr };
    }

    const transactions = await WalletTransaction.find(userQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await WalletTransaction.countDocuments(userQuery);

    res.json({
      transactions: transactions.map((tx) => ({
        id: String(tx._id),
        amount: tx.amount,
        type: tx.type,
        balanceAfter: tx.balanceAfter,
        meta: tx.meta || {},
        createdAt: tx.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(
      "[wallet.controller] getWalletTransactions error:",
      err.message
    );
    res.status(500).json({ message: "Failed to load transactions" });
  }
};
