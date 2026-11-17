/**
 * Web Audio Synthesizer for BULL ON CANTON
 * Pure procedural synthesis without external audio files.
 * Unified through one shared AudioContext and one master GainNode.
 */

export const AUDIO_FILES = {
  snort: ["/assets/audio/snort-1.mp3", "/assets/audio/snort-2.mp3", "/assets/audio/snort-3.mp3"],
  grunt: ["/assets/audio/bull-grunt.mp3"],
} as const;

export type SampleName = keyof typeof AUDIO_FILES;

export const TAP_SOUND_ENABLED = true;

let audioCtx: AudioContext | null = null;
let masterGainNode: GainNode | null = null;
let soundEnabled = false; // OFF by default as required by Stage 5
const soundListeners = new Set<(enabled: boolean) => void>();

const sampleBuffers = new Map<string, AudioBuffer>();
const sampleLoadPromises = new Map<string, Promise<AudioBuffer | null>>();
let samplePreloadScheduled = false;
const lastVariantByName: Partial<Record<SampleName, number>> = {};
const lastSamplePlayedAt: Partial<Record<SampleName, number>> = {};
const activeSampleSources: AudioBufferSourceNode[] = [];

function loadSampleFile(url: string): Promise<AudioBuffer | null> {
  const existing = sampleBuffers.get(url);
  if (existing) return Promise.resolve(existing);

  const inFlight = sampleLoadPromises.get(url);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const audio = initAudio();
      if (!audio || typeof fetch !== "function") return null;
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      const decoded = await audio.ctx.decodeAudioData(arrayBuf.slice(0));
      sampleBuffers.set(url, decoded);
      return decoded;
    } catch {
      return null;
    }
  })();

  sampleLoadPromises.set(url, promise);
  return promise;
}

function preloadAllSamples(): void {
  if (!soundEnabled) return;
  const urls: string[] = [];
  (Object.keys(AUDIO_FILES) as SampleName[]).forEach((name) => {
    AUDIO_FILES[name].forEach((url) => urls.push(url));
  });
  urls.forEach((url) => {
    void loadSampleFile(url);
  });
}

function scheduleSamplePreload(): void {
  if (samplePreloadScheduled || typeof window === "undefined") return;
  samplePreloadScheduled = true;

  const run = () => {
    if (!soundEnabled) {
      samplePreloadScheduled = false;
      return;
    }
    preloadAllSamples();
  };

  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };

  if (typeof win.requestIdleCallback === "function") {
    win.requestIdleCallback(run, { timeout: 300 });
  } else {
    window.setTimeout(run, 300);
  }
}

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

  if (audioCtx && audioCtx.state !== "running") {
    audioCtx.resume().catch(() => {});
  }

  if (audioCtx && masterGainNode) {
    return { ctx: audioCtx, masterGain: masterGainNode };
  }
  return null;
}

export function unlockAudio(): void {
  initAudio();
}

export function initAudioUnlock(): () => void {
  if (typeof document === "undefined") return () => {};
  const handleGesture = () => {
    unlockAudio();
  };
  document.addEventListener("pointerup", handleGesture, { capture: true, passive: true });
  document.addEventListener("click", handleGesture, { capture: true, passive: true });
  return () => {
    document.removeEventListener("pointerup", handleGesture, true);
    document.removeEventListener("click", handleGesture, true);
  };
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
  if (enabled) {
    scheduleSamplePreload();
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
export function playSnortSound(volumeScale = 1.0): void {
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
  subGain.gain.exponentialRampToValueAtTime(0.28 * volumeScale, now + 0.08);
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
    noiseGain.gain.linearRampToValueAtTime(0.3 * volumeScale, now + 0.06);
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

export function playSample(
  name: SampleName,
  options: { gain?: number; rate?: number } = {}
): void {
  if (!soundEnabled) return;
  const { gain = 1, rate = 1 } = options;

  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  const lastMs = lastSamplePlayedAt[name] ?? -Infinity;
  if (nowMs - lastMs < 120) return;
  lastSamplePlayedAt[name] = nowMs;

  const variants = AUDIO_FILES[name];
  const lastIdx = lastVariantByName[name] ?? -1;
  let idx = 0;
  if (variants.length > 1) {
    const candidates: number[] = [];
    for (let i = 0; i < variants.length; i++) {
      if (i !== lastIdx) candidates.push(i);
    }
    idx = candidates[Math.floor(Math.random() * candidates.length)];
  }
  lastVariantByName[name] = idx;

  const buffer = sampleBuffers.get(variants[idx]);
  if (!buffer) {
    playSnortSound(gain);
    return;
  }

  const audio = initAudio();
  if (!audio) return;
  const { ctx, masterGain } = audio;

  try {
    while (activeSampleSources.length >= 3) {
      const oldest = activeSampleSources.shift();
      if (oldest) {
        try {
          oldest.onended = null;
          oldest.stop();
          oldest.disconnect();
        } catch {
          // Already stopped
        }
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const jitterRate = 0.94 + Math.random() * 0.12;
    source.playbackRate.value = jitterRate * rate;

    const sampleGain = ctx.createGain();
    sampleGain.gain.value = Math.max(0, gain);

    source.connect(sampleGain);
    sampleGain.connect(masterGain);

    activeSampleSources.push(source);
    source.onended = () => {
      const pos = activeSampleSources.indexOf(source);
      if (pos !== -1) activeSampleSources.splice(pos, 1);
      try {
        source.disconnect();
        sampleGain.disconnect();
      } catch {
        // Ignore cleanup errors
      }
    };

    source.start(ctx.currentTime);
  } catch {
    playSnortSound(gain);
  }
}

export function playTapSound(): void {
  if (!TAP_SOUND_ENABLED || !soundEnabled) return;
  playSample("snort", { gain: 0.5 });
}

/**
 * Procedural Paper Flick / Whoosh
 * 160ms burst of white noise through a sweeping bandpass filter with optional stereo panning.
 */
export function playPaperFlick(pan = 0): void {
  if (!soundEnabled) return;
  const audio = initAudio();
  if (!audio) return;
  const { ctx, masterGain } = audio;

  const now = ctx.currentTime;
  const duration = 0.16; // 160ms

  try {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    // Bandpass filter sweeping from 2200Hz down to 700Hz
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(700, now + duration);
    filter.Q.setValueAtTime(2.0, now);

    // Gain envelope: 5ms attack and 140ms decay, peak gain about 0.12
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.005 + 0.14);

    noiseSource.connect(filter);
    filter.connect(gainNode);

    // StereoPanner set to pan when supported (-0.7 left, 0 up, +0.7 right)
    if (typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
      gainNode.connect(panner);
      panner.connect(masterGain);
    } else {
      gainNode.connect(masterGain);
    }

    noiseSource.start(now);
    noiseSource.stop(now + duration);
  } catch {
    // Ignored
  }
}

/**
 * Procedural Pull-Cord Light Switch Click
 * 40ms burst of filtered noise + low tick, peak gain 0.1.
 */
export function playSwitchClick(): void {
  if (!soundEnabled) return;
  const audio = initAudio();
  if (!audio) return;
  const { ctx, masterGain } = audio;

  const now = ctx.currentTime;

  // Low mechanical switch tick
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(190, now);
  osc.frequency.exponentialRampToValueAtTime(65, now + 0.032);

  oscGain.gain.setValueAtTime(0.0001, now);
  oscGain.gain.linearRampToValueAtTime(0.08, now + 0.003);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.036);

  osc.connect(oscGain);
  oscGain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.04);

  // 40ms filtered noise burst
  try {
    const duration = 0.04;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1600, now);
    filter.Q.setValueAtTime(2.2, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(0.1, now + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);

    noiseSource.start(now);
    noiseSource.stop(now + duration);
  } catch {
    // Fallback safely ignored
  }
}

/**
 * Procedural Brass/Gold Coin Clink
 * Brief dual-partial metallic ping through shared masterGainNode.
 */
export function playCoinClink(): void {
  if (!soundEnabled) return;
  const audio = initAudio();
  if (!audio) return;
  const { ctx, masterGain } = audio;

  const now = ctx.currentTime;
  const partials = [
    { freq: 2420, gain: 0.22, decay: 0.14 },
    { freq: 3680, gain: 0.14, decay: 0.09 },
  ];

  partials.forEach(({ freq, gain, decay }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    osc.connect(g);
    g.connect(masterGain);

    osc.start(now);
    osc.stop(now + decay + 0.01);
  });
}

