import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import rawArrivalsData from '../data/arrivals.json';
import { RECEIPTS_UPDATED } from '../config.js';
import { ARRIVALS_COPY, OFFICE_COPY } from '../copy.js';
import { playFlipClickSound } from '../utils/audio';

const FILTER_KEYS = ['ALL', 'ARRIVED', 'PILOT', 'ANNOUNCED'];

const STATUS_STYLE = {
  ARRIVED: { backgroundColor: '#2FD27A', color: '#0E0D0C' },
  PILOT: { backgroundColor: '#F2B24A', color: '#0E0D0C' },
  ANNOUNCED: { backgroundColor: '#C97B1A', color: '#0E0D0C' },
};

const BULL_REACTION_IMG = {
  ARRIVED: '/assets/bull-smug.webp',
  ANNOUNCED: '/assets/bull-browraise.webp',
  PILOT: '/assets/bull-watch.webp',
};

// 5 stepped clip-path stages over 700ms (allow right/bottom shadow + sawtooth unclipped at end)
const CLIP_STEPS = [
  'inset(0 -8px 82% 0)',
  'inset(0 -8px 62% 0)',
  'inset(0 -8px 42% 0)',
  'inset(0 -8px 22% 0)',
  'inset(0 -8px 6% 0)',
  'inset(0 -8px -18px 0)',
];

function isSafeHttpsUrl(url) {
  return typeof url === 'string' && url.startsWith('https://');
}

function isXUrl(url) {
  return typeof url === 'string' && (url.includes('x.com/') || url.includes('twitter.com/'));
}

function formatMonitorDate(rawDate, months) {
  if (typeof rawDate !== 'string') return '';
  const trimmed = rawDate.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return trimmed.toUpperCase();
  const year = match[1];
  const monthIdx = Number.parseInt(match[2], 10) - 1;
  const dayNum = Number.parseInt(match[3], 10);
  const monthName = Array.isArray(months) ? months[monthIdx] : '';
  if (!monthName || Number.isNaN(dayNum)) return trimmed.toUpperCase();
  return `${dayNum} ${monthName} ${year}`;
}

export const MonitorScreen = ({
  isInteractive = false,
  isLightOn = false,
  reducedMotion = false,
  hintHoverFirstRow = false,
  hintPulseTick = 0,
}) => {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState(null);
  const [lastSelectedId, setLastSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [showLegend, setShowLegend] = useState(false);

  // Printer & paper animation states
  const [printStep, setPrintStep] = useState(reducedMotion ? 5 : 0);
  const [isPrinting, setIsPrinting] = useState(false);
  const [stampLanded, setStampLanded] = useState(reducedMotion);
  const [isTearing, setIsTearing] = useState(false);
  const [reactionIndex, setReactionIndex] = useState(0);

  // Screen boot sweep state
  const [showBootLine, setShowBootLine] = useState(false);
  const [containerWidth, setContainerWidth] = useState(405);
  const [isFirstRowPulsing, setIsFirstRowPulsing] = useState(false);

  const rootRef = useRef(null);
  const bootContentRef = useRef(null);
  const bootLineRef = useRef(null);
  const paperScrollRef = useRef(null);
  const stampRef = useRef(null);

  const timersRef = useRef([]);
  const pulseTimerRef = useRef(null);
  const lastReactionIdxRef = useRef(-1);
  const prevLightOnRef = useRef(false);
  const isTearingRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimers();
      if (pulseTimerRef.current !== null) {
        window.clearTimeout(pulseTimerRef.current);
      }
    };
  }, [clearAllTimers]);

  // Pulse first row highlight twice when HornCursor demo activates on it
  useEffect(() => {
    if (!hintPulseTick || reducedMotion) {
      setIsFirstRowPulsing(false);
      return;
    }
    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
    }
    setIsFirstRowPulsing(false);
    const rafId = requestAnimationFrame(() => {
      setIsFirstRowPulsing(true);
      pulseTimerRef.current = window.setTimeout(() => {
        pulseTimerRef.current = null;
        setIsFirstRowPulsing(false);
      }, 660);
    });
    return () => cancelAnimationFrame(rafId);
  }, [hintPulseTick, reducedMotion]);

  // Measure container width so Bull Reaction appears only at >= 700px wide
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      if (el.offsetWidth > 0) {
        setContainerWidth(el.offsetWidth);
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Screen Power-On Boot: starts dark, thin bronze line sweeps top -> bottom revealing screen (400ms, no flashing)
  useLayoutEffect(() => {
    const contentEl = bootContentRef.current;
    const lineEl = bootLineRef.current;
    if (!contentEl) return;

    if (reducedMotion) {
      contentEl.style.clipPath = 'inset(0 0 0% 0)';
      contentEl.style.webkitClipPath = 'inset(0 0 0% 0)';
      setShowBootLine(false);
      prevLightOnRef.current = isLightOn;
      return;
    }

    if (!isLightOn) {
      contentEl.style.clipPath = 'inset(0 0 100% 0)';
      contentEl.style.webkitClipPath = 'inset(0 0 100% 0)';
      setShowBootLine(false);
      prevLightOnRef.current = false;
      return;
    }

    // Light just switched on -> run 400ms top-to-bottom bronze scan-line reveal
    if (!prevLightOnRef.current && isLightOn) {
      prevLightOnRef.current = true;
      setShowBootLine(true);

      const proxy = { bottom: 100 };
      const ctx = gsap.context(() => {
        contentEl.style.clipPath = 'inset(0 0 100% 0)';
        contentEl.style.webkitClipPath = 'inset(0 0 100% 0)';

        gsap.to(proxy, {
          bottom: 0,
          duration: 0.4,
          ease: 'power2.out',
          onUpdate: () => {
            const clip = `inset(0 0 ${proxy.bottom.toFixed(2)}% 0)`;
            contentEl.style.clipPath = clip;
            contentEl.style.webkitClipPath = clip;
            if (lineEl) {
              lineEl.style.top = `${(100 - proxy.bottom).toFixed(2)}%`;
            }
          },
          onComplete: () => {
            contentEl.style.clipPath = 'inset(0 0 0% 0)';
            contentEl.style.webkitClipPath = 'inset(0 0 0% 0)';
            setShowBootLine(false);
          },
        });
      }, rootRef);

      return () => ctx.revert();
    }
  }, [isLightOn, reducedMotion]);

  // Skip placeholder rows and sort newest first
  const allReceipts = useMemo(() => {
    return rawArrivalsData
      .filter((row) => !row.placeholder)
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, []);

  const counts = useMemo(() => {
    return {
      ALL: allReceipts.length,
      ARRIVED: allReceipts.filter((r) => r.status === 'ARRIVED').length,
      PILOT: allReceipts.filter((r) => r.status === 'PILOT').length,
      ANNOUNCED: allReceipts.filter((r) => r.status === 'ANNOUNCED').length,
    };
  }, [allReceipts]);

  const filteredReceipts = useMemo(() => {
    if (activeFilter === 'ALL') return allReceipts;
    return allReceipts.filter((r) => r.status === activeFilter);
  }, [allReceipts, activeFilter]);

  const updatedDateLabel = useMemo(() => {
    const configDate =
      typeof RECEIPTS_UPDATED === 'string' && RECEIPTS_UPDATED.trim() !== ''
        ? RECEIPTS_UPDATED.trim()
        : '';
    const rawDate = configDate || allReceipts[0]?.date || '';
    const formatted = formatMonitorDate(rawDate, OFFICE_COPY.monthsShort);
    return formatted ? `${OFFICE_COPY.updatedPrefix} ${formatted}` : '';
  }, [allReceipts]);

  const selectedIndex = useMemo(() => {
    if (!selectedId) return -1;
    return filteredReceipts.findIndex((r) => r.id === selectedId);
  }, [filteredReceipts, selectedId]);

  const activeReceipt = selectedIndex >= 0 ? filteredReceipts[selectedIndex] : null;

  // Pick next rotating smug reaction, never the same twice in a row
  const advanceReaction = useCallback(() => {
    const pool = ARRIVALS_COPY.smugReactions || [];
    if (pool.length <= 1) {
      lastReactionIdxRef.current = 0;
      setReactionIndex(0);
      return;
    }
    const prev = lastReactionIdxRef.current;
    const next = (prev + 1) % pool.length;
    lastReactionIdxRef.current = next;
    setReactionIndex(next);
  }, []);

  // Run 5 stepped clip-path reveal over 700ms, turn LED green, then thud stamp (200ms)
  const runPrintFeed = useCallback(() => {
    clearAllTimers();
    isTearingRef.current = false;
    setIsTearing(false);

    if (paperScrollRef.current) {
      paperScrollRef.current.scrollTop = 0;
    }

    if (reducedMotion) {
      setPrintStep(5);
      setIsPrinting(false);
      setStampLanded(true);
      return;
    }

    setPrintStep(0);
    setIsPrinting(true);
    setStampLanded(false);

    // 5 discrete steps at 140ms, 280ms, 420ms, 560ms, 700ms
    const stepMs = 140;
    for (let s = 1; s <= 5; s++) {
      const id = window.setTimeout(() => {
        setPrintStep(s);
        playFlipClickSound();

        if (s === 5) {
          setIsPrinting(false);
          setStampLanded(true);
        }
      }, s * stepMs);
      timersRef.current.push(id);
    }
  }, [clearAllTimers, reducedMotion]);

  // Animate red stamp thud (scale 1.6 -> 1 over 200ms) when stampLanded flips true
  useLayoutEffect(() => {
    const stampEl = stampRef.current;
    if (!stampEl || !activeReceipt) return;

    if (reducedMotion) {
      gsap.set(stampEl, { scale: 1, rotate: -8, opacity: 1 });
      return;
    }

    if (!stampLanded) {
      gsap.set(stampEl, { scale: 1.6, rotate: -8, opacity: 0 });
      return;
    }

    const tween = gsap.fromTo(
      stampEl,
      { scale: 1.6, rotate: -8, opacity: 0 },
      {
        scale: 1,
        rotate: -8,
        opacity: 1,
        duration: 0.2,
        ease: 'power3.in',
      }
    );

    return () => tween.kill();
  }, [stampLanded, activeReceipt?.id, reducedMotion]);

  const openDetail = useCallback(
    (id) => {
      clearAllTimers();
      setShowLegend(false);
      advanceReaction();
      setSelectedId(id);
      setLastSelectedId(id);
      runPrintFeed();
    },
    [advanceReaction, clearAllTimers, runPrintFeed]
  );

  // Tear current paper (translateY +30px, rotate 4deg, opacity 0, 200ms) then callback
  const tearAndThen = useCallback(
    (afterTear) => {
      clearAllTimers();

      if (reducedMotion) {
        isTearingRef.current = false;
        setIsTearing(false);
        afterTear();
        return;
      }

      isTearingRef.current = true;
      setIsTearing(true);
      setIsPrinting(false);

      const id = window.setTimeout(() => {
        isTearingRef.current = false;
        setIsTearing(false);
        afterTear();
      }, 200);
      timersRef.current.push(id);
    },
    [clearAllTimers, reducedMotion]
  );

  const closeDetail = useCallback(() => {
    if (!selectedId) return;
    tearAndThen(() => {
      setSelectedId(null);
      setPrintStep(reducedMotion ? 5 : 0);
      setStampLanded(reducedMotion);
    });
  }, [reducedMotion, selectedId, tearAndThen]);

  const goPrev = useCallback(() => {
    if (selectedIndex <= 0) return;
    const target = filteredReceipts[selectedIndex - 1];
    if (!target) return;
    tearAndThen(() => {
      advanceReaction();
      setSelectedId(target.id);
      setLastSelectedId(target.id);
      runPrintFeed();
    });
  }, [advanceReaction, filteredReceipts, runPrintFeed, selectedIndex, tearAndThen]);

  const goNext = useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= filteredReceipts.length - 1) return;
    const target = filteredReceipts[selectedIndex + 1];
    if (!target) return;
    tearAndThen(() => {
      advanceReaction();
      setSelectedId(target.id);
      setLastSelectedId(target.id);
      runPrintFeed();
    });
  }, [advanceReaction, filteredReceipts, runPrintFeed, selectedIndex, tearAndThen]);

  // Keyboard navigation in Detail view (Escape/Backspace = back, Left/Right = switch receipts)
  useEffect(() => {
    if (!isInteractive) return;

    const handleKeyDown = (e) => {
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

      if (!activeReceipt) {
        if (e.key === 'Escape' && showLegend) {
          e.preventDefault();
          setShowLegend(false);
        }
        return;
      }

      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        closeDetail();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeReceipt, isInteractive, showLegend, closeDetail, goPrev, goNext]);

  const filterLabels = {
    ALL: OFFICE_COPY.filters.all,
    ARRIVED: OFFICE_COPY.filters.arrived,
    PILOT: OFFICE_COPY.filters.pilot,
    ANNOUNCED: OFFICE_COPY.filters.announced,
  };

  const getFilterCountColor = (key, isActive) => {
    if (isActive) return '#0E0D0C';
    if (key === 'ARRIVED') return '#2FD27A';
    if (key === 'PILOT') return '#F2B24A';
    return '#C97B1A';
  };

  const tabIndexValue = isInteractive ? 0 : -1;
  const isWideLayout = containerWidth >= 700;
  const smugPool = ARRIVALS_COPY.smugReactions || [];
  const reactionText = smugPool[reactionIndex % Math.max(1, smugPool.length)] || '';
  const hasValidSource = activeReceipt && isSafeHttpsUrl(activeReceipt.source);
  const hasValidAlsoRead =
    activeReceipt && activeReceipt.alsoRead && isSafeHttpsUrl(activeReceipt.alsoRead.url);

  return (
    <div
      ref={rootRef}
      data-no-tapfx
      aria-label={OFFICE_COPY.screenAria}
      className="relative w-full h-full overflow-hidden box-border select-none"
      style={{
        backgroundColor: reducedMotion || isLightOn ? '#0E0D0C' : '#0A0A0A',
        color: '#E8DFC9',
      }}
    >
      {/* Revealed screen content wrapper (clipped top -> bottom on screen power-on) */}
      <div
        ref={bootContentRef}
        className="w-full h-full flex flex-col overflow-hidden box-border"
        style={{
          padding: 'clamp(8px, 1.2cqw, 20px) clamp(8px, 1.8cqw, 34px)',
          clipPath: reducedMotion || isLightOn ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)',
          WebkitClipPath: reducedMotion || isLightOn ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)',
        }}
      >
        {!activeReceipt ? (
          /* ================= VIEW 1: LIST ================= */
          <div className="w-full h-full flex flex-col min-h-0">
            {/* Title bar: 3 tiny dots left, THE RECEIPTS center-left, count right */}
            <div
              className="shrink-0 flex items-center justify-between gap-2"
              style={{
                paddingBottom: 'clamp(3px, 0.55cqw, 10px)',
                borderBottom: '1px solid rgba(201, 123, 26, 0.45)',
              }}
            >
              <div className="flex items-center" style={{ gap: 'clamp(6px, 0.9cqw, 14px)' }}>
                <div
                  aria-hidden="true"
                  className="flex items-center shrink-0"
                  style={{ gap: 'clamp(3px, 0.35cqw, 6px)' }}
                >
                  <span
                    className="block rounded-full"
                    style={{
                      width: 'clamp(5px, 0.55cqw, 9px)',
                      height: 'clamp(5px, 0.55cqw, 9px)',
                      backgroundColor: '#C23B22',
                    }}
                  />
                  <span
                    className="block rounded-full"
                    style={{
                      width: 'clamp(5px, 0.55cqw, 9px)',
                      height: 'clamp(5px, 0.55cqw, 9px)',
                      backgroundColor: '#F2B24A',
                    }}
                  />
                  <span
                    className="block rounded-full"
                    style={{
                      width: 'clamp(5px, 0.55cqw, 9px)',
                      height: 'clamp(5px, 0.55cqw, 9px)',
                      backgroundColor: '#C97B1A',
                    }}
                  />
                </div>

                <h2
                  className="font-anton uppercase m-0 leading-none tracking-wide"
                  style={{
                    color: '#F2B24A',
                    fontSize: 'clamp(14px, 2.15cqw, 34px)',
                  }}
                >
                  {OFFICE_COPY.screenTitle}
                </h2>
              </div>

              <span
                className="font-plex font-bold tabular-nums leading-none"
                style={{
                  color: '#F2B24A',
                  fontSize: 'clamp(12px, 1.35cqw, 22px)',
                }}
              >
                {filteredReceipts.length}
              </span>
            </div>

            {/* Filter tabs + "?" status legend button */}
            <div
              className="shrink-0 flex items-center justify-between flex-nowrap"
              style={{
                gap: 'clamp(3px, 0.65cqw, 12px)',
                marginTop: 'clamp(4px, 0.6cqw, 12px)',
                marginBottom: 'clamp(4px, 0.6cqw, 12px)',
              }}
            >
              <div
                role="tablist"
                className="flex items-center flex-nowrap min-w-0"
                style={{ gap: 'clamp(2px, 0.65cqw, 12px)' }}
              >
                {FILTER_KEYS.map((key) => {
                  const isActive = activeFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      data-no-tapfx
                      aria-selected={isActive}
                      tabIndex={tabIndexValue}
                      onClick={() => setActiveFilter(key)}
                      className="font-plex font-semibold uppercase tracking-wide inline-flex items-center justify-center whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] transition-colors"
                      style={{
                        minHeight: 'clamp(28px, 3cqw, 42px)',
                        padding: '0 clamp(4px, 0.95cqw, 16px)',
                        gap: 'clamp(3px, 0.45cqw, 8px)',
                        fontSize: 'clamp(11px, 1cqw, 16px)',
                        lineHeight: 1,
                        backgroundColor: isActive ? '#F2B24A' : 'transparent',
                        color: isActive ? '#0E0D0C' : '#E8DFC9',
                        border: isActive
                          ? '1px solid #F2B24A'
                          : '1px solid rgba(201, 123, 26, 0.4)',
                      }}
                    >
                      <span>{filterLabels[key]}</span>
                      <span
                        className="tabular-nums font-bold"
                        style={{ color: getFilterCountColor(key, isActive) }}
                      >
                        {counts[key]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Small "?" button next to filter tabs */}
              <button
                type="button"
                data-no-tapfx
                aria-label={showLegend ? OFFICE_COPY.legendCloseAria : OFFICE_COPY.legendAria}
                aria-expanded={showLegend}
                tabIndex={tabIndexValue}
                onClick={() => setShowLegend((prev) => !prev)}
                className="font-plex font-bold shrink-0 inline-flex items-center justify-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] transition-colors"
                style={{
                  minHeight: 'clamp(28px, 3cqw, 42px)',
                  minWidth: 'clamp(26px, 3cqw, 42px)',
                  fontSize: 'clamp(11px, 1.05cqw, 16px)',
                  lineHeight: 1,
                  backgroundColor: showLegend ? '#F2B24A' : 'transparent',
                  color: showLegend ? '#0E0D0C' : '#F2B24A',
                  border: showLegend
                    ? '1px solid #F2B24A'
                    : '1px solid rgba(201, 123, 26, 0.45)',
                }}
              >
                {OFFICE_COPY.legendButton}
              </button>
            </div>

            {/* Rows list + optional 3-line status legend panel over the list */}
            <div
              className="relative flex-1 min-h-0 flex flex-col"
              style={{
                borderTop: '1px solid rgba(201, 123, 26, 0.35)',
              }}
            >
              {showLegend && (
                <div
                  role="region"
                  aria-label={OFFICE_COPY.legendAria}
                  data-no-tapfx
                  className="absolute left-0 right-0 top-0 z-20 flex flex-col"
                  style={{
                    backgroundColor: '#0E0D0C',
                    border: '2px solid #C97B1A',
                    boxShadow: '4px 4px 0 #000000',
                    padding: 'clamp(8px, 1cqw, 16px) clamp(10px, 1.3cqw, 20px)',
                    gap: 'clamp(6px, 0.75cqw, 12px)',
                  }}
                >
                  {OFFICE_COPY.legendItems.map((item) => {
                    const chipStyle = STATUS_STYLE[item.status] || {
                      backgroundColor: '#C97B1A',
                      color: '#0E0D0C',
                    };
                    return (
                      <div
                        key={item.status}
                        className="flex items-center"
                        style={{ gap: 'clamp(8px, 1cqw, 14px)' }}
                      >
                        <span
                          className="font-plex font-bold uppercase shrink-0 leading-none"
                          style={{
                            ...chipStyle,
                            fontSize: 'clamp(11px, 0.9cqw, 14px)',
                            padding: 'clamp(3px, 0.3cqw, 5px) clamp(6px, 0.6cqw, 10px)',
                            minWidth: 'clamp(78px, 7.2cqw, 110px)',
                            textAlign: 'center',
                          }}
                        >
                          {item.status}
                        </span>
                        <span
                          className="font-plex"
                          style={{
                            fontSize: 'clamp(11px, 1.05cqw, 16px)',
                            color: '#E8DFC9',
                            lineHeight: 1.3,
                          }}
                        >
                          {item.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="monitor-scroll flex-1 min-h-0 overflow-y-auto flex flex-col">
                {filteredReceipts.map((row, idx) => {
                  const isSelected = lastSelectedId === row.id;
                  const isHovered = hoveredId === row.id || (hintHoverFirstRow && idx === 0);
                  const badgeStyle = STATUS_STYLE[row.status] || {
                    backgroundColor: '#C97B1A',
                    color: '#0E0D0C',
                  };
                  const showBar = isSelected || isHovered;

                  return (
                    <button
                      key={row.id}
                      type="button"
                      data-no-tapfx
                      data-monitor-first-row={idx === 0 ? 'true' : undefined}
                      tabIndex={tabIndexValue}
                      onClick={() => openDetail(row.id)}
                      onMouseEnter={() => setHoveredId(row.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={`relative w-full text-left flex items-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F2B24A] shrink-0 ${
                        idx === 0 && isFirstRowPulsing ? 'monitor-row-pulse-2' : ''
                      }`}
                      style={{
                        minHeight: 'clamp(28px, 6.4cqh, 74px)',
                        padding: 'clamp(2px, 0.4cqw, 10px) clamp(6px, 0.9cqw, 16px)',
                        paddingLeft: 'clamp(8px, 1.1cqw, 18px)',
                        gap: 'clamp(6px, 1cqw, 18px)',
                        backgroundColor: isSelected
                          ? 'rgba(201, 123, 26, 0.16)'
                          : isHovered
                            ? 'rgba(242, 178, 74, 0.08)'
                            : 'transparent',
                        borderBottom: '1px solid rgba(201, 123, 26, 0.22)',
                      }}
                    >
                      {/* Left bronze bar on hover / active selection */}
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-0 bottom-0"
                        style={{
                          width: 'clamp(3px, 0.3cqw, 5px)',
                          backgroundColor: isSelected ? '#F2B24A' : '#C97B1A',
                          opacity: showBar ? 1 : 0,
                        }}
                      />

                      {/* Status chip */}
                      <span
                        className="font-plex font-bold uppercase shrink-0 leading-none"
                        style={{
                          ...badgeStyle,
                          fontSize: 'clamp(11px, 0.85cqw, 14px)',
                          padding: 'clamp(2px, 0.25cqw, 5px) clamp(4px, 0.55cqw, 10px)',
                        }}
                      >
                        {row.status}
                      </span>

                      {/* Institution */}
                      <span
                        className="font-plex font-semibold shrink-0 truncate"
                        style={{
                          width: 'clamp(68px, 19cqw, 260px)',
                          fontSize: 'clamp(11px, 1.1cqw, 18px)',
                          color: '#FFFFFF',
                          lineHeight: 1.2,
                        }}
                      >
                        {row.institution}
                      </span>

                      {/* Headline (1 line with ellipsis) */}
                      <span
                        className="font-plex flex-1 min-w-0 truncate"
                        style={{
                          fontSize: 'clamp(11px, 1.1cqw, 18px)',
                          color: '#E8DFC9',
                          lineHeight: 1.2,
                        }}
                      >
                        {row.headline}
                      </span>

                      {/* Source date */}
                      <span
                        className="font-plex tabular-nums shrink-0 text-right"
                        style={{
                          fontSize: 'clamp(11px, 0.95cqw, 16px)',
                          color: '#C97B1A',
                          lineHeight: 1.2,
                        }}
                      >
                        {row.date}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fixed bottom strip (does not scroll with rows) */}
            {updatedDateLabel && (
              <div
                className="shrink-0 flex items-center justify-end"
                style={{
                  paddingTop: 'clamp(4px, 0.5cqw, 8px)',
                  borderTop: '1px solid rgba(201, 123, 26, 0.3)',
                }}
              >
                <span
                  className="font-plex uppercase tracking-wider leading-none tabular-nums"
                  style={{
                    fontSize: '11px',
                    color: 'rgba(201, 123, 26, 0.8)',
                  }}
                >
                  {updatedDateLabel}
                </span>
              </div>
            )}
          </div>
        ) : (
          /* ================= VIEW 2: THE PRINTED RECEIPT ================= */
          <div className="w-full h-full flex flex-col min-h-0">
            {/* 1. Top bar (fixed) */}
            <div
              className="shrink-0 flex items-center justify-between gap-2"
              style={{
                paddingBottom: 'clamp(4px, 0.5cqw, 9px)',
                borderBottom: '1px solid rgba(201, 123, 26, 0.45)',
              }}
            >
              <button
                type="button"
                data-no-tapfx
                tabIndex={tabIndexValue}
                onClick={closeDetail}
                className="font-plex font-bold uppercase tracking-wide inline-flex items-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
                style={{
                  minHeight: 'clamp(28px, 3cqw, 40px)',
                  padding: '0 clamp(8px, 1cqw, 16px)',
                  gap: 'clamp(4px, 0.5cqw, 8px)',
                  fontSize: 'clamp(11px, 1.05cqw, 16px)',
                  backgroundColor: 'transparent',
                  color: '#F2B24A',
                  border: '1px solid rgba(201, 123, 26, 0.55)',
                }}
              >
                <span aria-hidden="true">←</span>
                <span>{OFFICE_COPY.back}</span>
              </button>

              <div
                className="flex items-center"
                style={{ gap: 'clamp(4px, 0.6cqw, 10px)' }}
              >
                <button
                  type="button"
                  data-no-tapfx
                  aria-label={OFFICE_COPY.prevAria}
                  tabIndex={tabIndexValue}
                  disabled={selectedIndex <= 0}
                  onClick={goPrev}
                  className="font-plex font-bold inline-flex items-center justify-center cursor-pointer disabled:opacity-35 disabled:cursor-default outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
                  style={{
                    minHeight: 'clamp(28px, 3cqw, 40px)',
                    minWidth: 'clamp(28px, 3cqw, 40px)',
                    fontSize: 'clamp(13px, 1.25cqw, 20px)',
                    backgroundColor: 'transparent',
                    color: '#F2B24A',
                    border: '1px solid rgba(201, 123, 26, 0.45)',
                  }}
                >
                  ‹
                </button>

                <span
                  className="font-plex font-bold tabular-nums px-1"
                  style={{
                    fontSize: 'clamp(11px, 1.05cqw, 16px)',
                    color: '#E8DFC9',
                  }}
                >
                  {selectedIndex + 1}/{filteredReceipts.length}
                </span>

                <button
                  type="button"
                  data-no-tapfx
                  aria-label={OFFICE_COPY.nextAria}
                  tabIndex={tabIndexValue}
                  disabled={selectedIndex >= filteredReceipts.length - 1}
                  onClick={goNext}
                  className="font-plex font-bold inline-flex items-center justify-center cursor-pointer disabled:opacity-35 disabled:cursor-default outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
                  style={{
                    minHeight: 'clamp(28px, 3cqw, 40px)',
                    minWidth: 'clamp(28px, 3cqw, 40px)',
                    fontSize: 'clamp(13px, 1.25cqw, 20px)',
                    backgroundColor: 'transparent',
                    color: '#F2B24A',
                    border: '1px solid rgba(201, 123, 26, 0.45)',
                  }}
                >
                  ›
                </button>
              </div>
            </div>

            {/* 2. Dark printer slot bar (fixed above paper scroller, flat colours, status LED at left, no text) */}
            <div
              aria-hidden="true"
              className="shrink-0 relative z-20 flex items-center"
              style={{
                backgroundColor: '#161412',
                border: '2px solid #2A1510',
                padding: 'clamp(4px, 0.45cqw, 8px) clamp(8px, 0.9cqw, 14px)',
                marginTop: 'clamp(4px, 0.55cqw, 10px)',
                gap: 'clamp(8px, 0.9cqw, 14px)',
              }}
            >
              {/* Status LED: blinking amber while printing, green when done */}
              <span
                className={isPrinting && !reducedMotion ? 'animate-pulse shrink-0' : 'shrink-0'}
                style={{
                  width: 'clamp(7px, 0.65cqw, 11px)',
                  height: 'clamp(7px, 0.65cqw, 11px)',
                  borderRadius: '9999px',
                  backgroundColor: isPrinting ? '#F2B24A' : '#2FD27A',
                  border: '1px solid #080706',
                }}
              />

              {/* Narrow recessed slot bar (#080706 with flat-colour inner shadow look) */}
              <div
                className="flex-1 relative overflow-hidden"
                style={{
                  height: 'clamp(8px, 0.9cqw, 14px)',
                  backgroundColor: '#080706',
                  border: '1px solid #000000',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    height: '3px',
                    backgroundColor: '#000000',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: '1px',
                    backgroundColor: '#2A1510',
                  }}
                />
              </div>
            </div>

            {/* 3. Scrollable Paper Area (only this scrolls; overscroll-behavior: contain) */}
            <div
              ref={paperScrollRef}
              className="monitor-scroll flex-1 min-h-0 overflow-y-auto flex justify-center items-start"
              style={{
                overscrollBehavior: 'contain',
                padding: 'clamp(4px, 0.7cqw, 14px) clamp(4px, 0.8cqw, 16px) clamp(12px, 1.5cqw, 24px)',
              }}
            >
              <div
                className="w-full flex items-start justify-center"
                style={{
                  gap: isWideLayout ? 'clamp(16px, 2cqw, 36px)' : '0px',
                }}
              >
                {/* Paper tear wrapper */}
                <div
                  className="shrink-0"
                  style={{
                    width: isWideLayout ? 'min(88%, 420px)' : 'min(88%, 360px)',
                    transform: isTearing
                      ? 'translateY(30px) rotate(4deg)'
                      : 'translateY(0px) rotate(0deg)',
                    opacity: isTearing ? 0 : 1,
                    transition: reducedMotion
                      ? 'none'
                      : 'transform 200ms ease-in, opacity 200ms ease-in',
                  }}
                >
                  {/* Printed thermal paper (#FFFDF7, 5 stepped clip-path feed steps over 700ms) */}
                  <div
                    style={{
                      backgroundColor: '#FFFDF7',
                      color: '#0E0D0C',
                      borderTop: '2px solid #0E0D0C',
                      borderLeft: '2px solid #0E0D0C',
                      borderRight: '2px solid #0E0D0C',
                      boxShadow: '4px 6px 0 #0E0D0C',
                      padding: 'clamp(10px, 1.25cqw, 20px)',
                      paddingBottom: 'clamp(10px, 1.25cqw, 18px)',
                      position: 'relative',
                      fontFamily: '"IBM Plex Mono", monospace',
                      clipPath: CLIP_STEPS[Math.min(5, Math.max(0, printStep))],
                      WebkitClipPath: CLIP_STEPS[Math.min(5, Math.max(0, printStep))],
                    }}
                  >
                    {/* Header row: centered ★ RECEIPT ★ + top-right red stamp SOURCE ATTACHED (never over text) */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto 1fr',
                        alignItems: 'center',
                        gap: '6px',
                        paddingBottom: 'clamp(6px, 0.7cqw, 12px)',
                        marginBottom: 'clamp(7px, 0.8cqw, 14px)',
                        borderBottom: '2px dashed rgba(14, 13, 12, 0.38)',
                      }}
                    >
                      <div aria-hidden="true" />

                      <div
                        className="font-anton uppercase tracking-wider text-center whitespace-nowrap"
                        style={{
                          color: '#0E0D0C',
                          fontSize: 'clamp(13px, 1.35cqw, 22px)',
                          lineHeight: 1.05,
                        }}
                      >
                        ★ {OFFICE_COPY.receiptHeader} ★
                      </div>

                      <div className="flex justify-end">
                        <div
                          ref={stampRef}
                          aria-hidden="true"
                          className="font-anton uppercase whitespace-nowrap select-none"
                          style={{
                            color: '#C23B22',
                            border: '3px solid #C23B22',
                            backgroundColor: '#FFFDF7',
                            fontSize: 'clamp(11px, 0.9cqw, 14px)',
                            lineHeight: 1,
                            padding: 'clamp(2px, 0.25cqw, 4px) clamp(4px, 0.5cqw, 8px)',
                            transform: 'rotate(-8deg)',
                            opacity: stampLanded ? 1 : 0,
                          }}
                        >
                          {OFFICE_COPY.stampLabel}
                        </div>
                      </div>
                    </div>

                    {/* Headline (Anton) */}
                    <h3
                      className="font-anton uppercase m-0"
                      style={{
                        color: '#0E0D0C',
                        fontSize: 'clamp(15px, 1.65cqw, 26px)',
                        lineHeight: 1.12,
                        marginBottom: 'clamp(8px, 0.9cqw, 14px)',
                      }}
                    >
                      {activeReceipt.headline}
                    </h3>

                    {/* Metadata grid: WHO, SOURCE DATE, POSTED BY, TYPE */}
                    <div
                      className="grid grid-cols-2"
                      style={{
                        gap: 'clamp(6px, 0.7cqw, 12px) clamp(8px, 0.9cqw, 16px)',
                        paddingTop: 'clamp(6px, 0.65cqw, 10px)',
                        paddingBottom: 'clamp(6px, 0.65cqw, 10px)',
                        marginBottom: 'clamp(7px, 0.75cqw, 12px)',
                        borderTop: '1px solid rgba(14, 13, 12, 0.2)',
                        borderBottom: '1px solid rgba(14, 13, 12, 0.2)',
                      }}
                    >
                      <div className="min-w-0">
                        <div
                          className="font-plex font-bold uppercase"
                          style={{
                            fontSize: 'clamp(11px, 0.78cqw, 12px)',
                            color: '#6B645A',
                            lineHeight: 1.15,
                          }}
                        >
                          {OFFICE_COPY.whoLabel}
                        </div>
                        <div
                          className="font-plex font-semibold"
                          style={{
                            fontSize: 'clamp(11px, 0.95cqw, 15px)',
                            color: '#0E0D0C',
                            lineHeight: 1.25,
                          }}
                        >
                          {activeReceipt.institution}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div
                          className="font-plex font-bold uppercase"
                          style={{
                            fontSize: 'clamp(11px, 0.78cqw, 12px)',
                            color: '#6B645A',
                            lineHeight: 1.15,
                          }}
                        >
                          {OFFICE_COPY.dateLabel}
                        </div>
                        <div
                          className="font-plex font-semibold tabular-nums"
                          style={{
                            fontSize: 'clamp(11px, 0.95cqw, 15px)',
                            color: '#0E0D0C',
                            lineHeight: 1.25,
                          }}
                        >
                          {activeReceipt.date}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div
                          className="font-plex font-bold uppercase"
                          style={{
                            fontSize: 'clamp(11px, 0.78cqw, 12px)',
                            color: '#6B645A',
                            lineHeight: 1.15,
                          }}
                        >
                          {OFFICE_COPY.postedByLabel}
                        </div>
                        <div
                          className="font-plex font-semibold"
                          style={{
                            fontSize: 'clamp(11px, 0.92cqw, 14px)',
                            color: '#0E0D0C',
                            lineHeight: 1.25,
                          }}
                        >
                          {activeReceipt.sourceBy}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div
                          className="font-plex font-bold uppercase"
                          style={{
                            fontSize: 'clamp(11px, 0.78cqw, 12px)',
                            color: '#6B645A',
                            lineHeight: 1.15,
                          }}
                        >
                          {OFFICE_COPY.typeLabel}
                        </div>
                        <div
                          className="font-plex font-semibold uppercase"
                          style={{
                            fontSize: 'clamp(11px, 0.92cqw, 14px)',
                            color: '#0E0D0C',
                            lineHeight: 1.25,
                          }}
                        >
                          {activeReceipt.sourceType}
                        </div>
                      </div>
                    </div>

                    {/* Status badge row */}
                    <div
                      className="flex items-center"
                      style={{ marginBottom: 'clamp(7px, 0.75cqw, 12px)' }}
                    >
                      <span
                        className="font-plex font-bold uppercase leading-none"
                        style={{
                          ...(STATUS_STYLE[activeReceipt.status] || {
                            backgroundColor: '#C97B1A',
                            color: '#0E0D0C',
                          }),
                          border: '2px solid #0E0D0C',
                          fontSize: 'clamp(11px, 0.88cqw, 14px)',
                          padding: 'clamp(3px, 0.3cqw, 5px) clamp(6px, 0.65cqw, 10px)',
                        }}
                      >
                        {activeReceipt.status}
                      </span>
                    </div>

                    {/* Details paragraph */}
                    <p
                      className="font-plex m-0"
                      style={{
                        fontSize: 'clamp(11px, 0.98cqw, 15px)',
                        color: '#0E0D0C',
                        lineHeight: 1.45,
                        marginBottom: activeReceipt.caveat ? 'clamp(8px, 0.85cqw, 14px)' : '0px',
                      }}
                    >
                      {activeReceipt.details}
                    </p>

                    {/* NOTE block (bronze bar, only when a caveat exists) */}
                    {activeReceipt.caveat && (
                      <div
                        style={{
                          borderLeft: '3px solid #C97B1A',
                          backgroundColor: 'rgba(201, 123, 26, 0.14)',
                          padding: 'clamp(5px, 0.55cqw, 9px) clamp(8px, 0.85cqw, 14px)',
                        }}
                      >
                        <div
                          className="font-plex font-bold uppercase"
                          style={{
                            fontSize: 'clamp(11px, 0.82cqw, 13px)',
                            color: '#9A5A0A',
                            marginBottom: '2px',
                          }}
                        >
                          {OFFICE_COPY.noteLabel}
                        </div>
                        <p
                          className="font-plex m-0"
                          style={{
                            fontSize: 'clamp(11px, 0.92cqw, 14px)',
                            color: '#0E0D0C',
                            lineHeight: 1.38,
                          }}
                        >
                          {activeReceipt.caveat}
                        </p>
                      </div>
                    )}

                    {/* Bottom sawtooth tear edge */}
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: '-2px',
                        right: '-2px',
                        bottom: '-10px',
                        height: '10px',
                        overflow: 'hidden',
                      }}
                    >
                      <svg
                        viewBox="0 0 100 10"
                        preserveAspectRatio="none"
                        className="w-full h-full block"
                      >
                        <path
                          d="M0,0 L0,9 L5,1 L10,9 L15,1 L20,9 L25,1 L30,9 L35,1 L40,9 L45,1 L50,9 L55,1 L60,9 L65,1 L70,9 L75,1 L80,9 L85,1 L90,9 L95,1 L100,9 L100,0 Z"
                          fill="#FFFDF7"
                        />
                        <polyline
                          points="0,9 5,1 10,9 15,1 20,9 25,1 30,9 35,1 40,9 45,1 50,9 55,1 60,9 65,1 70,9 75,1 80,9 85,1 90,9 95,1 100,9"
                          fill="none"
                          stroke="#0E0D0C"
                          strokeWidth="1.4"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Bull reaction framed photo beside paper (only when container width >= 700px) */}
                {isWideLayout && (
                  <div
                    className="shrink-0 flex flex-col items-center text-center"
                    style={{
                      width: 'clamp(150px, 14cqw, 210px)',
                      backgroundColor: '#0E0D0C',
                      border: '2px solid #C97B1A',
                      boxShadow: '4px 4px 0 #000000',
                      padding: 'clamp(8px, 0.9cqw, 14px)',
                      opacity: stampLanded && !isTearing ? 1 : 0,
                      transition: reducedMotion ? 'none' : 'opacity 220ms ease-out',
                    }}
                  >
                    <div
                      className="w-full overflow-hidden"
                      style={{
                        aspectRatio: '1 / 1',
                        border: '2px solid #F2B24A',
                        backgroundColor: '#080706',
                        marginBottom: 'clamp(6px, 0.7cqw, 12px)',
                      }}
                    >
                      <img
                        src={
                          BULL_REACTION_IMG[activeReceipt.status] || '/assets/bull-smug.webp'
                        }
                        alt={OFFICE_COPY.bullReactionAlt}
                        className="w-full h-full object-cover block"
                      />
                    </div>
                    <p
                      className="font-plex m-0 italic"
                      style={{
                        fontSize: 'clamp(11px, 0.92cqw, 14px)',
                        color: '#E8DFC9',
                        lineHeight: 1.35,
                      }}
                    >
                      {reactionText}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Action bar (fixed under paper; single-row; renders nothing if receipt has no https:// link) */}
            {(hasValidSource || hasValidAlsoRead) && (
              <div
                className="shrink-0 flex items-center flex-nowrap min-w-0"
                style={{
                  paddingTop: 'clamp(5px, 0.6cqw, 12px)',
                  gap: 'clamp(6px, 0.85cqw, 14px)',
                  borderTop: '1px solid rgba(201, 123, 26, 0.35)',
                }}
              >
                {hasValidSource && (
                  <a
                    href={activeReceipt.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-no-tapfx
                    tabIndex={tabIndexValue}
                    className="font-plex font-bold uppercase shrink-0 inline-flex items-center justify-center whitespace-nowrap no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
                    style={{
                      minHeight: 'clamp(28px, 3.1cqw, 44px)',
                      padding: '0 clamp(10px, 1.2cqw, 20px)',
                      fontSize: 'clamp(11px, 1.05cqw, 16px)',
                      backgroundColor: '#F2B24A',
                      color: '#0E0D0C',
                      border: '2px solid #0E0D0C',
                      boxShadow: '2px 2px 0 #000000',
                    }}
                  >
                    {isXUrl(activeReceipt.source) ? OFFICE_COPY.viewOnX : OFFICE_COPY.viewSource}
                  </a>
                )}

                {hasValidAlsoRead && (
                  <a
                    href={activeReceipt.alsoRead.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-no-tapfx
                    tabIndex={tabIndexValue}
                    className="font-plex font-bold uppercase min-w-0 inline-flex items-center justify-center whitespace-nowrap no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] truncate"
                    style={{
                      minHeight: 'clamp(28px, 3.1cqw, 44px)',
                      padding: '0 clamp(10px, 1.2cqw, 20px)',
                      fontSize: 'clamp(11px, 1.05cqw, 16px)',
                      backgroundColor: '#FFFDF7',
                      color: '#0E0D0C',
                      border: '2px solid #0E0D0C',
                      boxShadow: '2px 2px 0 #000000',
                    }}
                  >
                    <span className="truncate">
                      {OFFICE_COPY.alsoReadPrefix} {activeReceipt.alsoRead.label}
                    </span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Thin bronze scan-line sweeping downward on power-on */}
      {showBootLine && !reducedMotion && (
        <div
          ref={bootLineRef}
          aria-hidden="true"
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: '0%',
            height: '2px',
            backgroundColor: '#C97B1A',
            zIndex: 25,
          }}
        />
      )}
    </div>
  );
};
