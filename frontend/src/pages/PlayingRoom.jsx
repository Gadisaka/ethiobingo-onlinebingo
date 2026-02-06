import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import { Volume2, VolumeX, Pause, Play, Shuffle, Zap } from "lucide-react";
import { socketClient } from "../sockets/socket";
import { bingoCards } from "../libs/BingoCards";
import { useAuth } from "../context/AuthContext";
import { useBanner } from "../context/BannerContext";
import { NumberCounter } from "../libs/NumberCounter";
import { API_URL } from "../constant";
import { useBingoAudio, initializeAudioContext } from "../hooks/useBingoAudio";
import { DEFAULT_SOUND_TYPE } from "../config/audio-config";
import BannerSlideshow from "../components/BannerSlideshow";

// --- CONSTANTS & CONFIG ---
const BINGO_COLORS = {
  B: { hex: "#FF6B6B", name: "red" },
  I: { hex: "#FFD93D", name: "yellow" },
  N: { hex: "#6BCB77", name: "green" },
  G: { hex: "#4D96FF", name: "blue" },
  O: { hex: "#FF85F3", name: "pink" },
};

const getColumnForNumber = (number) => {
  if (number === null || number === undefined) return null;
  if (typeof number !== "number") return null;
  if (number >= 1 && number <= 15) return "B";
  if (number >= 16 && number <= 30) return "I";
  if (number >= 31 && number <= 45) return "N";
  if (number >= 46 && number <= 60) return "G";
  if (number >= 61 && number <= 75) return "O";
  return null;
};

const getBallData = (num) => {
  if (!num) return null;
  const col = getColumnForNumber(num);
  return { num, ...BINGO_COLORS[col], id: num };
};

const CARD_SWIPE_THRESHOLD_PX = 45;

const isUserHostedRoom = (roomId) => {
  return roomId && roomId.length < 24 && !/^[0-9a-f]{24}$/i.test(roomId);
};

const userRoomsSocketRef = { current: null };

const normalizeUserPlayers = (players = []) =>
  players.map((player) => {
    if (!player) return { userId: "", username: "" };
    if (typeof player === "string") {
      return { userId: String(player), username: String(player) };
    }
    const id = player._id || player.id || player.userId || player;
    return {
      userId: String(id),
      username:
        player.name ||
        player.username ||
        player.phoneNumber ||
        player.email ||
        `Player ${String(id).slice(-4)}`,
    };
  });

const normalizeUserRoom = (room) => {
  if (!room) return null;
  const joinedPlayers = normalizeUserPlayers(room.players || []);
  return {
    id: room.roomId,
    status: room.gameStatus,
    joinedPlayers,
    maxPlayers: room.max_players,
    hostUserId: room.hostUserId,
    stake: room.stake,
    betAmount: room.stake,
    raw: room,
  };
};

export default function PlayingRoom() {
  const { gameRoomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { bannerData, shouldDisplayOn } = useBanner();
  const navigationState = location.state || {};
  const forcedRoomType = navigationState?.roomType;
  const isUserRoom = forcedRoomType
    ? forcedRoomType === "user"
    : isUserHostedRoom(gameRoomId);
  const userId = user?.id || user?._id || null;

  // --- SOUND TYPE STATE ---
  const [soundType, setSoundType] = useState(DEFAULT_SOUND_TYPE);
// winner
  // --- AUDIO SETUP ---
  const {
    isAudioLoaded,
    playNumber: playAudioNumber,
    playGameStart,
    playGameStop,
    playWin: playWinSound,
    playShuffle: playShuffleSound,
    setVolume,
    stopAll: stopAllAudio,
  } = useBingoAudio(soundType);
  const [isMuted, setIsMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const lastPlayedNumberRef = useRef(null);
  const gameStartedRef = useRef(false); // Track if game start sound has been played

  // --- SOCKET SETUP ---
  const systemSocket = useMemo(() => socketClient.instance, []);
  const userRoomSocket = useMemo(() => {
    if (!isUserRoom) {
      return userRoomsSocketRef.current || null;
    }
    if (!userRoomsSocketRef.current) {
      userRoomsSocketRef.current = io(`${API_URL}/user-rooms`, {
        transports: ["websocket"],
      });
    }
    return userRoomsSocketRef.current;
  }, [isUserRoom]);

  const activeSocket = useMemo(
    () => (isUserRoom ? userRoomSocket : systemSocket),
    [isUserRoom, userRoomSocket, systemSocket]
  );

  // --- GAME STATE ---
  const [room, setRoom] = useState(null);
  const [hasReceivedUpdate, setHasReceivedUpdate] = useState(false);

  // Numbers Logic
  const [calledNumbersList, setCalledNumbersList] = useState([]);

  // Display/Animation State
  const [displayCurrentBall, setDisplayCurrentBall] = useState(null);
  const [displayHistory, setDisplayHistory] = useState([]);
  const [isMainBallPopping, setIsMainBallPopping] = useState(false);

  // Card Logic
  const [selectedCartelas, setSelectedCartelas] = useState([]);
  const [currentCartelaIndex, setCurrentCartelaIndex] = useState(0);
  const [markedNumbers, setMarkedNumbers] = useState({});
  const [, setCardTransition] = useState("");

  // Modal/Dialog States
  const [gameFinishedData, setGameFinishedData] = useState(null);
  const [systemWinnerData, setSystemWinnerData] = useState(null);
  const [restartRequested, setRestartRequested] = useState(false);
  const [isNumbersDialogOpen, setIsNumbersDialogOpen] = useState(false);

  // Host Controls State
  const [isPaused, setIsPaused] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  
  // Auto Call State (Player Preference)
  const [autoCall, setAutoCall] = useState(() => {
    const saved = localStorage.getItem("bingo_auto_mark");
    return saved === "true";
  });

  // Notification State
  const [notifications, setNotifications] = useState([]);

  // Notification helper function
  const showNotification = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type };
    setNotifications((prev) => [...prev, notification]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  // Refs
  const mainBallRef = useRef(null);
  const railRef = useRef(null);
  const railWrapperRef = useRef(null);
  const selectedCartelasRef = useRef([]);
  const currentCartelaIndexRef = useRef(0);
  const cardSwipeStateRef = useRef({
    isPointerDown: false,
    startX: 0,
    startY: 0,
    latestX: 0,
    latestY: 0,
    pointerId: null,
  });

  // --- ANIMATION ---
  const animateGhostBall = useCallback((ballData, nextBallData) => {
    if (!mainBallRef.current || !railWrapperRef.current || !railRef.current)
      return;

    const startRect = mainBallRef.current.getBoundingClientRect();
    const railRect = railWrapperRef.current.getBoundingClientRect();

    const ghost = document.createElement("div");
    ghost.innerText = ballData.num;

    Object.assign(ghost.style, {
      position: "fixed",
      width: `${startRect.width}px`,
      height: `${startRect.height}px`,
      left: `${startRect.left}px`,
      top: `${startRect.top}px`,
      backgroundColor: "white",
      borderRadius: "50%",
      border: `6px solid ${ballData.hex}`,
      color: "#1F3B63",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontSize: "50px",
      fontWeight: "900",
      zIndex: "9999",
      boxSizing: "border-box",
      transition: "all 0.6s cubic-bezier(0.25, 1, 0.5, 1)",
      boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
      fontFamily: "'Nunito', sans-serif",
    });

    document.body.appendChild(ghost);
    ghost.getBoundingClientRect(); // Force reflow

    const targetX = railRect.left + 8;
    const targetY = railRect.top + (railRect.height - 40) / 2;

    Object.assign(ghost.style, {
      width: "40px",
      height: "40px",
      left: `${targetX}px`,
      top: `${targetY}px`,
      fontSize: "18px",
      borderWidth: "2px",
    });

    const existingBalls = railRef.current.children;
    for (let ball of existingBalls) {
      ball.style.transition = "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)";
      ball.style.transform = "translateX(48px) rotate(360deg)";
    }

    setTimeout(() => {
      ghost.remove();
      setDisplayHistory((prev) => {
        const newHistory = [ballData, ...prev];
        return newHistory.slice(0, 4);
      });
      for (let ball of existingBalls) {
        ball.style.transform = "none";
        ball.style.transition = "none";
      }
      setDisplayCurrentBall(nextBallData);
      setIsMainBallPopping(true);
      setTimeout(() => setIsMainBallPopping(false), 50);
    }, 600);
  }, []);

  useEffect(() => {
    const latestNum = calledNumbersList[calledNumbersList.length - 1];
    if (!latestNum) return;

    const latestBallData = getBallData(latestNum);

    if (!displayCurrentBall) {
      setDisplayCurrentBall(latestBallData);
      const hist = calledNumbersList
        .slice(0, -1)
        .reverse()
        .slice(0, 4)
        .map(getBallData);
      setDisplayHistory(hist);
      return;
    }

    // Calculate lag to determine if we should snap or animate
    const currentIndex = calledNumbersList.lastIndexOf(displayCurrentBall.num);
    const latestIndex = calledNumbersList.length - 1;
    // If current ball not in list (weird) or we are >1 step behind, snap.
    const isLagging = currentIndex === -1 || latestIndex - currentIndex > 1;

    if (isLagging) {
      setDisplayCurrentBall(latestBallData);
      const hist = calledNumbersList
        .slice(0, -1)
        .reverse()
        .slice(0, 4)
        .map(getBallData);
      setDisplayHistory(hist);
      return;
    }

    if (displayCurrentBall.num !== latestNum) {
      if (mainBallRef.current && railRef.current) {
        animateGhostBall(displayCurrentBall, latestBallData);
      } else {
        setDisplayHistory((prev) => [displayCurrentBall, ...prev].slice(0, 4));
        setDisplayCurrentBall(latestBallData);
      }
    }
  }, [
    calledNumbersList,
    displayCurrentBall,
    displayHistory.length,
    animateGhostBall,
  ]);

  // --- AUDIO PLAYBACK EFFECT ---
  useEffect(() => {
    if (!isAudioLoaded || isMuted || !audioUnlocked) return;

    const latestNum = calledNumbersList[calledNumbersList.length - 1];
    if (!latestNum) return;

    // Play game start sound when first number is called
    if (calledNumbersList.length === 1 && !gameStartedRef.current) {
      gameStartedRef.current = true;
      if (playGameStart) {
        playGameStart();
        // Delay the first number playback slightly so start sound finishes
        setTimeout(() => {
          if (lastPlayedNumberRef.current !== latestNum) {
            lastPlayedNumberRef.current = latestNum;
            playAudioNumber(latestNum);
          }
        }, 800);
        return; // Exit early, number will be played after delay
      }
    }

    // Only play if this is a new number we haven't played yet
    if (lastPlayedNumberRef.current !== latestNum) {
      lastPlayedNumberRef.current = latestNum;
      playAudioNumber(latestNum);
    }

    // Play stop sound when all 75 numbers have been called (game ends without winner)
    if (calledNumbersList.length === 75) {
      if (playGameStop) {
        // Delay slightly so the last number finishes playing
        setTimeout(() => playGameStop(), 2000);
      }
    }
  }, [
    calledNumbersList,
    isAudioLoaded,
    isMuted,
    audioUnlocked,
    playAudioNumber,
    playGameStart,
    playGameStop,
  ]);

  // --- PLAY WIN SOUND WHEN GAME FINISHES ---
  useEffect(() => {
    if (!isAudioLoaded || !audioUnlocked) return;

    // Play win sound when we detect a winner (either user or system room)
    if (gameFinishedData || systemWinnerData) {
      playWinSound();
    }
  }, [
    gameFinishedData,
    systemWinnerData,
    isAudioLoaded,
    audioUnlocked,
    playWinSound,
  ]);

  // --- AUTO MARK CALLED NUMBERS ---
  useEffect(() => {
    if (!autoCall || selectedCartelas.length === 0 || calledNumbersList.length === 0) return;

    // Get all numbers that have been called
    const calledSet = new Set(calledNumbersList.map(String));

    setMarkedNumbers((prev) => {
      const updated = { ...prev };
      let hasChanges = false;

      // For each selected card, mark all called numbers
      selectedCartelas.forEach((cardId) => {
        const cardData = bingoCards[cardId - 1];
        if (!cardData) return;

        const currentMarked = new Set((prev[cardId] || []).map(String));
        const newMarked = new Set(currentMarked);

        // Check all numbers on this card
        ["B", "I", "N", "G", "O"].forEach((col) => {
          cardData[col].forEach((val) => {
            if (val !== "FREE" && calledSet.has(String(val)) && !currentMarked.has(String(val))) {
              newMarked.add(String(val));
              hasChanges = true;
            }
          });
        });

        if (newMarked.size !== currentMarked.size) {
          updated[cardId] = Array.from(newMarked);
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [autoCall, calledNumbersList, selectedCartelas]);

  // --- CARD LOGIC ---
  const updateCartelaSelections = useCallback(
    (allCartelas = {}) => {
      if (!userId) return;
      const myCartelas = Object.keys(allCartelas)
        .filter(
          (cartelaId) =>
            String(allCartelas[cartelaId]?.userId) === String(userId)
        )
        .map((id) => parseInt(id, 10))
        .sort((a, b) => a - b);

      setSelectedCartelas(myCartelas);
      if (
        myCartelas.length > 0 &&
        !myCartelas.includes(
          selectedCartelasRef.current[currentCartelaIndexRef.current]
        )
      ) {
        setCurrentCartelaIndex(0);
      }
    },
    [userId]
  );

  useEffect(() => {
    selectedCartelasRef.current = selectedCartelas;
    currentCartelaIndexRef.current = currentCartelaIndex;
  }, [selectedCartelas, currentCartelaIndex]);

  const toggleCell = (val, cardId) => {
    if (val === "FREE") return;
    if (!cardId) return;

    const key = String(val);
    setMarkedNumbers((prev) => {
      const cardMarked = new Set((prev[cardId] || []).map(String));
      if (cardMarked.has(key)) cardMarked.delete(key);
      else cardMarked.add(key);
      return { ...prev, [cardId]: Array.from(cardMarked) };
    });
  };

  // --- ROOM VALIDATION ---
  useEffect(() => {
    if (!room || !user || !hasReceivedUpdate) {
      return;
    }

    const isMember = room.joinedPlayers?.some((p) => p.userId === user.id);
    const isRoomHost =
      isUserRoom &&
      String(room.hostUserId?._id || room.hostUserId?.id || room.hostUserId) ===
        String(userId);
    const isPlaying = room.status === "playing";
    const isFinished = room.status === "finished";

    // Allow user-hosted rooms to be in 'waiting' state here (post-restart) without redirecting to '/'
    const allowUserWaiting =
      isUserRoom && (isFinished || room.status === "waiting");
    
    // Allow host/cashier to stay in the room even if not in joinedPlayers
    if (!isMember && !isRoomHost) {
      navigate("/");
      return;
    }
    
    if (!isPlaying && !allowUserWaiting) {
      navigate("/");
    }
  }, [room, user, hasReceivedUpdate, navigate, isUserRoom, userId]);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    if (!isUserRoom || !userRoomSocket || !gameRoomId) return;
    const socket = userRoomSocket;
    let isMounted = true;

    const handleCartelasState = ({ allCartelas }) =>
      updateCartelaSelections(allCartelas || {});
    const handlePlayerJoined = ({ players }) => {
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              joinedPlayers: normalizeUserPlayers(players),
              raw: { ...prev.raw, players },
            }
          : prev
      );
    };
    const handleGameFinished = (data) => {
      if (data.roomId === gameRoomId) {
        setGameFinishedData(data);
        // Play stop/win sound when game finishes
        if (playGameStop) {
          playGameStop();
        }
      }
    };
    const handleGameRestartRequest = (data) => {
      if (data.roomId === gameRoomId) setRestartRequested(true);
    };
    const handleGameRestarted = (data) => {
      if (data.roomId === gameRoomId) {
        // Optimistically reflect waiting status locally
        setRoom((prev) => (prev ? { ...prev, status: "waiting" } : prev));
        navigate(`/friends/waiting/${data.roomId}`);
      }
    };
    const handleHostLeft = (data) => {
      if (data.roomId === gameRoomId) {
        showNotification("Host left", "warning");
        navigate("/");
      }
    };
    const handleRestartError = ({ message }) => {
      console.error("[SOCKET] restart-error received", message);
      showNotification("Restart failed", "error");
      setRestartRequested(false);
    };
    
    const handleGamePaused = ({ roomId }) => {
      if (roomId === gameRoomId) {
        setIsPaused(true);
        showNotification("Game paused by host", "info");
        // Play stop sound when game is paused
        if (playGameStop) {
          playGameStop();
        }
      }
    };
    
    const handleGameResumed = ({ roomId }) => {
      if (roomId === gameRoomId) {
        setIsPaused(false);
        showNotification("Game resumed", "success");
        // Play start sound when game is resumed
        if (playGameStart) {
          playGameStart();
        }
      }
    };
    
    const handlePlayShuffleAudio = ({ roomId }) => {
      if (roomId === gameRoomId) {
        // Play only the shuffle sound effect from common sounds
        if (playShuffleSound) {
          playShuffleSound();
        }
      }
    };

    const handleGameSettingsUpdated = ({ soundType: newSoundType }) => {
      if (newSoundType) {
        console.log(`[PlayingRoom] Sound type updated to: ${newSoundType}`);
        setSoundType(newSoundType);
      }
    };

    socket.on("cartelas-state", handleCartelasState);
    socket.on("cartela-selected", handleCartelasState);
    socket.on("cartela-deselected", handleCartelasState);
    socket.on("player-joined", handlePlayerJoined);
    socket.on("game-finished", handleGameFinished);
    socket.on("game-restart-request", handleGameRestartRequest);
    socket.on("game-restarted", handleGameRestarted);
    socket.on("host-left-game", handleHostLeft);
    socket.on("restart-error", handleRestartError);
    socket.on("game-paused", handleGamePaused);
    socket.on("game-resumed", handleGameResumed);
    socket.on("play-shuffle-audio", handlePlayShuffleAudio);
    socket.on("game-settings-updated", handleGameSettingsUpdated);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/user-rooms/get/${gameRoomId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setRoom(normalizeUserRoom(data.room));
            updateCartelaSelections(data.room?.selectedCartelas || {});
            setHasReceivedUpdate(true);
            // Set sound type from room data
            if (data.room?.soundType) {
              setSoundType(data.room.soundType);
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();

    socket.emit("join-playing-room", {
      roomId: gameRoomId,
      userId: userId ? String(userId) : undefined,
    });
    socket.emit("get-cartelas-state", { roomId: gameRoomId });

    return () => {
      isMounted = false;
      socket.off("cartelas-state", handleCartelasState);
      socket.off("cartela-selected", handleCartelasState);
      socket.off("cartela-deselected", handleCartelasState);
      socket.off("player-joined", handlePlayerJoined);
      socket.off("game-finished", handleGameFinished);
      socket.off("game-restart-request", handleGameRestartRequest);
      socket.off("game-restarted", handleGameRestarted);
      socket.off("host-left-game", handleHostLeft);
      socket.off("restart-error", handleRestartError);
      socket.off("game-paused", handleGamePaused);
      socket.off("game-resumed", handleGameResumed);
      socket.off("play-shuffle-audio", handlePlayShuffleAudio);
      socket.off("game-settings-updated", handleGameSettingsUpdated);
    };
  }, [
    isUserRoom,
    userRoomSocket,
    gameRoomId,
    userId,
    updateCartelaSelections,
    navigate,
    showNotification,
    playAudioNumber,
    playShuffleSound,
    playGameStart,
    playGameStop,
  ]);

  useEffect(() => {
    if (isUserRoom || !systemSocket || !gameRoomId) return;
    const socket = systemSocket;
    const handleRoomUpdate = (updated) => {
      if (updated.id === gameRoomId) {
        setRoom(updated);
        setHasReceivedUpdate(true);
      }
    };
    const handleCartelasState = ({ allCartelas }) =>
      updateCartelaSelections(allCartelas || {});

    socket.on("system:roomUpdate", handleRoomUpdate);
    socket.on("cartelas-state", handleCartelasState);
    socket.emit("system:getRooms");
    socket.emit("get-cartelas-state", { roomId: gameRoomId });
    socket.emit("joinRoom", { roomId: gameRoomId });

    return () => {
      socket.off("system:roomUpdate", handleRoomUpdate);
      socket.off("cartelas-state", handleCartelasState);
    };
  }, [isUserRoom, systemSocket, gameRoomId, updateCartelaSelections]);

  useEffect(() => {
    if (!activeSocket || !gameRoomId) return;
    const counter = new NumberCounter(activeSocket, gameRoomId);
    counter.setOnUpdate((count, numbers) => {
      setCalledNumbersCount(count); // Keeping this to avoid breaking changes if logic depends on it, although unused in render
      setCalledNumbersList(numbers);
    });
    if (room?.status === "playing") {
      activeSocket.emit("get-called-numbers", { roomId: gameRoomId });
    }
    return () => counter.cleanup();
  }, [activeSocket, gameRoomId, room?.status]);

  // Helper state for linter satisfaction if needed, or just remove
  const [, setCalledNumbersCount] = useState(0);

  useEffect(() => {
    if (!activeSocket) return;
    const handlers = {
      "bingo-winner": (d) => {
        if (!isUserRoom && d.roomId === gameRoomId) {
          setSystemWinnerData(d);
        }
      },
      "bingo-no-win": () => showNotification("No winning pattern", "info"),
      "bingo-not-now": () => showNotification("Will win next number", "info"),
      "bingo-check-error": () => showNotification("Error occurred", "error"),
      "bingo-already-won": () => showNotification("Already won", "warning"),
    };
    Object.entries(handlers).forEach(([e, h]) => activeSocket.on(e, h));
    return () =>
      Object.entries(handlers).forEach(([e, h]) => activeSocket.off(e, h));
  }, [activeSocket, isUserRoom, gameRoomId, showNotification]);

  // --- NAVIGATION ---
  const totalCartelas = selectedCartelas.length;
  const goToPreviousCard = useCallback(() => {
    if (totalCartelas < 1) return;
    setCardTransition("slide-right");
    requestAnimationFrame(() =>
      setTimeout(() => {
        setCurrentCartelaIndex((prev) =>
          prev === 0 ? totalCartelas - 1 : prev - 1
        );
        requestAnimationFrame(() => setCardTransition(""));
      }, 300)
    );
  }, [totalCartelas]);

  const goToNextCard = useCallback(() => {
    if (totalCartelas < 1) return;
    setCardTransition("slide-left");
    requestAnimationFrame(() =>
      setTimeout(() => {
        setCurrentCartelaIndex((prev) => (prev + 1) % totalCartelas);
        requestAnimationFrame(() => setCardTransition(""));
      }, 300)
    );
  }, [totalCartelas]);

  const _handlePointerDown = (e) => {
    if (totalCartelas <= 1) return;
    cardSwipeStateRef.current = {
      isPointerDown: true,
      startX: e.clientX,
      startY: e.clientY,
      latestX: e.clientX,
      latestY: e.clientY,
      pointerId: e.pointerId,
    };
    if (e.currentTarget.setPointerCapture && e.pointerId) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };
  const _handlePointerMove = (e) => {
    if (!cardSwipeStateRef.current.isPointerDown) return;
    cardSwipeStateRef.current.latestX = e.clientX;
    cardSwipeStateRef.current.latestY = e.clientY;
  };
  const _handlePointerEnd = (e) => {
    if (!cardSwipeStateRef.current.isPointerDown) return;
    const { startX, latestX, startY, latestY } = cardSwipeStateRef.current;
    const deltaX = latestX - startX;
    const deltaY = latestY - startY;
    if (
      Math.abs(deltaX) > Math.abs(deltaY) &&
      Math.abs(deltaX) > CARD_SWIPE_THRESHOLD_PX
    ) {
      deltaX > 0 ? goToPreviousCard() : goToNextCard();
    }
    cardSwipeStateRef.current.isPointerDown = false;
    if (e.currentTarget.releasePointerCapture && e.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  // --- RENDER HELPERS ---
  const currentCardId = selectedCartelas[currentCartelaIndex];
  const _currentCardData = currentCardId ? bingoCards[currentCardId - 1] : null;
  const _markedSet = currentCardId
    ? new Set((markedNumbers[currentCardId] || []).map(String))
    : new Set();

  const handleBingoClick = () => {
    if (selectedCartelas.length === 0) {
      showNotification("No card selected", "warning");
      return;
    }
    selectedCartelas.forEach((cardId) => {
      activeSocket.emit("check-bingo-pattern", {
        roomId: gameRoomId,
        userId: user.id,
        cartelaId: cardId,
      });
    });
  };

  const handleLeaveGame = () => {
    if (isUserRoom) {
      userRoomSocket.emit("leave-game-after-finish", {
        roomId: gameRoomId,
        userId: String(userId),
      });
      navigate("/");
    } else {
      navigate("/");
    }
  };

  const handleRestartGame = () => {
    if (!isUserRoom || !userRoomSocket || !gameRoomId || !userId) return;
    if (!isHost) {
      showNotification("Only host can restart", "warning");
      return;
    }
    console.log("[PlayingRoom] Host requesting game restart", {
      roomId: gameRoomId,
      userId: String(userId),
    });
    userRoomSocket.emit("restart-game", {
      roomId: gameRoomId,
      userId: String(userId),
    });
  };
  const handleStayAfterRestart = () => {
    userRoomSocket.emit("stay-after-restart", {
      roomId: gameRoomId,
      userId: String(userId),
    });
  };

  const handleDeclineRestart = () => {
    try {
      if (isUserRoom && userRoomSocket) {
        userRoomSocket.emit("leave-game-after-finish", {
          roomId: gameRoomId,
          userId: String(userId),
        });
      }
    } finally {
      navigate("/");
    }
  };

  // --- HOST GAME CONTROLS ---
  const handlePauseResume = () => {
    if (!isUserRoom || !userRoomSocket || !gameRoomId || !userId || !isHost) {
      showNotification("Only host can control the game", "warning");
      return;
    }
    
    if (isPaused) {
      userRoomSocket.emit("resume-game", {
        roomId: gameRoomId,
        userId: String(userId),
      });
    } else {
      userRoomSocket.emit("pause-game", {
        roomId: gameRoomId,
        userId: String(userId),
      });
    }
  };

  const handleShuffle = () => {
    if (!isUserRoom || !userRoomSocket || !gameRoomId || !userId || !isHost) {
      showNotification("Only host can shuffle", "warning");
      return;
    }
    
    setIsShuffling(true);
    userRoomSocket.emit("shuffle-audio", {
      roomId: gameRoomId,
      userId: String(userId),
    });
    
    // Reset shuffling state after animation
    setTimeout(() => setIsShuffling(false), 500);
  };

  // --- AUDIO CONTROLS ---
  const handleToggleSound = async () => {
    // First click unlocks audio context (required for iOS)
    if (!audioUnlocked) {
      const success = await initializeAudioContext();
      if (success) {
        setAudioUnlocked(true);
        setVolume(1);
        console.log("[PlayingRoom] Audio context unlocked");
      }
      return;
    }

    // Subsequent clicks toggle mute
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setVolume(newMuted ? 0 : 1);

    if (newMuted) {
      stopAllAudio();
    }
  };

  const handleToggleAutoMark = () => {
    const newValue = !autoCall;
    setAutoCall(newValue);
    localStorage.setItem("bingo_auto_mark", newValue.toString());
  };

  const isHost =
    isUserRoom &&
    room &&
    user &&
    String(room.hostUserId?._id || room.hostUserId?.id || room.hostUserId) ===
      String(userId);

  const earnedUserRoomPoints =
    gameFinishedData?.pointsAwarded && userId
      ? Number(gameFinishedData.pointsAwarded[String(userId)] || 0)
      : 0;

  const earnedSystemPoints =
    systemWinnerData?.pointsAwarded && userId
      ? Number(systemWinnerData.pointsAwarded[String(userId)] || 0)
      : 0;

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-[#333] font-sans">
      {/* BANNER SLIDESHOW */}
      {shouldDisplayOn("playingRoom") && bannerData.images?.length > 0 && (
        <div className="w-full max-w-[400px] mb-4 px-2">
          <BannerSlideshow
            images={bannerData.images}
            autoPlay={bannerData.autoPlay}
            interval={bannerData.interval}
          />
        </div>
      )}
      {/* NOTIFICATION CONTAINER */}
      <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 w-[280px] pointer-events-none">
        {notifications.map((notification) => {
          const typeStyles = {
            success: "bg-green-500 text-white border-green-600",
            error: "bg-red-500 text-white border-red-600",
            warning: "bg-yellow-500 text-white border-yellow-600",
            info: "bg-blue-500 text-white border-blue-600",
          };
          return (
            <div
              key={notification.id}
              className={`${
                typeStyles[notification.type] || typeStyles.info
              } rounded-xl px-4 py-3 shadow-lg border-2 pointer-events-auto animate-slide-down flex items-center justify-between gap-3`}
            >
              <span className="font-bold text-sm flex-1">
                {notification.message}
              </span>
              <button
                onClick={() =>
                  setNotifications((prev) =>
                    prev.filter((n) => n.id !== notification.id)
                  )
                }
                className="text-white/80 hover:text-white font-bold text-lg leading-none"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* PHONE FRAME */}
      <div className="w-full max-w-[400px] h-[750px] md:h-[750px] md:rounded-[40px] md:border-[12px] md:border-[#1a1a1a] relative overflow-hidden shadow-2xl bg-gradient-to-br from-[#4facfe] to-[#00f2fe] flex flex-col">
        {/* --- HEADER --- */}
        <div className="h-[30%] bg-[#00AFFF] md:rounded-b-[30px] relative flex flex-col items-center pt-5 shadow-lg z-10">
          <div className="w-[90%] flex justify-between items-start">
            <div className="flex items-center gap-2">
              <div
                onClick={handleToggleSound}
                className={`w-[45px] h-[45px] rounded-full flex items-center justify-center cursor-pointer transition-all ${
                  !audioUnlocked
                    ? "bg-amber-500/80 animate-pulse hover:bg-amber-500"
                    : isMuted
                    ? "bg-red-500/60 hover:bg-red-500/80"
                    : "bg-black/20 hover:bg-black/30"
                }`}
                title={
                  !audioUnlocked
                    ? "Tap to enable sound"
                    : isMuted
                    ? "Unmute"
                    : "Mute"
                }
              >
                {!audioUnlocked ? (
                  <Volume2 className="w-6 h-6 text-white" />
                ) : isMuted ? (
                  <VolumeX className="w-6 h-6 text-white" />
                ) : (
                  <Volume2 className="w-6 h-6 text-white" />
                )}
              </div>

              {/* Auto Mark Toggle */}
              <div
                onClick={handleToggleAutoMark}
                className={`w-[45px] h-[45px] rounded-full flex items-center justify-center cursor-pointer transition-all ${
                  autoCall
                    ? "bg-amber-500 hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                    : "bg-black/20 hover:bg-black/30"
                }`}
                title={autoCall ? "Auto Mark ON" : "Auto Mark OFF"}
              >
                <Zap
                  className={`w-6 h-6 ${
                    autoCall ? "text-white fill-white" : "text-white/70"
                  }`}
                />
              </div>
              
              {/* Host Controls - Pause/Play and Shuffle */}
              {isHost && (
                <>
                  <div
                    onClick={handlePauseResume}
                    className={`w-[45px] h-[45px] rounded-full flex items-center justify-center cursor-pointer transition-all ${
                      isPaused
                        ? "bg-green-500/80 hover:bg-green-500"
                        : "bg-yellow-500/80 hover:bg-yellow-500"
                    }`}
                    title={isPaused ? "Resume Game" : "Pause Game"}
                  >
                    {isPaused ? (
                      <Play className="w-6 h-6 text-white" />
                    ) : (
                      <Pause className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div
                    onClick={handleShuffle}
                    className={`w-[45px] h-[45px] rounded-full flex items-center justify-center cursor-pointer transition-all bg-purple-500/80 hover:bg-purple-500 ${
                      isShuffling ? "animate-spin" : ""
                    }`}
                    title="Play Random Audio"
                  >
                    <Shuffle className="w-6 h-6 text-white" />
                  </div>
                </>
              )}
            </div>
            <div
              onClick={() => window.location.reload()}
              className="w-[45px] h-[45px] bg-black/20 rounded-full flex items-center justify-center text-white text-2xl cursor-pointer hover:bg-black/30 transition"
            >
              ↻
            </div>
          </div>

          {/* MAIN BALL */}
          <div className="absolute top-[20px] left-1/2 -translate-x-1/2 z-20 mt-4">
            {displayCurrentBall ? (
              <div className="relative">
                <div
                  ref={mainBallRef}
                  style={{
                    borderColor: displayCurrentBall.hex,
                    transform: isMainBallPopping ? "scale(0)" : "scale(1)",
                  }}
                  className={`w-[100px] h-[100px] bg-white rounded-full flex items-center justify-center 
                              text-[#1F3B63] text-[50px] font-black shadow-lg border-[6px] 
                              transition-transform duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]`}
                >
                  {displayCurrentBall.num}
                </div>
                {/* Paused Overlay */}
                {isPaused && (
                  <div className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-black">PAUSED</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-[100px] h-[100px] bg-white/10 rounded-full flex items-center justify-center text-white/50 text-sm border-[6px] border-white/20">
                Waiting...
              </div>
            )}
          </div>

          {/* RAIL */}
          <div
            ref={railWrapperRef}
            className="mt-auto mb-5 w-[70%] h-[60px] bg-black/15 rounded-full flex justify-center items-center px-2 relative box-border overflow-hidden"
          >
            <div
              ref={railRef}
              className="flex items-center h-full flex-grow justify-center relative "
            >
              {displayHistory.map((ball, index) => (
                <div
                  key={ball.id}
                  style={{
                    backgroundColor: ball.hex,
                    left: `${index * 48}px`,
                  }}
                  className="absolute w-[40px] h-[40px] rounded-full border-2 border-white flex items-center justify-center text-white font-black text-lg shadow-sm"
                >
                  {ball.num}
                </div>
              ))}
            </div>
            <div
              className="w-[50px] h-[50px] flex items-center bg-black/15 rounded-full mr-2 justify-center text-xl  absolute right-0 cursor-pointer"
              onClick={() => setIsNumbersDialogOpen(true)}
            >
              📅
            </div>
          </div>
        </div>

        {/* --- BOARD --- */}
        <div className="flex-grow p-5 flex flex-col items-center justify-start gap-4">
          <div
            className={`w-full grid gap-2 overflow-y-auto px-1 ${
              totalCartelas === 1
                ? "grid-cols-1"
                : totalCartelas === 2
                ? "grid-cols-1 justify-items-center"
                : "grid-cols-2"
            }`}
            style={{ maxHeight: "calc(100% - 80px)" }}
          >
            {selectedCartelas.map((cardId) => {
              const cardData = bingoCards[cardId - 1];
              const cardMarkedSet = new Set(
                (markedNumbers[cardId] || []).map(String)
              );

              // Determine cell size/text size based on total cards
              const isSmall = totalCartelas > 1;
              const headerHeight = isSmall ? "h-[25px]" : "h-[40px]";
              const headerText = isSmall ? "text-sm" : "text-xl";
              const cellText = isSmall
                ? "text-sm md:text-base"
                : "text-xl md:text-2xl";
              const rounded = isSmall ? "rounded-md" : "rounded-lg";

              return (
                <div
                  key={cardId}
                  className={`bg-white rounded-[15px] p-1.5 shadow-lg grid grid-cols-5 gap-1 ${
                    totalCartelas === 2 ? "w-[55%]" : "w-full"
                  } h-fit`}
                >
                  {["B", "I", "N", "G", "O"].map((char, i) => {
                    const headerColors = [
                      "#FF6B6B",
                      "#FFD93D",
                      "#6BCB77",
                      "#4D96FF",
                      "#FF85F3",
                    ];
                    return (
                      <div
                        key={i}
                        style={{ backgroundColor: headerColors[i] }}
                        className={`${headerHeight} flex items-center justify-center text-white font-black ${headerText} rounded-md shadow-sm text-shadow`}
                      >
                        {char}
                      </div>
                    );
                  })}

                  {cardData ? (
                    Array.from({ length: 5 }).flatMap((_, rowIdx) =>
                      ["B", "I", "N", "G", "O"].map((col) => {
                        const val = cardData[col][rowIdx];
                        const isMarked =
                          val !== "FREE" && cardMarkedSet.has(String(val));
                        const isCalled =
                          val !== "FREE" && calledNumbersList.includes(val);

                        return (
                          <div
                            key={`${col}-${rowIdx}`}
                            onClick={() => toggleCell(val, cardId)}
                            className={`aspect-square bg-[#FFFBF0] border border-gray-200 ${rounded} flex items-center justify-center text-[#1F3B63] ${cellText} font-black relative cursor-pointer select-none active:scale-95 transition-transform`}
                          >
                            {val === "FREE" ? (
                              <span
                                className={`text-[#FFD700] ${
                                  isSmall ? "text-xl" : "text-3xl"
                                } animate-pulse`}
                              >
                                ★
                              </span>
                            ) : (
                              <>
                                <span
                                  className={
                                    isMarked
                                      ? "text-red-700"
                                      : isCalled
                                      ? "text-gray-800"
                                      : "text-[#1F3B63]"
                                  }
                                >
                                  {val}
                                </span>
                                {isMarked && (
                                  <div className="absolute w-[80%] h-[80%] bg-red-500/60 rounded-full border-2 border-red-600/80 animate-stamp"></div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })
                    )
                  ) : (
                    <div className="col-span-5 text-center py-10 text-gray-500">
                      ?
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleBingoClick}
            className="w-full max-w-[200px] py-3 mt-2 bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-full text-white font-black text-2xl shadow-lg border-4 border-white/30 active:scale-95 transition-transform animate-pulse"
          >
            BINGO!
          </button>
        </div>
      </div>

      {/* --- MODALS --- */}
      {isUserRoom && gameFinishedData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-sm bg-white rounded-3xl p-8 text-center shadow-2xl animate-stamp border-4 ${
              String(gameFinishedData.winner.userId) === String(userId)
                ? "border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.5)]"
                : "border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)]"
            }`}
          >
            <div className="mb-6">
              {String(gameFinishedData.winner.userId) === String(userId) ? (
                <>
                  <h2 className="text-4xl font-black text-green-500 mb-2 drop-shadow-sm">
                    YOU WON!
                  </h2>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">
                    Congratulations
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-4xl font-black text-red-500 mb-2 drop-shadow-sm">
                    GAME OVER
                  </h2>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">
                    Better luck next time
                  </p>
                </>
              )}
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-8 border border-gray-100">
              <div className="mb-3 pb-3 border-b border-gray-200">
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">
                  Winner
                </p>
                <p className="text-xl font-black text-[#1F3B63]">
                  {(() => {
                    // Try to get a proper display name, not an ID
                    const winnerName = gameFinishedData.winner?.userName;
                    const winnerId = gameFinishedData.winner?.userId;
                    
                    // If userName exists and doesn't look like an ID (24 char hex or long number)
                    if (winnerName && 
                        winnerName !== "Unknown" && 
                        !/^[a-f0-9]{24}$/i.test(winnerName) &&
                        !/^\d{10,}$/.test(winnerName)) {
                      return winnerName;
                    }
                    
                    // Try to find from joined players
                    const playerFromRoom = room?.joinedPlayers?.find(
                      (p) => String(p.userId) === String(winnerId)
                    );
                    
                    if (playerFromRoom?.username && playerFromRoom.username !== "Unknown") {
                      return playerFromRoom.username;
                    }
                    
                    // Fallback to friendly format
                    return `Player ${String(winnerId).slice(-4)}`;
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">
                  Prize Won
                </p>
                <p className="text-3xl font-black text-[#FFA500]">
                  {Number(gameFinishedData.prize || 0).toFixed(2)} Birr
                </p>
              </div>
              {gameFinishedData.bonusAmount > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">
                     Bonus  ({gameFinishedData.callCount} calls)
                  </p>
                  <p className="text-2xl font-black text-emerald-500">
                    +{gameFinishedData.bonusAmount.toFixed(2)} Birr
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {isHost ? (
                <>
                 
                  <button
                    onClick={handleLeaveGame}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all"
                  >
                    Leave Room
                  </button>
                </>
              ) : (
                <button
                  onClick={handleLeaveGame}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all"
                >
                  Leave Room
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* System Room Winner Modal */}
      {!isUserRoom && systemWinnerData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-sm bg-white rounded-3xl p-8 text-center shadow-2xl animate-stamp border-4 ${
              String(systemWinnerData.winner.userId) === String(userId)
                ? "border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.5)]"
                : "border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)]"
            }`}
          >
            <div className="mb-6">
              {String(systemWinnerData.winner.userId) === String(userId) ? (
                <>
                  <h2 className="text-4xl font-black text-green-500 mb-2 drop-shadow-sm">
                    YOU WON!
                  </h2>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">
                    Congratulations
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-4xl font-black text-red-500 mb-2 drop-shadow-sm">
                    GAME OVER
                  </h2>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">
                    Better luck next time
                  </p>
                </>
              )}
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-8 border border-gray-100">
              <div className="mb-3 pb-3 border-b border-gray-200">
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">
                  Winner
                </p>
                <p className="text-xl font-black text-[#1F3B63]">
                  {systemWinnerData.winner.userName && systemWinnerData.winner.userName !== "Unknown"
                    ? systemWinnerData.winner.userName
                    : room?.joinedPlayers?.find(
                        (p) => String(p.userId) === String(systemWinnerData.winner.userId)
                      )?.username || "Unknown Winner"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">
                  Prize Pot
                </p>
                <p className="text-3xl font-black text-[#FFA500]">
                  ${systemWinnerData.prize}
                </p>
              </div>
              {systemWinnerData.bonusAmount > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">
                    🎁 Bonus Reward ({systemWinnerData.callCount} calls)
                  </p>
                  <p className="text-2xl font-black text-emerald-500">
                    +{systemWinnerData.bonusAmount.toFixed(2)} Birr
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleLeaveGame}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all"
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {restartRequested && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center shadow-2xl animate-stamp">
            <h2 className="text-2xl font-black text-[#1F3B63] mb-4">
              Host Restarted!
            </h2>
            <p className="mb-6">Play again?</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleStayAfterRestart}
                className="bg-blue-500 text-white py-2 px-6 rounded-xl font-bold"
              >
                Yes
              </button>
              <button
                onClick={handleDeclineRestart}
                className="bg-gray-400 text-white py-2 px-6 rounded-xl font-bold"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {isNumbersDialogOpen && (
        <div
          className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setIsNumbersDialogOpen(false)}
        >
          <div
            className="bg-white rounded-[30px] pt-6 pb-8 px-4 w-full max-w-[360px] relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsNumbersDialogOpen(false)}
              className="absolute -top-3 -right-3 w-10 h-10 bg-[#FFC107] rounded-full text-white font-black text-xl flex items-center justify-center shadow-md border-4 border-white active:scale-95 transition-transform"
            >
              ✕
            </button>
            <h3 className="text-xl font-black text-[#1F3B63] text-center mb-6">
              Numbers already drawn
            </h3>
            <div className="grid grid-cols-5 gap-y-1 justify-items-center">
              {Array.from({ length: 15 }).map((_, rowIdx) =>
                [0, 1, 2, 3, 4].map((colIdx) => {
                  const num = rowIdx + 1 + colIdx * 15;
                  const isCalled = calledNumbersList.includes(num);
                  return (
                    <div
                      key={num}
                      className={`w-8 h-8 flex items-center justify-center text-lg font-bold rounded-full ${
                        isCalled
                          ? "bg-[#FF4444] text-white shadow-sm"
                          : "text-gray-300 bg-transparent"
                      }`}
                    >
                      {num}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;900&display=swap');
        .font-sans { font-family: 'Nunito', sans-serif; }
        .text-shadow { text-shadow: 0 1px 2px rgba(0,0,0,0.2); }
        
        @keyframes stampEffect {
          0% { transform: scale(2); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-stamp {
          animation: stampEffect 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .animate-pulse {
          animation: pulse 2s infinite;
        }
        @keyframes slideDown {
          0% {
            transform: translateX(100%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-down {
          animation: slideDown 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
      `}</style>
    </div>
  );
}
