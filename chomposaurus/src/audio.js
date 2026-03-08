const AudioContextCtor =
  globalThis.AudioContext || globalThis.webkitAudioContext || null;

let ctx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let musicTimer = null;
let musicStep = 0;
let musicEnabled = true;

function ensureAudioGraph() {
  if (!AudioContextCtor) {
    return null;
  }

  if (ctx) {
    return ctx;
  }

  ctx = new AudioContextCtor();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.8;
  masterGain.connect(ctx.destination);

  musicGain = ctx.createGain();
  musicGain.gain.value = 0.14;
  musicGain.connect(masterGain);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.24;
  sfxGain.connect(masterGain);

  return ctx;
}

function beep({ frequency, duration, type = "sine", volume = 0.12, time = 0, target = sfxGain }) {
  const audio = ensureAudioGraph();
  if (!audio || !target) {
    return;
  }

  const start = audio.currentTime + time;
  const osc = audio.createOscillator();
  const gainNode = audio.createGain();

  osc.type = type;
  osc.frequency.value = frequency;

  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gainNode);
  gainNode.connect(target);

  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function startMusicLoop() {
  if (musicTimer || !musicEnabled) {
    return;
  }

  const audio = ensureAudioGraph();
  if (!audio) {
    return;
  }

  const melody = [
    261.63, 329.63, 392.0, 329.63, 293.66, 349.23, 440.0, 392.0,
  ];

  const tick = () => {
    if (!musicEnabled) {
      return;
    }

    const freq = melody[musicStep % melody.length];
    const subFreq = freq / 2;

    beep({ frequency: freq, duration: 0.24, type: "triangle", volume: 0.03, time: 0.02, target: musicGain });
    beep({ frequency: subFreq, duration: 0.24, type: "sine", volume: 0.02, time: 0.02, target: musicGain });

    musicStep += 1;
  };

  tick();
  musicTimer = setInterval(tick, 300);
}

function stopMusicLoop() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

export function unlockAudio() {
  const audio = ensureAudioGraph();
  if (!audio) {
    return;
  }

  if (audio.state === "suspended") {
    audio.resume().catch(() => {});
  }

  if (musicEnabled) {
    startMusicLoop();
  }
}

/**
 * @param {"eat"|"jump"|"hurt"|"levelComplete"|"gameOver"|"bomb"} name
 */
export function playSfx(name) {
  if (!ensureAudioGraph()) {
    return;
  }

  if (name === "eat") {
    beep({ frequency: 520, duration: 0.08, type: "square", volume: 0.09 });
    beep({ frequency: 720, duration: 0.09, type: "triangle", volume: 0.07, time: 0.03 });
    return;
  }

  if (name === "jump") {
    beep({ frequency: 340, duration: 0.1, type: "triangle", volume: 0.08 });
    beep({ frequency: 450, duration: 0.1, type: "triangle", volume: 0.05, time: 0.03 });
    return;
  }

  if (name === "hurt") {
    beep({ frequency: 180, duration: 0.16, type: "sawtooth", volume: 0.11 });
    return;
  }

  if (name === "levelComplete") {
    beep({ frequency: 392, duration: 0.14, type: "triangle", volume: 0.08 });
    beep({ frequency: 523.25, duration: 0.14, type: "triangle", volume: 0.08, time: 0.11 });
    beep({ frequency: 659.25, duration: 0.2, type: "triangle", volume: 0.1, time: 0.22 });
    return;
  }

  if (name === "gameOver") {
    beep({ frequency: 280, duration: 0.2, type: "sawtooth", volume: 0.08 });
    beep({ frequency: 200, duration: 0.24, type: "sawtooth", volume: 0.08, time: 0.2 });
    return;
  }

  if (name === "bomb") {
    beep({ frequency: 140, duration: 0.18, type: "sawtooth", volume: 0.12 });
    beep({ frequency: 180, duration: 0.14, type: "sawtooth", volume: 0.12, time: 0.04 });
    beep({ frequency: 90, duration: 0.26, type: "triangle", volume: 0.09, time: 0.06 });
    beep({ frequency: 350, duration: 0.16, type: "square", volume: 0.06, time: 0.08 });
    return;
  }
}

export function setMusicEnabled(enabled) {
  musicEnabled = Boolean(enabled);
  if (!ensureAudioGraph()) {
    return musicEnabled;
  }

  const targetGain = musicEnabled ? 0.14 : 0.0001;
  musicGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.04);

  if (musicEnabled) {
    startMusicLoop();
  } else {
    stopMusicLoop();
  }

  return musicEnabled;
}

export function isMusicEnabled() {
  return musicEnabled;
}
