import express from "express";
import {
  createUserRoom,
  joinUserRoom,
  getUserRoomById,
  approvePlayer,
  rejectPlayer,
  getPendingPlayers,
  checkApprovalStatus,
} from "./userRoom.controller.js";

const router = express.Router();

router.post("/create", createUserRoom);
router.post("/join", joinUserRoom);
router.get("/get/:roomId", getUserRoomById);
router.post("/approve", approvePlayer);
router.post("/reject", rejectPlayer);
router.get("/pending/:roomId", getPendingPlayers);
router.get("/status/:roomId/:userId", checkApprovalStatus);

export default router;
