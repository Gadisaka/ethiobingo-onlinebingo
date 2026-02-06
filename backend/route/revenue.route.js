import express from "express";
import { getRevenues } from "../controller/revenue.controller.js";
import { verifyToken } from "../controller/auth.controller.js";

const router = express.Router();

// Admin only
router.get("/", verifyToken, getRevenues);

export default router;


