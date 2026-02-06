import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { API_URL } from "../constant";
import { io } from "socket.io-client";
import {
  Star as StarIcon,
  ArrowLeft,
  Coins,
  Users,
  Loader2,
  Sparkles,
  GamepadIcon,
  Clock,
} from "lucide-react";
import WalletBadge from "../components/WalletBadge";

// Socket reference for this component
let socketRef = null;

export default function CashierRoom() {
  const { cashierId } = useParams();
  const location = useLocation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Cashier info from navigation state or will be fetched
  const [cashier, setCashier] = useState(location.state?.cashier || null);
  const [invitations, setInvitations] = useState([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [joiningRoom, setJoiningRoom] = useState(null);
  const [error, setError] = useState(null);

  // Cartela selector modal state
  const [showCartelaModal, setShowCartelaModal] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [numberOfCartelas, setNumberOfCartelas] = useState(1);

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

  // Fetch cashier info if not in state
  useEffect(() => {
    const fetchCashierInfo = async () => {
      if (cashier) return;
      try {
        // We don't have the code, so we need to get it from subscriptions
        const res = await fetch(
          `${API_URL}/api/cashier-subscription/my-subscriptions/${
            user?._id || user?.id
          }`
        );
        const data = await res.json();
        if (res.ok && data.cashiers) {
          const found = data.cashiers.find((c) => c._id === cashierId);
          if (found) {
            setCashier(found);
          }
        }
      } catch (err) {
        console.error("Error fetching cashier info:", err);
      }
    };

    if (user && !cashier) {
      fetchCashierInfo();
    }
  }, [user, cashier, cashierId]);

  // Fetch initial invitations
  const fetchInvitations = useCallback(async () => {
    if (!cashierId) return;
    try {
      setLoadingInvitations(true);
      const res = await fetch(
        `${API_URL}/api/cashier-subscription/invitations/${cashierId}`
      );
      const data = await res.json();
      if (res.ok) {
        setInvitations(data.invitations || []);
      }
    } catch (err) {
      console.error("Error fetching invitations:", err);
    } finally {
      setLoadingInvitations(false);
    }
  }, [cashierId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // Connect to socket for real-time invitations
  useEffect(() => {
    if (!cashierId || !user) return;

    // Connect to user-rooms namespace
    socketRef = io(`${API_URL}/user-rooms`, {
      transports: ["websocket"],
    });

    // Subscribe to this cashier's room for invitations
    socketRef.emit("subscribe-to-cashier", {
      cashierId,
      userId: user._id || user.id,
    });

    // Listen for new game invitations
    socketRef.on("game-invitation", (invitation) => {
      console.log("Received game invitation:", invitation);
      setInvitations((prev) => {
        // Avoid duplicates
        const exists = prev.some((inv) => inv.roomId === invitation.roomId);
        if (exists) return prev;
        return [invitation, ...prev];
      });
    });

    // Listen for active invitations on connect
    socketRef.on("active-invitations", ({ invitations: activeInvitations }) => {
      setInvitations(activeInvitations || []);
    });

    // Listen for invitation expiry (game started)
    socketRef.on("invitation-expired", ({ roomId }) => {
      setInvitations((prev) => prev.filter((inv) => inv.roomId !== roomId));
    });

    return () => {
      if (socketRef) {
        socketRef.emit("unsubscribe-from-cashier", { cashierId });
        socketRef.disconnect();
        socketRef = null;
      }
    };
  }, [cashierId, user]);

  // Open cartela selector modal before joining
  const openCartelaSelector = (invitation) => {
    setSelectedInvitation(invitation);
    setNumberOfCartelas(1);
    setShowCartelaModal(true);
  };

  // Handle +/- buttons for cartela count
  const incrementCartelas = () => {
    setNumberOfCartelas((prev) => Math.min(prev + 1, 4));
  };

  const decrementCartelas = () => {
    setNumberOfCartelas((prev) => Math.max(prev - 1, 1));
  };

  // Join a game room (request to join - needs cashier approval)
  const handleJoinRoom = async () => {
    if (!user || !selectedInvitation) return;
    
    // Capture values before closing modal
    const roomId = selectedInvitation.roomId;
    const stake = selectedInvitation?.stake;
    const maxPlayers = selectedInvitation?.maxPlayers;
    const cartelaCount = numberOfCartelas; // Capture current value
    
    setJoiningRoom(roomId);
    setError(null);
    setShowCartelaModal(false);

    console.log(`[CashierRoom] Joining with ${cartelaCount} cartelas, stake: ${stake}`);

    try {
      const res = await fetch(`${API_URL}/api/user-rooms/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          userId: user._id || user.id,
          numberOfCartelas: cartelaCount,
        }),
      });
      const data = await res.json();
      console.log(`[CashierRoom] Join response:`, data);
      if (!res.ok) throw new Error(data.message || "Failed to request join");

      // If already approved, go straight to waiting room
      if (data.status === "approved") {
        navigate(`/friends/waiting/${roomId}`);
        return;
      }

      // Navigate to pending approval page to wait for cashier approval
      navigate(`/pending/${roomId}`, {
        state: {
          roomInfo: {
            stake,
            max_players: maxPlayers,
            numberOfCartelas: cartelaCount,
            expectedPayment: cartelaCount * stake,
          },
          cashierName: cashier?.name || "Cashier",
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setJoiningRoom(null);
      setSelectedInvitation(null);
    }
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
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-slate-900/70 px-6 py-4 text-emerald-200 shadow-[0_20px_45px_rgba(16,185,129,0.25)]">
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
      {/* <WalletBadge /> */}
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
        {/* Back Button & Header */}
        <div className="flex flex-col gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-emerald-200/70 hover:text-emerald-100 transition-colors self-start"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">ወደ ካሸር ዝርዝር</span>
          </button>

          {cashier && (
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/30">
                {cashier.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {cashier.name}
                </h1>
                <p className="text-sm text-emerald-200/60">
                  ኮድ: {cashier.cashierCode}
                </p>
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

        {/* Game Invitations */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-emerald-200/80 uppercase tracking-wider">
              የጨዋታ ግብዣዎች
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-emerald-300/50">
              <Sparkles className="h-3 w-3" />
              Live updates
            </div>
          </div>

          {loadingInvitations ? (
            <div className="flex items-center justify-center gap-2 py-12 text-emerald-200/60">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading invitations...
            </div>
          ) : invitations.length === 0 ? (
            <div className="rounded-3xl border border-emerald-500/20 bg-slate-900/50 p-10 text-center">
              <Clock className="h-14 w-14 mx-auto text-emerald-300/30 mb-4" />
              <p className="text-emerald-200/70 font-medium">
                ጨዋታ ገና አልተጀመረም
              </p>
              <p className="text-emerald-200/40 text-sm mt-2">
                ካሸሩ አዲስ ጨዋታ ሲጀመር እዚህ ያያሉ
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {invitations.map((invitation) => (
                <div
                  key={invitation.roomId}
                  className="relative overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-slate-900/90 to-emerald-900/30 p-6 shadow-[0_20px_45px_rgba(16,185,129,0.15)]"
                >
                  {/* Glow effect */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl" />

                  <div className="relative">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4">
                      <GamepadIcon className="h-3 w-3" />
                      አዲስ ጨዋታ አለ
                    </div>

                    {/* Game Info */}
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <Coins className="h-5 w-5 text-amber-400" />
                          <span className="text-2xl font-bold text-white">
                            {invitation.stake} ብር
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-200/60 text-sm">
                          <Users className="h-4 w-4" />
                          <span>Max {invitation.maxPlayers} ተጫዋቾች</span>
                        </div>
                      </div>
                    </div>

                    {/* Join Button - Opens Cartela Selector */}
                    <button
                      onClick={() => openCartelaSelector(invitation)}
                      disabled={joiningRoom === invitation.roomId}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 text-base font-bold text-white shadow-[0_10px_30px_rgba(16,185,129,0.35)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_15px_40px_rgba(16,185,129,0.45)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {joiningRoom === invitation.roomId ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <GamepadIcon className="h-5 w-5" />
                          ይግቡ
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cartela Selector Modal */}
      {showCartelaModal && selectedInvitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-emerald-500/30 bg-slate-900/95 p-6 shadow-[0_24px_60px_rgba(16,185,129,0.25)]">
            {/* Close button */}
            <button
              onClick={() => {
                setShowCartelaModal(false);
                setSelectedInvitation(null);
              }}
              className="absolute top-4 right-4 text-emerald-200/60 hover:text-emerald-100"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-2xl bg-emerald-500/20 p-3">
                <GamepadIcon className="h-6 w-6 text-emerald-300" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">ጨዋታ ይቀላቀሉ</h2>
                <p className="text-sm text-emerald-200/60">
                  ስንት ካርቴላ እንደሚፈልጉ ይምረጡ
                </p>
              </div>
            </div>

            {/* Cartela Count Selector */}
            <div className="mb-6">
              <label className="text-sm text-emerald-200/80 mb-3 block">
                የካርቴላ ብዛት
              </label>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={decrementCartelas}
                  disabled={numberOfCartelas <= 1}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-slate-800 text-2xl font-bold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <div className="flex h-16 w-20 items-center justify-center rounded-2xl border border-emerald-400/50 bg-emerald-500/10 text-3xl font-bold text-white">
                  {numberOfCartelas}
                </div>
                <button
                  onClick={incrementCartelas}
                  disabled={numberOfCartelas >= 4}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-slate-800 text-2xl font-bold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            {/* Cost Summary */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-amber-200/70">
                  የአንድ ካርቴላ ዋጋ
                </span>
                <span className="text-amber-200 font-medium">
                  {selectedInvitation.stake} ብር
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-amber-200/70">
                  ብዛት
                </span>
                <span className="text-amber-200 font-medium">
                  × {numberOfCartelas}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-amber-500/20 pt-3">
                <span className="text-base font-semibold text-amber-100">
                  የሚከፍሉት ጠቅላላ ዋጋ
                </span>
                <span className="text-xl font-bold text-emerald-300">
                  {numberOfCartelas * selectedInvitation.stake} ብር
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleJoinRoom}
              disabled={joiningRoom}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 text-base font-bold text-white shadow-[0_10px_30px_rgba(16,185,129,0.35)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_15px_40px_rgba(16,185,129,0.45)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {joiningRoom ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <GamepadIcon className="h-5 w-5" />
                  ጨዋታውን ይቀላቀሉ
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
