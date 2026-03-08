import test from "node:test";
import assert from "node:assert/strict";

import { getLevelConfig } from "../src/config.js";
import { applyGrowth } from "../src/entities.js";
import {
  STATE_CAMPAIGN_COMPLETE,
  STATE_LEVEL_COMPLETE,
  applyHazardHit,
  isLevelComplete,
  resolveCompletionOutcome,
} from "../src/game.js";
import { normalizeInputState } from "../src/input.js";

test("growth applies once per eat and clamps at max", () => {
  const growthStep = 0.055;
  const first = applyGrowth(1);
  assert.equal(first, 1 + growthStep);

  let scale = 2.97;
  scale = applyGrowth(scale);
  scale = applyGrowth(scale);
  assert.equal(scale, 3);
});

test("level target formula is correct from level 1 to 10", () => {
  for (let level = 1; level <= 10; level += 1) {
    const cfg = getLevelConfig(level);
    assert.equal(cfg.targetEats, 6 + level * 2);
  }
});

test("hazard hit applies damage and respects invulnerability window", () => {
  const player = {
    health: 100,
    invulnerableUntilMs: 0,
  };

  const firstHit = applyHazardHit(player, 50);
  assert.equal(firstHit, true);
  assert.equal(player.health, 75);
  assert.equal(player.invulnerableUntilMs, 950);

  const blockedHit = applyHazardHit(player, 500);
  assert.equal(blockedHit, false);
  assert.equal(player.health, 75);

  const secondHit = applyHazardHit(player, 1000);
  assert.equal(secondHit, true);
  assert.equal(player.health, 50);
});

test("level complete check flips when eaten reaches target", () => {
  assert.equal(isLevelComplete(7, 8), false);
  assert.equal(isLevelComplete(8, 8), true);
  assert.equal(isLevelComplete(9, 8), true);
});

test("campaign completion state is triggered after level 10", () => {
  assert.equal(resolveCompletionOutcome(1), STATE_LEVEL_COMPLETE);
  assert.equal(resolveCompletionOutcome(9), STATE_LEVEL_COMPLETE);
  assert.equal(resolveCompletionOutcome(10), STATE_CAMPAIGN_COMPLETE);
  assert.equal(resolveCompletionOutcome(11), STATE_CAMPAIGN_COMPLETE);
});

test("input normalization maps keyboard and gamepad to matching action shape", () => {
  const keyboard = normalizeInputState({
    left: false,
    right: true,
    jump: true,
    continueAction: true,
    axisX: 0,
    dpadLeft: false,
    dpadRight: false,
    gamepadJump: false,
    gamepadContinue: false,
  });

  const gamepad = normalizeInputState({
    left: false,
    right: false,
    jump: false,
    continueAction: false,
    axisX: 0.9,
    dpadLeft: false,
    dpadRight: false,
    gamepadJump: true,
    gamepadContinue: true,
  });

  assert.equal(keyboard.moveX, 1);
  assert.equal(gamepad.moveX, 0.9);
  assert.equal(keyboard.jumpDown, true);
  assert.equal(gamepad.jumpDown, true);
  assert.equal(keyboard.continueDown, true);
  assert.equal(gamepad.continueDown, true);
});
