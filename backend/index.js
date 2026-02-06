import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import {
  loadSystemRoomsFromDB,
  registerRoomHandlers,
  initPeriodicRoomCleanup,
} from "./sockets/roomHandlers.js";

import userRoutes from "./route/user.route.js";
import authRoutes from "./route/auth.route.js";
import gameRoutes from "./route/game.route.js";
import walletRoutes from "./route/wallet.route.js";
import settingsRoutes from "./route/settings.route.js";
import subAdminRoutes from "./route/subAdmin.route.js";
import cashierRoutes from "./route/cashier.route.js";
import revenueRoutes from "./route/revenue.route.js";
import userRoomRouter from "./userRoomSystem/userRoom.route.js";
import initUserRoomSocket from "./userRoomSystem/userRoom.socket.js";
import { initRoomCleanupCron } from "./cron/roomCleanup.js";
import { initLeaderboardResetCron } from "./cron/leaderboardReset.js";
import pointsRoutes from "./route/points.route.js";
import spinRoutes from "./route/spin.route.js";
import leaderboardRoutes from "./route/leaderboard.route.js";
import adminRoutes from "./route/admin.route.js";
import cashierSubscriptionRoutes from "./route/cashierSubscription.route.js";
import bonusRoutes from "./route/bonus.route.js";
import uploadRoutes from "./config/uploadRoute.js";

dotenv.config();
connectDB();

const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/sub-admins", subAdminRoutes);
app.use("/api/cashiers", cashierRoutes);
app.use("/api/revenues", revenueRoutes);
app.use("/api/user-rooms", userRoomRouter);
app.use("/api/user", pointsRoutes);
app.use("/api/spins", spinRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cashier-subscription", cashierSubscriptionRoutes);
app.use("/api/bonus", bonusRoutes);
app.use("/api/upload", uploadRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Load existing system-hosted rooms from database (demand-based system)
// No auto-creation - rooms are created when players join
loadSystemRoomsFromDB()
  .then((rooms) => {
    if (rooms.length > 0) {
      console.log(
        "✅ Loaded existing system rooms:",
        rooms.map((r) => `${r.id} (${r.betAmount})`).join(", ")
      );
    } else {
      console.log(
        "✅ No existing system rooms found. Rooms will be created on-demand."
      );
    }
  })
  .catch((err) => {
    console.error("❌ Failed to load system rooms:", err.message);
  });

// Initialize cron jobs
initRoomCleanupCron();
initLeaderboardResetCron();

// Initialize periodic room cleanup (empty waiting rooms)
initPeriodicRoomCleanup(io);

// Initialize user-hosted rooms socket
initUserRoomSocket(io);

// Socket.IO connection setup
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);
  registerRoomHandlers(io, socket);

  socket.on("disconnect", (reason) => {
    console.log("🔌 Client disconnected:", socket.id, "reason:", reason);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
