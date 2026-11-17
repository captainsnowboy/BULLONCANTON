import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { OFFICE_COPY } from '../copy.js';
import { COIN_TEXT } from '../config.js';
import { playCoinClink, playSwitchClick } from '../utils/audio';
import { MonitorScreen } from '../components/MonitorScreen';
import { HornCursor } from '../components/HornCursor';
import { MetalCoinSvg } from '../components/MetalCoin';
import { Arrivals } from './Arrivals';
import { isDesktopViewport } from '../utils/desktop';

gsap.registerPlugin(ScrollTrigger);

export const END_FILL_MOBILE = 0.88;
export const END_FILL_DESKTOP = 0.55;

const LAMP = {
  deskW: 1231,
  deskH: 920,
  xToUnit: 12.31,
  yToUnit: 9.2,
  darkFill: 'var(--ink)',
  fadeMs: 400,
  holes: {
    shade: { cxPct: 19.5, cyPct: 19.6, rxPct: 5.4, ryPct: 3.1, fillOpacity: 1, blur: 5 },
    pool: { cxPct: 25.7, cyPct: 58.5, rxPct: 17, ryPct: 7.5, fillOpacity: 0.88, blur: 40 },
    spill: { cxPct: 25, cyPct: 60, rxPct: 32, ryPct: 14, fillOpacity: 0.14, blur: 90 },
    base: { cxPct: 12.5, cyPct: 48, rxPct: 5, ryPct: 2.6, fillOpacity: 0.4, blur: 14 },
  },
  beam: {
    pointsPct: [
      [14.3, 20.6],
      [24.7, 20],
      [37, 57.5],
      [12.5, 58.5],
    ],
    topColor: 'rgba(255, 226, 170, 0.34)',
    bottomColor: 'rgba(255, 214, 150, 0.05)',
    blur: 14,
    rays: [
      { nearXPct: 16.2, nearYPct: 20.5, farLeftPct: 14.2, farRightPct: 16.4, farYPct: 58 },
      { nearXPct: 17.8, nearYPct: 20.4, farLeftPct: 18.8, farRightPct: 21.2, farYPct: 58 },
      { nearXPct: 19.5, nearYPct: 20.3, farLeftPct: 24.0, farRightPct: 26.8, farYPct: 58 },
      { nearXPct: 21.2, nearYPct: 20.2, farLeftPct: 29.0, farRightPct: 31.6, farYPct: 57.8 },
      { nearXPct: 22.8, nearYPct: 20.1, farLeftPct: 33.8, farRightPct: 36.0, farYPct: 57.6 },
    ],
    rayTopColor: 'rgba(255, 236, 190, 0.12)',
    rayBottomColor: 'rgba(255, 236, 190, 0.06)',
    rayBlur: 3,
  },
  bulb: {
    cxPct: 19.5,
    cyPct: 17.9,
    rPct: 6.5,
    coreRPct: 0.9,
  },
  warmPool: {
    cxPct: 25.7,
    cyPct: 58.5,
    rxPct: 17,
    ryPct: 7.5,
    centerColor: 'rgba(255, 200, 115, 0.26)',
    edgeColor: 'rgba(255, 200, 115, 0)',
  },
  contactShadows: [
    { cxPct: 26.2, cyPct: 56.8, rxPct: 5.8, ryPct: 1.8, opacity: 0.32 },
    { cxPct: 30.2, cyPct: 60.6, rxPct: 6.8, ryPct: 1.8, opacity: 0.28 },
    { cxPct: 31.2, cyPct: 56.2, rxPct: 3.2, ryPct: 1.5, opacity: 0.36 },
  ],
  switchPos: {
    cxPct: 11.8,
    cyPct: 48.2,
    widthPct: 2.4,
    touchPx: 44,
  },
  coin: {
    cxPct: 30,
    cyPct: 55,
    widthPct: 13,
    rotateDeg: -8,
    scaleY: 0.74,
    inspectWidthPct: 46,
    inspectMs: 1800,
    flipMs: 500,
  },
};

const ux = (pct) => Number((pct * LAMP.xToUnit).toFixed(2));
const uy = (pct) => Number((pct * LAMP.yToUnit).toFixed(2));

const DEFAULT_DESK_LAYOUT = {
  desk: {
    file: 'desk.webp',
    width: 1231,
    height: 920,
  },
  screenHole: {
    leftPct: 28.43,
    topPct: 3.48,
    widthPct: 44.68,
    heightPct: 33.04,
    aspect: 1.809,
  },
  monitor: {
    topPct: 0.43,
    leftPct: 26.32,
    rightPct: 75.06,
    centerXPct: 50.61,
    bezelBottomPct: 42.83,
  },
  props: {
    plant: { file: 'plant.webp', width: 481, height: 853 },
    clock: { file: 'clock.webp', width: 394, height: 401 },
    frame: { file: 'frame.webp', width: 432, height: 392 },
    cabinet: { file: 'cabinet.webp', width: 447, height: 597 },
  },
};

export const OfficeScene = () => {
  const stageRef = useRef(null);
  const worldRef = useRef(null);
  const deskBoxRef = useRef(null);
  const holeRef = useRef(null);
  const screenHostRef = useRef(null);
  const screenDimRef = useRef(null);
  const darkRoomRef = useRef(null);
  const halftoneRef = useRef(null);
  const lightConeRef = useRef(null);
  const lampDomeRef = useRef(null);
  const lampInnerGlowRef = useRef(null);
  const watchPhotoRef = useRef(null);
  const cordSwingRef = useRef(null);
  const cordPullRef = useRef(null);
  const cordButtonRef = useRef(null);
  const coinInnerRef = useRef(null);
  const coinOverlayRef = useRef(null);
  const coinFlipRef = useRef(null);
  const coinSpecRef = useRef(null);

  const [debugMode] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('debug') || '';
  });
  const debugHotspots = debugMode === 'hotspots';
  const debugLamp = debugMode === 'lamp';
  const [lampBox, setLampBox] = useState({
    worldW: 1200,
    worldH: 760,
    ox: 250,
    oy: 120,
    s: 700 / LAMP.deskW,
  });

  const [layout, setLayout] = useState(DEFAULT_DESK_LAYOUT);
  const [screenMetrics, setScreenMetrics] = useState({ w: 405, h: 224, zoom: 2.29 });
  const [hasImageError, setHasImageError] = useState(false);
  const [hintHoverRow, setHintHoverRow] = useState(false);
  const [hintPulseTick, setHintPulseTick] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [isLightOn, setIsLightOn] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [everLit, setEverLit] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [isScreenReady, setIsScreenReady] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [isHeld, setIsHeld] = useState(false);
  const [isLampReachable, setIsLampReachable] = useState(true);
  const [isDeskLampOn, setIsDeskLampOn] = useState(false);
  const [isCoinLifted, setIsCoinLifted] = useState(false);

  const lastWidthRef = useRef(typeof window !== 'undefined' ? window.innerWidth : 0);
  const lastHeightRef = useRef(typeof window !== 'undefined' ? window.innerHeight : 0);

  // Camera, scroll-hold & ScrollTrigger refs
  const cameraEndRef = useRef({ x: 0, y: 0, s: 1 });
  const sceneTopRef = useRef(0);
  const isLightOnRef = useRef(isLightOn);
  const isDeskLampOnRef = useRef(isDeskLampOn);
  const everLitRef = useRef(everLit);
  const isScreenReadyRef = useRef(isScreenReady);
  const isLampReachableRef = useRef(true);
  const isHeldRef = useRef(false);
  const hasPulledOnceRef = useRef(reducedMotion);
  const enforceHoldRef = useRef(() => {});

  const lightTlRef = useRef(null);
  const coinTweenRef = useRef(null);
  const coinTimerRef = useRef(null);
  const isCoinLiftedRef = useRef(false);
  const glanceTweenRef = useRef(null);
  const pullTweenRef = useRef(null);
  const swingTweenRef = useRef(null);
  const stRef = useRef(null);

  // Drag gesture refs for the pull cord
  const dragStateRef = useRef({
    active: false,
    startY: 0,
    triggered: false,
    suppressClick: false,
  });

  // Track prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e) => {
      setReducedMotion(e.matches);
      if (e.matches) {
        isLightOnRef.current = true;
        setIsLightOn(true);
        everLitRef.current = true;
        setEverLit(true);
        isScreenReadyRef.current = true;
        setIsScreenReady(true);
        hasPulledOnceRef.current = true;
        isHeldRef.current = false;
        setIsHeld(false);
      }
    };
    setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Load desk-layout.json at runtime with fallback constants
  useEffect(() => {
    let active = true;
    fetch('/assets/office/desk-layout.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data || !data.screenHole || !data.monitor) return;
        setLayout((prev) => ({
          desk: { ...prev.desk, ...(data.desk || {}) },
          screenHole: { ...prev.screenHole, ...data.screenHole },
          monitor: { ...prev.monitor, ...data.monitor },
          props: { ...prev.props, ...(data.props || {}) },
        }));
      })
      .catch(() => {
        // Keep fallback layout constants
      });
    return () => {
      active = false;
    };
  }, []);

  // Measure desk box in untransformed .office-world pixels using offsetLeft/offsetTop/offsetWidth/offsetHeight
  const measureDeskInWorld = useCallback(() => {
    const worldEl = worldRef.current;
    const deskEl = deskBoxRef.current;
    if (!worldEl || !deskEl) return;

    let ox = 0;
    let oy = 0;
    let cur = deskEl;
    while (cur && cur !== worldEl) {
      ox += cur.offsetLeft;
      oy += cur.offsetTop;
      cur = cur.offsetParent;
    }

    const deskW = deskEl.offsetWidth;
    const deskH = deskEl.offsetHeight;
    const worldW = worldEl.offsetWidth;
    const worldH = worldEl.offsetHeight;

    if (worldW > 0 && worldH > 0 && deskW > 0) {
      const s = deskW / LAMP.deskW;
      worldEl.style.setProperty('--desk-x', `${ox.toFixed(2)}px`);
      worldEl.style.setProperty('--desk-y', `${oy.toFixed(2)}px`);
      worldEl.style.setProperty('--desk-w', `${deskW.toFixed(2)}px`);
      worldEl.style.setProperty('--desk-h', `${deskH.toFixed(2)}px`);
      setLampBox((prev) => {
        if (
          Math.abs(prev.worldW - worldW) < 0.5 &&
          Math.abs(prev.worldH - worldH) < 0.5 &&
          Math.abs(prev.ox - ox) < 0.5 &&
          Math.abs(prev.oy - oy) < 0.5 &&
          Math.abs(prev.s - s) < 0.0005
        ) {
          return prev;
        }
        return { worldW, worldH, ox, oy, s };
      });
    }
  }, []);

  // Measure untransformed screen hole & desk box geometry relative to .office-world / stage
  const computeCamera = useCallback(() => {
    const stageEl = stageRef.current;
    const worldEl = worldRef.current;
    const holeEl = holeRef.current;
    if (!stageEl || !worldEl || !holeEl) {
      return { x: 0, y: 0, s: 1 };
    }

    measureDeskInWorld();

    const prevTransform = worldEl.style.transform;
    worldEl.style.transform = 'none';
    const stageRect = stageEl.getBoundingClientRect();
    const holeRect = holeEl.getBoundingClientRect();
    worldEl.style.transform = prevTransform;

    if (!stageRect.width || !holeRect.width) {
      return { x: 0, y: 0, s: 1 };
    }

    const endFill = stageRect.width < 600 ? END_FILL_MOBILE : END_FILL_DESKTOP;
    const s = (stageRect.width * endFill) / holeRect.width;
    const holeCenterX = holeRect.left - stageRect.left + holeRect.width / 2;
    const holeCenterY = holeRect.top - stageRect.top + holeRect.height / 2;
    const x = stageRect.width / 2 - s * holeCenterX;
    const y = stageRect.height / 2 - s * holeCenterY;

    return { x, y, s };
  }, [measureDeskInWorld]);

  // Compute exact top of scene in page coordinates (accounting for ScrollTrigger pin-spacer)
  const measureSceneTop = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    if (stRef.current && typeof stRef.current.start === 'number' && Number.isFinite(stRef.current.start)) {
      const top = Math.round(stRef.current.start);
      sceneTopRef.current = top;
      return top;
    }
    const stageEl = stageRef.current;
    if (!stageEl) return 0;
    const anchorEl = stageEl.parentElement?.classList?.contains('pin-spacer')
      ? stageEl.parentElement
      : stageEl;
    const top = Math.round(anchorEl.getBoundingClientRect().top + window.scrollY);
    sceneTopRef.current = top;
    return top;
  }, []);

  // Keep ticker height CSS var, sceneTop, and resize updates in sync
  useEffect(() => {
    if (typeof window === 'undefined') return;
    lastWidthRef.current = window.innerWidth;
    lastHeightRef.current = window.innerHeight;
    let resizeRafId = 0;

    const updateTickerHeight = () => {
      const ticker = document.querySelector('[data-ticker]');
      const h = ticker ? ticker.getBoundingClientRect().height : 40;
      if (stageRef.current) {
        stageRef.current.style.setProperty('--ticker-h', `${h}px`);
      }
    };

    updateTickerHeight();
    measureSceneTop();

    const handleWidthChange = () => {
      const curW = window.innerWidth;
      const curH = window.innerHeight;
      const desktopResize =
        isDesktopViewport() &&
        (Math.abs(curW - lastWidthRef.current) > 2 || Math.abs(curH - lastHeightRef.current) > 2);
      const mobileResize = Math.abs(curW - lastWidthRef.current) > 2;

      if (desktopResize || mobileResize) {
        lastWidthRef.current = curW;
        lastHeightRef.current = curH;
        updateTickerHeight();
        if (resizeRafId) cancelAnimationFrame(resizeRafId);
        resizeRafId = requestAnimationFrame(() => {
          resizeRafId = 0;
          const cam = computeCamera();
          cameraEndRef.current = cam;
          if (reducedMotion && worldRef.current) {
            gsap.set(worldRef.current, { x: cam.x, y: cam.y, scale: cam.s, transformOrigin: '0 0' });
          } else {
            ScrollTrigger.refresh();
          }
          measureSceneTop();
        });
      } else {
        requestAnimationFrame(measureSceneTop);
      }
    };

    const handleOrientation = () => {
      setTimeout(() => {
        lastWidthRef.current = window.innerWidth;
        lastHeightRef.current = window.innerHeight;
        updateTickerHeight();
        requestAnimationFrame(() => {
          const cam = computeCamera();
          cameraEndRef.current = cam;
          if (reducedMotion && worldRef.current) {
            gsap.set(worldRef.current, { x: cam.x, y: cam.y, scale: cam.s, transformOrigin: '0 0' });
          } else {
            ScrollTrigger.refresh();
          }
          measureSceneTop();
        });
      }, 150);
    };

    window.addEventListener('resize', handleWidthChange);
    window.addEventListener('orientationchange', handleOrientation);
    ScrollTrigger.addEventListener('refresh', measureSceneTop);
    return () => {
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      window.removeEventListener('resize', handleWidthChange);
      window.removeEventListener('orientationchange', handleOrientation);
      ScrollTrigger.removeEventListener('refresh', measureSceneTop);
    };
  }, [computeCamera, measureSceneTop, reducedMotion]);

  // Sync MonitorScreen dimensions and desk unit transform via ResizeObserver
  useLayoutEffect(() => {
    const holeEl = holeRef.current;
    const stageEl = stageRef.current;
    const worldEl = worldRef.current;
    const deskEl = deskBoxRef.current;
    if (!holeEl || !stageEl) return;

    const updateMetrics = () => {
      const holeW = holeEl.offsetWidth;
      const holeH = holeEl.offsetHeight;
      const stageW = stageEl.offsetWidth;
      if (holeW > 0 && holeH > 0 && stageW > 0) {
        const endFill = stageW < 600 ? END_FILL_MOBILE : END_FILL_DESKTOP;
        const zoom = (stageW * endFill) / holeW;
        const w = stageW * endFill;
        const h = holeH * zoom;
        setScreenMetrics((prev) => {
          if (
            Math.abs(prev.w - w) < 0.5 &&
            Math.abs(prev.h - h) < 0.5 &&
            Math.abs(prev.zoom - zoom) < 0.005
          ) {
            return prev;
          }
          return { w, h, zoom };
        });
      }
      computeCamera();
    };

    updateMetrics();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateMetrics);
    ro.observe(holeEl);
    ro.observe(stageEl);
    if (worldEl) ro.observe(worldEl);
    if (deskEl) ro.observe(deskEl);
    return () => ro.disconnect();
  }, [layout, hasImageError, computeCamera]);

  // Animate the cord dropping 18px and springing back (250ms with small overshoot)
  const animateCordDrop = useCallback(() => {
    const pullEl = cordPullRef.current;
    if (!pullEl || reducedMotion) return;

    if (pullTweenRef.current) {
      pullTweenRef.current.kill();
    }

    const tl = gsap.timeline({
      onComplete: () => {
        pullTweenRef.current = null;
      },
    });
    tl.to(pullEl, {
      y: 18,
      duration: 0.065,
      ease: 'power2.out',
    }).to(pullEl, {
      y: 0,
      duration: 0.185,
      ease: 'back.out(2.6)',
    });
    pullTweenRef.current = tl;
  }, [reducedMotion]);

  // Switch main room light ON / OFF (no flicker); keeps deskOn state & preserves MonitorScreen React state
  const setLightState = useCallback(
    (nextOn) => {
      if (reducedMotion) return;
      if (isLightOnRef.current === nextOn) return;

      isLightOnRef.current = nextOn;
      setIsLightOn(nextOn);
      animateCordDrop();
      playSwitchClick();

      if (nextOn) {
        hasPulledOnceRef.current = true;
        everLitRef.current = true;
        setEverLit(true);
        isHeldRef.current = false;
        setIsHeld(false);
      } else {
        enforceHoldRef.current();
      }

      const darkEl = darkRoomRef.current;
      const dotsEl = halftoneRef.current;
      const coneEl = lightConeRef.current;
      const domeEl = lampDomeRef.current;
      const glowEl = lampInnerGlowRef.current;
      const watchEl = watchPhotoRef.current;
      const screenDimEl = screenDimRef.current;

      if (lightTlRef.current) {
        lightTlRef.current.kill();
        lightTlRef.current = null;
      }

      const tl = gsap.timeline({
        onComplete: () => {
          lightTlRef.current = null;
        },
      });
      lightTlRef.current = tl;

      if (nextOn) {
        // Light ON: 320-440ms smooth reveal, no flashing
        if (darkEl) {
          tl.to(
            darkEl,
            {
              opacity: 0,
              duration: 0.4,
              ease: 'power2.out',
              onComplete: () => {
                if (isDesktopViewport() && isLightOnRef.current) {
                  darkEl.style.visibility = 'hidden';
                }
              },
            },
            0
          );
        }
        if (domeEl) tl.to(domeEl, { fill: '#F2B24A', duration: 0.32, ease: 'power1.out' }, 0);
        if (glowEl) tl.to(glowEl, { fill: '#FFF3CF', duration: 0.32, ease: 'power1.out' }, 0);
        if (dotsEl) tl.to(dotsEl, { opacity: 0.3, duration: 0.4, ease: 'power2.out' }, 0.03);
        if (coneEl) tl.to(coneEl, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0.03);
        if (screenDimEl) tl.to(screenDimEl, { opacity: 0, duration: 0.38, ease: 'power2.out' }, 0);
        if (watchEl) {
          const sepiaProxy = { val: 1 };
          tl.fromTo(
            watchEl,
            { opacity: 0 },
            { opacity: 1, duration: 0.44, ease: 'power1.out' },
            0.05
          );
          tl.to(
            sepiaProxy,
            {
              val: 0,
              duration: 0.44,
              ease: 'power1.out',
              onUpdate: () => {
                watchEl.style.filter = `sepia(${sepiaProxy.val.toFixed(3)})`;
              },
            },
            0.05
          );
        }
      } else {
        // Light OFF: smoothly darken room & return screen to dark standby glass (#0A0A0A)
        if (darkEl) {
          if (isDesktopViewport()) darkEl.style.visibility = 'visible';
          tl.to(darkEl, { opacity: 1, duration: 0.4, ease: 'power2.inOut' }, 0);
        }
        if (domeEl) tl.to(domeEl, { fill: '#6E481A', duration: 0.32, ease: 'power1.inOut' }, 0);
        if (glowEl) tl.to(glowEl, { fill: '#3E280D', duration: 0.32, ease: 'power1.inOut' }, 0);
        if (dotsEl) tl.to(dotsEl, { opacity: 0, duration: 0.35, ease: 'power2.inOut' }, 0);
        if (coneEl) tl.to(coneEl, { opacity: 0, duration: 0.35, ease: 'power2.inOut' }, 0);
        if (screenDimEl) tl.to(screenDimEl, { opacity: 1, duration: 0.35, ease: 'power2.inOut' }, 0);
        if (watchEl) {
          const sepiaProxy = { val: 0 };
          tl.to(watchEl, { opacity: 0, duration: 0.35, ease: 'power2.inOut' }, 0);
          tl.to(
            sepiaProxy,
            {
              val: 1,
              duration: 0.35,
              onUpdate: () => {
                watchEl.style.filter = `sepia(${sepiaProxy.val.toFixed(3)})`;
              },
            },
            0
          );
        }
      }
    },
    [animateCordDrop, reducedMotion]
  );

  const toggleLight = useCallback(() => {
    setLightState(!isLightOnRef.current);
  }, [setLightState]);

  // Desk lamp switch toggle: active only when room or lamp is lit (everLit && (mainOn || deskOn))
  const handleDeskLampToggle = useCallback(() => {
    if (
      !reducedMotion &&
      (!everLitRef.current || (!isLightOnRef.current && !isDeskLampOnRef.current))
    ) {
      return;
    }

    const nextDeskOn = !isDeskLampOnRef.current;
    isDeskLampOnRef.current = nextDeskOn;
    setIsDeskLampOn(nextDeskOn);
    playSwitchClick();
  }, [reducedMotion]);

  // Coin interaction: lifts off desk, enlarges flat to 38% stage width for 1.8s with 360deg flip, specular sweep & clink
  const handleCoinClick = useCallback(() => {
    if (!reducedMotion && !isLightOnRef.current && !isDeskLampOnRef.current) return;
    if (isCoinLiftedRef.current) return;

    playCoinClink();

    const watchEl = watchPhotoRef.current;
    if (watchEl && isLightOnRef.current && !reducedMotion) {
      if (glanceTweenRef.current) {
        glanceTweenRef.current.kill();
      }
      glanceTweenRef.current = gsap
        .timeline({
          onComplete: () => {
            glanceTweenRef.current = null;
          },
        })
        .to(watchEl, {
          x: 4,
          y: 3,
          rotate: 2.5,
          scale: 1.04,
          duration: 0.16,
          ease: 'power2.out',
        })
        .to(watchEl, {
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
          duration: 0.32,
          delay: 0.32,
          ease: 'power2.inOut',
          clearProps: 'transform',
        });
    }

    const deskCoinEl = coinInnerRef.current;
    const stageEl = stageRef.current;
    if (!deskCoinEl || !stageEl) return;

    if (coinTweenRef.current) {
      coinTweenRef.current.kill();
      coinTweenRef.current = null;
    }
    if (coinTimerRef.current !== null) {
      window.clearTimeout(coinTimerRef.current);
      coinTimerRef.current = null;
    }

    const deskRect = deskCoinEl.getBoundingClientRect();
    const stageRect = stageEl.getBoundingClientRect();
    const dx =
      deskRect.left + deskRect.width / 2 - (stageRect.left + stageRect.width / 2);
    const dy =
      deskRect.top + deskRect.height / 2 - (stageRect.top + stageRect.height / 2);
    const endW = stageRect.width * (LAMP.coin.inspectWidthPct / 100);
    const startScale = endW > 0 && deskRect.width > 0 ? deskRect.width / endW : 0.28;

    isCoinLiftedRef.current = true;
    setIsCoinLifted(true);

    if (reducedMotion) {
      coinTimerRef.current = window.setTimeout(() => {
        coinTimerRef.current = null;
        isCoinLiftedRef.current = false;
        setIsCoinLifted(false);
      }, LAMP.coin.inspectMs);
      return;
    }

    requestAnimationFrame(() => {
      const overlayEl = coinOverlayRef.current;
      const flipEl = coinFlipRef.current;
      const specEl = coinSpecRef.current;
      if (!overlayEl || !flipEl) {
        isCoinLiftedRef.current = false;
        setIsCoinLifted(false);
        return;
      }

      const tl = gsap.timeline({
        onComplete: () => {
          coinTweenRef.current = null;
          isCoinLiftedRef.current = false;
          setIsCoinLifted(false);
        },
      });
      coinTweenRef.current = tl;

      tl.fromTo(
        overlayEl,
        {
          x: dx,
          y: dy,
          scale: startScale,
          rotate: LAMP.coin.rotateDeg,
          scaleY: LAMP.coin.scaleY,
          opacity: 1,
        },
        {
          x: 0,
          y: 0,
          scale: 1,
          rotate: 0,
          scaleY: 1,
          duration: 0.45,
          ease: 'power2.out',
        },
        0
      ).fromTo(
        flipEl,
        { rotateY: 0 },
        {
          rotateY: 360,
          duration: LAMP.coin.flipMs / 1000,
          ease: 'power2.out',
        },
        0
      );

      if (specEl) {
        tl.fromTo(
          specEl,
          { x: -34, opacity: 0.9 },
          {
            x: 38,
            opacity: 1,
            duration: 0.72,
            ease: 'power1.inOut',
          },
          0.26
        );
      }

      // Hold flat at 46% stage width for 1.8s, then settle back onto desk
      tl.to({}, { duration: LAMP.coin.inspectMs / 1000 }, 0.45).to(
        overlayEl,
        {
          x: dx,
          y: dy,
          scale: startScale,
          rotate: LAMP.coin.rotateDeg,
          scaleY: LAMP.coin.scaleY,
          duration: 0.38,
          ease: 'power2.inOut',
        },
        2.25
      );
    });
  }, [reducedMotion]);

  const handleHintPulse = useCallback(() => {
    setHintPulseTick((t) => t + 1);
  }, []);

  // Gentle 2.4s cord swing animation (+/- 4 deg around attachment point)
  useLayoutEffect(() => {
    const swingEl = cordSwingRef.current;
    if (!swingEl || reducedMotion || hasImageError) return;

    swingTweenRef.current = gsap.fromTo(
      swingEl,
      { rotate: -4, transformOrigin: '50% 0%' },
      {
        rotate: 4,
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        transformOrigin: '50% 0%',
      }
    );

    return () => {
      if (swingTweenRef.current) {
        swingTweenRef.current.kill();
        swingTweenRef.current = null;
      }
    };
  }, [reducedMotion, hasImageError]);

  // Setup ScrollTrigger pin & scrub zoom (starts at whole room, zooms to monitor as user scrolls after pulling rope)
  useLayoutEffect(() => {
    if (hasImageError) return;
    const stageEl = stageRef.current;
    const worldEl = worldRef.current;
    if (!stageEl || !worldEl) return;

    const lit = reducedMotion || isLightOnRef.current;
    if (darkRoomRef.current) darkRoomRef.current.style.opacity = lit ? '0' : '1';
    if (halftoneRef.current) halftoneRef.current.style.opacity = lit ? '0.3' : '0';
    if (lightConeRef.current) lightConeRef.current.style.opacity = lit ? '1' : '0';
    if (lampDomeRef.current) lampDomeRef.current.style.fill = lit ? '#F2B24A' : '#6E481A';
    if (lampInnerGlowRef.current) {
      lampInnerGlowRef.current.style.fill = lit ? '#FFF3CF' : '#3E280D';
    }
    if (watchPhotoRef.current) {
      watchPhotoRef.current.style.opacity = lit ? '1' : '0';
      watchPhotoRef.current.style.filter = lit ? 'sepia(0)' : 'sepia(1)';
    }
    if (screenDimRef.current) screenDimRef.current.style.opacity = lit ? '0' : '1';

    if (reducedMotion) {
      const cam = computeCamera();
      cameraEndRef.current = cam;
      gsap.set(worldEl, { x: cam.x, y: cam.y, scale: cam.s, transformOrigin: '0 0' });
      hasPulledOnceRef.current = true;
      isHeldRef.current = false;
      setIsHeld(false);
      isLightOnRef.current = true;
      setIsLightOn(true);
      everLitRef.current = true;
      setEverLit(true);
      isScreenReadyRef.current = true;
      setIsScreenReady(true);
      return;
    }

    const ctx = gsap.context(() => {
      cameraEndRef.current = computeCamera();
      gsap.set(worldEl, { x: 0, y: 0, scale: 1, transformOrigin: '0 0' });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: stageEl,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          refreshPriority: isDesktopViewport() ? -1 : 0,
          start: 'top top',
          end: () => (window.innerWidth < 768 ? '+=160%' : '+=200%'),
          scrub: 0.4,
          invalidateOnRefresh: true,
          onRefreshInit: () => {
            cameraEndRef.current = computeCamera();
          },
          onRefresh: () => {
            measureSceneTop();
          },
          onUpdate: (self) => {
            const p = self.progress;

            // Lamp/cord is scrolled off-screen past ~45% zoom
            const nextReachable = p < 0.45;
            if (nextReachable !== isLampReachableRef.current) {
              isLampReachableRef.current = nextReachable;
              setIsLampReachable(nextReachable);
            }

            // Screen becomes interactive from 0.88 (when everLit is true)
            const nextReady = p >= 0.88;
            if (nextReady !== isScreenReadyRef.current) {
              isScreenReadyRef.current = nextReady;
              setIsScreenReady(nextReady);
            }
          },
        },
      });

      stRef.current = tl.scrollTrigger;
      measureSceneTop();

      // 0 -> 0.85: smooth scroll zoom into monitor
      tl.fromTo(
        worldEl,
        { x: 0, y: 0, scale: 1, transformOrigin: '0 0' },
        {
          x: () => cameraEndRef.current.x,
          y: () => cameraEndRef.current.y,
          scale: () => cameraEndRef.current.s,
          transformOrigin: '0 0',
          ease: 'power2.inOut',
          duration: 0.85,
        },
        0
      );

      // 0.85 -> 1.0: hold on zoomed monitor before handing off to Meme Desk
      tl.to({}, { duration: 0.15 }, 0.85);
    }, stageRef);

    return () => {
      if (lightTlRef.current) {
        lightTlRef.current.kill();
        lightTlRef.current = null;
      }
      if (glanceTweenRef.current) {
        glanceTweenRef.current.kill();
        glanceTweenRef.current = null;
      }
      if (pullTweenRef.current) {
        pullTweenRef.current.kill();
        pullTweenRef.current = null;
      }
      if (coinTweenRef.current) {
        coinTweenRef.current.kill();
        coinTweenRef.current = null;
      }
      if (coinTimerRef.current !== null) {
        window.clearTimeout(coinTimerRef.current);
        coinTimerRef.current = null;
      }
      stRef.current = null;
      ctx.revert();
    };
  }, [reducedMotion, hasImageError, computeCamera, measureSceneTop]);

  // Downward scroll hold whenever the room is dark (!isLightOnRef.current)
  useEffect(() => {
    if (typeof window === 'undefined' || reducedMotion || hasImageError) {
      enforceHoldRef.current = () => {};
      return;
    }

    const enforceHold = () => {
      if (isLightOnRef.current) {
        if (isHeldRef.current) {
          isHeldRef.current = false;
          setIsHeld(false);
        }
        return;
      }

      const sceneTop = measureSceneTop();
      const scrollY = window.scrollY;

      if (scrollY >= sceneTop - 1) {
        if (scrollY > sceneTop) {
          window.scrollTo({ top: sceneTop, behavior: 'auto' });
          ScrollTrigger.update();
        }
        if (!isHeldRef.current) {
          isHeldRef.current = true;
          setIsHeld(true);
        }
      } else if (isHeldRef.current) {
        isHeldRef.current = false;
        setIsHeld(false);
      }
    };

    enforceHoldRef.current = enforceHold;

    const handleWheel = (e) => {
      if (isLightOnRef.current) return;
      const sceneTop = measureSceneTop();
      let deltaY = e.deltaY;
      if (isDesktopViewport()) {
        if (e.deltaMode === 1) deltaY *= 16;
        else if (e.deltaMode === 2) deltaY *= window.innerHeight || 800;
      }

      // Block downward wheel when main light is off at/entering sceneTop; upward scroll stays free
      if (deltaY > 0 && (isHeldRef.current || window.scrollY >= sceneTop - 2)) {
        e.preventDefault();
        if (window.scrollY > sceneTop) {
          window.scrollTo({ top: sceneTop, behavior: 'auto' });
          ScrollTrigger.update();
        }
      }
    };

    const handleKeyDown = (e) => {
      if (isLightOnRef.current) return;
      const sceneTop = measureSceneTop();
      const heldAtScene = isHeldRef.current || window.scrollY >= sceneTop - 2;
      if (!heldAtScene) return;

      const target = e.target;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Let focused pull cord button activate with Enter / Space without page scrolling
      const isCordFocused =
        cordButtonRef.current &&
        (target === cordButtonRef.current || cordButtonRef.current.contains(target));

      if (isCordFocused && (e.key === ' ' || e.key === 'Enter')) {
        return;
      }

      if (
        e.key === ' ' ||
        e.key === 'PageDown' ||
        e.key === 'ArrowDown' ||
        e.key === 'End'
      ) {
        e.preventDefault();
      }
    };

    let touchStartY = 0;
    let lastTouchY = 0;
    let trackingTouch = false;

    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
        lastTouchY = touchStartY;
        trackingTouch = true;
      }
    };

    const handleTouchMove = (e) => {
      if (!trackingTouch || !e.touches || e.touches.length === 0) return;
      const curY = e.touches[0].clientY;
      const movingUpFinger = (curY < touchStartY - 1 && curY <= lastTouchY) || curY - lastTouchY < -1;
      lastTouchY = curY;

      if (isLightOnRef.current) return;
      const sceneTop = measureSceneTop();
      const heldAtScene = isHeldRef.current || window.scrollY >= sceneTop - 2;

      // On iOS Safari (which ignores touch-action: pan-down), prevent scrolling down while room is dark
      if (movingUpFinger && heldAtScene && e.cancelable) {
        e.preventDefault();
        if (window.scrollY > sceneTop) {
          window.scrollTo({ top: sceneTop, behavior: 'auto' });
          ScrollTrigger.update();
        }
      }
    };

    const handleTouchEnd = () => {
      trackingTouch = false;
    };

    enforceHold();

    const stageEl = stageRef.current;
    window.addEventListener('scroll', enforceHold, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    if (stageEl) {
      stageEl.addEventListener('touchstart', handleTouchStart, { passive: true });
      stageEl.addEventListener('touchmove', handleTouchMove, { passive: false });
      stageEl.addEventListener('touchend', handleTouchEnd, { passive: true });
      stageEl.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    }

    return () => {
      enforceHoldRef.current = () => {};
      window.removeEventListener('scroll', enforceHold);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      if (stageEl) {
        stageEl.removeEventListener('touchstart', handleTouchStart);
        stageEl.removeEventListener('touchmove', handleTouchMove);
        stageEl.removeEventListener('touchend', handleTouchEnd);
        stageEl.removeEventListener('touchcancel', handleTouchEnd);
      }
    };
  }, [reducedMotion, hasImageError, measureSceneTop]);

  // 20-second initial fail-safe: only auto-pulls on first arrival before user has pulled manually
  useEffect(() => {
    if (!isHeld || reducedMotion || hasImageError || hasPulledOnceRef.current) {
      return;
    }

    const timerId = window.setTimeout(() => {
      if (!hasPulledOnceRef.current && !reducedMotion && !hasImageError) {
        setLightState(true);
      }
    }, 20000);

    return () => window.clearTimeout(timerId);
  }, [isHeld, reducedMotion, hasImageError, setLightState]);

  // Expose dark vs lit desk room state on <html data-room="dark|lit"> for the sticky PLAY button
  const isRoomDark = !reducedMotion && !hasImageError && isHeld && !isLightOn;
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.room = isRoomDark ? 'dark' : 'lit';
    return () => {
      document.documentElement.dataset.room = 'lit';
    };
  }, [isRoomDark]);

  if (hasImageError) {
    return (
      <div id="desk">
        <Arrivals />
      </div>
    );
  }

  const handleImgError = () => {
    setHasImageError(true);
    isHeldRef.current = false;
    setIsHeld(false);
  };

  const handleDeskLoad = () => {
    const cam = computeCamera();
    cameraEndRef.current = cam;
    if (reducedMotion && worldRef.current) {
      gsap.set(worldRef.current, { x: cam.x, y: cam.y, scale: cam.s, transformOrigin: '0 0' });
    } else if (stRef.current) {
      ScrollTrigger.refresh();
    }
    measureSceneTop();
  };

  // Pull cord pointer drag (>= 12px downward triggers switch) + tap/click/keyboard fallback
  const handleCordPointerDown = (e) => {
    if (e.button && e.button !== 0) return;
    dragStateRef.current = {
      active: true,
      startY: e.clientY,
      triggered: false,
      suppressClick: false,
    };
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Safe fallback if pointer capture is unavailable
      }
    }
  };

  const handleCordPointerMove = (e) => {
    const drag = dragStateRef.current;
    if (!drag.active || drag.triggered) return;
    const dy = e.clientY - drag.startY;
    if (dy > 0 && cordPullRef.current) {
      gsap.set(cordPullRef.current, { y: Math.min(18, dy) });
    }
    if (dy >= 12) {
      drag.triggered = true;
      drag.suppressClick = true;
      toggleLight();
    }
  };

  const handleCordPointerUp = (e) => {
    const drag = dragStateRef.current;
    if (!drag.active) return;
    drag.active = false;
    if (typeof e.currentTarget.releasePointerCapture === 'function') {
      try {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Safe ignore
      }
    }
    if (!drag.triggered && cordPullRef.current) {
      gsap.to(cordPullRef.current, { y: 0, duration: 0.16, ease: 'power2.out' });
    }
  };

  const handleCordClick = () => {
    if (dragStateRef.current.suppressClick) {
      dragStateRef.current.suppressClick = false;
      return;
    }
    toggleLight();
  };

  const screenInteractive = reducedMotion || (isLightOn && isScreenReady);
  const holdActive = !reducedMotion && !hasImageError && isHeld && !isLightOn;
  const isDeskLampSwitchLit = reducedMotion || (everLit && (isLightOn || isDeskLampOn));
  const isDeskLampSwitchActive = isDeskLampSwitchLit && isLampReachable;
  const isCoinClickable =
    (reducedMotion || isLightOn || isDeskLampOn) && isLampReachable;

  return (
    <section
      ref={stageRef}
      id="desk"
      aria-label={OFFICE_COPY.heading}
      className="office-stage section-fullscreen relative w-full overflow-hidden select-none box-border z-20"
      style={{
        backgroundColor: 'var(--ink)',
        marginTop: 0,
        paddingTop: 0,
        paddingBottom: 'calc(var(--ticker-h, 40px) + env(safe-area-inset-bottom, 0px))',
        touchAction: holdActive ? 'pan-down' : 'auto',
      }}
    >
      <div
        ref={worldRef}
        className="office-world absolute inset-0"
        style={{
          transformOrigin: '0 0',
        }}
      >
        {/* 1. Wall: flat #E8DFC9 with halftone dots (hidden in dark) and baseboard line #2A1510 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: '#E8DFC9', zIndex: 1 }}
        >
          <div
            ref={halftoneRef}
            className="absolute inset-0 halftone-overlay"
            style={{ opacity: reducedMotion ? 0.3 : 0 }}
          />
          <div
            className="absolute left-0 right-0"
            style={{
              bottom: 'var(--floor-h, 24%)',
              height: '14px',
              backgroundColor: '#DDD2B7',
              borderTop: '2px solid #2A1510',
            }}
          />
        </div>

        {/* 2. Floor: bottom 24% of the stage, flat #C9B28A, 3px ink line on top edge */}
        <div
          className="absolute left-0 right-0 bottom-0 pointer-events-none"
          style={{
            height: 'var(--floor-h, 24%)',
            backgroundColor: '#C9B28A',
            borderTop: '3px solid #2A1510',
            zIndex: 2,
          }}
        />

        {/* Soft white ceiling light cone over the wall under the pendant lamp */}
        <div
          ref={lightConeRef}
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            top: '54px',
            width: 'min(92vw, 960px)',
            height: 'calc(76% - 54px)',
            opacity: reducedMotion ? 1 : 0,
            zIndex: 5,
          }}
        >
          <svg
            viewBox="0 0 1000 600"
            preserveAspectRatio="none"
            className="w-full h-full block"
          >
            <polygon
              points="460,0 540,0 980,600 20,600"
              fill="#FFFFFF"
              fillOpacity="0.16"
            />
          </svg>
        </div>

        {/* 3. Props: clock (right side so center lamp has clear space), frame (left), plant (<600px hidden), cabinet (<600px hidden) */}
        <img
          src={`/assets/office/${layout.props.clock.file}`}
          alt=""
          width={layout.props.clock.width}
          height={layout.props.clock.height}
          loading="lazy"
          onError={handleImgError}
          className="absolute h-auto pointer-events-none z-10"
          style={{
            left: '66%',
            top: '10%',
            width: 'min(15%, 12svh, 110px)',
          }}
        />

        {/* Framed picture on wall with bull-watch.webp inside the cream opening */}
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: '8%',
            top: '9%',
            width: 'min(22%, 220px)',
            aspectRatio: `${layout.props.frame.width} / ${layout.props.frame.height}`,
          }}
        >
          <img
            src={`/assets/office/${layout.props.frame.file}`}
            alt=""
            width={layout.props.frame.width}
            height={layout.props.frame.height}
            loading="lazy"
            onError={handleImgError}
            className="w-full h-full block"
          />
          <div
            className="absolute overflow-hidden"
            style={{
              left: '10%',
              top: '11.5%',
              width: '80%',
              height: '76%',
            }}
          >
            <img
              ref={watchPhotoRef}
              src="/assets/bull-watch.webp"
              alt={OFFICE_COPY.watchAlt}
              loading="lazy"
              onError={handleImgError}
              className="w-full h-full object-cover block"
              style={{
                objectPosition: '50% 40%',
                opacity: reducedMotion ? 1 : 0,
                filter: reducedMotion ? 'sepia(0)' : 'sepia(1)',
              }}
            />
          </div>
        </div>

        <img
          src={`/assets/office/${layout.props.plant.file}`}
          alt=""
          width={layout.props.plant.width}
          height={layout.props.plant.height}
          loading="lazy"
          onError={handleImgError}
          className="hidden min-[600px]:block absolute h-auto pointer-events-none z-10"
          style={{
            left: '-2%',
            bottom: 'calc(var(--floor-h, 24%) - clamp(10px, 2vw, 22px))',
            width: 'min(24%, 195px)',
          }}
        />

        <img
          src={`/assets/office/${layout.props.cabinet.file}`}
          alt=""
          width={layout.props.cabinet.width}
          height={layout.props.cabinet.height}
          loading="lazy"
          onError={handleImgError}
          className="hidden min-[600px]:block absolute h-auto pointer-events-none z-10"
          style={{
            right: '-3%',
            bottom: 'calc(var(--floor-h, 24%) - clamp(10px, 2vw, 22px))',
            width: 'min(26%, 240px)',
          }}
        />

        {/* 4, 5, 6. Desk box centered via auto margins so offsetLeft stays exact without CSS transform distortion */}
        <div
          ref={deskBoxRef}
          className="desk-box absolute left-0 right-0 mx-auto z-20"
          style={{
            width: 'min(98%, 900px, 74svh)',
            bottom: 'calc(var(--floor-h, 24%) - clamp(24px, 4vw, 48px))',
          }}
        >
          {/* Flat dark ellipse shadow under desk */}
          <div
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none rounded-full"
            style={{
              bottom: '-6px',
              width: '92%',
              height: '22px',
              backgroundColor: '#0E0D0C',
              opacity: 0.25,
              zIndex: 5,
            }}
          />

          {/* 5. Screen layer (3px bleed on all sides, below desk image; #0A0A0A standby glass when mainOff) */}
          <div
            ref={holeRef}
            data-no-tapfx
            aria-hidden={!screenInteractive}
            className="screen-layer absolute overflow-hidden"
            style={{
              left: `calc(${layout.screenHole.leftPct}% - 3px)`,
              top: `calc(${layout.screenHole.topPct}% - 3px)`,
              width: `calc(${layout.screenHole.widthPct}% + 6px)`,
              height: `calc(${layout.screenHole.heightPct}% + 6px)`,
              backgroundColor: reducedMotion || isLightOn ? '#0E0D0C' : '#0A0A0A',
              zIndex: 14,
              pointerEvents: screenInteractive ? 'auto' : 'none',
              outline: debugHotspots ? '2px dashed #2FD27A' : undefined,
              outlineOffset: debugHotspots ? '-2px' : undefined,
            }}
          >
            {/* Container-queried MonitorScreen scaled cleanly to match zoomed viewport pixels */}
            <div
              ref={screenHostRef}
              style={{
                width: `${screenMetrics.w}px`,
                height: `${screenMetrics.h}px`,
                transform: `scale(${1 / screenMetrics.zoom})`,
                transformOrigin: 'top left',
                containerType: 'size',
                backgroundColor: reducedMotion || isLightOn ? '#0E0D0C' : '#0A0A0A',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <MonitorScreen
                isInteractive={screenInteractive}
                isLightOn={reducedMotion || isLightOn}
                reducedMotion={reducedMotion}
                hintHoverFirstRow={hintHoverRow}
                hintPulseTick={hintPulseTick}
              />

              {/* Standby glass overlay (#0A0A0A) when mainOn is false; fades smoothly to 0 when mainOn */}
              <div
                ref={screenDimRef}
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#0A0A0A',
                  opacity: reducedMotion || isLightOn ? 0 : 1,
                  pointerEvents: 'none',
                }}
              />

              {/* Horn cursor confined strictly inside the screen layer */}
              <HornCursor
                hostRef={screenHostRef}
                isInteractive={screenInteractive}
                reducedMotion={reducedMotion}
                onHintHoverChange={setHintHoverRow}
                onHintPulse={handleHintPulse}
              />
            </div>
          </div>

          {/* 6. Desk image (eager load, sits above screen layer and bull peek) */}
          <img
            src={`/assets/office/${layout.desk.file}`}
            alt={OFFICE_COPY.deskAlt}
            width={layout.desk.width}
            height={layout.desk.height}
            onLoad={handleDeskLoad}
            onError={handleImgError}
            className="relative w-full h-auto block pointer-events-none"
            style={{ zIndex: 20 }}
          />

          {/* 6b. Desk lamp shade interior cover when OFF (hides painted bulb in mainOn+deskOff) */}
          <svg
            aria-hidden="true"
            viewBox={`0 0 ${layout.desk.width} ${layout.desk.height}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              zIndex: 21,
              opacity: isDeskLampOn ? 0 : 1,
              transition: reducedMotion ? 'none' : `opacity ${LAMP.fadeMs}ms ease-in-out`,
            }}
          >
            <g transform="rotate(-19.5 240 179)">
              <ellipse
                cx="240"
                cy="179"
                rx="68"
                ry="21.5"
                fill="#17120D"
                stroke="#0E0D0C"
                strokeWidth="2"
              />
              <ellipse
                cx="236"
                cy="176"
                rx="18"
                ry="11.5"
                fill="#3E280D"
                stroke="#0E0D0C"
                strokeWidth="2.5"
              />
            </g>
          </svg>

          {/* 6d. Metal coin on desk (lives under dark room overlay; inspects to 46% flat on tap) */}
          <button
            type="button"
            data-no-tapfx
            aria-label={`Coin, ${COIN_TEXT}`}
            aria-disabled={!isCoinClickable ? 'true' : undefined}
            tabIndex={isCoinClickable ? 0 : -1}
            onClick={handleCoinClick}
            className="absolute flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] rounded-full"
            style={{
              left: `${LAMP.coin.cxPct}%`,
              top: `${LAMP.coin.cyPct}%`,
              width: `${LAMP.coin.widthPct}%`,
              minWidth: '44px',
              minHeight: '44px',
              aspectRatio: '1 / 1',
              transform: 'translate(-50%, -50%)',
              zIndex: 23,
              pointerEvents: isCoinClickable ? 'auto' : 'none',
              outline: debugHotspots ? '2px dashed #F2B24A' : undefined,
              outlineOffset: debugHotspots ? '4px' : undefined,
            }}
          >
            {debugHotspots && (
              <span className="font-plex text-[9px] bg-[#0E0D0C] text-[#F2B24A] px-1 absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
                coin ({LAMP.coin.cxPct}, {LAMP.coin.cyPct})
              </span>
            )}
            <div
              ref={coinInnerRef}
              className="shrink-0"
              style={{
                width: `calc(var(--desk-w, 700px) * ${LAMP.coin.widthPct / 100})`,
                aspectRatio: '1 / 1',
                transform: `rotate(${LAMP.coin.rotateDeg}deg) scaleY(${LAMP.coin.scaleY})`,
                opacity: isCoinLifted ? 0 : 1,
              }}
            >
              <MetalCoinSvg
                idPrefix="desk-coin"
                isLit={reducedMotion || isLightOn || isDeskLampOn}
              />
            </div>
          </button>
        </div>

        {/* 7. ONE INLINE SVG OVERLAY FOR DARK / LAMP-ONLY STATE (covering .office-world, overflow visible, desk units) */}
        <div
          ref={darkRoomRef}
          aria-hidden="true"
          className="office-dark absolute inset-0 pointer-events-none"
          style={{
            opacity: reducedMotion ? 0 : 1,
            zIndex: 30,
          }}
        >
          <svg
            width={lampBox.worldW}
            height={lampBox.worldH}
            viewBox={`0 0 ${lampBox.worldW} ${lampBox.worldH}`}
            xmlns="http://www.w3.org/2000/svg"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: 'none',
            }}
          >
            <defs>
              {/* Soft Gaussian blur filters in desk units with wide padding so zero blur ever clips */}
              <filter id="lamp-blur-shade" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2031" height="1720">
                <feGaussianBlur stdDeviation={LAMP.holes.shade.blur} />
              </filter>
              <filter id="lamp-blur-pool" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2031" height="1720">
                <feGaussianBlur stdDeviation={LAMP.holes.pool.blur} />
              </filter>
              <filter id="lamp-blur-spill" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2031" height="1720">
                <feGaussianBlur stdDeviation={LAMP.holes.spill.blur} />
              </filter>
              <filter id="lamp-blur-base" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2031" height="1720">
                <feGaussianBlur stdDeviation={LAMP.holes.base.blur} />
              </filter>
              <filter id="lamp-blur-beam" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2031" height="1720">
                <feGaussianBlur stdDeviation={LAMP.beam.blur} />
              </filter>
              <filter id="lamp-blur-ray" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2031" height="1720">
                <feGaussianBlur stdDeviation={LAMP.beam.rayBlur} />
              </filter>
              <filter id="lamp-blur-shadow" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2031" height="1720">
                <feGaussianBlur stdDeviation="6" />
              </filter>

              <linearGradient
                id="lamp-beam-grad"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={uy(20)}
                x2="0"
                y2={uy(58.5)}
              >
                <stop offset="0%" stopColor="#FFE2AA" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#FFD696" stopOpacity="0.05" />
              </linearGradient>

              <linearGradient
                id="lamp-ray-grad"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={uy(20.1)}
                x2="0"
                y2={uy(58)}
              >
                <stop offset="0%" stopColor="#FFECBE" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#FFECBE" stopOpacity="0.06" />
              </linearGradient>

              <radialGradient id="lamp-bulb-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFF6D8" stopOpacity="0.95" />
                <stop offset="45%" stopColor="#FFD58A" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#FFD58A" stopOpacity="0" />
              </radialGradient>

              <radialGradient id="lamp-warm-pool-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFC873" stopOpacity="0.26" />
                <stop offset="100%" stopColor="#FFC873" stopOpacity="0" />
              </radialGradient>

              {/* Soft holes cut into the dark room layer */}
              <mask
                id="lampHoles"
                maskUnits="userSpaceOnUse"
                x={-400}
                y={-400}
                width={lampBox.worldW + 800}
                height={lampBox.worldH + 800}
              >
                <rect
                  x={-400}
                  y={-400}
                  width={lampBox.worldW + 800}
                  height={lampBox.worldH + 800}
                  fill="white"
                />
                <g
                  transform={`translate(${lampBox.ox}, ${lampBox.oy}) scale(${lampBox.s})`}
                  style={{
                    opacity: isDeskLampOn ? 1 : 0,
                    transition: reducedMotion ? 'none' : `opacity ${LAMP.fadeMs}ms ease-in-out`,
                  }}
                >
                  <ellipse
                    cx={ux(LAMP.holes.spill.cxPct)}
                    cy={uy(LAMP.holes.spill.cyPct)}
                    rx={ux(LAMP.holes.spill.rxPct)}
                    ry={uy(LAMP.holes.spill.ryPct)}
                    fill="black"
                    fillOpacity={LAMP.holes.spill.fillOpacity}
                    filter="url(#lamp-blur-spill)"
                  />
                  <ellipse
                    cx={ux(LAMP.holes.pool.cxPct)}
                    cy={uy(LAMP.holes.pool.cyPct)}
                    rx={ux(LAMP.holes.pool.rxPct)}
                    ry={uy(LAMP.holes.pool.ryPct)}
                    fill="black"
                    fillOpacity={LAMP.holes.pool.fillOpacity}
                    filter="url(#lamp-blur-pool)"
                  />
                  <ellipse
                    cx={ux(LAMP.holes.base.cxPct)}
                    cy={uy(LAMP.holes.base.cyPct)}
                    rx={ux(LAMP.holes.base.rxPct)}
                    ry={uy(LAMP.holes.base.ryPct)}
                    fill="black"
                    fillOpacity={LAMP.holes.base.fillOpacity}
                    filter="url(#lamp-blur-base)"
                  />
                  <ellipse
                    cx={ux(LAMP.holes.shade.cxPct)}
                    cy={uy(LAMP.holes.shade.cyPct)}
                    rx={ux(LAMP.holes.shade.rxPct)}
                    ry={uy(LAMP.holes.shade.ryPct)}
                    fill="black"
                    fillOpacity={LAMP.holes.shade.fillOpacity}
                    filter="url(#lamp-blur-shade)"
                  />
                </g>
              </mask>
            </defs>

            {/* Dark world cover with soft blurred holes when deskOn */}
            <rect
              x={-400}
              y={-400}
              width={lampBox.worldW + 800}
              height={lampBox.worldH + 800}
              fill={LAMP.darkFill}
              mask="url(#lampHoles)"
            />

            {/* Lamp-only atmospheric light, warm pool, bulb, and paper/coin shadows (all in desk units) */}
            <g
              transform={`translate(${lampBox.ox}, ${lampBox.oy}) scale(${lampBox.s})`}
              style={{
                opacity: isDeskLampOn ? 1 : 0,
                transition: reducedMotion ? 'none' : `opacity ${LAMP.fadeMs}ms ease-in-out`,
              }}
            >
              {/* Soft contact shadows under papers and coin, falling away to the right */}
              <g filter="url(#lamp-blur-shadow)">
                {LAMP.contactShadows.map((sh, idx) => (
                  <ellipse
                    key={idx}
                    cx={ux(sh.cxPct)}
                    cy={uy(sh.cyPct)}
                    rx={ux(sh.rxPct)}
                    ry={uy(sh.ryPct)}
                    fill="#0E0D0C"
                    fillOpacity={sh.opacity}
                  />
                ))}
              </g>

              {/* Soft warm pool tint on desk */}
              <ellipse
                cx={ux(LAMP.warmPool.cxPct)}
                cy={uy(LAMP.warmPool.cyPct)}
                rx={ux(LAMP.warmPool.rxPct)}
                ry={uy(LAMP.warmPool.ryPct)}
                fill="url(#lamp-warm-pool-grad)"
                style={{ mixBlendMode: 'soft-light' }}
              />

              {/* Soft beam in the air + 5 thin rays */}
              <g style={{ mixBlendMode: 'screen' }}>
                <polygon
                  points={LAMP.beam.pointsPct.map(([px, py]) => `${ux(px)},${uy(py)}`).join(' ')}
                  fill="url(#lamp-beam-grad)"
                  filter="url(#lamp-blur-beam)"
                />
                <g filter="url(#lamp-blur-ray)">
                  {LAMP.beam.rays.map((ray, idx) => (
                    <polygon
                      key={idx}
                      points={`${ux(ray.nearXPct)},${uy(ray.nearYPct)} ${ux(ray.farLeftPct)},${uy(ray.farYPct)} ${ux(ray.farRightPct)},${uy(ray.farYPct)}`}
                      fill="url(#lamp-ray-grad)"
                    />
                  ))}
                </g>
              </g>

              {/* Brightest thing in the scene: bulb glow + tiny white core */}
              <g style={{ mixBlendMode: 'screen' }}>
                <circle
                  cx={ux(LAMP.bulb.cxPct)}
                  cy={uy(LAMP.bulb.cyPct)}
                  r={ux(LAMP.bulb.rPct)}
                  fill="url(#lamp-bulb-grad)"
                />
                <circle
                  cx={ux(LAMP.bulb.cxPct)}
                  cy={uy(LAMP.bulb.cyPct)}
                  r={ux(LAMP.bulb.coreRPct)}
                  fill="#FFFFFF"
                />
              </g>
            </g>
          </svg>
        </div>

        {/* Optional ?debug=lamp geometry overlay (outlines mask holes, beam polygon & bulb centre) */}
        {debugLamp && (
          <svg
            aria-hidden="true"
            width={lampBox.worldW}
            height={lampBox.worldH}
            viewBox={`0 0 ${lampBox.worldW} ${lampBox.worldH}`}
            xmlns="http://www.w3.org/2000/svg"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: 'none',
              zIndex: 35,
            }}
          >
            <g transform={`translate(${lampBox.ox}, ${lampBox.oy}) scale(${lampBox.s})`}>
              {Object.entries(LAMP.holes).map(([name, h]) => (
                <ellipse
                  key={name}
                  cx={ux(h.cxPct)}
                  cy={uy(h.cyPct)}
                  rx={ux(h.rxPct)}
                  ry={uy(h.ryPct)}
                  fill="none"
                  stroke="#2FD27A"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
              ))}
              <polygon
                points={LAMP.beam.pointsPct.map(([px, py]) => `${ux(px)},${uy(py)}`).join(' ')}
                fill="none"
                stroke="#F2B24A"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <circle
                cx={ux(LAMP.bulb.cxPct)}
                cy={uy(LAMP.bulb.cyPct)}
                r={ux(LAMP.bulb.rPct)}
                fill="none"
                stroke="#FF6B6B"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <line
                x1={ux(LAMP.bulb.cxPct) - 14}
                y1={uy(LAMP.bulb.cyPct)}
                x2={ux(LAMP.bulb.cxPct) + 14}
                y2={uy(LAMP.bulb.cyPct)}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <line
                x1={ux(LAMP.bulb.cxPct)}
                y1={uy(LAMP.bulb.cyPct) - 14}
                x2={ux(LAMP.bulb.cxPct)}
                y2={uy(LAMP.bulb.cyPct) + 14}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </g>
          </svg>
        )}

        {/* 7d. Realistic small desk lamp rocker switch at (11.8%, 48.2%) on base front (44x44 tap target) */}
        <button
          type="button"
          data-no-tapfx
          aria-label={OFFICE_COPY.deskLampAria}
          aria-pressed={isDeskLampOn}
          aria-disabled={!isDeskLampSwitchActive ? 'true' : undefined}
          tabIndex={isDeskLampSwitchActive ? 0 : -1}
          onClick={handleDeskLampToggle}
          className="absolute flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
          style={{
            left: `calc(var(--desk-x, 0px) + var(--desk-w, 700px) * ${LAMP.switchPos.cxPct / 100})`,
            top: `calc(var(--desk-y, 0px) + var(--desk-h, 520px) * ${LAMP.switchPos.cyPct / 100})`,
            width: `${LAMP.switchPos.touchPx}px`,
            height: `${LAMP.switchPos.touchPx}px`,
            transform: 'translate(-50%, -50%)',
            opacity: isDeskLampSwitchLit ? 1 : 0,
            pointerEvents: isDeskLampSwitchActive ? 'auto' : 'none',
            transition: reducedMotion ? 'none' : `opacity ${LAMP.fadeMs}ms ease-in-out`,
            zIndex: 33,
            outline: debugHotspots ? '2px dashed #2FD27A' : undefined,
          }}
        >
          {debugHotspots && (
            <span className="font-plex text-[9px] bg-[#0E0D0C] text-[#2FD27A] px-1 absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
              switch ({LAMP.switchPos.cxPct}, {LAMP.switchPos.cyPct})
            </span>
          )}
          <div className="relative flex items-center pointer-events-none">
            <svg
              viewBox="0 0 24 34"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="block h-auto pointer-events-none"
              style={{ width: `calc(var(--desk-w, 700px) * ${LAMP.switchPos.widthPct / 100})` }}
            >
              {/* Dark switch plate with thin ink outline */}
              <rect
                x="2"
                y="2"
                width="20"
                height="30"
                rx="3"
                fill="#191613"
                stroke="#0E0D0C"
                strokeWidth="2"
              />
              <rect
                x="5"
                y="5"
                width="14"
                height="24"
                rx="1.5"
                fill="#26211C"
                stroke="#0E0D0C"
                strokeWidth="1.2"
              />
              <circle cx="12" cy="8" r="1.2" fill="#8D6124" />
              <circle cx="12" cy="26" r="1.2" fill="#8D6124" />
              {/* Bronze toggle lever flipping ±18deg over 120ms */}
              <g
                style={{
                  transformOrigin: '12px 17px',
                  transform: `rotate(${isDeskLampOn ? -18 : 18}deg)`,
                  transition: reducedMotion ? 'none' : 'transform 120ms ease-out',
                }}
              >
                <rect
                  x="7.5"
                  y="10.5"
                  width="9"
                  height="13"
                  rx="1.6"
                  fill={isDeskLampOn ? '#F2B24A' : '#C97B1A'}
                  stroke="#0E0D0C"
                  strokeWidth="1.8"
                />
                <line
                  x1="9.5"
                  y1="14"
                  x2="14.5"
                  y2="14"
                  stroke="#0E0D0C"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </g>
            </svg>

            {/* Tiny warm indicator dot beside switch in lamp-only state (mainOff && deskOn) */}
            <span
              aria-hidden="true"
              className="rounded-full pointer-events-none"
              style={{
                position: 'absolute',
                left: 'calc(100% + 4px)',
                top: '50%',
                width: '5px',
                height: '5px',
                transform: 'translateY(-50%)',
                backgroundColor: '#FFE2A8',
                boxShadow: '0 0 6px rgba(255, 213, 138, 0.9)',
                opacity: !isLightOn && isDeskLampOn && !reducedMotion ? 1 : 0,
                transition: reducedMotion ? 'none' : `opacity ${LAMP.fadeMs}ms ease-in-out`,
              }}
            />
          </div>
        </button>

        {/* 8. CEILING LAMP AND PULL CORD (inline SVG, inside .office-world so it moves with camera) */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ zIndex: 40 }}
        >
          <div className="relative w-[70px] min-[600px]:w-[90px] overflow-visible">
            {/* Pendant lamp SVG (70px on phones, 90px on desktop) */}
            <svg
              viewBox="0 0 90 66"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto block overflow-visible"
              aria-hidden="true"
            >
              {/* Faint rim outline visible in the dark (#F2B24A at 50%) */}
              <line
                x1="45"
                y1="0"
                x2="45"
                y2="20"
                stroke="rgba(242, 178, 74, 0.5)"
                strokeWidth="7"
              />
              <path
                d="M36 18 H54 V27 H36 Z"
                stroke="rgba(242, 178, 74, 0.5)"
                strokeWidth="7"
                strokeLinejoin="round"
              />
              <path
                d="M8 52 C8 32, 24 23, 45 23 C66 23, 82 32, 82 52 Z"
                stroke="rgba(242, 178, 74, 0.5)"
                strokeWidth="7"
                strokeLinejoin="round"
              />

              {/* Ceiling suspension cord */}
              <line
                x1="45"
                y1="0"
                x2="45"
                y2="20"
                stroke="#0E0D0C"
                strokeWidth="4"
              />

              {/* Socket cap */}
              <rect
                x="36"
                y="18"
                width="18"
                height="9"
                rx="2"
                fill="#C97B1A"
                stroke="#0E0D0C"
                strokeWidth="3"
              />

              {/* Bulb underside */}
              <ellipse
                ref={lampInnerGlowRef}
                cx="45"
                cy="53"
                rx="13"
                ry="6"
                fill={reducedMotion ? '#FFF3CF' : '#3E280D'}
                stroke="#0E0D0C"
                strokeWidth="3"
              />

              {/* Bronze dome shade (switches fill to #F2B24A when lit) */}
              <path
                ref={lampDomeRef}
                d="M8 52 C8 32, 24 23, 45 23 C66 23, 82 32, 82 52 Z"
                fill={reducedMotion ? '#F2B24A' : '#6E481A'}
                stroke="#0E0D0C"
                strokeWidth="3.2"
                strokeLinejoin="round"
              />

              {/* Flat comic highlight arc on left dome curve */}
              <path
                d="M17 47 C19 35, 28 29, 40 28"
                stroke="#F2B24A"
                strokeOpacity="0.65"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            {/* Swinging pull cord & horn handle (hidden in reduced motion: no cord) */}
            {!reducedMotion && (
              <button
                ref={cordButtonRef}
                type="button"
                data-no-tapfx
                tabIndex={isLampReachable ? 0 : -1}
                aria-label={OFFICE_COPY.cordAria}
                aria-pressed={isLightOn}
                onPointerDown={handleCordPointerDown}
                onPointerMove={handleCordPointerMove}
                onPointerUp={handleCordPointerUp}
                onPointerCancel={handleCordPointerUp}
                onClick={handleCordClick}
                className="pointer-events-auto absolute top-[46px] -right-[16px] min-w-[48px] min-h-[48px] w-[52px] h-[112px] flex items-start justify-center bg-transparent border-0 p-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ink)]"
                style={{
                  touchAction: 'none',
                  outline: debugHotspots ? '2px dashed #C97B1A' : undefined,
                }}
              >
                <div
                  ref={cordSwingRef}
                  className="relative flex flex-col items-center"
                  style={{ transformOrigin: '50% 0%' }}
                >
                  <div ref={cordPullRef} className="relative flex flex-col items-center">
                    <svg
                      width="28"
                      height="96"
                      viewBox="0 0 28 96"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="block overflow-visible"
                      aria-hidden="true"
                    >
                      {/* Faint rim outline (#F2B24A at 50%) so cord & horn stay visible in the dark */}
                      <line
                        x1="14"
                        y1="0"
                        x2="14"
                        y2="68"
                        stroke="rgba(242, 178, 74, 0.5)"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                      <path
                        d="M14 66 C22 68, 25 77, 19 88 C13 85, 8 79, 8 71 C8 68, 11 66, 14 66 Z"
                        stroke="rgba(242, 178, 74, 0.5)"
                        strokeWidth="6"
                        strokeLinejoin="round"
                      />

                      {/* Pull cord */}
                      <line
                        x1="14"
                        y1="0"
                        x2="14"
                        y2="68"
                        stroke="#0E0D0C"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                      <line
                        x1="14"
                        y1="2"
                        x2="14"
                        y2="66"
                        stroke="#C97B1A"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />

                      {/* Curved crescent horn handle (~22px tall) */}
                      <path
                        d="M14 66 C22 68, 25 77, 19 88 C13 85, 8 79, 8 71 C8 68, 11 66, 14 66 Z"
                        fill="#C97B1A"
                        stroke="#0E0D0C"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M15.5 69 C20 71, 21.5 77, 18.5 83.5"
                        stroke="#F2B24A"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>

                    {/* Tiny "Pull" hint beside the horn handle */}
                    <span
                      className="font-plex text-[11px] font-bold tracking-wide text-[#C97B1A] whitespace-nowrap pointer-events-none select-none transition-opacity duration-200"
                      style={{
                        position: 'absolute',
                        left: '30px',
                        top: '68px',
                        opacity: isLightOn ? 0 : 1,
                        textShadow: '0 1px 0 var(--ink)',
                      }}
                    >
                      {OFFICE_COPY.cordHint}
                    </span>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Enlarged flat inspection coin overlay (46% of stage width for 1.8s on tap, no will-change blur) */}
      {isCoinLifted && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 80, perspective: '900px' }}
        >
          <div
            ref={coinOverlayRef}
            style={{
              width: `${LAMP.coin.inspectWidthPct}%`,
              aspectRatio: '1 / 1',
            }}
          >
            <div ref={coinFlipRef} className="w-full h-full">
              <MetalCoinSvg
                idPrefix="lifted-coin"
                isLit={true}
                specularRef={coinSpecRef}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
