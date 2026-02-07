import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBanner } from "../context/BannerContext";
import { io } from "socket.io-client";
import { API_URL } from "../constant";
// import ConnectionStatus from "../components/ConnectionStatus";
import { bingoCards } from "../libs/BingoCards";
import {
  Star as StarIcon,
  Users,
  Timer as TimerIcon,
  Coins,
  KeyRound,
  Copy,
  Loader2,
  ShieldAlert,
  Sparkles,
  Volume2,
  Grid3X3,
  Gauge,
  ChevronDown,
  Zap,
} from "lucide-react";
import WalletBadge from "../components/WalletBadge";
import BannerSlideshow from "../components/BannerSlideshow";
import { getSoundTypeOptions, getSoundTypeLabel, DEFAULT_SOUND_TYPE } from "../config/audio-config";

//friends

// Use a ref to ensure one socket instance per tab
const userRoomsSocketRef = { current: null };

export default function FriendsWaitingRoom() {
  const { roomid } = useParams();
  const { user } = useAuth();
  const { bannerData, shouldDisplayOn } = useBanner();
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCartelas, setSelectedCartelas] = useState([]);
  const [currentCartelaIndex, setCurrentCartelaIndex] = useState(0);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [takenCartelas, setTakenCartelas] = useState({}); // { cartelaId: { userId, userName } }
  const [selectionError, setSelectionError] = useState(null);
  const [countdownSeconds, setCountdownSeconds] = useState(null);
  const [isSelectionLocked, setIsSelectionLocked] = useState(false);
  const [maxAllowedCartelas, setMaxAllowedCartelas] = useState(1); // Default to 1, will be updated from room data

  // Cashier game settings (sent to server for all players)
  const [soundType, setSoundType] = useState(DEFAULT_SOUND_TYPE);
  const [bingoPattern, setBingoPattern] = useState("1line");
  const [callingSpeed, setCallingSpeed] = useState(4000);

  // Player's auto-mark preference (saved in localStorage, player-side only)
  const [autoMark, setAutoMark] = useState(() => {
    const saved = localStorage.getItem("bingo_auto_mark");
    return saved === "true";
  });

  const navigate = useNavigate();
  const backgroundStars = useMemo(() => {
    return Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 4 + 2,
      opacity: Math.random() * 0.4 + 0.2,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 2,
    }));
  }, []);
  const [copied, setCopied] = useState(false); // Copied helper state

  const renderWithBackground = (content) => (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
      {/* <WalletBadge /> */}
      <div className="absolute -top-48 -right-36 h-[420px] w-[420px] rounded-full bg-emerald-500/25 blur-3xl" />
      <div className="absolute -bottom-48 -left-32 h-[540px] w-[540px] rounded-full bg-teal-500/20 blur-[150px]" />
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
      <div className="relative z-10 w-full">{content}</div>
    </div>
  );

  // Socket Connect (on mount)
  useEffect(() => {
    if (!userRoomsSocketRef.current) {
      userRoomsSocketRef.current = io(`${API_URL}/user-rooms`, {
        transports: ["websocket"],
      });
    }
    const socket = userRoomsSocketRef.current;
    socket.emit("join-waiting-room", {
      roomId: roomid,
      userId: user && (user._id || user.id),
    });
    socket.on("player-joined", ({ players: latestPlayers }) => {
      setPlayers(latestPlayers);
    });
    return () => {
      socket.off("player-joined");
      // Optional: disconnect socket if wanted
      // socket.disconnect();
    };
  }, [roomid, user]);

  // Initial fetch for room and host info
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_URL}/api/user-rooms/get/${roomid}`);
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || "Failed to get room info.");
        setRoom(data.room);
        setPlayers(data.room.players || []);
        // Initialize settings from room data
        if (data.room.soundType) setSoundType(data.room.soundType);
        if (data.room.bingoPattern) setBingoPattern(data.room.bingoPattern);
        if (data.room.callingSpeed) setCallingSpeed(data.room.callingSpeed);
        
        // Get the player's approved cartela limit
        const currentUserId = user?._id || user?.id;
        console.log(`[FriendsWaitingRoom] Current userId: ${currentUserId}`);
        console.log(`[FriendsWaitingRoom] approvedPlayerCartelas:`, data.room.approvedPlayerCartelas);
        
        if (currentUserId && data.room.approvedPlayerCartelas) {
          const approvedCount = data.room.approvedPlayerCartelas[String(currentUserId)];
          console.log(`[FriendsWaitingRoom] approvedCount for this user: ${approvedCount}`);
          if (approvedCount) {
            setMaxAllowedCartelas(approvedCount);
            console.log(`[FriendsWaitingRoom] Set maxAllowedCartelas to ${approvedCount}`);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [roomid, user]);

  // Listen for settings updates
  useEffect(() => {
    if (!userRoomsSocketRef.current) return;
    const socket = userRoomsSocketRef.current;

    const handleSettingsUpdated = ({
      bingoPattern: pattern,
      callingSpeed: speed,
      soundType: sound,
    }) => {
      if (pattern) setBingoPattern(pattern);
      if (speed) setCallingSpeed(speed);
      if (sound) setSoundType(sound);
    };

    socket.on("game-settings-updated", handleSettingsUpdated);

    return () => {
      socket.off("game-settings-updated", handleSettingsUpdated);
    };
  }, []);

  // Listen for game start and countdown events
  useEffect(() => {
    if (!userRoomsSocketRef.current) return;
    const socket = userRoomsSocketRef.current;

    const handleGameStarted = () => {
      setCountdownSeconds(null); // Clear countdown
      navigate(`/playing/${roomid}`);
    };

    const handleGameStartCountdown = ({ roomId, seconds }) => {
      if (roomId === roomid) {
        console.log(`⏰ Game starting in ${seconds} seconds...`);
        setCountdownSeconds(seconds);

        // Lock selection when countdown reaches 5 seconds (will be handled by auto-assign event)
      }
    };

    const handleCartelasAutoAssigned = ({
      roomId,
      assignments,
      allCartelas,
    }) => {
      if (roomId === roomid) {
        console.log("🎲 Cartelas auto-assigned:", assignments);
        setTakenCartelas(allCartelas);

        // Update selected cartelas for current user if they were auto-assigned
        const currentUserId = user?._id || user?.id;
        // Collect ALL cartela IDs assigned to this user (not just the first one)
        const myAssignments = assignments.filter(
          (a) => String(a.userId) === String(currentUserId)
        );
        if (myAssignments.length > 0) {
          const myCartelaIds = myAssignments.map((a) => a.cartelaId).sort((a, b) => a - b);
          setSelectedCartelas(myCartelaIds);
          setIsSelectionLocked(true);
          console.log(
            `✅ Auto-assigned ${myCartelaIds.length} cartela(s) to you: #${myCartelaIds.join(", #")}`
          );
        }
      }
    };

    const handleCartelaSelectionLocked = ({ roomId, lockedPlayerIds }) => {
      if (roomId === roomid) {
        const currentUserId = user?._id || user?.id;
        if (lockedPlayerIds.includes(String(currentUserId))) {
          setIsSelectionLocked(true);
          console.log("🔒 Your cartela selection has been locked");
        }
      }
    };

    const handleGameStartCancelled = ({ roomId, reason }) => {
      if (roomId === roomid) {
        console.log(`❌ Game start cancelled: ${reason}`);
        setCountdownSeconds(null);
        setError(reason || "Game start was cancelled");
        setTimeout(() => setError(null), 3000);
      }
    };

    socket.on("game-started", handleGameStarted);
    socket.on("game-start-countdown", handleGameStartCountdown);
    socket.on("game-start-cancelled", handleGameStartCancelled);
    socket.on("cartelas-auto-assigned", handleCartelasAutoAssigned);
    socket.on("cartela-selection-locked", handleCartelaSelectionLocked);

    return () => {
      socket.off("game-started", handleGameStarted);
      socket.off("game-start-countdown", handleGameStartCountdown);
      socket.off("game-start-cancelled", handleGameStartCancelled);
      socket.off("cartelas-auto-assigned", handleCartelasAutoAssigned);
      socket.off("cartela-selection-locked", handleCartelaSelectionLocked);
    };
  }, [roomid, navigate, user]);

  // Listen for cartela selection/deselection events
  useEffect(() => {
    if (!userRoomsSocketRef.current) return;
    const socket = userRoomsSocketRef.current;

    // Request current cartelas state on mount
    socket.emit("get-cartelas-state", { roomId: roomid });

    const handleCartelaSelected = ({ userId, cartelaId, allCartelas }) => {
      console.log("\n=== RECEIVED cartela-selected ===");
      console.log("UserId:", userId);
      console.log("CartelaId:", cartelaId);
      console.log("allCartelas:", allCartelas);
      console.log("allCartelas keys:", Object.keys(allCartelas));
      console.log("Total cartelas received:", Object.keys(allCartelas).length);

      setTakenCartelas((prevTaken) => {
        console.log(
          "Previous takenCartelas:",
          Object.keys(prevTaken).length,
          "cartelas"
        );
        console.log(
          "Setting new takenCartelas:",
          Object.keys(allCartelas).length,
          "cartelas"
        );
        return allCartelas;
      });

      const currentUserId = user?._id || user?.id;

      if (userId === currentUserId) {
        // Confirm our own selection - ensure it's in our local state
        console.log(`Confirming own selection of cartela #${cartelaId}`);
        setSelectedCartelas((prev) => {
          if (!prev.includes(cartelaId)) {
            const updated = [...prev, cartelaId].sort((a, b) => a - b);
            console.log("Updated own selectedCartelas:", updated);
            return updated;
          }
          console.log("Cartela already in list, current:", prev);
          return prev;
        });
      } else {
        // Another player selected a cartela I had selected, remove it from my selection
        console.log(
          `Player ${userId} selected cartela #${cartelaId}, removing from own selection if present`
        );
        setSelectedCartelas((prev) => prev.filter((id) => id !== cartelaId));
      }
      console.log("=== cartela-selected handled ===\n");
    };

    const handleCartelaDeselected = ({ userId, cartelaId, allCartelas }) => {
      setTakenCartelas(allCartelas);
      const currentUserId = user?._id || user?.id;

      if (userId === currentUserId) {
        // Confirm our own deselection - ensure it's removed from local state
        setSelectedCartelas((prev) => prev.filter((id) => id !== cartelaId));
      }
    };

    const handleCartelasState = ({ allCartelas }) => {
      setTakenCartelas(allCartelas);

      // Sync our own cartelas from server state
      const currentUserId = user?._id || user?.id;
      const myCartelas = Object.keys(allCartelas)
        .filter((cartelaId) => allCartelas[cartelaId].userId === currentUserId)
        .map((id) => parseInt(id))
        .sort((a, b) => a - b);

      if (myCartelas.length > 0) {
        setSelectedCartelas(myCartelas);
      }
    };

    const handleSelectionError = ({ message, cartelaId }) => {
      setSelectionError(message);
      // Remove from local selection
      setSelectedCartelas((prev) => prev.filter((id) => id !== cartelaId));
      setTimeout(() => setSelectionError(null), 3000);
    };

    socket.on("cartela-selected", handleCartelaSelected);
    socket.on("cartela-deselected", handleCartelaDeselected);
    socket.on("cartelas-state", handleCartelasState);
    socket.on("cartela-selection-error", handleSelectionError);

    return () => {
      socket.off("cartela-selected", handleCartelaSelected);
      socket.off("cartela-deselected", handleCartelaDeselected);
      socket.off("cartelas-state", handleCartelasState);
      socket.off("cartela-selection-error", handleSelectionError);
    };
  }, [roomid, user]);

  if (loading)
    return renderWithBackground(
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-slate-900/70 px-6 py-4 text-emerald-200 shadow-[0_20px_45px_rgba(16,185,129,0.25)]">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading waiting room...
        </div>
      </div>
    );

  if (error)
    return renderWithBackground(
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/15 px-6 py-4 text-red-100 shadow-[0_24px_60px_rgba(248,113,113,0.25)]">
          <ShieldAlert className="h-6 w-6" />
          {error}
        </div>
      </div>
    );

  if (!room)
    return renderWithBackground(
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-slate-900/70 px-6 py-4 text-emerald-200 shadow-[0_24px_60px_rgba(16,185,129,0.25)]">
          <ShieldAlert className="h-6 w-6 text-amber-300" />
          Room not found.
        </div>
      </div>
    );

  const isHost =
    user &&
    (user._id || user.id) ===
      (room.hostUserId._id || room.hostUserId.id || room.hostUserId);

  // Cartela management functions
  const stake = room?.stake ?? 0;
  const playerCount = players?.length ?? 0;
  const selectedCount = Object.keys(takenCartelas || {}).length;
  const prize = stake * selectedCount;
  const currentSelectedCartela = selectedCartelas[currentCartelaIndex] || null;
  const selectedCard = currentSelectedCartela
    ? bingoCards.find((card) => card.id === currentSelectedCartela)
    : null;

  const currentPlayer = players?.[currentPlayerIndex];

  const nextPlayer = () => {
    if (players?.length) {
      setCurrentPlayerIndex((prev) => (prev + 1) % players.length);
    }
  };

  const prevPlayer = () => {
    if (players?.length) {
      setCurrentPlayerIndex((prev) =>
        prev === 0 ? players.length - 1 : prev - 1
      );
    }
  };

  const toggleCartelaSelection = (num) => {
    const socket = userRoomsSocketRef.current;
    if (!socket || !user) {
      console.warn("Socket or user not available");
      return;
    }

    // Block selection if locked
    if (isSelectionLocked) {
      console.warn("Cartela selection is locked");
      setSelectionError(
        "Cartela selection is locked. You have been assigned a cartela automatically."
      );
      setTimeout(() => setSelectionError(null), 3000);
      return;
    }

    const userId = user._id || user.id;
    const isCurrentlySelected = selectedCartelas.includes(num);

    // Debug takenCartelas lookup
    console.log("\n=== TOGGLE CARTELA DEBUG ===");
    console.log("Checking cartela:", num, "(type:", typeof num, ")");
    console.log("All takenCartelas:", takenCartelas);
    console.log("takenCartelas keys:", Object.keys(takenCartelas));
    console.log("Lookup takenCartelas[" + num + "]:", takenCartelas[num]);
    console.log(
      'Lookup takenCartelas["' + num + '"]:',
      takenCartelas[String(num)]
    );

    const isTakenByOther =
      takenCartelas[num] && takenCartelas[num].userId !== userId;

    console.log("Toggle cartela result:", {
      num,
      isCurrentlySelected,
      isTakenByOther,
      takenInfo: takenCartelas[num],
      userId,
      selectedCartelas,
    });
    console.log("=== END DEBUG ===\n");

    if (isCurrentlySelected) {
      // Deselect: remove from selection and emit socket event
      console.log(`Deselecting cartela #${num}`);

      // Emit deselection to server first
      socket.emit("deselect-cartela", {
        roomId: roomid,
        userId,
        cartelaId: num,
      });

      // Update local state optimistically
      setSelectedCartelas((prev) => {
        const newCartelas = prev.filter((n) => n !== num);
        // Adjust current index if needed
        if (
          currentCartelaIndex >= newCartelas.length &&
          newCartelas.length > 0
        ) {
          setCurrentCartelaIndex(newCartelas.length - 1);
        } else if (newCartelas.length === 0) {
          setCurrentCartelaIndex(0);
        }
        console.log("After deselect, selectedCartelas:", newCartelas);
        return newCartelas;
      });
    } else {
      // Select: check if available, add to selection, and emit socket event
      // Enforce the player's approved cartela limit
      if (selectedCartelas.length >= maxAllowedCartelas) {
        setSelectionError(`መምረጥ የሚችሉት ${maxAllowedCartelas} ካርቴላ ብቻ ነው`);
        setTimeout(() => setSelectionError(null), 3000);
        return;
      }
      if (isTakenByOther) {
        console.warn(`Cartela #${num} already taken by`, takenCartelas[num]);
        setSelectionError(
          `Cartela #${num} is already selected by ${takenCartelas[num].userName}`
        );
        setTimeout(() => setSelectionError(null), 3000);
        return;
      }

      console.log(`Selecting cartela #${num}`);

      // Emit selection to server
      socket.emit("select-cartela", {
        roomId: roomid,
        userId,
        cartelaId: num,
      });

      // Optimistically update UI
      setSelectedCartelas((prev) => {
        const newCartelas = [...prev, num].sort((a, b) => a - b);
        console.log("After select, selectedCartelas:", newCartelas);
        return newCartelas;
      });
    }
  };

  const nextCartela = () => {
    if (selectedCartelas.length) {
      setCurrentCartelaIndex((prev) => (prev + 1) % selectedCartelas.length);
    }
  };

  const prevCartela = () => {
    if (selectedCartelas.length) {
      setCurrentCartelaIndex((prev) =>
        prev === 0 ? selectedCartelas.length - 1 : prev - 1
      );
    }
  };

  // Host start button handler - emits to backend to start countdown
  const handleStartGame = () => {
    if (playerCount < 2 || !userRoomsSocketRef.current) return;

    console.log("Requesting game start from backend");
    userRoomsSocketRef.current.emit("start-game", {
      roomId: roomid,
      userId: user && (user._id || user.id),
    });
  };

  const leaveRoom = () => {
    navigate("/");
  };

  // Update game settings (for cashier/host)
  const updateSettings = (newSettings) => {
    if (!userRoomsSocketRef.current || !user) return;

    userRoomsSocketRef.current.emit("update-game-settings", {
      roomId: roomid,
      userId: user._id || user.id,
      settings: newSettings,
    });
  };

  const handleSoundTypeChange = (value) => {
    setSoundType(value);
    updateSettings({ soundType: value });
  };

  const handlePatternChange = (value) => {
    setBingoPattern(value);
    updateSettings({ bingoPattern: value });
  };

  const handleSpeedChange = (value) => {
    const speed = parseInt(value);
    setCallingSpeed(speed);
    updateSettings({ callingSpeed: speed });
  };

  // Player auto-mark toggle (saved to localStorage only)
  const handleAutoMarkToggle = () => {
    const newValue = !autoMark;
    setAutoMark(newValue);
    localStorage.setItem("bingo_auto_mark", newValue.toString());
  };

  // Host View
  if (isHost) {
    return renderWithBackground(
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6 lg:px-10 py-10">
        {/* Banner Slideshow */}
        {shouldDisplayOn("waitingRoom") && (
          <BannerSlideshow
            images={bannerData.images}
            autoPlay={bannerData.autoPlay}
            interval={bannerData.interval}
          />
        )}
        <div className="flex flex-col gap-5">
          {/* <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs sm:text-sm font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
            Host Lobby
          </div> */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="text-emerald-100 space-y-2"></div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={leaveRoom}
                className="inline-flex items-center justify-center rounded-2xl border border-red-500/50 bg-red-600/80 px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(248,113,113,0.35)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_26px_60px_rgba(248,113,113,0.45)]"
              >
                Leave Lobby
              </button>
              <button
                onClick={handleStartGame}
                disabled={playerCount < 2 || countdownSeconds !== null}
                title={
                  playerCount < 2
                    ? "At least 2 players are required to start the game"
                    : countdownSeconds !== null
                    ? "Game is starting..."
                    : "Start the game"
                }
                className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(16,185,129,0.35)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_26px_60px_rgba(16,185,129,0.45)] ${
                  playerCount < 2 || countdownSeconds !== null
                    ? "cursor-not-allowed opacity-40"
                    : ""
                }`}
              >
                Start Game
              </button>
            </div>
          </div>
        </div>
        {/* <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-6 shadow-[0_24px_60px_rgba(16,185,129,0.25)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-emerald-100">
              <h2 className="text-lg font-semibold">Room ID</h2>
              <p className="text-xs text-emerald-200/60">
                Share this code with friends so they can join your lobby.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-slate-900/80 px-4 py-2 font-mono text-lg text-emerald-100">
              <KeyRound className="h-5 w-5 text-emerald-300" />
              {room.roomId}
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(room.roomId);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1300);
                }}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30 relative flex items-center"
                type="button"
              >
                <Copy className="h-4 w-4" />
                {copied && (
                  <span className="ml-2 text-emerald-300 animate-fade-in-out text-xs font-semibold absolute top-1/2 left-full -translate-y-1/2 pl-2">
                    Copied!
                  </span>
                )}
              </button>
            </div>
          </div>
        </div> */}

        {selectionError && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/15 px-5 py-3 text-sm text-red-100 shadow-[0_24px_60px_rgba(248,113,113,0.25)]">
            {selectionError}
          </div>
        )}

        {countdownSeconds !== null && countdownSeconds > 0 && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-amber-400/40 bg-amber-400/15 px-5 py-4 text-center text-amber-100 shadow-[0_24px_60px_rgba(250,204,21,0.25)]">
              ጨዋታው በ {countdownSeconds} ሰኮንድ ውስጥ ይጀምራል...
            </div>
            {countdownSeconds > 5 && selectedCartelas.length === 0 && (
              <div className="rounded-2xl border border-orange-400/40 bg-orange-400/10 px-4 py-3 text-center text-sm text-orange-100">
                ⚠️ ጨዋታው ከመጀመሩ በፊት ካርቴላ ይምረጡ።
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">
                  መደብ
                </p>
                <p className="mt-2 text-2xl font-bold text-white">{stake} ብር</p>
              </div>
              <div className="rounded-2xl bg-emerald-500/20 p-3">
                <Coins className="h-6 w-6 text-emerald-200" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">
                  ሽልማት
                </p>
                <p className="mt-2 text-2xl font-bold text-white">{prize} ብር</p>
              </div>
              <div className="rounded-2xl bg-amber-400/20 p-3">
                <Coins className="h-6 w-6 text-amber-200" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">
                  ተጫዋቾች
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {playerCount}/{room.max_players || 100}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-500/20 p-3">
                <Users className="h-6 w-6 text-emerald-200" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-slate-900/80 px-3 py-2 text-emerald-100">
              <button
                onClick={prevPlayer}
                disabled={!playerCount}
                className="rounded-xl border border-emerald-500/30 bg-slate-900/70 px-2 py-1 text-xs transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ◀
              </button>
              <div className="flex-1 px-2 text-center text-sm">
                {currentPlayer ? (
                  <span className="font-semibold text-emerald-100">
                    {typeof currentPlayer === "object"
                      ? currentPlayer.name ||
                        currentPlayer.phoneNumber ||
                        currentPlayer._id ||
                        currentPlayer.id
                      : currentPlayer}
                  </span>
                ) : (
                  <span className="text-emerald-200/60">No players yet</span>
                )}
              </div>
              <button
                onClick={nextPlayer}
                disabled={!playerCount}
                className="rounded-xl border border-emerald-500/30 bg-slate-900/70 px-2 py-1 text-xs transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ▶
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-6 shadow-[0_24px_60px_rgba(16,185,129,0.25)]">
          <div className="flex items-center gap-2 text-emerald-100">
            <Users className="h-5 w-5 text-emerald-300" />
            <h2 className="text-lg font-semibold">
              ተጫዋቾች ({playerCount}/{room.max_players || 100})
            </h2>
          </div>
          <div className="mt-4 grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {players.map((p, idx) => (
              <div
                key={p._id || p.id || idx}
                className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-slate-900/70 px-3 py-2 text-sm text-emerald-100"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/40 text-sm font-semibold text-white">
                  {idx + 1}
                </div>
                <span className="truncate">
                  {typeof p === "object"
                    ? p.name || p.phoneNumber || p._id || p.id
                    : p}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Game Settings for Cashier/Host */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Sound Type */}
          <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-6 shadow-[0_24px_60px_rgba(16,185,129,0.25)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-2xl bg-purple-500/20 p-3">
                <Volume2 className="h-6 w-6 text-purple-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Sound Type</h2>
                <p className="text-xs text-emerald-200/60">
                  Voice for number calls
                </p>
              </div>
            </div>
            <div className="relative">
              <select
                value={soundType}
                onChange={(e) => handleSoundTypeChange(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-emerald-500/30 bg-slate-900/80 px-4 py-3 text-emerald-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
              >
                {getSoundTypeOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-300 pointer-events-none" />
            </div>
          </div>

          {/* Bingo Pattern */}
          <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-6 shadow-[0_24px_60px_rgba(16,185,129,0.25)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-2xl bg-emerald-500/20 p-3">
                <Grid3X3 className="h-6 w-6 text-emerald-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Win Pattern
                </h2>
                <p className="text-xs text-emerald-200/60">Pattern needed to win</p>
              </div>
            </div>
            <div className="relative">
              <select
                value={bingoPattern}
                onChange={(e) => handlePatternChange(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-emerald-500/30 bg-slate-900/80 px-4 py-3 text-emerald-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
              >
                <option value="1line">1 Line</option>
                <option value="2line">2 Lines</option>
                <option value="3line">3 Lines</option>
                <option value="4line">4 Lines</option>
                <option value="anyVertical">Any Vertical Line</option>
                <option value="anyHorizontal">Any Horizontal Line</option>
                <option value="lPattern">L Pattern</option>
                <option value="x">X Pattern</option>
                <option value="centerT">Center T Pattern</option>
                <option value="centerFourCorner">Center Four Corner</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-300 pointer-events-none" />
            </div>
          </div>

          {/* Calling Speed */}
          <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-6 shadow-[0_24px_60px_rgba(16,185,129,0.25)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-2xl bg-amber-500/20 p-3">
                <Gauge className="h-6 w-6 text-amber-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Calling Speed
                </h2>
                <p className="text-xs text-emerald-200/60">Time between numbers</p>
              </div>
            </div>
            <div className="relative">
              <select
                value={callingSpeed}
                onChange={(e) => handleSpeedChange(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-emerald-500/30 bg-slate-900/80 px-4 py-3 text-emerald-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
              >
                <option value="2000">Very Fast (2s)</option>
                <option value="3000">Fast (3s)</option>
                <option value="4000">Normal (4s)</option>
                <option value="5000">Slow (5s)</option>
                <option value="7000">Very Slow (7s)</option>
                <option value="10000">Extra Slow (10s)</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-300 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Current Settings Summary */}
        <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-6 shadow-[0_24px_60px_rgba(16,185,129,0.25)]">
          <h2 className="text-lg font-semibold text-white mb-4">
            Game Configuration
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-emerald-200/60 mb-1">
                Sound
              </p>
              <p className="text-lg font-semibold text-emerald-100">
                {getSoundTypeLabel(soundType)}
              </p>
            </div>
            <div className="text-center border-x border-emerald-500/20">
              <p className="text-xs uppercase tracking-wider text-emerald-200/60 mb-1">
                Pattern
              </p>
              <p className="text-lg font-semibold text-emerald-100">
                {bingoPattern === "1line"
                  ? "1 Line"
                  : bingoPattern === "2line"
                  ? "2 Lines"
                  : bingoPattern === "3line"
                  ? "3 Lines"
                  : bingoPattern === "4line"
                  ? "4 Lines"
                  : bingoPattern === "anyVertical"
                  ? "Vertical"
                  : bingoPattern === "anyHorizontal"
                  ? "Horizontal"
                  : bingoPattern === "lPattern"
                  ? "L Pattern"
                  : bingoPattern === "x"
                  ? "X Pattern"
                  : bingoPattern === "centerT"
                  ? "Center T"
                  : bingoPattern === "centerFourCorner"
                  ? "4 Corner"
                  : bingoPattern}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-emerald-200/60 mb-1">
                Speed
              </p>
              <p className="text-lg font-semibold text-emerald-100">
                {callingSpeed / 1000}s
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Player View (exactly like WaitingRoom.jsx)
  return renderWithBackground(
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6 lg:px-10 py-10">
      {/* Banner Slideshow */}
      {shouldDisplayOn("waitingRoom") && (
        <BannerSlideshow
          images={bannerData.images}
          autoPlay={bannerData.autoPlay}
          interval={bannerData.interval}
        />
      )}
      <div className="flex flex-col gap-5">
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs sm:text-sm font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
          Waiting Room
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <button
            onClick={leaveRoom}
            className="inline-flex items-center justify-center rounded-2xl border border-red-500/50 bg-red-600/80 px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(248,113,113,0.35)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_26px_60px_rgba(248,113,113,0.45)]"
          >
            Leave Lobby
          </button>
        </div>
      </div>

      {/* Blinking reminder for players who haven't selected all their cards */}
      {selectedCartelas.length < maxAllowedCartelas && !isSelectionLocked && (
        <div className="text-center flex items-center justify-center gap-3">
          <span className="inline-block text-amber-400 text-lg font-semibold animate-pulse">
            ካርቴላ ይምረጡ
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm font-medium">
            {selectedCartelas.length}/{maxAllowedCartelas}
          </span>
        </div>
      )}

      {selectionError && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/15 px-5 py-3 text-sm text-red-100 shadow-[0_24px_60px_rgba(248,113,113,0.25)]">
          {selectionError}
        </div>
      )}

      {countdownSeconds !== null && countdownSeconds > 0 && (
        <div className="space-y-3">
            <div className="rounded-2xl border border-amber-400/40 bg-amber-400/15 px-5 py-4 text-center text-amber-100 shadow-[0_24px_60px_rgba(250,204,21,0.25)]">
              ጨዋታው በ {countdownSeconds} ሰኮንድ ውስጥ ይጀምራል...
            </div>
            {countdownSeconds > 5 && selectedCartelas.length === 0 && (
              <div className="rounded-2xl border border-orange-400/40 bg-orange-400/10 px-4 py-3 text-center text-sm text-orange-100">
                ⚠️ ጨዋታው ከመጀመሩ በፊት ካርቴላ ይምረጡ።
              </div>
            )}
          </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">
                መደብ
              </p>
              <p className="mt-2 text-2xl font-bold text-white">${stake}</p>
            </div>
            <div className="rounded-2xl bg-emerald-500/20 p-3">
              <Coins className="h-6 w-6 text-emerald-200" />
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">
                ሽልማት
              </p>
              <p className="mt-2 text-2xl font-bold text-white">${prize}</p>
            </div>
            <div className="rounded-2xl bg-amber-400/20 p-3">
              <Coins className="h-6 w-6 text-amber-200" />
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">
                ተጫዋቾች
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {playerCount}/{room.max_players || 100}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-500/20 p-3">
              <Users className="h-6 w-6 text-emerald-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Auto Mark Toggle - Player preference */}
      <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-teal-500/20 p-3">
              <Zap className="h-6 w-6 text-teal-300" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Auto Mark</h3>
            </div>
          </div>
          <button
            onClick={handleAutoMarkToggle}
            className={`w-14 h-7 rounded-full p-1 transition-colors duration-200 ${
              autoMark ? "bg-teal-500" : "bg-slate-700"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                autoMark ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-6 shadow-[0_24px_60px_rgba(16,185,129,0.25)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                ካርቴላ ይምረጡ።
              </h2>
              <p className="text-xs text-emerald-200/60 mt-1">
                {isSelectionLocked
                  ? "Selection locked – cartela auto-assigned"
                  : `እስከ ${maxAllowedCartelas} ካርቴላ መምረጥ ይችላሉ።`}
              </p>
            </div>
            <div className={`flex items-center gap-2 rounded-2xl border px-3 py-1 text-xs ${
              selectedCartelas.length >= maxAllowedCartelas 
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300' 
                : 'border-emerald-500/30 bg-slate-900/60 text-emerald-200'
            }`}>
              <Sparkles className="h-4 w-4" />
              {selectedCartelas.length}/{maxAllowedCartelas} ተመርጧል
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-slate-900/80 p-4 h-72 sm:h-80 overflow-y-auto">
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10 md:grid-cols-15">
              {Array.from({ length: 150 }, (_, i) => i + 1).map((num) => {
                const isSelected = selectedCartelas.includes(num);
                const userId = user?._id || user?.id;
                const isTakenByOther =
                  takenCartelas[num] && takenCartelas[num].userId !== userId;
                const isTakenByMe =
                  takenCartelas[num] && takenCartelas[num].userId === userId;

                return (
                  <button
                    key={num}
                    onClick={() => toggleCartelaSelection(num)}
                    disabled={isTakenByOther || isSelectionLocked}
                    title={
                      isSelectionLocked
                        ? "Selection is locked"
                        : isTakenByOther
                        ? `Selected by ${takenCartelas[num].userName}`
                        : isTakenByMe
                        ? "Selected by you"
                        : "Click to select"
                    }
                    className={`relative flex h-12 items-center justify-center rounded-xl border text-sm font-semibold transition-all
                      ${
                        isSelected || isTakenByMe
                          ? "border-emerald-400 bg-emerald-500/25 text-white shadow-lg shadow-emerald-500/30"
                          : isTakenByOther
                          ? "border-slate-700 bg-slate-800/80 text-slate-500 cursor-not-allowed"
                          : "border-slate-600 bg-slate-900/80 text-emerald-200 hover:border-emerald-400 hover:bg-emerald-500/15"
                      }
                    `}
                  >
                    {num}
                    {(isSelected || isTakenByMe) && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white shadow-lg">
                        ✓
                      </span>
                    )}
                    {isTakenByOther && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-lg">
                        ✗
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/70 p-6 shadow-[0_24px_60px_rgba(16,185,129,0.25)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Active Cartela</h2>
            <div className="text-xs text-emerald-200/70">
              {selectedCartelas.length > 0
                ? `${currentCartelaIndex + 1}/${selectedCartelas.length}`
                : "none"}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={prevCartela}
              disabled={selectedCartelas.length <= 1}
              className="rounded-xl border border-emerald-500/30 bg-slate-900/80 px-3 py-2 text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ◀
            </button>
            <div className="flex-1 px-4 text-center text-sm text-emerald-100">
              {selectedCartelas.length > 0
                ? `Cartela #${currentSelectedCartela}`
                : "No cartelas selected"}
            </div>
            <button
              onClick={nextCartela}
              disabled={selectedCartelas.length <= 1}
              className="rounded-xl border border-emerald-500/30 bg-slate-900/80 px-3 py-2 text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ▶
            </button>
          </div>

          {selectedCard ? (
            <div className="mt-6 max-w-xl mx-auto">
              <div className="grid grid-cols-5 gap-1 mb-2">
                {["B", "I", "N", "G", "O"].map((letter) => (
                  <div
                    key={letter}
                    className="bg-emerald-600 text-white text-center py-1.5 sm:py-2 rounded-t font-bold text-base sm:text-lg"
                  >
                    {letter}
                  </div>
                ))}
              </div>

              {/* Bingo Card Grid */}
              <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: 5 }).map((_, rowIdx) => (
                  <>
                    {["B", "I", "N", "G", "O"].map((col) => {
                      const value = selectedCard[col][rowIdx];
                      const isFree = value === "FREE";
                      return (
                        <div
                          key={col + rowIdx}
                          className={`rounded p-1.5 sm:p-2 text-center aspect-square flex items-center justify-center ${
                            isFree
                              ? "bg-yellow-400 border-2 border-yellow-600"
                              : "bg-white border-2 border-gray-300"
                          }`}
                        >
                          <span
                            className={`text-sm sm:text-lg font-semibold ${
                              isFree ? "text-gray-900" : "text-gray-800"
                            }`}
                          >
                            {value}
                          </span>
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-teal-500 text-lg mb-2">
                No Cartelas Selected
              </div>
              <div className="text-gray-400 text-sm">
                Please select at least one cartela from the list above to play
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// You can only select up to 2 cartelas (based on your payment)