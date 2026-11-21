import React, { useCallback, useEffect, useRef, useState } from 'react';
import { isSoundEnabled, playSnortSound } from '../utils/audio';
import { DESK_NAV_COPY, OFFICE_COPY } from '../copy.js';
import { isDesktopViewport } from '../utils/desktop';

interface PlayButtonProps {
  isCreditsOpen: boolean;
}

type AnchorTargetId = 'tape' | 'bot';

const VALID_ANCHORS = new Set<string>(['tape', 'bot']);

function getCordButton(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(
    `#desk button[aria-label="${OFFICE_COPY.cordAria}"]`
  );
}

/**
 * Read-only check of OfficeScene's pull-cord light gate without modifying OfficeScene.
 * Returns true while the room light has not yet been turned on (scroll past #desk is locked).
 */
function isLightGateLocked(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  const cordBtn = getCordButton();
  if (!cordBtn) return false;
  return cordBtn.getAttribute('aria-pressed') !== 'true';
}

function scrollToTargetId(targetId: AnchorTargetId): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const targetEl = document.getElementById(targetId);
  if (!targetEl) return false;

  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  try {
    if (window.location.pathname === '/' && window.location.hash !== `#${targetId}`) {
      window.history.replaceState(null, '', `/#${targetId}`);
    }
  } catch {
    // Ignore history API restrictions
  }

  targetEl.scrollIntoView({
    behavior: prefersReduced ? 'auto' : 'smooth',
    block: 'start',
  });
  return true;
}

export const PlayButton: React.FC<PlayButtonProps> = ({ isCreditsOpen }) => {
  const [isRoomDark, setIsRoomDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.dataset.room === 'dark';
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isWiggling, setIsWiggling] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const navRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const navTimerRef = useRef<number | null>(null);
  const wiggleOffTimerRef = useRef<number | null>(null);
  const pendingAnchorRef = useRef<AnchorTargetId | null>(null);
  const unlockObserverRef = useRef<MutationObserver | null>(null);
  const targetWaitObserverRef = useRef<MutationObserver | null>(null);
  const scrollDelayTimerRef = useRef<number | null>(null);
  const waitTimeoutRef = useRef<number | null>(null);

  const clearPendingObservers = useCallback(() => {
    if (unlockObserverRef.current) {
      unlockObserverRef.current.disconnect();
      unlockObserverRef.current = null;
    }
    if (targetWaitObserverRef.current) {
      targetWaitObserverRef.current.disconnect();
      targetWaitObserverRef.current = null;
    }
    if (scrollDelayTimerRef.current !== null) {
      window.clearTimeout(scrollDelayTimerRef.current);
      scrollDelayTimerRef.current = null;
    }
    if (waitTimeoutRef.current !== null) {
      window.clearTimeout(waitTimeoutRef.current);
      waitTimeoutRef.current = null;
    }
  }, []);

  const executeUnlockedScroll = useCallback((targetId: AnchorTargetId) => {
    if (isLightGateLocked()) return;
    if (scrollToTargetId(targetId)) {
      pendingAnchorRef.current = null;
      return;
    }

    // If #tape is still awaiting initial Supanova response, wait briefly for it to mount
    if (targetWaitObserverRef.current) {
      targetWaitObserverRef.current.disconnect();
    }
    const mainEl = document.querySelector('main') || document.body;
    const obs = new MutationObserver(() => {
      if (isLightGateLocked()) return;
      if (scrollToTargetId(targetId)) {
        pendingAnchorRef.current = null;
        obs.disconnect();
        targetWaitObserverRef.current = null;
        if (waitTimeoutRef.current !== null) {
          window.clearTimeout(waitTimeoutRef.current);
          waitTimeoutRef.current = null;
        }
      }
    });
    obs.observe(mainEl, { childList: true, subtree: true });
    targetWaitObserverRef.current = obs;

    if (waitTimeoutRef.current !== null) {
      window.clearTimeout(waitTimeoutRef.current);
    }
    waitTimeoutRef.current = window.setTimeout(() => {
      if (targetWaitObserverRef.current) {
        targetWaitObserverRef.current.disconnect();
        targetWaitObserverRef.current = null;
      }
      waitTimeoutRef.current = null;
    }, 10000);
  }, []);

  const queueUntilLightUnlocks = useCallback(
    (targetId: AnchorTargetId) => {
      clearPendingObservers();
      pendingAnchorRef.current = targetId;

      if (!isLightGateLocked()) {
        executeUnlockedScroll(targetId);
        return;
      }

      const checkAndFire = () => {
        if (pendingAnchorRef.current && !isLightGateLocked()) {
          const target = pendingAnchorRef.current;
          if (unlockObserverRef.current) {
            unlockObserverRef.current.disconnect();
            unlockObserverRef.current = null;
          }
          if (scrollDelayTimerRef.current !== null) {
            window.clearTimeout(scrollDelayTimerRef.current);
          }
          scrollDelayTimerRef.current = window.setTimeout(() => {
            scrollDelayTimerRef.current = null;
            if (!isLightGateLocked() && pendingAnchorRef.current === target) {
              executeUnlockedScroll(target);
            }
          }, 350);
        }
      };

      const deskEl = document.getElementById('desk') || document.body;
      const observer = new MutationObserver(checkAndFire);
      observer.observe(deskEl, {
        attributes: true,
        attributeFilter: ['aria-pressed'],
        childList: true,
        subtree: true,
      });
      unlockObserverRef.current = observer;
    },
    [clearPendingObservers, executeUnlockedScroll]
  );

  // Respect prefers-reduced-motion
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

  // Handle arriving at /#tape or /#bot (e.g. from /play) while respecting the light gate
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHashNavigation = () => {
      const hashId = window.location.hash.replace(/^#/, '');
      if (!VALID_ANCHORS.has(hashId)) return;
      const anchorId = hashId as AnchorTargetId;

      if (isLightGateLocked()) {
        queueUntilLightUnlocks(anchorId);
      } else {
        executeUnlockedScroll(anchorId);
      }
    };

    handleHashNavigation();
    window.addEventListener('hashchange', handleHashNavigation);

    return () => {
      window.removeEventListener('hashchange', handleHashNavigation);
      clearPendingObservers();
    };
  }, [clearPendingObservers, executeUnlockedScroll, queueUntilLightUnlocks]);

  // Every 10 seconds, do a small 500ms +/-3 deg wiggle unless reduced motion or menu open
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

  // Close menu on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isHidden = isCreditsOpen || isRoomDark;

  useEffect(() => {
    if (isHidden) {
      setIsOpen(false);
    }
  }, [isHidden]);

  useEffect(() => {
    return () => {
      if (navTimerRef.current !== null) {
        window.clearTimeout(navTimerRef.current);
        navTimerRef.current = null;
      }
    };
  }, []);

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const count = DESK_NAV_COPY.items.length;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      window.requestAnimationFrame(() => {
        itemRefs.current[count - 1]?.focus();
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      window.requestAnimationFrame(() => {
        itemRefs.current[0]?.focus();
      });
    }
  };

  const handleItemKeyDown = (
    e: React.KeyboardEvent<HTMLAnchorElement>,
    idx: number
  ) => {
    const count = DESK_NAV_COPY.items.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      itemRefs.current[(idx + 1) % count]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      itemRefs.current[(idx - 1 + count) % count]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      itemRefs.current[count - 1]?.focus();
    }
  };

  const handleItemClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    item: { id: string; href: string }
  ) => {
    // Allow modifier clicks (open in new tab, etc.) to follow the anchor natively
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);

    if (item.id === 'play') {
      if (isSoundEnabled()) {
        e.preventDefault();
        playSnortSound(0.6);
        if (navTimerRef.current !== null) {
          window.clearTimeout(navTimerRef.current);
        }
        navTimerRef.current = window.setTimeout(() => {
          window.location.href = item.href;
        }, 150);
      }
      return;
    }

    // Anchor items (/#tape, /#bot)
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      return;
    }

    e.preventDefault();
    const targetId = item.id as AnchorTargetId;

    if (isLightGateLocked()) {
      // Respect OfficeScene's light-and-scroll lock: never force a jump past #desk.
      // Queue the navigation so it takes effect once the scene unlocks the page.
      queueUntilLightUnlocks(targetId);
      return;
    }

    executeUnlockedScroll(targetId);
  };

  return (
    <nav
      ref={navRef}
      aria-label={DESK_NAV_COPY.navAria}
      aria-hidden={isHidden}
      className={`fixed left-[14px] z-[850] select-none transition-opacity duration-200 ${
        isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        bottom: 'calc(3.4rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="relative inline-block">
        {/* Upward-opening menu: strictly 3 plain label buttons */}
        {isOpen && (
          <div
            id="desk-nav-menu"
            className="absolute left-0 bottom-full mb-2 w-[152px] bg-[#0E0D0C] border-2 border-[#C97B1A] shadow-[3px_3px_0_rgba(201,123,26,0.45)] divide-y divide-[#C97B1A]/35"
          >
            {DESK_NAV_COPY.items.map((item, idx) => (
              <a
                key={item.id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                href={item.href}
                data-no-tapfx
                onClick={(e) => handleItemClick(e, item)}
                onKeyDown={(e) => handleItemKeyDown(e, idx)}
                className="flex items-center w-full min-h-[44px] px-4 py-2.5 font-anton text-[15px] leading-none uppercase tracking-wider text-[#E8DFC9] bg-[#0E0D0C] hover:bg-[#C97B1A] hover:text-[#0E0D0C] focus-visible:bg-[#C97B1A] focus-visible:text-[#0E0D0C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:ring-inset no-underline whitespace-nowrap transition-colors duration-150"
              >
                {item.label}
              </a>
            ))}
          </div>
        )}

        {/* Fixed bottom-left DESK trigger pill (exact footprint & styling of old PLAY pill) */}
        <button
          ref={triggerRef}
          type="button"
          data-no-tapfx
          tabIndex={isHidden ? -1 : undefined}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-controls="desk-nav-menu"
          onClick={() => setIsOpen((prev) => !prev)}
          onKeyDown={handleTriggerKeyDown}
          className="inline-flex items-center py-[2px] min-h-[44px] rounded-full bg-transparent border-0 p-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] group"
        >
          <span
            className={`h-[40px] px-3.5 inline-flex items-center gap-2 rounded-full bg-[#0E0D0C] border-2 border-[#C97B1A] text-[#E8DFC9] shadow-[3px_3px_0_rgba(201,123,26,0.45)] group-hover:bg-[#C97B1A] group-hover:text-[#0E0D0C] group-active:translate-x-[2px] group-active:translate-y-[2px] group-active:shadow-[1px_1px_0_rgba(201,123,26,0.45)] transition-[background-color,color,transform,box-shadow] duration-150 ${
              !isOpen && isWiggling && !prefersReducedMotion ? 'play-pill-wiggle' : ''
            }`}
          >
            <span className="font-anton text-[16px] leading-none uppercase tracking-wider whitespace-nowrap">
              {DESK_NAV_COPY.triggerLabel}
            </span>
            <svg
              viewBox="0 0 12 12"
              className={`w-3 h-3 shrink-0 transition-transform duration-150 motion-reduce:transition-none ${
                isOpen ? 'rotate-180' : 'rotate-0'
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="2.5,7.75 6,4.25 9.5,7.75" />
            </svg>
          </span>
        </button>
      </div>

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
    </nav>
  );
};
