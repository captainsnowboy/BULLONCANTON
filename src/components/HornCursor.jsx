import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { isDesktopViewport } from '../utils/desktop';

const SMOOTHING = 0.18;
const MAX_DEMO_ATTEMPTS = 3; // 1 initial + 2 repeats after 6s idle
const DEMO_REPEAT_MS = 6000;

export const HornCursor = ({
  hostRef,
  isInteractive = false,
  reducedMotion = false,
  onHintHoverChange,
  onHintPulse,
}) => {
  const cursorRef = useRef(null);
  const hornInnerRef = useRef(null);
  const ringRef = useRef(null);

  const isInteractiveRef = useRef(isInteractive);
  const reducedMotionRef = useRef(reducedMotion);
  const onHintHoverChangeRef = useRef(onHintHoverChange);
  const onHintPulseRef = useRef(onHintPulse);

  useEffect(() => {
    isInteractiveRef.current = isInteractive;
  }, [isInteractive]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    onHintHoverChangeRef.current = onHintHoverChange;
  }, [onHintHoverChange]);

  useEffect(() => {
    onHintPulseRef.current = onHintPulse;
  }, [onHintPulse]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const hostEl = hostRef?.current;
    const cursorEl = cursorRef.current;
    const hornInnerEl = hornInnerRef.current;
    const ringEl = ringRef.current;
    if (!hostEl || !cursorEl || !hornInnerEl || !ringEl) return;

    const fineQuery = window.matchMedia('(pointer: fine)');
    let isFine = fineQuery.matches;

    // Scoped style hiding native cursor strictly inside the active screen host via JS
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-horn-screen-cursor', 'true');
    styleEl.textContent = `
      [data-horn-active="true"],
      [data-horn-active="true"] * {
        cursor: none !important;
      }
    `;
    document.head.appendChild(styleEl);

    let isPointerInside = false;
    let isPressed = false;
    let isTilted = false;
    let isHintPlaying = false;
    let hasUserInteracted = false;
    let demoAttempts = 0;

    const targetPos = { x: -100, y: -100 };
    const currentPos = { x: -100, y: -100 };
    let lastClientX = -100;
    let lastClientY = -100;
    let rafId = null;

    let ringTween = null;
    let fadeTween = null;
    let touchHideTimer = null;
    let touchSquashTimer = null;
    let demoRepeatTimer = null;
    let hintTl = null;
    let hintRafId = null;

    const setHostNativeHidden = (hide) => {
      if (hide && isFine && isInteractiveRef.current) {
        hostEl.setAttribute('data-horn-active', 'true');
      } else {
        hostEl.removeAttribute('data-horn-active');
      }
    };

    const setRestingPulse = (active) => {
      if (
        active &&
        !isFine &&
        !reducedMotionRef.current &&
        isInteractiveRef.current &&
        !hasUserInteracted
      ) {
        hornInnerEl.classList.add('horn-rest-pulse');
      } else {
        hornInnerEl.classList.remove('horn-rest-pulse');
      }
    };

    const applyHornTransform = () => {
      const rm = reducedMotionRef.current;
      const scale = !rm && isPressed ? 0.85 : 1;
      const rot = !rm && isTilted ? 12 : 0;
      hornInnerEl.style.transform = `rotate(${rot}deg) scale(${scale})`;
    };

    const stopRaf = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const positionAt = (x, y) => {
      currentPos.x = x;
      currentPos.y = y;
      cursorEl.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    };

    const clientToHostLocal = (clientX, clientY) => {
      const rect = hostEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: 0, y: 0 };
      const scaleX = hostEl.offsetWidth / rect.width;
      const scaleY = hostEl.offsetHeight / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const getCenterPos = () => ({
      x: Math.max(16, hostEl.offsetWidth / 2),
      y: Math.max(16, hostEl.offsetHeight / 2),
    });

    const getFirstRowPos = () => {
      const firstRowEl = hostEl.querySelector('[data-monitor-first-row="true"]');
      if (!firstRowEl) return null;
      const hostRect = hostEl.getBoundingClientRect();
      const rowRect = firstRowEl.getBoundingClientRect();
      if (!hostRect.width || !hostRect.height || !rowRect.width) return null;
      const scaleX = hostEl.offsetWidth / hostRect.width;
      const scaleY = hostEl.offsetHeight / hostRect.height;
      return {
        x: (rowRect.left + rowRect.width * 0.42 - hostRect.left) * scaleX,
        y: (rowRect.top + rowRect.height * 0.5 - hostRect.top) * scaleY,
      };
    };

    const showCursorInstant = () => {
      if (fadeTween) {
        fadeTween.kill();
        fadeTween = null;
      }
      cursorEl.style.opacity = '1';
    };

    const fadeOutCursor = (durationSec = 0.12) => {
      if (fadeTween) {
        fadeTween.kill();
        fadeTween = null;
      }
      if (reducedMotionRef.current || durationSec <= 0) {
        cursorEl.style.opacity = '0';
        return;
      }
      fadeTween = gsap.to(cursorEl, {
        opacity: 0,
        duration: durationSec,
        ease: 'power2.out',
        onComplete: () => {
          fadeTween = null;
        },
      });
    };

    const triggerRing = () => {
      if (reducedMotionRef.current) return;
      if (ringTween) ringTween.kill();
      ringTween = gsap.fromTo(
        ringEl,
        { scale: 0.2, opacity: 0.95 },
        {
          scale: 1.75,
          opacity: 0,
          duration: 0.22,
          ease: 'power2.out',
          onComplete: () => {
            ringTween = null;
          },
        }
      );
    };

    const tick = () => {
      if (!isPointerInside || isHintPlaying || !isFine || reducedMotionRef.current) {
        rafId = null;
        return;
      }

      currentPos.x += (targetPos.x - currentPos.x) * SMOOTHING;
      currentPos.y += (targetPos.y - currentPos.y) * SMOOTHING;
      cursorEl.style.transform = `translate3d(${currentPos.x.toFixed(2)}px, ${currentPos.y.toFixed(2)}px, 0)`;

      if (
        Math.abs(targetPos.x - currentPos.x) < 0.15 &&
        Math.abs(targetPos.y - currentPos.y) < 0.15
      ) {
        positionAt(targetPos.x, targetPos.y);
        rafId = null;
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    const startRaf = () => {
      if (reducedMotionRef.current) {
        positionAt(targetPos.x, targetPos.y);
        return;
      }
      if (rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const cancelDemo = () => {
      if (demoRepeatTimer !== null) {
        clearTimeout(demoRepeatTimer);
        demoRepeatTimer = null;
      }
      if (hintRafId !== null) {
        cancelAnimationFrame(hintRafId);
        hintRafId = null;
      }
      if (hintTl) {
        hintTl.kill();
        hintTl = null;
      }
      if (isHintPlaying) {
        isHintPlaying = false;
        isPressed = false;
        isTilted = false;
        applyHornTransform();
        onHintHoverChangeRef.current?.(false);
      }
      setRestingPulse(false);
    };

    const runDemoCycle = () => {
      if (
        hasUserInteracted ||
        reducedMotionRef.current ||
        !isInteractiveRef.current ||
        demoAttempts >= MAX_DEMO_ATTEMPTS
      ) {
        return;
      }

      const rowPos = getFirstRowPos();
      if (!rowPos) return;

      demoAttempts += 1;
      isHintPlaying = true;
      setRestingPulse(false);
      stopRaf();
      showCursorInstant();

      const center = getCenterPos();
      const startX = isFine
        ? center.x
        : demoAttempts === 1
          ? center.x
          : Math.min(hostEl.offsetWidth - 20, rowPos.x + 42);
      const startY = isFine
        ? center.y
        : demoAttempts === 1
          ? center.y
          : Math.min(hostEl.offsetHeight - 20, rowPos.y + 24);

      const proxy = { x: startX, y: startY };
      positionAt(startX, startY);
      isPressed = false;
      isTilted = false;
      applyHornTransform();

      hintTl = gsap.timeline({
        onComplete: () => {
          hintTl = null;
          isHintPlaying = false;
          isPressed = false;
          isTilted = false;
          applyHornTransform();
          onHintHoverChangeRef.current?.(false);

          if (!isInteractiveRef.current) return;

          if (hasUserInteracted) {
            if (isFine && isPointerInside) {
              showCursorInstant();
              startRaf();
            }
            return;
          }

          if (isFine) {
            positionAt(center.x, center.y);
            showCursorInstant();
          } else {
            positionAt(rowPos.x, rowPos.y);
            showCursorInstant();
            setRestingPulse(true);
          }

          if (demoAttempts < MAX_DEMO_ATTEMPTS) {
            demoRepeatTimer = window.setTimeout(() => {
              demoRepeatTimer = null;
              runDemoCycle();
            }, DEMO_REPEAT_MS);
          }
        },
      });

      // 1. Glide from starting point to the first row (0 -> 0.72s)
      hintTl.to(
        proxy,
        {
          x: rowPos.x,
          y: rowPos.y,
          duration: 0.72,
          ease: 'power2.inOut',
          onUpdate: () => positionAt(proxy.x, proxy.y),
        },
        0
      );

      // Tilt as horn reaches the first row
      hintTl.add(() => {
        isTilted = true;
        applyHornTransform();
      }, 0.56);

      // 2. Arrive on first row: show hover highlight & pulse row twice; rest 0.5s (0.72 -> 1.22s)
      hintTl.add(() => {
        onHintHoverChangeRef.current?.(true);
        onHintPulseRef.current?.();
      }, 0.72);

      hintTl.to({}, { duration: 0.5 }, 0.72);

      // 3. Simulated tap at 1.22s (press squash + expanding ring, no click dispatched)
      hintTl.add(() => {
        isPressed = true;
        applyHornTransform();
        triggerRing();
      }, 1.22);

      hintTl.add(() => {
        isPressed = false;
        applyHornTransform();
      }, 1.36);

      // Brief settle after tap before returning to center (desktop) or resting pulse (phone)
      hintTl.to({}, { duration: 0.16 }, 1.36);

      hintTl.add(() => {
        onHintHoverChangeRef.current?.(false);
        isTilted = false;
        applyHornTransform();
      }, 1.52);

      if (isFine) {
        hintTl.to(
          proxy,
          {
            x: center.x,
            y: center.y,
            duration: 0.45,
            ease: 'power2.out',
            onUpdate: () => positionAt(proxy.x, proxy.y),
          },
          1.52
        );
      }
    };

    const handleActivate = () => {
      if (!isInteractiveRef.current) return;
      hasUserInteracted = false;
      demoAttempts = 0;
      cancelDemo();

      const center = getCenterPos();
      const rowPos = getFirstRowPos();
      setHostNativeHidden(isFine);

      if (isFine) {
        positionAt(center.x, center.y);
      } else if (rowPos) {
        positionAt(rowPos.x, rowPos.y);
      } else {
        positionAt(center.x, center.y);
      }

      isPressed = false;
      isTilted = false;
      applyHornTransform();
      showCursorInstant();

      if (reducedMotionRef.current) {
        return;
      }

      if (hintRafId !== null) cancelAnimationFrame(hintRafId);
      hintRafId = requestAnimationFrame(() => {
        hintRafId = null;
        runDemoCycle();
      });
    };

    const handleDeactivate = () => {
      hasUserInteracted = false;
      demoAttempts = 0;
      cancelDemo();
      isPointerInside = false;
      isPressed = false;
      isTilted = false;
      applyHornTransform();
      stopRaf();
      setHostNativeHidden(false);
      fadeOutCursor(0);
    };

    const handleMouseMove = (e) => {
      if (!isFine || !isInteractiveRef.current) return;

      const movedDist =
        lastClientX < 0 ? 99 : Math.hypot(e.clientX - lastClientX, e.clientY - lastClientY);
      lastClientX = e.clientX;
      lastClientY = e.clientY;

      if (movedDist < 0.5) return;

      if (!hasUserInteracted) {
        hasUserInteracted = true;
        cancelDemo();
      }

      const wasInside = isPointerInside;
      isPointerInside = true;
      setHostNativeHidden(true);

      const target = e.target instanceof Element ? e.target : null;
      const overInteractive = Boolean(
        target && target.closest('button:not([disabled]), a[href], [role="button"]')
      );
      if (overInteractive !== isTilted) {
        isTilted = overInteractive;
        applyHornTransform();
      }

      const local = clientToHostLocal(e.clientX, e.clientY);
      targetPos.x = local.x;
      targetPos.y = local.y;

      showCursorInstant();
      if (!wasInside || reducedMotionRef.current) {
        positionAt(local.x, local.y);
      } else {
        startRaf();
      }
    };

    const handleMouseLeave = () => {
      isPointerInside = false;
      isPressed = false;
      isTilted = false;
      if (isDesktopViewport()) {
        setHostNativeHidden(false);
      }
      applyHornTransform();
      stopRaf();
      if (!isHintPlaying && hasUserInteracted) {
        fadeOutCursor(0.12);
      }
    };

    const handleScroll = () => {
      if (!isFine || !isPointerInside || lastClientX < 0 || lastClientY < 0) return;
      const el = document.elementFromPoint(lastClientX, lastClientY);
      if (!el || !hostEl.contains(el) || !isInteractiveRef.current) {
        handleMouseLeave();
      }
    };

    const handlePointerDown = (e) => {
      if (!isInteractiveRef.current) return;

      if (!hasUserInteracted) {
        hasUserInteracted = true;
        cancelDemo();
      }

      // Desktop fine pointer press
      if (isFine && e.pointerType !== 'touch') {
        isPointerInside = true;
        setHostNativeHidden(true);
        const local = clientToHostLocal(e.clientX, e.clientY);
        targetPos.x = local.x;
        targetPos.y = local.y;
        positionAt(local.x, local.y);
        showCursorInstant();
        isPressed = true;
        applyHornTransform();
        triggerRing();
        return;
      }

      // Touch (coarse pointer): stop resting horn, flash tap squash + ring, then fade out
      if (!reducedMotionRef.current) {
        if (touchHideTimer) {
          clearTimeout(touchHideTimer);
          touchHideTimer = null;
        }
        if (touchSquashTimer) {
          clearTimeout(touchSquashTimer);
          touchSquashTimer = null;
        }
        const local = clientToHostLocal(e.clientX, e.clientY);
        positionAt(local.x, local.y);
        showCursorInstant();
        isTilted = false;
        isPressed = true;
        applyHornTransform();
        triggerRing();

        touchSquashTimer = window.setTimeout(() => {
          touchSquashTimer = null;
          isPressed = false;
          applyHornTransform();
        }, 120);

        touchHideTimer = window.setTimeout(() => {
          touchHideTimer = null;
          fadeOutCursor(0.15);
        }, 500);
      } else {
        fadeOutCursor(0);
      }
    };

    const handlePointerUp = () => {
      if (isPressed) {
        isPressed = false;
        applyHornTransform();
      }
    };

    const handlePointerMediaChange = (e) => {
      isFine = e.matches;
      setHostNativeHidden(isFine && isInteractiveRef.current);
      if (!isFine && !hasUserInteracted && !isHintPlaying && isInteractiveRef.current) {
        const rowPos = getFirstRowPos();
        if (rowPos) {
          positionAt(rowPos.x, rowPos.y);
          showCursorInstant();
          setRestingPulse(true);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (isDesktopViewport() && document.hidden) {
        handleMouseLeave();
      }
    };

    fineQuery.addEventListener('change', handlePointerMediaChange);
    hostEl.addEventListener('mousemove', handleMouseMove, { passive: true });
    hostEl.addEventListener('mouseleave', handleMouseLeave);
    hostEl.addEventListener('pointerdown', handlePointerDown, { passive: true });
    hostEl.addEventListener('horn:activate', handleActivate);
    hostEl.addEventListener('horn:deactivate', handleDeactivate);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      stopRaf();
      cancelDemo();
      if (ringTween) ringTween.kill();
      if (fadeTween) fadeTween.kill();
      if (touchHideTimer) clearTimeout(touchHideTimer);
      if (touchSquashTimer) clearTimeout(touchSquashTimer);
      hostEl.removeAttribute('data-horn-active');
      styleEl.remove();
      fineQuery.removeEventListener('change', handlePointerMediaChange);
      hostEl.removeEventListener('mousemove', handleMouseMove);
      hostEl.removeEventListener('mouseleave', handleMouseLeave);
      hostEl.removeEventListener('pointerdown', handlePointerDown);
      hostEl.removeEventListener('horn:activate', handleActivate);
      hostEl.removeEventListener('horn:deactivate', handleDeactivate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [hostRef]);

  // React to interactivity / reduced-motion changes
  useEffect(() => {
    const hostEl = hostRef?.current;
    if (!hostEl) return;

    if (!isInteractive) {
      hostEl.dispatchEvent(new CustomEvent('horn:deactivate'));
      return;
    }

    hostEl.dispatchEvent(new CustomEvent('horn:activate'));
  }, [hostRef, isInteractive, reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 20 }}
    >
      <div
        ref={cursorRef}
        className="absolute top-0 left-0 pointer-events-none"
        style={{
          opacity: 0,
          willChange: 'transform',
        }}
      >
        {/* Expanding tip ring on press/tap (220ms) */}
        <div
          ref={ringRef}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: '0px',
            top: '0px',
            width: '22px',
            height: '22px',
            marginLeft: '-11px',
            marginTop: '-11px',
            border: '2px solid #F2B24A',
            boxShadow: '0 0 0 1px #0E0D0C',
            opacity: 0,
          }}
        />

        {/* Curved crescent horn SVG (28px tall, tip hotspot at (2, 2)) */}
        <div
          ref={hornInnerRef}
          className="pointer-events-none"
          style={{
            marginLeft: '-2px',
            marginTop: '-2px',
            transformOrigin: '2px 2px',
            transition: reducedMotion ? 'none' : 'transform 110ms ease-out',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="block overflow-visible"
          >
            {/* Bronze horn body with 2px ink outline */}
            <path
              d="M 2 2 C 12 3 21 9 24.5 20.5 C 21.5 24 17 25 14 23.5 C 12 15.5 8 9 2 2 Z"
              fill="#C97B1A"
              stroke="#0E0D0C"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Flat comic highlight along outer crescent */}
            <path
              d="M 6.5 4.4 C 12.8 5.6 18.4 10.2 21.2 17.8 C 19.3 18.2 17.8 16.8 16.8 14.5 C 14.4 9.8 10.6 6.2 6.5 4.4 Z"
              fill="#F2B24A"
            />
            {/* Flat base ridge */}
            <path
              d="M 14.2 21.5 C 17.2 22.8 20.6 22 23.6 19"
              stroke="#0E0D0C"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
