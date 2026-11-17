import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CHARGE_COPY, UI_COPY } from '../copy.js';
import { playImpactThud, playPaperFlick, playSample } from '../utils/audio';
import { isDesktopViewport } from '../utils/desktop';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

// =========================================================================
// 1. ENGINE CONSTANTS (Tunable as specified in prompt)
// =========================================================================
export const TORN_EDGE_ENTRANCE_OFFSET = -24; // px
export const TORN_EDGE_ENTRANCE_DURATION = 0.22; // 220ms
export const TORN_EDGE_SHAKE_PX = 4;
export const TORN_EDGE_THRESHOLD = 0.15; // 15% visible

export const HOLD_SECONDS = 5;
export const RAM_THRESHOLDS = [0.62, 0.78, 0.90];
export const BREACH = 1;
export const BRICK_CAP = 60;
export const CARD_ROTATIONS = [-1.8, 1.5, -1.0, 0.5];
export const CARD_Y_OFFSETS = [-12, -8, -4, 0];
export const CARD_Z_INDICES = [1, 2, 3, 10];
// Deterministic brick configuration: 11 rows of running bond (total 49 front bricks)
const FRONT_BRICK_COLORS = ['#B5472B', '#A23D25', '#BF5233'];
const FRONT_BRICK_ROWS = [
  // Even rows = 4 full bricks (107.5w each)
  // Odd rows = half brick (53.75w), 3 full bricks (107.5w), half brick (53.75w)
  { row: 0, bricks: [{ w: 107.5, x: 130 }, { w: 107.5, x: 237.5 }, { w: 107.5, x: 345 }, { w: 107.5, x: 452.5 }] },
  { row: 1, bricks: [{ w: 53.75, x: 130 }, { w: 107.5, x: 183.75 }, { w: 107.5, x: 291.25 }, { w: 107.5, x: 398.75 }, { w: 53.75, x: 506.25 }] },
  { row: 2, bricks: [{ w: 107.5, x: 130 }, { w: 107.5, x: 237.5 }, { w: 107.5, x: 345 }, { w: 107.5, x: 452.5 }] },
  { row: 3, bricks: [{ w: 53.75, x: 130 }, { w: 107.5, x: 183.75 }, { w: 107.5, x: 291.25 }, { w: 107.5, x: 398.75 }, { w: 53.75, x: 506.25 }] },
  { row: 4, bricks: [{ w: 107.5, x: 130 }, { w: 107.5, x: 237.5 }, { w: 107.5, x: 345 }, { w: 107.5, x: 452.5 }] },
  { row: 5, bricks: [{ w: 53.75, x: 130 }, { w: 107.5, x: 183.75 }, { w: 107.5, x: 291.25 }, { w: 107.5, x: 398.75 }, { w: 53.75, x: 506.25 }] },
  { row: 6, bricks: [{ w: 107.5, x: 130 }, { w: 107.5, x: 237.5 }, { w: 107.5, x: 345 }, { w: 107.5, x: 452.5 }] },
  { row: 7, bricks: [{ w: 53.75, x: 130 }, { w: 107.5, x: 183.75 }, { w: 107.5, x: 291.25 }, { w: 107.5, x: 398.75 }, { w: 53.75, x: 506.25 }] },
  { row: 8, bricks: [{ w: 107.5, x: 130 }, { w: 107.5, x: 237.5 }, { w: 107.5, x: 345 }, { w: 107.5, x: 452.5 }] },
  { row: 9, bricks: [{ w: 53.75, x: 130 }, { w: 107.5, x: 183.75 }, { w: 107.5, x: 291.25 }, { w: 107.5, x: 398.75 }, { w: 53.75, x: 506.25 }] },
  { row: 10, bricks: [{ w: 107.5, x: 130 }, { w: 107.5, x: 237.5 }, { w: 107.5, x: 345 }, { w: 107.5, x: 452.5 }] },
];

// Pre-flatten bricks list
const ROW_H = 560 / 11; // ~50.909
let bIndex = 0;
const ALL_FRONT_BRICKS = [];
FRONT_BRICK_ROWS.forEach((rObj) => {
  rObj.bricks.forEach((b) => {
    // 2px pseudo-random size jitter based on brick index
    const jitter = Math.sin(bIndex * 13) * 2;
    ALL_FRONT_BRICKS.push({
      id: bIndex,
      row: rObj.row,
      x: b.x + jitter * 0.4,
      y: 100 + rObj.row * ROW_H,
      w: b.w + jitter,
      h: ROW_H - 1,
      fill: FRONT_BRICK_COLORS[(bIndex * 7 + rObj.row * 3) % FRONT_BRICK_COLORS.length],
    });
    bIndex++;
  });
});

export const Charge = () => {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const rumbleRef = useRef(null);
  const groundStripRef = useRef(null);
  const wallSceneGroupRef = useRef(null);
  const isWallSceneRevealedRef = useRef(false);
  const tornEdgeRef = useRef(null);
  const hasTornEdgeDroppedRef = useRef(false);

  // Intro Newspaper elements
  const cardsContainerRef = useRef(null);
  const cardWrappersRef = useRef([]);
  const newsPagesRef = useRef([]);
  const stampsRef = useRef([]);
  const peekBullRef = useRef(null);
  const tossCountRef = useRef(0);
  const peekIdleTimeoutRef = useRef(null);

  // Stage ResizeObserver tracking (recomputes wall/bull proportions inside stage without rewriting section height)
  const lastObservedWRef = useRef(0);
  const lastObservedHRef = useRef(0);
  const roDebounceTimerRef = useRef(null);

  // Bull elements
  const bullContainerRef = useRef(null);
  const bullSpriteRef = useRef(null);
  const bullShadowRef = useRef(null);
  const speedLinesRef = useRef(null);
  const starburstRef = useRef(null);

  // Wall elements
  const wallGroupRef = useRef(null);
  const wallSvgRef = useRef(null);
  const sideSlabRef = useRef(null);
  const struckBrick1Ref = useRef(null);
  const struckBrick2Ref = useRef(null);
  const topCapRef = useRef(null);
  const frontBrickRefs = useRef([]);
  const cracksRef = useRef([null, null, null]);

  // Sign elements
  const signContainerRef = useRef(null);
  const postGroupRef = useRef(null);
  const signPlateGroupRef = useRef(null);
  const leftBoltRef = useRef(null);

  // Animation and Entrance refs
  const headlineElRef = useRef(null);
  const idleAnimRef = useRef(null);
  const currentIdleModeRef = useRef('none');
  const hasTriggeredWallDustRef = useRef(false);

  // Closing scene elements
  const bullAreaRef = useRef(null);
  const standingBullRef = useRef(null);
  const speechBubbleRef = useRef(null);
  const [signLayout, setSignLayout] = useState({ visible: false, width: 0, left: 0 });

  // Controls elements
  const progressBarFillRef = useRef(null);
  const buttonTextRef = useRef(null);
  const holdButtonRef = useRef(null);

  // Stage & element sizing state (recomputed on resize)
  const [stageSizes, setStageSizes] = useState({
    sw: 800,
    sh: 500,
    hw: 280,
    wallScale: 0.5,
    wallSvgLeft: 400,
    wallSvgTop: 100,
    wallOuterLeftPx: 420,
    groundY: 470,
    bullWidth: 200,
    bullHeight: 180,
    bullRestLeft: 180,
    bullTop: 290,
    contactPointRestX: 300,
    contactPointY: 380,
    postHeightPx: 70,
    postHeightViewBox: 140,
    signPlateW: 240,
    signPlateH: 82,
  });

  // Discrete UI states
  const [isBroken, setIsBroken] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [dustPuffs, setDustPuffs] = useState([]);
  const [displayedHeadline, setDisplayedHeadline] = useState(CHARGE_COPY.beat1.heading);
  const [headlineOpacity, setHeadlineOpacity] = useState(1);
  const [peekReady, setPeekReady] = useState(false);
  const [topIdx, setTopIdx] = useState(3);
  const [hasTossed, setHasTossed] = useState(false);

  // Debug panel state: strictly enabled ONLY when URL contains ?debug=charge
  const [isDebug, setIsDebug] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.location.search.includes('debug=charge');
  });
  const [showOutlines, setShowOutlines] = useState(false);
  const [isSlowMo, setIsSlowMo] = useState(false);

  useEffect(() => {
    const handleUrlChange = () => {
      setIsDebug(window.location.search.includes('debug=charge'));
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // -----------------------------------------------------------------------
  // 1. ENGINE REFS (NO React re-renders per frame)
  // -----------------------------------------------------------------------
  const targetRef = useRef(0);
  const shownRef = useRef(0);
  const damageLevelRef = useRef(0);
  const isAnimatingRamRef = useRef(false);
  const isHoldingRef = useRef(false);
  const activePointerIdRef = useRef(null);
  const holdStartTimeRef = useRef(0);
  const isBrokenRef = useRef(false);
  const lastThresholdReachedRef = useRef(0);
  const desktopStRef = useRef(null);
  const scrollDrivenRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const scrollLockCleanupRef = useRef(null);
  const scheduleTickRef = useRef(() => {});
  const introStartedRef = useRef(false);
  const headlineTargetRef = useRef(CHARGE_COPY.beat1.heading);
  const isSwappingHeadlineRef = useRef(false);

  reducedMotionRef.current = reducedMotion;

  // Opaque sprite measurement cache
  const opaqueBoundsRef = useRef({
    minX: 0,
    minY: 0,
    maxX: 1200,
    maxY: 1200,
    w: 1200,
    h: 1200,
    opaqueW: 1200,
    opaqueH: 1200,
    contactYRel: 0.45,
  });

  // Measure sprite's opaque bounding box once on load
  useEffect(() => {
    const img = new Image();
    img.src = '/assets/bull-charge.webp';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1200;
        canvas.height = img.naturalHeight || 1200;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
          let contactPixelY = 0;

          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              const alpha = data[(y * canvas.width + x) * 4 + 3];
              if (alpha > 20) {
                if (x < minX) minX = x;
                if (x > maxX) {
                  maxX = x;
                  contactPixelY = y;
                }
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          if (maxX > minX && maxY > minY) {
            opaqueBoundsRef.current = {
              minX,
              minY,
              maxX,
              maxY,
              w: canvas.width,
              h: canvas.height,
              opaqueW: maxX - minX,
              opaqueH: maxY - minY,
              contactYRel: (contactPixelY - minY) / (maxY - minY),
            };
          }
        }
      } catch (_) {
        // Safe fallback
      }
    };
  }, []);

  // Viewport detection & prefers-reduced-motion
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(motionQuery.matches);
    const handleMotion = (e) => setReducedMotion(e.matches);
    motionQuery.addEventListener('change', handleMotion);
    return () => motionQuery.removeEventListener('change', handleMotion);
  }, []);

  // Keep ticker height CSS var synced and refresh ScrollTrigger after real width/orientation changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastWidth = window.innerWidth;

    const updateTickerHeight = () => {
      const ticker = document.querySelector('[data-ticker]');
      const h = ticker ? ticker.getBoundingClientRect().height : 40;
      if (containerRef.current) {
        containerRef.current.style.setProperty('--ticker-h', `${h}px`);
      }
    };

    updateTickerHeight();

    const handleResize = () => {
      const curW = window.innerWidth;
      if (Math.abs(curW - lastWidth) > 2) {
        lastWidth = curW;
        updateTickerHeight();
        ScrollTrigger.refresh();
      }
    };

    const handleOrientation = () => {
      lastWidth = window.innerWidth;
      updateTickerHeight();
      ScrollTrigger.refresh();
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleOrientation);

    if (document.readyState === 'complete') {
      ScrollTrigger.refresh();
    } else {
      window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, []);

  // -----------------------------------------------------------------------
  // 2. SIZES & LAYOUT RECOMPUTATION (from --sw and --sh)
  // -----------------------------------------------------------------------
  const computeSizes = useCallback((sw, sh) => {
    const groundY = 0.94 * sh;
    const Hw = Math.min(0.56 * sh, 0.48 * sw);
    const wallScale = Hw / 560;

    // Wall right edge sits 6% of sw from stage's right edge
    const wallRightEdgePx = sw - 0.06 * sw;
    const wallSvgLeft = wallRightEdgePx - 560 * wallScale;
    const wallSvgTop = groundY - 660 * wallScale;
    const wallOuterLeftPx = wallSvgLeft + 40 * wallScale;

    // Above wall: post & sign
    const capTopY = wallSvgTop + 68 * wallScale;
    const availH = Math.max(0, capTopY - 0.04 * sh);
    const signPlateW = 1.25 * (430 * wallScale);
    const signPlateH = 0.34 * signPlateW;
    const postHeightPx = Math.max(0.08 * sh, availH - signPlateH);
    const postHeightViewBox = postHeightPx / wallScale;

    // Bull sizing
    const op = opaqueBoundsRef.current;
    let targetOpaqueH = 0.55 * Hw;
    let bullHeight = targetOpaqueH * (op.h / op.opaqueH);
    let bullWidth = bullHeight * (op.w / op.h);
    let renderedOpaqueW = bullWidth * (op.opaqueW / op.w);

    if (renderedOpaqueW > 0.40 * sw) {
      const scaleDown = (0.40 * sw) / renderedOpaqueW;
      bullWidth *= scaleDown;
      bullHeight *= scaleDown;
    }

    const solesOffsetPx = bullHeight * (op.maxY / op.h);
    let bullTop = groundY - solesOffsetPx;
    let contactOffsetX = bullWidth * (op.maxX / op.w);
    let contactOffsetY = bullTop + bullHeight * (op.minY / op.h + (op.opaqueH / op.h) * op.contactYRel);

    // REST position: contact point is 14% of sw to left of wall outer left edge
    const contactPointRestX = wallOuterLeftPx - 0.14 * sw;
    let bullRestLeft = contactPointRestX - contactOffsetX;

    // Ensure bull fits on screen including 6% wind-up
    if (bullRestLeft - 0.06 * sw < 10) {
      const allowedContactRest = 10 + 0.06 * sw + contactOffsetX;
      if (allowedContactRest > wallOuterLeftPx - 10) {
        // Shrink bull until it fits
        const shrinkFactor = Math.max(0.65, (wallOuterLeftPx - 0.14 * sw - 10) / (contactOffsetX || 1));
        bullWidth *= shrinkFactor;
        bullHeight *= shrinkFactor;
        contactOffsetX = bullWidth * (op.maxX / op.w);
        bullRestLeft = wallOuterLeftPx - 0.14 * sw - contactOffsetX;
        bullTop = groundY - (bullHeight * (op.maxY / op.h));
        contactOffsetY = bullTop + bullHeight * (op.minY / op.h + (op.opaqueH / op.h) * op.contactYRel);
      }
    }

    return {
      sw,
      sh,
      hw: Hw,
      wallScale,
      wallSvgLeft,
      wallSvgTop,
      wallOuterLeftPx,
      groundY,
      bullWidth,
      bullHeight,
      bullRestLeft,
      bullTop,
      contactPointRestX,
      contactPointY: contactOffsetY,
      postHeightPx,
      postHeightViewBox,
      signPlateW,
      signPlateH,
    };
  }, []);

  // ResizeObserver on Stage (debounced to ~150ms, ignoring height-only changes < 120px when width is unchanged)
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const sw = Math.round(width);
        const sh = Math.round(height);

        const prevW = lastObservedWRef.current;
        const prevH = lastObservedHRef.current;

        // Ignore height-only changes smaller than 120px when the width has not changed
        if (prevW > 0 && Math.abs(sw - prevW) <= 2 && Math.abs(sh - prevH) < 120) {
          continue;
        }

        if (roDebounceTimerRef.current) {
          clearTimeout(roDebounceTimerRef.current);
        }

        roDebounceTimerRef.current = setTimeout(() => {
          lastObservedWRef.current = sw;
          lastObservedHRef.current = sh;
          stageEl.style.setProperty('--sw', `${sw}px`);
          stageEl.style.setProperty('--sh', `${sh}px`);
          setStageSizes(computeSizes(sw, sh));
        }, 150);
      }
    });

    ro.observe(stageEl);
    return () => {
      ro.disconnect();
      if (roDebounceTimerRef.current) clearTimeout(roDebounceTimerRef.current);
    };
  }, [computeSizes]);

  // Closing scene WALL ST. sign placement: beside standing bull without touching shoes or ground line
  const updateSignLayout = useCallback(() => {
    const areaEl = bullAreaRef.current;
    const bullEl = standingBullRef.current;
    if (!areaEl || !bullEl || !stageSizes.sw) return;

    const areaW = areaEl.clientWidth;
    const areaH = areaEl.clientHeight;
    if (areaW <= 0 || areaH <= 0) return;

    const bullH = bullEl.offsetHeight || Math.min(380, Math.max(200, areaH - 60));
    const bullBoxW = bullEl.offsetWidth;
    const intrinsicRatio = 700 / 1050;
    const drawnBullW = bullBoxW > 0 ? Math.min(bullBoxW, bullH * intrinsicRatio) : bullH * intrinsicRatio;

    // Rightmost edge of the bull's right shoe (~84% across rendered bull image, centered in areaW)
    const shoeRightX = areaW / 2 + drawnBullW * 0.34;
    const minBboxLeft = shoeRightX + 12;
    const maxBboxRight = areaW - 2;
    const availBboxW = maxBboxRight - minBboxLeft;

    if (availBboxW <= 0) {
      setSignLayout((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    const theta = (10 * Math.PI) / 180;
    const signAspect = 190 / 545;
    const bboxFactor = Math.cos(theta) + signAspect * Math.sin(theta);

    const maxW = stageSizes.sw * 0.34;
    const minW = stageSizes.sw * 0.24;
    const maxFitW = availBboxW / bboxFactor;
    const width = Math.min(maxW, maxFitW);

    if (width < minW) {
      setSignLayout((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    const bboxW = width * bboxFactor;
    const leftOverhang = width * signAspect * Math.sin(theta);
    const bboxLeft = minBboxLeft + Math.max(0, (availBboxW - bboxW) * 0.5);
    const left = bboxLeft + leftOverhang;

    setSignLayout((prev) => {
      if (
        prev.visible &&
        Math.abs(prev.width - width) < 0.5 &&
        Math.abs(prev.left - left) < 0.5
      ) {
        return prev;
      }
      return { visible: true, width, left };
    });
  }, [stageSizes.sw]);

  useLayoutEffect(() => {
    updateSignLayout();
    const areaEl = bullAreaRef.current;
    const bullEl = standingBullRef.current;
    if (!areaEl || !bullEl) return;

    const ro = new ResizeObserver(() => {
      updateSignLayout();
    });
    ro.observe(areaEl);
    ro.observe(bullEl);
    return () => ro.disconnect();
  }, [updateSignLayout, isBroken]);

  // Screen shake helper (under 300ms, no flashes)
  const triggerShake = useCallback((intensity = 8) => {
    if (reducedMotion || !rumbleRef.current) return;
    gsap.killTweensOf(rumbleRef.current);
    gsap.fromTo(
      rumbleRef.current,
      { x: -intensity, y: intensity * 0.5 },
      {
        x: 0,
        y: 0,
        duration: 0.22,
        ease: 'elastic.out(1.15, 0.22)',
        clearProps: 'transform',
      }
    );
  }, [reducedMotion]);

  // Dust squares generator on impact (6 to 10 cream dust squares)
  const triggerDust = useCallback((originX, originY, count = 8) => {
    const puffs = Array.from({ length: count }).map((_, i) => ({
      id: Date.now() + i + Math.random(),
      x: originX + (Math.random() - 0.5) * 16,
      y: originY + (Math.random() - 0.5) * 20,
      dx: (Math.random() - 0.5) * 60 - 15,
      dy: (Math.random() - 0.8) * 50,
      size: Math.round(6 + Math.random() * 6),
      color: '#E8DFC9',
    }));
    setDustPuffs(puffs);
    setTimeout(() => setDustPuffs([]), 420);
  }, []);

  // Crossfade Headline helper
  const swapHeadline = useCallback((newText) => {
    if (isSwappingHeadlineRef.current) return;
    isSwappingHeadlineRef.current = true;
    setHeadlineOpacity(0);
    setTimeout(() => {
      setDisplayedHeadline(newText);
      setHeadlineOpacity(1);
      setTimeout(() => {
        isSwappingHeadlineRef.current = false;
      }, 150);
    }, 150);
  }, []);

  // Idle animation & paw-scrape manager
  const setIdleMode = useCallback((mode) => {
    if (currentIdleModeRef.current === mode) return;
    currentIdleModeRef.current = mode;
    const sprite = bullSpriteRef.current;
    if (!sprite) return;

    if (idleAnimRef.current) {
      idleAnimRef.current.kill();
      idleAnimRef.current = null;
    }

    if (mode === 'idle') {
      // Idle: breathing bob (translateY 3px, 1.2s loop) and small foot-stomp rotation (-1 to 1 degree)
      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(sprite, {
        y: 3,
        rotation: 1,
        duration: 1.2,
        ease: 'sine.inOut',
      });
      idleAnimRef.current = tl;
    } else if (mode === 'pawing') {
      // While button is held between rams: faster bob and small paw-scrape wiggle
      const tl = gsap.timeline({ repeat: -1 });
      tl.to(sprite, {
        y: 4,
        x: -2,
        rotation: -2,
        duration: 0.14,
        ease: 'power1.inOut',
      }).to(sprite, {
        y: 0,
        x: 2,
        rotation: 2,
        duration: 0.14,
        ease: 'power1.inOut',
      });
      idleAnimRef.current = tl;
    } else {
      gsap.set(sprite, { y: 0, x: 0, rotation: 0 });
    }
  }, []);

  // -----------------------------------------------------------------------
  // 3. INTRO DEAL-IN (Headline slams in, newspaper cards deal in at ~20% visibility)
  // -----------------------------------------------------------------------
  const runTimeBasedIntro = useCallback(() => {
    const pages = newsPagesRef.current.filter(Boolean);
    const stamps = stampsRef.current.filter(Boolean);
    const peek = peekBullRef.current;
    const headline = headlineElRef.current;

    const tl = gsap.timeline();

    // 1. Headline slams in (scale 1.15 to 1, quick, with a thud feel)
    if (headline) {
      tl.fromTo(
        headline,
        { scale: 1.15, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.18,
          ease: 'power3.out',
          onStart: () => playImpactThud(false),
        },
        0
      );
    }

    // 2. Front pages dealt in one after another from the top, each stamped red
    pages.forEach((page, idx) => {
      const dealTime = 0.2 + idx * 0.24;
      tl.fromTo(
        page,
        { y: -80, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.32, ease: 'power2.out' },
        dealTime
      );

      const stamp = stamps[idx];
      if (stamp) {
        tl.fromTo(
          stamp,
          { scale: 1.6, rotation: -8, opacity: 0 },
          { scale: 1, rotation: -8, opacity: 1, duration: 0.16, ease: 'power3.out' },
          dealTime + 0.18
        );
      }
    });

    // 3. Bull-peek rises into view
    if (peek) {
      const peekStartTime = 0.2 + (pages.length - 1) * 0.24 + 0.35;
      tl.fromTo(
        peek,
        { yPercent: 100, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.4,
          ease: 'power2.out',
          onComplete: () => {
            setPeekReady(true);
          },
        },
        peekStartTime
      );
    }
  }, []);

  const hideWallScene = useCallback(() => {
    isWallSceneRevealedRef.current = false;
    if (wallSceneGroupRef.current) {
      wallSceneGroupRef.current.style.visibility = 'hidden';
      wallSceneGroupRef.current.style.opacity = '0';
    }
    if (groundStripRef.current) {
      gsap.killTweensOf(groundStripRef.current);
      gsap.set(groundStripRef.current, { yPercent: 100 });
    }
  }, []);

  const revealWallScene = useCallback(() => {
    if (isWallSceneRevealedRef.current) return;
    isWallSceneRevealedRef.current = true;
    if (wallGroupRef.current) {
      wallGroupRef.current.style.display = 'block';
    }
    if (wallSceneGroupRef.current) {
      wallSceneGroupRef.current.style.display = 'block';
      wallSceneGroupRef.current.style.visibility = 'visible';
      wallSceneGroupRef.current.style.opacity = '1';
    }
    if (groundStripRef.current) {
      if (reducedMotion) {
        gsap.set(groundStripRef.current, { yPercent: 0 });
      } else {
        gsap.fromTo(
          groundStripRef.current,
          { yPercent: 100 },
          { yPercent: 0, duration: 0.3, ease: 'power2.out' }
        );
      }
    }
  }, [reducedMotion]);

  const resetCards = useCallback(() => {
    tossCountRef.current = 0;
    newsPagesRef.current.forEach((el) => {
      if (el) {
        gsap.killTweensOf(el);
        gsap.set(el, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visibility: 'visible' });
      }
    });
    stampsRef.current.forEach((stamp) => {
      if (stamp) {
        gsap.killTweensOf(stamp);
        gsap.set(stamp, { opacity: 1, scale: 1, rotation: -8 });
      }
    });
    cardWrappersRef.current.forEach((wrap, idx) => {
      if (wrap) {
        gsap.killTweensOf(wrap);
        gsap.set(wrap, {
          rotation: CARD_ROTATIONS[idx] ?? 0,
          y: CARD_Y_OFFSETS[idx] ?? 0,
        });
      }
    });
    setTopIdx(3);
    setHasTossed(false);
    hideWallScene();
  }, [hideWallScene]);

  const handleToss = useCallback(
    (idx) => {
      if (idx !== topIdx) return;
      if (!peekReady || shownRef.current >= 0.02 || isBrokenRef.current) return;
      if (isAnimatingRamRef.current) return;

      // The last paper (the bottom one, index 0) cannot be tossed: it does a small wiggle
      if (idx === 0) {
        if (reducedMotion) return;
        const el = newsPagesRef.current[0];
        if (el) {
          gsap.killTweensOf(el);
          gsap.fromTo(
            el,
            { rotation: 0 },
            {
              keyframes: [
                { rotation: 1.5, duration: 0.05 },
                { rotation: -1.5, duration: 0.05 },
                { rotation: 1.5, duration: 0.05 },
                { rotation: -1.5, duration: 0.05 },
                { rotation: 1.5, duration: 0.05 },
                { rotation: 0, duration: 0.05 },
              ],
              ease: 'power1.inOut',
            }
          );
        }
        return;
      }

      setHasTossed(true);
      const cardEl = newsPagesRef.current[idx];
      if (!cardEl) return;

      tossCountRef.current += 1;
      const tossNum = tossCountRef.current;
      const nextIdx = idx - 1;
      setTopIdx(nextIdx);

      // Determine toss fling trajectory and pan based on toss number (1: right, 2: left, 3+: up)
      // Add up to 8% random variation
      const rnd = () => 1 + (Math.random() * 2 - 1) * 0.08;
      let targetX = 0;
      let targetY = 0;
      let targetRot = 0;
      let pan = 0;

      if (tossNum === 1) {
        // Toss 1 flings right
        targetX = 0.95 * window.innerWidth * rnd();
        targetY = -0.12 * window.innerHeight * rnd();
        targetRot = 26 * rnd();
        pan = 0.7;
      } else if (tossNum === 2) {
        // Toss 2 flings left
        targetX = -0.95 * window.innerWidth * rnd();
        targetY = -0.08 * window.innerHeight * rnd();
        targetRot = -30 * rnd();
        pan = -0.7;
      } else {
        // Toss 3 flings up
        targetX = 0.3 * window.innerWidth * rnd();
        targetY = -0.95 * window.innerHeight * rnd();
        targetRot = 16 * rnd();
        pan = 0;
      }

      // Play directional paper flick sound
      playPaperFlick(pan);

      if (reducedMotion) {
        gsap.set(cardEl, { visibility: 'hidden' });
        return;
      }

      // Small bump on the new top paper (scale 1.015 to 1, 200ms)
      const nextCard = newsPagesRef.current[nextIdx];
      if (nextCard) {
        gsap.fromTo(
          nextCard,
          { scale: 1.015 },
          { scale: 1, duration: 0.2, ease: 'power1.out' }
        );
      }

      // Fling animation (GSAP) on the inner .news-card-item element
      gsap.to(cardEl, {
        x: targetX,
        y: targetY,
        rotation: targetRot,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(cardEl, { visibility: 'hidden' });
        },
      });

      // The peek bull does one quick sideways glance (translateX 3px) after each toss
      if (peekBullRef.current) {
        gsap.fromTo(
          peekBullRef.current,
          { x: 0 },
          {
            x: 3,
            duration: 0.12,
            yoyo: true,
            repeat: 1,
            ease: 'power1.inOut',
            onComplete: () => {
              gsap.set(peekBullRef.current, { x: 0 });
            },
          }
        );
      }
    },
    [topIdx, peekReady, reducedMotion]
  );

  useEffect(() => {
    if (reducedMotion || !containerRef.current) return;

    const checkVisibility = () => {
      if (introStartedRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.8 && rect.bottom >= window.innerHeight * 0.1) {
        introStartedRef.current = true;
        runTimeBasedIntro();
      }
    };

    checkVisibility();
    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility, { passive: true });

    const introSt = ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top 80%',
      onEnter: () => {
        if (!introStartedRef.current) {
          introStartedRef.current = true;
          runTimeBasedIntro();
        }
      },
    });

    return () => {
      window.removeEventListener('scroll', checkVisibility);
      window.removeEventListener('resize', checkVisibility);
      introSt.kill();
    };
  }, [reducedMotion, runTimeBasedIntro]);

  // Torn paper edge entrance when Charge section is 15% visible
  useEffect(() => {
    if (!tornEdgeRef.current || !containerRef.current) return;

    if (reducedMotion) {
      gsap.set(tornEdgeRef.current, { y: 0, x: 0, opacity: 1 });
      return;
    }

    // Set initial position: 24px up
    gsap.set(tornEdgeRef.current, { y: TORN_EDGE_ENTRANCE_OFFSET, x: 0 });

    const triggerDrop = () => {
      if (hasTornEdgeDroppedRef.current || !tornEdgeRef.current) return;
      hasTornEdgeDroppedRef.current = true;

      const tl = gsap.timeline();
      tl.to(tornEdgeRef.current, {
        y: 0,
        duration: TORN_EDGE_ENTRANCE_DURATION,
        ease: 'back.out(1.7)',
        onComplete: () => {
          gsap.to(tornEdgeRef.current, {
            x: TORN_EDGE_SHAKE_PX,
            duration: 0.035,
            yoyo: true,
            repeat: 3,
            onComplete: () => {
              gsap.set(tornEdgeRef.current, { x: 0 });
            },
          });
        },
      });
    };

    // 2-second fallback safety: ensure visible even if trigger fails
    const fallbackTimer = window.setTimeout(() => {
      if (!hasTornEdgeDroppedRef.current && tornEdgeRef.current) {
        hasTornEdgeDroppedRef.current = true;
        gsap.set(tornEdgeRef.current, { y: 0, x: 0, opacity: 1 });
      }
    }, 2000);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio >= TORN_EDGE_THRESHOLD || entry.isIntersecting) {
            triggerDrop();
            observer.disconnect();
          }
        });
      },
      { threshold: [TORN_EDGE_THRESHOLD] }
    );

    observer.observe(containerRef.current);

    return () => {
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, [reducedMotion]);

  // Bull-peek idling every 4 to 6 seconds
  useEffect(() => {
    if (!peekReady || shownRef.current > 0.05 || isBrokenRef.current || !peekBullRef.current) return;

    const triggerIdle = () => {
      const delay = 4000 + Math.random() * 2000;
      peekIdleTimeoutRef.current = setTimeout(() => {
        if (!peekBullRef.current || shownRef.current > 0.05 || isBrokenRef.current) return;
        const choice = Math.floor(Math.random() * 3);
        const el = peekBullRef.current;
        if (choice === 0) {
          gsap.timeline()
            .to(el, { rotation: 3, duration: 0.12, ease: 'power1.out' })
            .to(el, { rotation: -1.5, duration: 0.1, ease: 'power1.inOut' })
            .to(el, { rotation: 0, duration: 0.08, ease: 'power1.out' });
        } else if (choice === 1) {
          gsap.timeline()
            .to(el, { x: 3, duration: 0.14, ease: 'power1.out' })
            .to(el, { x: 0, duration: 0.14, ease: 'power1.in' });
        } else {
          gsap.timeline()
            .to(el, { scaleY: 0.88, duration: 0.15, ease: 'power2.out' })
            .to(el, { scaleY: 1, duration: 0.16, ease: 'power2.in' });
        }
        triggerIdle();
      }, delay);
    };

    triggerIdle();
    return () => {
      if (peekIdleTimeoutRef.current) {
        clearTimeout(peekIdleTimeoutRef.current);
        peekIdleTimeoutRef.current = null;
      }
    };
  }, [peekReady]);

  // -----------------------------------------------------------------------
  // 5b. DESKTOP PINNED SCROLL LOCK DURING RAM / BREACH ANIMATIONS
  // -----------------------------------------------------------------------
  const unlockScroll = useCallback(() => {
    if (scrollLockCleanupRef.current) {
      scrollLockCleanupRef.current();
      scrollLockCleanupRef.current = null;
    }
  }, []);

  const lockScroll = useCallback(() => {
    if (scrollLockCleanupRef.current) return;
    if (typeof window === 'undefined') return;
    if (reducedMotionRef.current || window.innerWidth < 768) return;
    const st = desktopStRef.current;
    if (!scrollDrivenRef.current || !st) return;

    const curY = window.scrollY;
    const isPinned = st.isActive || (curY >= st.start - 2 && curY <= st.end + 2);
    if (!isPinned && !(curY > st.end && targetRef.current >= 0.62)) return;

    const lockY = Math.max(st.start, Math.min(curY, st.end));
    if (Math.abs(window.scrollY - lockY) > 1) {
      window.scrollTo(0, lockY);
    }

    const blockedKeys = new Set([
      'Space',
      ' ',
      'PageDown',
      'PageUp',
      'ArrowDown',
      'ArrowUp',
      'End',
      'Home',
    ]);

    const onWheel = (e) => {
      if (isAnimatingRamRef.current) {
        e.preventDefault();
      }
    };

    const onKeyDown = (e) => {
      if (!isAnimatingRamRef.current) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (blockedKeys.has(e.code) || blockedKeys.has(e.key)) {
        e.preventDefault();
      }
    };

    const onScroll = () => {
      if (isAnimatingRamRef.current && Math.abs(window.scrollY - lockY) > 0.5) {
        window.scrollTo(0, lockY);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, { passive: true });

    scrollLockCleanupRef.current = () => {
      window.removeEventListener('wheel', onWheel, { passive: false });
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // -----------------------------------------------------------------------
  // 6. THE RAM ANIMATION (Damage Levels 1, 2, 3) (~1.3s total)
  // -----------------------------------------------------------------------
  const executeRam = useCallback(
    (ramIdx) => {
      isAnimatingRamRef.current = true;
      lockScroll();
      revealWallScene();
      if (groundStripRef.current) gsap.set(groundStripRef.current, { yPercent: 0 });
      if (wallGroupRef.current) {
        wallGroupRef.current.style.transform = 'translateY(0%)';
        wallGroupRef.current.style.opacity = '1';
      }
      if (signContainerRef.current) {
        signContainerRef.current.style.transform = 'translateY(0%)';
        signContainerRef.current.style.opacity = '1';
      }
      if (bullContainerRef.current) {
        bullContainerRef.current.style.transform = 'translateX(0px)';
        bullContainerRef.current.style.opacity = '1';
      }
      setIdleMode('none');
      const bull = bullSpriteRef.current;
      const shadow = bullShadowRef.current;
      const speedLines = speedLinesRef.current;
      const starburst = starburstRef.current;
      const wall = wallSvgRef.current;
      const signPost = postGroupRef.current;
      const signPlate = signPlateGroupRef.current;

      const { sw, wallOuterLeftPx, contactPointRestX, contactPointY } = stageSizes;
      const dashDistance = wallOuterLeftPx - contactPointRestX;
      const shakeIntensity = [6, 8, 12][ramIdx] || 8;

      const tl = gsap.timeline({
        onComplete: () => {
          isAnimatingRamRef.current = false;
          unlockScroll();
          setIdleMode(isHoldingRef.current ? 'pawing' : 'idle');
          scheduleTickRef.current();
        },
      });

      // a) Wind-up (350ms): move left by 6% sw, lean back (rotate -6deg)
      tl.to(
        bull,
        {
          x: -0.06 * sw,
          rotation: -6,
          transformOrigin: '50% 100%',
          duration: 0.35,
          ease: 'power2.out',
        },
        0
      );

      // b) Dash (220ms): sprint right until contact point reaches wall outer left edge
      tl.add(() => {
        if (speedLines) gsap.set(speedLines, { opacity: 1 });
      }, 0.35);

      tl.to(
        bull,
        {
          x: dashDistance,
          rotation: 0,
          duration: 0.22,
          ease: 'power3.in',
        },
        0.35
      );

      // c) Impact & 120ms freeze (at t = 0.57s)
      tl.add(() => {
        if (speedLines) gsap.set(speedLines, { opacity: 0 });
        playImpactThud(false);
        triggerShake(shakeIntensity);
        triggerDust(wallOuterLeftPx, contactPointY, 8);

        // Reveal crack paths for this level
        const crackEl = cracksRef.current[ramIdx];
        if (crackEl) {
          gsap.fromTo(
            crackEl,
            { strokeDashoffset: 800, opacity: 1 },
            { strokeDashoffset: 0, opacity: 1, duration: 0.25, ease: 'power2.out' }
          );
        }

        // Struck side bricks slide in or fall
        if (ramIdx === 0) {
          gsap.to([struckBrick1Ref.current, struckBrick2Ref.current], { x: 6, duration: 0.15 });
        } else if (ramIdx === 1) {
          gsap.to([struckBrick1Ref.current, struckBrick2Ref.current], { x: 12, duration: 0.15 });
          // Drop loose top bricks (20 to 45px)
          const b1 = frontBrickRefs.current[1];
          const b2 = frontBrickRefs.current[2];
          const b3 = frontBrickRefs.current[7];
          if (b1) gsap.to(b1, { y: 35, rotation: 8, duration: 0.4, ease: 'bounce.out' });
          if (b2) gsap.to(b2, { y: 48, rotation: -6, duration: 0.45, ease: 'bounce.out' });
          if (b3) gsap.to(b3, { y: 30, rotation: 10, duration: 0.42, ease: 'bounce.out' });
        } else if (ramIdx === 2) {
          // Struck side bricks fall out leaving dark holes
          gsap.to(struckBrick1Ref.current, { y: 220, x: 20, rotation: 45, opacity: 0.7, duration: 0.55, ease: 'power2.in' });
          gsap.to(struckBrick2Ref.current, { y: 240, x: 30, rotation: -60, opacity: 0.7, duration: 0.58, ease: 'power2.in' });
          // Drop more loose front bricks
          const b4 = frontBrickRefs.current[0];
          const b5 = frontBrickRefs.current[3];
          const b6 = frontBrickRefs.current[5];
          const b7 = frontBrickRefs.current[8];
          if (b4) gsap.to(b4, { y: 60, rotation: -12, duration: 0.5, ease: 'bounce.out' });
          if (b5) gsap.to(b5, { y: 55, rotation: 14, duration: 0.48, ease: 'bounce.out' });
          if (b6) gsap.to(b6, { y: 45, rotation: -8, duration: 0.52, ease: 'bounce.out' });
          if (b7) gsap.to(b7, { y: 50, rotation: 9, duration: 0.5, ease: 'bounce.out' });
        }

        // Sign reactions
        if (ramIdx === 0) {
          gsap.timeline()
            .to(signPost, { rotation: 4, transformOrigin: '345px 84px', duration: 0.08 })
            .to(signPost, { rotation: -4, duration: 0.1 })
            .to(signPost, { rotation: 0, duration: 0.15 })
            .to(signPlate, { y: -4, duration: 0.08 }, 0)
            .to(signPlate, { y: 0, duration: 0.15 }, 0.08);
        } else if (ramIdx === 1) {
          // Post leans -8deg, left bolt pops off and falls, plate hangs slightly crooked (-6deg)
          gsap.to(signPost, { rotation: -8, transformOrigin: '345px 84px', duration: 0.35, ease: 'power2.out' });
          if (leftBoltRef.current) {
            gsap.to(leftBoltRef.current, { y: 320, x: -40, rotation: 360, opacity: 0, duration: 0.65, ease: 'power2.in' });
          }
          gsap.to(signPlate, { rotation: -6, transformOrigin: `${345 + 537.5 / 2 - 30}px ${84 - stageSizes.postHeightViewBox - 182.75 / 2}px`, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
        } else if (ramIdx === 2) {
          // Post bends -18deg, plate swings like a damped pendulum
          gsap.to(signPost, { rotation: -18, transformOrigin: '345px 84px', duration: 0.45, ease: 'power2.out' });
          gsap.timeline()
            .to(signPlate, { rotation: -14, transformOrigin: `${345 + 537.5 / 2 - 30}px ${84 - stageSizes.postHeightViewBox - 182.75 / 2}px`, duration: 0.22, ease: 'power2.out' })
            .to(signPlate, { rotation: 10, duration: 0.3, ease: 'power2.inOut' })
            .to(signPlate, { rotation: -7, duration: 0.35, ease: 'power2.inOut' })
            .to(signPlate, { rotation: 0, duration: 0.4, ease: 'power2.out' });
        }
      }, 0.57);

      // Squash from feet
      tl.to(
        bull,
        {
          scaleX: 0.92,
          scaleY: 1.05,
          transformOrigin: '50% 100%',
          duration: 0.06,
        },
        0.57
      );

      // Starburst pop at contact spot
      if (starburst) {
        tl.fromTo(
          starburst,
          { scale: 0.4, opacity: 1 },
          { scale: 1.2, opacity: 1, duration: 0.12, ease: 'power2.out' },
          0.57
        ).to(starburst, { scale: 1.0, opacity: 0, duration: 0.13 }, 0.69);
      }

      // Wall jolts (translateX +6px and back)
      tl.to(
        wall,
        {
          x: 6,
          duration: 0.06,
          ease: 'power2.out',
        },
        0.57
      ).to(
        wall,
        {
          x: 0,
          duration: 0.12,
          ease: 'back.out(2)',
        },
        0.63
      );

      // d) Rebound (450ms) (at t = 0.69s to 1.14s)
      tl.to(
        bull,
        {
          x: 0,
          scaleX: 1,
          scaleY: 1,
          duration: 0.45,
          ease: 'power1.out',
        },
        0.69
      );

      // Hop arc (translateY -14px up and down)
      tl.to(
        bull,
        {
          keyframes: [
            { y: -14, duration: 0.22, ease: 'power2.out' },
            { y: 0, duration: 0.23, ease: 'power2.in' },
          ],
        },
        0.69
      );

      // Shadow shrinks during hop
      if (shadow) {
        tl.to(
          shadow,
          {
            keyframes: [
              { scale: 0.75, opacity: 0.15, duration: 0.22 },
              { scale: 1, opacity: 0.25, duration: 0.23 },
            ],
          },
          0.69
        );
      }

      // Dazed wobble (+-2deg)
      tl.to(
        bull,
        {
          keyframes: [
            { rotation: -5, duration: 0.1 },
            { rotation: 2, duration: 0.12 },
            { rotation: -2, duration: 0.12 },
            { rotation: 0, duration: 0.11 },
          ],
        },
        0.75
      );
    },
    [stageSizes, triggerShake, triggerDust, revealWallScene, lockScroll, unlockScroll]
  );

  // -----------------------------------------------------------------------
  // 7. BREACH ANIMATION (Target = 1.0)
  // -----------------------------------------------------------------------
  const executeBreach = useCallback(() => {
    revealWallScene();
    if (groundStripRef.current) gsap.set(groundStripRef.current, { yPercent: 0 });
    isAnimatingRamRef.current = true;
    isBrokenRef.current = true;
    lockScroll();
    setIdleMode('none');

    const bull = bullSpriteRef.current;
    const signGroup = signPlateGroupRef.current;
    const { sw, wallOuterLeftPx, contactPointRestX, contactPointY } = stageSizes;
    const dashThroughDistance = wallOuterLeftPx - contactPointRestX + 220;

    const tl = gsap.timeline();

    // Dash through the wall
    playSample('grunt');
    tl.to(
      bull,
      {
        x: dashThroughDistance,
        duration: 0.32,
        ease: 'power3.in',
      },
      0
    );

    // Impact & Explosion
    tl.add(() => {
      playImpactThud(true); // Louder heavier thud
      triggerShake(14); // 14px shake
      triggerDust(wallOuterLeftPx, contactPointY, 12);
    }, 0.28);

    // Wall pieces explode: random velocities (x: 80 to 340px, up: 40 to 260px, rotate +-240deg)
    ALL_FRONT_BRICKS.forEach((_, idx) => {
      const el = frontBrickRefs.current[idx];
      if (!el) return;
      const angle = (Math.PI / 6) + (Math.random() - 0.5) * 0.9;
      const dist = 120 + Math.random() * 220;
      const dx = Math.cos(angle) * dist + 40;
      const dy = -Math.sin(angle) * dist + 120;
      const rot = (Math.random() - 0.5) * 480;

      tl.to(
        el,
        {
          x: dx,
          y: dy,
          rotation: rot,
          opacity: 0,
          duration: 0.75,
          ease: 'power3.out',
        },
        0.28
      );
    });

    // Side slab and cap fly
    if (sideSlabRef.current) {
      tl.to(sideSlabRef.current, { x: 180, y: 140, rotation: 120, opacity: 0, duration: 0.75, ease: 'power3.out' }, 0.28);
    }
    if (topCapRef.current) {
      tl.to(topCapRef.current, { x: 260, y: 160, rotation: -90, opacity: 0, duration: 0.75, ease: 'power3.out' }, 0.28);
    }

    // Compute sign resting position so it lands directly on ground line, never clipped
    const rotDeg = 15;
    const rotRad = (rotDeg * Math.PI) / 180;
    const plateW = 537.5;
    const plateH = 182.75;
    const rotHalfH = (plateW / 2) * Math.sin(rotRad) + (plateH / 2) * Math.cos(rotRad); // ~157.8 viewBox units
    const rotHalfW = (plateW / 2) * Math.cos(rotRad) + (plateH / 2) * Math.sin(rotRad); // ~283.2 viewBox units

    // ViewBox ground line is at y = 660. The lowest point of the plate touches ground line.
    const targetCenterY = 660 - rotHalfH;
    const origCenterY = 84 - stageSizes.postHeightViewBox - plateH / 2;
    const endSignY = targetCenterY - origCenterY;

    // Center X in stage screen pixels: ensure sign is fully inside the stage [margin, sw - margin]
    const margin = Math.max(16, sw * 0.04);
    const signScreenHalfW = rotHalfW * stageSizes.wallScale;
    const minCenterScreenX = margin + signScreenHalfW;
    const maxCenterScreenX = sw - margin - signScreenHalfW;
    const defaultCenterScreenX = stageSizes.wallSvgLeft + (345 + 40) * stageSizes.wallScale;
    let clampedCenterScreenX = defaultCenterScreenX;
    if (maxCenterScreenX >= minCenterScreenX) {
      clampedCenterScreenX = Math.max(minCenterScreenX, Math.min(maxCenterScreenX, defaultCenterScreenX));
    } else {
      clampedCenterScreenX = sw / 2;
    }
    const endSignX = (clampedCenterScreenX - stageSizes.wallSvgLeft) / stageSizes.wallScale - 345;

    // Sign falls, bounces twice, lies at -15deg on ground line inside stage
    if (signGroup) {
      tl.to(
        signGroup,
        {
          keyframes: [
            { y: endSignY - 40, x: endSignX - 30, rotation: -25, duration: 0.45, ease: 'power2.in' },
            { y: endSignY - 25, x: endSignX - 10, rotation: -10, duration: 0.15, ease: 'power1.out' },
            { y: endSignY, x: endSignX, rotation: -15, duration: 0.18, ease: 'bounce.out' },
          ],
        },
        0.28
      );
    }

    // Bull stands on right side for 500ms
    tl.to(
      bull,
      {
        opacity: 0,
        duration: 0.15,
      },
      '+=0.5'
    );

    // Hide all wall leftovers when closing scene starts: cracks, struck bricks, post, loose bricks, rubble
    tl.add(() => {
      setIsBroken(true);
      setDisplayedHeadline(CHARGE_COPY.beat4.heading);
      headlineTargetRef.current = CHARGE_COPY.beat4.heading;
      if (wallGroupRef.current) {
        wallGroupRef.current.style.opacity = '0';
      }
      if (signContainerRef.current) {
        signContainerRef.current.style.opacity = '0';
      }
      if (postGroupRef.current) {
        const postParts = postGroupRef.current.querySelectorAll(':scope > rect, :scope > circle');
        postParts.forEach((p) => {
          p.style.opacity = '0';
        });
      }
      cracksRef.current.forEach((c) => {
        if (c) c.style.opacity = '0';
      });
      if (struckBrick1Ref.current) struckBrick1Ref.current.style.opacity = '0';
      if (struckBrick2Ref.current) struckBrick2Ref.current.style.opacity = '0';
      if (sideSlabRef.current) sideSlabRef.current.style.opacity = '0';
      if (topCapRef.current) topCapRef.current.style.opacity = '0';
      ALL_FRONT_BRICKS.forEach((_, idx) => {
        const el = frontBrickRefs.current[idx];
        if (el) el.style.opacity = '0';
      });
      setDustPuffs([]);
    }, '+=0.05');

    // Closing scene takeover: background newsprint to ink black
    tl.to(
      containerRef.current,
      {
        backgroundColor: '#0E0D0C',
        duration: 0.6,
        ease: 'power2.inOut',
      },
      '+=0.05'
    );

    // Bull-standing rises in
    tl.to(
      standingBullRef.current,
      {
        y: 0,
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out',
      },
      '<'
    );

    tl.to(
      speechBubbleRef.current,
      {
        opacity: 1,
        scale: 1,
        duration: 0.35,
        ease: 'back.out(1.6)',
      },
      '+=0.05'
    );

    tl.add(() => {
      isAnimatingRamRef.current = false;
      unlockScroll();

      // Kill every repeating tween and timer for the bull idle, paw scrape, peek idle, dust, speed lines
      if (peekIdleTimeoutRef.current) {
        clearTimeout(peekIdleTimeoutRef.current);
        peekIdleTimeoutRef.current = null;
      }
      setIdleMode('none');
      if (idleAnimRef.current) {
        idleAnimRef.current.kill();
        idleAnimRef.current = null;
      }
      if (bullSpriteRef.current) {
        gsap.killTweensOf(bullSpriteRef.current);
      }
      if (peekBullRef.current) {
        gsap.killTweensOf(peekBullRef.current);
      }
      if (speedLinesRef.current) {
        gsap.killTweensOf(speedLinesRef.current);
        speedLinesRef.current.style.opacity = '0';
      }
      if (starburstRef.current) {
        gsap.killTweensOf(starburstRef.current);
        starburstRef.current.style.opacity = '0';
      }
      setDustPuffs([]);

      // Set stage and wall group transforms back to none (clearProps: 'transform') after any shake
      if (stageRef.current) {
        gsap.set(stageRef.current, { clearProps: 'transform' });
      }
      if (rumbleRef.current) {
        gsap.set(rumbleRef.current, { clearProps: 'transform' });
      }
      if (wallGroupRef.current) {
        gsap.set(wallGroupRef.current, { clearProps: 'transform' });
        wallGroupRef.current.style.display = 'none';
      }
      if (wallSceneGroupRef.current) {
        gsap.set(wallSceneGroupRef.current, { clearProps: 'transform' });
        wallSceneGroupRef.current.style.display = 'none';
      }

      // Remove will-change from animated props after breach settles (preserve GPU fill bar)
      if (containerRef.current) {
        const els = containerRef.current.querySelectorAll('*');
        els.forEach((el) => {
          if (el === progressBarFillRef.current) return;
          if (el.style && el.style.willChange) {
            el.style.willChange = 'auto';
          }
        });
      }

      // Desktop only: release pin & 350% pinSpacing once breach closing scene settles
      if (!reducedMotionRef.current && window.innerWidth >= 768 && desktopStRef.current && scrollDrivenRef.current) {
        const st = desktopStRef.current;
        const start = st.start;
        scrollDrivenRef.current = false;
        st.disable(true);
        window.scrollTo(0, start);
        ScrollTrigger.refresh();
        window.dispatchEvent(new Event('resize'));
      }

      scheduleTickRef.current();
    });
  }, [stageSizes, triggerShake, triggerDust, revealWallScene, setIdleMode, unlockScroll]);

  // -----------------------------------------------------------------------
  // 8. RESTORE INTRO STATE & RUN IT BACK
  // -----------------------------------------------------------------------
  const restoreIntroState = useCallback(() => {
    isBrokenRef.current = false;
    setIsBroken(false);
    targetRef.current = 0;
    shownRef.current = 0;
    damageLevelRef.current = 0;
    lastThresholdReachedRef.current = 0;
    isHoldingRef.current = false;
    hasTriggeredWallDustRef.current = false;

    // Restore wall display
    if (wallGroupRef.current) {
      wallGroupRef.current.style.display = 'block';
    }
    if (wallSceneGroupRef.current) {
      wallSceneGroupRef.current.style.display = 'block';
    }

    // 1. Make the cards container visible (display block, opacity 1, translate 0)
    if (cardsContainerRef.current) {
      cardsContainerRef.current.style.display = 'block';
      cardsContainerRef.current.style.transform = 'translateY(0px)';
      cardsContainerRef.current.style.opacity = '1';
    }

    // 2. Restore all 4 newspapers to initial pile with stamps stamped; reset toss state
    resetCards();

    // 3. Set headline back to the first headline
    setDisplayedHeadline(CHARGE_COPY.beat1.heading);
    headlineTargetRef.current = CHARGE_COPY.beat1.heading;

    // 4. Hide the wall scene group and set ground strip to translateY(100%)
    hideWallScene();

    // 5. Set section background back to newsprint (#E8DFC9)
    if (containerRef.current) {
      gsap.set(containerRef.current, { backgroundColor: '#E8DFC9' });
    }

    // 6. Ensure peek bull is mounted on bottom paper and visible (opacity 1, yPercent 0)
    if (peekBullRef.current) {
      gsap.killTweensOf(peekBullRef.current);
      gsap.set(peekBullRef.current, { opacity: 1, yPercent: 0, x: 0 });
    }

    // 7. Reset HOLD TO CHARGE button and progress bar back to 0%
    activePointerIdRef.current = null;
    if (progressBarFillRef.current) {
      progressBarFillRef.current.style.willChange = 'transform';
      progressBarFillRef.current.style.transform = 'scaleX(0)';
    }
    if (buttonTextRef.current) {
      buttonTextRef.current.textContent = CHARGE_COPY.mobileButton.holdText;
    }

    // 8. Hide standing bull and speech bubble
    if (standingBullRef.current) {
      gsap.killTweensOf(standingBullRef.current);
      gsap.set(standingBullRef.current, { y: 120, opacity: 0 });
    }
    if (speechBubbleRef.current) {
      gsap.killTweensOf(speechBubbleRef.current);
      gsap.set(speechBubbleRef.current, { opacity: 0, scale: 0.7 });
    }
  }, [resetCards, hideWallScene]);

  const handleRunItBack = useCallback(() => {
    if (isAnimatingRamRef.current) return;
    isAnimatingRamRef.current = true;
    unlockScroll();
    setIdleMode('none');

    // Desktop: re-enable pin & jump scroll position back to start of pin instantly (behavior: 'auto')
    if (!reducedMotionRef.current && window.innerWidth >= 768 && desktopStRef.current) {
      const st = desktopStRef.current;
      scrollDrivenRef.current = true;
      st.enable();
      ScrollTrigger.refresh();
      const startY = st.start || 0;
      window.scrollTo({
        top: startY,
        behavior: 'auto',
      });
      try {
        st.scroll(startY);
        ScrollTrigger.update();
      } catch (_) {}
      window.dispatchEvent(new Event('resize'));
    }

    // Kill any running tweens or timeouts before starting
    isHoldingRef.current = false;
    targetRef.current = 0;
    shownRef.current = 0;
    damageLevelRef.current = 0;
    lastThresholdReachedRef.current = 0;

    gsap.killTweensOf([
      bullSpriteRef.current,
      wallSvgRef.current,
      signPlateGroupRef.current,
      postGroupRef.current,
      standingBullRef.current,
      speechBubbleRef.current,
      containerRef.current,
      sideSlabRef.current,
      struckBrick1Ref.current,
      struckBrick2Ref.current,
      topCapRef.current,
      leftBoltRef.current,
      ...frontBrickRefs.current.filter(Boolean),
      ...cracksRef.current.filter(Boolean),
      ...newsPagesRef.current.filter(Boolean),
      peekBullRef.current,
    ]);

    const tl = gsap.timeline({
      onComplete: () => {
        restoreIntroState();

        if (reducedMotion) {
          isAnimatingRamRef.current = false;
          setPeekReady(true);
          scheduleTickRef.current();
          return;
        }

        const pages = newsPagesRef.current.filter(Boolean);
        const peek = peekBullRef.current;

        const introTl = gsap.timeline({
          onComplete: () => {
            targetRef.current = 0;
            shownRef.current = 0;
            damageLevelRef.current = 0;
            lastThresholdReachedRef.current = 0;
            isHoldingRef.current = false;
            isAnimatingRamRef.current = false;
            setPeekReady(true);
            scheduleTickRef.current();
          },
        });

        // The four papers drop back onto the pile one after another (translateY: -30 to 0, opacity 0 to 1, 80ms stagger, 300ms each)
        introTl.fromTo(
          pages,
          { y: -30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.3,
            stagger: 0.08,
            ease: 'power2.out',
          }
        );

        // Then the peek bull rises (yPercent: 100 to 0)
        if (peek) {
          introTl.fromTo(
            peek,
            { yPercent: 100, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              duration: 0.35,
              ease: 'power2.out',
            }
          );
        }
      },
    });

    // Rebuild bricks in 800ms
    if (wallSceneGroupRef.current) {
      wallSceneGroupRef.current.style.display = 'block';
    }
    if (wallGroupRef.current) {
      wallGroupRef.current.style.display = 'block';
      wallGroupRef.current.style.opacity = '1';
    }
    if (postGroupRef.current) {
      const postParts = postGroupRef.current.querySelectorAll(':scope > rect, :scope > circle');
      postParts.forEach((p) => {
        p.style.opacity = '1';
      });
    }

    ALL_FRONT_BRICKS.forEach((_, idx) => {
      const el = frontBrickRefs.current[idx];
      if (!el) return;
      tl.to(el, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.8, ease: 'power3.inOut' }, 0);
    });

    if (sideSlabRef.current) tl.to(sideSlabRef.current, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.8 }, 0);
    if (struckBrick1Ref.current) tl.to(struckBrick1Ref.current, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.8 }, 0);
    if (struckBrick2Ref.current) tl.to(struckBrick2Ref.current, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.8 }, 0);
    if (topCapRef.current) tl.to(topCapRef.current, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.8 }, 0);
    if (signPlateGroupRef.current) tl.to(signPlateGroupRef.current, { x: 0, y: 0, rotation: 0, duration: 0.8 }, 0);
    if (postGroupRef.current) tl.to(postGroupRef.current, { rotation: 0, duration: 0.8 }, 0);
    if (leftBoltRef.current) tl.to(leftBoltRef.current, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.5 }, 0.3);

    // Clear cracks
    cracksRef.current.forEach((c) => {
      if (c) tl.to(c, { strokeDashoffset: 800, opacity: 0, duration: 0.3 }, 0);
    });

    // Reset bull
    if (bullSpriteRef.current) {
      tl.to(bullSpriteRef.current, { x: 0, y: 0, rotation: 0, opacity: 1, scaleX: 1, scaleY: 1, duration: 0.8 }, 0);
    }
    if (standingBullRef.current) {
      tl.to(standingBullRef.current, { y: 120, opacity: 0, duration: 0.4 }, 0);
    }
    if (speechBubbleRef.current) {
      tl.to(speechBubbleRef.current, { opacity: 0, scale: 0.7, duration: 0.3 }, 0);
    }

    // Reset background to newsprint
    if (containerRef.current) {
      tl.to(containerRef.current, { backgroundColor: '#E8DFC9', duration: 0.6 }, 0);
    }
  }, [restoreIntroState, reducedMotion, unlockScroll]);

  // -----------------------------------------------------------------------
  // DEBUG HELPERS & RESET
  // -----------------------------------------------------------------------
  const instantReset = useCallback(() => {
    unlockScroll();
    if (!reducedMotionRef.current && window.innerWidth >= 768 && desktopStRef.current) {
      const st = desktopStRef.current;
      scrollDrivenRef.current = true;
      st.enable();
      ScrollTrigger.refresh();
      const startY = st.start || 0;
      window.scrollTo({
        top: startY,
        behavior: 'auto',
      });
      try {
        st.scroll(startY);
        ScrollTrigger.update();
      } catch (_) {}
      window.dispatchEvent(new Event('resize'));
    }

    gsap.killTweensOf([
      bullSpriteRef.current,
      wallSvgRef.current,
      signPlateGroupRef.current,
      postGroupRef.current,
      standingBullRef.current,
      speechBubbleRef.current,
      containerRef.current,
    ]);
    cracksRef.current.forEach((c) => {
      if (c) {
        gsap.killTweensOf(c);
        gsap.set(c, { strokeDashoffset: 800, opacity: 0 });
      }
    });
    ALL_FRONT_BRICKS.forEach((_, idx) => {
      const el = frontBrickRefs.current[idx];
      if (el) {
        gsap.killTweensOf(el);
        gsap.set(el, { x: 0, y: 0, rotation: 0, opacity: 1 });
      }
    });
    if (sideSlabRef.current) gsap.set(sideSlabRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
    if (struckBrick1Ref.current) gsap.set(struckBrick1Ref.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
    if (struckBrick2Ref.current) gsap.set(struckBrick2Ref.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
    if (topCapRef.current) gsap.set(topCapRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
    if (signPlateGroupRef.current) gsap.set(signPlateGroupRef.current, { x: 0, y: 0, rotation: 0 });
    if (postGroupRef.current) {
      gsap.set(postGroupRef.current, { rotation: 0 });
      const postParts = postGroupRef.current.querySelectorAll(':scope > rect, :scope > circle');
      postParts.forEach((p) => {
        p.style.opacity = '1';
      });
    }
    if (leftBoltRef.current) gsap.set(leftBoltRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
    if (bullSpriteRef.current) gsap.set(bullSpriteRef.current, { x: 0, y: 0, rotation: 0, opacity: 1, scaleX: 1, scaleY: 1 });
    if (wallGroupRef.current) {
      wallGroupRef.current.style.transform = 'translateY(105%)';
      wallGroupRef.current.style.opacity = '0';
    }
    if (signContainerRef.current) {
      signContainerRef.current.style.transform = 'translateY(105%)';
      signContainerRef.current.style.opacity = '0';
    }
    if (bullContainerRef.current) {
      bullContainerRef.current.style.transform = 'translateX(-340px)';
      bullContainerRef.current.style.opacity = '0';
    }

    restoreIntroState();
    isAnimatingRamRef.current = false;
    setPeekReady(true);
    scheduleTickRef.current();
  }, [restoreIntroState, unlockScroll]);

  const getStateName = useCallback(() => {
    if (isBrokenRef.current && !isAnimatingRamRef.current) return 'closing';
    if (isAnimatingRamRef.current) {
      if (isBrokenRef.current || shownRef.current >= 0.98) return 'breach';
      if (damageLevelRef.current === 3) return 'ram3';
      if (damageLevelRef.current === 2) return 'ram2';
      return 'ram1';
    }
    if (shownRef.current < 0.35) return 'intro';
    if (shownRef.current >= 0.98) return 'closing';
    return 'idle';
  }, []);

  const handleDebugJump = useCallback((stateKey) => {
    if (stateKey === 'intro') {
      instantReset();
      resetCards();
      hideWallScene();
      return;
    }
    if (stateKey === 'reset') {
      instantReset();
      hideWallScene();
      return;
    }
    if (stateKey === 'run_it_back') {
      handleRunItBack();
      return;
    }

    revealWallScene();
    if (groundStripRef.current) gsap.set(groundStripRef.current, { yPercent: 0 });

    if (stateKey === 'ram1') {
      gsap.killTweensOf([
        bullSpriteRef.current,
        wallSvgRef.current,
        signPlateGroupRef.current,
        postGroupRef.current,
        standingBullRef.current,
        containerRef.current,
      ]);
      isBrokenRef.current = false;
      setIsBroken(false);
      if (containerRef.current) gsap.set(containerRef.current, { backgroundColor: '#E8DFC9' });
      if (standingBullRef.current) gsap.set(standingBullRef.current, { y: 120, opacity: 0 });

      cracksRef.current.forEach((c) => c && gsap.set(c, { strokeDashoffset: 800, opacity: 0 }));
      ALL_FRONT_BRICKS.forEach((_, idx) => {
        const el = frontBrickRefs.current[idx];
        if (el) gsap.set(el, { x: 0, y: 0, rotation: 0, opacity: 1 });
      });
      if (sideSlabRef.current) gsap.set(sideSlabRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
      if (struckBrick1Ref.current) gsap.set(struckBrick1Ref.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
      if (struckBrick2Ref.current) gsap.set(struckBrick2Ref.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
      if (topCapRef.current) gsap.set(topCapRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
      if (signPlateGroupRef.current) gsap.set(signPlateGroupRef.current, { x: 0, y: 0, rotation: 0 });
      if (postGroupRef.current) gsap.set(postGroupRef.current, { rotation: 0 });
      if (leftBoltRef.current) gsap.set(leftBoltRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 });

      if (cardsContainerRef.current) cardsContainerRef.current.style.display = 'none';
      if (wallGroupRef.current) {
        wallGroupRef.current.style.transform = 'translateY(0%)';
        wallGroupRef.current.style.opacity = '1';
      }
      if (signContainerRef.current) {
        signContainerRef.current.style.transform = 'translateY(0%)';
        signContainerRef.current.style.opacity = '1';
      }
      if (bullContainerRef.current) {
        bullContainerRef.current.style.transform = 'translateX(0px)';
        bullContainerRef.current.style.opacity = '1';
      }
      if (bullSpriteRef.current) {
        gsap.set(bullSpriteRef.current, { x: 0, y: 0, rotation: 0, opacity: 1, scaleX: 1, scaleY: 1 });
      }

      targetRef.current = 0.62;
      shownRef.current = 0.62;
      damageLevelRef.current = 1;
      lastThresholdReachedRef.current = 0.62;
      isAnimatingRamRef.current = true;
      executeRam(0);
    } else if (stateKey === 'ram2') {
      gsap.killTweensOf([
        bullSpriteRef.current,
        wallSvgRef.current,
        signPlateGroupRef.current,
        postGroupRef.current,
        standingBullRef.current,
        containerRef.current,
      ]);
      isBrokenRef.current = false;
      setIsBroken(false);
      if (containerRef.current) gsap.set(containerRef.current, { backgroundColor: '#E8DFC9' });
      if (standingBullRef.current) gsap.set(standingBullRef.current, { y: 120, opacity: 0 });

      if (cracksRef.current[0]) gsap.set(cracksRef.current[0], { strokeDashoffset: 0, opacity: 1 });
      if (cracksRef.current[1]) gsap.set(cracksRef.current[1], { strokeDashoffset: 800, opacity: 0 });
      if (cracksRef.current[2]) gsap.set(cracksRef.current[2], { strokeDashoffset: 800, opacity: 0 });

      ALL_FRONT_BRICKS.forEach((_, idx) => {
        const el = frontBrickRefs.current[idx];
        if (el) gsap.set(el, { x: 0, y: 0, rotation: 0, opacity: 1 });
      });
      if (sideSlabRef.current) gsap.set(sideSlabRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
      if (struckBrick1Ref.current) gsap.set(struckBrick1Ref.current, { x: 6, y: 0, rotation: 0, opacity: 1 });
      if (struckBrick2Ref.current) gsap.set(struckBrick2Ref.current, { x: 6, y: 0, rotation: 0, opacity: 1 });
      if (topCapRef.current) gsap.set(topCapRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
      if (signPlateGroupRef.current) gsap.set(signPlateGroupRef.current, { x: 0, y: 0, rotation: 0 });
      if (postGroupRef.current) gsap.set(postGroupRef.current, { rotation: 0 });
      if (leftBoltRef.current) gsap.set(leftBoltRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 });

      if (cardsContainerRef.current) cardsContainerRef.current.style.display = 'none';
      if (wallGroupRef.current) {
        wallGroupRef.current.style.transform = 'translateY(0%)';
        wallGroupRef.current.style.opacity = '1';
      }
      if (signContainerRef.current) {
        signContainerRef.current.style.transform = 'translateY(0%)';
        signContainerRef.current.style.opacity = '1';
      }
      if (bullContainerRef.current) {
        bullContainerRef.current.style.transform = 'translateX(0px)';
        bullContainerRef.current.style.opacity = '1';
      }
      if (bullSpriteRef.current) {
        gsap.set(bullSpriteRef.current, { x: 0, y: 0, rotation: 0, opacity: 1, scaleX: 1, scaleY: 1 });
      }

      targetRef.current = 0.78;
      shownRef.current = 0.78;
      damageLevelRef.current = 2;
      lastThresholdReachedRef.current = 0.78;
      isAnimatingRamRef.current = true;
      executeRam(1);
    } else if (stateKey === 'ram3') {
      gsap.killTweensOf([
        bullSpriteRef.current,
        wallSvgRef.current,
        signPlateGroupRef.current,
        postGroupRef.current,
        standingBullRef.current,
        containerRef.current,
      ]);
      isBrokenRef.current = false;
      setIsBroken(false);
      if (containerRef.current) gsap.set(containerRef.current, { backgroundColor: '#E8DFC9' });
      if (standingBullRef.current) gsap.set(standingBullRef.current, { y: 120, opacity: 0 });

      if (cracksRef.current[0]) gsap.set(cracksRef.current[0], { strokeDashoffset: 0, opacity: 1 });
      if (cracksRef.current[1]) gsap.set(cracksRef.current[1], { strokeDashoffset: 0, opacity: 1 });
      if (cracksRef.current[2]) gsap.set(cracksRef.current[2], { strokeDashoffset: 800, opacity: 0 });

      ALL_FRONT_BRICKS.forEach((_, idx) => {
        const el = frontBrickRefs.current[idx];
        if (el) gsap.set(el, { x: 0, y: 0, rotation: 0, opacity: 1 });
      });
      if (frontBrickRefs.current[1]) gsap.set(frontBrickRefs.current[1], { y: 35, rotation: 8 });
      if (frontBrickRefs.current[2]) gsap.set(frontBrickRefs.current[2], { y: 48, rotation: -6 });
      if (frontBrickRefs.current[7]) gsap.set(frontBrickRefs.current[7], { y: 30, rotation: 10 });

      if (sideSlabRef.current) gsap.set(sideSlabRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
      if (struckBrick1Ref.current) gsap.set(struckBrick1Ref.current, { x: 12, y: 0, rotation: 0, opacity: 1 });
      if (struckBrick2Ref.current) gsap.set(struckBrick2Ref.current, { x: 12, y: 0, rotation: 0, opacity: 1 });
      if (topCapRef.current) gsap.set(topCapRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
      if (postGroupRef.current) gsap.set(postGroupRef.current, { rotation: -8, transformOrigin: '345px 84px' });
      if (signPlateGroupRef.current) gsap.set(signPlateGroupRef.current, { rotation: -6 });
      if (leftBoltRef.current) gsap.set(leftBoltRef.current, { opacity: 0 });

      if (cardsContainerRef.current) cardsContainerRef.current.style.display = 'none';
      if (wallGroupRef.current) {
        wallGroupRef.current.style.transform = 'translateY(0%)';
        wallGroupRef.current.style.opacity = '1';
      }
      if (signContainerRef.current) {
        signContainerRef.current.style.transform = 'translateY(0%)';
        signContainerRef.current.style.opacity = '1';
      }
      if (bullContainerRef.current) {
        bullContainerRef.current.style.transform = 'translateX(0px)';
        bullContainerRef.current.style.opacity = '1';
      }
      if (bullSpriteRef.current) {
        gsap.set(bullSpriteRef.current, { x: 0, y: 0, rotation: 0, opacity: 1, scaleX: 1, scaleY: 1 });
      }

      targetRef.current = 0.90;
      shownRef.current = 0.90;
      damageLevelRef.current = 3;
      lastThresholdReachedRef.current = 0.90;
      isAnimatingRamRef.current = true;
      executeRam(2);
    } else if (stateKey === 'breach') {
      gsap.killTweensOf([
        bullSpriteRef.current,
        wallSvgRef.current,
        signPlateGroupRef.current,
        postGroupRef.current,
        standingBullRef.current,
        containerRef.current,
      ]);
      isBrokenRef.current = false;
      setIsBroken(false);
      if (containerRef.current) gsap.set(containerRef.current, { backgroundColor: '#E8DFC9' });
      if (standingBullRef.current) gsap.set(standingBullRef.current, { y: 120, opacity: 0 });

      cracksRef.current.forEach((c) => c && gsap.set(c, { strokeDashoffset: 0, opacity: 1 }));
      ALL_FRONT_BRICKS.forEach((_, idx) => {
        const el = frontBrickRefs.current[idx];
        if (el) gsap.set(el, { x: 0, y: 0, rotation: 0, opacity: 1 });
      });
      if (sideSlabRef.current) gsap.set(sideSlabRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
      if (struckBrick1Ref.current) gsap.set(struckBrick1Ref.current, { x: 12, y: 0, rotation: 0, opacity: 1 });
      if (struckBrick2Ref.current) gsap.set(struckBrick2Ref.current, { x: 12, y: 0, rotation: 0, opacity: 1 });
      if (topCapRef.current) gsap.set(topCapRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 });
      if (signPlateGroupRef.current) gsap.set(signPlateGroupRef.current, { x: 0, y: 0, rotation: 0 });
      if (postGroupRef.current) gsap.set(postGroupRef.current, { rotation: 0 });
      if (leftBoltRef.current) gsap.set(leftBoltRef.current, { opacity: 0 });

      if (cardsContainerRef.current) cardsContainerRef.current.style.display = 'none';
      if (wallGroupRef.current) {
        wallGroupRef.current.style.transform = 'translateY(0%)';
        wallGroupRef.current.style.opacity = '1';
      }
      if (signContainerRef.current) {
        signContainerRef.current.style.transform = 'translateY(0%)';
        signContainerRef.current.style.opacity = '1';
      }
      if (bullContainerRef.current) {
        bullContainerRef.current.style.transform = 'translateX(0px)';
        bullContainerRef.current.style.opacity = '1';
      }
      if (bullSpriteRef.current) {
        gsap.set(bullSpriteRef.current, { x: 0, y: 0, rotation: 0, opacity: 1, scaleX: 1, scaleY: 1 });
      }

      targetRef.current = 1.0;
      shownRef.current = 1.0;
      damageLevelRef.current = 3;
      lastThresholdReachedRef.current = 1.0;
      executeBreach();
    }
    if (isDesktopViewport()) scheduleTickRef.current();
  }, [executeRam, executeBreach, handleRunItBack, instantReset, resetCards, hideWallScene, revealWallScene]);

  const handleDebugSlider = useCallback((val) => {
    if (val > 0.02) {
      revealWallScene();
    } else if (val <= 0.01 && !isBrokenRef.current) {
      hideWallScene();
    }
    if (isBrokenRef.current && val < 1.0) {
      isBrokenRef.current = false;
      setIsBroken(false);
      if (containerRef.current) gsap.set(containerRef.current, { backgroundColor: '#E8DFC9' });
      if (standingBullRef.current) gsap.set(standingBullRef.current, { y: 120, opacity: 0 });
      ALL_FRONT_BRICKS.forEach((_, idx) => {
        const el = frontBrickRefs.current[idx];
        if (el) gsap.set(el, { x: 0, y: 0, rotation: 0, opacity: 1 });
      });
      if (bullSpriteRef.current) gsap.set(bullSpriteRef.current, { x: 0, y: 0, rotation: 0, opacity: 1, scaleX: 1, scaleY: 1 });
    }
    targetRef.current = val;
    if (isDesktopViewport()) scheduleTickRef.current();
  }, [revealWallScene, hideWallScene]);

  const toggleSlowMo = useCallback(() => {
    setIsSlowMo((prev) => {
      const next = !prev;
      gsap.globalTimeline.timeScale(next ? 0.25 : 1);
      return next;
    });
  }, []);

  const toggleOutlines = useCallback(() => {
    setShowOutlines((prev) => !prev);
  }, []);

  useEffect(() => {
    return () => {
      gsap.globalTimeline.timeScale(1);
    };
  }, []);

  // -----------------------------------------------------------------------
  // 1. ENGINE ANIMATION FRAME LOOP (Decoupled Target vs Shown, Zero React State)
  // -----------------------------------------------------------------------
  useEffect(() => {
    const isDesktop = isDesktopViewport();
    let lastTime = performance.now();
    let animId = 0;
    let rafScheduled = false;
    let isDisposed = false;

    const scheduleTick = () => {
      if (isDisposed || rafScheduled) return;
      if (isDesktop && document.hidden) return;
      lastTime = performance.now();
      rafScheduled = true;
      animId = requestAnimationFrame(tick);
    };

    if (isDesktop) {
      scheduleTickRef.current = scheduleTick;
    } else {
      scheduleTickRef.current = () => {};
    }

    const tick = (now) => {
      rafScheduled = false;
      const prevTime = lastTime;
      lastTime = now;
      const dt = Math.min(0.1, Math.max(0, (now - prevTime) / 1000));

      // Hold progression: mobile drains on release; desktop Hold adds dt / HOLD_SECONDS with no drain
      if (!isBrokenRef.current) {
        if (!scrollDrivenRef.current) {
          if (isHoldingRef.current) {
            const effectiveStart = Math.max(prevTime, holdStartTimeRef.current);
            const holdDt = Math.min(0.1, Math.max(0, (now - effectiveStart) / 1000));
            targetRef.current = Math.min(1, targetRef.current + holdDt / HOLD_SECONDS);
          } else {
            // Release: drain slowly (0.12/s), but never below last ram threshold reached
            const minT = lastThresholdReachedRef.current;
            targetRef.current = Math.max(minT, targetRef.current - 0.12 * dt);
          }
        } else if (isHoldingRef.current) {
          const effectiveStart = Math.max(prevTime, holdStartTimeRef.current);
          const holdDt = Math.min(0.1, Math.max(0, (now - effectiveStart) / 1000));
          targetRef.current = Math.min(1, targetRef.current + holdDt / HOLD_SECONDS);
        }
      }

      // Shown follows target
      if (!isAnimatingRamRef.current && !isBrokenRef.current) {
        if (targetRef.current > shownRef.current) {
          // Check if crossing a RAM threshold
          const nextThresh = RAM_THRESHOLDS.find((t) => t > shownRef.current && t <= targetRef.current);
          if (nextThresh) {
            shownRef.current = nextThresh;
            lastThresholdReachedRef.current = nextThresh;
            const ramIdx = RAM_THRESHOLDS.indexOf(nextThresh);
            damageLevelRef.current = ramIdx + 1;
            executeRam(ramIdx);
          } else if (targetRef.current >= 0.999 && shownRef.current >= 0.90) {
            shownRef.current = 1.0;
            executeBreach();
          } else {
            shownRef.current = targetRef.current;
          }
        } else if (targetRef.current < shownRef.current) {
          // Desktop scrolling back: damageLevel goes down, fade cracks out in 300ms
          shownRef.current = targetRef.current;
          const passed = RAM_THRESHOLDS.filter((t) => shownRef.current >= t).length;
          if (passed < damageLevelRef.current) {
            for (let i = passed; i < damageLevelRef.current; i++) {
              const c = cracksRef.current[i];
              if (c) gsap.to(c, { opacity: 0, duration: 0.3 });
            }
            damageLevelRef.current = passed;
          }
        }
      }

      // DOM Updates (Zero React Re-render; GPU scaleX so iOS paints smoothly)
      const s = shownRef.current;
      if (s > 0.02) {
        revealWallScene();
      } else if (s <= 0.01 && !isBrokenRef.current && isWallSceneRevealedRef.current && !isHoldingRef.current) {
        hideWallScene();
      }
      if (progressBarFillRef.current) {
        progressBarFillRef.current.style.transform = `scaleX(${s})`;
      }
      if (buttonTextRef.current) {
        buttonTextRef.current.textContent = isHoldingRef.current
          ? `${CHARGE_COPY.mobileButton.chargingText} ${Math.round(s * 100)}%`
          : CHARGE_COPY.mobileButton.holdText;
      }

      // Slide away intro cards over progress (0 to 0.18)
      if (cardsContainerRef.current) {
        if (s < 0.18 && !isBrokenRef.current) {
          cardsContainerRef.current.style.display = 'block';
          cardsContainerRef.current.style.transform = `translateY(${-s * 480}px)`;
          cardsContainerRef.current.style.opacity = `${Math.max(0, 1 - s / 0.18)}`;
        } else {
          cardsContainerRef.current.style.display = 'none';
        }
      }

      // Wall and Bull rise / enter only after newspapers fade (0.18 to 0.35)
      if (!isBrokenRef.current) {
        const introT = Math.min(1, Math.max(0, (s - 0.18) / (0.35 - 0.18)));
        if (wallGroupRef.current) {
          wallGroupRef.current.style.transform = `translateY(${(1 - introT) * 105}%)`;
          wallGroupRef.current.style.opacity = s >= 0.18 ? '1' : '0';
        }
        if (signContainerRef.current) {
          signContainerRef.current.style.transform = `translateY(${(1 - introT) * 105}%)`;
          signContainerRef.current.style.opacity = s >= 0.18 ? '1' : '0';
        }
        if (bullContainerRef.current && !isAnimatingRamRef.current) {
          bullContainerRef.current.style.transform = `translateX(${(1 - introT) * -340}px)`;
          bullContainerRef.current.style.opacity = s >= 0.18 ? '1' : '0';
        }

        if (introT >= 1 && !hasTriggeredWallDustRef.current) {
          hasTriggeredWallDustRef.current = true;
          triggerDust(stageSizes.wallOuterLeftPx, stageSizes.groundY, 8);
        } else if (introT < 0.8) {
          hasTriggeredWallDustRef.current = false;
        }

        // Idle / pawing update when bull is at REST
        if (!isAnimatingRamRef.current) {
          if (introT >= 0.95) {
            setIdleMode(isHoldingRef.current ? 'pawing' : 'idle');
          } else {
            setIdleMode('none');
          }
        }
      } else {
        setIdleMode('none');
      }

      // Dynamic headline swap based on shown
      let targetH = CHARGE_COPY.beat1.heading;
      if (s >= 0.98 || isBrokenRef.current) {
        targetH = CHARGE_COPY.beat4.heading;
      } else if (s >= 0.28) {
        targetH = CHARGE_COPY.beat2.heading;
      }
      if (targetH !== headlineTargetRef.current) {
        headlineTargetRef.current = targetH;
        swapHeadline(targetH);
      }

      if (isDesktop) {
        const isDraining =
          !scrollDrivenRef.current &&
          !isBrokenRef.current &&
          !isHoldingRef.current &&
          targetRef.current > lastThresholdReachedRef.current + 0.0001;
        const isSettling =
          !isBrokenRef.current &&
          Math.abs(shownRef.current - targetRef.current) > 0.0001;
        const needsNext =
          !document.hidden &&
          (isHoldingRef.current || isAnimatingRamRef.current || isDraining || isSettling);
        if (needsNext) {
          scheduleTick();
        }
      } else {
        animId = requestAnimationFrame(tick);
      }
    };

    const handleVisibilityChange = () => {
      if (!isDesktop) return;
      if (document.hidden) {
        activePointerIdRef.current = null;
        isHoldingRef.current = false;
        if (rafScheduled) {
          cancelAnimationFrame(animId);
          rafScheduled = false;
        }
      } else {
        scheduleTick();
      }
    };

    if (isDesktop) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      scheduleTick();
    } else {
      animId = requestAnimationFrame(tick);
    }

    return () => {
      isDisposed = true;
      scheduleTickRef.current = () => {};
      cancelAnimationFrame(animId);
      if (isDesktop) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [executeRam, executeBreach, swapHeadline, revealWallScene, hideWallScene]);

  // Desktop ScrollTrigger Setup (pins section for +=350% scroll and maps to target)
  useEffect(() => {
    if (reducedMotion || window.innerWidth < 768) {
      scrollDrivenRef.current = false;
      desktopStRef.current = null;
      unlockScroll();
      return;
    }

    const ctx = gsap.context(() => {
      const container = containerRef.current;
      if (!container) return;

      const st = ScrollTrigger.create({
        trigger: container,
        start: 'top top',
        end: () => `+=${window.innerHeight * 3.5}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: 0.1,
        onUpdate: (self) => {
          if (isBrokenRef.current || isHoldingRef.current) return;
          targetRef.current = self.progress >= 0.985 ? 1 : self.progress;
          scheduleTickRef.current();
        },
        onLeave: () => {
          if (isBrokenRef.current) return;
          targetRef.current = 1;
          scheduleTickRef.current();
        },
      });

      desktopStRef.current = st;
      scrollDrivenRef.current = true;
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    }, containerRef);

    return () => {
      scrollDrivenRef.current = false;
      desktopStRef.current = null;
      unlockScroll();
      ctx.revert();
    };
  }, [reducedMotion, unlockScroll]);

  // Controls Handlers (pointer events only on touch/mouse)
  const startCharge = (pointerId) => {
    if (isBrokenRef.current || isAnimatingRamRef.current) return;
    if (pointerId !== undefined) {
      activePointerIdRef.current = pointerId;
    }
    holdStartTimeRef.current = performance.now();
    isHoldingRef.current = true;
    if (isDesktopViewport()) scheduleTickRef.current();
  };

  const stopCharge = (pointerId) => {
    if (
      pointerId !== undefined &&
      activePointerIdRef.current !== null &&
      activePointerIdRef.current !== pointerId
    ) {
      return;
    }
    activePointerIdRef.current = null;
    isHoldingRef.current = false;
    if (isDesktopViewport()) scheduleTickRef.current();
  };

  // Window blur safeguard
  useEffect(() => {
    const handleBlur = () => stopCharge();
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  // -----------------------------------------------------------------------
  // 9. REDUCED MOTION (4 static panels)
  // -----------------------------------------------------------------------
  if (reducedMotion) {
    return (
      <section
        data-charge-state="intro"
        className="charge-section relative z-30 w-full flex flex-col space-y-12 py-16 px-4 bg-[#E8DFC9] text-black pb-28 mt-10 md:mt-14 mb-0"
      >
        <div
          aria-hidden="true"
          className="absolute -bottom-[20px] md:-bottom-[24px] left-0 right-0 pointer-events-none z-30 overflow-visible select-none"
        >
          <svg
            viewBox="0 0 1200 24"
            preserveAspectRatio="none"
            className="w-full h-[20px] md:h-[24px] fill-[#E8DFC9] block"
          >
            <path d="M0,0 L1200,0 L1200,9 L1170,18 L1140,7 L1110,21 L1080,8 L1050,19 L1020,6 L990,22 L960,10 L930,20 L900,8 L870,23 L840,7 L810,18 L780,9 L750,22 L720,6 L690,19 L660,8 L630,21 L600,9 L570,23 L540,7 L510,19 L480,6 L450,21 L420,9 L390,22 L360,8 L330,18 L300,7 L270,21 L240,9 L210,23 L180,8 L150,20 L120,7 L90,19 L60,10 L30,22 L0,11 Z" />
          </svg>
        </div>
        <div className="max-w-3xl mx-auto border-3 border-black p-6 bg-[#FFFDF7] shadow-[6px_6px_0_#C97B1A]">
          <h2 className="font-anton text-3xl sm:text-4xl text-[#0E0D0C] mb-2 uppercase">
            {CHARGE_COPY.beat1.heading}
          </h2>
          <p className="font-plex text-xs text-black/70 mb-4 font-bold uppercase tracking-wider">
            {CHARGE_COPY.reducedMotion.introCaption}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {CHARGE_COPY.beat1.headlines.map((item, i) => (
              <div key={i} className="border-2 border-black p-3 bg-white relative overflow-hidden">
                <div className="text-[10px] font-plex text-black/50">{item.volume}</div>
                <div className="font-anton text-base text-[#C23B22]">{item.headline}</div>
                <div className="font-plex text-xs text-black/70 mt-1">{item.sub}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-center">
            <img src="/assets/bull-peek.webp" alt="Bull peeking over edge" width={700} height={262} className="w-48 object-contain" />
          </div>
        </div>

        <div className="max-w-3xl mx-auto border-3 border-black p-6 bg-[#FFFDF7] shadow-[6px_6px_0_#0E0D0C]">
          <div className="inline-block bg-[#0E0D0C] text-white px-3 py-1 font-plex text-xs font-bold mb-3 border border-black">
            {CHARGE_COPY.beat2.sign}
          </div>
          <h2 className="font-anton text-3xl sm:text-4xl text-[#0E0D0C] mb-2 uppercase">
            {CHARGE_COPY.beat2.heading}
          </h2>
          <p className="font-plex text-xs text-black/70 mb-4 font-bold uppercase tracking-wider">
            {CHARGE_COPY.reducedMotion.wallCaption}
          </p>
          <img src="/assets/bull-charge.webp" alt="Bull facing wall" width={900} height={600} className="w-full max-w-md mx-auto object-contain" />
        </div>

        <div className="max-w-3xl mx-auto border-3 border-black p-6 bg-[#C23B22]/10 shadow-[6px_6px_0_#C23B22]">
          <h2 className="font-anton text-3xl sm:text-4xl text-[#0E0D0C] mb-2 uppercase">
            {UI_COPY.charge.impactHeading}
          </h2>
          <p className="font-plex text-xs text-black/70 mb-4 font-bold uppercase tracking-wider">
            {CHARGE_COPY.reducedMotion.crackedCaption}
          </p>
          <div className="relative flex justify-center py-4">
            <img src="/assets/bull-charge.webp" alt="Bull ramming the wall" width={900} height={600} className="w-full max-w-sm object-contain" />
          </div>
        </div>

        <div className="max-w-3xl mx-auto border-3 border-[#C97B1A] p-6 bg-[#0E0D0C] text-[#E8DFC9] shadow-[6px_6px_0_#F2B24A]">
          <h2 className="font-anton text-3xl sm:text-4xl text-[#F2B24A] mb-2 uppercase">
            {CHARGE_COPY.beat4.heading}
          </h2>
          <p className="font-plex text-xs text-[#E8DFC9]/70 mb-2 font-bold uppercase tracking-wider">
            {CHARGE_COPY.reducedMotion.breachedCaption}
          </p>
          <p className="font-plex text-sm text-[#E8DFC9]/80 mb-6">
            {CHARGE_COPY.beat4.subheading}
          </p>
          <div className="relative flex justify-center">
            <img src="/assets/bull-standing.webp" alt="Bull standing in suit" width={700} height={1050} className="max-h-[50vh] object-contain" />
            <div className="absolute top-4 right-8 bg-[#E8DFC9] text-black font-plex text-xs font-bold px-3 py-2 border-2 border-black shadow-[3px_3px_0_#C97B1A]">
              "{CHARGE_COPY.beat4.bullLine}"
            </div>
          </div>
        </div>
      </section>
    );
  }

  // -----------------------------------------------------------------------
  // STANDARD INTERACTIVE SEQUENCE (CSS Grid 3 rows: headline, stage, controls)
  // -----------------------------------------------------------------------
  return (
    <section
      ref={containerRef}
      data-charge-state={isBroken ? 'broken' : 'intro'}
      className="charge-section min-h-screen relative z-30 w-full select-none mt-10 md:mt-14 mb-0"
      style={{
        overflowX: 'clip',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 'clamp(24px, 7vh, 72px)',
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: '0px',
        backgroundColor: '#E8DFC9',
      }}
    >
      {/* Torn-paper edge overlapping bottom of hero */}
      <div
        ref={tornEdgeRef}
        className="absolute -top-[28px] md:-top-[40px] left-0 right-0 pointer-events-none z-30 overflow-visible select-none"
      >
        <svg
          viewBox="0 0 1200 40"
          preserveAspectRatio="none"
          className="w-full h-[28px] md:h-[40px] fill-[#E8DFC9] block drop-shadow-[0_-4px_6px_rgba(0,0,0,0.6)]"
        >
          <path d="M0,40 L0,16 L30,6 L60,18 L90,8 L120,22 L150,6 L180,18 L210,4 L240,20 L270,8 L300,24 L330,6 L360,18 L390,4 L420,22 L450,10 L480,25 L510,7 L540,19 L570,5 L600,22 L630,8 L660,24 L690,6 L720,20 L750,4 L780,22 L810,9 L840,25 L870,7 L900,19 L930,5 L960,22 L990,8 L1020,24 L1050,6 L1080,20 L1110,5 L1140,22 L1170,8 L1200,16 L1200,40 Z" />
        </svg>
      </div>

      {/* Halftone & film grain strictly bounded to Charge section edge (fade cleanly when broken) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 halftone-overlay pointer-events-none"
          style={{
            opacity: isBroken ? 0 : 0.3,
            transition: reducedMotion ? 'none' : 'opacity 400ms ease-in-out',
          }}
        />
        <div
          className="comic-grain-local pointer-events-none"
          style={{
            opacity: isBroken ? 0 : 0.04,
            transition: reducedMotion ? 'none' : 'opacity 400ms ease-in-out',
          }}
        />
      </div>

      {/* Viewport-safe inner frame bounded by 100svh so controls remain visible */}
      <div
        className="charge-inner-frame w-full flex flex-col items-center justify-start min-h-[480px]"
        style={{
          height: 'calc(100svh - clamp(24px, 7svh, 72px) - var(--ticker-h, 40px))',
          maxHeight: '100%',
        }}
      >

      {/* ============================================================= */}
      {/* 1. HEADLINE ROW (Anton, centered, min-height reserved)        */}
      {/* ============================================================= */}
      <div
        className="charge-headline-row w-full max-w-4xl mx-auto flex items-center justify-center text-center px-4 z-20 pointer-events-none shrink-0 mb-1"
        style={{ minHeight: 'clamp(54px, 14vw, 105px)', height: 'clamp(54px, 14vw, 105px)' }}
      >
        <h2
          ref={headlineElRef}
          className="font-anton uppercase text-center transition-opacity duration-150"
          style={{
            fontSize: 'clamp(24px, 6.8vw, 48px)',
            lineHeight: 1.04,
            opacity: headlineOpacity,
            color: isBroken ? '#E8DFC9' : '#0E0D0C',
            transformOrigin: '50% 50%',
          }}
        >
          {displayedHeadline}
        </h2>
      </div>

      {/* ============================================================= */}
      {/* 2. STAGE ROW (The play area: max-width 900px, ResizeObserver)  */}
      {/* ============================================================= */}
      <div
        ref={stageRef}
        className="charge-stage-row relative w-full max-w-[900px] mx-auto overflow-hidden flex-1 flex items-center justify-center z-20"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '900px',
          marginInline: 'auto',
          outline: isDebug && showOutlines ? '2px dashed #F2B24A' : undefined,
          outlineOffset: isDebug && showOutlines ? '-2px' : undefined,
        }}
      >
        {/* Screen Shake / Rumble Container */}
        <div
          ref={rumbleRef}
          className="rumble-wrapper relative w-full h-full flex items-center justify-center overflow-hidden"
        >
          {/* ----------------------------------------------------------- */}
          {/* INTRO: NEWSPAPERS STACK & PEEK BULL (Top 18% empty for bull)*/}
          {/* ----------------------------------------------------------- */}
          <div
            ref={cardsContainerRef}
            className="newspaper-stage-container absolute inset-x-0 mx-auto flex justify-center z-25 pointer-events-none"
            style={{
              top: '18%',
              width: 'min(calc(100% - 32px), 520px)',
              height: 'calc(100% - 18% - 20px)',
              maxHeight: '440px',
            }}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {/* 4 Newspaper Cards */}
              {CHARGE_COPY.beat1.headlines.map((item, idx) => {
                const isTop = idx === topIdx;

                return (
                  <div
                    key={idx}
                    ref={(el) => (cardWrappersRef.current[idx] = el)}
                    className="news-card-wrapper absolute inset-0 pointer-events-none"
                    style={{
                      transform: `rotate(${CARD_ROTATIONS[idx]}deg) translateY(${CARD_Y_OFFSETS[idx]}px)`,
                      zIndex: CARD_Z_INDICES[idx],
                    }}
                  >
                    {/* Bull-peek anchored inside bottom paper (index 0) behind its top edge */}
                    {idx === 0 && (
                      <div
                        className="bull-peek-anchor pointer-events-none"
                        style={{
                          position: 'absolute',
                          left: '64%',
                          top: 0,
                          width: 'min(56%, calc(var(--sh, 400px) * 0.46))',
                          transform: 'translate(-50%, calc(-100% + 6px))',
                          zIndex: -1,
                          overflow: 'visible',
                        }}
                      >
                        <div
                          ref={peekBullRef}
                          className="bull-peek-sprite w-full"
                          style={{ opacity: 0 }}
                        >
                          <img
                            src="/assets/bull-peek.webp"
                            alt="Bull peeking from behind newspaper"
                            width={700}
                            height={262}
                            className="w-full object-contain"
                          />
                        </div>
                      </div>
                    )}

                    <div
                      ref={(el) => (newsPagesRef.current[idx] = el)}
                      role={isTop ? 'button' : undefined}
                      tabIndex={isTop ? 0 : -1}
                      aria-label={isTop ? CHARGE_COPY.beat1.tossAria : undefined}
                      onClick={isTop ? () => handleToss(idx) : undefined}
                      onKeyDown={
                        isTop
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleToss(idx);
                              }
                            }
                          : undefined
                      }
                      className={`news-card-item w-full h-full bg-[#FFFDF7] border-3 border-black p-3.5 sm:p-5 shadow-[4px_4px_0_#0E0D0C] flex flex-col justify-between overflow-hidden select-none ${
                        isTop
                          ? 'pointer-events-auto cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C97B1A]'
                          : 'pointer-events-none'
                      }`}
                      style={{ opacity: 0 }}
                    >
                      <div className="border-b-2 border-black pb-1 mb-1 text-center shrink-0">
                        <div className="font-anton text-lg sm:text-2xl tracking-wider text-black leading-tight">
                          {CHARGE_COPY.beat1.masthead}
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-plex text-black/60 border-t border-black/30 mt-0.5 pt-0.5">
                          <span className="truncate">{CHARGE_COPY.beat1.subtitle}</span>
                          <span className="font-bold text-[#C23B22] shrink-0 ml-1">
                            {CHARGE_COPY.beat1.caption}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-plex text-black/60 mb-1 shrink-0 whitespace-nowrap overflow-hidden">
                        <span className="truncate mr-2">{item.volume}</span>
                        <span className="shrink-0 font-bold">{UI_COPY.charge.paperPrice}</span>
                      </div>

                      <div className="font-anton text-[17px] sm:text-2xl text-black uppercase leading-tight mb-1 shrink-0">
                        {item.headline}
                      </div>

                      <div className="font-plex text-[11px] sm:text-xs text-black/75 leading-snug shrink-0">
                        {item.sub}
                      </div>

                      <div className="mt-auto h-9 sm:h-11 flex justify-between items-end relative shrink-0">
                        {isTop && !hasTossed && (
                          <div className="news-toss-hint font-plex text-[9px] sm:text-[10px] text-black/60 uppercase tracking-wider animate-pulse pointer-events-none select-none pb-0.5">
                            {CHARGE_COPY.beat1.tapToToss}
                          </div>
                        )}
                        <div
                          ref={(el) => (stampsRef.current[idx] = el)}
                          className="news-stamp-item border-2 sm:border-3 border-[#C23B22] bg-[#FFFDF7]/95 px-2.5 py-0.5 text-center shadow-[0_0_0_1px_#000] pointer-events-none ml-auto whitespace-nowrap"
                          style={{
                            transform: 'rotate(-8deg)',
                            opacity: 0,
                          }}
                        >
                          <div className="font-anton text-xs sm:text-sm text-[#C23B22] uppercase tracking-wide leading-tight whitespace-nowrap">
                            {item.stamp}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* WALL SCENE GROUP                                          */}
          {/* (Ground strip, wall, sign, bull & dust)                   */}
          {/* Hidden during newspaper intro, revealed on charge         */}
          {/* ========================================================= */}
          <div
            ref={wallSceneGroupRef}
            className="wall-scene-layers absolute inset-0 pointer-events-none"
            style={{
              visibility: 'hidden',
              opacity: 0,
            }}
          >
            {/* Ground Strip at 94% stage height with 3px ink line */}
            <div
              ref={groundStripRef}
              className="absolute left-0 right-0 bottom-0 pointer-events-none z-10"
              style={{
                top: `${stageSizes.groundY}px`,
                backgroundColor: isBroken ? '#151311' : '#C7B99D',
                borderTop: '3px solid #2A1510',
                transform: 'translateY(100%)',
              }}
            />

          {/* ----------------------------------------------------------- */}
          {/* 3. THE 3D BRICK WALL & STREET SIGN (One inline SVG)         */}
          {/* ----------------------------------------------------------- */}
          <div
            ref={wallGroupRef}
            className="wall-container absolute pointer-events-none z-15"
            style={{
              left: `${stageSizes.wallSvgLeft}px`,
              top: `${stageSizes.wallSvgTop}px`,
              width: `${600 * stageSizes.wallScale}px`,
              height: `${700 * stageSizes.wallScale}px`,
              willChange: 'transform',
            }}
          >
            <svg
              ref={wallSvgRef}
              viewBox="0 0 600 700"
              preserveAspectRatio="xMidYMax meet"
              className="w-full h-full overflow-visible"
            >
              {/* Ground Shadow: flat dark parallelogram to right of wall, 20% opacity */}
              <polygon
                points="130,660 560,660 620,680 190,680"
                fill="#0E0D0C"
                opacity="0.20"
              />

              {/* Top Cap (Stone coping): (122,100) (568,100) (478,68) (32,68) */}
              <g ref={topCapRef}>
                <polygon
                  points="122,100 568,100 478,68 32,68"
                  fill="#CFC5AE"
                  stroke="#2A1510"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                {/* 14-unit thick lighter stone band on front edge */}
                <polygon
                  points="122,100 568,100 568,114 122,114"
                  fill="#DDD5C0"
                  stroke="#2A1510"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
              </g>

              {/* Left Side Face: (130,100) (130,660) (40,628) (40,68) */}
              {/* Side Slab Piece (Rows 0-3 and 6-10) */}
              <g ref={sideSlabRef}>
                {/* Dark mortar background */}
                <polygon
                  points="130,100 130,660 40,628 40,68"
                  fill="#2A1510"
                />
                {/* Side rows except struck rows 4 and 5 */}
                {[0, 1, 2, 3, 6, 7, 8, 9, 10].map((r) => {
                  const yTopL = 68 + r * ROW_H;
                  const yTopR = 100 + r * ROW_H;
                  const yBotL = 68 + (r + 1) * ROW_H - 1.5;
                  const yBotR = 100 + (r + 1) * ROW_H - 1.5;
                  const fill = r % 2 === 0 ? '#7A2C19' : '#6A2616';
                  return (
                    <polygon
                      key={r}
                      points={`40,${yTopL} 130,${yTopR} 130,${yBotR} 40,${yBotL}`}
                      fill={fill}
                      stroke="#2A1510"
                      strokeWidth="2.5"
                    />
                  );
                })}
              </g>

              {/* 2 Struck Side Brick Pieces (Rows 4 and 5) */}
              <polygon
                ref={struckBrick1Ref}
                points={`40,${68 + 4 * ROW_H} 130,${100 + 4 * ROW_H} 130,${100 + 5 * ROW_H - 1.5} 40,${68 + 5 * ROW_H - 1.5}`}
                fill="#7A2C19"
                stroke="#2A1510"
                strokeWidth="3"
              />
              <polygon
                ref={struckBrick2Ref}
                points={`40,${68 + 5 * ROW_H} 130,${100 + 5 * ROW_H} 130,${100 + 6 * ROW_H - 1.5} 40,${68 + 6 * ROW_H - 1.5}`}
                fill="#6A2616"
                stroke="#2A1510"
                strokeWidth="3"
              />

              {/* Front Face: rectangle x 130 to 560, y 100 to 660 (49 bricks) */}
              <g className="wall-front-bricks">
                {ALL_FRONT_BRICKS.map((b) => (
                  <rect
                    key={b.id}
                    ref={(el) => (frontBrickRefs.current[b.id] = el)}
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    fill={b.fill}
                    stroke="#2A1510"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                ))}
              </g>

              {/* Debug outline around wall's front face */}
              {isDebug && showOutlines && (
                <rect
                  x="130"
                  y="100"
                  width="430"
                  height="560"
                  fill="none"
                  stroke="#2FD27A"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  className="pointer-events-none"
                />
              )}

              {/* 3 Levels of Dark Ink Cracks */}
              <g className="wall-crack-layers pointer-events-none">
                {/* Level 1: 3 short lines */}
                <path
                  ref={(el) => (cracksRef.current[0] = el)}
                  d="M 40,320 L 72,310 L 98,335 L 130,325 M 72,310 L 88,280 M 98,335 L 118,370"
                  fill="none"
                  stroke="#2A1510"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="800"
                  style={{ strokeDashoffset: 800, opacity: 0 }}
                />

                {/* Level 2: longer branches reaching middle of front face */}
                <path
                  ref={(el) => (cracksRef.current[1] = el)}
                  d="M 130,325 L 175,310 L 225,335 L 280,305 L 340,330 M 225,335 L 255,390 L 305,410 M 175,310 L 205,250 L 255,230"
                  fill="none"
                  stroke="#2A1510"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="800"
                  style={{ strokeDashoffset: 800, opacity: 0 }}
                />

                {/* Level 3: branches reaching top and far edge */}
                <path
                  ref={(el) => (cracksRef.current[2] = el)}
                  d="M 340,330 L 405,300 L 470,320 L 560,300 M 405,300 L 435,210 L 472,130 L 485,68 M 255,230 L 305,150 L 335,100 M 305,410 L 375,470 L 450,510 L 515,590"
                  fill="none"
                  stroke="#2A1510"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="800"
                  style={{ strokeDashoffset: 800, opacity: 0 }}
                />
              </g>
            </svg>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* 5. THE BULL SPRITE, SHADOW & EFFECTS                        */}
          {/* ----------------------------------------------------------- */}
          <div
            ref={bullContainerRef}
            className="bull-character-container absolute pointer-events-none z-18"
            style={{
              left: `${stageSizes.bullRestLeft}px`,
              top: `${stageSizes.bullTop}px`,
              width: `${stageSizes.bullWidth}px`,
              height: `${stageSizes.bullHeight}px`,
              willChange: 'transform',
            }}
          >
            {/* Flat dark ellipse shadow under bull */}
            <div
              ref={bullShadowRef}
              className="bull-ground-shadow absolute left-1/2 -translate-x-1/2 bottom-0 w-[70%] h-3.5 bg-[#0E0D0C] rounded-full opacity-25 pointer-events-none"
            />

            {/* 3 Flat horizontal speed lines behind him during dash */}
            <div
              ref={speedLinesRef}
              className="absolute left-[-50px] top-1/2 -translate-y-1/2 flex flex-col gap-2.5 opacity-0 pointer-events-none"
            >
              <div className="w-8 h-[3px] bg-[#E8DFC9] border-t border-b border-[#2A1510]" />
              <div className="w-12 h-[3px] bg-[#E8DFC9] border-t border-b border-[#2A1510] -ml-2" />
              <div className="w-7 h-[3px] bg-[#E8DFC9] border-t border-b border-[#2A1510]" />
            </div>

            {/* Bull character sprite */}
            <div
              ref={bullSpriteRef}
              className="bull-sprite-wrapper w-full h-full relative"
              style={{ willChange: 'transform' }}
            >
              <img
                src="/assets/bull-charge.webp"
                alt="Bull charging into wall"
                width={900}
                height={600}
                className="w-full h-full object-contain"
              />

              {/* Debug outlines: bull opaque bounding box and contact point dot */}
              {isDebug && showOutlines && (
                <>
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${(opaqueBoundsRef.current.minX / opaqueBoundsRef.current.w) * 100}%`,
                      top: `${(opaqueBoundsRef.current.minY / opaqueBoundsRef.current.h) * 100}%`,
                      width: `${(opaqueBoundsRef.current.opaqueW / opaqueBoundsRef.current.w) * 100}%`,
                      height: `${(opaqueBoundsRef.current.opaqueH / opaqueBoundsRef.current.h) * 100}%`,
                      outline: '2px solid #C23B22',
                      outlineOffset: '-1px',
                      zIndex: 45,
                    }}
                  />
                  <div
                    className="absolute pointer-events-none w-2.5 h-2.5 rounded-full bg-[#C23B22] border-2 border-[#FFFDF7] -translate-x-1/2 -translate-y-1/2 z-50 shadow-[0_0_4px_#000]"
                    style={{
                      left: `${(opaqueBoundsRef.current.maxX / opaqueBoundsRef.current.w) * 100}%`,
                      top: `${(opaqueBoundsRef.current.minY / opaqueBoundsRef.current.h + (opaqueBoundsRef.current.opaqueH / opaqueBoundsRef.current.h) * opaqueBoundsRef.current.contactYRel) * 100}%`,
                    }}
                  />
                </>
              )}
            </div>

            {/* 8-Point Starburst on impact */}
            <div
              ref={starburstRef}
              className="absolute pointer-events-none opacity-0 z-30"
              style={{
                right: '-18px',
                top: `${stageSizes.contactPointY - stageSizes.bullTop - 25}px`,
                width: '50px',
                height: '50px',
              }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <polygon
                  points="50,4 58,32 83,17 68,42 96,50 68,58 83,83 58,68 50,96 42,68 17,83 32,58 4,50 32,42 17,17 42,32"
                  fill="#E8DFC9"
                  stroke="#2A1510"
                  strokeWidth="3.5"
                />
              </svg>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* 4. THE WALL ST. SIGN (z-index: 22, in front of bull z-18)   */}
          {/* ----------------------------------------------------------- */}
          <div
            ref={signContainerRef}
            className="sign-container absolute pointer-events-none z-22"
            style={{
              left: `${stageSizes.wallSvgLeft}px`,
              top: `${stageSizes.wallSvgTop}px`,
              width: `${600 * stageSizes.wallScale}px`,
              height: `${700 * stageSizes.wallScale}px`,
              willChange: 'transform',
            }}
          >
            <svg
              viewBox="0 0 600 700"
              preserveAspectRatio="xMidYMax meet"
              className="w-full h-full overflow-visible"
            >
              <g ref={postGroupRef} style={{ willChange: 'transform' }}>
                {/* Short steel post rising from top cap at x = 345, y = 84 */}
                <rect
                  x="339"
                  y={84 - stageSizes.postHeightViewBox}
                  width="12"
                  height={stageSizes.postHeightViewBox}
                  fill="#8E8B84"
                  stroke="#2A1510"
                  strokeWidth="3"
                />
                <circle cx="345" cy="84" r="6" fill="#8E8B84" stroke="#2A1510" strokeWidth="2.5" />

                {/* Blade-style street sign plate */}
                <g ref={signPlateGroupRef} style={{ willChange: 'transform' }}>
                  {/* Red offset shadow behind plate */}
                  <rect
                    x={345 - 537.5 / 2 + 5}
                    y={84 - stageSizes.postHeightViewBox - 182.75 + 5}
                    width="537.5"
                    height="182.75"
                    rx="4"
                    fill="#C23B22"
                  />

                  {/* Ink black plate */}
                  <rect
                    x={345 - 537.5 / 2}
                    y={84 - stageSizes.postHeightViewBox - 182.75}
                    width="537.5"
                    height="182.75"
                    rx="4"
                    fill="#0E0D0C"
                    stroke="#2A1510"
                    strokeWidth="3.5"
                  />

                  {/* Thin cream inner border line */}
                  <rect
                    x={345 - 537.5 / 2 + 8}
                    y={84 - stageSizes.postHeightViewBox - 182.75 + 8}
                    width="521.5"
                    height="166.75"
                    rx="2"
                    fill="none"
                    stroke="#E8DFC9"
                    strokeWidth="2"
                  />

                  {/* Debug outline around sign plate */}
                  {isDebug && showOutlines && (
                    <rect
                      x={345 - 537.5 / 2}
                      y={84 - stageSizes.postHeightViewBox - 182.75}
                      width="537.5"
                      height="182.75"
                      rx="4"
                      fill="none"
                      stroke="#C97B1A"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                      className="pointer-events-none"
                    />
                  )}

                  {/* Text: WALL ST. in Anton, cream #E8DFC9 */}
                  <text
                    x="345"
                    y={84 - stageSizes.postHeightViewBox - 182.75 / 2 + 36}
                    textAnchor="middle"
                    fill="#E8DFC9"
                    fontFamily="Anton, sans-serif"
                    fontSize="108"
                    letterSpacing="0.06em"
                    className="select-none font-bold"
                  >
                    {CHARGE_COPY.beat2.sign}
                  </text>

                  {/* Left Bolt (pops off at Ram 2) */}
                  <g ref={leftBoltRef}>
                    <circle
                      cx={345 - 537.5 / 2 + 30}
                      cy={84 - stageSizes.postHeightViewBox - 182.75 / 2}
                      r="7.5"
                      fill="#8E8B84"
                      stroke="#2A1510"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx={345 - 537.5 / 2 + 30}
                      cy={84 - stageSizes.postHeightViewBox - 182.75 / 2}
                      r="2"
                      fill="#2A1510"
                    />
                  </g>

                  {/* Right Bolt */}
                  <circle
                    cx={345 + 537.5 / 2 - 30}
                    cy={84 - stageSizes.postHeightViewBox - 182.75 / 2}
                    r="7.5"
                    fill="#8E8B84"
                    stroke="#2A1510"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx={345 + 537.5 / 2 - 30}
                    cy={84 - stageSizes.postHeightViewBox - 182.75 / 2}
                    r="2"
                    fill="#2A1510"
                  />
                </g>
              </g>
            </svg>
          </div>

          {/* Dust squares flying on impact */}
          {dustPuffs.map((puff) => (
            <div
              key={puff.id}
              className="absolute pointer-events-none z-30"
              style={{
                left: `${puff.x}px`,
                top: `${puff.y}px`,
                width: `${puff.size}px`,
                height: `${puff.size}px`,
                backgroundColor: puff.color,
                border: '1.5px solid #2A1510',
                transform: `translate(${puff.dx}px, ${puff.dy}px)`,
                transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.4, 1)',
                opacity: 0.85,
              }}
            />
          ))}
          </div>

          {/* ----------------------------------------------------------- */}
          {/* 7. CLOSING SCENE: Standing Bull & Destination Reached       */}
          {/* ----------------------------------------------------------- */}
          <div
            className="breach-stage absolute inset-0 z-30 pointer-events-none p-3 flex flex-col items-center justify-between"
            style={{ visibility: isBroken ? 'visible' : 'hidden' }}
          >
            {/* 1) Text block at the top (flex none), centred: subheading 16px (sm: 20px) bold, line-height 1.25 */}
            <div className="flex-none text-center px-2 z-20">
              <p className="font-plex text-[16px] sm:text-[20px] text-[#C97B1A] font-bold leading-[1.25]">
                {CHARGE_COPY.beat4.subheading}
              </p>
            </div>

            {/* 2) Bull area (flex 1, min-height 0, position relative, flex column, align-items center, justify-content flex-end) */}
            <div ref={bullAreaRef} className="flex-1 min-h-0 w-full relative flex flex-col items-center justify-end">
              {/* 4) WALL ST. sign lies on the ground to the right of the bull, bbox bottom 2px above ground line (bottom: 4px), >=12px right of shoe, rotated -10deg */}
              <div
                className="absolute z-0 pointer-events-none transition-opacity duration-200"
                style={{
                  bottom: '4px',
                  left: `${signLayout.left}px`,
                  transform: 'rotate(-10deg)',
                  transformOrigin: 'bottom left',
                  width: `${signLayout.width}px`,
                  opacity: signLayout.visible ? 1 : 0,
                }}
              >
                <svg
                  viewBox="0 0 545 190"
                  className="w-full h-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] block"
                >
                  <rect x="5" y="5" width="537.5" height="182.75" rx="4" fill="#C23B22" />
                  <rect x="0" y="0" width="537.5" height="182.75" rx="4" fill="#0E0D0C" stroke="#2A1510" strokeWidth="3.5" />
                  <rect x="8" y="8" width="521.5" height="166.75" rx="2" fill="none" stroke="#E8DFC9" strokeWidth="2" />
                  <text
                    x="268.75"
                    y="128"
                    textAnchor="middle"
                    fill="#E8DFC9"
                    fontFamily="Anton, sans-serif"
                    fontSize="108"
                    letterSpacing="0.06em"
                    className="select-none font-bold"
                  >
                    {CHARGE_COPY.beat2.sign}
                  </text>
                </svg>
              </div>

              {/* Speech bubble: normal element ABOVE bull inside column (not absolute). Centred, max-width 200px, tail pointing DOWN at top of head, 10px gap above head */}
              <div
                ref={speechBubbleRef}
                className="bull-speech-bubble relative z-20 bg-[#E8DFC9] text-black font-plex font-bold text-xs sm:text-sm px-3.5 py-1.5 border-2 sm:border-3 border-black shadow-[4px_4px_0_#C97B1A] max-w-[200px] mb-[10px] text-center shrink-0"
                style={{ opacity: 0, transform: 'scale(0.7)', transformOrigin: 'bottom center' }}
              >
                "{CHARGE_COPY.beat4.bullLine}"
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-t-[8px] border-t-black border-r-[6px] border-r-transparent" />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-t-[7px] border-t-[#E8DFC9] border-r-[5px] border-r-transparent" />
              </div>

              {/* Bull image below it: height fills remaining space, min 200px, max 380px, width auto, object-fit contain, feet on ground line */}
              <img
                ref={standingBullRef}
                src="/assets/bull-standing.webp"
                alt="Bull in suit standing proud, brushing dust off lapel"
                width={700}
                height={1050}
                onLoad={updateSignLayout}
                className="flex-1 min-h-[160px] sm:min-h-[200px] max-h-[380px] w-auto object-contain object-bottom drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)] z-10"
                style={{ transform: 'translateY(120px)', opacity: 0 }}
              />

              {/* 3) Ground line: 2px line (bronze #C97B1A at 40% opacity) at bottom of bull area */}
              <div className="w-full h-[2px] bg-[#C97B1A]/40 shrink-0 z-10" />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* 3. CONTROLS ROW: Hold button, flat progress bar, 72px gutter  */}
      {/* ============================================================= */}
      <div
        className="charge-controls-row w-full max-w-[420px] mx-auto px-4 flex flex-col items-center z-30 select-none shrink-0"
        style={{
          paddingBottom: '72px', // Free bottom gutter so floating sound button never overlaps
        }}
      >
        {/* HOLD BUTTON & PROGRESS BAR (visible when not broken) */}
        <div
          className={`w-full flex flex-col items-center ${isBroken ? 'hidden' : 'flex'}`}
        >
          {/* HOLD TO CHARGE BUTTON */}
          <button
            ref={holdButtonRef}
            type="button"
            tabIndex={0}
            aria-label={UI_COPY.charge.holdAria}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch (_) {}
              startCharge(e.pointerId);
            }}
            onPointerUp={(e) => {
              try {
                if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch (_) {}
              stopCharge(e.pointerId);
            }}
            onPointerCancel={(e) => {
              try {
                if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch (_) {}
              stopCharge(e.pointerId);
            }}
            onLostPointerCapture={(e) => {
              stopCharge(e.pointerId);
            }}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault();
                startCharge();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                stopCharge();
              }
            }}
            className="w-full py-3 sm:py-3.5 px-6 font-anton text-lg sm:text-xl tracking-wider uppercase border-3 border-black shadow-[4px_4px_0_#0E0D0C] bg-[#C97B1A] hover:bg-[#d88720] active:bg-[#F2B24A] text-black transition-colors cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2"
            style={{
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span ref={buttonTextRef}>{CHARGE_COPY.mobileButton.holdText}</span>
          </button>

          {/* Flat progress bar: dark track, flat bronze fill (NO gradient), 3 red ticks */}
          <div
            className="w-full h-3 bg-[#0E0D0C] border-2 border-black mt-2.5 relative overflow-hidden"
            role="progressbar"
            aria-label={UI_COPY.charge.progressAria}
          >
            {/* Flat bronze fill animated strictly via transform scaleX for iOS GPU painting */}
            <div
              ref={progressBarFillRef}
              className="w-full h-full bg-[#C97B1A]"
              style={{
                transformOrigin: 'left center',
                transform: 'scaleX(0)',
                willChange: 'transform',
              }}
            />

            {/* 3 Red ticks at RAM_THRESHOLDS (62%, 78%, 90%) */}
            {RAM_THRESHOLDS.map((thresh) => (
              <div
                key={thresh}
                className="absolute top-0 bottom-0 w-0.5 bg-[#C23B22] z-10 pointer-events-none"
                style={{ left: `${thresh * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* RUN IT BACK BUTTON (visible when broken) */}
        <div
          className={`w-full flex flex-col items-center mt-[18px] ${isBroken ? 'flex' : 'hidden'}`}
        >
          {/* B. RUN IT BACK BUTTON: compact pill */}
          <button
            type="button"
            onClick={handleRunItBack}
            aria-label={CHARGE_COPY.runItBack}
            className="min-h-[44px] min-w-[44px] px-4 py-2 inline-flex items-center justify-center rounded-full font-plex text-[12px] uppercase tracking-wider text-[#F2B24A] bg-transparent border-2 border-[#C97B1A] shadow-[3px_3px_0_rgba(201,123,26,0.45)] hover:bg-[#C97B1A] hover:text-black active:translate-x-[2px] active:translate-y-[2px] active:shadow-[3px_3px_0_rgba(201,123,26,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] cursor-pointer transition-colors"
          >
            ↺ {CHARGE_COPY.runItBack}
          </button>
        </div>
      </div>
      </div>

      {/* DEBUG PANEL: mounts strictly when ?debug=charge is present in URL */}
      {isDebug && (
        <ChargeDebugPanel
          targetRef={targetRef}
          shownRef={shownRef}
          damageLevelRef={damageLevelRef}
          getStateName={getStateName}
          onJump={handleDebugJump}
          onSliderChange={handleDebugSlider}
          isSlowMo={isSlowMo}
          toggleSlowMo={toggleSlowMo}
          showOutlines={showOutlines}
          toggleOutlines={toggleOutlines}
        />
      )}

      {/* Torn-paper edge hanging over .charge-desk-bridge when "intro" (fades cleanly to nothing on "broken") */}
      <div
        aria-hidden="true"
        className="charge-bottom-torn-edge absolute -bottom-[20px] md:-bottom-[24px] left-0 right-0 pointer-events-none z-30 overflow-visible select-none"
        style={{
          opacity: isBroken ? 0 : 1,
          transition: reducedMotion ? 'none' : 'opacity 400ms ease-in-out',
        }}
      >
        <svg
          viewBox="0 0 1200 24"
          preserveAspectRatio="none"
          className="w-full h-[20px] md:h-[24px] fill-[#E8DFC9] block"
        >
          <path d="M0,0 L1200,0 L1200,9 L1170,18 L1140,7 L1110,21 L1080,8 L1050,19 L1020,6 L990,22 L960,10 L930,20 L900,8 L870,23 L840,7 L810,18 L780,9 L750,22 L720,6 L690,19 L660,8 L630,21 L600,9 L570,23 L540,7 L510,19 L480,6 L450,21 L420,9 L390,22 L360,8 L330,18 L300,7 L270,21 L240,9 L210,23 L180,8 L150,20 L120,7 L90,19 L60,10 L30,22 L0,11 Z" />
        </svg>
      </div>
    </section>
  );
};

// =========================================================================
// CHARGE DEBUG PANEL COMPONENT
// =========================================================================
const ChargeDebugPanel = ({
  targetRef,
  shownRef,
  damageLevelRef,
  getStateName,
  onJump,
  onSliderChange,
  isSlowMo,
  toggleSlowMo,
  showOutlines,
  toggleOutlines,
}) => {
  const [isHidden, setIsHidden] = useState(false);
  const [stats, setStats] = useState({
    target: 0,
    shown: 0,
    damageLevel: 0,
    state: 'intro',
  });

  useEffect(() => {
    const update = () => {
      setStats({
        target: targetRef.current,
        shown: shownRef.current,
        damageLevel: damageLevelRef.current,
        state: getStateName(),
      });
    };
    update();
    const interval = setInterval(update, 50);
    return () => clearInterval(interval);
  }, [targetRef, shownRef, damageLevelRef, getStateName]);

  if (isHidden) {
    return (
      <button
        type="button"
        onClick={() => setIsHidden(false)}
        aria-label="Show Charge Debug Panel"
        className="fixed top-2 left-2 z-[99999] px-2.5 py-1 bg-[#0E0D0C]/95 text-[#E8DFC9] border border-[#C97B1A] font-mono text-[10px] uppercase font-bold shadow-[2px_2px_0_#000] cursor-pointer hover:bg-[#C97B1A] hover:text-black transition-colors"
      >
        ⚙ Debug
      </button>
    );
  }

  return (
    <div
      className="fixed top-2 left-2 z-[99999] w-64 max-w-[calc(100vw-16px)] bg-[#0E0D0C]/95 text-[#E8DFC9] border-2 border-[#C97B1A] font-mono text-xs p-3 shadow-[4px_4px_0_#000] backdrop-blur-sm select-none"
      style={{ maxHeight: 'calc(100svh - 16px)', overflowY: 'auto' }}
    >
      {/* Header with Hide button */}
      <div className="flex items-center justify-between border-b border-[#C97B1A]/40 pb-1.5 mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#2FD27A] animate-pulse" />
          <span className="font-bold text-[#F2B24A] text-[11px] tracking-wider uppercase">
            Charge Debug
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsHidden(true)}
          className="text-[10px] bg-[#2A1510] text-[#E8DFC9] px-2 py-0.5 border border-[#C97B1A]/60 hover:bg-[#C97B1A] hover:text-black cursor-pointer uppercase transition-colors"
        >
          Hide
        </button>
      </div>

      {/* Live Values */}
      <div className="bg-[#151311] border border-[#2A1510] p-2 mb-2.5">
        <div className="text-[10px] text-[#C97B1A] uppercase font-bold tracking-wider mb-1 border-b border-[#2A1510] pb-0.5">
          Live Values
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
          <span className="text-[#8E8B84]">target:</span>
          <span className="text-[#E8DFC9] font-bold text-right">{stats.target.toFixed(3)}</span>
          <span className="text-[#8E8B84]">shown:</span>
          <span className="text-[#E8DFC9] font-bold text-right">{stats.shown.toFixed(3)}</span>
          <span className="text-[#8E8B84]">damageLevel:</span>
          <span className="text-[#E8DFC9] font-bold text-right">{stats.damageLevel}</span>
          <span className="text-[#8E8B84]">state:</span>
          <span className="text-[#2FD27A] font-bold text-right uppercase">{stats.state}</span>
        </div>
      </div>

      {/* Target Slider */}
      <div className="mb-2.5">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-[#8E8B84]">Target Slider:</span>
          <span className="text-[#F2B24A] font-bold">{stats.target.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={stats.target}
          onChange={(e) => onSliderChange(parseFloat(e.target.value))}
          className="w-full accent-[#C97B1A] cursor-pointer"
        />
      </div>

      {/* Jump Buttons */}
      <div className="mb-2.5">
        <div className="text-[10px] text-[#C97B1A] uppercase font-bold tracking-wider mb-1">
          Jump States
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <button
            type="button"
            onClick={() => onJump('intro')}
            className="px-2 py-1 bg-[#1A1816] hover:bg-[#C97B1A] hover:text-black text-[#E8DFC9] border border-[#C97B1A]/50 transition-colors cursor-pointer uppercase font-bold text-center"
          >
            Intro
          </button>
          <button
            type="button"
            onClick={() => onJump('ram1')}
            className="px-2 py-1 bg-[#1A1816] hover:bg-[#C97B1A] hover:text-black text-[#E8DFC9] border border-[#C97B1A]/50 transition-colors cursor-pointer uppercase font-bold text-center"
          >
            Ram 1
          </button>
          <button
            type="button"
            onClick={() => onJump('ram2')}
            className="px-2 py-1 bg-[#1A1816] hover:bg-[#C97B1A] hover:text-black text-[#E8DFC9] border border-[#C97B1A]/50 transition-colors cursor-pointer uppercase font-bold text-center"
          >
            Ram 2
          </button>
          <button
            type="button"
            onClick={() => onJump('ram3')}
            className="px-2 py-1 bg-[#1A1816] hover:bg-[#C97B1A] hover:text-black text-[#E8DFC9] border border-[#C97B1A]/50 transition-colors cursor-pointer uppercase font-bold text-center"
          >
            Ram 3
          </button>
          <button
            type="button"
            onClick={() => onJump('breach')}
            className="px-2 py-1 bg-[#1A1816] hover:bg-[#C97B1A] hover:text-black text-[#E8DFC9] border border-[#C97B1A]/50 transition-colors cursor-pointer uppercase font-bold text-center"
          >
            Breach
          </button>
          <button
            type="button"
            onClick={() => onJump('run_it_back')}
            className="px-2 py-1 bg-[#1A1816] hover:bg-[#C97B1A] hover:text-black text-[#E8DFC9] border border-[#C97B1A]/50 transition-colors cursor-pointer uppercase font-bold text-center"
          >
            Run it back
          </button>
          <button
            type="button"
            onClick={() => onJump('reset')}
            className="col-span-2 px-2 py-1 bg-[#2A1510] hover:bg-[#C23B22] text-[#E8DFC9] hover:text-white border border-[#C23B22] transition-colors cursor-pointer uppercase font-bold text-center"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-2 gap-1 text-[10px] pt-1.5 border-t border-[#C97B1A]/40">
        <button
          type="button"
          onClick={toggleSlowMo}
          className={`px-2 py-1 border transition-colors cursor-pointer font-bold uppercase text-center ${
            isSlowMo
              ? 'bg-[#C97B1A] text-black border-[#F2B24A]'
              : 'bg-[#1A1816] text-[#E8DFC9] border-[#C97B1A]/50 hover:bg-[#2A2622]'
          }`}
        >
          Slow x0.25: {isSlowMo ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          onClick={toggleOutlines}
          className={`px-2 py-1 border transition-colors cursor-pointer font-bold uppercase text-center ${
            showOutlines
              ? 'bg-[#2FD27A] text-black border-[#2FD27A]'
              : 'bg-[#1A1816] text-[#E8DFC9] border-[#C97B1A]/50 hover:bg-[#2A2622]'
          }`}
        >
          Outlines: {showOutlines ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
};
