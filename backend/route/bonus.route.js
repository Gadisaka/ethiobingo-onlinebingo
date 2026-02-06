import express from "express";
import { getBonusConfig, updateBonusConfig } from "../controller/bonus.controller.js";

const router = express.Router();

// Get bonus config for a cashier
router.get("/:cashierId", getBonusConfig);

// Update bonus config for a cashier
router.put("/:cashierId", updateBonusConfig);

export default router;
