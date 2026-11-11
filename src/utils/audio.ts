/**
 * Web Audio Synthesizer for BULL ON CANTON
 * Pure procedural synthesis without external audio files.
 * Unified through one shared AudioContext and one master GainNode.
 */

let audioCtx: AudioContext | null = null;
let masterGainNode: GainNode | null = null;
let soundEnabled = false; // OFF by default as required by Stage 5
const soundListeners = new Set<(enabled: boolean) => void>();

function initAudio(): { ctx: AudioContext; masterGain: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      masterGainNode = audioCtx.createGain();
      // Keep master gain modest (0.35) when enabled, 0 when muted
      masterGainNode.gain.setValueAtTime(soundEnabled ? 0.35 : 0, audioCtx.currentTime);
      masterGainNode.connect(audioCtx.destination);
    }
  }

  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  if (audioCtx && masterGainNode) {
    return { ctx: audioCtx, masterGain: masterGainNode };
  }
  return null;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  const audio = initAudio();
  if (audio) {
    audio.masterGain.gain.setValueAtTime(enabled ? 0.35 : 0, audio.ctx.currentTime);
  }
  soundListeners.forEach((fn) => fn(soundEnabled));
}

export function subscribeSound(fn: (enabled: boolean) => void): () => void {
  soundListeners.add(fn);
  return () => {
    soundListeners.delete(fn);
  };
}

/**
 * Procedural Brass Trading Bell
 * Synthesizes a resonant NYSE opening bell with metallic harmonics.
 */
export function playBellSound(): void {
  if (!soundEnabled) return;
  const audio = initAudio();
  if (!audio) return;
  const { ctx, masterGain } = audio;

  const now = ctx.currentTime;
  const fundamental = 880; // A5 metallic bell
  const harmonics = [
    { freq: fundamental * 1.0, gain: 0.5, decay: 2.0 },
    { freq: fundamental * 1.51, gain: 0.35, decay: 1.6 },
    { freq: fundamental * 2.02, gain: 0.25, decay: 1.3 },
    { freq: fundamental * 2.76, gain: 0.18, decay: 1.0 },
    { freq: fundamental * 3.42, gain: 0.1, decay: 0.7 },
  ];

  harmonics.forEach(({ freq, gain, decay }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq + (Math.random() * 4 - 2), now);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    osc.connect(g);
    g.connect(masterGain);

    osc.start(now);
    osc.stop(now + decay);
  });

  // Hammer strike click
  try {
    const bufferSize = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(2400, now);
    noiseFilter.Q.setValueAtTime(3.0, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    noiseSource.start(now);
  } catch {
    // Noise buffer fallback safely ignored
  }
}

/**
 * Procedural Bull Snort / Steam Sound
 * Low rumble + gusty nasal exhalation.
 */
export function playSnortSound(): void {
  if (!soundEnabled) return;
  const audio = initAudio();
  if (!audio) return;
  const { ctx, masterGain } = audio;

  const now = ctx.currentTime;

  // Sub bass rumble oscillator
  const subOsc = ctx.createOscillator();
  const subGain = ctx.createGain();
  subOsc.type = "sawtooth";
  subOsc.frequency.setValueAtTime(95, now);
  subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.45);

  subGain.gain.setValueAtTime(0.001, now);
  subGain.gain.exponentialRampToValueAtTime(0.28, now + 0.08);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  subOsc.connect(subGain);
  subGain.connect(masterGain);
  subOsc.start(now);
  subOsc.stop(now + 0.55);

  // Gusty filtered breath noise
  try {
    const bufferSize = Math.floor(ctx.sampleRate * 0.45);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.45);
    filter.Q.setValueAtTime(2.5, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.3, now + 0.06);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);

    noise.start(now);
  } catch {
    // Fallback safely ignored
  }
}

/**
 * Procedural Wall Impact Thud & Brick Crumble Sound
 * Heavy sub-bass impact thump + gritty debris crackle.
 */
export function playImpactThud(isHeavy = false): void {
  if (!soundEnabled) return;
  const audio = initAudio();
  if (!audio) return;
  const { ctx, masterGain } = audio;

  const now = ctx.currentTime;

  // Sub impact punch
  const subOsc = ctx.createOscillator();
  const subGain = ctx.createGain();
  subOsc.type = "sine";
  subOsc.frequency.setValueAtTime(isHeavy ? 100 : 130, now);
  subOsc.frequency.exponentialRampToValueAtTime(isHeavy ? 24 : 30, now + (isHeavy ? 0.45 : 0.35));

  subGain.gain.setValueAtTime(0.001, now);
  subGain.gain.linearRampToValueAtTime(isHeavy ? 0.95 : 0.65, now + 0.015);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.7 : 0.5));

  subOsc.connect(subGain);
  subGain.connect(masterGain);
  subOsc.start(now);
  subOsc.stop(now + (isHeavy ? 0.75 : 0.55));

  // Brick crunch / rubble crackle
  try {
    const bufferSize = Math.floor(ctx.sampleRate * 0.4);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const crunchSource = ctx.createBufferSource();
    crunchSource.buffer = buffer;

    const crunchFilter = ctx.createBiquadFilter();
    crunchFilter.type = "lowpass";
    crunchFilter.frequency.setValueAtTime(800, now);
    crunchFilter.frequency.exponentialRampToValueAtTime(200, now + 0.4);

    const crunchGain = ctx.createGain();
    crunchGain.gain.setValueAtTime(0.4, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    crunchSource.connect(crunchFilter);
    crunchFilter.connect(crunchGain);
    crunchGain.connect(masterGain);

    crunchSource.start(now);
  } catch {
    // Noise buffer fallback safely ignored
  }
}

/**
 * Procedural Split-Flap Board Click
 * Soft mechanical plastic card tick.
 */
export function playFlipClickSound(): void {
  if (!soundEnabled) return;
  const audio = initAudio();
  if (!audio) return;
  const { ctx, masterGain } = audio;

  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1800, now);
  osc.frequency.exponentialRampToValueAtTime(350, now + 0.015);

  oscGain.gain.setValueAtTime(0.001, now);
  oscGain.gain.linearRampToValueAtTime(0.25, now + 0.002);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

  osc.connect(oscGain);
  oscGain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.02);
}

/**
 * Procedural Hoof Thuds (Stage 5)
 * Synthesizes a rapid galloping cadence of low, muffled ground impacts.
 */
export function playHoofThuds(): void {
  if (!soundEnabled) return;
  const audio = initAudio();
  if (!audio) return;
  const { ctx, masterGain } = audio;

  const start = ctx.currentTime;
  // Timing offsets for 8 staggered hoof strikes
  const offsets = [0.0, 0.12, 0.22, 0.36, 0.50, 0.64, 0.80, 0.96, 1.14, 1.30];

  offsets.forEach((offset, idx) => {
    const hitTime = start + offset;
    const baseFreq = 85 + (idx % 3) * 12 + (Math.random() * 8 - 4);

    // Low thump
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseFreq, hitTime);
    osc.frequency.exponentialRampToValueAtTime(32, hitTime + 0.08);

    g.gain.setValueAtTime(0.0001, hitTime);
    g.gain.linearRampToValueAtTime(0.35 + Math.random() * 0.1, hitTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, hitTime + 0.075);

    osc.connect(g);
    g.connect(masterGain);

    osc.start(hitTime);
    osc.stop(hitTime + 0.08);

    // Muffled turf noise thump
    try {
      const bufferSize = Math.floor(ctx.sampleRate * 0.06);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(180, hitTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, hitTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 0.05);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGain);

      noiseSource.start(hitTime);
    } catch {
      // Ignored
    }
  });
}
