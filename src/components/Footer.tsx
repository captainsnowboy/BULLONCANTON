import React, { useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { X_URL, TELEGRAM_URL } from '../config.js';
import { DISCLAIMER, FOOTER_COPY, EASTER_EGG_COPY } from '../copy.js';
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

  const hasX = Boolean(X_URL && X_URL.trim() !== '');
  const hasTelegram = Boolean(TELEGRAM_URL && TELEGRAM_URL.trim() !== '');
  const hasAnyLink = hasX || hasTelegram;

  return (
    <footer className="w-full bg-[#0E0D0C] border-t border-[#C97B1A]/40 text-[#E8DFC9] pt-8 pb-32 sm:pb-36 px-4 z-20">
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* Brand mark */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2.5 h-2.5 bg-[#C97B1A] rotate-45" />
          <span className="font-anton text-lg tracking-wider text-[#F2B24A]">
            BULL ON CANTON
          </span>
          <div className="w-2.5 h-2.5 bg-[#C97B1A] rotate-45" />
        </div>

        {/* Back to top plain text link */}
        <button
          type="button"
          onClick={handleBackToTop}
          className="font-plex text-xs text-[#E8DFC9]/70 hover:text-[#F2B24A] uppercase tracking-wider mb-6 underline underline-offset-4 cursor-pointer min-h-[44px] inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F2B24A] outline-none"
        >
          {FOOTER_COPY.backToTop}
        </button>

        {/* Social Links */}
        {hasAnyLink ? (
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-6">
            {hasX && (
              <a
                href={X_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-plex text-xs font-bold px-3 py-1.5 bg-black border border-[#C97B1A] hover:bg-[#C97B1A] hover:text-black transition-colors min-h-[44px]"
              >
                <span>X (TWITTER)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {hasTelegram && (
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-plex text-xs font-bold px-3 py-1.5 bg-black border border-[#C97B1A] hover:bg-[#C97B1A] hover:text-black transition-colors min-h-[44px]"
              >
                <span>TELEGRAM</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ) : (
          <p className="font-plex text-xs text-[#E8DFC9]/60 mb-6">
            Links open at launch.
          </p>
        )}

        {/* Required Verbatim Disclaimer (5 quick clicks triggers easter egg toast) */}
        <div
          onClick={handleDisclaimerClick}
          className="max-w-2xl bg-black/50 border border-[#C97B1A]/20 p-4 mb-2 cursor-pointer select-none transition-colors hover:border-[#C97B1A]/40"
          title="Disclaimer"
        >
          <p className="font-plex text-[11px] sm:text-xs text-[#E8DFC9]/70 leading-relaxed">
            {DISCLAIMER}
          </p>
        </div>
      </div>
    </footer>
  );
};
