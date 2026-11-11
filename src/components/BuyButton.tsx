import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BUY_URL, X_URL } from '../config.js';
import { BUY_BUTTON } from '../copy.js';
import { playSnortSound, playBellSound } from '../utils/audio';

interface BuyButtonProps {
  onChargingChange: (progress: number) => void;
  onEarlyRelease: (message: string) => void;
  onChargeComplete?: () => void;
}

export const BuyButton: React.FC<BuyButtonProps> = ({
  onChargingChange,
  onEarlyRelease,
  onChargeComplete
}) => {
  const [progress, setProgress] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [stampActive, setStampActive] = useState(false);

  const chargeIntervalRef = useRef<number | null>(null);
  const drainIntervalRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const isChargingRef = useRef(false);

  // Sync ref
  progressRef.current = progress;
  isChargingRef.current = isCharging;

  const handleChargeComplete = useCallback(() => {
    setIsCompleted(true);
    setStampActive(true);
    playBellSound();
    if (onChargeComplete) onChargeComplete();

    const targetUrl = BUY_URL as string;
    if (targetUrl && targetUrl.trim() !== '') {
      setTimeout(() => {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }, 700);
    }
  }, [onChargeComplete]);

  const startCharging = useCallback(() => {
    if (isCompleted || stampActive) return;

    if (drainIntervalRef.current) {
      cancelAnimationFrame(drainIntervalRef.current);
      drainIntervalRef.current = null;
    }

    setIsCharging(true);
    playSnortSound();

    const startTime = performance.now();
    const startProgress = progressRef.current;
    const duration = 1800 * (1 - startProgress / 100); // 1.8s full charge

    const step = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(100, startProgress + (elapsed / duration) * (100 - startProgress));
      setProgress(pct);
      onChargingChange(pct);

      if (pct >= 100) {
        setIsCharging(false);
        handleChargeComplete();
      } else {
        chargeIntervalRef.current = requestAnimationFrame(step);
      }
    };

    chargeIntervalRef.current = requestAnimationFrame(step);
  }, [isCompleted, stampActive, onChargingChange, handleChargeComplete]);

  const stopCharging = useCallback(() => {
    if (chargeIntervalRef.current) {
      cancelAnimationFrame(chargeIntervalRef.current);
      chargeIntervalRef.current = null;
    }

    if (!isChargingRef.current && progressRef.current === 0) return;
    setIsCharging(false);

    if (progressRef.current > 0 && progressRef.current < 100) {
      onEarlyRelease(BUY_BUTTON.earlyReleaseLine);

      // Drain meter back to 0
      const startDrain = progressRef.current;
      const drainStartTime = performance.now();
      const drainDuration = 400;

      const drainStep = (now: number) => {
        const elapsed = now - drainStartTime;
        const current = Math.max(0, startDrain - (elapsed / drainDuration) * startDrain);
        setProgress(current);
        onChargingChange(current);

        if (current > 0) {
          drainIntervalRef.current = requestAnimationFrame(drainStep);
        } else {
          drainIntervalRef.current = null;
        }
      };

      drainIntervalRef.current = requestAnimationFrame(drainStep);
    }
  }, [onChargingChange, onEarlyRelease]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (chargeIntervalRef.current) cancelAnimationFrame(chargeIntervalRef.current);
      if (drainIntervalRef.current) cancelAnimationFrame(drainIntervalRef.current);
    };
  }, []);

  // Keyboard support: Space or Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (!isCharging && !isCompleted && !stampActive) {
        e.preventDefault();
        startCharging();
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      stopCharging();
    }
  };

  const resetOrder = () => {
    setStampActive(false);
    setIsCompleted(false);
    setProgress(0);
    onChargingChange(0);
  };

  return (
    <div className="relative flex flex-col items-center w-full max-w-sm px-4 select-none">
      {/* Order Ticket Container */}
      <div className="relative w-full bg-[#0E0D0C] border-2 sm:border-3 border-[#C97B1A] p-4 sm:p-5 shadow-[4px_4px_0px_#C97B1A] rounded-none">
        
        {/* Ticket Perforation & Header */}
        <div className="flex items-center justify-between border-b border-[#C97B1A]/40 pb-2 mb-3 text-[11px] font-plex text-[#E8DFC9]/70 tracking-widest uppercase">
          <span>ONCHAIN TICKET</span>
          <span>LOT: 420,690</span>
        </div>

        {/* The Action Button */}
        <button
          type="button"
          aria-label="Buy Bull on Canton - Hold to charge order"
          aria-pressed={isCharging}
          className={`relative w-full group py-4 px-6 font-anton text-3xl sm:text-4xl tracking-wider uppercase transition-all outline-none border-2 border-black
            ${
              isCharging
                ? 'bg-[#F2B24A] text-black scale-[0.98]'
                : 'bg-[#C97B1A] hover:bg-[#d88720] text-black shadow-[0_4px_0_#824e0e] active:translate-y-1'
            }
            focus-visible:ring-4 focus-visible:ring-[#F2B24A] focus-visible:ring-offset-2 focus-visible:ring-offset-black
          `}
          onPointerDown={startCharging}
          onPointerUp={stopCharging}
          onPointerLeave={stopCharging}
          onPointerCancel={stopCharging}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onTouchStart={startCharging}
          onTouchEnd={stopCharging}
        >
          <div className="flex items-center justify-center gap-2">
            <span>{BUY_BUTTON.label}</span>
            {isCharging && (
              <span className="text-xl animate-pulse font-plex">⚡</span>
            )}
          </div>
          <div className="text-xs font-plex tracking-widest text-black/80 font-bold mt-0.5">
            {isCharging ? `CHARGING ${Math.round(progress)}%` : BUY_BUTTON.subtitle}
          </div>
        </button>

        {/* Charge Progress Meter Bar */}
        <div className="mt-3 w-full bg-black border border-[#C97B1A]/60 p-1">
          <div className="relative w-full h-3 bg-[#1a1410] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#C97B1A] via-[#F2B24A] to-[#2FD27A] transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Meter scale indicators */}
        <div className="flex justify-between text-[10px] font-plex text-[#E8DFC9]/50 mt-1">
          <span>0%</span>
          <span>CHARGE PRESSURE</span>
          <span>100%</span>
        </div>

        {/* Red Stamp Overlay when 100% reached */}
        {stampActive && (
          <div
            className="absolute inset-0 bg-black/92 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 border-2 border-[#C23B22] animate-stamp"
            role="dialog"
            aria-modal="true"
            aria-label="Order Status"
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
              {X_URL ? (
                <a
                  href={X_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center py-2 px-4 bg-[#C23B22] hover:bg-[#a8321b] text-white font-plex text-xs font-bold tracking-wider uppercase border border-black shadow-[2px_2px_0_#000]"
                >
                  {BUY_BUTTON.notLiveLinkText}
                </a>
              ) : (
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center py-2 px-4 bg-[#C23B22] hover:bg-[#a8321b] text-white font-plex text-xs font-bold tracking-wider uppercase border border-black shadow-[2px_2px_0_#000]"
                >
                  Follow on X for Launch
                </a>
              )}
              <button
                type="button"
                onClick={resetOrder}
                className="py-2 px-4 bg-transparent hover:bg-white/10 text-[#E8DFC9]/80 font-plex text-xs border border-[#E8DFC9]/30"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
