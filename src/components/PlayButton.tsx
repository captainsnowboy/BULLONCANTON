import React, { useEffect, useRef, useState } from 'react';
import { isSoundEnabled, playSnortSound } from '../utils/audio';
import { PLAY_COPY } from '../copy.js';
import { isDesktopViewport } from '../utils/desktop';

interface PlayButtonProps {
  isCreditsOpen: boolean;
}

export const PlayButton: React.FC<PlayButtonProps> = ({ isCreditsOpen }) => {
  const [isRoomDark, setIsRoomDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.dataset.room === 'dark';
  });
  const [isWiggling, setIsWiggling] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const navTimerRef = useRef<number | null>(null);
  const wiggleOffTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Observe document.documentElement.dataset.room ("dark" | "lit") updated by OfficeScene
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const syncRoom = () => setIsRoomDark(root.dataset.room === 'dark');
    syncRoom();

    const observer = new MutationObserver(syncRoom);
    observer.observe(root, { attributes: true, attributeFilter: ['data-room'] });
    return () => observer.disconnect();
  }, []);

  // Every 10 seconds, do a small 500ms +/-3 deg wiggle unless reduced motion is requested
  useEffect(() => {
    if (prefersReducedMotion || typeof window === 'undefined') {
      setIsWiggling(false);
      return;
    }

    const intervalId = window.setInterval(() => {
      if (isDesktopViewport() && document.hidden) return;
      setIsWiggling(true);
      if (wiggleOffTimerRef.current !== null) {
        window.clearTimeout(wiggleOffTimerRef.current);
      }
      wiggleOffTimerRef.current = window.setTimeout(() => {
        setIsWiggling(false);
        wiggleOffTimerRef.current = null;
      }, 520);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
      if (wiggleOffTimerRef.current !== null) {
        window.clearTimeout(wiggleOffTimerRef.current);
        wiggleOffTimerRef.current = null;
      }
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (navTimerRef.current !== null) {
        window.clearTimeout(navTimerRef.current);
        navTimerRef.current = null;
      }
    };
  }, []);

  const isHidden = isCreditsOpen || isRoomDark;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Allow modifier clicks (open in new tab, etc.) to follow the anchor natively
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    if (isSoundEnabled()) {
      e.preventDefault();
      playSnortSound(0.6);
      if (navTimerRef.current !== null) {
        window.clearTimeout(navTimerRef.current);
      }
      navTimerRef.current = window.setTimeout(() => {
        window.location.href = '/play/';
      }, 150);
    }
  };

  return (
    <a
      href="/play/"
      data-no-tapfx
      aria-label={PLAY_COPY.stickyAria}
      aria-hidden={isHidden}
      tabIndex={isHidden ? -1 : undefined}
      onClick={handleClick}
      className={`fixed left-[14px] z-[850] inline-flex items-center py-[2px] min-h-[44px] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] transition-opacity duration-200 select-none group ${
        isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        bottom: 'calc(3.4rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <span
        className={`h-[40px] px-3.5 inline-flex items-center gap-2 rounded-full bg-[#0E0D0C] border-2 border-[#C97B1A] text-[#E8DFC9] shadow-[3px_3px_0_rgba(201,123,26,0.45)] group-hover:bg-[#C97B1A] group-hover:text-[#0E0D0C] group-active:translate-x-[2px] group-active:translate-y-[2px] group-active:shadow-[1px_1px_0_rgba(201,123,26,0.45)] transition-[background-color,color,transform,box-shadow] duration-150 ${
          isWiggling && !prefersReducedMotion ? 'play-pill-wiggle' : ''
        }`}
      >
        {/* Small bronze play circle with dark triangle (inverts on hover so triangle remains crisp) */}
        <span
          aria-hidden="true"
          className="w-5 h-5 rounded-full bg-[#C97B1A] text-[#0E0D0C] group-hover:bg-[#0E0D0C] group-hover:text-[#C97B1A] inline-flex items-center justify-center shrink-0 transition-colors duration-150"
        >
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 translate-x-[0.5px]" fill="currentColor">
            <polygon points="3,2 10,6 3,10" />
          </svg>
        </span>

        <span className="font-anton text-[16px] leading-none uppercase tracking-wider">
          {PLAY_COPY.button}
        </span>
      </span>

      <style>{`
        @keyframes playPillWiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-3deg); }
          75% { transform: rotate(3deg); }
        }
        .play-pill-wiggle {
          animation: playPillWiggle 500ms ease-in-out 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .play-pill-wiggle {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </a>
  );
};
