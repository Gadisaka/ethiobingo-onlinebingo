import { useState, useRef, useCallback, useEffect } from "react";
import { Howl } from "howler";
import {
  COMMON_AUDIO,
  SOUND_PACKS,
  DEFAULT_SOUND_TYPE,
  isValidSoundType,
} from "../config/audio-config";

/**
 * Multi-Sound Audio Engine for Bingo
 *
 * Supports multiple language packs with dynamic switching.
 * Uses Howler.js with Web Audio API (html5: false) for instant playback.
 * Audio is fully decoded into RAM on load, eliminating streaming latency.
 */

// Singleton instances to prevent multiple audio contexts
let commonHowlInstance = null;
let languageHowlInstances = {}; // Cache for loaded language packs
let isCommonInitializing = false;
let commonLoadCallbacks = [];

/**
 * Get or create the common sounds Howl instance
 */
const getCommonHowlInstance = () => {
  if (commonHowlInstance) return commonHowlInstance;
  if (isCommonInitializing) return null;

  isCommonInitializing = true;

  commonHowlInstance = new Howl({
    src: [COMMON_AUDIO.src],
    sprite: COMMON_AUDIO.sprite,
    html5: false,
    preload: true,
    pool: 3,
    onload: () => {
      console.log("[BingoAudio] ✓ Common sounds loaded into RAM");
      commonLoadCallbacks.forEach((cb) => cb(true));
      commonLoadCallbacks = [];
    },
    onloaderror: (id, error) => {
      console.error("[BingoAudio] ✗ Failed to load common sounds:", error);
      commonLoadCallbacks.forEach((cb) => cb(false));
      commonLoadCallbacks = [];
    },
  });

  return commonHowlInstance;
};

/**
 * Get or create a language-specific Howl instance
 * @param {string} soundType - The sound type key
 * @returns {Howl|null}
 */
const getLanguageHowlInstance = (soundType) => {
  // Return cached instance if exists
  if (languageHowlInstances[soundType]) {
    return languageHowlInstances[soundType].howl;
  }

  // Get sound pack config
  const pack = SOUND_PACKS[soundType];
  if (!pack) {
    console.warn(`[BingoAudio] Unknown sound type: ${soundType}`);
    return null;
  }

  // Create new Howl instance
  const howl = new Howl({
    src: [pack.src],
    sprite: pack.sprite,
    html5: false,
    preload: true,
    pool: 5,
    onload: () => {
      console.log(`[BingoAudio] ✓ ${pack.label} sounds loaded into RAM`);
      if (languageHowlInstances[soundType]) {
        languageHowlInstances[soundType].loaded = true;
        languageHowlInstances[soundType].callbacks.forEach((cb) => cb(true));
        languageHowlInstances[soundType].callbacks = [];
      }
    },
    onloaderror: (id, error) => {
      console.error(`[BingoAudio] ✗ Failed to load ${pack.label}:`, error);
      if (languageHowlInstances[soundType]) {
        languageHowlInstances[soundType].callbacks.forEach((cb) => cb(false));
        languageHowlInstances[soundType].callbacks = [];
      }
    },
  });

  // Cache the instance
  languageHowlInstances[soundType] = {
    howl,
    loaded: false,
    callbacks: [],
  };

  return howl;
};

/**
 * Initialize the audio context (for mobile unlock)
 * Call this on a user gesture (tap/click) to unlock iOS AudioContext
 *
 * @param {string} soundType - Current sound type to unlock
 * @returns {Promise<boolean>} Whether initialization was successful
 */
export const initializeAudioContext = (soundType = DEFAULT_SOUND_TYPE) => {
  return new Promise((resolve) => {
    const commonHowl = getCommonHowlInstance();
    const langHowl = getLanguageHowlInstance(soundType);

    if (!commonHowl) {
      resolve(false);
      return;
    }

    const unlockHowl = (howl, name) => {
      if (howl && howl.state() === "loaded") {
        // Play a muted sound to unlock AudioContext on iOS
        const id = howl.play(Object.keys(howl._sprite)[0]);
        howl.volume(0, id);
        howl.stop(id);
        console.log(`[BingoAudio] ${name} AudioContext unlocked via silent play`);
        return true;
      }
      return false;
    };

    // Try to unlock both
    const commonUnlocked = unlockHowl(commonHowl, "Common");
    const langUnlocked = langHowl ? unlockHowl(langHowl, "Language") : true;

    if (commonUnlocked && langUnlocked) {
      resolve(true);
      return;
    }

    // If still loading, wait for it
    if (commonHowl.state() !== "loaded") {
      commonLoadCallbacks.push((success) => {
        if (success) {
          unlockHowl(commonHowl, "Common");
        }
        resolve(success);
      });
    } else {
      resolve(commonUnlocked);
    }
  });
};

/**
 * Custom hook for multi-sound bingo audio playback
 *
 * @param {string} soundType - The sound type to use (e.g., 'amharic-male-1')
 * @returns {Object} Audio control functions and state
 */
export const useBingoAudio = (soundType = DEFAULT_SOUND_TYPE) => {
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [isLanguageLoaded, setIsLanguageLoaded] = useState(false);
  const [currentSoundType, setCurrentSoundType] = useState(soundType);
  const currentSoundTypeRef = useRef(soundType); // Ref to avoid stale closures
  const activeSoundIdRef = useRef(null);
  const commonHowlRef = useRef(null);
  const languageHowlRef = useRef(null);

  // Initialize common sounds on mount
  useEffect(() => {
    const howl = getCommonHowlInstance();
    commonHowlRef.current = howl;

    if (!howl) return;

    // Check if already loaded
    if (howl.state() === "loaded") {
      setIsAudioLoaded(true);
      return;
    }

    // Register load callback
    const handleLoad = (success) => {
      setIsAudioLoaded(success);
    };

    commonLoadCallbacks.push(handleLoad);

    return () => {
      const idx = commonLoadCallbacks.indexOf(handleLoad);
      if (idx > -1) commonLoadCallbacks.splice(idx, 1);
    };
  }, []);

  // Handle sound type changes - load appropriate language pack
  useEffect(() => {
    const effectiveSoundType = isValidSoundType(soundType)
      ? soundType
      : DEFAULT_SOUND_TYPE;

    const previousSoundType = currentSoundTypeRef.current;
    
    console.log(`[BingoAudio] Sound type requested: ${soundType}, effective: ${effectiveSoundType}, previous: ${previousSoundType}`);

    // Always update the ref and state when sound type changes
    if (effectiveSoundType !== previousSoundType) {
      console.log(`[BingoAudio] Switching from ${previousSoundType} to ${effectiveSoundType}`);
      
      // Update both ref and state
      currentSoundTypeRef.current = effectiveSoundType;
      setCurrentSoundType(effectiveSoundType);
      setIsLanguageLoaded(false);

      const howl = getLanguageHowlInstance(effectiveSoundType);
      languageHowlRef.current = howl;

      if (!howl) return;

      // Check if already loaded
      if (howl.state() === "loaded") {
        console.log(`[BingoAudio] ${effectiveSoundType} already loaded from cache`);
        setIsLanguageLoaded(true);
        return;
      }

      // Register load callback
      const cached = languageHowlInstances[effectiveSoundType];
      if (cached) {
        if (cached.loaded) {
          setIsLanguageLoaded(true);
        } else {
          const handleLoad = (success) => {
            console.log(`[BingoAudio] ${effectiveSoundType} load callback: ${success}`);
            setIsLanguageLoaded(success);
          };
          cached.callbacks.push(handleLoad);
        }
      }
    } else if (!languageHowlRef.current) {
      // Initial load - no change in type but no howl loaded yet
      console.log(`[BingoAudio] Initial load of ${effectiveSoundType}`);
      currentSoundTypeRef.current = effectiveSoundType;
      
      const howl = getLanguageHowlInstance(effectiveSoundType);
      languageHowlRef.current = howl;

      if (!howl) return;

      if (howl.state() === "loaded") {
        setIsLanguageLoaded(true);
        return;
      }

      const cached = languageHowlInstances[effectiveSoundType];
      if (cached) {
        if (cached.loaded) {
          setIsLanguageLoaded(true);
        } else {
          const handleLoad = (success) => {
            setIsLanguageLoaded(success);
          };
          cached.callbacks.push(handleLoad);
        }
      }
    }
  }, [soundType]); // Only depend on the prop

  /**
   * Play a bingo number (1-75)
   * Uses the currently selected language pack
   *
   * @param {string|number} number - The number to play (1-75)
   * @returns {number|null} The sound ID if played, null otherwise
   */
  const playNumber = useCallback((number) => {
    const howl = languageHowlRef.current;
    if (!howl || howl.state() !== "loaded") {
      console.warn("[BingoAudio] Cannot play - language audio not loaded");
      return null;
    }

    const spriteKey = String(number);

    // Validate the sprite key exists
    if (!howl._sprite[spriteKey]) {
      console.warn(`[BingoAudio] Invalid number: ${number}`);
      return null;
    }

    // Stop any currently playing sound to prevent overlap
    if (activeSoundIdRef.current !== null) {
      howl.stop(activeSoundIdRef.current);
      // Also stop common sounds if playing
      if (commonHowlRef.current) {
        commonHowlRef.current.stop();
      }
    }

    // Play the new number
    const soundId = howl.play(spriteKey);
    activeSoundIdRef.current = soundId;

    // Clear active sound when finished
    howl.once(
      "end",
      () => {
        if (activeSoundIdRef.current === soundId) {
          activeSoundIdRef.current = null;
        }
      },
      soundId
    );

    console.log(`[BingoAudio] Playing number: ${number}`);
    return soundId;
  }, []);

  /**
   * Play the game start sound (from common sounds)
   * @returns {number|null} The sound ID if played, null otherwise
   */
  const playGameStart = useCallback(() => {
    const howl = commonHowlRef.current;
    if (!howl || howl.state() !== "loaded") {
      console.warn("[BingoAudio] Cannot play - common audio not loaded");
      return null;
    }

    // Stop any currently playing sound
    if (activeSoundIdRef.current !== null && languageHowlRef.current) {
      languageHowlRef.current.stop(activeSoundIdRef.current);
    }

    const soundId = howl.play("start");
    activeSoundIdRef.current = soundId;

    howl.once(
      "end",
      () => {
        if (activeSoundIdRef.current === soundId) {
          activeSoundIdRef.current = null;
        }
      },
      soundId
    );

    console.log("[BingoAudio] Playing game start");
    return soundId;
  }, []);

  /**
   * Play the game stop sound (from common sounds)
   * @returns {number|null} The sound ID if played, null otherwise
   */
  const playGameStop = useCallback(() => {
    const howl = commonHowlRef.current;
    if (!howl || howl.state() !== "loaded") {
      console.warn("[BingoAudio] Cannot play - common audio not loaded");
      return null;
    }

    // Stop any currently playing sound
    if (activeSoundIdRef.current !== null && languageHowlRef.current) {
      languageHowlRef.current.stop(activeSoundIdRef.current);
    }

    const soundId = howl.play("stop");
    activeSoundIdRef.current = soundId;

    howl.once(
      "end",
      () => {
        if (activeSoundIdRef.current === soundId) {
          activeSoundIdRef.current = null;
        }
      },
      soundId
    );

    console.log("[BingoAudio] Playing game stop");
    return soundId;
  }, []);

  /**
   * Play the shuffle sound (from common sounds)
   * @returns {number|null} The sound ID if played, null otherwise
   */
  const playShuffle = useCallback(() => {
    const howl = commonHowlRef.current;
    if (!howl || howl.state() !== "loaded") {
      console.warn("[BingoAudio] Cannot play - common audio not loaded");
      return null;
    }

    // Stop any currently playing sound
    if (activeSoundIdRef.current !== null && languageHowlRef.current) {
      languageHowlRef.current.stop(activeSoundIdRef.current);
    }

    const soundId = howl.play("shuffle");
    activeSoundIdRef.current = soundId;

    howl.once(
      "end",
      () => {
        if (activeSoundIdRef.current === soundId) {
          activeSoundIdRef.current = null;
        }
      },
      soundId
    );

    console.log("[BingoAudio] Playing shuffle");
    return soundId;
  }, []);

  /**
   * Play the win/bingo sound
   * Uses 'stop' sound as win indicator
   * @returns {number|null} The sound ID if played, null otherwise
   */
  const playWin = useCallback(() => {
    const howl = commonHowlRef.current;
    if (!howl || howl.state() !== "loaded") {
      console.warn("[BingoAudio] Cannot play - common audio not loaded");
      return null;
    }

    // Stop any currently playing sound
    if (activeSoundIdRef.current !== null && languageHowlRef.current) {
      languageHowlRef.current.stop(activeSoundIdRef.current);
    }

    // Use 'stop' sound for win (or could be a dedicated 'win' sprite if added)
    const spriteKey = howl._sprite["win"] ? "win" : "stop";
    const soundId = howl.play(spriteKey);
    activeSoundIdRef.current = soundId;

    howl.once(
      "end",
      () => {
        if (activeSoundIdRef.current === soundId) {
          activeSoundIdRef.current = null;
        }
      },
      soundId
    );

    console.log(`[BingoAudio] Playing win sound (using: ${spriteKey})`);
    return soundId;
  }, []);

  /**
   * Stop all currently playing sounds
   */
  const stopAll = useCallback(() => {
    if (commonHowlRef.current) {
      commonHowlRef.current.stop();
    }
    if (languageHowlRef.current) {
      languageHowlRef.current.stop();
    }
    activeSoundIdRef.current = null;
    console.log("[BingoAudio] Stopped all sounds");
  }, []);

  /**
   * Set the master volume for all audio
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  const setVolume = useCallback((volume) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    if (commonHowlRef.current) {
      commonHowlRef.current.volume(clampedVolume);
    }
    if (languageHowlRef.current) {
      languageHowlRef.current.volume(clampedVolume);
    }

    console.log(`[BingoAudio] Volume set to ${clampedVolume}`);
  }, []);

  /**
   * Check if any sound is currently playing
   * @returns {boolean}
   */
  const isPlaying = useCallback(() => {
    const commonPlaying = commonHowlRef.current?.playing() || false;
    const langPlaying = languageHowlRef.current?.playing() || false;
    return commonPlaying || langPlaying;
  }, []);

  return {
    isAudioLoaded: isAudioLoaded && isLanguageLoaded,
    isCommonLoaded: isAudioLoaded,
    isLanguageLoaded,
    currentSoundType,
    playNumber,
    playGameStart,
    playGameStop,
    playShuffle,
    playWin,
    stopAll,
    setVolume,
    isPlaying,
    initializeAudioContext: () => initializeAudioContext(currentSoundType),
  };
};

export default useBingoAudio;
