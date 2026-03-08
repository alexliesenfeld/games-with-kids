import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  HAZARD_DAMAGE,
  MAX_PREY_ON_SCREEN,
  PLAYER_INVULNERABILITY_MS,
  WORLD_HEIGHT,
  WORLD_MARGIN,
  WORLD_WIDTH,
} from "./config.js";
import { aabbIntersect } from "./collision.js";
import {
  createHazards,
  createPlayer,
  createPrey,
  drawHazard,
  drawPlayer,
  drawPrey,
  getPlayerRect,
  getScaledHeight,
  growPlayer,
  shrinkPlayer,
  updatePlayerPhysics,
  updatePrey,
} from "./entities.js";
import { readInput } from "./input.js";
import { playSfx, unlockAudio } from "./audio.js";

export const STATE_MENU = "menu";
export const STATE_PLAYING = "playing";
export const STATE_GAME_OVER = "game_over";
export const STATE_LEVEL_COMPLETE = "level_complete";
export const STATE_CAMPAIGN_COMPLETE = "campaign_complete";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const STARTING_HAZARD_COUNT = 4;
const SPAWN_INTERVAL = 1.0;
const CACTUS_SHRINK = 0.07;
const CACTUS_MIN_SCALE = 0.45;
const GAME_OVER_EXPLOSION_DURATION_MS = 900;
const WORLD_VIEW_PADDING = 28;
const WORLD_VIEW_SCALE = Math.min(
  (CANVAS_WIDTH - WORLD_VIEW_PADDING * 2) / WORLD_WIDTH,
  (CANVAS_HEIGHT - WORLD_VIEW_PADDING * 2) / WORLD_HEIGHT,
);
const WORLD_VIEW_OFFSET_X = (CANVAS_WIDTH - WORLD_WIDTH * WORLD_VIEW_SCALE) / 2;
const WORLD_VIEW_OFFSET_Y = (CANVAS_HEIGHT - WORLD_HEIGHT * WORLD_VIEW_SCALE) / 2;

/**
 * @typedef {object} GameSnapshot
 * @property {string} state
 * @property {number} levelNumber
 * @property {number} eaten
 * @property {number} targetEats
 * @property {number} health
 * @property {number} score
 * @property {number} scale
 * @property {number} timeLeftMs
 */

function formatTime(ms) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function worldToScreen(worldX, worldY, spriteHeight = 0) {
  const width = WORLD_VIEW_SCALE * worldX + WORLD_VIEW_OFFSET_X;
  const height = WORLD_VIEW_SCALE * worldY + WORLD_VIEW_OFFSET_Y;

  return {
    x: width,
    y: height,
    scale: 1,
    depth: worldY,
  };
}

function drawBackground(ctx, nowMs) {
  ctx.fillStyle = "#6bc95f";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawTopDownTerrain(ctx, nowMs) {
  const terrainX = WORLD_VIEW_OFFSET_X;
  const terrainY = WORLD_VIEW_OFFSET_Y;
  const terrainW = WORLD_WIDTH * WORLD_VIEW_SCALE;
  const terrainH = WORLD_HEIGHT * WORLD_VIEW_SCALE;

  ctx.fillStyle = "#58b64f";
  ctx.fillRect(terrainX, terrainY, terrainW, terrainH);

  ctx.fillStyle = "#4ea746";
  for (let y = 0; y <= terrainH; y += 36 * WORLD_VIEW_SCALE) {
    ctx.strokeStyle = `rgba(34, 92, 33, ${0.14 + ((y / 36) % 2) * 0.04})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(terrainX, terrainY + y);
    ctx.lineTo(terrainX + terrainW, terrainY + y);
    ctx.stroke();
  }

  const pulse = (nowMs * 0.0012) % 1;
  const stripHeight = 8 * WORLD_VIEW_SCALE;
  const stripY = terrainY + ((terrainH - stripHeight) * pulse);
  const glowAlpha = 0.08 + 0.06 * Math.sin(nowMs * 0.003);
  ctx.fillStyle = `rgba(255, 255, 255, ${glowAlpha.toFixed(3)})`;
  for (let x = terrainX; x < terrainX + terrainW; x += 9 * WORLD_VIEW_SCALE) {
    ctx.fillRect(x, stripY, 3 * WORLD_VIEW_SCALE, stripHeight);
  }
}

function drawBomberBlast(ctx, nowMs, explosion) {
  if (!explosion) {
    return;
  }

  const elapsed = Math.max(0, nowMs - explosion.startMs);
  const duration = Math.max(1, explosion.durationMs);
  const progress = Math.min(1, elapsed / duration);
  const eased = 1 - Math.pow(1 - progress, 2.4);

  const projected = worldToScreen(explosion.x, explosion.y, 0);
  const x = projected.x;
  const y = projected.y;
  const radiusBase = (explosion.maxRadius || 240) * WORLD_VIEW_SCALE;
  const radius = Math.max(1, radiusBase * (0.15 + 1.0 * eased));
  const alpha = Math.max(0, 1 - progress);
  const jitter = Math.sin((nowMs * 0.055) + explosion.seed) * 0.22 + 0.78;

  const glow = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
  glow.addColorStop(0, `rgba(255, 250, 220, ${0.45 * alpha})`);
  glow.addColorStop(0.1, `rgba(255, 180, 60, ${0.62 * alpha})`);
  glow.addColorStop(0.4, `rgba(255, 70, 16, ${0.45 * alpha})`);
  glow.addColorStop(0.82, `rgba(95, 10, 10, ${0.20 * alpha})`);
  glow.addColorStop(1, `rgba(95, 10, 10, 0)`);

  ctx.save();
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 28; i += 1) {
    const a = (i / 28) * Math.PI * 2 + nowMs * 0.001 + i * 0.5;
    const wave = (Math.sin((nowMs * 0.03) + i) + 1) * 0.5;
    const spoke = radius * (0.45 + wave * 0.45);
    const w = Math.max(1, 6 * projected.scale * (0.4 + (i % 3) * 0.08));
    ctx.strokeStyle = `rgba(255, ${150 - i * 2}, ${20 + wave * 12}, ${0.14 * alpha * (wave + 0.4)})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + Math.cos(a) * spoke * jitter,
      y + Math.sin(a) * spoke * jitter,
    );
    ctx.stroke();
  }

  const coreRadius = radius * (0.12 + 0.06 * Math.sin(nowMs * 0.04 + explosion.seed));
  ctx.fillStyle = `rgba(255, 255, 255, ${0.22 * alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGameWorld(ctx, nowMs, player, preys, hazards) {
  drawBackground(ctx, nowMs);
  drawTopDownTerrain(ctx, nowMs);

  const renderables = [];

  for (const prey of preys) {
    renderables.push({ entity: prey, depth: prey.y + prey.height * 0.28, kind: "prey" });
  }

  for (const hazard of hazards) {
    renderables.push({
      entity: hazard,
      depth: hazard.y + hazard.height * 0.18,
      kind: "hazard",
    });
  }

  renderables.push({
    entity: player,
    depth: player.y + getScaledHeight(player) * 0.4,
    kind: "player",
  });

  renderables.sort((a, b) => a.depth - b.depth);

  for (const item of renderables) {
    if (item.kind === "prey") {
      drawPrey(ctx, item.entity, worldToScreen, nowMs);
    } else if (item.kind === "hazard") {
      drawHazard(ctx, item.entity, worldToScreen);
    } else {
      drawPlayer(ctx, item.entity, true, nowMs, worldToScreen);
    }
  }
}

function drawFallbackStatus(ctx, snapshot, nowMs) {
  if (snapshot.state !== STATE_PLAYING) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "#00000066";
  ctx.fillRect(12, 10, 350, 54);
  ctx.fillStyle = "#fff";
  ctx.font = "18px Trebuchet MS";
  ctx.fillText(`Time ${formatTime(snapshot.timeLeftMs)}`, 20, 30);
  ctx.fillText(`Eaten ${snapshot.eaten}  Score ${snapshot.score}`, 20, 54);
  ctx.restore();
}

function createSessionHazards() {
  return createHazards({ hazardCount: STARTING_HAZARD_COUNT });
}

function spawnHazard() {
  const next = createHazards({ hazardCount: 1 });
  return next[0] ?? null;
}

export function isLevelComplete(eaten, targetEats) {
  return eaten >= targetEats;
}

export function resolveCompletionOutcome(levelNumber) {
  return levelNumber >= 10 ? STATE_CAMPAIGN_COMPLETE : STATE_LEVEL_COMPLETE;
}

export function applyHazardHit(player, nowMs, damage = HAZARD_DAMAGE) {
  if (nowMs < player.invulnerableUntilMs) {
    return false;
  }

  player.health = Math.max(0, player.health - damage);
  player.invulnerableUntilMs = nowMs + PLAYER_INVULNERABILITY_MS;
  return true;
}

export function createGame(canvas, uiBindings = {}) {
  if (!canvas) {
    throw new Error("A canvas element is required.");
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get 2D context from canvas.");
  }

  const setOverlay = uiBindings.setOverlay ?? (() => {});
  const setHud = uiBindings.setHud ?? (() => {});
  const setFlash = uiBindings.setFlash ?? (() => {});

  const raf =
    globalThis.requestAnimationFrame ??
    ((callback) => setTimeout(() => callback(Date.now()), 16));
  const caf = globalThis.cancelAnimationFrame ?? clearTimeout;

  let state = STATE_MENU;
  let player = createPlayer();
  let preys = [];
  let hazards = [];
  let eaten = 0;
  let score = 0;
  let sessionEndMs = 0;
  let spawnCountdown = 0.8;
  let frameHandle = null;
  let lastMs = performance.now();
  let playerFlashUntilMs = 0;
  let gameOverExplosion = null;
  let gameOverReason = "";

  function isPlaying() {
    return state === STATE_PLAYING;
  }

  function timeLeftMs() {
    if (!isPlaying()) {
      return 0;
    }

    return Math.max(0, sessionEndMs - performance.now());
  }

  function getSnapshot() {
    return {
      state,
      levelNumber: 1,
      eaten,
      targetEats: 0,
      health: player.health,
      score,
      scale: player.scale,
      timeLeftMs: timeLeftMs(),
    };
  }

  function syncHud() {
    const snapshot = getSnapshot();
    setHud({
      level: snapshot.levelNumber,
      eaten: snapshot.eaten,
      target: snapshot.targetEats,
      health: snapshot.health,
      score: snapshot.score,
      scale: snapshot.scale,
      timeLeftMs: snapshot.timeLeftMs,
    });
  }

  function syncOverlay() {
    if (state === STATE_PLAYING) {
      setOverlay({ visible: false });
      return;
    }

      if (state === STATE_MENU) {
        setOverlay({
          visible: true,
          title: "Chompasaurus Rex",
          message: "You have 5:00 to eat as many sheep as possible.",
          hint:
            "Move with Arrow/WASD, automatic eating on touch, Continue with Enter or Start",
        });
        return;
      }

    if (state === STATE_GAME_OVER) {
      const isBomberLoss = gameOverReason === "bomber";
      setOverlay({
        visible: true,
        title: isBomberLoss ? "BOOM!" : "Time's Up!",
        message: isBomberLoss
          ? `Bomber sheep exploded. You ate ${score} sheep.`
          : `You ate ${score} sheep in 5 minutes.`,
        hint: "Press Enter or Start to play again.",
      });
      return;
    }

    setOverlay({
      visible: true,
      title: "Game Over",
      message: `You ate ${score} sheep in 5 minutes.`,
      hint: "Press Enter or Start to play again.",
    });
  }

  function resetRound() {
    player = createPlayer();
    preys = [];
    hazards = createSessionHazards();
    eaten = 0;
    score = 0;
    spawnCountdown = 0.8;
    playerFlashUntilMs = 0;
    gameOverExplosion = null;
    gameOverReason = "";
  }

  function startNewCampaign() {
    resetRound();
    state = STATE_MENU;
    sessionEndMs = 0;
    syncHud();
    syncOverlay();
  }

  function startLevel() {
    resetRound();
    sessionEndMs = performance.now() + FIVE_MINUTES_MS;
    state = STATE_PLAYING;
    syncHud();
    syncOverlay();
  }

  function restartLevel() {
    startLevel();
  }

  function handleContinueInput() {
    const input = readInput();

    if (!input.continuePressed) {
      return input;
    }

    unlockAudio();

    if (state === STATE_MENU || state === STATE_GAME_OVER) {
      startLevel();
    }

    return input;
  }

  function tryEatPrey(nowMs, playerRect) {
    for (let i = preys.length - 1; i >= 0; i -= 1) {
      const prey = preys[i];
      if (!prey.eatingAllowed) {
        continue;
      }

      if (!aabbIntersect(playerRect, prey)) {
        continue;
      }

      const value = prey.eatValue ?? 1;
      if (value <= 0) {
        continue;
      }

      preys.splice(i, 1);
      eaten += value;
      score += value;
      growPlayer(player);
      player.eatUntilMs = nowMs + 220;
      playSfx("eat");
      return true;
    }

    return false;
  }

  function tryEatHazard(nowMs, playerRect) {
    for (let i = hazards.length - 1; i >= 0; i -= 1) {
      const hazard = hazards[i];
      if (!aabbIntersect(playerRect, hazard)) {
        continue;
      }

      hazards.splice(i, 1);
      player.eatUntilMs = nowMs + 220;

      if (hazard.type === "cactus") {
        if (applyHazardHit(player, nowMs, HAZARD_DAMAGE)) {
          playerFlashUntilMs = nowMs + 250;
          shrinkPlayer(player, CACTUS_SHRINK, CACTUS_MIN_SCALE);
          playSfx("hurt");
        } else {
          playSfx("eat");
        }
      } else {
        playSfx("eat");
      }

      return true;
    }

    return false;
  }

  function triggerBomberGameOver(prey, nowMs) {
    if (!prey || prey.exploding || state !== STATE_PLAYING) {
      return;
    }

    prey.exploding = true;
    gameOverExplosion = {
      x: prey.x + prey.width / 2,
      y: prey.y + prey.height / 2,
      seed: Math.random() * 1000,
      startMs: nowMs,
      durationMs: prey.explosionDurationMs || GAME_OVER_EXPLOSION_DURATION_MS,
      maxRadius: prey.explosionRadius || 320,
    };
    gameOverReason = "bomber";
    state = STATE_GAME_OVER;
    playerFlashUntilMs = nowMs + 260;
    preys = [];
    hazards = [];
    playSfx("bomb");
    syncOverlay();
  }

  function updatePlaying(dt, nowMs, input) {
    updatePlayerPhysics(player, { moveX: input.moveX, moveY: input.moveY }, dt);
    const playerRect = getPlayerRect(player);

    spawnCountdown -= dt;
    if (spawnCountdown <= 0 && preys.length < MAX_PREY_ON_SCREEN) {
      preys.push(createPrey(1));
      spawnCountdown += SPAWN_INTERVAL + Math.random() * 0.6;
    }

    for (let i = preys.length - 1; i >= 0; i -= 1) {
      const prey = preys[i];

      if (prey.isBomber && aabbIntersect(playerRect, prey)) {
        triggerBomberGameOver(prey, nowMs);
        return;
      }

      updatePrey(prey, dt);

      if (
        prey.x < -WORLD_MARGIN * 2.1 ||
        prey.x > WORLD_WIDTH + WORLD_MARGIN * 2.1 ||
        prey.y < -WORLD_MARGIN * 2.1 ||
        prey.y > WORLD_HEIGHT + WORLD_MARGIN * 2.1
      ) {
        preys.splice(i, 1);
      }
    }

    if (state !== STATE_PLAYING) {
      syncOverlay();
      return;
    }

    for (let i = hazards.length - 1; i >= 0; i -= 1) {
      const hazard = hazards[i];
      hazard.x += (hazard.vx || 0) * dt;
      hazard.y += (hazard.vy || 0) * dt;

      if (hazard.x + hazard.width < -WORLD_MARGIN * 2.1) {
        hazards.splice(i, 1);
        const replacement = spawnHazard();
        if (replacement) {
          hazards.push(replacement);
        }
      }
    }

    const atePrey = tryEatPrey(nowMs, playerRect);
    if (!atePrey) {
      tryEatHazard(nowMs, playerRect);
    }

    if (input.jumpPressed) {
      playSfx("jump");
    }

    if (nowMs >= sessionEndMs) {
      state = STATE_GAME_OVER;
      gameOverReason = "time";
      syncOverlay();
    }
  }

  function render(nowMs) {
    if (state === STATE_PLAYING) {
      drawGameWorld(ctx, nowMs, player, preys, hazards);
      drawFallbackStatus(ctx, getSnapshot(), nowMs);
      setFlash(nowMs < playerFlashUntilMs || nowMs < player.invulnerableUntilMs);
      return;
    }

    drawBackground(ctx, nowMs);
    if (state === STATE_GAME_OVER && gameOverExplosion) {
      drawTopDownTerrain(ctx, nowMs);
      drawBomberBlast(ctx, nowMs, gameOverExplosion);
    }
    setFlash(false);
  }

  function tick(nowMs) {
    const dt = Math.min(0.033, (nowMs - lastMs) / 1000);
    lastMs = nowMs;

    const input = handleContinueInput(nowMs);

    if (state === STATE_PLAYING) {
      updatePlaying(dt, nowMs, input);
    }

    render(nowMs);
    syncHud();

    frameHandle = raf(tick);
  }

  function destroy() {
    if (frameHandle !== null) {
      caf(frameHandle);
      frameHandle = null;
    }
  }

  startNewCampaign();
  frameHandle = raf(tick);

  return {
    startNewCampaign,
    startLevel,
    restartLevel,
    getSnapshot,
    destroy,
  };
}
