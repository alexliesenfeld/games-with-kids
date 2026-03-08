export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const TOTAL_LEVELS = 10;

export const BASE_TARGET_EATS = 6;
export const TARGET_EATS_STEP = 2;

export const BASE_SPAWN_INTERVAL = 1.35;
export const SPAWN_INTERVAL_STEP = 0.07;
export const MIN_SPAWN_INTERVAL = 0.55;

export const PLAYER_START_HEALTH = 100;
export const HAZARD_DAMAGE = 25;
export const PLAYER_INVULNERABILITY_MS = 900;

export const PLAYER_BASE_WIDTH = 130;
export const PLAYER_BASE_HEIGHT = 78;
export const WORLD_WIDTH = 1100;
export const WORLD_HEIGHT = 680;
export const WORLD_START_X = WORLD_WIDTH * 0.08;
export const WORLD_START_Y = WORLD_HEIGHT * 0.58;
export const WORLD_MARGIN = 120;
export const PLAYER_START_X = WORLD_START_X;
export const PLAYER_START_Y = WORLD_START_Y;
export const PLAYER_START_SCALE = 1;
export const PLAYER_GROWTH_STEP = 0.055;
export const PLAYER_MAX_SCALE = 3;

// Legacy side-scroller coordinate kept for compatibility with existing HUD logic.
export const GROUND_Y = 610;

export const PLAYER_MAX_SPEED_X = 440;
export const PLAYER_ACCEL_GROUND = 2800;
export const PLAYER_ACCEL_AIR = 1600;
export const PLAYER_FRICTION = 2600;
export const GRAVITY = 2050;
export const JUMP_VELOCITY = -860;

export const SCORE_BASE = 10;
export const MAX_PREY_ON_SCREEN = 12;

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * @typedef {object} LevelConfig
 * @property {number} levelNumber
 * @property {number} targetEats
 * @property {number} hazardCount
 * @property {number} spawnIntervalSec
 */

/**
 * @param {number} levelNumber
 * @returns {LevelConfig}
 */
export function getLevelConfig(levelNumber) {
  const level = clamp(Math.trunc(levelNumber), 1, TOTAL_LEVELS);

  return {
    levelNumber: level,
    targetEats: BASE_TARGET_EATS + level * TARGET_EATS_STEP,
    hazardCount: 1 + level,
    spawnIntervalSec: Math.max(
      MIN_SPAWN_INTERVAL,
      BASE_SPAWN_INTERVAL - level * SPAWN_INTERVAL_STEP,
    ),
  };
}
