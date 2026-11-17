import React, { useRef } from 'react';
import { TITLE, DISCLAIMER, FOOTER_COPY, EASTER_EGG_COPY, UI_COPY } from '../copy.js';
import { showToast } from '../utils/toast';

export const Footer: React.FC = () => {
  const clickTimesRef = useRef<number[]>([]);

  const handleDisclaimerClick = () => {
    const now = Date.now();
    clickTimesRef.current = [...clickTimesRef.current.filter((t) => now - t < 2500), now];
    if (clickTimesRef.current.length >= 5) {
      clickTimesRef.current = [];
      showToast(EASTER_EGG_COPY.disclaimerToast);
    }
  };

  const handleBackToTop = () => {
    if (typeof window !== 'undefined') {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
    }
  };

  return (
    <footer className="w-full bg-[#0E0D0C] border-t border-[#C97B1A]/40 text-[#E8DFC9] pt-8 pb-36 sm:pb-40 px-4 z-20">
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* Brand mark */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2.5 h-2.5 bg-[#C97B1A] rotate-45" />
          <span className="font-anton text-lg tracking-wider text-[#F2B24A]">
            {TITLE}
          </span>
          <div className="w-2.5 h-2.5 bg-[#C97B1A] rotate-45" />
        </div>

        {/* Back to top plain text link */}
        <button
          type="button"
          data-no-tapfx
          onClick={handleBackToTop}
          className="font-plex text-xs text-[#E8DFC9]/70 hover:text-[#F2B24A] uppercase tracking-wider mb-4 underline underline-offset-4 cursor-pointer min-h-[44px] px-3 inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0D0C] outline-none"
        >
          {FOOTER_COPY.backToTop}
        </button>

        {/* Trust line */}
        <p className="font-plex text-xs text-[#E8DFC9]/80 text-center mb-4">
          {FOOTER_COPY.trustLine}
        </p>

        {/* Required Verbatim Disclaimer (5 quick clicks triggers easter egg toast) */}
        <div
          onClick={handleDisclaimerClick}
          className="max-w-2xl bg-black/50 border border-[#C97B1A]/20 p-4 mb-2 cursor-pointer select-none transition-colors hover:border-[#C97B1A]/40"
          title={UI_COPY.footer.disclaimerTitle}
        >
          <p className="font-plex text-[11px] sm:text-xs text-[#E8DFC9]/70 leading-relaxed">
            {DISCLAIMER}
          </p>
        </div>
      </div>
    </footer>
  );
};
