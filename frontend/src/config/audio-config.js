/**
 * Audio Configuration for Multi-Sound Support
 * 
 * This module defines all available sound packs and provides
 * a centralized registry for audio management.
 */

// Common sounds (always loaded)
import commonSpriteSrc from "../assets/Sound/common/common.mp3";
import commonSpriteConfig from "../assets/Sound/common/common.json";

// Language-specific sound packs
import amharicFemaleSpriteSrc from "../assets/Sound/amharic-female/amharic-female.mp3";
import amharicFemaleSpriteConfig from "../assets/Sound/amharic-female/amharic-female.json";

import amharicMale1SpriteSrc from "../assets/Sound/amharic-male-1/amharic-male-1.mp3";
import amharicMale1SpriteConfig from "../assets/Sound/amharic-male-1/amharic-male-1.json";

import amharicMale2SpriteSrc from "../assets/Sound/amharic-male-2/amharic-male-2.mp3";
import amharicMale2SpriteConfig from "../assets/Sound/amharic-male-2/amharic-male-2.json";

import amharicMale3SpriteSrc from "../assets/Sound/amharic-male-3/amharic-male-3.mp3";
import amharicMale3SpriteConfig from "../assets/Sound/amharic-male-3/amharic-male-3.json";

import tigrayMaleSpriteSrc from "../assets/Sound/tigray/tigray-male.mp3";
import tigrayMaleSpriteConfig from "../assets/Sound/tigray/tigray-male.json";

/**
 * Common sounds configuration
 * These sounds are shared across all language packs
 */
export const COMMON_AUDIO = {
  src: commonSpriteSrc,
  sprite: commonSpriteConfig.sprite,
};

/**
 * Available sound types with their configurations
 * Key: soundType identifier (used in room settings)
 * Value: { label, src, sprite }
 */
export const SOUND_PACKS = {
  "amharic-female": {
    label: "Amharic (Female)",
    src: amharicFemaleSpriteSrc,
    sprite: amharicFemaleSpriteConfig.sprite,
  },
  "amharic-male-1": {
    label: "Amharic (Male 1)",
    src: amharicMale1SpriteSrc,
    sprite: amharicMale1SpriteConfig.sprite,
  },
  "amharic-male-2": {
    label: "Amharic (Male 2)",
    src: amharicMale2SpriteSrc,
    sprite: amharicMale2SpriteConfig.sprite,
  },
  "amharic-male-3": {
    label: "Amharic (Male 3)",
    src: amharicMale3SpriteSrc,
    sprite: amharicMale3SpriteConfig.sprite,
  },
  "tigray-male": {
    label: "Tigrinya (Male)",
    src: tigrayMaleSpriteSrc,
    sprite: tigrayMaleSpriteConfig.sprite,
  },
};

/**
 * Default sound type to use when none is specified
 */
export const DEFAULT_SOUND_TYPE = "amharic-male-1";

/**
 * Get all available sound type options for dropdown/select
 * @returns {Array<{value: string, label: string}>}
 */
export const getSoundTypeOptions = () => {
  return Object.entries(SOUND_PACKS).map(([key, pack]) => ({
    value: key,
    label: pack.label,
  }));
};

/**
 * Check if a sound type is valid
 * @param {string} soundType
 * @returns {boolean}
 */
export const isValidSoundType = (soundType) => {
  return soundType in SOUND_PACKS;
};

/**
 * Get sound pack configuration by type
 * @param {string} soundType
 * @returns {Object|null}
 */
export const getSoundPack = (soundType) => {
  return SOUND_PACKS[soundType] || null;
};

/**
 * Get the display label for a sound type
 * @param {string} soundType
 * @returns {string} The display label or the sound type key as fallback
 */
export const getSoundTypeLabel = (soundType) => {
  return SOUND_PACKS[soundType]?.label || soundType;
};
