import express from "express";
import {
  updateLeaderboardConfig,
  getLeaderboardConfig,
  getLiveLeaderboard,
  getSpinConfig,
  updateSpinConfig,
} from "../controller/leaderboard.controller.js";
import { verifyToken } from "../controller/auth.controller.js";

const router = express.Router();

// All admin routes require authentication
router.use(verifyToken);

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Access denied. Admin role required.",
    });
  }
};

// Leaderboard configuration routes
router.get("/leaderboard-config", requireAdmin, getLeaderboardConfig);
router.put("/leaderboard-config", requireAdmin, updateLeaderboardConfig);
router.get("/leaderboard/live", requireAdmin, getLiveLeaderboard);

// Spin configuration routes
router.get("/spin-config", requireAdmin, getSpinConfig);
router.put("/spin-config", requireAdmin, updateSpinConfig);

export default router;

