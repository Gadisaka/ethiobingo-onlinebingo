import express from "express";
import {
  searchCashiers,
  getCashierByCode,
  subscribeToCashier,
  unsubscribeFromCashier,
  getMySubscriptions,
  getCashierSubscribers,
  getCashierInvitations,
  assignCashierCode,
  getOrCreateMyCashierCode,
  resetCashierCode,
} from "../controller/cashierSubscription.controller.js";

const router = express.Router();

// Search cashiers
router.get("/search", searchCashiers);

// Get cashier by code
router.get("/cashier/:code", getCashierByCode);

// Subscribe to a cashier
router.post("/subscribe", subscribeToCashier);

// Unsubscribe from a cashier
router.post("/unsubscribe", unsubscribeFromCashier);

// Get user's subscriptions
router.get("/my-subscriptions/:userId", getMySubscriptions);

// Get subscribers for a cashier
router.get("/subscribers/:cashierId", getCashierSubscribers);

// Get active invitations for a cashier
router.get("/invitations/:cashierId", getCashierInvitations);

// Assign cashier code
router.post("/assign-code", assignCashierCode);

// Get or create cashier code for current user
router.get("/my-code/:userId", getOrCreateMyCashierCode);

// Reset cashier code and remove all subscribers
router.post("/reset-code/:userId", resetCashierCode);

export default router;

