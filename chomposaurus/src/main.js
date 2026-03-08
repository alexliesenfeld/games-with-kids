import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./config.js";
import { createGame } from "./game.js";
import { isMusicEnabled, setMusicEnabled, unlockAudio } from "./audio.js";
import { initInput } from "./input.js";

const canvas = /** @type {HTMLCanvasElement | null} */ (
  document.getElementById("game-canvas")
);
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const overlayHint = document.getElementById("overlay-hint");
const canvasWrap = document.getElementById("canvas-wrap");
const fullscreenToggle = document.getElementById("fullscreen-toggle");

const hudLevel = document.getElementById("hud-level");
const hudEaten = document.getElementById("hud-eaten");
const hudTarget = document.getElementById("hud-target");
const hudTime = document.getElementById("hud-time");
const hudScore = document.getElementById("hud-score");
const hudSize = document.getElementById("hud-size");
const hudHealthFill = document.getElementById("hud-health-fill");
const hudHealthText = document.getElementById("hud-health-text");
const musicToggle = document.getElementById("music-toggle");
let autoFullscreenQueued = false;

if (!canvas) {
  throw new Error("Missing #game-canvas element");
}

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

function formatTime(ms) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function resizeCanvasToViewport() {
  if (!canvasWrap) {
    return;
  }

  const hudHeight = document.querySelector(".hud")?.offsetHeight ?? 0;
  const topHeight = document.querySelector(".top-bar")?.offsetHeight ?? 0;
  const maxHeight = window.innerHeight - Math.max(0, hudHeight + topHeight + 18);

  const cssWidth = Math.max(
    320,
    window.innerWidth - (document.fullscreenElement ? 0 : 24),
  );
  const cssHeight = Math.max(180, Math.floor(cssWidth * (CANVAS_HEIGHT / CANVAS_WIDTH)));
  const clampedHeight = Math.min(cssHeight, maxHeight);
  const clampedWidth = Math.floor(clampedHeight * (CANVAS_WIDTH / CANVAS_HEIGHT));

  canvas.style.width = `${clampedWidth}px`;
  canvas.style.height = `${clampedHeight}px`;
}

initInput();

const game = createGame(canvas, {
  setOverlay({ visible, title = "", message = "", hint = "" }) {
    if (!overlay || !overlayTitle || !overlayMessage || !overlayHint) {
      return;
    }

    overlay.classList.toggle("hidden", !visible);
    overlayTitle.textContent = title;
    overlayMessage.textContent = message;
    overlayHint.textContent = hint;
  },

  setHud({ level, eaten, target, health, score, scale, timeLeftMs }) {
    if (hudLevel) hudLevel.textContent = String(level);
    if (hudEaten) hudEaten.textContent = String(eaten);
    if (hudTarget) hudTarget.textContent = String(target);
    if (hudScore) hudScore.textContent = String(score);
    if (hudSize) hudSize.textContent = `${scale.toFixed(2)}x`;
    if (hudTime) hudTime.textContent = formatTime(timeLeftMs ?? 0);

    const safeHealth = Math.max(0, Math.min(100, health));
    if (hudHealthText) hudHealthText.textContent = String(safeHealth);
    if (hudHealthFill) {
      hudHealthFill.style.width = `${safeHealth}%`;
      if (safeHealth > 55) {
        hudHealthFill.style.background = "linear-gradient(90deg, #2ecb58 0%, #9be653 100%)";
      } else if (safeHealth > 25) {
        hudHealthFill.style.background = "linear-gradient(90deg, #f4bb2b 0%, #f8df5f 100%)";
      } else {
        hudHealthFill.style.background = "linear-gradient(90deg, #ef4233 0%, #ff8852 100%)";
      }
    }
  },

  setFlash(active) {
    if (!canvasWrap) {
      return;
    }
    canvasWrap.classList.toggle("hit-flash", active);
  },
});

function refreshMusicToggleLabel() {
  if (!musicToggle) {
    return;
  }
  musicToggle.textContent = isMusicEnabled() ? "Music: ON" : "Music: OFF";
}

function refreshFullscreenToggleLabel() {
  if (!fullscreenToggle) {
    return;
  }
  const inFullscreen = Boolean(document.fullscreenElement);
  fullscreenToggle.textContent = inFullscreen ? "Exit Fullscreen" : "Fullscreen";
  fullscreenToggle.setAttribute(
    "aria-label",
    inFullscreen ? "Exit fullscreen" : "Enter fullscreen",
  );
}

function refreshViewportMode() {
  document.body?.classList.toggle("fullscreen-mode", Boolean(document.fullscreenElement));
  refreshFullscreenToggleLabel();
  resizeCanvasToViewport();
}

if (musicToggle) {
  musicToggle.addEventListener("click", () => {
    const next = setMusicEnabled(!isMusicEnabled());
    if (next) {
      unlockAudio();
    }
    refreshMusicToggleLabel();
  });
}

async function toggleFullscreen() {
  if (!document.fullscreenEnabled) {
    return;
  }

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    const target = document.documentElement;
    if (target.requestFullscreen) {
      await target.requestFullscreen();
    }
  } catch {
    // Ignore fullscreen API errors to keep gameplay input responsive.
  }
}

if (fullscreenToggle) {
  fullscreenToggle.addEventListener("click", async () => {
    await toggleFullscreen();
  });
}

if (canvasWrap) {
  canvasWrap.addEventListener("dblclick", async () => {
    await toggleFullscreen();
  });
}

const unlockOnce = () => {
  unlockAudio();
};

const requestAutoFullscreen = async () => {
  if (autoFullscreenQueued || document.fullscreenElement || !document.fullscreenEnabled) {
    return;
  }

  autoFullscreenQueued = true;

  try {
    const target = document.documentElement;
    if (target.requestFullscreen) {
      await target.requestFullscreen();
    }
  } catch {
    autoFullscreenQueued = false;
  }
};

const onFirstInput = () => {
  unlockOnce();
  void requestAutoFullscreen();
};

window.addEventListener("keydown", onFirstInput, { once: true });
window.addEventListener("pointerdown", onFirstInput, { once: true });
window.addEventListener("resize", refreshViewportMode);
document.addEventListener("fullscreenchange", refreshViewportMode);

refreshMusicToggleLabel();
refreshViewportMode();

// Expose game for quick local debugging from browser console.
window.__dinoGame = game;
