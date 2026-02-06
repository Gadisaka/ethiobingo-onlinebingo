import express from "express";
import {
  getAllSubAdmins,
  getSubAdmin,
  createSubAdmin,
  updateSubAdmin,
  deleteSubAdmin,
  topUpAgentWallet,
  getAllCashiersForAdmin,
} from "../controller/subAdmin.controller.js";
import { verifyToken } from "../controller/auth.controller.js";

const router = express.Router();

// All routes require authentication and admin role
router.use(verifyToken);

// GET /api/sub-admins - Get all agents (for admin)
router.get("/", getAllSubAdmins);

// GET /api/sub-admins/all-cashiers - Get all cashiers under admin's agents
router.get("/all-cashiers", getAllCashiersForAdmin);

// GET /api/sub-admins/:id - Get single agent
router.get("/:id", getSubAdmin);

// POST /api/sub-admins - Create new agent
router.post("/", createSubAdmin);

// POST /api/sub-admins/:id/topup - Top up agent wallet (with share multiplier)
router.post("/:id/topup", topUpAgentWallet);

// PUT /api/sub-admins/:id - Update agent
router.put("/:id", updateSubAdmin);

// DELETE /api/sub-admins/:id - Delete agent
router.delete("/:id", deleteSubAdmin);

export default router;
