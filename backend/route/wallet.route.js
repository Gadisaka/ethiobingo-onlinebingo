import express from "express";
import { verifyToken } from "../controller/auth.controller.js";
import { getMyWallet, getWalletTransactions } from "../controller/wallet.controller.js";

const router = express.Router();

router.get("/me", verifyToken, getMyWallet);
router.get("/transactions", verifyToken, getWalletTransactions);

export default router;
