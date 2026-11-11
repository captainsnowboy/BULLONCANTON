import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CHARGE_COPY } from '../copy.js';
import { playImpactThud } from '../utils/audio';
import { ArrowDown } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

// =========================================================================
// 1. ENGINE CONSTANTS (Tunable as specified in prompt)
// =========================================================================
export const HOLD_SECONDS = 5;
export const RAM_THRESHOLDS = [0.62, 0.78, 0.90];
export const BREACH = 1;
export const BRICK_CAP = 60;

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

  // Intro Newspaper elements
  const cardsContainerRef = useRef(null);
  const newsPagesRef = useRef([]);
  const stampsRef = useRef([]);
  const peekBullRef = useRef(null);

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
  const standingBullRef = useRef(null);
  const speechBubbleRef = useRef(null);
  const scrollArrowRef = useRef(null);

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

  // -----------------------------------------------------------------------
  // 1. ENGINE REFS (NO React re-renders per frame)
  // -----------------------------------------------------------------------
  const targetRef = useRef(0);
  const shownRef = useRef(0);
  const damageLevelRef = useRef(0);
  const isAnimatingRamRef = useRef(false);
  const isHoldingRef = useRef(false);
  const isBrokenRef = useRef(false);
  const lastThresholdReachedRef = useRef(0);
  const desktopStRef = useRef(null);
  const introStartedRef = useRef(false);
  const headlineTargetRef = useRef(CHARGE_COPY.beat1.heading);
  const isSwappingHeadlineRef = useRef(false);

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
    img.src = '/assets/bull-charge.png';
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

  // Measure ticker real height and set --ticker-h
  useEffect(() => {
    const updateTickerH = () => {
      const ticker = document.querySelector('aside[aria-label="Market Ticker"]');
      const h = ticker ? ticker.getBoundingClientRect().height : 36;
      if (containerRef.current) {
        containerRef.current.style.setProperty('--ticker-h', `${h}px`);
      }
    };
    updateTickerH();
    window.addEventListener('resize', updateTickerH);
    return () => window.removeEventListener('resize', updateTickerH);
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

  // ResizeObserver on Stage
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const sw = Math.round(width);
        const sh = Math.round(height);
        stageEl.style.setProperty('--sw', `${sw}px`);
        stageEl.style.setProperty('--sh', `${sh}px`);
        setStageSizes(computeSizes(sw, sh));
      }
    });

    ro.observe(stageEl);
    return () => ro.disconnect();
  }, [computeSizes]);

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
        clearProps: 'x,y',
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

  // Bull-peek idling every 4 to 6 seconds
  useEffect(() => {
    if (!peekReady || shownRef.current > 0.05 || !peekBullRef.current) return;

    let timeoutId;
    const triggerIdle = () => {
      const delay = 4000 + Math.random() * 2000;
      timeoutId = setTimeout(() => {
        if (!peekBullRef.current || shownRef.current > 0.05) return;
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
    return () => clearTimeout(timeoutId);
  }, [peekReady]);

  // -----------------------------------------------------------------------
  // 6. THE RAM ANIMATION (Damage Levels 1, 2, 3) (~1.3s total)
  // -----------------------------------------------------------------------
  const executeRam = useCallback(
    (ramIdx) => {
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
          setIdleMode(isHoldingRef.current ? 'pawing' : 'idle');
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
    [stageSizes, triggerShake, triggerDust]
  );

  // -----------------------------------------------------------------------
  // 7. BREACH ANIMATION (Target = 1.0)
  // -----------------------------------------------------------------------
  const executeBreach = useCallback(() => {
    isAnimatingRamRef.current = true;
    isBrokenRef.current = true;
    setIsBroken(true);
    setIdleMode('none');

    const bull = bullSpriteRef.current;
    const signGroup = signPlateGroupRef.current;
    const { sw, wallOuterLeftPx, contactPointRestX, contactPointY } = stageSizes;
    const dashThroughDistance = wallOuterLeftPx - contactPointRestX + 220;

    const tl = gsap.timeline();

    // Dash through the wall
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

    // Sign falls, bounces twice, lies at -15deg
    if (signGroup) {
      tl.to(
        signGroup,
        {
          keyframes: [
            { y: 380, x: 60, rotation: -25, duration: 0.45, ease: 'power2.in' },
            { y: 350, x: 80, rotation: -10, duration: 0.15, ease: 'power1.out' },
            { y: 380, x: 90, rotation: -15, duration: 0.18, ease: 'bounce.out' },
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

    // Closing scene takeover: background newsprint to ink black
    tl.to(
      containerRef.current,
      {
        backgroundColor: '#0E0D0C',
        duration: 0.6,
        ease: 'power2.inOut',
      },
      '+=0.1'
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

    tl.to(
      scrollArrowRef.current,
      {
        opacity: 0.85,
        duration: 0.25,
      },
      '+=0.05'
    );

    tl.add(() => {
      isAnimatingRamRef.current = false;
    });
  }, [stageSizes, triggerShake, triggerDust]);

  // -----------------------------------------------------------------------
  // 8. RUN IT BACK (Rebuild in 800ms)
  // -----------------------------------------------------------------------
  const handleRunItBack = useCallback(() => {
    if (isAnimatingRamRef.current) return;
    isAnimatingRamRef.current = true;
    setIdleMode('none');

    const tl = gsap.timeline({
      onComplete: () => {
        isBrokenRef.current = false;
        setIsBroken(false);
        targetRef.current = 0;
        shownRef.current = 0;
        damageLevelRef.current = 0;
        lastThresholdReachedRef.current = 0;
        isAnimatingRamRef.current = false;
        setPeekReady(true);
        hasTriggeredWallDustRef.current = false;

        // Reset progress bar & button text directly
        if (progressBarFillRef.current) progressBarFillRef.current.style.width = '0%';
        if (buttonTextRef.current) buttonTextRef.current.textContent = `⚡ ${CHARGE_COPY.mobileButton.holdText}`;

        // Desktop: smooth-scroll to start of pinned section
        if (desktopStRef.current) {
          window.scrollTo({
            top: desktopStRef.current.start || 0,
            behavior: 'smooth',
          });
        }
      },
    });

    // Rebuild bricks
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

    // Reset background to newsprint
    if (containerRef.current) {
      tl.to(containerRef.current, { backgroundColor: '#E8DFC9', duration: 0.6 }, 0);
    }
  }, []);

  // -----------------------------------------------------------------------
  // 1. ENGINE ANIMATION FRAME LOOP (Decoupled Target vs Shown, Zero React State)
  // -----------------------------------------------------------------------
  useEffect(() => {
    let lastTime = performance.now();
    let animId;

    const tick = (now) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      // Mobile hold progression
      if (!isBrokenRef.current) {
        if (isHoldingRef.current) {
          targetRef.current = Math.min(1, targetRef.current + dt / HOLD_SECONDS);
        } else {
          // Release: drain slowly (0.12/s), but never below last ram threshold reached
          const minT = lastThresholdReachedRef.current;
          targetRef.current = Math.max(minT, targetRef.current - 0.12 * dt);
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
          } else if (targetRef.current >= 1.0 && shownRef.current >= 0.90) {
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

      // DOM Updates (Zero React Re-render!)
      const s = shownRef.current;
      if (progressBarFillRef.current) {
        progressBarFillRef.current.style.width = `${s * 100}%`;
      }
      if (buttonTextRef.current) {
        buttonTextRef.current.textContent = isHoldingRef.current
          ? `⚡ ${CHARGE_COPY.mobileButton.chargingText} ${Math.round(s * 100)}%`
          : `⚡ ${CHARGE_COPY.mobileButton.holdText}`;
      }

      // Slide away intro cards over progress (0 to 0.28)
      if (cardsContainerRef.current) {
        if (s < 0.28 && !isBrokenRef.current) {
          cardsContainerRef.current.style.display = 'block';
          cardsContainerRef.current.style.transform = `translateY(${-s * 480}px)`;
          cardsContainerRef.current.style.opacity = `${Math.max(0, 1 - s / 0.20)}`;
        } else {
          cardsContainerRef.current.style.display = 'none';
        }
      }

      // Wall and Bull rise / enter from 0 to 0.35
      if (!isBrokenRef.current) {
        const introT = Math.min(1, Math.max(0, s / 0.35));
        if (wallGroupRef.current) {
          wallGroupRef.current.style.transform = `translateY(${(1 - introT) * 105}%)`;
          wallGroupRef.current.style.opacity = introT > 0.05 ? '1' : '0';
        }
        if (signContainerRef.current) {
          signContainerRef.current.style.transform = `translateY(${(1 - introT) * 105}%)`;
          signContainerRef.current.style.opacity = introT > 0.05 ? '1' : '0';
        }
        if (bullContainerRef.current && !isAnimatingRamRef.current) {
          bullContainerRef.current.style.transform = `translateX(${(1 - introT) * -340}px)`;
          bullContainerRef.current.style.opacity = introT > 0.05 ? '1' : '0';
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

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [executeRam, executeBreach, swapHeadline]);

  // Desktop ScrollTrigger Setup (pins section for +=350% scroll and maps to target)
  useEffect(() => {
    if (reducedMotion || window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      const container = containerRef.current;
      if (!container) return;

      const st = ScrollTrigger.create({
        trigger: container,
        start: 'top top',
        end: () => `+=${window.innerHeight * 3.5}`,
        pin: true,
        scrub: 0.1,
        onUpdate: (self) => {
          if (!isHoldingRef.current) {
            targetRef.current = self.progress;
          }
        },
      });

      desktopStRef.current = st;
    }, containerRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  // Controls Handlers
  const startCharge = () => {
    if (isBrokenRef.current || isAnimatingRamRef.current) return;
    isHoldingRef.current = true;
  };

  const stopCharge = () => {
    isHoldingRef.current = false;
  };

  // Window blur safeguard
  useEffect(() => {
    window.addEventListener('blur', stopCharge);
    return () => window.removeEventListener('blur', stopCharge);
  }, []);

  // -----------------------------------------------------------------------
  // 9. REDUCED MOTION (4 static panels)
  // -----------------------------------------------------------------------
  if (reducedMotion) {
    return (
      <section className="w-full flex flex-col space-y-12 py-16 px-4 bg-[#E8DFC9] text-black pb-28">
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
            <img src="/assets/bull-peek.png" alt="Bull peeking over edge" width={800} height={800} className="w-48 object-contain" />
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
          <img src="/assets/bull-charge.png" alt="Bull facing wall" width={1200} height={1200} className="w-full max-w-md mx-auto object-contain" />
        </div>

        <div className="max-w-3xl mx-auto border-3 border-black p-6 bg-[#C23B22]/10 shadow-[6px_6px_0_#C23B22]">
          <h2 className="font-anton text-3xl sm:text-4xl text-[#0E0D0C] mb-2 uppercase">
            THE IMPACT
          </h2>
          <p className="font-plex text-xs text-black/70 mb-4 font-bold uppercase tracking-wider">
            {CHARGE_COPY.reducedMotion.crackedCaption}
          </p>
          <div className="relative flex justify-center py-4">
            <img src="/assets/bull-charge.png" alt="Bull ramming the wall" width={1200} height={1200} className="w-full max-w-sm object-contain" />
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
            <img src="/assets/bull-standing.png" alt="Bull standing in suit" width={1200} height={1600} className="max-h-[50vh] object-contain" />
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
      className="charge-section relative w-full select-none"
      style={{
        height: 'calc(100dvh - var(--ticker-h, 0px))',
        minHeight: '560px',
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
      <div className="absolute -top-7 sm:-top-8 left-0 right-0 pointer-events-none z-30 overflow-visible select-none">
        <svg
          viewBox="0 0 1200 36"
          preserveAspectRatio="none"
          className="w-full h-8 sm:h-9 fill-[#E8DFC9] block drop-shadow-[0_-4px_6px_rgba(0,0,0,0.6)]"
        >
          <path d="M0,36 L0,18 Q15,8 30,20 Q45,28 60,14 Q75,6 90,18 Q105,26 120,12 Q135,4 150,18 Q165,26 180,12 Q195,6 210,22 Q225,28 240,12 Q255,4 270,18 Q285,26 300,12 Q315,6 330,20 Q345,28 360,12 Q375,4 390,22 Q405,28 420,12 Q435,6 450,18 Q465,26 480,12 Q495,4 510,22 Q525,28 540,12 Q555,6 570,18 Q585,26 600,12 Q615,4 630,22 Q645,28 660,12 Q675,6 690,18 Q705,26 720,12 Q735,4 750,22 Q765,28 780,12 Q795,6 810,18 Q825,26 840,12 Q855,4 870,22 Q885,28 900,12 Q915,6 930,18 Q945,26 960,12 Q975,4 990,22 Q1005,28 1020,12 Q1035,6 1050,18 Q1065,26 1080,12 Q1095,4 1110,22 Q1125,28 1140,12 Q1155,6 1170,18 Q1185,26 1200,12 L1200,36 Z" />
        </svg>
      </div>

      {/* Halftone texture overlay */}
      <div className="absolute inset-0 halftone-overlay opacity-30 pointer-events-none" />

      {/* ============================================================= */}
      {/* 1. HEADLINE ROW (Anton, centered, min-height 2.1em reserved)   */}
      {/* ============================================================= */}
      <div
        className="charge-headline-row w-full max-w-4xl mx-auto flex items-center justify-center text-center px-4 z-20 pointer-events-none shrink-0 mb-1"
        style={{ minHeight: '2.1em' }}
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
        }}
      >
        {/* Screen Shake / Rumble Container */}
        <div
          ref={rumbleRef}
          className="rumble-wrapper relative w-full h-full flex items-center justify-center overflow-hidden"
        >
          {/* Ground Strip at 94% stage height with 3px ink line */}
          <div
            ref={groundStripRef}
            className="absolute left-0 right-0 bottom-0 pointer-events-none z-10"
            style={{
              top: `${stageSizes.groundY}px`,
              backgroundColor: isBroken ? '#151311' : '#C7B99D',
              borderTop: '3px solid #2A1510',
            }}
          />

          {/* ----------------------------------------------------------- */}
          {/* INTRO: NEWSPAPERS STACK & PEEK BULL (Top 18% empty for bull)*/}
          {/* ----------------------------------------------------------- */}
          <div
            ref={cardsContainerRef}
            className="newspaper-stage-container absolute inset-x-0 mx-auto flex justify-center z-25 pointer-events-none"
            style={{
              top: '18%',
              width: 'min(calc(100% - 32px), 520px)',
              height: 'min(82%, calc(var(--sh, 400px) * 0.82))',
            }}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Bull-peek behind top card */}
              <div
                className="bull-peek-anchor absolute pointer-events-none"
                style={{
                  left: '64%',
                  width: '30%',
                  top: 0,
                  transform: 'translate(-50%, -55%)',
                  zIndex: 5,
                  overflow: 'visible',
                }}
              >
                <div
                  ref={peekBullRef}
                  className="bull-peek-sprite w-full"
                  style={{ transform: 'translateY(100%)', opacity: 0 }}
                >
                  <img
                    src="/assets/bull-peek.png"
                    alt="Bull peeking from behind newspaper"
                    width={800}
                    height={800}
                    className="w-full object-contain"
                  />
                </div>
              </div>

              {/* 4 Newspaper Cards */}
              {CHARGE_COPY.beat1.headlines.map((item, idx) => {
                const rotations = [-1.8, 1.5, -1.0, 0.5];
                const yOffsets = [-12, -8, -4, 0];
                const zIndices = [1, 2, 3, 10];

                return (
                  <div
                    key={idx}
                    className="news-card-wrapper absolute inset-0 pointer-events-none"
                    style={{
                      transform: `rotate(${rotations[idx]}deg) translateY(${yOffsets[idx]}px)`,
                      zIndex: zIndices[idx],
                    }}
                  >
                    <div
                      ref={(el) => (newsPagesRef.current[idx] = el)}
                      className="news-card-item w-full h-full bg-[#FFFDF7] border-3 border-black p-3.5 sm:p-5 shadow-[4px_4px_0_#0E0D0C] flex flex-col justify-between overflow-hidden"
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
                        <span className="shrink-0 font-bold">PRICE: 2 SATOSHIS</span>
                      </div>

                      <div className="font-anton text-lg sm:text-2xl text-black uppercase leading-tight line-clamp-2 mb-1 shrink-0">
                        {item.headline}
                      </div>

                      <div className="font-plex text-[11px] sm:text-xs text-black/75 line-clamp-2 leading-snug shrink-0">
                        {item.sub}
                      </div>

                      <div className="mt-auto h-11 sm:h-12 flex justify-end items-end relative shrink-0">
                        <div
                          ref={(el) => (stampsRef.current[idx] = el)}
                          className="news-stamp-item border-2 sm:border-3 border-[#C23B22] bg-[#FFFDF7]/95 px-2.5 py-0.5 text-center shadow-[0_0_0_1px_#000] pointer-events-none"
                          style={{
                            maxWidth: '45%',
                            transform: 'rotate(-8deg)',
                            opacity: 0,
                          }}
                        >
                          <div className="font-anton text-xs sm:text-sm text-[#C23B22] uppercase tracking-wide leading-tight">
                            ★ REDACTED ★
                          </div>
                          <div className="text-[8px] font-plex text-[#C23B22] tracking-widest uppercase font-bold">
                            VERDICT
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
                src="/assets/bull-charge.png"
                alt="Bull charging into wall"
                width={1200}
                height={1200}
                className="w-full h-full object-contain"
              />
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
                    WALL ST.
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

          {/* ----------------------------------------------------------- */}
          {/* 7. CLOSING SCENE: Standing Bull & Destination Reached       */}
          {/* ----------------------------------------------------------- */}
          {isBroken && (
            <div className="breach-stage absolute inset-0 flex flex-col items-center justify-center p-4 z-30 pointer-events-none">
              <div className="text-center max-w-xl mb-2 px-2">
                <span className="font-plex text-xs tracking-widest text-[#F2B24A] font-bold uppercase">
                  CANTON NETWORK // DESTINATION REACHED
                </span>
                <p className="font-plex text-xs sm:text-sm text-[#C97B1A] font-bold mt-1">
                  {CHARGE_COPY.beat4.subheading}
                </p>
              </div>

              {/* Standing Bull in suit */}
              <div className="relative flex justify-center items-end" style={{ maxHeight: '38vh' }}>
                <img
                  ref={standingBullRef}
                  src="/assets/bull-standing.png"
                  alt="Bull in suit standing proud, brushing dust off lapel"
                  width={1200}
                  height={1600}
                  loading="lazy"
                  className="max-h-[34vh] sm:max-h-[38vh] object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)]"
                  style={{ transform: 'translateY(120px)', opacity: 0 }}
                />

                {/* Deadpan Speech Bubble: "Took you long enough." */}
                <div
                  ref={speechBubbleRef}
                  className="bull-speech-bubble absolute -top-3 -right-2 sm:-right-12 bg-[#E8DFC9] text-black font-plex font-bold text-xs sm:text-sm px-3.5 py-1.5 border-2 sm:border-3 border-black shadow-[4px_4px_0_#C97B1A] max-w-[180px]"
                  style={{ opacity: 0, transform: 'scale(0.7)' }}
                >
                  "{CHARGE_COPY.beat4.bullLine}"
                  <div className="absolute -bottom-2.5 left-4 w-0 h-0 border-l-[5px] border-l-transparent border-t-[5px] border-t-[#E8DFC9] border-r-[5px] border-r-transparent" />
                </div>
              </div>

              {/* Scroll down prompt */}
              <div
                ref={scrollArrowRef}
                className="scroll-down-prompt flex flex-col items-center gap-1 mt-2 opacity-0"
              >
                <span className="font-plex text-[9px] tracking-widest text-[#E8DFC9]/75 uppercase">
                  {CHARGE_COPY.beat4.scrollPrompt}
                </span>
                <ArrowDown className="w-3.5 h-3.5 text-[#F2B24A] animate-bounce" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================= */}
      {/* 3. CONTROLS ROW: Hold button, flat progress bar, 72px gutter  */}
      {/* ============================================================= */}
      <div
        className="charge-controls-row w-full max-w-[420px] mx-auto px-4 flex flex-col items-center z-30 select-none"
        style={{
          paddingBottom: '72px', // Free bottom gutter so floating sound button never overlaps
        }}
      >
        {!isBroken ? (
          <>
            {/* HOLD TO CHARGE BUTTON */}
            <button
              ref={holdButtonRef}
              type="button"
              tabIndex={0}
              aria-label="Hold to charge through the wall"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                startCharge();
              }}
              onPointerUp={(e) => {
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch (_) {}
                stopCharge();
              }}
              onPointerCancel={(e) => {
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch (_) {}
                stopCharge();
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
                WebkitTouchCallout: 'none',
              }}
            >
              <span ref={buttonTextRef}>⚡ {CHARGE_COPY.mobileButton.holdText}</span>
            </button>

            {/* Flat progress bar: dark track, flat bronze fill (NO gradient), 3 red ticks */}
            <div
              className="w-full h-3 bg-[#0E0D0C] border-2 border-black mt-2.5 relative overflow-hidden"
              role="progressbar"
              aria-label="Charge Progress"
            >
              {/* Flat bronze fill */}
              <div
                ref={progressBarFillRef}
                className="h-full bg-[#C97B1A]"
                style={{ width: '0%' }}
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
          </>
        ) : (
          /* RUN IT BACK button when breached */
          <button
            type="button"
            onClick={handleRunItBack}
            className="px-6 py-3 bg-[#C97B1A] hover:bg-[#F2B24A] text-black border-3 border-black font-anton text-lg tracking-wider uppercase shadow-[4px_4px_0_#000] active:scale-95 cursor-pointer transition-transform"
          >
            ↺ {CHARGE_COPY.runItBack}
          </button>
        )}
      </div>
    </section>
  );
};
