import React, { useState, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  SLOGAN,
  SUB_LABEL,
  WEEKEND_BANNER,
  BULL_TAP_LINES,
  RAPID_TAP_LINE,
  PIN_TAP_LINES,
  IDLE_WATCH_LINE,
  HERO_COPY
} from '../copy.js';
import { playBellSound, playSnortSound, isSoundEnabled, setSoundEnabled } from '../utils/audio';
import { BuyButton } from './BuyButton';
import { getNyseStatus } from './TickerTape';

// =========================================================================
// NAMED CALIBRATION CONSTANTS (Tunable as specified in prompt)
// =========================================================================
export const LEFT_EYE_WHITE = { minX: 36, maxX: 47, minY: 34, maxY: 39 };
export const RIGHT_EYE_WHITE = { minX: 57, maxX: 68, minY: 34, maxY: 39 };
export const LEFT_PUPIL_DEFAULT = { x: 42.3, y: 36.3 };
export const RIGHT_PUPIL_DEFAULT = { x: 61.2, y: 36.0 };
export const PUPIL_DIAMETER_PCT = 3.0; // Pupil diameter ~3% of image width
export const MAX_TRAVEL_X_PCT = 2.5; // Max travel ~2.5% horizontally
export const MAX_TRAVEL_Y_PCT = 0.8; // Max travel ~0.8% vertically

export const LEFT_NOSTRIL = { x: 46.6, y: 49.8 };
export const RIGHT_NOSTRIL = { x: 60.8, y: 49.6 };
export const LAPEL_PIN = { x: 30.5, y: 83 };

interface SteamPuff {
  id: number;
  startX: number;
  startY: number;
  sizePx: number;
  risePx: number;
  driftPx: number;
}

export const Hero: React.FC = () => {
  // Eye mode runtime toggle (defaults to false)
  const [eyeMode, setEyeMode] = useState(false);

  // Debug mode: ?debug=eyes in URL
  const [debugEyes, setDebugEyes] = useState(false);

  // Normalized pointer coordinates (-1 to 1)
  const [pointer, setPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Head motion on tap
  const [headTransform, setHeadTransform] = useState('');

  // Steam puffs
  const [steamPuffs, setSteamPuffs] = useState<SteamPuff[]>([]);

  // Pin sparkle
  const [pinSparkle, setPinSparkle] = useState(false);

  // Speech bubble
  const [speechBubble, setSpeechBubble] = useState<{ text: string; id: number } | null>(null);

  // Buy button shake intensity
  const [shakeIntensity, setShakeIntensity] = useState(0);

  // Bronze Bell swing physics state
  const [bellAngle, setBellAngle] = useState(0);
  const [clapperAngle, setClapperAngle] = useState(0);
  const [isBellSwinging, setIsBellSwinging] = useState(false);
  const [bellPulse, setBellPulse] = useState(false);

  const bellEnergyRef = useRef(0);
  const bellStartTimeRef = useRef(0);
  const bellRafRef = useRef<number | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Eye sticker button animation state
  const [isEyeBlinking, setIsEyeBlinking] = useState(false);
  const [isEyeBouncing, setIsEyeBouncing] = useState(false);

  // Tap tracking
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);
  const idleTimerRef = useRef<number | null>(null);
  const speechTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Live NYSE status for weekend banner
  const [nyse, setNyse] = useState(() => getNyseStatus());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(media.matches);
      setDebugEyes(window.location.search.includes('debug=eyes'));
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNyse(getNyseStatus());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Preload expression images
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const imagesToPreload = [
        '/assets/bull-hero-final.png',
        '/assets/bull-hero-nopupils.png',
        '/assets/bull-browraise.png',
        '/assets/bull-shocked.png',
        '/assets/bull-smug.png',
        '/assets/bull-watch.png',
      ];
      imagesToPreload.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    }
  }, []);

  // Show a speech bubble with auto-dismiss
  const showSpeech = useCallback((text: string, duration = 3500) => {
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    setSpeechBubble({ text, id: Date.now() });
    speechTimeoutRef.current = window.setTimeout(() => {
      setSpeechBubble(null);
    }, duration);
  }, []);

  // Idle timer: 20 seconds of no interaction shows idle speech line
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      showSpeech(IDLE_WATCH_LINE, 4000);
    }, 20000); // 20s
  }, [showSpeech]);

  // Reset idle timer on any interaction
  useEffect(() => {
    resetIdleTimer();
    const onActivity = () => resetIdleTimer();
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('scroll', onActivity, { passive: true });
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('scroll', onActivity);
    };
  }, [resetIdleTimer]);

  // Pin auto sparkle hint every 8 to 10 seconds
  useEffect(() => {
    let timeoutId: number;
    const scheduleHint = () => {
      const delay = 8000 + Math.random() * 2000;
      timeoutId = window.setTimeout(() => {
        setPinSparkle(true);
        setTimeout(() => setPinSparkle(false), 600);
        scheduleHint();
      }, delay);
    };
    scheduleHint();
    return () => clearTimeout(timeoutId);
  }, []);

  // Pointer move handler (pointer events + touch-action: pan-y on element)
  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    resetIdleTimer();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1; // -1 to 1
    setPointer({
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    });
  };

  // Steam emitter: 5 to 7 small flat puffs per nostril, cream (#E8DFC9) at 60% opacity
  const emitSteam = useCallback(() => {
    const leftCount = Math.floor(5 + Math.random() * 3); // 5 to 7
    const rightCount = Math.floor(5 + Math.random() * 3); // 5 to 7
    const puffs: SteamPuff[] = [];
    let idCounter = Date.now();

    // Left nostril puffs
    for (let i = 0; i < leftCount; i++) {
      puffs.push({
        id: idCounter++,
        startX: LEFT_NOSTRIL.x + (Math.random() - 0.5) * 1.5,
        startY: LEFT_NOSTRIL.y + (Math.random() - 0.5) * 1.5,
        sizePx: Math.round(8 + Math.random() * 8), // 8 to 16px
        risePx: Math.round(40 + Math.random() * 30), // 40 to 70px
        driftPx: -Math.round(8 + Math.random() * 14), // drift left
      });
    }

    // Right nostril puffs
    for (let i = 0; i < rightCount; i++) {
      puffs.push({
        id: idCounter++,
        startX: RIGHT_NOSTRIL.x + (Math.random() - 0.5) * 1.5,
        startY: RIGHT_NOSTRIL.y + (Math.random() - 0.5) * 1.5,
        sizePx: Math.round(8 + Math.random() * 8), // 8 to 16px
        risePx: Math.round(40 + Math.random() * 30), // 40 to 70px
        driftPx: Math.round(8 + Math.random() * 14), // drift right
      });
    }

    setSteamPuffs(puffs);
    playSnortSound();

    setTimeout(() => {
      setSteamPuffs([]);
    }, 950);
  }, []);

  // Tap Bull handler
  const handleBullTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    resetIdleTimer();

    const now = Date.now();
    // Count taps less than 1.5s apart
    if (now - lastTapTimeRef.current < 1500) {
      tapCountRef.current += 1;
    } else {
      tapCountRef.current = 1;
    }
    lastTapTimeRef.current = now;

    // Small head motion (rotate up to 1.5deg, scale 1.015, back)
    if (!prefersReducedMotion) {
      const rot = (tapCountRef.current % 2 === 0 ? 1 : -1) * 1.5;
      setHeadTransform(`rotate(${rot}deg) scale(1.015)`);
      setTimeout(() => {
        setHeadTransform('rotate(0deg) scale(1)');
      }, 140);
    }

    // Emit steam
    emitSteam();

    // Speech line (stays deadpan on multiple taps, never changes expression)
    if (tapCountRef.current >= 5) {
      showSpeech(RAPID_TAP_LINE, 3000);
    } else {
      const randomLine = BULL_TAP_LINES[Math.floor(Math.random() * BULL_TAP_LINES.length)];
      showSpeech(randomLine, 3500);
    }
  };

  // Tap Pin handler (invisible >=44px tap area, 14px sparkle fades in over 0.6s)
  const handlePinTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    resetIdleTimer();
    setPinSparkle(true);
    setTimeout(() => setPinSparkle(false), 600);

    const pinLine = PIN_TAP_LINES[Math.floor(Math.random() * PIN_TAP_LINES.length)];
    showSpeech(pinLine, 3500);
  };

  // Eye sticker toggle handler
  const handleEyeToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    resetIdleTimer();
    if (!prefersReducedMotion) {
      setIsEyeBouncing(true);
      setTimeout(() => setIsEyeBouncing(false), 300);
    }
    const nextMode = !eyeMode;
    setEyeMode(nextMode);
    if (nextMode && !prefersReducedMotion) {
      setIsEyeBlinking(true);
      setTimeout(() => setIsEyeBlinking(false), 200);
    }
  };

  // Ring hanging bronze trading bell
  const ringBell = () => {
    resetIdleTimer();

    // Tap on the bell turns sound on if it is off (deliberate tap), then rings
    if (!isSoundEnabled()) {
      setSoundEnabled(true);
    }
    playBellSound();

    // Release a few pieces of ticker-tape confetti from the bell's position
    if (bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      const originX = (rect.left + rect.width / 2) / window.innerWidth;
      const originY = rect.bottom / window.innerHeight;
      try {
        confetti({
          particleCount: 16,
          spread: 60,
          origin: { x: originX, y: originY },
          colors: ['#E8DFC9', '#C97B1A', '#F2B24A', '#C23B22', '#2FD27A', '#FFFFFF'],
          shapes: ['square'],
          scalar: 0.95,
          gravity: 1.0,
          drift: 0.05,
          ticks: 140,
        });
      } catch {
        // Fallback safely ignored
      }
    }

    // Reduced motion: no sway; short scale pulse and sound only
    if (prefersReducedMotion) {
      setBellPulse(true);
      setTimeout(() => setBellPulse(false), 250);
      return;
    }

    // Damped pendulum physics starting near 18 degrees, settling over ~2.5s.
    // Each extra tap adds energy (capped at 25 degrees).
    const currentEnergy = bellEnergyRef.current;
    const newEnergy = Math.min(25, currentEnergy > 2 ? currentEnergy + 8 : 18);
    bellEnergyRef.current = newEnergy;
    bellStartTimeRef.current = performance.now();
    setIsBellSwinging(true);

    if (bellRafRef.current) {
      cancelAnimationFrame(bellRafRef.current);
    }

    const freq = 11.2; // ~1.78 Hz natural bell cadence in radians/s
    const decay = 1.9; // exponential damping settling over ~2.5s

    const step = (now: number) => {
      const elapsed = (now - bellStartTimeRef.current) / 1000;
      if (elapsed > 2.5 || bellEnergyRef.current <= 0.1) {
        setIsBellSwinging(false);
        bellEnergyRef.current = 0;
        setBellAngle(0);
        setClapperAngle(0);
        return;
      }

      const envelope = bellEnergyRef.current * Math.exp(-decay * elapsed);
      // Bell pendulum swing
      const bAngle = envelope * Math.cos(freq * elapsed);
      // Clapper swing slightly out of phase (phase lag ~0.65 rad)
      const cAngle = envelope * 1.3 * Math.cos(freq * elapsed - 0.65);

      setBellAngle(bAngle);
      setClapperAngle(cAngle);

      bellRafRef.current = requestAnimationFrame(step);
    };

    bellRafRef.current = requestAnimationFrame(step);
  };

  // Cleanup bell RAF on unmount
  useEffect(() => {
    return () => {
      if (bellRafRef.current) cancelAnimationFrame(bellRafRef.current);
    };
  }, []);

  // Calculate live pupil center in percent of the entire image
  const leftPupilCurrent = {
    x: LEFT_PUPIL_DEFAULT.x + pointer.x * MAX_TRAVEL_X_PCT,
    y: LEFT_PUPIL_DEFAULT.y + pointer.y * MAX_TRAVEL_Y_PCT,
  };

  const rightPupilCurrent = {
    x: RIGHT_PUPIL_DEFAULT.x + pointer.x * MAX_TRAVEL_X_PCT,
    y: RIGHT_PUPIL_DEFAULT.y + pointer.y * MAX_TRAVEL_Y_PCT,
  };

  // Subtle tilt parallax when eyeMode is off
  const parallaxTransform = !eyeMode && !prefersReducedMotion
    ? `perspective(800px) rotateX(${-pointer.y * 3}deg) rotateY(${pointer.x * 3.5}deg) translate3d(${pointer.x * 4}px, ${pointer.y * 4}px, 0)`
    : '';

  const shakeTransform =
    shakeIntensity > 0 && !prefersReducedMotion
      ? `translate(${(Math.random() - 0.5) * (shakeIntensity * 0.1)}px, ${(Math.random() - 0.5) * (shakeIntensity * 0.1)}px)`
      : '';

  return (
    <section className="relative w-full min-h-screen bg-black flex flex-col items-center justify-between pt-6 pb-20 px-4 overflow-hidden select-none">
      
      {/* Top Header Bar */}
      <header className="w-full max-w-5xl flex items-center justify-between z-30 px-2 sm:px-6 pt-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-[#C97B1A] rotate-45" />
          <span className="font-plex text-xs sm:text-sm font-bold tracking-widest text-[#E8DFC9] uppercase">
            {SUB_LABEL}
          </span>
        </div>
        {/* Right side spacer to keep layout balanced */}
        <div className="w-14 h-10 pointer-events-none" aria-hidden="true" />
      </header>

      {/* ================================================================= */}
      {/* 1. BRONZE TRADING BELL (Hanging from top edge on short rope)      */}
      {/* Flat ink style with thick dark outlines (~56px wide)              */}
      {/* Idle: slow sway +-2 deg. Tap: real bell pendulum swing ~2.5s      */}
      {/* Out-of-phase clapper, adds energy on tap up to 25 deg             */}
      {/* Deliberate tap turns sound on if off, rings & confetti            */}
      {/* ================================================================= */}
      <button
        ref={bellRef}
        type="button"
        onClick={ringBell}
        aria-label={HERO_COPY.bellAria}
        title={HERO_COPY.bellAria}
        className="absolute top-0 right-4 sm:right-8 md:right-12 z-40 w-14 h-[76px] min-w-[48px] min-h-[48px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] bg-transparent border-0 p-0 select-none flex flex-col items-center"
        style={{
          transformOrigin: '28px 0px',
          transform: bellPulse
            ? 'scale(1.08)'
            : isBellSwinging
            ? `rotate(${bellAngle}deg)`
            : undefined,
          animation:
            !isBellSwinging && !prefersReducedMotion
              ? 'bellIdleSway 3.6s ease-in-out infinite'
              : 'none',
          transition: bellPulse ? 'transform 0.15s ease-out' : 'none',
        }}
      >
        <svg
          viewBox="0 0 56 76"
          className="w-14 h-[76px] overflow-visible"
          fill="none"
        >
          {/* Top Anchor Fixture at ceiling edge */}
          <rect x="22" y="0" width="12" height="4" rx="1" fill="#141312" stroke="black" strokeWidth="2" />
          <circle cx="28" cy="4" r="2.5" fill="#C97B1A" stroke="black" strokeWidth="1.5" />

          {/* Short Braided Rope */}
          <line x1="28" y1="4" x2="28" y2="21" stroke="#3D2E1E" strokeWidth="4" strokeLinecap="round" />
          <line x1="28" y1="5" x2="28" y2="20" stroke="#0E0D0C" strokeWidth="1.5" strokeDasharray="3 3" />

          {/* Bell Top Crown Ring */}
          <ellipse cx="28" cy="21" rx="4.5" ry="3.5" fill="#0E0D0C" stroke="black" strokeWidth="2.5" />
          <circle cx="28" cy="21" r="1.8" fill="#F2B24A" />

          {/* Clapper Swinging Slightly Out of Phase */}
          <g
            style={{
              transform: `rotate(${isBellSwinging ? clapperAngle : 0}deg)`,
              transformOrigin: '28px 26px',
              transition: isBellSwinging ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            <line x1="28" y1="26" x2="28" y2="62" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="28" cy="62" r="5" fill="#5A3E1B" stroke="black" strokeWidth="2.5" />
            <circle cx="26.5" cy="60.5" r="1.5" fill="#F2B24A" />
          </g>

          {/* Bell Body - Flat ink style bronze with thick 2.5px dark outline */}
          <path
            d="M 22,24
               C 23,22 33,22 34,24
               C 35,31 37,41 41,49
               C 44,55 51,57 52,60
               C 52,62 4,62 4,60
               C 5,57 12,55 15,49
               C 19,41 21,31 22,24 Z"
            fill="#C97B1A"
            stroke="black"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Bronze Highlight Facet */}
          <path
            d="M 33,25
               C 35,31 36,41 39,48
               C 42,53 47,56 49,59
               C 46,59 38,57 35,50
               C 32,43 31,32 30,25 Z"
            fill="#F2B24A"
          />

          {/* Bell Sound Lip Lower Rim */}
          <ellipse cx="28" cy="60" rx="24" ry="3.5" fill="#8B4F10" stroke="black" strokeWidth="2" />
          <ellipse cx="28" cy="60" rx="21" ry="2" fill="#141312" />
        </svg>
      </button>

      {/* Weekend Banner */}
      {nyse.isWeekend && (
        <div className="w-full max-w-2xl mt-3 z-30 px-3">
          <div className="bg-[#C23B22] text-white border-2 border-black px-4 py-2 font-anton text-sm sm:text-base tracking-wider text-center uppercase shadow-[3px_3px_0_#C97B1A]">
            ⚠️ {WEEKEND_BANNER}
          </div>
        </div>
      )}

      {/* Main Bull Character Stage */}
      <div
        ref={containerRef}
        onPointerDown={handlePointer}
        onPointerMove={handlePointer}
        className="relative w-full max-w-xl flex flex-col items-center justify-center my-auto cursor-crosshair touch-pan-y"
      >
        {/* Huge Slogan Headline (Anton) */}
        <div className="w-full text-center mt-2 mb-1 z-30 pointer-events-none">
          <h1 className="font-anton text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[0.9] uppercase text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
            <span className="text-[#C97B1A]">THE BULLS</span> <br className="sm:hidden" />
            <span className="text-[#E8DFC9]">ARE ONCHAIN.</span>
          </h1>
        </div>

        {/* Mascot Container */}
        <div
          className="relative w-[310px] h-[310px] sm:w-[420px] sm:h-[420px] md:w-[480px] md:h-[480px] flex items-center justify-center"
          style={{
            transform: `${parallaxTransform} ${shakeTransform}`,
            transition: shakeIntensity > 0 ? 'none' : 'transform 0.12s ease-out',
          }}
        >
          {/* Edge-softening Mask Bull Container with Head Motion on Tap */}
          <div
            onClick={handleBullTap}
            className="relative w-full h-full bull-mask cursor-pointer"
            style={{
              transform: headTransform,
              transition: prefersReducedMotion ? 'none' : 'transform 0.14s cubic-bezier(0.2, 0.8, 0.4, 1)',
            }}
            title="Tap the Bull"
          >
            {/* ================================================================= */}
            {/* SVG CLIP PATHS FOR ALMOND-SHAPED EYE WHITES                       */}
            {/* ================================================================= */}
            <svg className="absolute w-0 h-0" aria-hidden="true" focusable="false">
              <defs>
                {/* Almond shape tapered at corners (x=0, y=0.5) and (x=1, y=0.5) */}
                <clipPath id="left-eye-almond" clipPathUnits="objectBoundingBox">
                  <path d="M 0,0.5 Q 0.5,-0.05 1,0.5 Q 0.5,1.05 0,0.5 Z" />
                </clipPath>
                <clipPath id="right-eye-almond" clipPathUnits="objectBoundingBox">
                  <path d="M 0,0.5 Q 0.5,-0.05 1,0.5 Q 0.5,1.05 0,0.5 Z" />
                </clipPath>
              </defs>
            </svg>

            {/* ================================================================= */}
            {/* STACKED EXPRESSIONS (Crossfade 250ms, identical size & position)  */}
            {/* ================================================================= */}

            {/* 1. Deadpan (bull-hero-final.png) */}
            {/* Base Mascot: Deadpan Bull (bull-hero-final.png) with original eyes */}
            <img
              src="/assets/bull-hero-final.png"
              alt="Deadpan bronze bull in black business suit"
              width={1254}
              height={1254}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />

            {/* ================================================================= */}
            {/* EYE MODE LAYER: bull-hero-nopupils.png + Live Almond Clipped Pupils */}
            {/* Crossfade (200ms)                                                 */}
            {/* ================================================================= */}
            <div
              className={`absolute inset-0 w-full h-full pointer-events-none ${
                prefersReducedMotion ? '' : 'transition-opacity duration-200'
              }`}
              style={{ opacity: eyeMode ? 1 : 0 }}
            >
              <img
                src="/assets/bull-hero-nopupils.png"
                alt="Bull mascot eye whites"
                width={1254}
                height={1254}
                className="w-full h-full object-contain"
              />

              {/* LEFT EYE WHITE ALMOND CONTAINER */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${LEFT_EYE_WHITE.minX}%`,
                  top: `${LEFT_EYE_WHITE.minY}%`,
                  width: `${LEFT_EYE_WHITE.maxX - LEFT_EYE_WHITE.minX}%`,
                  height: `${LEFT_EYE_WHITE.maxY - LEFT_EYE_WHITE.minY}%`,
                  clipPath: 'url(#left-eye-almond)',
                  WebkitClipPath: 'url(#left-eye-almond)',
                }}
              >
                {/* Left Live Black Eyeball with Touch of White matching original */}
                <div
                  className="absolute bg-black rounded-full pointer-events-none"
                  style={{
                    width: `${(PUPIL_DIAMETER_PCT / (LEFT_EYE_WHITE.maxX - LEFT_EYE_WHITE.minX)) * 100}%`,
                    height: `${(PUPIL_DIAMETER_PCT / (LEFT_EYE_WHITE.maxY - LEFT_EYE_WHITE.minY)) * 100}%`,
                    left: `${((leftPupilCurrent.x - LEFT_EYE_WHITE.minX) / (LEFT_EYE_WHITE.maxX - LEFT_EYE_WHITE.minX)) * 100}%`,
                    top: `${((leftPupilCurrent.y - LEFT_EYE_WHITE.minY) / (LEFT_EYE_WHITE.maxY - LEFT_EYE_WHITE.minY)) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {/* Little touch of white (specular catchlight) matching original image */}
                  <div
                    className="absolute bg-white rounded-full pointer-events-none"
                    style={{
                      width: '32%',
                      height: '32%',
                      top: '22%',
                      left: '24%',
                      opacity: 0.95,
                    }}
                  />
                </div>
              </div>

              {/* RIGHT EYE WHITE ALMOND CONTAINER */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${RIGHT_EYE_WHITE.minX}%`,
                  top: `${RIGHT_EYE_WHITE.minY}%`,
                  width: `${RIGHT_EYE_WHITE.maxX - RIGHT_EYE_WHITE.minX}%`,
                  height: `${RIGHT_EYE_WHITE.maxY - RIGHT_EYE_WHITE.minY}%`,
                  clipPath: 'url(#right-eye-almond)',
                  WebkitClipPath: 'url(#right-eye-almond)',
                }}
              >
                {/* Right Live Black Eyeball with Touch of White matching original */}
                <div
                  className="absolute bg-black rounded-full pointer-events-none"
                  style={{
                    width: `${(PUPIL_DIAMETER_PCT / (RIGHT_EYE_WHITE.maxX - RIGHT_EYE_WHITE.minX)) * 100}%`,
                    height: `${(PUPIL_DIAMETER_PCT / (RIGHT_EYE_WHITE.maxY - RIGHT_EYE_WHITE.minY)) * 100}%`,
                    left: `${((rightPupilCurrent.x - RIGHT_EYE_WHITE.minX) / (RIGHT_EYE_WHITE.maxX - RIGHT_EYE_WHITE.minX)) * 100}%`,
                    top: `${((rightPupilCurrent.y - RIGHT_EYE_WHITE.minY) / (RIGHT_EYE_WHITE.maxY - RIGHT_EYE_WHITE.minY)) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {/* Little touch of white (specular catchlight) matching original image */}
                  <div
                    className="absolute bg-white rounded-full pointer-events-none"
                    style={{
                      width: '32%',
                      height: '32%',
                      top: '22%',
                      left: '24%',
                      opacity: 0.95,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ================================================================= */}
            {/* DEBUG OVERLAY (?debug=eyes)                                       */}
            {/* Outlines clip shapes & shows dots at pupil centres for calibration */}
            {/* ================================================================= */}
            {debugEyes && (
              <div className="absolute inset-0 pointer-events-none z-50">
                {/* Left Eye Bounding Box & Clip Shape Outline */}
                <div
                  className="absolute border border-dashed border-yellow-400"
                  style={{
                    left: `${LEFT_EYE_WHITE.minX}%`,
                    top: `${LEFT_EYE_WHITE.minY}%`,
                    width: `${LEFT_EYE_WHITE.maxX - LEFT_EYE_WHITE.minX}%`,
                    height: `${LEFT_EYE_WHITE.maxY - LEFT_EYE_WHITE.minY}%`,
                  }}
                >
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M 0,50 Q 50,-5 100,50 Q 50,105 0,50 Z" fill="none" stroke="#ff0055" strokeWidth="2" />
                  </svg>
                </div>

                {/* Right Eye Bounding Box & Clip Shape Outline */}
                <div
                  className="absolute border border-dashed border-yellow-400"
                  style={{
                    left: `${RIGHT_EYE_WHITE.minX}%`,
                    top: `${RIGHT_EYE_WHITE.minY}%`,
                    width: `${RIGHT_EYE_WHITE.maxX - RIGHT_EYE_WHITE.minX}%`,
                    height: `${RIGHT_EYE_WHITE.maxY - RIGHT_EYE_WHITE.minY}%`,
                  }}
                >
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M 0,50 Q 50,-5 100,50 Q 50,105 0,50 Z" fill="none" stroke="#ff0055" strokeWidth="2" />
                  </svg>
                </div>

                {/* Left Default Center (green) vs Current Pupil Center (cyan) */}
                <div
                  className="absolute w-2 h-2 rounded-full bg-green-400 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${LEFT_PUPIL_DEFAULT.x}%`, top: `${LEFT_PUPIL_DEFAULT.y}%` }}
                />
                <div
                  className="absolute w-2 h-2 rounded-full bg-cyan-400 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${leftPupilCurrent.x}%`, top: `${leftPupilCurrent.y}%` }}
                />

                {/* Right Default Center (green) vs Current Pupil Center (cyan) */}
                <div
                  className="absolute w-2 h-2 rounded-full bg-green-400 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${RIGHT_PUPIL_DEFAULT.x}%`, top: `${RIGHT_PUPIL_DEFAULT.y}%` }}
                />
                <div
                  className="absolute w-2 h-2 rounded-full bg-cyan-400 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${rightPupilCurrent.x}%`, top: `${rightPupilCurrent.y}%` }}
                />

                {/* Calibration HUD readout */}
                <div className="absolute top-2 left-2 bg-black/90 text-[10px] font-plex text-[#F2B24A] p-2 border border-[#C97B1A]">
                  <div>L default: ({LEFT_PUPIL_DEFAULT.x}, {LEFT_PUPIL_DEFAULT.y})</div>
                  <div>L live: ({leftPupilCurrent.x.toFixed(1)}, {leftPupilCurrent.y.toFixed(1)})</div>
                  <div>R default: ({RIGHT_PUPIL_DEFAULT.x}, {RIGHT_PUPIL_DEFAULT.y})</div>
                  <div>R live: ({rightPupilCurrent.x.toFixed(1)}, {rightPupilCurrent.y.toFixed(1)})</div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* FLAT STEAM PUFFS (5-7 per nostril, 8-16px, cream #E8DFC9 @ 60%)   */}
            {/* ================================================================= */}
            {steamPuffs.map((puff) => (
              <div
                key={puff.id}
                className="absolute pointer-events-none rounded-full"
                style={{
                  left: `${puff.startX}%`,
                  top: `${puff.startY}%`,
                  width: `${puff.sizePx}px`,
                  height: `${puff.sizePx}px`,
                  backgroundColor: 'rgba(232, 223, 201, 0.6)',
                  animation: prefersReducedMotion ? 'none' : `puffRise 0.9s cubic-bezier(0.25, 1, 0.5, 1) forwards`,
                  transform: 'translate(-50%, -50%)',
                  ['--rise-y' as string]: `-${puff.risePx}px`,
                  ['--drift-x' as string]: `${puff.driftPx}px`,
                }}
              />
            ))}

            {/* ================================================================= */}
            {/* INVISIBLE PIN TAP AREA (>= 44px, no visible circle, no outline)   */}
            {/* On tap or hint: four-point sparkle (14px) fades in over 0.6s      */}
            {/* ================================================================= */}
            <button
              type="button"
              onClick={handlePinTap}
              aria-label={HERO_COPY.pinAria}
              title={HERO_COPY.pinAria}
              className="absolute min-w-[48px] min-h-[48px] w-12 h-12 -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer bg-transparent border-0 outline-none p-0 flex items-center justify-center focus-visible:ring-1 focus-visible:ring-[#F2B24A]/40"
              style={{ left: `${LAPEL_PIN.x}%`, top: `${LAPEL_PIN.y}%` }}
            >
              {/* 14px Four-Point Sparkle */}
              {pinSparkle && (
                <div
                  className="pointer-events-none flex items-center justify-center"
                  style={{ animation: 'sparkleFade 0.6s ease-in-out forwards' }}
                >
                  <svg
                    className="w-[14px] h-[14px] text-[#F2B24A]"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0 L14 9.5 L24 12 L14 14.5 L12 24 L10 14.5 L0 12 L10 9.5 Z" />
                  </svg>
                </div>
              )}
            </button>

            {/* ================================================================= */}
            {/* 2. EYE BUTTON STICKER                                             */}
            {/* Round sticker attached to bull image at his right shoulder        */}
            {/* (x: 82%, y: 72%), not overlapping pin (30.5%, 83%) or buy ticket  */}
            {/* Lid closed when OFF, quick blink on toggle, tiny pupil tracks ptr */}
            {/* ================================================================= */}
            <button
              type="button"
              onClick={handleEyeToggle}
              aria-pressed={eyeMode}
              aria-label={eyeMode ? HERO_COPY.eyesOn : HERO_COPY.eyesOff}
              title={eyeMode ? HERO_COPY.eyesOn : HERO_COPY.eyesOff}
              className={`absolute min-w-[48px] min-h-[48px] w-12 h-12 sm:w-14 sm:h-14 -translate-x-1/2 -translate-y-1/2 z-30 rounded-full bg-[#C97B1A] hover:bg-[#F2B24A] text-black border-[2.5px] border-black shadow-[2px_2px_0_#000] cursor-pointer flex items-center justify-center rotate-6 transition-colors focus-visible:ring-2 focus-visible:ring-[#F2B24A] outline-none ${
                isEyeBouncing ? 'animate-sticker-squash' : ''
              }`}
              style={{ left: '82%', top: '72%' }}
            >
              <svg
                viewBox="0 0 28 28"
                className="w-7 h-7 sm:w-8 sm:h-8 overflow-visible"
                fill="none"
              >
                {!eyeMode || isEyeBlinking ? (
                  /* LID CLOSED (or during blink) */
                  <g>
                    {/* Eyelid crease */}
                    <path
                      d="M 8,10 Q 14,8 20,10"
                      stroke="#5A3E1B"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    {/* Closed eyelid curved line */}
                    <path
                      d={isEyeBlinking ? "M 5,14 Q 14,16 23,14" : "M 5,14 Q 14,20 23,14"}
                      stroke="black"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    {/* Delicate lashes when fully closed */}
                    {!isEyeBlinking && (
                      <>
                        <line x1="9" y1="16" x2="8" y2="19" stroke="black" strokeWidth="2" strokeLinecap="round" />
                        <line x1="14" y1="17" x2="14" y2="21" stroke="black" strokeWidth="2" strokeLinecap="round" />
                        <line x1="19" y1="16" x2="20" y2="19" stroke="black" strokeWidth="2" strokeLinecap="round" />
                      </>
                    )}
                  </g>
                ) : (
                  /* EYE OPEN WITH LIVE PUPIL TRACKING POINTER */
                  <g>
                    {/* Upper eyelid fold crease */}
                    <path
                      d="M 6,8 Q 14,5 22,8"
                      stroke="black"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    {/* Almond eye white */}
                    <path
                      d="M 4,14 Q 14,6.5 24,14 Q 14,21.5 4,14 Z"
                      fill="#E8DFC9"
                      stroke="black"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                    {/* Tiny pupil following pointer */}
                    <circle
                      cx={14 + pointer.x * 3.8}
                      cy={14 + pointer.y * 1.8}
                      r="2.8"
                      fill="black"
                    />
                    {/* Specular catchlight white dot matching original eye */}
                    <circle
                      cx={14 + pointer.x * 3.8 - 0.8}
                      cy={14 + pointer.y * 1.8 - 0.8}
                      r="0.9"
                      fill="white"
                    />
                  </g>
                )}
              </svg>
            </button>
          </div>

          {/* =================================================================== */}
          {/* REPOSITIONED SPEECH TAG                                             */}
          {/* Placed at lower-right (y: ~58%) so it never covers horns, eyes or pin */}
          {/* Keeps fully on screen on narrow phones                              */}
          {/* =================================================================== */}
          {speechBubble && (
            <div
              role="status"
              className="absolute top-[58%] right-1 sm:-right-6 max-w-[200px] sm:max-w-[250px] z-50 bg-[#E8DFC9] text-black font-plex text-xs sm:text-sm font-bold px-3 py-2 border-2 border-black shadow-[4px_4px_0_#C97B1A] animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="relative">
                {speechBubble.text}
                {/* Arrow tail pointing back towards mouth (up-left) */}
                <div className="absolute top-2 -left-2 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-[#E8DFC9] border-b-[6px] border-b-transparent" />
                <div className="absolute top-2 -left-3 w-0 h-0 border-t-[7px] border-t-transparent border-r-[9px] border-r-black border-b-[7px] border-b-transparent -z-10" />
              </div>
            </div>
          )}
        </div>

        {/* ORDER TICKET BUY BUTTON */}
        <div className="w-full flex justify-center mt-2 z-30">
          <BuyButton
            onChargingChange={(pct) => setShakeIntensity(pct)}
            onEarlyRelease={(msg) => showSpeech(msg, 3000)}
            onChargeComplete={() => {
              emitSteam();
              showSpeech(HERO_COPY.orderSubmitted, 4000);
            }}
          />
        </div>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes bellIdleSway {
          0%, 100% {
            transform: rotate(-2deg);
          }
          50% {
            transform: rotate(2deg);
          }
        }
        @keyframes stickerSquash {
          0% { transform: translate(-50%, -50%) rotate(6deg) scale(1); }
          30% { transform: translate(-50%, -50%) rotate(6deg) scale3d(1.15, 0.85, 1); }
          60% { transform: translate(-50%, -50%) rotate(6deg) scale3d(0.9, 1.1, 1); }
          80% { transform: translate(-50%, -50%) rotate(6deg) scale3d(1.04, 0.96, 1); }
          100% { transform: translate(-50%, -50%) rotate(6deg) scale(1); }
        }
        .animate-sticker-squash {
          animation: stickerSquash 0.3s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
        }
        @keyframes puffRise {
          0% {
            opacity: 0.6;
            transform: translate(-50%, -50%) translate3d(0, 0, 0) scale(0.7);
          }
          70% {
            opacity: 0.45;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translate3d(var(--drift-x, 0), var(--rise-y, -50px), 0) scale(1.3);
          }
        }
        @keyframes sparkleFade {
          0% {
            opacity: 0;
            transform: scale(0.3) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.15) rotate(15deg);
          }
          100% {
            opacity: 0;
            transform: scale(0.5) rotate(30deg);
          }
        }
      `}</style>
    </section>
  );
};
