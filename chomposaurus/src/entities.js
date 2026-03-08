import {
  PLAYER_ACCEL_GROUND,
  PLAYER_BASE_HEIGHT,
  PLAYER_BASE_WIDTH,
  PLAYER_FRICTION,
  PLAYER_GROWTH_STEP,
  PLAYER_MAX_SCALE,
  PLAYER_MAX_SPEED_X,
  PLAYER_START_HEALTH,
  PLAYER_START_SCALE,
  PLAYER_START_X,
  PLAYER_START_Y,
  WORLD_HEIGHT,
  WORLD_MARGIN,
  WORLD_WIDTH,
  clamp,
} from "./config.js";

/**
 * @typedef {object} PlayerState
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} scale
 * @property {number} health
 * @property {number} invulnerableUntilMs
 * @property {number} facing
 * @property {number} eatUntilMs
 */

/**
 * @returns {PlayerState}
 */
export function createPlayer() {
  return {
    x: PLAYER_START_X,
    y: PLAYER_START_Y,
    vx: 0,
    vy: 0,
    scale: PLAYER_START_SCALE,
    health: PLAYER_START_HEALTH,
    invulnerableUntilMs: 0,
    facing: 1,
    eatUntilMs: 0,
  };
}

/**
 * @param {PlayerState} player
 */
export function getScaledWidth(player) {
  return PLAYER_BASE_WIDTH * player.scale;
}

/**
 * @param {PlayerState} player
 */
export function getScaledHeight(player) {
  return PLAYER_BASE_HEIGHT * player.scale;
}

/**
 * @param {PlayerState} player
 */
export function getPlayerRect(player) {
  return {
    x: player.x,
    y: player.y,
    width: getScaledWidth(player),
    height: getScaledHeight(player),
  };
}

/**
 * @param {number} currentScale
 * @param {number} [increment]
 * @param {number} [maxScale]
 */
export function applyGrowth(
  currentScale,
  increment = PLAYER_GROWTH_STEP,
  maxScale = PLAYER_MAX_SCALE,
) {
  return clamp(currentScale + increment, 0.1, maxScale);
}

/**
 * @param {PlayerState} player
 */
export function growPlayer(player) {
  const priorScale = player.scale;
  const priorWidth = getScaledWidth(player);
  const priorHeight = getScaledHeight(player);
  const footY = player.y + priorHeight;

  player.scale = applyGrowth(player.scale);

  const nextWidth = getScaledWidth(player);
  const nextHeight = getScaledHeight(player);
  player.x = Math.max(0, player.x + (priorWidth - nextWidth) * 0.5);
  player.y = footY - nextHeight;

  const maxX = Math.max(0, WORLD_WIDTH - nextWidth);
  const maxY = Math.max(0, WORLD_HEIGHT - nextHeight);
  player.x = clamp(player.x, 0, maxX);
  player.y = clamp(player.y, 0, maxY);

  return player.scale;
}

/**
 * @param {PlayerState} player
 * @param {number} [decrement]
 * @param {number} [minScale]
 */
export function shrinkPlayer(player, decrement = 0.09, minScale = 0.45) {
  const priorScale = player.scale;
  const priorWidth = getScaledWidth(player);
  const priorHeight = getScaledHeight(player);
  const footY = player.y + priorHeight;

  player.scale = clamp(priorScale - decrement, minScale, PLAYER_MAX_SCALE);

  const nextWidth = getScaledWidth(player);
  const nextHeight = getScaledHeight(player);
  player.x = Math.max(0, player.x + (priorWidth - nextWidth) * 0.5);
  player.y = footY - nextHeight;

  const maxX = Math.max(0, WORLD_WIDTH - nextWidth);
  const maxY = Math.max(0, WORLD_HEIGHT - nextHeight);
  player.x = clamp(player.x, 0, maxX);
  player.y = clamp(player.y, 0, maxY);

  return player.scale;
}

/**
 * @param {PlayerState} player
 * @param {{moveX:number,moveY:number}} input
 * @param {number} dt
 */
export function updatePlayerPhysics(player, input, dt) {
  const accel = PLAYER_ACCEL_GROUND;
  let jumped = false;

  if (Math.abs(input.moveX) > 0.001) {
    player.vx += input.moveX * accel * dt;
  } else {
    const frictionStep = PLAYER_FRICTION * dt;
    if (Math.abs(player.vx) <= frictionStep) {
      player.vx = 0;
    } else {
      player.vx -= Math.sign(player.vx) * frictionStep;
    }
  }

  if (Math.abs(input.moveY) > 0.001) {
    player.vy += input.moveY * accel * dt;
  } else {
    const frictionStep = PLAYER_FRICTION * dt;
    if (Math.abs(player.vy) <= frictionStep) {
      player.vy = 0;
    } else {
      player.vy -= Math.sign(player.vy) * frictionStep;
    }
  }

  player.vx = clamp(player.vx, -PLAYER_MAX_SPEED_X, PLAYER_MAX_SPEED_X);
  player.vy = clamp(player.vy, -PLAYER_MAX_SPEED_X, PLAYER_MAX_SPEED_X);

  if (Math.abs(input.moveX) > 0.001) {
    player.facing = input.moveX < 0 ? -1 : 1;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const width = getScaledWidth(player);
  const height = getScaledHeight(player);

  player.x = clamp(player.x, -WORLD_MARGIN, WORLD_WIDTH + WORLD_MARGIN - width);
  player.y = clamp(player.y, -WORLD_MARGIN, WORLD_HEIGHT + WORLD_MARGIN - height);

  return { jumped };
}

/**
 * @param {number} [levelNumber]
 * @param {() => number} [rng]
 */
export function createPrey(levelNumber = 1, rng = Math.random) {
  const scale = 0.6 + rng() * 0.8;
  const width = 68 * scale;
  const height = 46 * scale;
  const speed = 120 + levelNumber * 9 + rng() * 105;
  const drift = (rng() - 0.5) * 40;
  const isBomber = rng() < 0.18;

  const x = WORLD_WIDTH + WORLD_MARGIN + rng() * 170;
  const minY = Math.max(0, WORLD_MARGIN * 0.22);
  const maxY = WORLD_HEIGHT - WORLD_MARGIN * 0.22 - height;
  const y = minY + rng() * Math.max(1, maxY - minY);

  const directionSpeed = speed + (rng() * 30 - 15);
  const vx = -directionSpeed;
  const vy = drift;

  return {
    x,
    y,
    width,
    height,
    vx,
    vy,
    isBomber,
    explosionRadius: isBomber ? 220 + rng() * 180 : 0,
    exploding: false,
    explosionStartedMs: 0,
    explosionDurationMs: isBomber ? 900 + rng() * 250 : 0,
    eatingAllowed: !isBomber,
    facing: vx >= 0 ? 1 : -1,
    variant: Math.floor(rng() * 3),
    eatValue: isBomber ? 0 : 1,
  };
}

/**
 * @param {{x:number,vx:number,y:number,vy:number,width:number,height:number}} prey
 * @param {number} dt
 */
export function updatePrey(prey, dt) {
  prey.x += prey.vx * dt;
  prey.y += prey.vy * dt;

  const yLimitTop = WORLD_MARGIN * 0.16;
  const yLimitBottom = WORLD_HEIGHT - WORLD_MARGIN * 0.16;
  if (prey.y <= yLimitTop) {
    prey.y = yLimitTop;
    prey.vy = Math.abs(prey.vy);
  } else if (prey.y >= yLimitBottom) {
    prey.y = yLimitBottom;
    prey.vy *= -1;
  }

  prey.facing = prey.vx >= 0 ? 1 : -1;
}

/**
 * @param {{hazardCount:number}} levelConfig
 * @param {() => number} [rng]
 */
export function createHazards(levelConfig, rng = Math.random) {
  const hazards = [];
  const count = Math.max(1, levelConfig.hazardCount);
  const margin = WORLD_MARGIN * 0.65;
  const stride = WORLD_WIDTH / Math.max(1, count);

  for (let i = 0; i < count; i += 1) {
    const typeRoll = rng();
    const type = typeRoll < 0.28 ? "pit" : typeRoll < 0.62 ? "rock" : "cactus";

    const maxWidth = clamp(stride * 0.68, 32, 92);
    const minWidth = Math.max(20, maxWidth * 0.58);
    const width = minWidth + rng() * (maxWidth - minWidth);

    const height = type === "pit" ? 16 : clamp(width * (type === "cactus" ? 1.25 : 0.78), 24, 72);
    const x = WORLD_WIDTH + WORLD_MARGIN + rng() * 180 + i * (WORLD_WIDTH / Math.max(1, count));
    const speed = 100 + (rng() * 80);

    const y = clamp(
      WORLD_HEIGHT * 0.3 + (i / Math.max(1, count - 1) - 0.5) * WORLD_HEIGHT * 0.35 +
        (rng() - 0.5) * 120,
      80,
      WORLD_HEIGHT - margin - height,
    );

    hazards.push({
      type,
      x,
      y,
      vx: -speed,
      vy: 0,
      width,
      height,
      variant: Math.floor(rng() * 3),
      ediblePenalty: type === "cactus" ? 25 : 0,
    });
  }

  return hazards;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.45, height * 0.45);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * @param {(worldX:number, worldY:number) => {x:number,y:number,scale:number}}
 */
function project(worldToScreen, x, y, spriteHeight = 0) {
  if (typeof worldToScreen !== "function") {
    return { x, y, scale: 1 };
  }

  const value = worldToScreen(x, y, spriteHeight);
  if (!value) {
    return { x, y, scale: 1 };
  }

  return {
    x: value.x ?? x,
    y: value.y ?? y,
    scale: value.scale ?? 1,
  };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {PlayerState} player
 * @param {boolean} [visible]
 * @param {number} [nowMs]
 * @param {(worldX:number, worldY:number) => {x:number,y:number,scale:number}} [worldToScreen]
 */
export function drawPlayer(ctx, player, visible = true, nowMs = 0, worldToScreen = null) {
  if (!visible) {
    return;
  }

  const projected = project(worldToScreen, player.x, player.y, getScaledHeight(player));
  const width = getScaledWidth(player) * projected.scale;
  const height = getScaledHeight(player) * projected.scale;
  const x = projected.x;
  const y = projected.y;

  ctx.save();
  if (player.facing < 0) {
    ctx.translate(x + width / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + width / 2), 0);
  }

  ctx.fillStyle = "#4ca24a";
  roundedRect(ctx, x + width * 0.08, y + height * 0.22, width * 0.68, height * 0.5, width * 0.11);
  ctx.fill();

  ctx.fillStyle = "#2a6d2d";
  roundedRect(ctx, x + width * 0.56, y + height * 0.08, width * 0.32, height * 0.35, width * 0.1);
  ctx.fill();

  ctx.fillStyle = "#4ca24a";
  ctx.beginPath();
  ctx.moveTo(x + width * 0.07, y + height * 0.32);
  ctx.lineTo(x - width * 0.16, y + height * 0.44);
  ctx.lineTo(x + width * 0.08, y + height * 0.54);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#3e7f3f";
  roundedRect(ctx, x + width * 0.18, y + height * 0.64, width * 0.16, height * 0.32, width * 0.07);
  ctx.fill();
  roundedRect(ctx, x + width * 0.45, y + height * 0.64, width * 0.16, height * 0.32, width * 0.07);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x + width * 0.76, y + height * 0.22, width * 0.042, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(x + width * 0.775, y + height * 0.22, width * 0.022, 0, Math.PI * 2);
  ctx.fill();

  const eatProgress = nowMs > 0 && nowMs < player.eatUntilMs ? (nowMs - (player.eatUntilMs - 220)) / 220 : 0;
  if (eatProgress > 0) {
    const mouthPulse = Math.sin(Math.min(1, eatProgress) * Math.PI);
    const mouthOpen = 0.045 + 0.055 * mouthPulse;

    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.arc(
      x + width * 0.88,
      y + height * 0.24,
      width * mouthOpen,
      0.07 * Math.PI,
      0.93 * Math.PI,
    );
    ctx.strokeStyle = "rgba(60, 34, 24, 0.65)";
    ctx.lineWidth = Math.max(1.2, width * 0.02);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 130, 70, 0.9)";
    ctx.beginPath();
    ctx.arc(
      x + width * 0.915,
      y + height * 0.252,
      width * (0.012 + 0.018 * mouthPulse),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number,width:number,height:number,variant:number,vx:number,facing:number,isBomber:boolean}} prey
 * @param {(worldX:number, worldY:number) => {x:number,y:number,scale:number}} [worldToScreen]
 * @param {number} [nowMs]
 */
export function drawPrey(ctx, prey, worldToScreen = null, nowMs = 0) {
  const pattern = prey.variant % 3;
  const pureWhite = pattern === 0;
  const mixed = !pureWhite;
  const isBomber = Boolean(prey.isBomber);
  const isExploding = isBomber && Boolean(prey.exploding);
  const safeNow = Number.isFinite(nowMs) ? nowMs : 0;
  const bodyColor = isBomber ? "#ef4444" : "#ffffff";
  const stripeColor = isBomber ? "#a31f1f" : mixed ? "#121212" : "#f2f7fb";
  const patchTone = isBomber
    ? "#cf3434"
    : mixed
      ? (pattern === 2 ? "#111111" : "#e5eef4")
      : "#f5faff";
  const projected = project(worldToScreen, prey.x, prey.y, prey.height);
  const width = prey.width * projected.scale;
  const height = prey.height * projected.scale;
  const x = projected.x;
  const y = projected.y;

  ctx.save();
  const facing = prey.facing ?? (prey.vx < 0 ? -1 : 1);
  if (facing < 0) {
    const centerX = x + width / 2;
    ctx.translate(centerX, 0);
    ctx.scale(-1, 1);
    ctx.translate(-centerX, 0);
  }

  ctx.fillStyle = bodyColor;
  roundedRect(ctx, x + width * 0.1, y + height * 0.3, width * 0.72, height * 0.52, width * 0.15);
  ctx.fill();

  ctx.fillStyle = patchTone;
  roundedRect(ctx, x + width * 0.64, y + height * 0.16, width * 0.26, height * 0.32, width * 0.12);
  ctx.fill();

  if (mixed) {
    ctx.fillStyle = stripeColor;
    roundedRect(ctx, x + width * 0.24, y + height * 0.42, width * 0.15, height * 0.21, width * 0.08);
    ctx.fill();
    roundedRect(ctx, x + width * 0.48, y + height * 0.36, width * 0.17, height * 0.19, width * 0.08);
    ctx.fill();
    ctx.fillStyle = "#111111";
    roundedRect(ctx, x + width * 0.39, y + height * 0.54, width * 0.12, height * 0.16, width * 0.06);
    ctx.fill();

    if (pattern === 2) {
      ctx.fillStyle = "#111111";
      roundedRect(ctx, x + width * 0.17, y + height * 0.28, width * 0.11, height * 0.11, width * 0.06);
      ctx.fill();
      roundedRect(ctx, x + width * 0.65, y + height * 0.6, width * 0.1, height * 0.1, width * 0.06);
      ctx.fill();
    }
  }

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x + width * 0.79, y + height * 0.28, width * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1d1720";
  ctx.beginPath();
  ctx.arc(x + width * 0.81, y + height * 0.28, width * 0.025, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2b2b2b";
  roundedRect(ctx, x + width * 0.22, y + height * 0.72, width * 0.14, height * 0.28, width * 0.06);
  ctx.fill();
  roundedRect(ctx, x + width * 0.45, y + height * 0.72, width * 0.14, height * 0.28, width * 0.06);
  ctx.fill();

  if (isBomber && !isExploding) {
    const pulse = Math.sin((safeNow * 0.008) + prey.x * 0.05) * 0.25 + 0.75;
    const warningAlpha = Math.max(0.15, Math.min(0.72, 0.2 + pulse * 0.5));
    ctx.fillStyle = `rgba(255, 32, 16, ${warningAlpha})`;
    ctx.beginPath();
    ctx.arc(
      x + width * 0.74,
      y + height * 0.32,
      Math.max(2, width * 0.03) * pulse,
      0,
      Math.PI * 2,
    );
    ctx.fill();

  }

  if (isExploding) {
    const duration = Math.max(1, prey.explosionDurationMs || 380);
    const progress = Math.min(1, Math.max(0, (safeNow - prey.explosionStartedMs) / duration));
    const eased = 1 - Math.pow(1 - progress, 2);
    const blastScale = prey.explosionRadius * Math.max(prey.scale ?? 1, 1) * (0.22 + 0.9 * eased);
    const radius = blastScale * projected.scale;

    ctx.fillStyle = `rgba(255, 116, 32, ${0.55 * (1 - progress)})`;
    ctx.beginPath();
    ctx.arc(x + width * 0.5, y + height * 0.45, Math.max(width * 0.1, radius * 0.3), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 224, 120, ${0.9 * (1 - progress)})`;
    ctx.lineWidth = Math.max(1.4, width * 0.015);
    ctx.beginPath();
    ctx.arc(x + width * 0.5, y + height * 0.45, Math.max(width * 0.25, radius * (0.45 + 0.35 * Math.sin(safeNow * 0.02 + prey.x))), 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 * (1 - progress)})`;
    ctx.lineWidth = Math.max(1.2, width * 0.012);
    ctx.beginPath();
    ctx.arc(x + width * 0.5, y + height * 0.45, Math.max(width * 0.7, radius), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{type:string,x:number,y:number,width:number,height:number}} hazard
 * @param {(worldX:number, worldY:number) => {x:number,y:number,scale:number}} [worldToScreen]
 */
export function drawHazard(ctx, hazard, worldToScreen = null) {
  const projected = project(worldToScreen, hazard.x, hazard.y, hazard.height);
  const width = hazard.width * projected.scale;
  const height = hazard.height * projected.scale;
  const x = projected.x;
  const y = projected.y;

  if (hazard.type === "pit") {
    ctx.save();
    ctx.fillStyle = "#3d2618";
    roundedRect(ctx, x, y + 2, width, height + 5, 8);
    ctx.fill();

    ctx.fillStyle = "#ff6f2f";
    roundedRect(ctx, x + 3, y + 4, width - 6, height - 3, 6);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (hazard.type === "rock") {
    ctx.save();
    ctx.fillStyle = "#7f7d86";
    roundedRect(ctx, x, y, width, height, 12);
    ctx.fill();
    ctx.fillStyle = "#9f9ca7";
    roundedRect(ctx, x + width * 0.08, y + height * 0.12, width * 0.52, height * 0.38, 8);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.fillStyle = "#2e9f3f";
  roundedRect(ctx, x + width * 0.22, y, width * 0.55, height, 9);
  ctx.fill();

  ctx.fillStyle = "#2a8b37";
  roundedRect(ctx, x, y + height * 0.26, width * 0.28, height * 0.58, 7);
  ctx.fill();
  roundedRect(ctx, x + width * 0.72, y + height * 0.36, width * 0.28, height * 0.52, 7);
  ctx.fill();
  ctx.restore();
}
