import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../constant";
import { io } from "socket.io-client";
import {
  Star as StarIcon,
  Users,
  Coins,
  Loader2,
  Check,
  X,
  UserCheck,
  UserX,
  Play,
  Clock,
} from "lucide-react";

let socketRef = null;

export default function CashierApproval() {
  const { roomId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [pendingPlayers, setPendingPlayers] = useState([]);
  const [approvedPlayers, setApprovedPlayers] = useState([]);
  const [roomInfo, setRoomInfo] = useState(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [processingPlayer, setProcessingPlayer] = useState(null);
  const [error, setError] = useState(null);

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

  // Redirect if not logged in or not a cashier
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
    if (!loading && user && user.role !== "cashier") {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  // Connect to socket and fetch initial data
  useEffect(() => {
    if (!roomId || !user) return;

    // Fetch initial room state
    const fetchRoomState = async () => {
      try {
        setLoadingRoom(true);
        const res = await fetch(`${API_URL}/api/user-rooms/pending/${roomId}`);
        const data = await res.json();
        if (res.ok) {
          setPendingPlayers(data.pendingPlayers || []);
          setApprovedPlayers(data.players || []);
          setRoomInfo(data.room);
        }
      } catch (err) {
        console.error("Error fetching room state:", err);
      } finally {
        setLoadingRoom(false);
      }
    };

    fetchRoomState();

    // Connect to socket
    socketRef = io(`${API_URL}/user-rooms`, { transports: ["websocket"] });

    // Join approval room
    socketRef.emit("join-approval-room", {
      roomId,
      userId: user._id || user.id,
    });

    // Listen for new join requests
    socketRef.on("new-join-request", ({ player }) => {
      console.log("New join request:", player);
    });

    // Listen for updated player lists
    socketRef.on("pending-players-update", ({ pendingPlayers: pending, players: approved }) => {
      setPendingPlayers(pending || []);
      setApprovedPlayers(approved || []);
    });

    // Listen for initial state
    socketRef.on("approval-room-state", ({ pendingPlayers: pending, players: approved, room }) => {
      setPendingPlayers(pending || []);
      setApprovedPlayers(approved || []);
      setRoomInfo(room);
      setLoadingRoom(false);
    });

    // Listen for errors
    socketRef.on("approval-error", ({ message }) => {
      setError(message);
      setProcessingPlayer(null);
    });

    return () => {
      if (socketRef) {
        socketRef.disconnect();
        socketRef = null;
      }
    };
  }, [roomId, user]);

  // Approve a player
  const handleApprove = (playerId) => {
    if (!socketRef || !user) return;
    setProcessingPlayer(playerId);
    setError(null);
    socketRef.emit("approve-player", {
      roomId,
      playerId,
      cashierId: user._id || user.id,
    });
    setTimeout(() => setProcessingPlayer(null), 500);
  };

  // Reject a player
  const handleReject = (playerId) => {
    if (!socketRef || !user) return;
    setProcessingPlayer(playerId);
    setError(null);
    socketRef.emit("reject-player", {
      roomId,
      playerId,
      cashierId: user._id || user.id,
    });
    setTimeout(() => setProcessingPlayer(null), 500);
  };

  // Start the game (navigate to waiting room)
  const handleStartGame = () => {
    if (!socketRef || !user) return;
    
    if (approvedPlayers.length < 2) {
      setError("Need at least 2 players to start the game.");
      return;
    }
    
    // Notify all approved players to move to waiting room
    socketRef.emit("start-approved-game", {
      roomId,
      cashierId: user._id || user.id,
    });
    
    // Navigate to waiting room
    navigate(`/friends/waiting/${roomId}`);
  };

  // Cancel the game
  const handleCancelGame = () => {
    if (!socketRef || !user) return;
    
    socketRef.emit("cancel-game", {
      roomId,
      cashierId: user._id || user.id,
    });
    
    // Navigate back to home
    navigate("/");
  };

  if (loading || loadingRoom) {
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

  if (!user || user.role !== "cashier") {
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

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-2 text-emerald-100">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-amber-200/80">
            <Users className="h-3.5 w-3.5" />
            Player Approval
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Approve Players
          </h1>
          {roomInfo && (
            <div className="flex items-center gap-4 text-sm text-emerald-200/70">
              <div className="flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-amber-400" />
                <span>{roomInfo.stake} Birr</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span>{approvedPlayers.length} / {roomInfo.max_players} players</span>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Pending Players */}
        <div className="rounded-3xl border border-amber-500/30 bg-slate-900/70 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-amber-100">
              Pending Requests ({pendingPlayers.length})
            </h2>
          </div>

          {pendingPlayers.length === 0 ? (
            <div className="text-center py-8 text-emerald-200/50">
              <Clock className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>No pending requests</p>
              <p className="text-xs mt-1">Players will appear here when they request to join</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingPlayers.map((player) => (
                <div
                  key={player._id}
                  className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold">
                        {player.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="font-medium text-amber-100">{player.name}</p>
                        <p className="text-xs text-amber-200/50">{player.phoneNumber}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Cartela Count & Expected Payment */}
                  <div className="flex items-center gap-4 mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="flex-1">
                      <p className="text-xs text-amber-200/60 mb-0.5">Cartelas</p>
                      <p className="text-lg font-bold text-amber-100">
                        {player.requestedCartelas || 1}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-amber-500/30" />
                    <div className="flex-1">
                      <p className="text-xs text-amber-200/60 mb-0.5">Expected Cash</p>
                      <p className="text-lg font-bold text-emerald-300">
                        {player.expectedPayment || (roomInfo?.stake || 0)} Birr
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(player._id)}
                      disabled={processingPlayer === player._id}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                    >
                      {processingPlayer === player._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(player._id)}
                      disabled={processingPlayer === player._id}
                      className="flex items-center gap-1.5 rounded-xl bg-red-500/20 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                    >
                      {processingPlayer === player._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserX className="h-4 w-4" />
                      )}
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approved Players */}
        <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Check className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-emerald-100">
              Approved Players ({approvedPlayers.length})
            </h2>
          </div>

          {approvedPlayers.length === 0 ? (
            <div className="text-center py-8 text-emerald-200/50">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>No approved players yet</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {approvedPlayers.map((player) => (
                <div
                  key={player._id}
                  className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold">
                    {player.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <span className="text-sm font-medium text-emerald-200">{player.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleStartGame}
            disabled={approvedPlayers.length < 2}
            className="flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5 text-lg font-bold text-white shadow-[0_20px_45px_rgba(16,185,129,0.35)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_26px_60px_rgba(16,185,129,0.45)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Play className="h-6 w-6" />
            Start Game ({approvedPlayers.length} players)
          </button>
          
          {approvedPlayers.length < 2 && (
            <p className="text-center text-sm text-emerald-200/50">
              Need at least 2 players to start the game
            </p>
          )}
          
          <button
            onClick={handleCancelGame}
            className="flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition-colors"
          >
            <X className="h-5 w-5" />
            Cancel Game
          </button>
        </div>
      </div>
    </div>
  );
}
