import { clamp } from "./config.js";

const keyState = new Set();
let initialized = false;
let previousJumpDown = false;
let previousContinueDown = false;
let previousEatDown = false;

function onKeyDown(event) {
  keyState.add(event.key.toLowerCase());
}

function onKeyUp(event) {
  keyState.delete(event.key.toLowerCase());
}

function onBlur() {
  keyState.clear();
  previousJumpDown = false;
  previousContinueDown = false;
  previousEatDown = false;
}

/**
 * @param {Window} [win]
 */
export function initInput(win = globalThis.window) {
  if (!win || initialized) {
    return;
  }

  win.addEventListener("keydown", onKeyDown);
  win.addEventListener("keyup", onKeyUp);
  win.addEventListener("blur", onBlur);
  initialized = true;
}

function readGamepad() {
  const nav = globalThis.navigator;
  if (!nav || typeof nav.getGamepads !== "function") {
    return {
      axisX: 0,
      axisY: 0,
      dpadLeft: false,
      dpadRight: false,
      dpadUp: false,
      dpadDown: false,
      jump: false,
      cont: false,
      eat: false,
    };
  }

  const pads = Array.from(nav.getGamepads() || [])
    .filter((pad) => pad && pad.connected)
    .map((pad) => ({
      pad,
      axisMag: Math.abs(pad.axes?.[0] ?? 0),
      hasPressed: (pad.buttons || []).some((button) => Boolean(button?.pressed)),
    }))
    .sort((a, b) => Number(b.axisMag + Number(b.hasPressed) * 2) - Number(a.axisMag + Number(a.hasPressed) * 2));

  const pad = pads.length > 0 ? pads[0].pad : null;

  if (!pad) {
    return {
      axisX: 0,
      axisY: 0,
      dpadLeft: false,
      dpadRight: false,
      dpadUp: false,
      dpadDown: false,
      jump: false,
      cont: false,
      eat: false,
    };
  }

  return {
    axisX: pad.axes?.[0] ?? pad.axes?.[2] ?? 0,
    axisY: pad.axes?.[1] ?? pad.axes?.[3] ?? 0,
    dpadLeft: Boolean(pad.buttons?.[14]?.pressed),
    dpadRight: Boolean(pad.buttons?.[15]?.pressed),
    dpadUp: Boolean(pad.buttons?.[12]?.pressed),
    dpadDown: Boolean(pad.buttons?.[13]?.pressed),
    jump: Boolean(pad.buttons?.[0]?.pressed),
    cont: Boolean(pad.buttons?.[9]?.pressed),
    eat: Boolean(pad.buttons?.[1]?.pressed),
  };
}

/**
 * @param {{
 * left:boolean,
 * right:boolean,
 * up:boolean,
 * down:boolean,
 * jump:boolean,
 * continueAction:boolean,
 * axisX:number,
 * axisY:number,
 * dpadLeft:boolean,
 * dpadRight:boolean,
 * dpadUp:boolean,
 * dpadDown:boolean,
 * gamepadJump:boolean,
 * gamepadContinue:boolean,
 * gamepadEat:boolean,
 * deadZone?:number
 * }} raw
 */
export function normalizeInputState(raw) {
  const deadZone = raw.deadZone ?? 0.25;

  const keyboardMove = (raw.left ? -1 : 0) + (raw.right ? 1 : 0);
  const keyboardUpDown = (raw.up ? -1 : 0) + (raw.down ? 1 : 0);
  const dpadMove = (raw.dpadLeft ? -1 : 0) + (raw.dpadRight ? 1 : 0);
  const axisMove = Math.abs(raw.axisX) >= deadZone ? raw.axisX : 0;
  const upDownMove = (raw.dpadUp ? -1 : 0) + (raw.dpadDown ? 1 : 0);
  const axisYMove = Math.abs(raw.axisY) >= deadZone ? raw.axisY : 0;
  const gamepadMove = dpadMove !== 0 ? dpadMove : axisMove;
  const gamepadUpDown = upDownMove !== 0 ? upDownMove : axisYMove;

  return {
    moveX: clamp(keyboardMove + gamepadMove, -1, 1),
    moveY: clamp(keyboardUpDown + gamepadUpDown, -1, 1),
    jumpDown: Boolean(raw.jump || raw.gamepadJump),
    continueDown: Boolean(raw.continueAction || raw.gamepadContinue),
    eatDown: Boolean(raw.eat || raw.gamepadEat),
  };
}

export function readInput() {
  const gamepad = readGamepad();
  const normalized = normalizeInputState({
    left: keyState.has("a") || keyState.has("arrowleft"),
    right: keyState.has("d") || keyState.has("arrowright"),
    jump:
      keyState.has("w") ||
      keyState.has("arrowup") ||
      keyState.has(" ") ||
      keyState.has("space"),
    up: keyState.has("w") || keyState.has("arrowup") || keyState.has("z"),
    down: keyState.has("s") || keyState.has("arrowdown"),
    eat: keyState.has("e"),
    continueAction: keyState.has("enter"),
    axisX: gamepad.axisX,
    axisY: gamepad.axisY,
    dpadLeft: gamepad.dpadLeft,
    dpadRight: gamepad.dpadRight,
    dpadUp: gamepad.dpadUp,
    dpadDown: gamepad.dpadDown,
    gamepadJump: gamepad.jump,
    gamepadContinue: gamepad.cont,
    gamepadEat: gamepad.eat,
  });

  const jumpPressed = normalized.jumpDown && !previousJumpDown;
  const continuePressed = normalized.continueDown && !previousContinueDown;
  const eatPressed = normalized.eatDown && !previousEatDown;

  previousJumpDown = normalized.jumpDown;
  previousContinueDown = normalized.continueDown;
  previousEatDown = normalized.eatDown;

  return {
    moveX: normalized.moveX,
    moveY: normalized.moveY,
    jumpPressed,
    continuePressed,
    eatPressed,
  };
}

export function __resetInputForTests() {
  previousJumpDown = false;
  previousContinueDown = false;
  previousEatDown = false;
  keyState.clear();
}
