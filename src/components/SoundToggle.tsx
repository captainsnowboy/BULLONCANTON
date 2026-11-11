import React, { useState, useEffect } from 'react';
import { isSoundEnabled, setSoundEnabled, subscribeSound } from '../utils/audio';
import { SOUND_COPY } from '../copy.js';

export const SoundToggle: React.FC = () => {
  const [enabled, setEnabled] = useState(() => isSoundEnabled());
  const [isBouncing, setIsBouncing] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(media.matches);
    }
  }, []);

  useEffect(() => {
    return subscribeSound((val) => setEnabled(val));
  }, []);

  const handleToggle = () => {
    if (!prefersReducedMotion) {
      setIsBouncing(true);
      setTimeout(() => setIsBouncing(false), 300);
    }
    setSoundEnabled(!enabled);
  };

  const label = enabled ? SOUND_COPY.on : SOUND_COPY.off;

  return (
    <div
      className="fixed right-4 sm:right-6 z-40"
      style={{
        bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={enabled}
        aria-label={label}
        title={label}
        className={`group relative flex items-center justify-center min-h-[48px] min-w-[48px] w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#C97B1A] hover:bg-[#F2B24A] text-black border-2 sm:border-[2.5px] border-black shadow-[3px_3px_0_#000] cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#F2B24A] ${
          isBouncing ? 'animate-squash' : ''
        } ${!enabled && !prefersReducedMotion ? 'animate-breathe' : ''}`}
      >
        {/* Custom Flat Ink SVG Speaker */}
        <svg
          viewBox="0 0 28 28"
          className="w-6 h-6 overflow-visible"
          fill="none"
          stroke="black"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Speaker cone / body */}
          <polygon
            points="4,10 8,10 14,5 14,23 8,18 4,18"
            fill="#0E0D0C"
            stroke="black"
            strokeWidth="2.5"
          />

          {enabled ? (
            /* ON state: sound wave arcs pulsing one after another */
            <g className={prefersReducedMotion ? '' : 'stroke-black'}>
              {/* Inner arc */}
              <path
                d="M 18,9 C 19.5,10.5 20,12 20,14 C 20,16 19.5,17.5 18,19"
                className={prefersReducedMotion ? '' : 'animate-wave-1'}
                strokeWidth="2.5"
              />
              {/* Outer arc */}
              <path
                d="M 22,6 C 24.5,8.5 25.5,11 25.5,14 C 25.5,17 24.5,19.5 22,22"
                className={prefersReducedMotion ? '' : 'animate-wave-2'}
                strokeWidth="2.5"
              />
            </g>
          ) : (
            /* OFF state: diagonal slash */
            <line
              x1="3"
              y1="3"
              x2="25"
              y2="25"
              stroke="#C23B22"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      {/* Embedded keyframes for squash-and-stretch, gentle breathing, and wave pulses */}
      <style>{`
        @keyframes soundSquash {
          0% { transform: scale(1); }
          30% { transform: scale3d(1.18, 0.82, 1); }
          60% { transform: scale3d(0.88, 1.12, 1); }
          80% { transform: scale3d(1.05, 0.95, 1); }
          100% { transform: scale(1); }
        }
        .animate-squash {
          animation: soundSquash 0.3s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
        }

        @keyframes soundBreathe {
          0% { transform: scale(1); }
          100% { transform: scale(1.05); }
        }
        .animate-breathe {
          animation: soundBreathe 2.2s ease-in-out infinite alternate;
        }

        @keyframes pulseWave1 {
          0%, 100% { opacity: 0.3; transform: scale(0.96); transform-origin: 14px 14px; }
          40%, 70% { opacity: 1; transform: scale(1.04); transform-origin: 14px 14px; }
        }
        @keyframes pulseWave2 {
          0%, 20%, 100% { opacity: 0.2; transform: scale(0.94); transform-origin: 14px 14px; }
          60%, 90% { opacity: 1; transform: scale(1.06); transform-origin: 14px 14px; }
        }
        .animate-wave-1 {
          animation: pulseWave1 1.4s ease-in-out infinite;
        }
        .animate-wave-2 {
          animation: pulseWave2 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
