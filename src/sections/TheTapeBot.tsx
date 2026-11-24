import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { THE_TAPE_BOT_COPY } from '../copy.js';

export const TheTapeBot: React.FC = () => {
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalMounted, setIsModalMounted] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const watchButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const isModalOpenRef = useRef(false);

  const handleToggle = (rowId: string) => {
    setOpenRowId((prev) => (prev === rowId ? null : rowId));
  };

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const openVideo = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    isModalOpenRef.current = true;
    setIsModalMounted(true);
    setIsModalOpen(true);
    if (prefersReducedMotion()) {
      setIsModalVisible(true);
    } else {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (isModalOpenRef.current) {
            setIsModalVisible(true);
          }
        });
      });
    }
  };

  const closeVideo = useCallback(() => {
    if (!isModalOpenRef.current) return;
    isModalOpenRef.current = false;
    setIsModalOpen(false);

    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.pause();
      try {
        videoEl.currentTime = 0;
      } catch {
        // Ignore seek error if metadata has not loaded yet
      }
    }

    setIsModalVisible(false);

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    const finishClose = () => {
      setIsModalMounted(false);
      closeTimerRef.current = null;
      watchButtonRef.current?.focus();
    };

    if (prefersReducedMotion()) {
      finishClose();
    } else {
      closeTimerRef.current = window.setTimeout(finishClose, 200);
    }
  }, []);

  // Lock page scroll while modal is open, start muted playback, and handle Escape + Tab focus trap
  useEffect(() => {
    if (!isModalOpen) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.defaultMuted = true;
      videoEl.muted = true;
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Controls remain visible if browser blocks autoplay
        });
      }
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeVideo();
        return;
      }
      if (e.key === 'Tab') {
        const focusables = [closeButtonRef.current, videoRef.current].filter(
          (el): el is HTMLButtonElement | HTMLVideoElement => Boolean(el)
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isModalOpen, closeVideo]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <section
      id="bot"
      aria-label={THE_TAPE_BOT_COPY.heading}
      className="relative w-full bg-[#E8DFC9] text-[#0E0D0C] border-t-[3px] border-b-[3px] border-[#0E0D0C] -mt-[3px] px-4 sm:px-6 py-10 sm:py-14 z-20 overflow-x-clip"
    >
      <div className="max-w-4xl mx-auto">
        {/* Newspaper Masthead */}
        <header className="border-t-[3px] border-b border-[#0E0D0C] pt-3 pb-4 mb-6 text-center">
          <p className="font-plex text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-[#0E0D0C]/80 mb-1.5">
            {THE_TAPE_BOT_COPY.kicker}
          </p>
          <h2 className="font-anton text-4xl sm:text-6xl uppercase tracking-wider text-[#0E0D0C] leading-none">
            {THE_TAPE_BOT_COPY.heading}
          </h2>
          <p className="font-playfair italic text-sm sm:text-base text-[#0E0D0C]/85 mt-2.5 max-w-2xl mx-auto leading-relaxed">
            {THE_TAPE_BOT_COPY.standfirst}
          </p>
        </header>

        {/* Watch the Bot Showcase Button */}
        <div className="mb-6 flex justify-start">
          <button
            ref={watchButtonRef}
            type="button"
            data-no-tapfx
            onClick={openVideo}
            className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 inline-flex items-center justify-center gap-2.5 bg-[#0E0D0C] text-[#E8DFC9] border-2 border-[#0E0D0C] shadow-[3px_3px_0_#C97B1A] hover:bg-[#C97B1A] hover:text-[#0E0D0C] active:translate-x-[1px] active:translate-y-[1px] font-anton text-base sm:text-lg uppercase tracking-wider text-center cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E0D0C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E8DFC9] whitespace-nowrap"
          >
            <span
              aria-hidden="true"
              className="inline-block w-0 h-0 shrink-0 border-y-[5px] border-y-transparent border-l-[9px] border-l-current"
            />
            <span>{THE_TAPE_BOT_COPY.watchButton}</span>
          </button>
        </div>

        {/* Six-Row Ruled Newspaper Index Accordion */}
        <div className="border-2 border-[#0E0D0C] bg-[#E8DFC9]">
          {THE_TAPE_BOT_COPY.rows.map((row, index) => {
            const isOpen = openRowId === row.id;
            const buttonId = `tape-bot-trigger-${row.id}`;
            const panelId = `tape-bot-panel-${row.id}`;

            return (
              <div
                key={row.id}
                className={index > 0 ? 'border-t border-[#0E0D0C]' : undefined}
              >
                <h3 className="m-0">
                  <button
                    id={buttonId}
                    type="button"
                    data-no-tapfx
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => handleToggle(row.id)}
                    className="w-full min-h-[56px] px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between gap-4 text-left bg-transparent hover:bg-[#0E0D0C]/[0.04] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E0D0C] focus-visible:ring-inset"
                  >
                    <span className="min-w-0 flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                      <span className="font-plex text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-[#0E0D0C]">
                        {row.title}
                      </span>
                      <span className="font-playfair text-xs sm:text-sm text-[#0E0D0C]/70 mt-0.5 sm:mt-0">
                        {row.summary}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`shrink-0 inline-flex items-center justify-center w-6 h-6 font-plex text-xl leading-none font-normal text-[#0E0D0C] transition-transform duration-[250ms] ease-in-out motion-reduce:transition-none ${
                        isOpen ? 'rotate-45' : 'rotate-0'
                      }`}
                    >
                      +
                    </span>
                  </button>
                </h3>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  aria-hidden={!isOpen}
                  className={`grid transition-[grid-template-rows,opacity] duration-[250ms] ease-in-out motion-reduce:transition-none ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div
                      className={`border-t border-[#0E0D0C]/25 px-4 sm:px-5 py-4 ${
                        isOpen ? 'visible' : 'invisible'
                      }`}
                    >
                      <ul className="m-0 p-0 list-none grid grid-cols-1 min-[900px]:grid-cols-2 gap-x-8 gap-y-3 font-plex text-xs sm:text-[13px] leading-relaxed text-[#0E0D0C]">
                        {row.entries.map((entry) => (
                          <li key={entry.trigger} className="min-w-0 break-words">
                            <strong className="font-bold text-[#0E0D0C]">
                              {entry.trigger}
                            </strong>
                            {' — '}
                            <span className="text-[#0E0D0C]/85">{entry.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Row 6: Static Teaser Row (Dashed Rule, Muted Ink, IN TRANSIT Stamp) */}
          <div className="border-t border-dashed border-[#0E0D0C]/55 px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between gap-4 text-left">
            <div className="min-w-0 flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
              <span className="font-plex text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-[#0E0D0C]/60">
                {THE_TAPE_BOT_COPY.teaserRow.title}
              </span>
              <span className="font-playfair text-xs sm:text-sm text-[#0E0D0C]/60 mt-0.5 sm:mt-0">
                {THE_TAPE_BOT_COPY.teaserRow.line}
              </span>
            </div>
            <span className="shrink-0 inline-block border-2 border-[#C23B22] text-[#C23B22] font-anton text-xs sm:text-sm uppercase tracking-[0.12em] px-2 py-0.5 -rotate-1 leading-tight whitespace-nowrap">
              {THE_TAPE_BOT_COPY.teaserRow.stamp}
            </span>
          </div>
        </div>

        {/* Under the Accordion: USE IT IN 30 SECONDS */}
        <div className="mt-6 border-2 border-[#0E0D0C] bg-[#E8DFC9] px-4 sm:px-6 py-5 sm:py-6">
          <h3 className="font-plex text-xs sm:text-[13px] font-bold uppercase tracking-[0.18em] text-[#0E0D0C] border-b border-[#0E0D0C]/30 pb-2.5 mb-4">
            {THE_TAPE_BOT_COPY.quickStart.heading}
          </h3>

          <ol className="m-0 p-0 list-none grid grid-cols-1 min-[900px]:grid-cols-3 gap-3 sm:gap-4 mb-5 font-plex text-xs sm:text-[13px] text-[#0E0D0C]">
            {THE_TAPE_BOT_COPY.quickStart.steps.map((step, idx) => (
              <li key={step} className="flex items-baseline gap-2.5 leading-snug">
                <span className="font-bold tabular-nums text-[#0E0D0C]/70 shrink-0">
                  {idx + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={THE_TAPE_BOT_COPY.quickStart.primaryCta.href}
              target="_blank"
              rel="noopener noreferrer"
              data-no-tapfx
              className="w-full min-h-[48px] px-5 py-2.5 inline-flex items-center justify-center bg-[#0E0D0C] text-[#E8DFC9] border-2 border-[#0E0D0C] shadow-[3px_3px_0_#C97B1A] hover:bg-[#C97B1A] hover:text-[#0E0D0C] active:translate-x-[1px] active:translate-y-[1px] font-anton text-base sm:text-lg uppercase tracking-wider text-center no-underline transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E0D0C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E8DFC9] whitespace-nowrap"
            >
              {THE_TAPE_BOT_COPY.quickStart.primaryCta.label}
            </a>

            <a
              href={THE_TAPE_BOT_COPY.quickStart.secondaryCta.href}
              target="_blank"
              rel="noopener noreferrer"
              data-no-tapfx
              className="w-full min-h-[48px] px-5 py-2.5 inline-flex items-center justify-center bg-[#E8DFC9] text-[#0E0D0C] border-2 border-[#0E0D0C] shadow-[3px_3px_0_#0E0D0C] hover:bg-[#0E0D0C] hover:text-[#E8DFC9] active:translate-x-[1px] active:translate-y-[1px] font-anton text-base sm:text-lg uppercase tracking-wider text-center no-underline transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E0D0C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E8DFC9] whitespace-nowrap"
            >
              {THE_TAPE_BOT_COPY.quickStart.secondaryCta.label}
            </a>
          </div>
        </div>
      </div>

      {/* Blur-Backdrop Showcase Video Modal (mounted only after user tap; preload="none") */}
      {isModalMounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={THE_TAPE_BOT_COPY.videoModal.dialogAria}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeVideo();
              }
            }}
            className={`fixed inset-0 z-[1200] flex items-center justify-center p-4 overflow-hidden overscroll-none touch-none bg-[rgba(10,10,10,0.55)] backdrop-blur-[10px] transition-opacity duration-200 ease-out motion-reduce:transition-none ${
              isModalVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div
              className={`relative w-[min(92vw,92vh,600px)] max-w-[92vw] max-h-[92vh] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
                isModalVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
              }`}
            >
              <button
                ref={closeButtonRef}
                type="button"
                data-no-tapfx
                aria-label={THE_TAPE_BOT_COPY.videoModal.closeAria}
                onClick={closeVideo}
                className="absolute -top-3 -right-2 sm:-top-3.5 sm:-right-3.5 z-10 w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center bg-[#E8DFC9] text-[#0E0D0C] border-2 border-[#0E0D0C] shadow-[2px_2px_0_#C97B1A] hover:bg-[#C97B1A] hover:text-[#0E0D0C] active:translate-x-[1px] active:translate-y-[1px] font-plex text-2xl leading-none font-bold cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8DFC9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0D0C]"
              >
                ×
              </button>
              <div className="border-2 border-[#0E0D0C] bg-[#0E0D0C] shadow-[4px_4px_0_#C97B1A]">
                <video
                  ref={videoRef}
                  src={THE_TAPE_BOT_COPY.videoModal.src}
                  poster={THE_TAPE_BOT_COPY.videoModal.poster}
                  controls
                  playsInline
                  muted
                  autoPlay
                  preload="none"
                  className="block w-full h-auto aspect-square bg-[#0E0D0C]"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
};
