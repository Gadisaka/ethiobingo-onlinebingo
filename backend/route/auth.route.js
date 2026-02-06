import express from "express";
import {
  sendOTP,
  verifyOTPAndSignup,
  login,
  resendOTP,
  verifyToken,
  getProfile,
  generateFrontendToken,
  tokenLogin,
  getOrCreateLocalPlayer,
} from "../controller/auth.controller.js";

const router = express.Router();

// Public routes
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTPAndSignup);
router.post("/login", login);
router.post("/resend-otp", resendOTP);
router.post("/token-login", tokenLogin);
router.post("/local-player", getOrCreateLocalPlayer);

// Protected routes
router.get("/profile", verifyToken, getProfile);
router.post("/generate-frontend-token", verifyToken, generateFrontendToken);

export default router;
