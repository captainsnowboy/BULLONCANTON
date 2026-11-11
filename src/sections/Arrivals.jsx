import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ExternalLink, X, ArrowUpDown } from 'lucide-react';
import rawArrivalsData from '../data/arrivals.json';
import { ARRIVALS_COPY } from '../copy.js';
import { X_URL } from '../config.js';
import { playFlipClickSound } from '../utils/audio';

const CHAR_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/. ';

/**
 * Split-Flap character generator
 */
function useSplitFlapText(targetText, triggerFlip, staggerDelay, reducedMotion) {
  const [displayText, setDisplayText] = useState(targetText);

  useEffect(() => {
    if (reducedMotion || !triggerFlip) {
      setDisplayText(targetText);
      return;
    }

    const startTimeout = setTimeout(() => {
      let step = 0;
      const totalSteps = 4;
      const length = targetText.length;

      playFlipClickSound();

      const interval = setInterval(() => {
        step++;
        if (step >= totalSteps) {
          setDisplayText(targetText);
          clearInterval(interval);
        } else {
          const scrambled = targetText
            .split('')
            .map((char, i) => {
              if (char === ' ') return ' ';
              if (step > totalSteps - 2 && i < (step / totalSteps) * length) {
                return char;
              }
              return CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)];
            })
            .join('');
          setDisplayText(scrambled);
        }
      }, 35);

      return () => clearInterval(interval);
    }, staggerDelay);

    return () => clearTimeout(startTimeout);
  }, [targetText, triggerFlip, staggerDelay, reducedMotion]);

  return displayText;
}

export const Arrivals = () => {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'
  const [selectedId, setSelectedId] = useState(null);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [nowBoardingIdx, setNowBoardingIdx] = useState(0);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // Receipt printing animation states
  const [activeReceiptRow, setActiveReceiptRow] = useState(null);
  const [isTearing, setIsTearing] = useState(false);
  const [printStep, setPrintStep] = useState(0); // 0 to 4
  const [stampLanded, setStampLanded] = useState(false);
  const [bullReactionShown, setBullReactionShown] = useState(false);

  const sectionRef = useRef(null);
  const boardListRef = useRef(null);
  const touchStartYRef = useRef(null);
  const printTimersRef = useRef([]);

  // Check prefers-reduced-motion
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(motionQuery.matches);
    const handler = (e) => setReducedMotion(e.matches);
    motionQuery.addEventListener('change', handler);
    return () => motionQuery.removeEventListener('change', handler);
  }, []);

  // Console warning for sample placeholders
  useEffect(() => {
    const hasPlaceholders = rawArrivalsData.some((row) => row.placeholder === true);
    if (hasPlaceholders) {
      console.warn(
        '[Arrivals Board] Sample placeholder rows detected in src/data/arrivals.json. Replace with verified announcements before production.'
      );
    }
  }, []);

  // Verified arrivals counter
  const verifiedCount = useMemo(() => {
    return rawArrivalsData.filter((r) => !r.placeholder).length;
  }, []);

  // Filter & Sort counts
  const filterCounts = useMemo(() => {
    return {
      ALL: rawArrivalsData.length,
      ARRIVED: rawArrivalsData.filter((r) => r.status === 'ARRIVED').length,
      PILOT: rawArrivalsData.filter((r) => r.status === 'PILOT').length,
      ANNOUNCED: rawArrivalsData.filter((r) => r.status === 'ANNOUNCED').length,
    };
  }, []);

  // Visible filtered & sorted rows
  const visibleArrivals = useMemo(() => {
    const filtered = rawArrivalsData.filter((row) => {
      if (activeFilter === 'ALL') return true;
      return row.status === activeFilter;
    });

    const sorted = [...filtered].sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

    return sorted.map((row, idx) => ({
      ...row,
      reaction: row.reaction || ARRIVALS_COPY.smugReactions[idx % ARRIVALS_COPY.smugReactions.length],
    }));
  }, [activeFilter, sortOrder]);

  // Special "YOUR BANK" row definition
  const yourBankRow = useMemo(() => {
    const item = ARRIVALS_COPY.finalRow;
    return {
      id: 'final-your-bank',
      institution: item.institution,
      status: item.status,
      headline: item.headline,
      date: item.date,
      reaction: item.reaction,
      source: null,
      sourceBy: 'Canton Community',
      sourceType: 'deliberation',
      isYourBank: true,
      placeholder: false,
    };
  }, []);

  // All rows currently selectable in order (including YOUR BANK at the end)
  const allSelectableRows = useMemo(() => {
    return [...visibleArrivals, yourBankRow];
  }, [visibleArrivals, yourBankRow]);

  // Set default selection on desktop once inView or loaded
  useEffect(() => {
    if (!selectedId && allSelectableRows.length > 0) {
      setSelectedId(allSelectableRows[0].id);
      setActiveReceiptRow(allSelectableRows[0]);
      setPrintStep(4);
      setStampLanded(true);
      setBullReactionShown(true);
    }
  }, [selectedId, allSelectableRows]);

  // "Now Boarding" cycle pool (exclude placeholder rows once real rows exist)
  const cyclePool = useMemo(() => {
    const real = rawArrivalsData.filter((r) => !r.placeholder);
    return real.length > 0 ? real : rawArrivalsData;
  }, []);

  // "Now Boarding" 4-second ticker cycle (stops as soon as user interacts)
  useEffect(() => {
    if (hasUserInteracted || cyclePool.length === 0) return;

    const timer = setInterval(() => {
      setNowBoardingIdx((prev) => (prev + 1) % cyclePool.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [hasUserInteracted, cyclePool]);

  // Clear pending print timers
  const clearPrintTimers = useCallback(() => {
    printTimersRef.current.forEach((t) => clearTimeout(t));
    printTimersRef.current = [];
  }, []);

  // Trigger stepped receipt print animation
  const printReceipt = useCallback(
    (newRow) => {
      clearPrintTimers();

      if (reducedMotion) {
        setIsTearing(false);
        setActiveReceiptRow(newRow);
        setPrintStep(4);
        setStampLanded(true);
        setBullReactionShown(true);
        return;
      }

      // If there's an existing receipt, tear it off first
      if (activeReceiptRow && activeReceiptRow.id !== newRow.id) {
        setIsTearing(true);
        const tearTimer = setTimeout(() => {
          setIsTearing(false);
          startFeed(newRow);
        }, 220);
        printTimersRef.current.push(tearTimer);
      } else {
        startFeed(newRow);
      }

      function startFeed(targetRow) {
        setActiveReceiptRow(targetRow);
        setPrintStep(0);
        setStampLanded(false);
        setBullReactionShown(false);

        // Stepped feed: 5 steps over 700ms (~140ms per step)
        const stepInterval = 140;
        for (let s = 1; s <= 4; s++) {
          const t = setTimeout(() => {
            setPrintStep(s);
            playFlipClickSound();
          }, s * stepInterval);
          printTimersRef.current.push(t);
        }

        // Red stamp lands at 720ms
        const stampTimer = setTimeout(() => {
          setStampLanded(true);
        }, 720);
        printTimersRef.current.push(stampTimer);

        // Framed reaction image crossfades in at 920ms
        const bullTimer = setTimeout(() => {
          setBullReactionShown(true);
        }, 920);
        printTimersRef.current.push(bullTimer);
      }
    },
    [activeReceiptRow, clearPrintTimers, reducedMotion]
  );

  // Row selection handler
  const handleSelectRow = useCallback(
    (row, fromUserClick = true) => {
      if (fromUserClick) {
        setHasUserInteracted(true);
      }
      setSelectedId(row.id);
      printReceipt(row);

      // On mobile (< 900px), open bottom sheet
      if (typeof window !== 'undefined' && window.innerWidth < 900) {
        setIsMobileSheetOpen(true);
      }
    },
    [printReceipt]
  );

  // Keyboard navigation (Up / Down arrow keys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isMobileSheetOpen) {
          setIsMobileSheetOpen(false);
        }
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const isFocusedInBoard =
          sectionRef.current &&
          (sectionRef.current.contains(document.activeElement) ||
            document.activeElement === document.body);

        if (!isFocusedInBoard) return;

        e.preventDefault();
        setHasUserInteracted(true);

        const currentIndex = allSelectableRows.findIndex((r) => r.id === selectedId);
        let nextIndex = 0;
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < allSelectableRows.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : allSelectableRows.length - 1;
        }

        const nextRow = allSelectableRows[nextIndex];
        if (nextRow) {
          handleSelectRow(nextRow, true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allSelectableRows, selectedId, handleSelectRow, isMobileSheetOpen]);

  // Lock body scroll while mobile bottom sheet is open
  useEffect(() => {
    if (isMobileSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileSheetOpen]);

  // IntersectionObserver to trigger split-flap flip on view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearPrintTimers();
  }, [clearPrintTimers]);

  // Helper for status badge styling
  const getStatusStyle = (status) => {
    switch (status) {
      case 'ARRIVED':
        return 'text-[#2FD27A] border-[#2FD27A] bg-[#2FD27A]/10';
      case 'PILOT':
        return 'text-[#F2B24A] border-[#F2B24A] bg-[#F2B24A]/10';
      case 'ANNOUNCED':
        return 'text-[#C97B1A] border-[#C97B1A] bg-[#C97B1A]/10';
      case 'BOARDING':
        return 'text-[#F2B24A] border-[#F2B24A] bg-[#F2B24A]/15 animate-pulse';
      default:
        return 'text-[#E8DFC9] border-[#E8DFC9]/40';
    }
  };

  // Source link validator
  const isXLink = (url) => {
    if (!url) return false;
    return url.includes('x.com') || url.includes('twitter.com');
  };

  // Current row displayed in "Now Boarding" cycle
  const currentBoardingRow = cyclePool[nowBoardingIdx] || cyclePool[0];

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-black text-[#E8DFC9] py-16 sm:py-24 px-3 sm:px-6 border-t-2 border-[#C97B1A]/40 select-none pb-24"
    >
      <div className="max-w-6xl mx-auto flex flex-col">
        {/* ============================================================= */}
        {/* HEADER BLOCK                                                  */}
        {/* ============================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-[#F2B24A] pb-4 mb-5 gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 bg-[#F2B24A] rotate-45 inline-block" />
              <span className="font-plex text-xs font-bold tracking-widest text-[#F2B24A] uppercase">
                ONCHAIN DIRECTORY
              </span>
            </div>
            <h2 className="font-anton text-3xl sm:text-5xl tracking-wide text-white uppercase">
              {ARRIVALS_COPY.title}
            </h2>
            <p className="font-plex text-xs sm:text-sm text-[#E8DFC9]/70 mt-1">
              {ARRIVALS_COPY.subtitle}
            </p>
          </div>

          {/* Counter Badge */}
          <div className="bg-[#0E0D0C] border border-[#F2B24A]/40 px-3.5 py-2 flex items-center gap-2 font-plex text-xs sm:text-sm self-start sm:self-auto shadow-[3px_3px_0_#0E0D0C]">
            <span className="text-[#E8DFC9]/60">{ARRIVALS_COPY.counterLabel}:</span>
            <span className="font-bold text-[#F2B24A] text-base sm:text-lg">
              {verifiedCount}
            </span>
          </div>
        </div>

        {/* ============================================================= */}
        {/* "NOW BOARDING" AIRPORT ANNOUNCEMENT LINE                      */}
        {/* ============================================================= */}
        {currentBoardingRow && (
          <div className="mb-5">
            <button
              type="button"
              onClick={() => {
                setHasUserInteracted(true);
                handleSelectRow(currentBoardingRow, true);
              }}
              className="w-full text-left bg-[#0E0D0C] border border-[#F2B24A]/50 hover:border-[#F2B24A] px-3.5 sm:px-5 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer group shadow-[3px_3px_0_#000] focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:outline-none min-h-[44px]"
            >
              <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden">
                <span className="flex items-center gap-1.5 shrink-0 bg-[#F2B24A]/15 border border-[#F2B24A]/60 text-[#F2B24A] text-[10px] sm:text-xs font-plex font-bold px-2 py-0.5 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F2B24A] animate-ping" />
                  {ARRIVALS_COPY.nowBoardingPrefix}
                </span>
                <span className="font-plex font-bold text-xs sm:text-sm text-white shrink-0">
                  {currentBoardingRow.institution}
                </span>
                <span className="text-[#E8DFC9]/40 hidden sm:inline">—</span>
                <span className="font-plex text-xs text-[#E8DFC9]/80 truncate">
                  {currentBoardingRow.headline}
                </span>
              </div>
              <span className="font-plex text-[10px] sm:text-xs text-[#F2B24A] group-hover:text-white uppercase font-bold shrink-0 ml-2">
                RECEIPT ▶
              </span>
            </button>
          </div>
        )}

        {/* ============================================================= */}
        {/* MAIN TWO-COLUMN CONTAINER (Desktop >= 900px, Mobile stacked)   */}
        {/* ============================================================= */}
        <div className="flex flex-col min-[900px]:grid min-[900px]:grid-cols-12 gap-6 items-start">
          {/* =========================================================== */}
          {/* LEFT COLUMN: Controls & Arrivals Board Table                */}
          {/* =========================================================== */}
          <div className="w-full min-[900px]:col-span-7 flex flex-col">
            {/* Filter Chips & Sort Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
              {/* Filter Chips: ALL, ARRIVED, PILOT, ANNOUNCED */}
              <div
                className="flex items-center gap-1.5 overflow-x-auto py-1"
                role="group"
                aria-label="Filter arrivals"
              >
                {['ALL', 'ARRIVED', 'PILOT', 'ANNOUNCED'].map((filterKey) => {
                  const isCurrent = activeFilter === filterKey;
                  const count = filterCounts[filterKey] || 0;
                  const label = ARRIVALS_COPY.filters[filterKey.toLowerCase()] || filterKey;

                  return (
                    <button
                      key={filterKey}
                      type="button"
                      aria-pressed={isCurrent}
                      onClick={() => {
                        setHasUserInteracted(true);
                        setActiveFilter(filterKey);
                      }}
                      className={`px-3 py-1.5 text-xs font-plex font-bold uppercase transition-all cursor-pointer border min-h-[44px] flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-[#F2B24A] text-black border-black shadow-[2px_2px_0_#C97B1A]'
                          : 'bg-[#0E0D0C] text-[#E8DFC9]/80 border-[#F2B24A]/40 hover:border-[#F2B24A] hover:text-white'
                      } focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:outline-none`}
                    >
                      <span>{label}</span>
                      <span
                        className={`text-[10px] px-1 py-0.2 rounded-none ${
                          isCurrent ? 'bg-black/20 text-black' : 'text-[#F2B24A]'
                        }`}
                      >
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sort Toggle Button */}
              <button
                type="button"
                aria-label={ARRIVALS_COPY.sort.toggleLabel}
                onClick={() => {
                  setHasUserInteracted(true);
                  setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'));
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-plex font-bold uppercase bg-[#0E0D0C] text-[#F2B24A] border border-[#F2B24A]/40 hover:border-[#F2B24A] hover:text-white transition-colors cursor-pointer min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:outline-none"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>
                  {sortOrder === 'newest'
                    ? ARRIVALS_COPY.sort.newest
                    : ARRIVALS_COPY.sort.oldest}
                </span>
              </button>
            </div>

            {/* Board Main Frame */}
            <div
              ref={boardListRef}
              className="bg-[#0E0D0C] border-2 sm:border-3 border-[#F2B24A]/50 shadow-[6px_6px_0_#0E0D0C] overflow-hidden"
              role="grid"
              aria-label="Arrivals Board"
            >
              {/* Desktop Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 bg-black border-b border-[#F2B24A]/30 text-[11px] font-plex text-[#F2B24A] uppercase tracking-wider font-bold">
                <div className="col-span-3">STATUS</div>
                <div className="col-span-4">INSTITUTION</div>
                <div className="col-span-5 text-right">DATE / DETAILS</div>
              </div>

              {/* Rows List */}
              <div className="divide-y divide-[#F2B24A]/20">
                {visibleArrivals.length === 0 ? (
                  <div className="p-8 text-center font-plex text-sm text-[#E8DFC9]/60">
                    {ARRIVALS_COPY.emptyFilterText}
                  </div>
                ) : (
                  visibleArrivals.map((row, idx) => {
                    const isSelected = selectedId === row.id;

                    return (
                      <ArrivalBoardRow
                        key={row.id}
                        row={row}
                        isSelected={isSelected}
                        onSelect={() => handleSelectRow(row, true)}
                        idx={idx}
                        inView={inView}
                        reducedMotion={reducedMotion}
                        getStatusStyle={getStatusStyle}
                      />
                    );
                  })
                )}

                {/* Special Final Row: "YOUR BANK" */}
                <ArrivalBoardRow
                  row={yourBankRow}
                  isSelected={selectedId === yourBankRow.id}
                  onSelect={() => handleSelectRow(yourBankRow, true)}
                  idx={visibleArrivals.length}
                  inView={inView}
                  reducedMotion={reducedMotion}
                  getStatusStyle={getStatusStyle}
                  isSpecial={true}
                />
              </div>
            </div>

            {/* Legal Disclaimer & Submission Prompt */}
            <div className="mt-4 pt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px] font-plex text-[#E8DFC9]/60">
              <p className="max-w-2xl leading-relaxed">{ARRIVALS_COPY.legalText}</p>

              {X_URL ? (
                <a
                  href={X_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#F2B24A] hover:text-white underline whitespace-nowrap self-start sm:self-auto font-bold min-h-[44px] py-1"
                >
                  <span>{ARRIVALS_COPY.submitPrompt}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-[#F2B24A]/80 whitespace-nowrap min-h-[44px] flex items-center">
                  {ARRIVALS_COPY.submitPrompt}
                </span>
              )}
            </div>
          </div>

          {/* =========================================================== */}
          {/* RIGHT COLUMN: Sticky Receipt Printer (Desktop >= 900px)     */}
          {/* =========================================================== */}
          <div className="hidden min-[900px]:block min-[900px]:col-span-5 w-full sticky top-20 z-20">
            <ReceiptPrinter
              row={activeReceiptRow}
              isTearing={isTearing}
              printStep={printStep}
              stampLanded={stampLanded}
              bullReactionShown={bullReactionShown}
              isXLink={isXLink}
              getStatusStyle={getStatusStyle}
            />
          </div>
        </div>

        {/* ============================================================= */}
        {/* MOBILE BOTTOM SHEET (< 900px)                                 */}
        {/* ============================================================= */}
        {isMobileSheetOpen && (
          <div className="min-[900px]:hidden fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileSheetOpen(false)}
            />

            {/* Sheet Card */}
            <div
              className="relative w-full max-h-[75dvh] bg-[#0E0D0C] border-t-3 border-[#F2B24A] rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250"
              onTouchStart={(e) => {
                touchStartYRef.current = e.touches[0].clientY;
              }}
              onTouchMove={(e) => {
                if (touchStartYRef.current !== null) {
                  const delta = e.touches[0].clientY - touchStartYRef.current;
                  if (delta > 70) {
                    setIsMobileSheetOpen(false);
                    touchStartYRef.current = null;
                  }
                }
              }}
              onTouchEnd={() => {
                touchStartYRef.current = null;
              }}
            >
              {/* Sheet Header: Grab Handle, Close Button, Reaction */}
              <div className="pt-2.5 pb-2 px-4 border-b border-[#F2B24A]/20 bg-[#12100E] shrink-0">
                {/* Grab handle */}
                <div
                  className="w-12 h-1.5 bg-[#E8DFC9]/40 rounded-full mx-auto mb-2"
                  aria-label={ARRIVALS_COPY.printer.grabHandle}
                />

                <div className="flex items-center justify-between">
                  {/* Reaction Image at Top of Sheet */}
                  <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-[#F2B24A] bg-black shrink-0">
                      <img
                        src={
                          activeReceiptRow?.isYourBank
                            ? '/assets/bull-browraise.png'
                            : '/assets/bull-smug.png'
                        }
                        alt="Bull reaction"
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="font-plex text-xs text-[#E8DFC9]/90 italic truncate">
                      "{activeReceiptRow?.reaction || ARRIVALS_COPY.smugReactions[0]}"
                    </div>
                  </div>

                  {/* Close button */}
                  <button
                    type="button"
                    aria-label={ARRIVALS_COPY.printer.closeSheet}
                    onClick={() => setIsMobileSheetOpen(false)}
                    className="w-11 h-11 flex items-center justify-center text-[#E8DFC9] hover:text-[#F2B24A] cursor-pointer rounded-full bg-black/40 border border-[#F2B24A]/30 shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Sheet Body: Stepped Receipt Printer */}
              <div className="p-4 overflow-y-auto">
                <ReceiptPrinter
                  row={activeReceiptRow}
                  isTearing={isTearing}
                  printStep={printStep}
                  stampLanded={stampLanded}
                  bullReactionShown={bullReactionShown}
                  isXLink={isXLink}
                  getStatusStyle={getStatusStyle}
                  isMobileSheet={true}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

// =========================================================================
// SINGLE ROW COMPONENT ON THE BOARD TABLE
// =========================================================================
const ArrivalBoardRow = ({
  row,
  isSelected,
  onSelect,
  idx,
  inView,
  reducedMotion,
  getStatusStyle,
  isSpecial = false,
}) => {
  const flipStatus = useSplitFlapText(row.status, inView, idx * 60, reducedMotion);
  const flipInstitution = useSplitFlapText(row.institution, inView, idx * 60 + 20, reducedMotion);

  return (
    <button
      type="button"
      role="row"
      aria-selected={isSelected}
      onClick={onSelect}
      className={`relative w-full text-left p-3.5 sm:px-5 sm:py-3.5 transition-all outline-none cursor-pointer min-h-[48px] flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-3 items-start md:items-center ${
        isSelected
          ? 'bg-[#181614] shadow-[inset_0_0_12px_rgba(242,178,74,0.12)]'
          : isSpecial
          ? 'bg-[#110e0c]/80 hover:bg-[#16120e]'
          : 'hover:bg-[#141210]'
      } focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:ring-inset`}
    >
      {/* Thin Bronze Marker pointing at selected row */}
      {isSelected && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1 sm:w-1.5 bg-[#F2B24A] shadow-[0_0_8px_#F2B24A]"
          aria-hidden="true"
        />
      )}

      {/* Status (col 3 on desktop) */}
      <div className="w-full md:w-auto md:col-span-3 flex items-center justify-between md:justify-start gap-2">
        <div className="flex items-center gap-1.5">
          {isSelected && (
            <span className="text-[#F2B24A] text-xs font-bold font-mono shrink-0 animate-pulse">
              ▶
            </span>
          )}
          <span
            className={`px-2 py-0.5 text-[11px] font-plex font-bold border rounded-none uppercase ${getStatusStyle(
              row.status
            )}`}
          >
            {flipStatus}
          </span>
          {row.placeholder && (
            <span className="bg-[#C23B22] text-white text-[9px] font-plex font-bold px-1.5 py-0.5 border border-black uppercase tracking-wider">
              {ARRIVALS_COPY.sampleTag}
            </span>
          )}
        </div>

        {/* Mobile-only date display */}
        <span className="md:hidden font-plex text-xs text-[#E8DFC9]/60">{row.date}</span>
      </div>

      {/* Institution (col 4 on desktop) */}
      <div
        className={`w-full md:w-auto md:col-span-4 font-plex font-bold text-sm sm:text-base truncate ${
          isSpecial ? 'text-[#F2B24A]' : 'text-white'
        }`}
      >
        {flipInstitution}
      </div>

      {/* Date & Details / Headline teaser (col 5 on desktop) */}
      <div className="w-full md:w-auto md:col-span-5 flex items-center justify-between md:justify-end gap-3 text-right">
        <span className="font-plex text-xs text-[#E8DFC9]/70 truncate max-w-[200px] text-left md:text-right hidden sm:inline">
          {row.headline}
        </span>
        <span className="hidden md:inline font-plex text-xs text-[#E8DFC9]/70 shrink-0">
          {row.date}
        </span>
      </div>
    </button>
  );
};

// =========================================================================
// RECEIPT PRINTER COMPONENT (Thermal slot, stepped paper feed, red stamp)
// =========================================================================
const ReceiptPrinter = ({
  row,
  isTearing,
  printStep,
  stampLanded,
  bullReactionShown,
  isXLink,
  getStatusStyle,
  isMobileSheet = false,
}) => {
  if (!row) {
    return (
      <div className="w-full bg-[#0E0D0C] border-2 border-[#F2B24A]/40 p-6 text-center font-plex text-xs text-[#E8DFC9]/50">
        {ARRIVALS_COPY.printer.selectPrompt}
      </div>
    );
  }

  // Calculate vertical reveal based on print step (0 to 4)
  const getClipStyle = () => {
    switch (printStep) {
      case 0:
        return 'max-h-0 opacity-0 overflow-hidden';
      case 1:
        return 'max-h-32 opacity-100 overflow-hidden';
      case 2:
        return 'max-h-64 opacity-100 overflow-hidden';
      case 3:
        return 'max-h-96 opacity-100 overflow-hidden';
      case 4:
      default:
        return 'max-h-[850px] opacity-100';
    }
  };

  const hasValidLink = row.source && row.source.startsWith('https://');

  return (
    <div className="w-full flex flex-col items-center">
      {/* ------------------------------------------------------------- */}
      {/* DARK PRINTER SLOT GRAPHIC AT THE TOP                          */}
      {/* ------------------------------------------------------------- */}
      <div className="w-full bg-[#161412] border-2 sm:border-3 border-[#2A1510] shadow-[0_4px_10px_rgba(0,0,0,0.8)] p-3 relative z-30">
        {/* Top Metallic Panel & Status LED */}
        <div className="flex items-center justify-between pb-2 border-b border-[#2A1510] text-[10px] font-plex text-[#E8DFC9]/60 uppercase tracking-widest font-bold">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                printStep === 4 ? 'bg-[#2FD27A] shadow-[0_0_6px_#2FD27A]' : 'bg-[#F2B24A] animate-ping'
              }`}
            />
            <span>{ARRIVALS_COPY.printer.slotLabel}</span>
          </div>
          <span className="text-[#F2B24A]/80">CANTON DIRECTORY</span>
        </div>

        {/* The Slot Mouth: Narrow dark recessed opening */}
        <div className="w-full h-3 bg-[#080706] rounded-xs border border-black shadow-[inset_0_3px_5px_rgba(0,0,0,0.95)] mt-2" />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* THERMAL PAPER RECEIPT & BESIDE REACTION CONTAINER            */}
      {/* ------------------------------------------------------------- */}
      <div className="w-full flex flex-col xl:flex-row items-start justify-center gap-4 relative z-20 -mt-1">
        {/* Receipt Paper (Feeds out of slot in steps) */}
        <div
          className={`w-full max-w-[360px] xl:max-w-[270px] 2xl:max-w-[300px] transition-all duration-200 ${
            isTearing
              ? 'translate-y-12 rotate-[4deg] opacity-0 pointer-events-none scale-95'
              : 'translate-y-0 opacity-100 scale-100'
          }`}
        >
          <div
            className={`w-full bg-[#FFFDF7] text-black border-2 border-black shadow-[4px_6px_0_#0E0D0C] p-4 relative transition-all duration-150 ease-linear ${getClipStyle()}`}
            style={{
              fontFamily: '"IBM Plex Mono", monospace, monospace',
            }}
          >
            {/* Perforated tear top line */}
            <div className="border-b-2 border-dashed border-black/40 pb-2 mb-3 text-center">
              <div className="font-anton text-xs sm:text-sm tracking-widest uppercase text-black">
                ★ {ARRIVALS_COPY.printer.verifiedHeader} ★
              </div>
              <div className="text-[9px] font-plex text-black/60 tracking-wider uppercase mt-0.5">
                LEDGER REF: #CANT-{row.id.slice(-6).toUpperCase()}
              </div>
            </div>

            {/* Red Stamp Overlay: "SOURCE ATTACHED" (Lands at ~700ms) */}
            {!row.isYourBank && (
              <div
                className={`absolute top-4 right-3 pointer-events-none transition-all duration-200 ${
                  stampLanded
                    ? 'scale-100 rotate-[-8deg] opacity-100'
                    : 'scale-160 rotate-0 opacity-0'
                }`}
              >
                <div className="border-3 border-[#C23B22] text-[#C23B22] px-2 py-0.5 font-anton text-xs tracking-wider uppercase shadow-[0_0_0_1px_#000] bg-[#FFFDF7]/95">
                  {ARRIVALS_COPY.stampLabel}
                </div>
              </div>
            )}

            {/* Headline */}
            <div className="mb-3">
              <span className="text-[9px] font-bold text-black/50 uppercase tracking-widest block">
                HEADLINE
              </span>
              <div className="font-anton text-sm sm:text-base text-black leading-tight mt-0.5">
                {row.headline}
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="border-t border-b border-dashed border-black/40 py-2 mb-3 text-[10px] grid grid-cols-2 gap-2">
              <div>
                <span className="text-[8px] text-black/50 uppercase block font-bold">
                  {ARRIVALS_COPY.printer.institutionLabel}
                </span>
                <span className="font-bold text-black text-xs truncate block">
                  {row.institution}
                </span>
              </div>
              <div>
                <span className="text-[8px] text-black/50 uppercase block font-bold">
                  {ARRIVALS_COPY.printer.dateLabel}
                </span>
                <span className="text-black">{row.date}</span>
              </div>
              <div>
                <span className="text-[8px] text-black/50 uppercase block font-bold">
                  {ARRIVALS_COPY.printer.recordedByLabel}
                </span>
                <span className="text-black/80 truncate block">{row.sourceBy}</span>
              </div>
              <div>
                <span className="text-[8px] text-black/50 uppercase block font-bold">
                  {ARRIVALS_COPY.printer.typeLabel}
                </span>
                <span className="text-black/80 uppercase">{row.sourceType}</span>
              </div>
            </div>

            {/* Optional Screenshot Image */}
            {row.image && (
              <div className="mb-3 bg-black/5 border border-black p-1 overflow-hidden">
                <img
                  src={row.image}
                  alt={`Screenshot for ${row.institution}`}
                  width={800}
                  height={450}
                  className="w-full max-h-40 object-contain mx-auto"
                />
              </div>
            )}

            {/* Status Badge inside receipt */}
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="text-[9px] text-black/60 font-bold uppercase">STATUS:</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold border uppercase ${getStatusStyle(
                  row.status
                )}`}
              >
                {row.status}
              </span>
            </div>

            {/* YOUR BANK special note or VIEW SOURCE button */}
            {row.isYourBank ? (
              <div className="bg-[#0E0D0C] text-[#E8DFC9] p-2.5 border border-black mt-2">
                <div className="text-[9px] text-[#F2B24A] font-bold uppercase tracking-wider mb-1">
                  {ARRIVALS_COPY.printer.yourBankNotice}
                </div>
                <p className="text-[10px] text-[#E8DFC9]/70 leading-snug">
                  {ARRIVALS_COPY.printer.yourBankDesc}
                </p>
              </div>
            ) : hasValidLink ? (
              <a
                href={row.source}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 bg-[#F2B24A] hover:bg-[#ffc463] text-black font-plex font-bold text-xs uppercase py-2.5 px-3 border-2 border-black shadow-[3px_3px_0_#000] active:translate-y-0.5 transition-all min-h-[44px] cursor-pointer"
              >
                <span>
                  {isXLink(row.source)
                    ? ARRIVALS_COPY.buttonText.x
                    : ARRIVALS_COPY.buttonText.source}
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <div className="text-center text-[10px] text-black/50 italic py-1">
                {ARRIVALS_COPY.noSourceAvailable || 'Verified via Canton Ledger records.'}
              </div>
            )}

            {/* Jagged / Sawtooth Bottom Tear Edge */}
            <div className="w-full h-2.5 overflow-hidden mt-3 -mb-4 -mx-4 relative">
              <svg
                viewBox="0 0 100 8"
                preserveAspectRatio="none"
                className="w-[calc(100%+32px)] h-2.5 fill-[#FFFDF7]"
              >
                <path d="M0,0 L0,8 L5,0 L10,8 L15,0 L20,8 L25,0 L30,8 L35,0 L40,8 L45,0 L50,8 L55,0 L60,8 L65,0 L70,8 L75,0 L80,8 L85,0 L90,8 L95,0 L100,8 L100,0 Z" />
              </svg>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* BESIDE PRINTER: FRAMED BULL REACTION PICTURE (Desktop)     */}
        {/* ----------------------------------------------------------- */}
        {!isMobileSheet && (
          <div
            className={`w-full max-w-[360px] xl:w-36 2xl:w-40 shrink-0 bg-[#0E0D0C] border-3 border-[#C97B1A] p-2.5 shadow-[4px_4px_0_#000] flex flex-col items-center text-center transition-opacity duration-300 ${
              bullReactionShown ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Framed Title Plate */}
            <div className="w-full bg-[#181512] border-b border-[#C97B1A]/50 pb-1 mb-2">
              <span className="text-[9px] font-plex text-[#F2B24A] uppercase tracking-widest font-bold">
                ★ VERDICT ★
              </span>
            </div>

            {/* Framed Image */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-none overflow-hidden border-2 border-[#F2B24A] bg-black shrink-0 p-0.5 shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]">
              <img
                src={row.isYourBank ? '/assets/bull-browraise.png' : '/assets/bull-smug.png'}
                alt="Bull reaction"
                width={120}
                height={120}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Deadpan Caption */}
            <div className="mt-2 px-1">
              <p className="font-plex text-[11px] text-[#E8DFC9] italic leading-tight">
                "{row.reaction || ARRIVALS_COPY.smugReactions[0]}"
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
