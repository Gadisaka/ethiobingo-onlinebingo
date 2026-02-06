import Revenue from "../model/revenue.js";
import { verifyToken } from "./auth.controller.js";

// GET /api/revenues - Admin only list revenues with pagination and filters
export const getRevenues = async (req, res) => {
  try {
    // Admin only
    if (!req.user || req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }

    const {
      page = 1,
      limit = 50,
      reason,
      startDate,
      endDate,
      search,
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (reason) query.reason = reason;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      // Search by gameRoom id (string) or reason
      query.$or = [
        { gameRoom: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
      ];
    }

    const [revenues, total, totalsAgg, byReasonAgg] = await Promise.all([
      Revenue.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Revenue.countDocuments(query),
      Revenue.aggregate([
        { $match: query },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
      Revenue.aggregate([
        { $match: query },
        { $group: { _id: "$reason", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
    ]);

    const totalAmount = totalsAgg[0]?.totalAmount || 0;
    const byReason = {};
    byReasonAgg.forEach((r) => {
      byReason[r._id] = { amount: r.amount, count: r.count };
    });

    res.json({
      success: true,
      revenues,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      summary: {
        totalAmount,
        byReason,
      },
    });
  } catch (error) {
    console.error("Error fetching revenues:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch revenues",
      error: error.message,
    });
  }
};


