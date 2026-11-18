import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BuyButton } from '../components/BuyButton';
import { X_URL, TELEGRAM_URL } from '../config.js';
import { CBULL } from '../config/cbull';
import { HERD_COPY, CREDITS_COPY } from '../copy.js';
import { playHoofThuds, playSample } from '../utils/audio';
import { subscribeStampede } from '../utils/stampede';
import { Reveal } from '../components/Reveal';

// =========================================================================
// ENTRANCE & TRANSITION CONSTANTS
// =========================================================================
export const ENTRANCE_HERD_THRESHOLD = 0.2; // 20% visible
export const ENTRANCE_HERD_COUNT = 5;
export const ENTRANCE_HERD_MIN_HEIGHT = 28; // px
export const ENTRANCE_HERD_MAX_HEIGHT = 44; // px
export const ENTRANCE_HERD_STAGGER_MAX = 1.2; // s
export const ENTRANCE_HERD_MAX_ON_SCREEN = 8;
export const ENTRANCE_HERD_FALLBACK_MS = 2000;

const XMarkIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-5 h-5 shrink-0"
    fill="#C97B1A"
    aria-hidden="true"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const PaperPlaneIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-5 h-5 shrink-0"
    fill="#C97B1A"
    aria-hidden="true"
  >
    <path d="M21.5 3.5L2.5 11.2l6.2 2.3 2.4 6.5 3.1-3.5 4.8 3.5L21.5 3.5zM9.2 13.7l8.5-6.6-6.2 7.8-.4 2.9-1.9-4.1z" />
  </svg>
);

const CopyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-3.5 h-3.5 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="13" height="13" rx="1" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </svg>
);

const SocialTicketButton = ({
  label,
  url,
  soonAria,
  linkAria,
  icon,
  isHopping,
  hopDelayMs = 0,
  prefersReducedMotion,
}) => {
  const [isShaking, setIsShaking] = useState(false);
  const [showSoonTag, setShowSoonTag] = useState(false);
  const shakeTimerRef = useRef(null);
  const soonTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (soonTimerRef.current) clearTimeout(soonTimerRef.current);
    };
  }, []);

  const trimmedUrl = typeof url === 'string' ? url.trim() : '';
  const hasUrl = trimmedUrl !== '';

  const handleDummyClick = () => {
    playSample('snort', { gain: 0.7 });

    if (!prefersReducedMotion) {
      setIsShaking(false);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      requestAnimationFrame(() => {
        setIsShaking(true);
        shakeTimerRef.current = window.setTimeout(() => {
          setIsShaking(false);
          shakeTimerRef.current = null;
        }, 320);
      });
    }

    setShowSoonTag(true);
    if (soonTimerRef.current) clearTimeout(soonTimerRef.current);
    soonTimerRef.current = window.setTimeout(() => {
      setShowSoonTag(false);
      soonTimerRef.current = null;
    }, 1400);
  };

  const baseTicketClass =
    'relative w-full min-h-[56px] px-3 py-2.5 bg-[#0E0D0C] border-2 border-[#C97B1A] shadow-[3px_3px_0_#C97B1A] flex items-center justify-center gap-2.5 select-none outline-none transition-colors hover:bg-[#171410] hover:border-[#F2B24A] focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:ring-offset-2 focus-visible:ring-offset-black';

  return (
    <div
      className={`relative w-full ${
        isHopping && !prefersReducedMotion ? 'animate-social-hop' : ''
      }`}
      style={
        isHopping && !prefersReducedMotion && hopDelayMs > 0
          ? { animationDelay: `${hopDelayMs}ms` }
          : undefined
      }
    >
      {!hasUrl && showSoonTag && (
        <span
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 bg-[#C97B1A] text-black border border-black shadow-[2px_2px_0_#000] font-plex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 whitespace-nowrap z-20"
        >
          {HERD_COPY.socials.soon}
        </span>
      )}

      {hasUrl ? (
        <a
          href={trimmedUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-no-tapfx
          aria-label={linkAria}
          className={`${baseTicketClass} cursor-pointer active:translate-y-0.5`}
        >
          {icon}
          <span className="font-anton text-lg sm:text-xl tracking-wider uppercase text-white whitespace-nowrap">
            {label}
          </span>
        </a>
      ) : (
        <button
          type="button"
          data-no-tapfx
          aria-disabled="true"
          aria-label={soonAria}
          onClick={handleDummyClick}
          className={`${baseTicketClass} cursor-pointer ${
            isShaking && !prefersReducedMotion ? 'animate-social-shake' : ''
          }`}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 bg-[#C97B1A] text-black font-plex text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 leading-none border-b border-l border-black"
          >
            {HERD_COPY.socials.soon}
          </span>
          {icon}
          <span className="font-anton text-lg sm:text-xl tracking-wider uppercase text-white whitespace-nowrap">
            {label}
          </span>
        </button>
      )}
    </div>
  );
};

async function copyAddressText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to textarea + execCommand fallback (iOS Safari)
    }
  }

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    textarea.style.fontSize = '16px';
    document.body.appendChild(textarea);

    try {
      textarea.focus({ preventScroll: true });
    } catch {
      textarea.focus();
    }
    textarea.select();
    if (typeof textarea.setSelectionRange === 'function') {
      textarea.setSelectionRange(0, textarea.value.length);
    }

    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  }

  return false;
}

const AddressTicketCard = () => {
  const [isCopied, setIsCopied] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const copyTimerRef = useRef(null);
  const addressTextRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const fullAddress = typeof CBULL.tokenAddress === 'string' ? CBULL.tokenAddress.trim() : '';
  const hasAddress = fullAddress !== '';
  const buyUrl = typeof CBULL.buyUrl === 'string' ? CBULL.buyUrl.trim() : '';
  const hasBuyUrl = buyUrl.startsWith('https://');

  const selectAddressNode = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const node = addressTextRef.current;
    if (!node) return;
    try {
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      // Selection unavailable
    }
  };

  const handleCopy = async () => {
    if (!hasAddress) return;
    const copied = await copyAddressText(fullAddress);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);

    if (copied) {
      setIsCopied(true);
      setLiveMessage(HERD_COPY.address.copiedLive);
      copyTimerRef.current = window.setTimeout(() => {
        setIsCopied(false);
        setLiveMessage('');
        copyTimerRef.current = null;
      }, 2000);
    } else {
      selectAddressNode();
      setLiveMessage(HERD_COPY.address.copyFailedLive);
      copyTimerRef.current = window.setTimeout(() => {
        setLiveMessage('');
        copyTimerRef.current = null;
      }, 2000);
    }
  };

  return (
    <div className="w-full bg-[#0E0D0C] border-2 border-[#C97B1A] shadow-[3px_3px_0_#C97B1A] px-3.5 py-2.5 flex flex-col gap-1.5 text-left">
      <div className="font-plex text-[10px] font-bold uppercase tracking-widest text-[#C97B1A]">
        {HERD_COPY.address.label}
      </div>

      <div className="flex items-center justify-between gap-2.5 min-h-[44px]">
        <span
          ref={addressTextRef}
          data-testid="token-address-value"
          className="flex-1 min-w-0 font-plex text-xs sm:text-[13px] text-[#E8DFC9] break-all leading-snug select-all"
        >
          {fullAddress}
        </span>

        <button
          type="button"
          data-no-tapfx
          onClick={handleCopy}
          aria-label={HERD_COPY.address.copyAria}
          className={`shrink-0 min-h-[44px] min-w-[88px] px-3 inline-flex items-center justify-center gap-1.5 font-plex text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0D0C] ${
            isCopied
              ? 'border-[#2FD27A] bg-[#2FD27A] text-[#0E0D0C]'
              : 'border-[#C97B1A] bg-[#171410] text-[#F2B24A] hover:bg-[#C97B1A] hover:text-black'
          }`}
        >
          <CopyIcon />
          <span>{isCopied ? HERD_COPY.address.copiedButton : HERD_COPY.address.copyButton}</span>
        </button>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </span>

      {hasBuyUrl && (
        <div className="pt-0.5">
          <a
            href={buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-no-tapfx
            className="inline-block font-plex text-xs font-semibold text-[#F2B24A] underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F2B24A]"
          >
            {HERD_COPY.address.viewOnSupanova}
          </a>
        </div>
      )}

      <p className="font-plex text-[11px] text-[#E8DFC9]/75 leading-snug m-0">
        {HERD_COPY.address.safetyNote}
      </p>
    </div>
  );
};

/**
 * @param {{ onOpenCredits?: () => void; liveHoldersCount?: string | null }} props
 */
export const Herd = ({ onOpenCredits, liveHoldersCount = null }) => {
  const [herdSize, setHerdSize] = useState(0);
  const [isStampeding, setIsStampeding] = useState(false);
  const [stampedeBulls, setStampedeBulls] = useState([]);
  const [isHopping, setIsHopping] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const isStampedingRef = useRef(false);
  const cleanupTimerRef = useRef(null);
  const hopStartTimerRef = useRef(null);
  const hopEndTimerRef = useRef(null);

  const sectionRef = useRef(null);
  const [entranceBulls, setEntranceBulls] = useState([]);
  const hasTriggeredEntranceHerdRef = useRef(false);
  const entranceCleanupTimerRef = useRef(null);

  // Sync prefers-reduced-motion preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const onChange = (e) => setPrefersReducedMotion(e.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', onChange);
      return () => mediaQuery.removeEventListener('change', onChange);
    }
    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
  }, []);

  // "The herd passes" Entrance:
  // When Herd section is 20% visible, 5 small copies of bull-charge.webp (28 to 44px tall)
  // run once, left to right, along the section's top divider line with a small bob,
  // staggered over 1.2s, then are removed.
  useEffect(() => {
    if (!sectionRef.current) return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;

    const updateDividerY = () => {
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        document.documentElement.style.setProperty('--herd-divider-y', `${rect.top}px`);
      }
    };

    const triggerEntranceHerd = () => {
      if (hasTriggeredEntranceHerdRef.current) return;
      hasTriggeredEntranceHerdRef.current = true;

      updateDividerY();
      window.addEventListener('scroll', updateDividerY, { passive: true });

      const newBulls = [];
      let maxFinishTime = 0;

      for (let i = 0; i < ENTRANCE_HERD_COUNT; i++) {
        const heightPx = Math.round(
          ENTRANCE_HERD_MIN_HEIGHT +
            (i / Math.max(ENTRANCE_HERD_COUNT - 1, 1)) *
              (ENTRANCE_HERD_MAX_HEIGHT - ENTRANCE_HERD_MIN_HEIGHT) +
            (Math.random() * 4 - 2)
        );
        const delaySec =
          (i / ENTRANCE_HERD_COUNT) * ENTRANCE_HERD_STAGGER_MAX + Math.random() * 0.05;
        const durationSec = 1.5 + Math.random() * 0.3;
        const bobSec = 0.18 + Math.random() * 0.06;

        const finishTime = (delaySec + durationSec) * 1000;
        if (finishTime > maxFinishTime) {
          maxFinishTime = finishTime;
        }

        newBulls.push({
          id: `entrance-${i}`,
          heightPx,
          delaySec,
          durationSec,
          bobSec,
        });
      }

      setEntranceBulls(newBulls.slice(0, ENTRANCE_HERD_MAX_ON_SCREEN));

      if (entranceCleanupTimerRef.current) clearTimeout(entranceCleanupTimerRef.current);
      entranceCleanupTimerRef.current = window.setTimeout(() => {
        setEntranceBulls([]);
        window.removeEventListener('scroll', updateDividerY);
        entranceCleanupTimerRef.current = null;
      }, maxFinishTime + 100);
    };

    // 2-second fallback safety
    const fallbackTimer = window.setTimeout(() => {
      hasTriggeredEntranceHerdRef.current = true;
    }, ENTRANCE_HERD_FALLBACK_MS);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio >= ENTRANCE_HERD_THRESHOLD || entry.isIntersecting) {
            triggerEntranceHerd();
            observer.disconnect();
          }
        });
      },
      { threshold: [ENTRANCE_HERD_THRESHOLD] }
    );

    observer.observe(sectionRef.current);

    return () => {
      window.clearTimeout(fallbackTimer);
      if (entranceCleanupTimerRef.current) clearTimeout(entranceCleanupTimerRef.current);
      window.removeEventListener('scroll', updateDividerY);
      observer.disconnect();
    };
  }, []);

  const triggerRun = useCallback(() => {
    if (isStampedingRef.current) return;

    // Respect prefers-reduced-motion: update count, skip stampede & hop animations
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setHerdSize((prev) => prev + 1);
        return;
      }
    }

    isStampedingRef.current = true;
    setIsStampeding(true);
    setHerdSize((prev) => prev + 1);

    // Play low hoof thuds Web Audio synthesis
    playHoofThuds();

    // Schedule one hop on the two social buttons as the herd passes
    if (hopStartTimerRef.current) clearTimeout(hopStartTimerRef.current);
    if (hopEndTimerRef.current) clearTimeout(hopEndTimerRef.current);
    setIsHopping(false);
    hopStartTimerRef.current = window.setTimeout(() => {
      setIsHopping(true);
      hopEndTimerRef.current = window.setTimeout(() => {
        setIsHopping(false);
        hopEndTimerRef.current = null;
      }, 450);
    }, 280);

    // Generate 16 bulls
    const bullCount = 16;
    const newBulls = [];
    let maxFinishTime = 0;

    for (let i = 0; i < bullCount; i++) {
      const laneStep = 72 / bullCount;
      const topPct = 10 + i * laneStep + (Math.random() * 4 - 2);
      const heightPx = Math.round(45 + Math.random() * 70);
      const durationSec = 1.4 + Math.random() * 0.7;
      const delaySec = (i / bullCount) * 1.4 + Math.random() * 0.15;
      const bobSec = 0.22 + Math.random() * 0.1;

      const finishTime = (delaySec + durationSec) * 1000;
      if (finishTime > maxFinishTime) {
        maxFinishTime = finishTime;
      }

      newBulls.push({
        id: i,
        topPct,
        heightPx,
        durationSec,
        delaySec,
        bobSec,
      });
    }

    setStampedeBulls(newBulls);

    if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    cleanupTimerRef.current = window.setTimeout(() => {
      setStampedeBulls([]);
      isStampedingRef.current = false;
      setIsStampeding(false);
      cleanupTimerRef.current = null;
    }, maxFinishTime + 100);
  }, []);

  // Listen for the "bull" easter egg typing
  useEffect(() => {
    return subscribeStampede(triggerRun);
  }, [triggerRun]);

  // Clean timers on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      if (hopStartTimerRef.current) clearTimeout(hopStartTimerRef.current);
      if (hopEndTimerRef.current) clearTimeout(hopEndTimerRef.current);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="herd"
      aria-label={HERD_COPY.heading}
      className="relative w-full bg-black text-[#E8DFC9] px-4 sm:px-6 border-t-2 border-[#C97B1A]/40 select-none pb-20 sm:pb-24 scroll-mt-12"
      style={{
        paddingTop: 'clamp(24px, 6svh, 64px)',
        scrollMarginTop: 'clamp(32px, 5vh, 64px)',
      }}
    >
      <div className="max-w-[420px] min-[900px]:max-w-4xl mx-auto flex flex-col items-center">
        {/* 1. Section Heading with red underline stamp */}
        <div className="text-center mb-8 sm:mb-12">
          <Reveal variant="stamp" className="inline-block">
            <h2 className="font-anton text-4xl sm:text-6xl text-white uppercase tracking-wider inline-block">
              {HERD_COPY.heading}
            </h2>
          </Reveal>
        </div>

        {/* Main Content: 1 centered column (max 420px) on mobile, 2 columns from 900px */}
        <Reveal variant="rise" stagger={80} className="w-full flex flex-col items-center">
          <div className="w-full max-w-[420px] min-[900px]:max-w-4xl mx-auto grid grid-cols-1 min-[900px]:grid-cols-2 gap-6 min-[900px]:gap-10 items-center">
            {/* Left column (Desktop) / Top (Mobile): BUY Ticket Card */}
            <div className="w-full flex justify-center">
              <BuyButton />
            </div>

            {/* Right column (Desktop) / Below BUY (Mobile): Social Row + Run Pill */}
            <div className="w-full max-w-sm px-4 mx-auto flex flex-col items-center gap-5 pt-2">
              {/* Side-by-side equal X and Telegram ticket buttons */}
              <div className="w-full grid grid-cols-2 gap-3">
                <SocialTicketButton
                  label={HERD_COPY.socials.xLabel}
                  url={X_URL}
                  soonAria={HERD_COPY.socials.xSoonAria}
                  linkAria={HERD_COPY.socials.xAria}
                  icon={<XMarkIcon />}
                  isHopping={isHopping}
                  hopDelayMs={0}
                  prefersReducedMotion={prefersReducedMotion}
                />

                <SocialTicketButton
                  label={HERD_COPY.socials.telegramLabel}
                  url={TELEGRAM_URL}
                  soonAria={HERD_COPY.socials.telegramSoonAria}
                  linkAria={HERD_COPY.socials.telegramAria}
                  icon={<PaperPlaneIcon />}
                  isHopping={isHopping}
                  hopDelayMs={60}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </div>

              {/* Compact Token Address Card */}
              <AddressTicketCard />

              {/* Smaller outlined pill: RUN WITH THE HERD + HERD SIZE: N */}
              <div className="w-full flex justify-center">
                <button
                  type="button"
                  data-no-tapfx
                  onClick={triggerRun}
                  disabled={isStampeding}
                  aria-label={HERD_COPY.runButton}
                  className={`inline-flex items-center justify-center gap-2.5 min-h-[44px] px-5 py-2 rounded-full border font-plex text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-colors outline-none whitespace-nowrap ${
                    isStampeding
                      ? 'border-[#C97B1A]/35 text-[#E8DFC9]/45 bg-[#0E0D0C]/60 cursor-not-allowed'
                      : 'border-[#C97B1A]/80 text-[#E8DFC9] bg-[#0E0D0C]/80 hover:border-[#F2B24A] hover:bg-[#C97B1A]/15 cursor-pointer'
                  } focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
                >
                  <span>{HERD_COPY.runButton}</span>
                  <span aria-hidden="true" className="text-[#C97B1A]">
                    ·
                  </span>
                  <span data-testid="herd-size-value" className="text-[#F2B24A] tabular-nums">
                    {HERD_COPY.herdSizePrefix}
                    {liveHoldersCount !== null ? liveHoldersCount : herdSize}
                  </span>
                </button>
                <span role="status" aria-live="polite" className="sr-only">
                  {HERD_COPY.herdSizePrefix}
                  {liveHoldersCount !== null ? liveHoldersCount : herdSize}
                </span>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Centered ROLL CREDITS outlined pill button */}
        <div className="mt-10 sm:mt-12 w-full flex justify-center">
          <button
            type="button"
            data-no-tapfx
            onClick={() => onOpenCredits && onOpenCredits()}
            aria-label={CREDITS_COPY.triggerAria}
            className="min-h-[44px] min-w-[44px] px-4 py-2 inline-flex items-center justify-center rounded-full font-plex text-[12px] uppercase tracking-wider text-[#F2B24A] bg-transparent border-2 border-[#C97B1A] shadow-[3px_3px_0_rgba(201,123,26,0.45)] hover:bg-[#C97B1A] hover:text-black active:translate-x-[2px] active:translate-y-[2px] active:shadow-[3px_3px_0_rgba(201,123,26,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] cursor-pointer transition-colors"
          >
            {CREDITS_COPY.triggerButton}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ENTRANCE TRANSITION: MINI HERD PASSES ALONG TOP DIVIDER LINE          */}
      {/* ===================================================================== */}
      {entranceBulls.length > 0 && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
        >
          {entranceBulls.map((bull) => (
            <div
              key={bull.id}
              className="absolute left-0 will-change-transform"
              style={{
                top: `calc(var(--herd-divider-y, 0px) - ${bull.heightPx - 3}px)`,
                animation: `stampedeRun ${bull.durationSec}s cubic-bezier(0.25, 1, 0.5, 1) ${bull.delaySec}s forwards`,
              }}
            >
              <img
                src="/assets/bull-charge.webp"
                alt=""
                width={900}
                height={600}
                style={{
                  height: `${bull.heightPx}px`,
                  animation: `stampedeBob ${bull.bobSec}s ease-in-out infinite alternate`,
                }}
                className="w-auto select-none pointer-events-none"
              />
            </div>
          ))}
        </div>
      )}

      {/* ===================================================================== */}
      {/* FULL-SCREEN STAMPEDE LAYER                                            */}
      {/* ===================================================================== */}
      {stampedeBulls.length > 0 && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
        >
          {stampedeBulls.map((bull) => (
            <div
              key={bull.id}
              className="absolute left-0 will-change-transform"
              style={{
                top: `${bull.topPct}%`,
                animation: `stampedeRun ${bull.durationSec}s cubic-bezier(0.25, 1, 0.5, 1) ${bull.delaySec}s forwards`,
              }}
            >
              <img
                src="/assets/bull-charge.webp"
                alt=""
                width={900}
                height={600}
                style={{
                  height: `${bull.heightPx}px`,
                  animation: `stampedeBob ${bull.bobSec}s ease-in-out infinite alternate`,
                }}
                className="w-auto select-none pointer-events-none"
              />
            </div>
          ))}
        </div>
      )}

      {/* Keyframe animations (strictly transform; suppressed under prefers-reduced-motion) */}
      <style>{`
        @keyframes stampedeRun {
          0% {
            transform: translate3d(-180px, 0, 0);
          }
          100% {
            transform: translate3d(calc(100vw + 180px), 0, 0);
          }
        }
        @keyframes stampedeBob {
          0% {
            transform: translate3d(0, -6px, 0);
          }
          100% {
            transform: translate3d(0, 6px, 0);
          }
        }
        @keyframes socialShake {
          0%, 100% {
            transform: translateX(0);
          }
          10%, 40%, 70% {
            transform: translateX(-4px);
          }
          25%, 55%, 85% {
            transform: translateX(4px);
          }
        }
        .animate-social-shake {
          animation: socialShake 300ms ease-in-out both;
        }
        @keyframes socialHop {
          0% {
            transform: translateY(0);
          }
          45% {
            transform: translateY(-6px);
          }
          100% {
            transform: translateY(0);
          }
        }
        .animate-social-hop {
          animation: socialHop 300ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-social-shake,
          .animate-social-hop {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
};
