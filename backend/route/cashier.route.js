import express from "express";
import {
  getAllCashiers,
  getCashier,
  createCashier,
  updateCashier,
  deleteCashier,
  topUpCashierWallet,
  getMyWinCut,
  updateMyWinCut,
} from "../controller/cashier.controller.js";
import { verifyToken } from "../controller/auth.controller.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Cashier-only routes for managing their own win cut
// GET /api/cashiers/my-wincut - Get my win cut (cashier only)
router.get("/my-wincut", getMyWinCut);

// PUT /api/cashiers/my-wincut - Update my win cut (cashier only)
router.put("/my-wincut", updateMyWinCut);

// Agent routes for managing cashiers
// GET /api/cashiers - Get all cashiers (for this agent)
router.get("/", getAllCashiers);

// GET /api/cashiers/:id - Get single cashier
router.get("/:id", getCashier);

// POST /api/cashiers - Create new cashier
router.post("/", createCashier);

// POST /api/cashiers/:id/topup - Top up cashier wallet (with share multiplier)
router.post("/:id/topup", topUpCashierWallet);

// PUT /api/cashiers/:id - Update cashier
router.put("/:id", updateCashier);

// DELETE /api/cashiers/:id - Delete cashier
router.delete("/:id", deleteCashier);

export default router;
