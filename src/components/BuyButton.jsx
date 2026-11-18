import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X_URL } from '../config.js';
import { CBULL } from '../config/cbull';
import { BUY_BUTTON, UI_COPY } from '../copy.js';
import { playSample } from '../utils/audio';
import { isDesktopViewport } from '../utils/desktop';

/** @param {{ onBuyTap?: () => void; compact?: boolean }} [props] */
export const BuyButton = ({ onBuyTap, compact = false } = {}) => {
  const [stampActive, setStampActive] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [shineState, setShineState] = useState(null); // { alt: boolean } | null

  const triggerBtnRef = useRef(null);
  const dismissBtnRef = useRef(null);
  const shineTimerRef = useRef(null);
  const lastFeedbackMsRef = useRef(0);

  const trimmedBuyUrl =
    CBULL.isLive && typeof CBULL.buyUrl === 'string' ? CBULL.buyUrl.trim() : '';
  const hasValidBuyUrl = trimmedBuyUrl.startsWith('https://');
  const trimmedXUrl = typeof X_URL === 'string' ? X_URL.trim() : '';
  const followXHref = trimmedXUrl.startsWith('https://') ? trimmedXUrl : 'https://x.com';

  useEffect(() => {
    return () => {
      if (shineTimerRef.current) clearTimeout(shineTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!stampActive || !isDesktopViewport()) return;
    const focusTimer = window.setTimeout(() => {
      dismissBtnRef.current?.focus({ preventScroll: true });
    }, 20);
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setStampActive(false);
        triggerBtnRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [stampActive]);

  const triggerPressFeedback = useCallback(() => {
    const now = performance.now();
    if (now - lastFeedbackMsRef.current < 80) return;
    lastFeedbackMsRef.current = now;

    playSample('snort', { gain: 0.7 });

    if (shineTimerRef.current) {
      clearTimeout(shineTimerRef.current);
      shineTimerRef.current = null;
    }
    setShineState((prev) => ({ alt: !prev?.alt }));
    shineTimerRef.current = window.setTimeout(() => {
      setShineState(null);
      shineTimerRef.current = null;
    }, 280);
  }, []);

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    setIsPressed(true);
    triggerPressFeedback();
  };

  const handlePointerRelease = () => {
    setIsPressed(false);
  };

  const handleEmptyButtonClick = () => {
    triggerPressFeedback();
    setStampActive(true);
    if (onBuyTap) onBuyTap();
  };

  const handleAnchorClick = () => {
    triggerPressFeedback();
    if (onBuyTap) onBuyTap();
  };

  const ctaContent = (
    <>
      {/* Bronze shine sweep layer (260ms on press) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {shineState && (
          <span
            className="buy-cta-shine absolute inset-y-0 -left-1/2 w-1/2 pointer-events-none"
            style={{
              animationName: shineState.alt ? 'buyShineSweepA' : 'buyShineSweepB',
            }}
          />
        )}
      </span>

      <span
        className={`relative z-10 flex items-center justify-center whitespace-nowrap leading-none ${
          compact ? 'text-xl tracking-[0.02em]' : 'text-[clamp(26px,8.4vw,42px)] tracking-[0.02em]'
        }`}
      >
        <span className="whitespace-nowrap">{BUY_BUTTON.label}</span>
      </span>
      <span
        className={`relative z-10 block font-plex tracking-widest text-black/80 font-bold ${
          compact ? 'text-[10px] mt-0.5' : 'text-xs mt-1'
        }`}
      >
        {BUY_BUTTON.subtitle}
      </span>
    </>
  );

  const ctaClassName = `buy-cta ${
    isPressed ? 'buy-cta-pressed' : ''
  } relative w-full min-h-[44px] ${
    compact ? 'py-2 px-3' : 'py-4 px-4 sm:px-6'
  } font-anton uppercase text-black border-2 border-black text-center block cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-[#F2B24A] focus-visible:ring-offset-2 focus-visible:ring-offset-black`;

  const ctaStyle = {
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  };

  return (
    <div
      className={`relative flex flex-col items-center w-full select-none ${
        compact ? 'max-w-[230px] px-0' : 'max-w-sm px-4'
      }`}
    >
      {/* Order Ticket Container */}
      <div
        className={`relative w-full bg-[#0E0D0C] border-2 ${
          compact
            ? 'border-[#C97B1A] p-2.5 shadow-[3px_3px_0px_#C97B1A]'
            : 'sm:border-3 border-[#C97B1A] p-4 sm:p-5 shadow-[4px_4px_0px_#C97B1A]'
        } rounded-none`}
      >
        {/* Ticket Header */}
        <div
          className={`flex items-center justify-between border-b border-[#C97B1A]/40 font-plex text-[#E8DFC9]/70 tracking-widest uppercase ${
            compact ? 'pb-1 mb-2 text-[9px]' : 'pb-2 mb-3 text-[11px]'
          }`}
        >
          <span>{UI_COPY.buyTicket.header}</span>
        </div>

        {/* Action Element: real <a> when BUY_URL is set, <button> when empty */}
        {hasValidBuyUrl ? (
          <a
            href={trimmedBuyUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-no-tapfx
            aria-label={UI_COPY.buyTicket.buttonAria}
            className={`${ctaClassName} no-underline`}
            style={ctaStyle}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerRelease}
            onPointerCancel={handlePointerRelease}
            onPointerLeave={handlePointerRelease}
            onClick={handleAnchorClick}
          >
            {ctaContent}
          </a>
        ) : (
          <button
            ref={triggerBtnRef}
            type="button"
            data-no-tapfx
            aria-label={UI_COPY.buyTicket.buttonAria}
            className={ctaClassName}
            style={ctaStyle}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerRelease}
            onPointerCancel={handlePointerRelease}
            onPointerLeave={handlePointerRelease}
            onClick={handleEmptyButtonClick}
          >
            {ctaContent}
          </button>
        )}

        {/* Red Stamp Overlay when BUY_URL is empty */}
        {stampActive && (
          <div
            className="absolute inset-0 bg-black/92 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 border-2 border-[#C23B22] animate-stamp"
            role="dialog"
            aria-modal="true"
            aria-label={UI_COPY.buyTicket.orderStatusAria}
          >
            {/* The Slammed Red Stamp */}
            <div className="border-4 sm:border-[6px] border-[#C23B22] text-[#C23B22] px-4 py-2 sm:px-6 sm:py-3 font-anton text-xl sm:text-2xl text-center tracking-wider rotate-[-6deg] uppercase shadow-[0_0_0_2px_#000]">
              {BUY_BUTTON.pendingStamp}
            </div>

            {/* Launch Status and X Link */}
            <p className="font-plex text-xs sm:text-sm text-[#E8DFC9] text-center mt-4">
              {BUY_BUTTON.notLiveText}
            </p>

            <div className="mt-4 flex flex-col sm:flex-row gap-2 w-full">
              <a
                href={followXHref}
                target="_blank"
                rel="noopener noreferrer"
                data-no-tapfx
                className="w-full min-h-[44px] flex items-center justify-center text-center py-2 px-4 bg-[#C23B22] hover:bg-[#a8321b] text-white font-plex text-xs font-bold tracking-wider uppercase border border-black shadow-[2px_2px_0_#000] focus-visible:ring-2 focus-visible:ring-[#F2B24A] outline-none"
              >
                {BUY_BUTTON.notLiveLinkText}
              </a>
              <button
                ref={dismissBtnRef}
                type="button"
                data-no-tapfx
                onClick={() => {
                  setStampActive(false);
                  if (isDesktopViewport()) {
                    triggerBtnRef.current?.focus({ preventScroll: true });
                  }
                }}
                className="min-h-[44px] py-2 px-4 bg-transparent hover:bg-white/10 text-[#E8DFC9]/80 font-plex text-xs border border-[#E8DFC9]/30 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F2B24A] outline-none"
              >
                {UI_COPY.buyTicket.dismiss}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .buy-cta {
          background-color: #C97B1A;
          box-shadow: 3px 5px 0 #824e0e;
          transform: translate3d(0, 0, 0);
          transition: transform 80ms ease-out, box-shadow 80ms ease-out, background-color 140ms ease;
        }
        @media (hover: hover) {
          .buy-cta:hover {
            background-color: #d88720;
          }
        }
        .buy-cta:active,
        .buy-cta.buy-cta-pressed {
          background-color: #F2B24A;
          transform: translate3d(2px, 3px, 0);
          box-shadow: 1px 2px 0 #824e0e;
        }
        .buy-cta-shine {
          background: rgba(255, 238, 198, 0.5);
          transform: skewX(-20deg) translateX(-120%);
          animation-duration: 260ms;
          animation-timing-function: ease-out;
          animation-fill-mode: forwards;
        }
        @keyframes buyShineSweepA {
          0% {
            transform: skewX(-20deg) translateX(-120%);
            opacity: 0.9;
          }
          100% {
            transform: skewX(-20deg) translateX(340%);
            opacity: 0;
          }
        }
        @keyframes buyShineSweepB {
          0% {
            transform: skewX(-20deg) translateX(-120%);
            opacity: 0.9;
          }
          100% {
            transform: skewX(-20deg) translateX(340%);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .buy-cta-shine {
            animation: none !important;
            display: none;
          }
        }
      `}</style>
    </div>
  );
};
