import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BuyButton } from '../components/BuyButton';
import { BUY_URL, X_URL, TELEGRAM_URL } from '../config.js';
import { HERD_COPY } from '../copy.js';
import { playHoofThuds } from '../utils/audio';
import { subscribeStampede } from '../utils/stampede';
import { ExternalLink } from 'lucide-react';
import { Reveal } from '../components/Reveal';

export const Herd = () => {
  const [herdSize, setHerdSize] = useState(0);
  const [isStampeding, setIsStampeding] = useState(false);
  const [stampedeBulls, setStampedeBulls] = useState([]);
  const [showLinks, setShowLinks] = useState(false);

  const isStampedingRef = useRef(false);
  const cleanupTimerRef = useRef(null);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setShowLinks(true);
      }
    }
  }, []);

  const triggerRun = useCallback(() => {
    if (isStampedingRef.current) return;

    // Check prefers-reduced-motion
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setHerdSize((prev) => prev + 1);
        setShowLinks(true);
        return;
      }
    }

    isStampedingRef.current = true;
    setIsStampeding(true);
    setHerdSize((prev) => prev + 1);
    setShowLinks(true);

    // Play low hoof thuds Web Audio synthesis
    playHoofThuds();

    // Generate 16 bulls (between 14 and 18)
    const bullCount = 16;
    const newBulls = [];
    let maxFinishTime = 0;

    for (let i = 0; i < bullCount; i++) {
      // Distinct lane between 10% and 82% of screen height
      const laneStep = 72 / bullCount;
      const topPct = 10 + i * laneStep + (Math.random() * 4 - 2);
      // Size 40 to 120px tall
      const heightPx = Math.round(45 + Math.random() * 70);
      // Speed / duration: 1.4s to 2.2s
      const durationSec = 1.4 + Math.random() * 0.7;
      // Stagger over 1.5s
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
        bobSec
      });
    }

    setStampedeBulls(newBulls);

    // Cleanup timer removes all DOM elements after stampede completes
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

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    };
  }, []);

  const hasAnyLink = Boolean((X_URL && X_URL.trim()) || (TELEGRAM_URL && TELEGRAM_URL.trim()));

  return (
    <section
      id="herd"
      aria-label="Join the Herd"
      className="relative w-full bg-black text-[#E8DFC9] px-4 sm:px-6 border-t-2 border-[#C97B1A]/40 select-none pb-28 scroll-mt-12"
      style={{
        paddingTop: 'clamp(24px, 6dvh, 64px)',
        scrollMarginTop: 'clamp(32px, 5vh, 64px)',
      }}
    >
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        
        {/* Section Heading */}
        <div className="text-center mb-8 sm:mb-12">
          <Reveal variant="stamp" className="inline-block">
            <h2 className="font-anton text-4xl sm:text-6xl text-white uppercase tracking-wider inline-block">
              {HERD_COPY.heading}
            </h2>
          </Reveal>
        </div>

        {/* Blocks under heading animated with variant="rise" */}
        <Reveal variant="rise" stagger={80} className="w-full flex flex-col items-center">
          {/* Action Buttons Row: Buy "Hold to Charge" + "Run with the herd" */}
          <div className="w-full flex flex-col md:flex-row items-center justify-center gap-8 md:gap-10">
            
            {/* Reused BUY Hold-to-Charge component from Stage 1 */}
            <div className="w-full max-w-sm flex justify-center">
              <BuyButton
                onChargingChange={() => {}}
                onEarlyRelease={() => {}}
              />
            </div>

            {/* Stampede Trigger Button */}
            <div className="w-full max-w-sm flex flex-col items-center">
              <div className="w-full bg-[#0E0D0C] border-2 sm:border-3 border-[#C97B1A] p-4 sm:p-5 shadow-[4px_4px_0_#C97B1A] flex flex-col items-center">
                
                <div className="w-full flex items-center justify-between border-b border-[#C97B1A]/40 pb-2 mb-4 text-[11px] font-plex text-[#E8DFC9]/70 tracking-widest uppercase">
                  <span>HERD CALL // 02</span>
                  <span>STATUS: READY</span>
                </div>

                <button
                  type="button"
                  onClick={triggerRun}
                  disabled={isStampeding}
                  aria-label="Run with the herd"
                  className={`w-full min-h-[56px] py-4 px-6 font-anton text-2xl sm:text-3xl tracking-wider uppercase border-2 border-black transition-all outline-none cursor-pointer ${
                    isStampeding
                      ? 'bg-[#1a1410] text-[#E8DFC9]/40 border-[#333] cursor-not-allowed'
                      : 'bg-[#C97B1A] hover:bg-[#d88720] text-black shadow-[0_4px_0_#824e0e] active:translate-y-1'
                  } focus-visible:ring-4 focus-visible:ring-[#F2B24A]`}
                >
                  {HERD_COPY.runButton}
                </button>

                {/* Herd size counter in this session */}
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-4 font-plex text-xs text-[#F2B24A] font-bold tracking-widest uppercase"
                >
                  {HERD_COPY.herdSizePrefix}{herdSize}
                </div>
              </div>
            </div>

          </div>

          {/* Community Links Panel (Slides up after first stampede or immediately if prefers-reduced-motion) */}
          {showLinks && (
            <div
              className="w-full max-w-md mt-10 p-5 bg-[#0E0D0C] border-2 border-[#C97B1A]/70 shadow-[6px_6px_0_#000] animate-fadeIn"
              role="region"
              aria-label="Community Links"
            >
              <div className="flex items-center gap-2 border-b border-[#C97B1A]/40 pb-2 mb-4">
                <span className="w-2.5 h-2.5 bg-[#C97B1A] rotate-45 inline-block" />
                <h3 className="font-anton text-lg tracking-wider text-white uppercase">
                  {HERD_COPY.linksHeading}
                </h3>
              </div>

              {hasAnyLink ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  {X_URL && X_URL.trim() !== '' && (
                    <a
                      href={X_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black hover:bg-[#1a1410] border-2 border-[#C97B1A] text-white font-plex text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_#000] active:translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
                    >
                      <span>{HERD_COPY.xButton}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#F2B24A]" />
                    </a>
                  )}

                  {TELEGRAM_URL && TELEGRAM_URL.trim() !== '' && (
                    <a
                      href={TELEGRAM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black hover:bg-[#1a1410] border-2 border-[#C97B1A] text-white font-plex text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_#000] active:translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
                    >
                      <span>{HERD_COPY.telegramButton}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#F2B24A]" />
                    </a>
                  )}
                </div>
              ) : (
                <p className="font-plex text-xs text-[#E8DFC9]/70 text-center py-2">
                  {HERD_COPY.linksOpenAtLaunch}
                </p>
              )}
            </div>
          )}
        </Reveal>

      </div>

      {/* ===================================================================== */}
      {/* FULL-SCREEN STAMPEDE LAYER                                            */}
      {/* Pointer-events: none, fixed overlay, removed when run completes        */}
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
                animation: `stampedeRun ${bull.durationSec}s cubic-bezier(0.25, 1, 0.5, 1) ${bull.delaySec}s forwards`
              }}
            >
              <img
                src="/assets/bull-charge.png"
                alt=""
                style={{
                  height: `${bull.heightPx}px`,
                  animation: `stampedeBob ${bull.bobSec}s ease-in-out infinite alternate`
                }}
                className="w-auto select-none pointer-events-none"
              />
            </div>
          ))}
        </div>
      )}

      {/* Inline styles for keyframe transforms */}
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
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.35s ease-out forwards;
        }
      `}</style>
    </section>
  );
};
