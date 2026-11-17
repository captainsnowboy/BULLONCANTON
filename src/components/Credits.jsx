import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CREDITS_COPY } from '../copy.js';
import { CREDITS_AUDIO, CREDITS_MUSIC_VOLUME } from '../config.js';
import { DESKTOP_MEDIA_QUERY, isDesktopViewport } from '../utils/desktop';

const DEFAULT_SCROLL_SPEED_PX_PER_SEC = 60;
const MIN_SCROLL_SPEED_PX_PER_SEC = 40;
const MAX_SCROLL_SPEED_PX_PER_SEC = 90;
const FADE_IN_MS = 1200;
const FADE_OUT_MS = 1500;

// ---------------------------------------------------------------------------
// Module-level Credits Music Controller (zero download until ROLL CREDITS tap)
// ---------------------------------------------------------------------------
let activeAudio = null;
let fadeRafId = null;
let fadeGain = 0; // normalized 0..1 multiplied by CREDITS_MUSIC_VOLUME
let sessionMuted = false; // kept in memory for this visit only
let audioBroken = false;
let isFadingOutToStop = false;
const metadataSubscribers = new Set();

function stopFadeRaf() {
  if (fadeRafId !== null) {
    cancelAnimationFrame(fadeRafId);
    fadeRafId = null;
  }
}

function applyAudioVolume() {
  if (!activeAudio) return;
  activeAudio.muted = sessionMuted;
  const vol = sessionMuted
    ? 0
    : Math.min(1, Math.max(0, fadeGain * CREDITS_MUSIC_VOLUME));
  try {
    activeAudio.volume = vol;
  } catch {
    // Some mobile browsers (e.g. iOS Safari) treat HTMLAudioElement.volume as read-only
  }
}

function hardResetCreditsAudio() {
  stopFadeRaf();
  isFadingOutToStop = false;
  fadeGain = 0;
  if (activeAudio) {
    const prev = activeAudio;
    activeAudio = null;
    try {
      prev.pause();
    } catch {}
    try {
      prev.currentTime = 0;
    } catch {}
    try {
      prev.removeAttribute('src');
      prev.load();
    } catch {}
  }
  audioBroken = false;
}

function rampAudioGain(targetGain, durationMs, onComplete) {
  stopFadeRaf();
  if (!activeAudio || audioBroken) {
    fadeGain = targetGain;
    if (onComplete) onComplete();
    return;
  }
  const audioRef = activeAudio;
  const fromGain = fadeGain;
  if (durationMs <= 0 || Math.abs(targetGain - fromGain) < 0.001) {
    fadeGain = targetGain;
    applyAudioVolume();
    if (onComplete) onComplete();
    return;
  }

  const startTime = performance.now();
  const step = (now) => {
    fadeRafId = null;
    if (activeAudio !== audioRef || audioBroken) return;
    const t = Math.min(1, Math.max(0, (now - startTime) / durationMs));
    fadeGain = fromGain + (targetGain - fromGain) * t;
    applyAudioVolume();
    if (t < 1) {
      fadeRafId = requestAnimationFrame(step);
    } else {
      fadeGain = targetGain;
      applyAudioVolume();
      if (onComplete) onComplete();
    }
  };
  fadeRafId = requestAnimationFrame(step);
}

export function startCreditsMusic() {
  if (typeof window === 'undefined' || !CREDITS_AUDIO) return;
  hardResetCreditsAudio();

  try {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.loop = false;
    audio.muted = sessionMuted;
    try {
      audio.volume = 0;
    } catch {}
    audio.src = CREDITS_AUDIO;

    const notifyMetadata = () => {
      metadataSubscribers.forEach((cb) => {
        try {
          cb();
        } catch {}
      });
    };

    audio.addEventListener('loadedmetadata', notifyMetadata);
    audio.addEventListener('error', () => {
      if (activeAudio !== audio) return;
      audioBroken = true;
      stopFadeRaf();
      notifyMetadata();
    });
    audio.addEventListener('ended', () => {
      if (activeAudio !== audio) return;
      stopFadeRaf();
    });

    activeAudio = audio;
    audioBroken = false;
    isFadingOutToStop = false;
    fadeGain = 0;

    // Must be called synchronously inside the ROLL CREDITS click/tap gesture for iOS Safari
    const playResult = audio.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => {
        // Ignore playback errors quietly; credits continue
      });
    }

    rampAudioGain(1, FADE_IN_MS);
  } catch {
    audioBroken = true;
  }
}

function pauseCreditsMusic() {
  stopFadeRaf();
  if (!activeAudio || audioBroken) return;
  try {
    if (!activeAudio.paused) {
      activeAudio.pause();
    }
  } catch {}
}

function resumeCreditsMusic() {
  if (!activeAudio || audioBroken || isFadingOutToStop || activeAudio.ended) return;
  applyAudioVolume();
  try {
    const playResult = activeAudio.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => {});
    }
  } catch {}
  if (fadeGain < 1) {
    rampAudioGain(1, Math.max(150, (1 - fadeGain) * FADE_IN_MS));
  }
}

function fadeOutAndStopCreditsMusic() {
  if (!activeAudio) return;
  if (isFadingOutToStop) return;
  if (
    audioBroken ||
    activeAudio.paused ||
    activeAudio.ended ||
    sessionMuted ||
    fadeGain <= 0.001
  ) {
    hardResetCreditsAudio();
    return;
  }
  isFadingOutToStop = true;
  rampAudioGain(0, FADE_OUT_MS, () => {
    hardResetCreditsAudio();
  });
}

function getCreditsAudioDuration() {
  if (!activeAudio || audioBroken) return null;
  const d = activeAudio.duration;
  return Number.isFinite(d) && d > 0 ? d : null;
}

function getCreditsAudioRemaining() {
  const d = getCreditsAudioDuration();
  if (d === null || !activeAudio) return null;
  const cur = activeAudio.currentTime;
  return Number.isFinite(cur) ? Math.max(0, d - cur) : null;
}

function isCreditsAudioPlaying() {
  return Boolean(
    activeAudio &&
      !audioBroken &&
      !isFadingOutToStop &&
      !activeAudio.paused &&
      !activeAudio.ended
  );
}

// Deterministic static cream star dots on #050505 backdrop
const STARS = [
  { x: 7, y: 9, size: 2, opacity: 0.35 },
  { x: 16, y: 22, size: 1.5, opacity: 0.25 },
  { x: 24, y: 12, size: 2, opacity: 0.45 },
  { x: 35, y: 7, size: 1.5, opacity: 0.2 },
  { x: 46, y: 15, size: 2.5, opacity: 0.4 },
  { x: 58, y: 6, size: 1.5, opacity: 0.3 },
  { x: 71, y: 14, size: 2, opacity: 0.5 },
  { x: 83, y: 8, size: 1.5, opacity: 0.22 },
  { x: 92, y: 19, size: 2, opacity: 0.38 },
  { x: 11, y: 38, size: 2, opacity: 0.32 },
  { x: 29, y: 44, size: 1.5, opacity: 0.24 },
  { x: 67, y: 35, size: 2, opacity: 0.28 },
  { x: 88, y: 42, size: 2.5, opacity: 0.42 },
  { x: 14, y: 58, size: 1.5, opacity: 0.3 },
  { x: 42, y: 64, size: 2, opacity: 0.2 },
  { x: 78, y: 61, size: 1.5, opacity: 0.36 },
  { x: 94, y: 56, size: 2, opacity: 0.26 },
  { x: 6, y: 78, size: 2.5, opacity: 0.44 },
  { x: 21, y: 86, size: 1.5, opacity: 0.28 },
  { x: 39, y: 91, size: 2, opacity: 0.34 },
  { x: 62, y: 83, size: 1.5, opacity: 0.22 },
  { x: 75, y: 92, size: 2, opacity: 0.48 },
  { x: 89, y: 77, size: 1.5, opacity: 0.32 },
  { x: 51, y: 49, size: 1.5, opacity: 0.18 },
];

export const Credits = ({ isOpen, onClose }) => {
  const overlayRef = useRef(null);
  const viewportRef = useRef(null);
  const columnRef = useRef(null);
  const finalCardRef = useRef(null);
  const progressFillRef = useRef(null);
  const prevFocusRef = useRef(null);

  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => isDesktopViewport());
  const [manualPlay, setManualPlay] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [flashState, setFlashState] = useState(null); // { key: number, kind: 'pause' | 'play' }
  const [isMusicMuted, setIsMusicMuted] = useState(() => sessionMuted);

  const isPausedRef = useRef(false);
  const hasEndedRef = useRef(false);
  const wasRunningBeforeHideRef = useRef(false);
  const yRef = useRef(0);
  const startYRef = useRef(0);
  const endYRef = useRef(0);
  const scrollSpeedRef = useRef(DEFAULT_SCROLL_SPEED_PX_PER_SEC);
  const rafRef = useRef(null);
  const flashTimerRef = useRef(null);
  const recomputeBoundsRef = useRef(() => {});
  const syncPauseLoopRef = useRef(() => {});

  // Track prefers-reduced-motion and desktop media query
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktopMq = window.matchMedia(DESKTOP_MEDIA_QUERY);
    setPrefersReducedMotion(mq.matches);
    setIsDesktop(desktopMq.matches);

    const onChange = (e) => setPrefersReducedMotion(e.matches);
    const onDesktopChange = (e) => setIsDesktop(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      desktopMq.addEventListener('change', onDesktopChange);
      return () => {
        mq.removeEventListener('change', onChange);
        desktopMq.removeEventListener('change', onDesktopChange);
      };
    }
    mq.addListener(onChange);
    desktopMq.addListener(onDesktopChange);
    return () => {
      mq.removeListener(onChange);
      desktopMq.removeListener(onDesktopChange);
    };
  }, []);

  // Lock page scrolling behind overlay (iOS-safe position: fixed body + scroll restore)
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    prevFocusRef.current = document.activeElement;

    const scrollY =
      window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyStyle = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };

    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    // Reset state on open
    isPausedRef.current = false;
    hasEndedRef.current = false;
    wasRunningBeforeHideRef.current = false;
    setManualPlay(false);
    setIsPaused(false);
    setHasEnded(false);
    setFlashState(null);
    setIsMusicMuted(sessionMuted);

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let fadeRaf = null;
    if (mq.matches) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
      fadeRaf = requestAnimationFrame(() => {
        fadeRaf = requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    }

    // Focus overlay for immediate Space / Escape handling
    const focusTimer = window.setTimeout(() => {
      overlayRef.current?.focus({ preventScroll: true });
    }, 20);

    return () => {
      if (fadeRaf !== null) cancelAnimationFrame(fadeRaf);
      window.clearTimeout(focusTimer);
      setIsVisible(false);
      fadeOutAndStopCreditsMusic();

      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.position = prevBodyStyle.position;
      document.body.style.top = prevBodyStyle.top;
      document.body.style.left = prevBodyStyle.left;
      document.body.style.right = prevBodyStyle.right;
      document.body.style.width = prevBodyStyle.width;
      document.body.style.overflow = prevBodyStyle.overflow;

      try {
        window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
      } catch {
        window.scrollTo(0, scrollY);
      }

      if (prevFocusRef.current && typeof prevFocusRef.current.focus === 'function') {
        try {
          prevFocusRef.current.focus({ preventScroll: true });
        } catch {
          prevFocusRef.current.focus();
        }
      }
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    fadeOutAndStopCreditsMusic();
    onClose();
  }, [onClose]);

  const toggleMusicMute = useCallback((e) => {
    e?.stopPropagation?.();
    sessionMuted = !sessionMuted;
    applyAudioVolume();
    setIsMusicMuted(sessionMuted);
  }, []);

  const triggerPauseFlash = useCallback((kind) => {
    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }
    setFlashState({ key: Date.now(), kind });
    flashTimerRef.current = window.setTimeout(() => {
      setFlashState(null);
      flashTimerRef.current = null;
    }, 600);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const isDesktopReducedManual = isDesktop && prefersReducedMotion && !manualPlay;
  const shouldAutoScroll = !prefersReducedMotion || (isDesktop && manualPlay);

  const togglePause = useCallback(
    (e) => {
      if (e?.target?.closest?.('button, a')) return;
      if (!shouldAutoScroll || hasEndedRef.current) return;
      const next = !isPausedRef.current;
      isPausedRef.current = next;
      setIsPaused(next);
      triggerPauseFlash(next ? 'pause' : 'play');
      if (next) {
        pauseCreditsMusic();
      } else {
        resumeCreditsMusic();
      }
      if (isDesktop) {
        syncPauseLoopRef.current();
      }
    },
    [isDesktop, shouldAutoScroll, triggerPauseFlash]
  );

  // Page visibility sync across desktop & mobile: pause when hidden, resume only if credits were running
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const wasRunning = shouldAutoScroll
          ? !isPausedRef.current && !hasEndedRef.current
          : isCreditsAudioPlaying();
        wasRunningBeforeHideRef.current = wasRunning;
        if (shouldAutoScroll && wasRunning) {
          isPausedRef.current = true;
          setIsPaused(true);
          syncPauseLoopRef.current();
        }
        pauseCreditsMusic();
      } else if (wasRunningBeforeHideRef.current) {
        wasRunningBeforeHideRef.current = false;
        if (shouldAutoScroll) {
          if (!hasEndedRef.current) {
            isPausedRef.current = false;
            setIsPaused(false);
            syncPauseLoopRef.current();
            resumeCreditsMusic();
          }
        } else {
          resumeCreditsMusic();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, shouldAutoScroll]);

  // Auto-scroll 60px/s loop via requestAnimationFrame (transform: translate3d)
  useEffect(() => {
    if (!isOpen) return;

    const viewport = viewportRef.current;
    const column = columnRef.current;
    const finalCard = finalCardRef.current;
    const progressEl = progressFillRef.current;
    if (!viewport || !column || !finalCard) return;

    const desktopMode = isDesktopViewport();

    if (!shouldAutoScroll) {
      column.style.transform = '';
      if (progressEl) progressEl.style.transform = 'scaleX(0)';
      recomputeBoundsRef.current = () => {};
      syncPauseLoopRef.current = () => {};
      return;
    }

    const applyVisualPosition = () => {
      column.style.transform = `translate3d(0, ${yRef.current.toFixed(2)}px, 0)`;
      if (progressEl) {
        const span = Math.max(1, startYRef.current - endYRef.current);
        const p = hasEndedRef.current
          ? 1
          : Math.min(1, Math.max(0, (startYRef.current - yRef.current) / span));
        progressEl.style.transform = `scaleX(${p.toFixed(4)})`;
      }
    };

    const computeBounds = () => {
      const vpH = viewport.clientHeight || window.innerHeight;
      const finalCenter = finalCard.offsetTop + finalCard.offsetHeight / 2;
      const nextEndY = Math.min(0, Math.round(vpH / 2 - finalCenter));
      const nextStartY = Math.round(vpH * 0.72);
      startYRef.current = nextStartY;
      endYRef.current = Math.min(nextStartY - 100, nextEndY);
    };

    const updateSyncedSpeed = () => {
      const duration = getCreditsAudioDuration();
      const contentHeight = Math.max(0, startYRef.current - endYRef.current);
      if (duration !== null && duration > 2.5 && contentHeight > 0) {
        const raw = contentHeight / (duration - 2);
        scrollSpeedRef.current = Math.min(
          MAX_SCROLL_SPEED_PX_PER_SEC,
          Math.max(MIN_SCROLL_SPEED_PX_PER_SEC, raw)
        );
      } else {
        scrollSpeedRef.current = DEFAULT_SCROLL_SPEED_PX_PER_SEC;
      }
    };

    const recomputePreservingProgress = () => {
      const prevSpan = Math.max(1, startYRef.current - endYRef.current);
      const ratio = Math.min(1, Math.max(0, (startYRef.current - yRef.current) / prevSpan));
      computeBounds();
      updateSyncedSpeed();
      const newSpan = Math.max(1, startYRef.current - endYRef.current);
      yRef.current = hasEndedRef.current
        ? endYRef.current
        : startYRef.current - ratio * newSpan;
      applyVisualPosition();
    };

    recomputeBoundsRef.current = recomputePreservingProgress;

    computeBounds();
    updateSyncedSpeed();
    yRef.current = startYRef.current;
    applyVisualPosition();

    metadataSubscribers.add(updateSyncedSpeed);

    // Desktop-only: wait for web fonts before trusting initial height measurements
    let fontsCancelled = false;
    if (desktopMode && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!fontsCancelled) {
          recomputePreservingProgress();
        }
      });
    }

    const handleResize = () => {
      recomputePreservingProgress();
    };

    window.addEventListener('resize', handleResize);
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        const vpH = viewport.clientHeight || window.innerHeight;
        const finalCenter = finalCard.offsetTop + finalCard.offsetHeight / 2;
        const updatedEndY = Math.min(0, Math.round(vpH / 2 - finalCenter));
        endYRef.current = Math.min(startYRef.current - 100, updatedEndY);
        updateSyncedSpeed();
        if (hasEndedRef.current) {
          yRef.current = endYRef.current;
          applyVisualPosition();
        }
      });
      ro.observe(column);
    }

    let lastTime = performance.now();

    const stopLoop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const tick = (now) => {
      rafRef.current = null;
      if (desktopMode && (document.hidden || isPausedRef.current || hasEndedRef.current)) {
        return;
      }

      const maxDt = desktopMode ? 0.05 : 0.1;
      const dt = Math.min(maxDt, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      if (!isPausedRef.current && !hasEndedRef.current) {
        yRef.current -= scrollSpeedRef.current * dt;
        if (yRef.current <= endYRef.current) {
          yRef.current = endYRef.current;
          hasEndedRef.current = true;
          setHasEnded(true);
          const rem = getCreditsAudioRemaining();
          if (rem !== null && rem > 2.5) {
            fadeOutAndStopCreditsMusic();
          }
        }
        applyVisualPosition();
      }

      if (!hasEndedRef.current) {
        if (!desktopMode || !isPausedRef.current) {
          rafRef.current = requestAnimationFrame(tick);
        }
      }
    };

    const startLoop = () => {
      if (hasEndedRef.current) return;
      if (desktopMode && (document.hidden || isPausedRef.current)) return;
      if (rafRef.current === null) {
        lastTime = performance.now();
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    syncPauseLoopRef.current = () => {
      if (isPausedRef.current || hasEndedRef.current || (desktopMode && document.hidden)) {
        stopLoop();
      } else {
        startLoop();
      }
    };

    const nudgePosition = (deltaY) => {
      if (endYRef.current >= startYRef.current) return;
      const nextY = Math.min(startYRef.current, Math.max(endYRef.current, yRef.current - deltaY));
      yRef.current = nextY;

      if (nextY <= endYRef.current) {
        yRef.current = endYRef.current;
        if (!hasEndedRef.current) {
          hasEndedRef.current = true;
          setHasEnded(true);
        }
        stopLoop();
      } else {
        if (hasEndedRef.current) {
          hasEndedRef.current = false;
          setHasEnded(false);
        }
        if (!isPausedRef.current && !document.hidden) {
          startLoop();
        }
      }
      applyVisualPosition();
    };

    const jumpToTop = () => {
      hasEndedRef.current = false;
      setHasEnded(false);
      isPausedRef.current = false;
      setIsPaused(false);
      yRef.current = startYRef.current;
      applyVisualPosition();
      startLoop();
    };

    const overlayEl = overlayRef.current;
    const handleWheel = (e) => {
      if (!desktopMode) return;
      e.preventDefault();
      let deltaPx = e.deltaY;
      if (e.deltaMode === 1) deltaPx *= 16;
      else if (e.deltaMode === 2) deltaPx *= viewport.clientHeight || window.innerHeight;
      nudgePosition(deltaPx);
    };

    const handleDesktopKeyDown = (e) => {
      if (!desktopMode) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        nudgePosition(64);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        nudgePosition(-64);
      } else if (e.key === 'Home') {
        e.preventDefault();
        e.stopPropagation();
        jumpToTop();
      }
    };

    if (desktopMode) {
      overlayEl?.addEventListener('wheel', handleWheel, { passive: false });
      window.addEventListener('keydown', handleDesktopKeyDown, true);
    }

    startLoop();

    return () => {
      fontsCancelled = true;
      metadataSubscribers.delete(updateSyncedSpeed);
      stopLoop();
      recomputeBoundsRef.current = () => {};
      syncPauseLoopRef.current = () => {};
      window.removeEventListener('resize', handleResize);
      if (desktopMode) {
        overlayEl?.removeEventListener('wheel', handleWheel);
        window.removeEventListener('keydown', handleDesktopKeyDown, true);
      }
      if (ro) ro.disconnect();
    };
  }, [isOpen, shouldAutoScroll]);

  // Desktop reduced-motion manual scroll: block wheel from leaking past modal bounds into page behind
  useEffect(() => {
    if (!isOpen || !isDesktopReducedManual) return;
    const overlayEl = overlayRef.current;
    const viewport = viewportRef.current;
    if (!overlayEl || !viewport) return;

    const onWheel = (e) => {
      let deltaPx = e.deltaY;
      if (e.deltaMode === 1) deltaPx *= 16;
      else if (e.deltaMode === 2) deltaPx *= viewport.clientHeight || window.innerHeight;
      const atTop = viewport.scrollTop <= 0 && deltaPx < 0;
      const atBottom =
        viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1 && deltaPx > 0;
      if (atTop || atBottom || !viewport.contains(e.target)) {
        e.preventDefault();
      }
    };

    overlayEl.addEventListener('wheel', onWheel, { passive: false });
    return () => overlayEl.removeEventListener('wheel', onWheel);
  }, [isOpen, isDesktopReducedManual]);

  // Keyboard shortcuts: Escape closes, Space pauses/resumes
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        const active = document.activeElement;
        const isButton = active && (active.tagName === 'BUTTON' || active.tagName === 'A');
        if (!isButton && shouldAutoScroll && !hasEndedRef.current) {
          e.preventDefault();
          e.stopPropagation();
          togglePause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleClose, shouldAutoScroll, togglePause]);

  // Manual scroll progress tracking for prefers-reduced-motion
  const handleManualScroll = useCallback(() => {
    if (shouldAutoScroll) return;
    const viewport = viewportRef.current;
    const progressEl = progressFillRef.current;
    if (!viewport || !progressEl) return;
    const maxScroll = Math.max(1, viewport.scrollHeight - viewport.clientHeight);
    const p = Math.min(1, Math.max(0, viewport.scrollTop / maxScroll));
    progressEl.style.transform = `scaleX(${p.toFixed(4)})`;
  }, [shouldAutoScroll]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={CREDITS_COPY.regionAria}
      tabIndex={-1}
      data-no-tapfx
      onClick={togglePause}
      className={`credits-overlay fixed inset-0 z-[900] bg-[#050505] text-[#E8DFC9] select-none outline-none transition-opacity duration-300 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        overscrollBehavior: 'contain',
      }}
    >
      {/* Static cream dots as stars */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
        {STARS.map((star, idx) => (
          <span
            key={idx}
            className="absolute rounded-full bg-[#E8DFC9]"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
            }}
          />
        ))}
      </div>

      {/* Desktop reduced-motion explicit Play button (starts translate3d auto-scroll without CSS motion) */}
      {isDesktopReducedManual && (
        <button
          type="button"
          data-no-tapfx
          aria-label={CREDITS_COPY.playAria}
          onClick={(e) => {
            e.stopPropagation();
            isPausedRef.current = false;
            hasEndedRef.current = false;
            setIsPaused(false);
            setHasEnded(false);
            setManualPlay(true);
          }}
          className="fixed top-4 left-4 sm:top-6 sm:left-6 z-30 min-h-[44px] min-w-[44px] px-4 py-2 inline-flex items-center gap-2 rounded-full bg-[#0E0D0C]/90 border-2 border-[#C97B1A] text-[#F2B24A] hover:bg-[#C97B1A] hover:text-black font-plex text-xs font-semibold uppercase tracking-wider cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] transition-colors"
        >
          <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0" fill="currentColor" aria-hidden="true">
            <polygon points="3,2 10,6 3,10" />
          </svg>
          <span>{CREDITS_COPY.playButton}</span>
        </button>
      )}

      {/* Top-right controls: Mute music + Close (both 44px minimum touch targets) */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-30 flex items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          data-no-tapfx
          aria-pressed={isMusicMuted}
          aria-label={CREDITS_COPY.muteAria}
          onClick={toggleMusicMute}
          className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full bg-[#0E0D0C]/90 border-2 border-[#C97B1A] text-[#E8DFC9] hover:border-[#F2B24A] hover:text-[#F2B24A] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
            {isMusicMuted ? (
              <>
                <line x1="22" y1="9" x2="16" y2="15" />
                <line x1="16" y1="9" x2="22" y2="15" />
              </>
            ) : (
              <>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </>
            )}
          </svg>
        </button>

        <button
          type="button"
          data-no-tapfx
          aria-label={CREDITS_COPY.closeAria}
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full bg-[#0E0D0C]/90 border-2 border-[#C97B1A] text-[#E8DFC9] hover:border-[#F2B24A] hover:text-[#F2B24A] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="square"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* Subtle paused badge when paused */}
      {isPaused && !hasEnded && shouldAutoScroll && (
        <div
          aria-hidden="true"
          className="fixed top-5 left-4 sm:top-7 sm:left-6 z-20 pointer-events-none font-plex text-[11px] uppercase tracking-widest text-[#C97B1A]/85"
        >
          {CREDITS_COPY.pausedStatus}
        </div>
      )}

      {/* Brief 600ms pause/play indicator flash on tap or Space */}
      {flashState && (
        <div
          key={flashState.key}
          aria-hidden="true"
          className="fixed inset-0 z-20 pointer-events-none flex items-center justify-center"
        >
          <div className="w-16 h-16 rounded-full bg-[#0E0D0C]/90 border-2 border-[#C97B1A] text-[#E8DFC9] flex items-center justify-center credits-pause-flash">
            {flashState.kind === 'pause' ? (
              <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" />
                <rect x="14" y="5" width="4" height="14" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                <polygon points="8,5 19,12 8,19" />
              </svg>
            )}
          </div>
        </div>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {isPaused ? CREDITS_COPY.pausedStatus : CREDITS_COPY.resumedStatus}
      </span>

      {/* Scrolling Credits Viewport */}
      <div
        ref={viewportRef}
        onScroll={handleManualScroll}
        className={`relative z-10 w-full h-full ${
          !shouldAutoScroll
            ? 'overflow-y-auto overscroll-contain'
            : 'overflow-hidden'
        }`}
        style={!shouldAutoScroll ? { WebkitOverflowScrolling: 'touch' } : undefined}
      >
        <div
          ref={columnRef}
          className={`w-full max-w-[480px] mx-auto px-5 sm:px-6 text-center will-change-transform ${
            !shouldAutoScroll ? 'py-20 sm:py-28' : 'pb-20'
          }`}
        >
          <div className="flex flex-col items-center space-y-24 sm:space-y-32">
            {/* 1. TITLE CARD */}
            <header className="flex flex-col items-center">
              <div className="w-24 h-24 sm:w-28 sm:h-28 mb-6 border-[3px] border-[#C97B1A] bg-[#0E0D0C] shadow-[4px_4px_0_#000] overflow-hidden">
                <img
                  src="/assets/bull-hero-final.webp"
                  alt={CREDITS_COPY.heroAlt}
                  width={112}
                  height={112}
                  loading={isDesktop ? 'eager' : 'lazy'}
                  onLoad={() => isDesktop && recomputeBoundsRef.current()}
                  className="w-full h-full object-cover object-top block"
                />
              </div>
              <h2 className="font-anton text-4xl sm:text-5xl text-[#E8DFC9] uppercase tracking-wider leading-none mb-4">
                {CREDITS_COPY.title}
              </h2>
              <p className="font-plex text-xs sm:text-sm text-[#C97B1A] uppercase tracking-[0.2em]">
                {CREDITS_COPY.subtitle}
              </p>
            </header>

            {/* 2. STARRING */}
            <section aria-label={CREDITS_COPY.starringHeading} className="w-full flex flex-col items-center">
              <h3 className="font-plex text-xs sm:text-sm text-[#C97B1A] uppercase tracking-[0.25em] mb-10">
                {CREDITS_COPY.starringHeading}
              </h3>
              <ul className="w-full space-y-8">
                {CREDITS_COPY.starring.map((item) => (
                  <li key={item.name} className="flex flex-col items-center gap-1.5">
                    <span className="font-anton text-2xl sm:text-3xl text-[#E8DFC9] uppercase tracking-wider leading-tight">
                      {item.name}
                    </span>
                    <span className="font-plex text-xs sm:text-sm text-[#C97B1A] tracking-wide">
                      {item.role}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 3. THE STORY */}
            <section aria-label={CREDITS_COPY.storyHeading} className="w-full flex flex-col items-center">
              <h3 className="font-plex text-xs sm:text-sm text-[#C97B1A] uppercase tracking-[0.25em] mb-10">
                {CREDITS_COPY.storyHeading}
              </h3>
              <div className="w-full space-y-12 sm:space-y-14">
                {CREDITS_COPY.storyLines.map((line, idx) => (
                  <p
                    key={idx}
                    className="font-anton text-2xl sm:text-3xl text-[#E8DFC9] tracking-wide leading-snug break-words"
                  >
                    {line}
                  </p>
                ))}
              </div>
            </section>

            {/* 4. CREW */}
            <section aria-label={CREDITS_COPY.crewHeading} className="w-full flex flex-col items-center">
              <h3 className="font-plex text-xs sm:text-sm text-[#C97B1A] uppercase tracking-[0.25em] mb-8">
                {CREDITS_COPY.crewHeading}
              </h3>
              <ul className="w-full space-y-4">
                {CREDITS_COPY.crew.map((line, idx) => (
                  <li
                    key={idx}
                    className="font-plex text-xs sm:text-sm text-[#E8DFC9] tracking-wider"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </section>

            {/* 5. SPECIAL THANKS */}
            <section aria-label={CREDITS_COPY.thanksHeading} className="w-full flex flex-col items-center">
              <h3 className="font-plex text-xs sm:text-sm text-[#C97B1A] uppercase tracking-[0.25em] mb-5">
                {CREDITS_COPY.thanksHeading}
              </h3>
              <p className="font-anton text-2xl sm:text-3xl text-[#E8DFC9] tracking-wide leading-snug">
                {CREDITS_COPY.thanksText}
              </p>
            </section>

            {/* 6. FILMED ON LOCATION */}
            <section aria-label={CREDITS_COPY.locationHeading} className="w-full flex flex-col items-center">
              <h3 className="font-plex text-xs sm:text-sm text-[#C97B1A] uppercase tracking-[0.25em] mb-5">
                {CREDITS_COPY.locationHeading}
              </h3>
              <p className="font-anton text-2xl sm:text-3xl text-[#E8DFC9] tracking-wide leading-snug">
                {CREDITS_COPY.locationText}
              </p>
            </section>

            {/* 7. SMALL PRINT & DISCLAIMER */}
            <section className="w-full flex flex-col items-center space-y-8">
              <p className="font-plex text-xs text-[#C97B1A] tracking-wide leading-relaxed">
                {CREDITS_COPY.smallPrint}
              </p>
              {CREDITS_COPY.musicCredit ? (
                <p className="font-plex text-[11px] sm:text-xs text-[#C97B1A]/90 tracking-wide">
                  {CREDITS_COPY.musicCredit}
                </p>
              ) : null}
              <p className="font-plex text-[11px] sm:text-xs text-[#E8DFC9]/65 leading-relaxed max-w-[400px]">
                {CREDITS_COPY.disclaimer}
              </p>
            </section>

            {/* 8. FINAL CARD */}
            <div
              ref={finalCardRef}
              className="w-full flex flex-col items-center pt-6 pb-8"
            >
              <div className="w-28 h-28 sm:w-32 sm:h-32 mb-6 border-[3px] border-[#C97B1A] bg-[#0E0D0C] shadow-[4px_4px_0_#000] overflow-hidden">
                <img
                  src="/assets/meme/faces/smug.webp"
                  alt={CREDITS_COPY.smugAlt}
                  width={128}
                  height={128}
                  loading={isDesktop ? 'eager' : 'lazy'}
                  onLoad={() => isDesktop && recomputeBoundsRef.current()}
                  className="w-full h-full object-contain object-bottom block"
                />
              </div>

              <h2 className="font-anton text-3xl sm:text-4xl text-[#E8DFC9] uppercase tracking-wider leading-tight mb-3">
                {CREDITS_COPY.finalTitle}
              </h2>
              <p className="font-plex text-xs sm:text-sm text-[#C97B1A] tracking-wide mb-8">
                {CREDITS_COPY.finalSubtitle}
              </p>

              <button
                type="button"
                data-no-tapfx
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                className="min-h-[44px] min-w-[44px] px-6 py-2.5 inline-flex items-center justify-center rounded-full font-plex text-xs font-semibold uppercase tracking-wider text-[#F2B24A] bg-[#0E0D0C] border-2 border-[#C97B1A] shadow-[3px_3px_0_rgba(201,123,26,0.45)] hover:bg-[#C97B1A] hover:text-black active:translate-x-[2px] active:translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] cursor-pointer transition-colors"
              >
                {CREDITS_COPY.backButton}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Thin progress line at the bottom */}
      <div
        aria-hidden="true"
        className="fixed bottom-0 left-0 right-0 z-30 h-[3px] bg-[#1E1B18] pointer-events-none"
      >
        <div
          ref={progressFillRef}
          className="w-full h-full bg-[#C97B1A] origin-left"
          style={{ transform: 'scaleX(0)', willChange: 'transform' }}
        />
      </div>

      <style>{`
        .credits-overlay {
          height: 100vh;
          height: 100lvh;
        }
        @keyframes creditsPauseFlash {
          0% { opacity: 0; transform: scale(0.86); }
          25% { opacity: 0.95; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.06); }
        }
        .credits-pause-flash {
          animation: creditsPauseFlash 600ms ease-out forwards;
        }
      `}</style>
    </div>
  );
};
