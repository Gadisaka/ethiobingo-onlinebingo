import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { API_URL } from "../constant";
import { io } from "socket.io-client";
import {
  Star as StarIcon,
  Clock,
  Coins,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from "lucide-react";

let socketRef = null;

export default function PlayerPendingApproval() {
  const { roomId } = useParams();
  const location = useLocation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState("pending"); // pending, approved, rejected, cancelled
  const [roomInfo, setRoomInfo] = useState(location.state?.roomInfo || null);
  const [cashierName, setCashierName] = useState(location.state?.cashierName || "Cashier");

  const backgroundStars = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 5 + 2,
      opacity: Math.random() * 0.4 + 0.2,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 2,
    }));
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [loading, user, navigate]);

  // Connect to socket and listen for approval/rejection
  useEffect(() => {
    if (!roomId || !user) return;

    const userId = user._id || user.id;

    // Check initial status and fetch room info if needed
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/user-rooms/status/${roomId}/${userId}`);
        const data = await res.json();
        if (res.ok) {
          if (data.status === "approved") {
            setStatus("approved");
            // Auto-navigate to waiting room after short delay
            setTimeout(() => navigate(`/friends/waiting/${roomId}`), 1500);
          } else if (data.status === "rejected") {
            setStatus("rejected");
          }
        }

        // Fetch room info if not in state (e.g., on page refresh)
        if (!roomInfo || !roomInfo.numberOfCartelas) {
          const roomRes = await fetch(`${API_URL}/api/user-rooms/pending/${roomId}`);
          const roomData = await roomRes.json();
          if (roomRes.ok && roomData.room) {
            const playerCartelaCount = roomData.playerCartelaRequests?.[userId] || 1;
            setRoomInfo({
              stake: roomData.room.stake,
              max_players: roomData.room.max_players,
              numberOfCartelas: playerCartelaCount,
              expectedPayment: playerCartelaCount * roomData.room.stake,
            });
          }
        }
      } catch (err) {
        console.error("Error checking status:", err);
      }
    };

    checkStatus();

    // Connect to socket
    socketRef = io(`${API_URL}/user-rooms`, { transports: ["websocket"] });

    // Join approval room
    socketRef.emit("join-approval-room", { roomId, userId });

    // Request to join (in case not already requested)
    socketRef.emit("request-to-join", {
      roomId,
      userId,
      userName: user.name,
    });

    // Listen for approval
    socketRef.on("player-approved", ({ playerId }) => {
      if (playerId === userId || String(playerId) === String(userId)) {
        setStatus("approved");
        // Auto-navigate to waiting room
        setTimeout(() => navigate(`/friends/waiting/${roomId}`), 1500);
      }
    });

    // Listen for rejection
    socketRef.on("player-rejected", ({ playerId }) => {
      if (playerId === userId || String(playerId) === String(userId)) {
        setStatus("rejected");
      }
    });

    // Listen for game start (cashier started the game)
    socketRef.on("game-approved-start", ({ roomId: startedRoomId }) => {
      if (startedRoomId === roomId && status === "approved") {
        navigate(`/friends/waiting/${roomId}`);
      }
    });

    // Listen for initial state - merge with existing roomInfo to preserve cartela count
    socketRef.on("approval-room-state", ({ room, playerCartelaRequests }) => {
      if (room) {
        const userId = user._id || user.id;
        const playerCartelaCount = playerCartelaRequests?.[userId] || roomInfo?.numberOfCartelas || 1;
        setRoomInfo(prev => ({
          ...prev,
          stake: room.stake,
          max_players: room.max_players,
          numberOfCartelas: playerCartelaCount,
          expectedPayment: playerCartelaCount * room.stake,
        }));
      }
    });

    // Listen for game cancellation
    socketRef.on("game-cancelled", ({ roomId: cancelledRoomId }) => {
      if (cancelledRoomId === roomId) {
        setStatus("cancelled");
      }
    });

    return () => {
      if (socketRef) {
        socketRef.disconnect();
        socketRef = null;
      }
    };
  }, [roomId, user, navigate, status]);

  // Go back
  const handleGoBack = () => {
    navigate("/");
  };

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
        <div className="absolute -top-48 -right-32 h-[420px] w-[420px] rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="absolute -bottom-48 -left-24 h-[520px] w-[520px] rounded-full bg-teal-500/20 blur-[140px]" />
        <div className="absolute inset-0 pointer-events-none">
          {backgroundStars.map((star) => (
            <StarIcon
              key={star.id}
              className="absolute text-emerald-200/40"
              style={{
                left: `${star.left}%`,
                top: `${star.top}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                opacity: star.opacity,
                animation: `twinkle ${star.duration}s ease-in-out infinite`,
                animationDelay: `${star.delay}s`,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-slate-900/70 px-6 py-4 text-emerald-200">
            <Loader2 className="h-6 w-6 animate-spin" />
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
      <div className="absolute -top-48 -right-32 h-[420px] w-[420px] rounded-full bg-emerald-500/25 blur-3xl" />
      <div className="absolute -bottom-52 -left-32 h-[520px] w-[520px] rounded-full bg-teal-500/20 blur-[140px]" />
      <div className="absolute inset-0 pointer-events-none">
        {backgroundStars.map((star) => (
          <StarIcon
            key={star.id}
            className="absolute text-emerald-200/40"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animation: `twinkle ${star.duration}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center justify-center min-h-screen gap-6 px-4 sm:px-6 py-8">
        {/* Status Card */}
        {status === "pending" && (
          <div className="w-full rounded-3xl border border-amber-500/30 bg-slate-900/80 p-8 text-center backdrop-blur-sm">
            <div className="relative mx-auto mb-6 h-20 w-20">
              <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
              <div className="relative h-full w-full rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Clock className="h-10 w-10 text-white" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">
              Waiting for Approval
            </h1>
            <p className="text-emerald-200/70 mb-6">
              ክፍያው እስኪረጋገጥ በትእግስት ይጠብቁ...
            </p>
            
            {roomInfo && (
              <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-amber-200/70">የካርቴላ ብዛት</span>
                  <span className="text-lg font-bold text-amber-100">
                    {roomInfo.numberOfCartelas || 1}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-amber-200/70">የአንድ ካርቴላ ዋጋ</span>
                  <span className="text-amber-200 font-medium">
                    {roomInfo.stake} ብር
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-amber-500/20">
                  <span className="text-base font-semibold text-amber-100">የሚከፍሉት ጠቅላላ ዋጋ</span>
                  <span className="text-xl font-bold text-emerald-300">
                    {roomInfo.expectedPayment || roomInfo.stake} ብር
                  </span>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-200/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>ትንሽ ይጠብቁ...</span>
            </div>
          </div>
        )}

        {status === "approved" && (
          <div className="w-full rounded-3xl border border-emerald-500/30 bg-slate-900/80 p-8 text-center backdrop-blur-sm">
            <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-white" />
            </div>
            
            <h1 className="text-2xl font-bold text-emerald-300 mb-2">
              ተሳክቷል!
            </h1>
            <p className="text-emerald-200/70 mb-6">
              ወደ ጨዋታው ፔጅ...
            </p>
            
            <div className="flex items-center justify-center gap-2 text-emerald-300">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Redirecting...</span>
            </div>
          </div>
        )}

        {status === "rejected" && (
          <div className="w-full rounded-3xl border border-red-500/30 bg-slate-900/80 p-8 text-center backdrop-blur-sm">
            <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center">
              <XCircle className="h-12 w-12 text-white" />
            </div>
            
            <h1 className="text-2xl font-bold text-red-300 mb-2">
              አልተሳካም!
            </h1>
            <p className="text-emerald-200/70 mb-6">
              ክፍያው አልፈጸሙም 
            </p>
            
            <button
              onClick={handleGoBack}
              className="flex items-center justify-center gap-2 mx-auto rounded-2xl bg-emerald-500/20 px-6 py-3 text-emerald-200 font-medium hover:bg-emerald-500/30 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              ተመለስ
            </button>
          </div>
        )}

        {status === "cancelled" && (
          <div className="w-full rounded-3xl border border-gray-500/30 bg-slate-900/80 p-8 text-center backdrop-blur-sm">
            <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-gradient-to-br from-gray-400 to-slate-500 flex items-center justify-center">
              <XCircle className="h-12 w-12 text-white" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-300 mb-2">
              ጨዋታው ተሰርዟል
            </h1>
            <p className="text-emerald-200/70 mb-6">
              ካሸሩ ይህን ጨዋታ ሰርዟል
            </p>
            
            <button
              onClick={handleGoBack}
              className="flex items-center justify-center gap-2 mx-auto rounded-2xl bg-emerald-500/20 px-6 py-3 text-emerald-200 font-medium hover:bg-emerald-500/30 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              ተመለስ
            </button>
          </div>
        )}

        {/* Back Button (only show when pending) */}
        {status === "pending" && (
          <button
            onClick={handleGoBack}
            className="flex items-center gap-2 text-emerald-200/60 hover:text-emerald-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">ዝጋ እና ተመለስ</span>
          </button>
        )}
      </div>
    </div>
  );
}
