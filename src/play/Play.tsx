import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BuyButton } from '../components/BuyButton.jsx';
import {
  BUY_URL,
  SEASON,
  TELEGRAM_URL,
  TOKEN_TICKER,
  WEEKLY_CHALLENGE,
  X_URL,
} from '../config.js';
import { PLAY_COPY } from '../copy.js';
import { BullRunEngine } from './engine';
import { drawLocationPreview } from './locations';
import { playGameSound } from './sound';
import {
  buildShareCard,
  isAndroidDevice,
  isIosSafariDevice,
  triggerBlobDownload,
  type BuiltShareCard,
} from './shareCard';
import {
  getCodeLockoutRemainingSeconds,
  getFreeUnlocksForScore,
  getRankLabel,
  getUtcDateString,
  hasTierPrivilege,
  isLocationUnlocked,
  isSeasonActive,
  isWeeklyChallengeBeaten,
  loadAnimTune,
  loadBestScore,
  loadHerdPass,
  loadSelectedLocation,
  resetAnimTune,
  saveAnimTune,
  verifyAndUnlockHerdCode,
} from './storage';
import type {
  AnimTuneSettings,
  FreeUnlockId,
  GameHudSnapshot,
  HerdPassState,
  HerdTier,
  LocationId,
  RiderPoseKey,
} from './types';

const DEFAULT_OPAQUE_FRAC = {
  x: 263 / 1536,
  y: 10 / 1024,
  w: 1030 / 1536,
  h: 1004 / 1024,
};

const INITIAL_HUD: GameHudSnapshot = {
  phase: 'START',
  locationId: 'wallStreet',
  locationBannerTimer: 0,
  isDailyRun: false,
  dailyDate: '',
  score: 0,
  bestScore: 0,
  isNewBest: false,
  coinCount: 0,
  comboLevel: 1,
  comboTimer: 0,
  counterBumpKey: 0,
  bearGap: 100,
  showBearPaw: false,
  chargeCoins: 0,
  chargeReady: false,
  chargeTimer: 0,
  magnetTimer: 0,
  hasPickupShield: false,
  secondWindAvailable: false,
  secondWindUsed: false,
  showGoBadge: false,
  showTapHint: false,
  breakdown: {
    distance: 0,
    coinsCombo: 0,
    closeCalls: 0,
    perfects: 0,
  },
  runSeed: 1,
  runStartMinute: 0,
  endedByCatch: false,
  runnerAnchor: { x: 80, y: 400, w: 120, h: 120 },
};

function readUsableViewport(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 390, height: 664 };
  }
  const vv = window.visualViewport;
  if (vv) {
    return {
      width: Math.round(vv.width),
      height: Math.round(vv.height),
    };
  }
  return {
    width: Math.round(window.innerWidth),
    height: Math.round(window.innerHeight),
  };
}

const BearPawIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 22"
    className="w-5 h-5 shrink-0 text-[#C23B22]"
    fill="currentColor"
    aria-hidden="true"
  >
    <circle cx="5.5" cy="6" r="2.3" />
    <circle cx="10" cy="3.8" r="2.3" />
    <circle cx="14.5" cy="3.8" r="2.3" />
    <circle cx="19" cy="6" r="2.3" />
    <path d="M6.5 13.5C6.5 10.2 9.2 8.2 12 8.2C14.8 8.2 17.5 10.2 17.5 13.5C17.5 16.5 15.2 18.8 12 18.8C8.8 18.8 6.5 16.5 6.5 13.5Z" />
  </svg>
);

const ShieldHudIcon: React.FC<{ broken?: boolean }> = ({ broken = false }) => (
  <svg
    viewBox="0 0 20 22"
    className={`w-4 h-4 shrink-0 ${broken ? 'text-[#E8DFC9]/35' : 'text-[#F2B24A]'}`}
    fill={broken ? 'none' : 'currentColor'}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10 2L17 5V10.5C17 15.2 14 18.6 10 20C6 18.6 3 15.2 3 10.5V5L10 2Z" />
    {broken && <path d="M5 16L15 6" stroke="#C23B22" strokeWidth="2.2" />}
  </svg>
);

const MagnetHudIcon: React.FC = () => (
  <svg
    viewBox="0 0 20 20"
    className="w-4 h-4 shrink-0 text-[#2FD27A]"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M5 4v6a5 5 0 0 0 10 0V4" />
    <line x1="3.5" y1="6.5" x2="6.5" y2="6.5" />
    <line x1="13.5" y1="6.5" x2="16.5" y2="6.5" />
  </svg>
);

const LockIcon: React.FC<{ unlocked: boolean }> = ({ unlocked }) =>
  unlocked ? (
    <svg
      viewBox="0 0 16 16"
      className="w-3.5 h-3.5 shrink-0 text-[#F2B24A]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 16 16"
      className="w-3.5 h-3.5 shrink-0 text-[#E8DFC9]/45"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );

const LocationPreviewCardCanvas: React.FC<{ locId: LocationId }> = ({ locId }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      drawLocationPreview(ref.current, locId);
    }
  }, [locId]);

  return (
    <canvas
      ref={ref}
      width={240}
      height={108}
      className="w-full h-14 block border border-[#0E0D0C]"
      aria-hidden="true"
    />
  );
};

export const Play: React.FC = () => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<BullRunEngine | null>(null);
  const startUiRef = useRef<HTMLDivElement | null>(null);
  const startBullWrapRef = useRef<HTMLDivElement | null>(null);
  const startBullImgRef = useRef<HTMLImageElement | null>(null);
  const locationSectionRef = useRef<HTMLElement | null>(null);
  const transitionRafRef = useRef<number | null>(null);
  const shareCardRef = useRef<BuiltShareCard | null>(null);
  const iosSheetUrlRef = useRef<string | null>(null);

  // Multi-touch pointer IDs so DODGE thumb and JUMP thumb never cancel each other
  const stagePointerRef = useRef<{ id: number; startY: number; swipedDown: boolean } | null>(null);
  const jumpButtonPointerIdRef = useRef<number | null>(null);
  const dodgeButtonPointerIdRef = useRef<number | null>(null);
  const [jumpPressed, setJumpPressed] = useState(false);
  const [dodgePressed, setDodgePressed] = useState(false);

  const initialVp = readUsableViewport();
  const [usableHeight, setUsableHeight] = useState<number>(initialVp.height);
  const lastAppliedHeightRef = useRef<number>(initialVp.height);
  const lastAppliedWidthRef = useRef<number>(initialVp.width);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hud, setHud] = useState<GameHudSnapshot>(() => {
    const initialBest = typeof window !== 'undefined' ? loadBestScore() : 0;
    return {
      ...INITIAL_HUD,
      bestScore: initialBest,
      locationId: typeof window !== 'undefined' ? loadSelectedLocation(initialBest) : 'wallStreet',
      dailyDate: getUtcDateString(),
    };
  });

  // Herd Pass & Code Sheet state
  const [herdPass, setHerdPass] = useState<HerdPassState | null>(() =>
    typeof window !== 'undefined' ? loadHerdPass() : null
  );
  const [weeklyBeaten, setWeeklyBeaten] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isWeeklyChallengeBeaten(WEEKLY_CHALLENGE.week) : false
  );
  const [codeSheetOpen, setCodeSheetOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState(false);
  const [codeLockSeconds, setCodeLockSeconds] = useState(0);
  const [codeSubmitting, setCodeSubmitting] = useState(false);

  // Share Card & iOS save sheet state
  const [shareCardReady, setShareCardReady] = useState(false);
  const [shareCardError, setShareCardError] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [iosSheetUrl, setIosSheetUrl] = useState<string | null>(null);

  // ?debug=anim live tuning panel state
  const [isDebugAnim] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('debug') === 'anim'
      : false
  );
  const [debugOpen, setDebugOpen] = useState(true);
  const [animTune, setAnimTune] = useState<AnimTuneSettings>(() =>
    typeof window !== 'undefined'
      ? loadAnimTune()
      : {
          saddleX: 0,
          saddleY: 0,
          scaleMult: 1,
          poses: {
            up: { x: 0, y: 0 },
            duck: { x: 0, y: 0 },
            hit: { x: 0, y: 0 },
            charge: { x: 0, y: 0 },
          },
          springK: 90,
          springC: 12,
          showSaddlePoints: false,
          showHitbox: false,
        }
  );
  const [selectedDebugPose, setSelectedDebugPose] = useState<RiderPoseKey>('up');
  const [debugCopied, setDebugCopied] = useState(false);

  const updateAnimTune = useCallback(
    (updater: (prev: AnimTuneSettings) => AnimTuneSettings) => {
      setAnimTune((prev) => {
        const next = updater(prev);
        saveAnimTune(next);
        engineRef.current?.setAnimTune(next);
        return next;
      });
    },
    []
  );

  const handleResetAnimTune = useCallback(() => {
    const next = resetAnimTune();
    setAnimTune(next);
    engineRef.current?.setAnimTune(next);
  }, []);

  const handleCopyAnimTune = useCallback(async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(JSON.stringify(animTune, null, 2));
        setDebugCopied(true);
        window.setTimeout(() => setDebugCopied(false), 1500);
      }
    } catch {
      // Clipboard unavailable
    }
  }, [animTune]);

  const activeTier: HerdTier | null = herdPass?.tier ?? null;
  const seasonOpen = isSeasonActive();
  const hasValidBuyUrl =
    typeof BUY_URL === 'string' && BUY_URL.trim().startsWith('https://');
  const hasTelegramUrl =
    typeof TELEGRAM_URL === 'string' && TELEGRAM_URL.trim().startsWith('https://');
  const hasXUrl = typeof X_URL === 'string' && X_URL.trim().startsWith('https://');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
      engineRef.current?.setReducedMotion(e.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mqReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const engine = new BullRunEngine(canvas, (snap) => setHud(snap), Boolean(mqReduced));
    engineRef.current = engine;

    let rafResize = 0;
    const syncViewport = () => {
      const { width: nextW, height: nextH } = readUsableViewport();
      const phaseNow = engine.getPhase();
      const isActiveRun = phaseNow === 'PLAYING' || phaseNow === 'DYING';
      const heightDelta = Math.abs(nextH - lastAppliedHeightRef.current);
      const widthChanged = Math.abs(nextW - lastAppliedWidthRef.current) >= 2;

      if (isActiveRun && !widthChanged && heightDelta < 60) {
        return;
      }

      lastAppliedWidthRef.current = nextW;
      lastAppliedHeightRef.current = nextH;
      setUsableHeight(nextH);

      if (rafResize) cancelAnimationFrame(rafResize);
      rafResize = requestAnimationFrame(() => {
        engine.resize(false);
      });
    };

    const vv = window.visualViewport;
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    if (vv) {
      vv.addEventListener('resize', syncViewport);
    }

    syncViewport();

    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      if (vv) {
        vv.removeEventListener('resize', syncViewport);
      }
      if (rafResize) cancelAnimationFrame(rafResize);
      if (transitionRafRef.current !== null) {
        cancelAnimationFrame(transitionRafRef.current);
        transitionRafRef.current = null;
      }
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      engineRef.current?.resize(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [usableHeight, hud.phase]);

  const runBeatWeeklyTarget = hud.score >= WEEKLY_CHALLENGE.target;
  useEffect(() => {
    if (runBeatWeeklyTarget) {
      setWeeklyBeaten((prev) => (prev ? prev : true));
    } else if (hud.phase === 'START' || hud.phase === 'GAME_OVER') {
      const beaten = isWeeklyChallengeBeaten(WEEKLY_CHALLENGE.week);
      setWeeklyBeaten((prev) => (prev === beaten ? prev : beaten));
    }
  }, [hud.phase, runBeatWeeklyTarget]);

  // Reset pressed visual flags when leaving PLAYING
  useEffect(() => {
    if (hud.phase !== 'PLAYING') {
      jumpButtonPointerIdRef.current = null;
      dodgeButtonPointerIdRef.current = null;
      stagePointerRef.current = null;
      setJumpPressed((prev) => (prev ? false : prev));
      setDodgePressed((prev) => (prev ? false : prev));
    }
  }, [hud.phase]);

  const isGameOver = hud.phase === 'GAME_OVER';

  // Reset share card state only when leaving GAME_OVER
  useEffect(() => {
    if (isGameOver) return;
    shareCardRef.current = null;
    setShareCardReady((prev) => (prev ? false : prev));
    setShareCardError((prev) => (prev ? false : prev));
    setShareStatus((prev) => (prev !== null ? null : prev));
    if (iosSheetUrlRef.current) {
      URL.revokeObjectURL(iosSheetUrlRef.current);
      iosSheetUrlRef.current = null;
    }
    setIosSheetUrl((prev) => (prev !== null ? null : prev));
  }, [isGameOver]);

  // Pre-build 1080x1350 PNG Share Card when GAME_OVER starts
  useEffect(() => {
    if (!isGameOver) return;

    let cancelled = false;
    setShareCardReady(false);
    setShareCardError(false);
    setShareStatus(null);

    const locEntry = PLAY_COPY.locations.find((l) => l.id === hud.locationId);

    void buildShareCard({
      score: hud.score,
      seed: hud.runSeed,
      startMinute: hud.runStartMinute,
      tier: activeTier,
      endedByCatch: hud.endedByCatch,
      locationName: locEntry?.name,
      isDailyRun: hud.isDailyRun,
      dailyDate: hud.dailyDate,
    })
      .then((built) => {
        if (cancelled) return;
        if (built) {
          shareCardRef.current = built;
          setShareCardReady(true);
        } else {
          setShareCardError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setShareCardError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isGameOver,
    hud.score,
    hud.runSeed,
    hud.runStartMinute,
    hud.endedByCatch,
    hud.locationId,
    hud.isDailyRun,
    hud.dailyDate,
    activeTier,
  ]);

  useEffect(() => {
    return () => {
      if (iosSheetUrlRef.current) {
        URL.revokeObjectURL(iosSheetUrlRef.current);
        iosSheetUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!codeSheetOpen || codeLockSeconds <= 0) return;
    const timer = window.setInterval(() => {
      const rem = getCodeLockoutRemainingSeconds();
      setCodeLockSeconds(rem);
      if (rem <= 0) setCodeError(null);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [codeSheetOpen, codeLockSeconds]);

  const cancelStartTransition = useCallback(() => {
    if (transitionRafRef.current !== null) {
      cancelAnimationFrame(transitionRafRef.current);
      transitionRafRef.current = null;
    }
  }, []);

  const resetStartOverlayTransforms = useCallback(() => {
    if (startUiRef.current) {
      startUiRef.current.style.opacity = '';
      startUiRef.current.style.transform = '';
    }
    if (startBullWrapRef.current) {
      startBullWrapRef.current.style.opacity = '';
      startBullWrapRef.current.style.transform = '';
      startBullWrapRef.current.style.transformOrigin = '';
    }
  }, []);

  // Auto-pause on blur / hidden
  useEffect(() => {
    const handlePauseSignal = () => {
      const engine = engineRef.current;
      if (!engine) return;
      const p = engine.getPhase();
      if (p === 'STARTING') {
        cancelStartTransition();
        resetStartOverlayTransforms();
        engine.returnToStart();
      } else if (p === 'PLAYING' || p === 'DYING') {
        engine.pause();
      }
    };

    const onVisibility = () => {
      if (document.hidden) handlePauseSignal();
    };
    window.addEventListener('blur', handlePauseSignal);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', handlePauseSignal);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [cancelStartTransition, resetStartOverlayTransforms]);

  const handleBack = useCallback(() => {
    cancelStartTransition();
    engineRef.current?.dispose();
    if (typeof window === 'undefined') return;
    try {
      if (document.referrer) {
        const refOrigin = new URL(document.referrer).origin;
        if (refOrigin === window.location.origin) {
          window.history.back();
          return;
        }
      }
    } catch {
      // Fallback to "/"
    }
    window.location.href = '/';
  }, [cancelStartTransition]);

  const handleStart = useCallback(() => {
    if (codeSheetOpen) return;
    const engine = engineRef.current;
    if (!engine || engine.getPhase() !== 'START') return;

    playGameSound('ui');

    if (rootRef.current) rootRef.current.scrollTop = 0;
    if (typeof window !== 'undefined') window.scrollTo(0, 0);

    const vp = readUsableViewport();
    lastAppliedWidthRef.current = vp.width;
    lastAppliedHeightRef.current = vp.height;
    setUsableHeight(vp.height);
    engine.resize(true);

    engine.beginStartingTransition();
    cancelStartTransition();

    if (prefersReducedMotion) {
      engine.startRun(true);
      return;
    }

    const imgEl = startBullImgRef.current;
    const wrapEl = startBullWrapRef.current;
    const uiEl = startUiRef.current;
    const canvasEl = canvasRef.current;
    const target = engine.getRunnerTargetRect();
    const box = engine.getPrimaryOpaqueBox();

    let fx = DEFAULT_OPAQUE_FRAC.x;
    let fy = DEFAULT_OPAQUE_FRAC.y;
    let fw = DEFAULT_OPAQUE_FRAC.w;
    let fh = DEFAULT_OPAQUE_FRAC.h;
    if (box && imgEl && imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0) {
      fx = box.x / imgEl.naturalWidth;
      fy = box.y / imgEl.naturalHeight;
      fw = box.w / imgEl.naturalWidth;
      fh = box.h / imgEl.naturalHeight;
    }

    let dx = 0;
    let dy = 0;
    let targetScale = 0.55;
    let originPctX = (fx + fw * 0.5) * 100;
    let originPctY = (fy + fh * 0.5) * 100;

    if (imgEl && wrapEl) {
      const imgRect = imgEl.getBoundingClientRect();
      const wrapRect = wrapEl.getBoundingClientRect();
      const canvasRect = canvasEl?.getBoundingClientRect();

      const opaqueLeft = imgRect.left + fx * imgRect.width;
      const opaqueTop = imgRect.top + fy * imgRect.height;
      const opaqueW = fw * imgRect.width;
      const opaqueH = fh * imgRect.height;

      const startCx = opaqueLeft + opaqueW * 0.5;
      const startCy = opaqueTop + opaqueH * 0.5;
      const endCx = (canvasRect?.left ?? 0) + target.x + target.w * 0.5;
      const endCy = (canvasRect?.top ?? 0) + target.y + target.h * 0.5;

      dx = endCx - startCx;
      dy = endCy - startCy;
      targetScale = opaqueH > 0 ? target.h / opaqueH : 0.6;

      if (wrapRect.width > 0 && wrapRect.height > 0) {
        originPctX = ((startCx - wrapRect.left) / wrapRect.width) * 100;
        originPctY = ((startCy - wrapRect.top) / wrapRect.height) * 100;
      }
      wrapEl.style.transformOrigin = `${originPctX.toFixed(2)}% ${originPctY.toFixed(2)}%`;
    }

    const slideDurationMs = 760;
    const startMs = performance.now();

    const tickTransition = (now: number) => {
      const elapsed = now - startMs;
      const p = Math.min(1, elapsed / slideDurationMs);
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

      if (uiEl) {
        const uiFade = Math.min(1, p * 2.8);
        uiEl.style.opacity = String(1 - uiFade);
        uiEl.style.transform = `translate3d(0, ${(uiFade * 12).toFixed(2)}px, 0)`;
      }

      if (wrapEl) {
        const s = 1 + (targetScale - 1) * eased;
        wrapEl.style.transform = `translate3d(${(dx * eased).toFixed(2)}px, ${(dy * eased).toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
      }

      engine.setTransitionReveal(eased);

      if (p < 1) {
        transitionRafRef.current = requestAnimationFrame(tickTransition);
      } else {
        transitionRafRef.current = null;
        resetStartOverlayTransforms();
        engine.startRun(false);
      }
    };

    transitionRafRef.current = requestAnimationFrame(tickTransition);
  }, [cancelStartTransition, codeSheetOpen, prefersReducedMotion, resetStartOverlayTransforms]);

  const handleRunAgain = useCallback(() => {
    cancelStartTransition();
    resetStartOverlayTransforms();
    playGameSound('ui');
    engineRef.current?.startRun(true);
  }, [cancelStartTransition, resetStartOverlayTransforms]);

  const handleChangeLocation = useCallback(() => {
    cancelStartTransition();
    resetStartOverlayTransforms();
    playGameSound('ui');
    engineRef.current?.returnToStart();
    requestAnimationFrame(() => {
      locationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [cancelStartTransition, resetStartOverlayTransforms]);

  // Keyboard support across Start, Playing, Paused, Game Over, Sheets
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (iosSheetUrl) {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (iosSheetUrlRef.current) {
            URL.revokeObjectURL(iosSheetUrlRef.current);
            iosSheetUrlRef.current = null;
          }
          setIosSheetUrl(null);
        }
        return;
      }

      if (codeSheetOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setCodeSheetOpen(false);
        }
        return;
      }

      const engine = engineRef.current;
      if (!engine) return;
      const phase = engine.getPhase();

      // Pause/Resume (P or Escape)
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (phase === 'PLAYING' || phase === 'DYING') {
          e.preventDefault();
          engine.pause();
          return;
        }
        if (phase === 'PAUSED') {
          e.preventDefault();
          engine.resume();
          return;
        }
      }

      // Charge (Enter or E) during play
      if (phase === 'PLAYING' && (e.code === 'Enter' || e.code === 'KeyE')) {
        e.preventDefault();
        if (!e.repeat) engine.activateCharge();
        return;
      }

      // Jump (Space, W, ArrowUp)
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (phase === 'START' && e.code === 'Space') {
          const activeTag = document.activeElement?.tagName;
          if (activeTag === 'BUTTON' || activeTag === 'A' || activeTag === 'INPUT') return;
          e.preventDefault();
          handleStart();
          return;
        }
        if (phase === 'PAUSED' && e.code === 'Space') {
          e.preventDefault();
          engine.resume();
          return;
        }
        if (phase === 'GAME_OVER' && e.code === 'Space') {
          const activeTag = document.activeElement?.tagName;
          if (activeTag === 'BUTTON' || activeTag === 'A') return;
          e.preventDefault();
          handleRunAgain();
          return;
        }
        if (phase === 'PLAYING') {
          e.preventDefault();
          if (!e.repeat) {
            setJumpPressed(true);
            engine.pressJump();
          }
          return;
        }
      }

      if (phase === 'START' && e.code === 'Enter') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'BUTTON' || activeTag === 'A' || activeTag === 'INPUT') return;
        e.preventDefault();
        handleStart();
        return;
      }

      if (phase === 'GAME_OVER' && e.code === 'Enter') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'BUTTON' || activeTag === 'A') return;
        e.preventDefault();
        handleRunAgain();
        return;
      }

      // Duck (S, ArrowDown, Shift)
      if (
        phase === 'PLAYING' &&
        (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ShiftLeft' || e.code === 'ShiftRight')
      ) {
        e.preventDefault();
        setDodgePressed(true);
        engine.setDuckHeld(true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        setJumpPressed(false);
        if (engine.getPhase() === 'PLAYING') {
          engine.releaseJump();
        }
      }
      if (
        e.code === 'ArrowDown' ||
        e.code === 'KeyS' ||
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight'
      ) {
        setDodgePressed(false);
        engine.setDuckHeld(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [codeSheetOpen, handleRunAgain, handleStart, iosSheetUrl]);

  // Playfield tap above the 32% control deck jumps + swipe down triggers 500ms duck
  const handlePlayfieldPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const targetEl = e.target as Element | null;
    if (targetEl?.closest('button, a, input, [role="dialog"], [data-control-deck="true"]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const engine = engineRef.current;
    if (!engine || engine.getPhase() !== 'PLAYING') return;

    // Ignore taps inside lower 32% deck area if clicked between deck buttons
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = (e.clientY - rect.top) / Math.max(1, rect.height);
    if (relY >= 0.68) return;

    stagePointerRef.current = {
      id: e.pointerId,
      startY: e.clientY,
      swipedDown: false,
    };
    engine.pressJump();
  };

  const handlePlayfieldPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = stagePointerRef.current;
    if (!st || st.id !== e.pointerId || st.swipedDown) return;
    if (e.clientY - st.startY > 34) {
      st.swipedDown = true;
      engineRef.current?.releaseJump();
      engineRef.current?.triggerSwipeDuck();
    }
  };

  const handlePlayfieldPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = stagePointerRef.current;
    if (st && st.id === e.pointerId) {
      stagePointerRef.current = null;
      engineRef.current?.releaseJump();
    }
  };

  // Dedicated JUMP button pointer handlers (multi-touch pointerId isolated)
  const handleJumpBtnDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic test events without active pointer
    }
    jumpButtonPointerIdRef.current = e.pointerId;
    setJumpPressed(true);
    engineRef.current?.pressJump();
  };

  const handleJumpBtnUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (jumpButtonPointerIdRef.current === null || jumpButtonPointerIdRef.current === e.pointerId) {
      jumpButtonPointerIdRef.current = null;
      setJumpPressed(false);
      engineRef.current?.releaseJump();
    }
  };

  // Dedicated DODGE button pointer handlers (multi-touch pointerId isolated)
  const handleDodgeBtnDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic test events without active pointer
    }
    dodgeButtonPointerIdRef.current = e.pointerId;
    setDodgePressed(true);
    engineRef.current?.setDuckHeld(true);
  };

  const handleDodgeBtnUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (dodgeButtonPointerIdRef.current === null || dodgeButtonPointerIdRef.current === e.pointerId) {
      dodgeButtonPointerIdRef.current = null;
      setDodgePressed(false);
      engineRef.current?.setDuckHeld(false);
    }
  };

  const openCodeSheet = () => {
    const rem = getCodeLockoutRemainingSeconds();
    setCodeLockSeconds(rem);
    setCodeError(null);
    setCodeSuccess(false);
    setCodeInput('');
    setCodeSheetOpen(true);
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (codeSubmitting) return;
    const remNow = getCodeLockoutRemainingSeconds();
    if (remNow > 0) {
      setCodeLockSeconds(remNow);
      return;
    }

    setCodeSubmitting(true);
    setCodeError(null);
    try {
      const res = await verifyAndUnlockHerdCode(codeInput);
      if (res.ok) {
        setHerdPass(res.pass);
        setCodeSuccess(true);
        engineRef.current?.refreshProgression();
        window.setTimeout(() => {
          setCodeSheetOpen(false);
          setCodeSuccess(false);
        }, 700);
      } else if (res.reason === 'ratelimit') {
        setCodeLockSeconds(res.retrySeconds ?? 30);
        setCodeError(null);
      } else if (res.reason === 'ended') {
        setCodeError(PLAY_COPY.herdPass.seasonEndedError);
      } else {
        setCodeError(PLAY_COPY.herdPass.invalidCode);
      }
    } finally {
      setCodeSubmitting(false);
    }
  };

  const openIosSaveSheet = (blob: Blob) => {
    if (iosSheetUrlRef.current) URL.revokeObjectURL(iosSheetUrlRef.current);
    const url = URL.createObjectURL(blob);
    iosSheetUrlRef.current = url;
    setIosSheetUrl(url);
  };

  const closeIosSaveSheet = () => {
    if (iosSheetUrlRef.current) {
      URL.revokeObjectURL(iosSheetUrlRef.current);
      iosSheetUrlRef.current = null;
    }
    setIosSheetUrl(null);
  };

  const handleShareCardClick = async () => {
    const built = shareCardRef.current;
    if (!built) {
      setShareStatus(PLAY_COPY.shareCard.cardErrorStatus);
      return;
    }

    const ios = isIosSafariDevice();
    const android = isAndroidDevice();
    const canShareFile =
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function' &&
      navigator.canShare({ files: [built.file] });

    if ((ios || android) && canShareFile) {
      try {
        await navigator.share({
          files: [built.file],
          title: PLAY_COPY.heading,
        });
        setShareStatus(PLAY_COPY.shareCard.cardSharedStatus);
        return;
      } catch (err) {
        const name = (err as { name?: string } | null)?.name;
        if (name === 'AbortError') return;
        if (ios) {
          openIosSaveSheet(built.blob);
          return;
        }
      }
    }

    if (ios) {
      openIosSaveSheet(built.blob);
      return;
    }

    triggerBlobDownload(built.blob, built.file.name);
    setShareStatus(PLAY_COPY.shareCard.cardSavedStatus);
  };

  const phase = hud.phase;
  const bestRankLabel = getRankLabel(hud.bestScore);
  const runRankLabel = getRankLabel(hud.score);
  const earnedFreeUnlocks = new Set(getFreeUnlocksForScore(hud.bestScore));
  const showStartLayer = phase === 'START' || phase === 'STARTING';
  const showActiveHud = phase === 'PLAYING' || phase === 'PAUSED' || phase === 'DYING';

  // Ring meter progress around bottom-center 64px CHARGE slot
  const ringFrac =
    hud.chargeTimer > 0
      ? Math.max(0, Math.min(1, hud.chargeTimer / 3.5))
      : Math.max(0, Math.min(1, hud.chargeCoins / 12));
  const ringCircumference = 2 * Math.PI * 28;
  const ringOffset = ringCircumference * (1 - ringFrac);

  const activeLocationObj =
    PLAY_COPY.locations.find((l) => l.id === hud.locationId) ?? PLAY_COPY.locations[0];
  const leagueLabel = activeTier ? PLAY_COPY.herdLeague : PLAY_COPY.openLeague;
  const runChallengeBeaten = hud.score >= WEEKLY_CHALLENGE.target;
  const xIntentText = PLAY_COPY.shareCard.xPostTemplate
    .replace('{score}', String(hud.score))
    .replace('{rank}', runRankLabel)
    .replace('{ticker}', TOKEN_TICKER);
  const xIntentHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xIntentText)}`;

  const fieldHeightPx = Math.min(usableHeight, 920);
  const isStart = phase === 'START';

  return (
    <div
      ref={rootRef}
      className={`play-page ${
        isStart ? 'play-root-start' : 'play-root-locked'
      } relative w-full bg-[#0E0D0C] text-[#E8DFC9] select-none`}
      style={
        isStart
          ? {
              height: usableHeight ? `${usableHeight}px` : undefined,
              touchAction: 'pan-y',
              overscrollBehaviorY: 'contain',
              WebkitOverflowScrolling: 'touch',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }
          : {
              height: usableHeight ? `${usableHeight}px` : undefined,
              touchAction: 'none',
              overscrollBehavior: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }
      }
    >
      {/* Full-viewport ink + halftone backdrop behind centered playfield */}
      <div className="fixed inset-0 bg-[#0E0D0C] pointer-events-none z-0" aria-hidden="true">
        <div className="halftone-overlay absolute inset-0 opacity-85" />
      </div>

      {/* Shared site film grain overlay */}
      <div className="comic-grain pointer-events-none z-20" />

      {/* Centered Playfield Container (width min(100vw, 520px), height min(usableHeight, 920px)) */}
      <div
        className="fixed inset-x-0 top-0 z-10 flex items-center justify-center pointer-events-none"
        style={{ height: usableHeight ? `${usableHeight}px` : '100svh' }}
      >
        <div
          className="relative overflow-hidden bg-[#0E0D0C] ring-0 min-[521px]:ring-2 min-[521px]:ring-[#C97B1A]/35 pointer-events-auto"
          style={{
            width: 'min(100vw, 520px)',
            height: `${fieldHeightPx}px`,
            maxHeight: '920px',
            touchAction: isStart ? 'pan-y' : 'none',
          }}
          onPointerDown={handlePlayfieldPointerDown}
          onPointerMove={handlePlayfieldPointerMove}
          onPointerUp={handlePlayfieldPointerUp}
          onPointerCancel={handlePlayfieldPointerUp}
        >
          {/* Canvas 2D Playfield */}
          <canvas
            ref={canvasRef}
            aria-label={PLAY_COPY.canvasAria}
            className="w-full h-full block"
            style={{ touchAction: 'none' }}
          />

          {/* Top 12% Playfield HUD */}
          {!isStart && (
            <header
              className="absolute top-0 left-0 right-0 z-40 flex items-start justify-between gap-2 pointer-events-none"
              style={{
                height: '12%',
                paddingTop: 'max(0.45rem, env(safe-area-inset-top, 0px))',
                paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
                paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
              }}
            >
              {showActiveHud ? (
                <div className="flex flex-col items-start min-w-0">
                  <div className="flex items-baseline gap-2.5 tabular-nums">
                    <div
                      className="font-anton text-[40px] leading-none tracking-wider text-[#E8DFC9]"
                      style={{ textShadow: '2px 2px 0 #0E0D0C' }}
                    >
                      {String(hud.score).padStart(4, '0')}
                    </div>
                    {/* Coins + Combo chip */}
                    <div
                      key={hud.counterBumpKey}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0E0D0C]/85 border border-[#C97B1A]/70 font-plex text-xs font-bold text-[#F2B24A]"
                    >
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full bg-[#F2B24A] border border-[#0E0D0C]"
                        aria-hidden="true"
                      />
                      <span>{hud.coinCount}</span>
                      {hud.comboLevel > 1 && (
                        <span className="ml-0.5 px-1 bg-[#C97B1A] text-[#0E0D0C] text-[10px]">
                          x{hud.comboLevel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 tabular-nums">
                    <span className="font-plex text-[10px] tracking-wider uppercase text-[#C97B1A]">
                      {PLAY_COPY.bestLabel} {hud.bestScore}
                    </span>

                    {hud.hasPickupShield && (
                      <span className="inline-flex items-center gap-0.5" title={PLAY_COPY.shieldPopup}>
                        <ShieldHudIcon />
                      </span>
                    )}

                    {hud.magnetTimer > 0 && (
                      <span className="inline-flex items-center gap-0.5" title={PLAY_COPY.magnetPopup}>
                        <MagnetHudIcon />
                      </span>
                    )}

                    {(hud.secondWindAvailable || hud.secondWindUsed) && (
                      <span
                        title={
                          hud.secondWindAvailable
                            ? PLAY_COPY.secondWindLabel
                            : PLAY_COPY.secondWindUsed
                        }
                      >
                        <ShieldHudIcon broken={hud.secondWindUsed} />
                      </span>
                    )}
                  </div>

                  {/* Pulsing Bear Paw below score ONLY when bearGap < 45 (no gap bar) */}
                  {hud.showBearPaw && (
                    <div
                      className={`mt-1 inline-flex items-center gap-1 ${
                        !prefersReducedMotion ? 'animate-pulse' : ''
                      }`}
                      aria-label={PLAY_COPY.bearLabel}
                    >
                      <BearPawIcon />
                      <span className="font-plex text-[10px] font-bold uppercase tracking-widest text-[#C23B22]">
                        {PLAY_COPY.bearLabel}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label={PLAY_COPY.backAria}
                  className="pointer-events-auto inline-flex items-center gap-1.5 min-h-[44px] h-10 px-3 rounded-full bg-[#0E0D0C] border-2 border-[#C97B1A] text-[#E8DFC9] font-plex text-xs font-semibold uppercase tracking-widest cursor-pointer"
                >
                  <span>{PLAY_COPY.backButton}</span>
                </button>
              )}

              {/* Right: Pause button (44px) during active play */}
              {showActiveHud && phase !== 'PAUSED' && (
                <button
                  type="button"
                  onClick={() => engineRef.current?.pause()}
                  aria-label={PLAY_COPY.pauseAria}
                  className="pointer-events-auto w-11 h-11 shrink-0 flex items-center justify-center bg-[#0E0D0C]/90 hover:bg-[#1E1B18] border-2 border-[#C97B1A] text-[#E8DFC9] shadow-[3px_3px_0_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
                >
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                    <rect x="3.5" y="3" width="3" height="10" />
                    <rect x="9.5" y="3" width="3" height="10" />
                  </svg>
                </button>
              )}
            </header>
          )}

          {/* Location Title Banner (first 1.6s of run) */}
          {phase === 'PLAYING' && hud.locationBannerTimer > 0 && (
            <div className="pointer-events-none absolute top-[14%] inset-x-0 z-30 flex flex-col items-center">
              <div className="px-3.5 py-1.5 bg-[#0E0D0C]/90 border-2 border-[#C97B1A] shadow-[3px_3px_0_#000] text-center">
                {hud.isDailyRun && (
                  <div className="font-plex text-[10px] font-bold uppercase tracking-widest text-[#F2B24A]">
                    {PLAY_COPY.dailyRunTag}
                  </div>
                )}
                <div className="font-anton text-xl tracking-wider uppercase text-[#E8DFC9] leading-tight">
                  {activeLocationObj.name}
                </div>
              </div>
            </div>
          )}

          {/* First-Run Jump Hint near runner */}
          {phase === 'PLAYING' && hud.showTapHint && (
            <div
              className="pointer-events-none absolute z-30 flex flex-col items-center"
              style={{
                left: `${hud.runnerAnchor.x + hud.runnerAnchor.w * 0.5}px`,
                top: `${Math.max(68, hud.runnerAnchor.y - 46)}px`,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="relative flex items-center justify-center w-12 h-12">
                {!prefersReducedMotion && (
                  <span className="play-tap-ring absolute inset-0 rounded-full border-2 border-[#C97B1A]" />
                )}
                <span className="font-anton text-sm tracking-widest uppercase text-[#E8DFC9] bg-[#0E0D0C]/90 border-2 border-[#C97B1A] px-2 py-0.5">
                  {PLAY_COPY.firstJumpHint}
                </span>
              </div>
            </div>
          )}

          {/* Center "GO" scale cue */}
          {phase === 'PLAYING' && hud.showGoBadge && (
            <div
              aria-live="polite"
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
            >
              <span className="play-go-pop font-anton text-6xl sm:text-7xl tracking-wider uppercase text-[#E8DFC9] drop-shadow-[4px_4px_0_#C97B1A]">
                {PLAY_COPY.goText}
              </span>
            </div>
          )}

          {/* Bottom 32% Control Deck (Below 68% ground line) */}
          {(phase === 'PLAYING' || phase === 'PAUSED') && (
            <div
              data-control-deck="true"
              className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between px-4 sm:px-6"
              style={{
                height: '32%',
                paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
                touchAction: 'none',
              }}
            >
              {/* Left: 84px DODGE hold button */}
              <button
                type="button"
                aria-label={PLAY_COPY.dodgeAria}
                onPointerDown={handleDodgeBtnDown}
                onPointerUp={handleDodgeBtnUp}
                onPointerCancel={handleDodgeBtnUp}
                className={`w-[84px] h-[84px] rounded-full flex flex-col items-center justify-center gap-0.5 border-3 border-[#0E0D0C] shadow-[4px_4px_0_#000] font-anton text-base tracking-wider uppercase cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] transition-transform duration-75 ${
                  dodgePressed
                    ? 'bg-[#F2B24A] text-[#0E0D0C] translate-x-[2px] translate-y-[2px] shadow-[2px_2px_0_#000]'
                    : 'bg-[#171513]/95 text-[#E8DFC9] ring-2 ring-[#C97B1A]'
                }`}
                style={{ touchAction: 'none' }}
              >
                <svg
                  viewBox="0 0 20 20"
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 4v11" />
                  <path d="M5.5 10.5L10 15.5l4.5-5" />
                </svg>
                <span className="leading-none">{PLAY_COPY.dodgeLabel}</span>
              </button>

              {/* Bottom Center: 64px CHARGE meter ring + button (button appears only when full) */}
              <div className="relative w-[68px] h-[68px] flex items-center justify-center">
                <svg
                  viewBox="0 0 64 64"
                  className="w-full h-full -rotate-90 pointer-events-none"
                  aria-hidden="true"
                >
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="rgba(14, 13, 12, 0.72)"
                    stroke="rgba(201, 123, 26, 0.35)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    stroke={hud.chargeTimer > 0 ? '#E8DFC9' : '#F2B24A'}
                    strokeWidth="4"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="butt"
                  />
                </svg>

                {hud.chargeReady ? (
                  <button
                    type="button"
                    aria-label={PLAY_COPY.chargeAria}
                    onClick={() => engineRef.current?.activateCharge()}
                    className={`absolute inset-1 rounded-full bg-[#F2B24A] hover:bg-[#E8DFC9] text-[#0E0D0C] border-2 border-[#0E0D0C] shadow-[3px_3px_0_#000] font-anton text-xs tracking-wider uppercase flex items-center justify-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#E8DFC9] ${
                      !prefersReducedMotion ? 'play-cta-pulse' : ''
                    }`}
                    style={{ touchAction: 'none' }}
                  >
                    {PLAY_COPY.chargeButtonLabel}
                  </button>
                ) : (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center font-plex text-[10px] font-bold text-[#E8DFC9]/65 tabular-nums pointer-events-none"
                  >
                    {hud.chargeTimer > 0
                      ? PLAY_COPY.chargeButtonLabel
                      : `${hud.chargeCoins}/12`}
                  </span>
                )}
              </div>

              {/* Right: 96px JUMP hold button */}
              <button
                type="button"
                aria-label={PLAY_COPY.jumpAria}
                onPointerDown={handleJumpBtnDown}
                onPointerUp={handleJumpBtnUp}
                onPointerCancel={handleJumpBtnUp}
                className={`w-[96px] h-[96px] rounded-full flex flex-col items-center justify-center gap-0.5 border-3 border-[#0E0D0C] shadow-[4px_4px_0_#000] font-anton text-lg tracking-wider uppercase cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] transition-transform duration-75 ${
                  jumpPressed
                    ? 'bg-[#F2B24A] text-[#0E0D0C] translate-x-[2px] translate-y-[2px] shadow-[2px_2px_0_#000]'
                    : 'bg-[#C97B1A] text-[#0E0D0C]'
                }`}
                style={{ touchAction: 'none' }}
              >
                <svg
                  viewBox="0 0 20 20"
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 16V5" />
                  <path d="M5.5 9.5L10 4.5l4.5 5" />
                </svg>
                <span className="leading-none">{PLAY_COPY.jumpLabel}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* START SCREEN (Scrollable from top, TAP TO PLAY above the fold on 390x664) */}
      {showStartLayer && (
        <>
          <div
            className="fixed top-0 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex items-center justify-start"
            style={{
              width: 'min(100vw, 520px)',
              paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
              paddingLeft: 'max(0.85rem, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(0.85rem, env(safe-area-inset-right, 0px))',
            }}
          >
            <button
              type="button"
              onClick={handleBack}
              aria-label={PLAY_COPY.backAria}
              className="pointer-events-auto inline-flex items-center gap-1.5 min-h-[44px] h-11 px-3.5 sm:px-4 rounded-full bg-[#0E0D0C] border-2 border-[#C97B1A] text-[#E8DFC9] hover:bg-[#C97B1A] hover:text-[#0E0D0C] shadow-[3px_3px_0_rgba(201,123,26,0.45)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_rgba(201,123,26,0.45)] font-plex text-xs sm:text-sm font-semibold uppercase tracking-widest transition-colors duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] shrink-0 whitespace-nowrap"
            >
              <svg
                viewBox="0 0 16 16"
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12.5 8H3.5" />
                <path d="M7.5 4L3.5 8L7.5 12" />
              </svg>
              <span>{PLAY_COPY.backButton}</span>
            </button>
          </div>

          <main
            className="relative z-30 mx-auto flex flex-col items-center text-center px-4"
            style={{
              width: 'min(100vw, 520px)',
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 120px)',
            }}
          >
            {/* Bull Art */}
            <div
              ref={startBullWrapRef}
              className={`relative flex flex-col items-center justify-center mb-1.5 ${
                phase === 'START' && !prefersReducedMotion ? 'play-bull-bob' : ''
              }`}
            >
              <img
                ref={startBullImgRef}
                src="/assets/aistudio/IMG_6489_e00edd76.png"
                alt={PLAY_COPY.bullAlt}
                width={1536}
                height={1024}
                className="relative z-10 h-[27svh] max-h-[220px] w-auto object-contain select-none pointer-events-none"
              />
              {phase === 'START' && (
                <div aria-hidden="true" className="w-[54%] h-3 -mt-2 rounded-full bg-black/75" />
              )}
            </div>

            <div ref={startUiRef} className="flex flex-col items-center w-full max-w-[390px]">
              <h1 className="font-anton text-5xl sm:text-6xl text-[#E8DFC9] uppercase tracking-wider leading-none mb-1">
                {PLAY_COPY.heading}
              </h1>

              <p className="font-plex text-sm sm:text-base font-semibold text-[#C97B1A] tracking-wide mb-2.5">
                {PLAY_COPY.subtitle}
              </p>

              <button
                type="button"
                onClick={handleStart}
                disabled={phase === 'STARTING'}
                className={`w-full max-w-[320px] h-[54px] bg-[#C97B1A] hover:bg-[#F2B24A] text-[#0E0D0C] border-2 border-[#0E0D0C] shadow-[4px_4px_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#000] font-anton text-2xl sm:text-3xl tracking-wider uppercase cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0D0C] transition-colors duration-150 mb-2.5 ${
                  phase === 'START' && !prefersReducedMotion ? 'play-cta-pulse' : ''
                }`}
              >
                {PLAY_COPY.tapToPlay}
              </button>

              {/* DAILY RUN Toggle above the how-to line */}
              <button
                type="button"
                role="switch"
                aria-checked={hud.isDailyRun}
                onClick={() => engineRef.current?.setDailyRun(!hud.isDailyRun)}
                className={`w-full max-w-[320px] min-h-[42px] px-3 py-1.5 mb-2.5 flex items-center justify-between gap-2 border-2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] ${
                  hud.isDailyRun
                    ? 'bg-[#C97B1A]/20 border-[#F2B24A] text-[#F2B24A]'
                    : 'bg-[#171513]/95 border-[#C97B1A]/45 text-[#E8DFC9]'
                }`}
              >
                <div className="flex flex-col items-start text-left leading-tight">
                  <span className="font-plex text-xs font-bold uppercase tracking-widest">
                    {PLAY_COPY.dailyRunLabel}
                  </span>
                  <span className="font-plex text-[10px] text-[#E8DFC9]/65">
                    {PLAY_COPY.dailyRunDesc}
                  </span>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 border font-plex text-[10px] font-bold uppercase tracking-widest ${
                    hud.isDailyRun
                      ? 'bg-[#F2B24A] text-[#0E0D0C] border-[#0E0D0C]'
                      : 'bg-[#0E0D0C] text-[#E8DFC9]/60 border-[#C97B1A]/40'
                  }`}
                >
                  {hud.isDailyRun ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Controls legend */}
              <div className="flex items-center justify-center gap-3 font-plex text-[11px] font-bold uppercase tracking-wider text-[#F2B24A] mb-1">
                <span>{PLAY_COPY.jumpLegend}</span>
                <span className="text-[#E8DFC9]/35" aria-hidden="true">|</span>
                <span>{PLAY_COPY.dodgeLegend}</span>
              </div>

              <p className="font-plex text-xs text-[#E8DFC9]/80 mb-2.5">{PLAY_COPY.howTo}</p>

              {/* Best & Rank */}
              <div className="flex items-center justify-center gap-2.5 font-plex text-xs tracking-wider uppercase mb-1.5 tabular-nums">
                <span className="text-[#E8DFC9]/80 font-semibold">
                  {PLAY_COPY.bestLabel} {hud.bestScore}
                </span>
                <span className="px-2 py-0.5 bg-[#171513] border border-[#C97B1A]/60 text-[#C97B1A] font-semibold">
                  {PLAY_COPY.rankLabel}: {bestRankLabel}
                </span>
              </div>

              {hasXUrl && (
                <a
                  href={X_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={PLAY_COPY.xAria}
                  className="inline-flex items-center justify-center min-h-[44px] px-4 mb-3 font-plex text-xs text-[#E8DFC9]/75 hover:text-[#F2B24A] underline underline-offset-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
                >
                  {PLAY_COPY.followLine}
                </a>
              )}

              {/* Locations Picker with Mini Preview Canvases */}
              <section
                ref={locationSectionRef}
                aria-label={PLAY_COPY.locationsHeading}
                className="w-full bg-[#171513]/95 border-2 border-[#C97B1A]/60 p-3.5 mb-3.5 text-left"
              >
                <div className="font-plex text-[11px] font-bold tracking-widest uppercase text-[#C97B1A] mb-2">
                  {PLAY_COPY.locationsHeading}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {PLAY_COPY.locations.map((loc) => {
                    const locId = loc.id as LocationId;
                    const unlocked = isLocationUnlocked(locId, hud.bestScore);
                    const selected = hud.locationId === locId;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => engineRef.current?.setLocation(locId)}
                        className={`flex flex-col items-start p-2 border-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] ${
                          selected
                            ? 'bg-[#0E0D0C] border-[#F2B24A]'
                            : unlocked
                            ? 'bg-[#0E0D0C]/70 border-[#C97B1A]/40 hover:border-[#C97B1A] cursor-pointer'
                            : 'bg-[#0E0D0C]/40 border-[#E8DFC9]/15 opacity-70 cursor-not-allowed'
                        }`}
                      >
                        <LocationPreviewCardCanvas locId={locId} />
                        <div className="w-full flex items-center justify-between gap-1 mt-1.5">
                          <span className="font-plex text-[11px] font-bold uppercase tracking-wider text-[#E8DFC9] leading-tight">
                            {loc.name}
                          </span>
                          <LockIcon unlocked={unlocked} />
                        </div>
                        <span className="font-plex text-[10px] text-[#E8DFC9]/65 leading-snug mt-0.5">
                          {unlocked
                            ? loc.note
                            : PLAY_COPY.locationLocked.replace('{score}', String(loc.unlockScore))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Weekly Challenge Panel */}
              <section
                aria-label={PLAY_COPY.weeklyHeading}
                className="w-full bg-[#171513]/95 border-2 border-[#C97B1A]/60 p-3.5 mb-3.5 text-left"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-plex text-[11px] font-bold tracking-widest uppercase text-[#C97B1A]">
                    {PLAY_COPY.weeklyHeading}
                  </span>
                  <span className="font-plex text-[11px] tracking-wider uppercase text-[#E8DFC9]/60 tabular-nums">
                    {WEEKLY_CHALLENGE.week}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-plex text-xs sm:text-sm text-[#E8DFC9] font-medium">
                    {WEEKLY_CHALLENGE.text}
                  </p>
                  {weeklyBeaten && (
                    <span className="shrink-0 px-2 py-0.5 bg-[#C23B22] text-[#E8DFC9] font-plex text-[10px] font-bold uppercase tracking-wider">
                      {PLAY_COPY.challengeBeaten}
                    </span>
                  )}
                </div>
              </section>

              {/* Free Score Unlocks Panel */}
              <section
                aria-label={PLAY_COPY.unlocksHeading}
                className="w-full bg-[#171513]/95 border border-[#C97B1A]/40 p-3.5 mb-3.5 text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-plex text-[11px] font-bold tracking-widest uppercase text-[#E8DFC9]/85">
                    {PLAY_COPY.unlocksHeading}
                  </span>
                  <span className="font-plex text-[11px] tracking-wider uppercase text-[#C97B1A] tabular-nums">
                    {earnedFreeUnlocks.size} / {PLAY_COPY.freeUnlocks.length}
                  </span>
                </div>
                <ul className="grid grid-cols-1 gap-1.5">
                  {PLAY_COPY.freeUnlocks.map((item) => {
                    const unlocked = earnedFreeUnlocks.has(item.id as FreeUnlockId);
                    return (
                      <li key={item.id} className="flex items-center justify-between gap-2 font-plex text-xs">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <LockIcon unlocked={unlocked} />
                          <span className={unlocked ? 'text-[#E8DFC9] font-medium' : 'text-[#E8DFC9]/55'}>
                            {item.label}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 tabular-nums text-[11px] uppercase tracking-wider ${
                            unlocked ? 'text-[#F2B24A] font-semibold' : 'text-[#E8DFC9]/45'
                          }`}
                        >
                          {item.minScore}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Herd Pass Panel */}
              <section
                aria-label={PLAY_COPY.herdPass.heading}
                className="w-full bg-[#171513]/95 border-2 border-[#C97B1A] shadow-[4px_4px_0_#000] p-3.5 mb-3 text-left"
              >
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-anton text-lg tracking-wider uppercase text-[#F2B24A] leading-none">
                      {PLAY_COPY.herdPass.heading}
                    </span>
                    <span className="font-plex text-[11px] uppercase tracking-wider text-[#E8DFC9]/65">
                      {SEASON.name}
                    </span>
                  </div>
                  {seasonOpen ? (
                    <button
                      type="button"
                      onClick={openCodeSheet}
                      className="min-h-[36px] px-2.5 py-1 bg-[#0E0D0C] hover:bg-[#C97B1A] hover:text-[#0E0D0C] border border-[#C97B1A] text-[#F2B24A] font-plex text-[11px] font-semibold uppercase tracking-wider cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
                    >
                      {PLAY_COPY.herdPass.haveCodeButton}
                    </button>
                  ) : (
                    <span className="font-plex text-[11px] uppercase tracking-wider text-[#C23B22]">
                      {PLAY_COPY.herdPass.expiredNote}
                    </span>
                  )}
                </div>

                <ul className="flex flex-col gap-2">
                  {PLAY_COPY.herdPass.tiers.map((tier) => {
                    const tierId = tier.id as HerdTier;
                    const unlocked = hasTierPrivilege(activeTier, tierId);
                    return (
                      <li
                        key={tier.id}
                        className={`flex items-start justify-between gap-2 p-2 border ${
                          unlocked
                            ? 'bg-[#0E0D0C] border-[#F2B24A]'
                            : 'bg-[#0E0D0C]/55 border-[#C97B1A]/30'
                        }`}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="pt-0.5">
                            <LockIcon unlocked={unlocked} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-plex text-xs font-bold tracking-widest uppercase text-[#E8DFC9]">
                              {tier.name}
                            </div>
                            <div className="font-plex text-[11px] text-[#E8DFC9]/70 leading-snug">
                              {tier.preview}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 font-plex text-[10px] font-bold uppercase tracking-widest pt-0.5 ${
                            unlocked ? 'text-[#F2B24A]' : 'text-[#E8DFC9]/45'
                          }`}
                        >
                          {unlocked ? PLAY_COPY.herdPass.unlocked : PLAY_COPY.herdPass.locked}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <div className="w-full px-1 text-center font-plex text-[11px] text-[#E8DFC9]/70 leading-relaxed">
                <p>
                  {PLAY_COPY.herdPass.telegramNotePrefix}{' '}
                  {hasTelegramUrl && (
                    <a
                      href={TELEGRAM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#F2B24A] underline underline-offset-4 hover:text-[#E8DFC9]"
                    >
                      {PLAY_COPY.herdPass.telegramLinkText}
                    </a>
                  )}
                </p>
                <p className="mt-0.5 text-[#E8DFC9]/55">{PLAY_COPY.herdPass.noWalletNote}</p>
              </div>
            </div>
          </main>
        </>
      )}

      {/* HERD CODE ENTRY SHEET */}
      {codeSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={PLAY_COPY.herdPass.sheetTitle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCodeSheetOpen(false);
          }}
          className="fixed inset-0 z-50 bg-[#0E0D0C]/85 flex items-center justify-center px-5"
          style={{ height: usableHeight ? `${usableHeight}px` : '100svh' }}
        >
          <div className="w-full max-w-[340px] bg-[#171513] border-2 border-[#C97B1A] shadow-[6px_6px_0_#000] p-5 text-left">
            <h2 className="font-anton text-3xl text-[#E8DFC9] uppercase tracking-wider leading-none mb-3">
              {PLAY_COPY.herdPass.sheetTitle}
            </h2>

            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-3">
              <label className="sr-only" htmlFor="herd-pass-code-input">
                {PLAY_COPY.herdPass.codeInputLabel}
              </label>
              <input
                id="herd-pass-code-input"
                type="text"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder={PLAY_COPY.herdPass.codePlaceholder}
                disabled={codeLockSeconds > 0 || codeSubmitting}
                className="w-full h-11 px-3 bg-[#0E0D0C] border-2 border-[#C97B1A]/70 focus:border-[#F2B24A] text-[#E8DFC9] placeholder-[#E8DFC9]/35 font-plex text-sm outline-none select-text"
                style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
              />

              {codeLockSeconds > 0 && (
                <p className="font-plex text-xs text-[#C23B22]" role="status">
                  {PLAY_COPY.herdPass.rateLimited.replace('{seconds}', String(codeLockSeconds))}
                </p>
              )}

              {codeError && codeLockSeconds <= 0 && (
                <p className="font-plex text-xs text-[#C23B22]" role="status">
                  {codeError}
                </p>
              )}

              {codeSuccess && (
                <p className="font-plex text-xs text-[#2FD27A]" role="status">
                  {PLAY_COPY.herdPass.codeAccepted}
                </p>
              )}

              <div className="flex items-center gap-2 mt-1">
                <button
                  type="submit"
                  disabled={codeLockSeconds > 0 || codeSubmitting || !codeInput.trim()}
                  className="flex-1 min-h-[44px] bg-[#C97B1A] hover:bg-[#F2B24A] disabled:opacity-50 text-[#0E0D0C] border-2 border-[#0E0D0C] font-anton text-xl tracking-wider uppercase cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
                >
                  {PLAY_COPY.herdPass.submitCode}
                </button>
                <button
                  type="button"
                  onClick={() => setCodeSheetOpen(false)}
                  className="min-h-[44px] px-4 bg-[#0E0D0C] hover:bg-[#1E1B18] text-[#E8DFC9] border-2 border-[#C97B1A]/60 font-plex text-xs font-semibold uppercase tracking-widest cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
                >
                  {PLAY_COPY.herdPass.closeSheet}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAUSE OVERLAY (PAUSED, RESUME, QUIT) */}
      {phase === 'PAUSED' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={PLAY_COPY.pausedTitle}
          className="fixed inset-x-0 top-0 z-40 bg-[#0E0D0C]/80 flex items-center justify-center px-6 text-center"
          style={{ height: usableHeight ? `${usableHeight}px` : '100svh' }}
        >
          <div className="w-full max-w-[300px] bg-[#171513] border-2 border-[#C97B1A] shadow-[6px_6px_0_#000] p-5 flex flex-col gap-3">
            <h2 className="font-anton text-4xl text-[#E8DFC9] uppercase tracking-wider leading-none">
              {PLAY_COPY.pausedTitle}
            </h2>
            <button
              type="button"
              onClick={() => engineRef.current?.resume()}
              className="w-full min-h-[48px] bg-[#C97B1A] hover:bg-[#F2B24A] text-[#0E0D0C] border-2 border-[#0E0D0C] shadow-[4px_4px_0_#000] font-anton text-2xl tracking-wider uppercase cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
            >
              {PLAY_COPY.resumeButton}
            </button>
            <button
              type="button"
              onClick={() => engineRef.current?.returnToStart()}
              className="w-full min-h-[44px] bg-[#0E0D0C] hover:bg-[#1E1B18] text-[#E8DFC9] border-2 border-[#C97B1A]/70 font-plex text-xs font-bold uppercase tracking-widest cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
            >
              {PLAY_COPY.quitButton}
            </button>
          </div>
        </div>
      )}

      {/* GAME OVER PANEL */}
      {phase === 'GAME_OVER' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={PLAY_COPY.caughtTitle}
          className="fixed inset-x-0 top-0 z-40 bg-[#0E0D0C]/80 flex items-center justify-center px-4"
          style={{
            height: usableHeight ? `${usableHeight}px` : '100svh',
            paddingTop: 'max(16px, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div
            className="bg-[#171513] border-2 border-[#C97B1A] shadow-[6px_6px_0_#000] p-5 text-center flex flex-col items-center overflow-y-auto"
            style={{
              width: 'min(92vw, 420px)',
              maxHeight:
                'calc(100svh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
            }}
          >
            <div className="flex items-center justify-center gap-2 font-plex text-[10px] font-bold uppercase tracking-widest text-[#C97B1A] mb-1">
              <span>{leagueLabel}</span>
              {hud.isDailyRun && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#F2B24A]">
                    {PLAY_COPY.dailyRunTag} {hud.dailyDate}
                  </span>
                </>
              )}
            </div>

            <h2 className="font-anton text-5xl text-[#E8DFC9] uppercase tracking-wider leading-none mb-2.5">
              {PLAY_COPY.caughtTitle}
            </h2>

            {(hud.isNewBest || runChallengeBeaten) && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2.5">
                {hud.isNewBest && (
                  <span className="px-2.5 py-0.5 bg-[#C97B1A] text-[#0E0D0C] font-plex text-[11px] font-bold uppercase tracking-widest">
                    {PLAY_COPY.newBestBadge}
                  </span>
                )}
                {runChallengeBeaten && (
                  <span className="px-2.5 py-0.5 bg-[#C23B22] text-[#E8DFC9] font-plex text-[11px] font-bold uppercase tracking-widest">
                    {PLAY_COPY.challengeBeaten}
                  </span>
                )}
              </div>
            )}

            <div className="w-full flex items-center justify-around border-y border-[#C97B1A]/35 py-2 mb-2 tabular-nums">
              <div className="flex flex-col items-center">
                <span className="font-plex text-[11px] uppercase tracking-widest text-[#E8DFC9]/70">
                  {PLAY_COPY.scoreLabel}
                </span>
                <span className="font-anton text-3xl text-[#E8DFC9] tracking-wider">
                  {hud.score}
                </span>
              </div>
              <div className="w-px h-9 bg-[#C97B1A]/35" aria-hidden="true" />
              <div className="flex flex-col items-center">
                <span className="font-plex text-[11px] uppercase tracking-widest text-[#C97B1A]">
                  {PLAY_COPY.bestLabel}
                </span>
                <span className="font-anton text-3xl text-[#C97B1A] tracking-wider">
                  {hud.bestScore}
                </span>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="w-full grid grid-cols-2 gap-x-4 gap-y-1 px-2 py-2 mb-2 bg-[#0E0D0C]/55 border border-[#C97B1A]/25 font-plex text-[11px] tabular-nums">
              <div className="flex items-center justify-between text-[#E8DFC9]/80">
                <span>{PLAY_COPY.breakdownDistance}</span>
                <span className="font-bold text-[#E8DFC9]">{hud.breakdown.distance}</span>
              </div>
              <div className="flex items-center justify-between text-[#E8DFC9]/80">
                <span>{PLAY_COPY.breakdownCoins}</span>
                <span className="font-bold text-[#F2B24A]">{hud.breakdown.coinsCombo}</span>
              </div>
              <div className="flex items-center justify-between text-[#E8DFC9]/80">
                <span>{PLAY_COPY.breakdownClose}</span>
                <span className="font-bold text-[#E8DFC9]">{hud.breakdown.closeCalls}</span>
              </div>
              <div className="flex items-center justify-between text-[#E8DFC9]/80">
                <span>{PLAY_COPY.breakdownPerfect}</span>
                <span className="font-bold text-[#2FD27A]">{hud.breakdown.perfects}</span>
              </div>
            </div>

            <div className="font-plex text-xs uppercase tracking-wider text-[#E8DFC9]/85 mb-3">
              {PLAY_COPY.rankLabel}:{' '}
              <span className="text-[#F2B24A] font-semibold">{runRankLabel}</span>
            </div>

            <button
              type="button"
              onClick={handleRunAgain}
              className="w-full h-[50px] shrink-0 bg-[#C97B1A] hover:bg-[#F2B24A] text-[#0E0D0C] border-2 border-[#0E0D0C] shadow-[4px_4px_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#000] font-anton text-2xl tracking-wider uppercase cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] mb-2"
            >
              {PLAY_COPY.runAgainButton}
            </button>

            <button
              type="button"
              onClick={handleChangeLocation}
              className="w-full min-h-[42px] shrink-0 mb-2 bg-[#0E0D0C] hover:bg-[#1E1B18] text-[#F2B24A] border-2 border-[#C97B1A]/75 font-plex text-xs font-bold uppercase tracking-widest cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
            >
              {PLAY_COPY.changeLocationButton}
            </button>

            {/* Share Card & Post on X */}
            <div className="w-full grid grid-cols-2 gap-2 mb-2 shrink-0">
              <button
                type="button"
                onClick={handleShareCardClick}
                disabled={!shareCardReady}
                className="min-h-[44px] px-2 bg-[#0E0D0C] hover:bg-[#1E1B18] disabled:opacity-55 text-[#F2B24A] border-2 border-[#C97B1A] font-plex text-[11px] font-bold uppercase tracking-wider cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
              >
                {shareCardReady
                  ? PLAY_COPY.shareCard.shareButton
                  : PLAY_COPY.shareCard.preparingCard}
              </button>

              <a
                href={xIntentHref}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-2 inline-flex items-center justify-center bg-[#0E0D0C] hover:bg-[#1E1B18] text-[#E8DFC9] border-2 border-[#C97B1A]/75 font-plex text-[11px] font-bold uppercase tracking-wider outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
              >
                {PLAY_COPY.shareCard.postXButton}
              </a>
            </div>

            <p className="font-plex text-[10px] text-[#E8DFC9]/60 leading-snug mb-2">
              {PLAY_COPY.shareCard.xAttachNote}
            </p>

            {(shareStatus || shareCardError) && (
              <p className="font-plex text-[11px] text-[#F2B24A] mb-2" role="status">
                {shareCardError ? PLAY_COPY.shareCard.cardErrorStatus : shareStatus}
              </p>
            )}

            {hasValidBuyUrl && (
              <div className="w-full flex justify-center my-2 shrink-0">
                <BuyButton compact />
              </div>
            )}

            <button
              type="button"
              onClick={handleBack}
              className="w-full min-h-[44px] shrink-0 mt-1 bg-[#0E0D0C] hover:bg-[#1E1B18] text-[#E8DFC9] border-2 border-[#C97B1A]/70 font-plex text-xs font-semibold uppercase tracking-widest cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
            >
              {PLAY_COPY.backButton}
            </button>
          </div>
        </div>
      )}

      {/* iOS FULL-SCREEN LONG-PRESS SAVE SHEET FALLBACK */}
      {iosSheetUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={PLAY_COPY.shareCard.iosSheetInstruction}
          className="fixed inset-0 z-50 bg-[#0E0D0C]/95 flex flex-col items-center justify-center p-5 gap-4"
          style={{ height: usableHeight ? `${usableHeight}px` : '100svh' }}
        >
          <p className="font-plex text-sm text-[#E8DFC9] text-center max-w-xs">
            {PLAY_COPY.shareCard.iosSheetInstruction}
          </p>
          <img
            src={iosSheetUrl}
            alt={PLAY_COPY.shareCard.iosSheetAlt}
            className="max-w-full max-h-[72vh] object-contain border-2 border-[#C97B1A]"
            style={{ WebkitTouchCallout: 'default', WebkitUserSelect: 'auto' }}
          />
          <button
            type="button"
            onClick={closeIosSaveSheet}
            className="min-h-[44px] px-6 bg-[#C97B1A] hover:bg-[#F2B24A] text-[#0E0D0C] border-2 border-[#0E0D0C] font-plex text-xs font-bold uppercase tracking-widest cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
          >
            {PLAY_COPY.shareCard.iosSheetClose}
          </button>
        </div>
      )}

      {/* ?debug=anim Collapsible Tuning Panel */}
      {isDebugAnim && (
        <aside
          aria-label={PLAY_COPY.debugAnim.toggleLabel}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="fixed bottom-3 right-3 z-50 w-[min(92vw,310px)] bg-[#171513]/95 border-2 border-[#C97B1A] shadow-[4px_4px_0_#000] text-[#E8DFC9] font-plex text-xs select-none"
          style={{ touchAction: 'pan-y' }}
        >
          <div className="flex items-center justify-between gap-2 px-3 border-b border-[#C97B1A]/35">
            <span className="font-anton text-sm tracking-wider uppercase text-[#F2B24A]">
              {PLAY_COPY.debugAnim.toggleLabel}
            </span>
            <button
              type="button"
              onClick={() => setDebugOpen((v) => !v)}
              className="min-h-[44px] px-2.5 flex items-center justify-center font-plex text-[11px] font-bold uppercase tracking-wider text-[#E8DFC9] hover:text-[#F2B24A] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
            >
              {debugOpen ? PLAY_COPY.debugAnim.collapseLabel : PLAY_COPY.debugAnim.expandLabel}
            </button>
          </div>

          {debugOpen && (
            <div className="p-3 max-h-[60svh] overflow-y-auto flex flex-col gap-2">
              {/* Saddle X */}
              <label className="flex flex-col gap-1 min-h-[44px] justify-center">
                <div className="flex justify-between tabular-nums text-[11px]">
                  <span>{PLAY_COPY.debugAnim.saddleX}</span>
                  <span className="text-[#F2B24A]">{animTune.saddleX.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={0.5}
                  value={animTune.saddleX}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateAnimTune((p) => ({ ...p, saddleX: val }));
                  }}
                  className="w-full accent-[#C97B1A] h-6 cursor-pointer"
                />
              </label>

              {/* Saddle Y */}
              <label className="flex flex-col gap-1 min-h-[44px] justify-center">
                <div className="flex justify-between tabular-nums text-[11px]">
                  <span>{PLAY_COPY.debugAnim.saddleY}</span>
                  <span className="text-[#F2B24A]">{animTune.saddleY.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={0.5}
                  value={animTune.saddleY}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateAnimTune((p) => ({ ...p, saddleY: val }));
                  }}
                  className="w-full accent-[#C97B1A] h-6 cursor-pointer"
                />
              </label>

              {/* Scale Multiplier */}
              <label className="flex flex-col gap-1 min-h-[44px] justify-center">
                <div className="flex justify-between tabular-nums text-[11px]">
                  <span>{PLAY_COPY.debugAnim.scaleMult}</span>
                  <span className="text-[#F2B24A]">{animTune.scaleMult.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={1.4}
                  step={0.02}
                  value={animTune.scaleMult}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateAnimTune((p) => ({ ...p, scaleMult: val }));
                  }}
                  className="w-full accent-[#C97B1A] h-6 cursor-pointer"
                />
              </label>

              {/* Pose Offset Selector + X/Y */}
              <div className="border-t border-[#C97B1A]/25 pt-2 flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-wider text-[#C97B1A] font-bold">
                  {PLAY_COPY.debugAnim.poseHeading}
                </span>
                <div className="grid grid-cols-4 gap-1">
                  {(['up', 'duck', 'hit', 'charge'] as RiderPoseKey[]).map((poseKey) => (
                    <button
                      key={poseKey}
                      type="button"
                      onClick={() => setSelectedDebugPose(poseKey)}
                      className={`min-h-[44px] px-1 border text-[11px] font-bold uppercase tracking-wider cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] ${
                        selectedDebugPose === poseKey
                          ? 'bg-[#C97B1A] text-[#0E0D0C] border-[#0E0D0C]'
                          : 'bg-[#0E0D0C] text-[#E8DFC9]/75 border-[#C97B1A]/40'
                      }`}
                    >
                      {poseKey}
                    </button>
                  ))}
                </div>

                <label className="flex flex-col gap-1 min-h-[44px] justify-center">
                  <div className="flex justify-between tabular-nums text-[11px]">
                    <span>
                      {PLAY_COPY.debugAnim.poseX} ({selectedDebugPose})
                    </span>
                    <span className="text-[#F2B24A]">
                      {animTune.poses[selectedDebugPose].x.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    step={0.5}
                    value={animTune.poses[selectedDebugPose].x}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateAnimTune((p) => ({
                        ...p,
                        poses: {
                          ...p.poses,
                          [selectedDebugPose]: {
                            ...p.poses[selectedDebugPose],
                            x: val,
                          },
                        },
                      }));
                    }}
                    className="w-full accent-[#C97B1A] h-6 cursor-pointer"
                  />
                </label>

                <label className="flex flex-col gap-1 min-h-[44px] justify-center">
                  <div className="flex justify-between tabular-nums text-[11px]">
                    <span>
                      {PLAY_COPY.debugAnim.poseY} ({selectedDebugPose})
                    </span>
                    <span className="text-[#F2B24A]">
                      {animTune.poses[selectedDebugPose].y.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    step={0.5}
                    value={animTune.poses[selectedDebugPose].y}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateAnimTune((p) => ({
                        ...p,
                        poses: {
                          ...p.poses,
                          [selectedDebugPose]: {
                            ...p.poses[selectedDebugPose],
                            y: val,
                          },
                        },
                      }));
                    }}
                    className="w-full accent-[#C97B1A] h-6 cursor-pointer"
                  />
                </label>
              </div>

              {/* Spring K / C */}
              <div className="border-t border-[#C97B1A]/25 pt-2 flex flex-col gap-1">
                <label className="flex flex-col gap-1 min-h-[44px] justify-center">
                  <div className="flex justify-between tabular-nums text-[11px]">
                    <span>{PLAY_COPY.debugAnim.springK}</span>
                    <span className="text-[#F2B24A]">{animTune.springK}</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={250}
                    step={5}
                    value={animTune.springK}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateAnimTune((p) => ({ ...p, springK: val }));
                    }}
                    className="w-full accent-[#C97B1A] h-6 cursor-pointer"
                  />
                </label>

                <label className="flex flex-col gap-1 min-h-[44px] justify-center">
                  <div className="flex justify-between tabular-nums text-[11px]">
                    <span>{PLAY_COPY.debugAnim.springC}</span>
                    <span className="text-[#F2B24A]">{animTune.springC}</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={40}
                    step={1}
                    value={animTune.springC}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateAnimTune((p) => ({ ...p, springC: val }));
                    }}
                    className="w-full accent-[#C97B1A] h-6 cursor-pointer"
                  />
                </label>
              </div>

              {/* Debug Overlays */}
              <div className="border-t border-[#C97B1A]/25 pt-1 flex flex-col">
                <label className="flex items-center justify-between gap-2 min-h-[44px] cursor-pointer">
                  <span>{PLAY_COPY.debugAnim.showSaddle}</span>
                  <input
                    type="checkbox"
                    checked={animTune.showSaddlePoints}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateAnimTune((p) => ({ ...p, showSaddlePoints: checked }));
                    }}
                    className="w-5 h-5 accent-[#C97B1A] cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 min-h-[44px] cursor-pointer">
                  <span>{PLAY_COPY.debugAnim.showHitbox}</span>
                  <input
                    type="checkbox"
                    checked={animTune.showHitbox}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateAnimTune((p) => ({ ...p, showHitbox: checked }));
                    }}
                    className="w-5 h-5 accent-[#C97B1A] cursor-pointer"
                  />
                </label>
              </div>

              {/* Copy Settings & Reset */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyAnimTune}
                  className="min-h-[44px] px-2 bg-[#C97B1A] hover:bg-[#F2B24A] text-[#0E0D0C] border border-[#0E0D0C] font-plex text-[11px] font-bold uppercase tracking-wider cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
                >
                  {debugCopied ? PLAY_COPY.debugAnim.copiedButton : PLAY_COPY.debugAnim.copyButton}
                </button>
                <button
                  type="button"
                  onClick={handleResetAnimTune}
                  className="min-h-[44px] px-2 bg-[#0E0D0C] hover:bg-[#1E1B18] text-[#E8DFC9] border border-[#C97B1A]/60 font-plex text-[11px] font-bold uppercase tracking-wider cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
                >
                  {PLAY_COPY.debugAnim.resetButton}
                </button>
              </div>
            </div>
          )}
        </aside>
      )}

      <style>{`
        .play-root-start {
          min-height: 100vh;
          min-height: 100svh;
          height: 100vh;
          height: 100svh;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
        }
        .play-root-locked {
          height: 100vh;
          height: 100svh;
          overflow: hidden;
        }
        @keyframes playBullBob {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-4px); }
        }
        .play-bull-bob {
          animation: playBullBob 3s ease-in-out infinite alternate;
        }
        @keyframes playCtaPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        .play-cta-pulse {
          animation: playCtaPulse 1.6s ease-in-out infinite;
        }
        @keyframes playGoPop {
          0% { transform: scale(0.5); opacity: 0; }
          35% { transform: scale(1.12); opacity: 1; }
          75% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0; }
        }
        .play-go-pop {
          animation: playGoPop 240ms ease-out forwards;
        }
        @keyframes playTapRing {
          0% { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        .play-tap-ring {
          animation: playTapRing 1.1s ease-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .play-bull-bob,
          .play-cta-pulse,
          .play-go-pop,
          .play-tap-ring {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};
