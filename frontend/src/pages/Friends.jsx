import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useBanner } from "../context/BannerContext";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../constant";
import { io } from "socket.io-client";
import {
  Star as StarIcon,
  Users,
  Search,
  Loader2,
  UserPlus,
  ChevronRight,
  X,
  Sparkles,
  Coins,
  Copy,
  Check,
  Gamepad2,
  ScanLine,
} from "lucide-react";
import WalletBadge from "../components/WalletBadge";
import NameInputModal from "../components/NameInputModal";
import BannerSlideshow from "../components/BannerSlideshow";
import QRScannerModal from "../components/QRScannerModal";

export default function Friends() {
  const { user, loading, setLocalPlayer } = useAuth();
  const { bannerData, shouldDisplayOn } = useBanner();
  const navigate = useNavigate();

  const isCashier = user?.role === "cashier";

  // State for showing name input modal (for first-time players)
  const [showNameModal, setShowNameModal] = useState(false);

  // Subscribed cashiers list (for regular users)
  const [subscribedCashiers, setSubscribedCashiers] = useState([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Subscribe state
  const [subscribing, setSubscribing] = useState(null);
  const [error, setError] = useState(null);

  // QR Scanner state
  const [showScanner, setShowScanner] = useState(false);

  // Cashier-specific state
  const [cashierCode, setCashierCode] = useState(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stake, setStake] = useState(100);
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);

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

  // Show name modal for first-time players (no user and not a cashier/admin login)
  useEffect(() => {
    if (!loading && !user) {
      // Show name input modal for players
      setShowNameModal(true);
    }
  }, [loading, user]);

  // Handle name submission from modal
  const handleNameSubmit = (name) => {
    setLocalPlayer(name);
    setShowNameModal(false);
  };

  // Fetch subscribed cashiers (for regular users)
  const fetchSubscriptions = useCallback(async () => {
    if (!user || isCashier) return;
    try {
      setLoadingSubscriptions(true);
      const res = await fetch(
        `${API_URL}/api/cashier-subscription/my-subscriptions/${
          user._id || user.id
        }`
      );
      const data = await res.json();
      if (res.ok) {
        setSubscribedCashiers(data.cashiers || []);
      }
    } catch (err) {
      console.error("Error fetching subscriptions:", err);
    } finally {
      setLoadingSubscriptions(false);
    }
  }, [user, isCashier]);

  // Fetch cashier code and subscriber count (for cashiers)
  const fetchCashierData = useCallback(async () => {
    if (!user || !isCashier) return;
    try {
      setLoadingCode(true);
      // Get or create cashier code
      const codeRes = await fetch(
        `${API_URL}/api/cashier-subscription/my-code/${user._id || user.id}`
      );
      const codeData = await codeRes.json();
      if (codeRes.ok) {
        setCashierCode(codeData.cashierCode);
      }

      // Get subscriber count
      const subRes = await fetch(
        `${API_URL}/api/cashier-subscription/subscribers/${user._id || user.id}`
      );
      const subData = await subRes.json();
      if (subRes.ok) {
        setSubscriberCount(subData.count || 0);
      }
    } catch (err) {
      console.error("Error fetching cashier data:", err);
    } finally {
      setLoadingCode(false);
    }
  }, [user, isCashier]);

  useEffect(() => {
    if (isCashier) {
      fetchCashierData();
    } else {
      fetchSubscriptions();
    }
  }, [fetchSubscriptions, fetchCashierData, isCashier]);

  // Copy cashier code
  const handleCopyCode = () => {
    if (cashierCode) {
      navigator.clipboard.writeText(cashierCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Create game room (for cashiers)
  const handleCreateGame = async (e) => {
    e.preventDefault();
    if (!user || !isCashier) return;

    setIsCreatingGame(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/user-rooms/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stake,
          max_players: maxPlayers,
          hostUserId: user._id || user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create room");

      // Broadcast invitation to subscribers via socket
      const socket = io(`${API_URL}/user-rooms`, { transports: ["websocket"] });
      socket.emit("broadcast-game-invitation", {
        cashierId: user._id || user.id,
        invitation: data.invitation,
        cashierName: user.name,
      });
      socket.disconnect();

      // Navigate to approval page (cashier approves players before starting)
      navigate(`/approval/${data.room.roomId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreatingGame(false);
    }
  };

  // Search cashiers
  useEffect(() => {
    const searchCashiers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const res = await fetch(
          `${API_URL}/api/cashier-subscription/search?query=${encodeURIComponent(
            searchQuery
          )}`
        );
        const data = await res.json();
        if (res.ok) {
          // Filter out already subscribed cashiers
          const subscribedIds = new Set(subscribedCashiers.map((c) => c._id));
          const filtered = (data.cashiers || []).filter(
            (c) => !subscribedIds.has(c._id)
          );
          setSearchResults(filtered);
          setShowSearchResults(true);
        }
      } catch (err) {
        console.error("Error searching cashiers:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchCashiers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, subscribedCashiers]);

  // Subscribe to a cashier
  const handleSubscribe = async (cashierCode) => {
    if (!user) return;
    setSubscribing(cashierCode);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/cashier-subscription/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user._id || user.id,
          cashierCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to subscribe");

      // Add to subscribed list
      setSubscribedCashiers((prev) => [...prev, data.cashier]);
      setSearchQuery("");
      setShowSearchResults(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubscribing(null);
    }
  };

  // Handle QR code scan success
  const handleQRScanSuccess = async (scannedCode) => {
    if (!user) {
      return { success: false, message: "Please enter your name first" };
    }

    try {
      const res = await fetch(`${API_URL}/api/cashier-subscription/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user._id || user.id,
          cashierCode: scannedCode,
        }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        return { success: false, message: data.message || "Failed to subscribe" };
      }

      // Add to subscribed list
      setSubscribedCashiers((prev) => [...prev, data.cashier]);
      return { 
        success: true, 
        message: `Subscribed to ${data.cashier?.name || "cashier"}!` 
      };
    } catch (err) {
      return { success: false, message: err.message || "An error occurred" };
    }
  };

  // Open cashier room
  const openCashierRoom = (cashier) => {
    navigate(`/cashier/${cashier._id}`, { state: { cashier } });
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

  // Show name input modal for first-time players
  if (!user && showNameModal) {
    return <NameInputModal onSubmit={handleNameSubmit} />;
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
        {/* Banner Slideshow */}
        {shouldDisplayOn("friends") && (
          <BannerSlideshow
            images={bannerData.images}
            autoPlay={bannerData.autoPlay}
            interval={bannerData.interval}
          />
        )}

        {/* Header */}
        <div className="flex flex-col gap-2 text-emerald-100">
          {/* <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
            <Sparkles className="h-3.5 w-3.5" />
            {isCashier ? "Cashier Console" : "Bingo"}
          </div> */}
          {/* <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {isCashier ? "Create Game" : "My Game Rooms"}
          </h1> */}
          {/* <p className="text-sm text-emerald-200/70">
            {isCashier
              ? "Create games for your subscribed players"
              : "Subscribe to cashiers to receive game invitations"}
          </p> */}
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* CASHIER VIEW */}
        {isCashier ? (
          <>
            {/* Cashier Code Display */}
            <div className="rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-amber-200/70">
                      Your Cashier Code
                    </p>
                    {loadingCode ? (
                      <Loader2 className="h-5 w-5 animate-spin text-amber-300 mt-1" />
                    ) : (
                      <p className="text-2xl font-mono font-bold text-amber-300">
                        {cashierCode || "---"}
                      </p>
                    )}
                  </div>
                </div>
                {cashierCode && (
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-2 rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/30 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </button>
                )}
              </div>
              <p className="text-xs text-amber-200/60">
                Share this code with players so they can subscribe to your
                games. You have{" "}
                <span className="font-bold text-amber-300">
                  {subscriberCount}
                </span>{" "}
                subscribers.
              </p>
            </div>

            {/* Create Game Form */}
            <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-6 shadow-[0_24px_60px_rgba(16,185,129,0.25)]">
              <div className="flex items-center gap-3 text-emerald-100 mb-4">
                <Gamepad2 className="h-6 w-6 text-emerald-300" />
                <h2 className="text-lg font-semibold">Create New Game</h2>
              </div>
              <form onSubmit={handleCreateGame} className="flex flex-col gap-4">
                <label className="text-sm text-emerald-200/80">
                  Stake (Birr)
                  <div className="relative mt-2">
                    <Coins className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-400" />
                    <input
                      type="number"
                      min="1"
                      value={stake}
                      onChange={(e) => setStake(Number(e.target.value))}
                      className="w-full rounded-2xl border border-emerald-500/40 bg-slate-900/70 pl-12 pr-4 py-3 text-emerald-100 placeholder-emerald-300/40 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      required
                    />
                  </div>
                </label>
                <label className="text-sm text-emerald-200/80">
                  Max Players
                  <div className="relative mt-2">
                    <Users className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-300" />
                    <input
                      type="number"
                      min="2"
                      max="20"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                      className="w-full rounded-2xl border border-emerald-500/40 bg-slate-900/70 pl-12 pr-4 py-3 text-emerald-100 placeholder-emerald-300/40 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      required
                    />
                  </div>
                </label>
                <button
                  type="submit"
                  disabled={isCreatingGame}
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-4 text-base font-bold text-white shadow-[0_20px_45px_rgba(16,185,129,0.35)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_26px_60px_rgba(16,185,129,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingGame ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Creating Game...
                    </>
                  ) : (
                    <>
                      <Gamepad2 className="h-5 w-5" />
                      Create Game
                    </>
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          /* REGULAR USER VIEW */
          <>
            {/* Search Bar */}
            <div className="relative">
              <div className="flex gap-2 relative">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-300/60" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="የካሸር ስም ወይንም ኮድ ያስገቡ..."
                    className="w-full rounded-2xl border border-emerald-500/40 bg-slate-900/70 pl-12 pr-10 py-4 text-emerald-100 placeholder-emerald-300/40 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 backdrop-blur-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setShowSearchResults(false);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-300/60 hover:text-emerald-200"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>

                {/* QR Scanner Button */}
                <button
                  onClick={() => setShowScanner(true)}
                  className="flex items-center justify-center rounded-2xl border border-emerald-500/40 bg-slate-900/70 p-4 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-100 hover:border-emerald-400 transition-all active:scale-95 backdrop-blur-sm"
                  title="Scan QR Code"
                >
                  <ScanLine className="h-6 w-6" />
                </button>
              </div>

              {/* Search Results Dropdown */}
              {showSearchResults && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-emerald-500/30 bg-slate-900/95 backdrop-blur-sm shadow-[0_20px_45px_rgba(16,185,129,0.25)] z-20 overflow-hidden">
                  {isSearching ? (
                    <div className="flex items-center justify-center gap-2 p-4 text-emerald-200/70">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-4 text-center text-emerald-200/60 text-sm">
                      ምንም ካሸር አልተገኘም
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {searchResults.map((cashier) => (
                        <div
                          key={cashier._id}
                          className="flex items-center justify-between p-4 border-b border-emerald-500/20 last:border-0 hover:bg-emerald-500/10 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold">
                              {cashier.name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <p className="font-medium text-emerald-100">
                                {cashier.name}
                              </p>
                              <p className="text-xs text-emerald-300/60">
                                ኮድ: {cashier.cashierCode}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSubscribe(cashier.cashierCode)}
                            disabled={subscribing === cashier.cashierCode}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                          >
                            {subscribing === cashier.cashierCode ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserPlus className="h-3.5 w-3.5" />
                            )}
                            ምረጥ
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Subscribed Cashiers List */}
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-emerald-200/80 uppercase tracking-wider">
                የተመረጡ ካሸሮች
              </h2>

              {loadingSubscriptions ? (
                <div className="flex items-center justify-center gap-2 py-8 text-emerald-200/60">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading...
                </div>
              ) : subscribedCashiers.length === 0 ? (
                <div className="rounded-3xl border border-emerald-500/20 bg-slate-900/50 p-8 text-center">
                  <Users className="h-12 w-12 mx-auto text-emerald-300/40 mb-3" />
                  <p className="text-emerald-200/60 text-sm">
                    ምንም ካሸር አልተመረጠም
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {subscribedCashiers.map((cashier) => (
                    <button
                      key={cashier._id}
                      onClick={() => openCashierRoom(cashier)}
                      className="group flex items-center justify-center rounded-2xl border border-emerald-500/30 bg-slate-900/70 p-4 hover:bg-slate-800/70 hover:border-emerald-400/50 transition-all duration-200 text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20">
                          {cashier.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-100 group-hover:text-white transition-colors">
                            {cashier.name}
                          </p>
                          <p className="text-xs text-emerald-300/60">
                            ኮድ: {cashier.cashierCode}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-emerald-300/40 group-hover:text-emerald-200 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleQRScanSuccess}
      />
    </div>
  );
}
