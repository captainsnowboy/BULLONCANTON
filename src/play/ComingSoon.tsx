import React, { useCallback, useEffect } from 'react';
import { TELEGRAM_URL, X_URL } from '../config.js';
import { PLAY_COPY } from '../copy.js';

const XMarkIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-4 h-4 shrink-0"
    fill="#C97B1A"
    aria-hidden="true"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const PaperPlaneIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-4 h-4 shrink-0"
    fill="#C97B1A"
    aria-hidden="true"
  >
    <path d="M21.5 3.5L2.5 11.2l6.2 2.3 2.4 6.5 3.1-3.5 4.8 3.5L21.5 3.5zM9.2 13.7l8.5-6.6-6.2 7.8-.4 2.9-1.9-4.1z" />
  </svg>
);

const StaticBrickGround: React.FC = () => (
  <svg
    viewBox="0 0 400 220"
    preserveAspectRatio="none"
    className="w-full h-full block"
    aria-hidden="true"
  >
    <defs>
      <pattern id="cs-brick-pattern" width="44" height="22" patternUnits="userSpaceOnUse">
        <rect width="44" height="22" fill="#171513" />
        <rect x="1" y="1" width="20" height="9" fill="#1E1B18" />
        <rect x="23" y="1" width="20" height="9" fill="#231E19" />
        <rect x="-10" y="12" width="20" height="9" fill="#231E19" />
        <rect x="12" y="12" width="20" height="9" fill="#1E1B18" />
        <rect x="34" y="12" width="20" height="9" fill="#1E1B18" />
      </pattern>
    </defs>
    <rect width="400" height="220" fill="url(#cs-brick-pattern)" />
  </svg>
);

const StaticSkylineStill: React.FC = () => (
  <svg
    viewBox="0 0 1200 500"
    preserveAspectRatio="xMidYMax slice"
    className="w-full h-full block"
    aria-hidden="true"
  >
    {/* Back skyline silhouette (#171513) */}
    <path
      d="M0 500 V310 H65 V250 H130 V290 H195 V175 H255 V140 H285 V175 H335 V260 H405 V205 H470 V115 H540 V215 H615 V165 H695 V245 H760 V135 H825 V105 H860 V135 H920 V220 H995 V180 H1075 V265 H1145 V195 H1200 V500 Z"
      fill="#171513"
    />
    {/* Sparse bronze window dots on back skyline */}
    <g fill="#C97B1A" fillOpacity="0.45">
      <rect x="214" y="196" width="5" height="6" />
      <rect x="232" y="218" width="5" height="6" />
      <rect x="268" y="206" width="5" height="6" />
      <rect x="492" y="142" width="5" height="6" />
      <rect x="514" y="168" width="5" height="6" />
      <rect x="642" y="192" width="5" height="6" />
      <rect x="786" y="160" width="5" height="6" />
      <rect x="812" y="185" width="5" height="6" />
      <rect x="1024" y="206" width="5" height="6" />
    </g>

    {/* Front skyline silhouette (#1E1B18) */}
    <path
      d="M0 500 V355 H85 V295 H165 V345 H240 V235 H325 V315 H410 V275 H495 V330 H575 V225 H660 V305 H740 V255 H835 V335 H915 V240 H1005 V320 H1095 V270 H1200 V500 Z"
      fill="#1E1B18"
    />
    {/* Few bronze window dots on front skyline */}
    <g fill="#F2B24A" fillOpacity="0.4">
      <rect x="108" y="318" width="6" height="7" />
      <rect x="268" y="262" width="6" height="7" />
      <rect x="292" y="286" width="6" height="7" />
      <rect x="442" y="302" width="6" height="7" />
      <rect x="606" y="256" width="6" height="7" />
      <rect x="628" y="282" width="6" height="7" />
      <rect x="772" y="286" width="6" height="7" />
      <rect x="944" y="270" width="6" height="7" />
      <rect x="968" y="294" width="6" height="7" />
      <rect x="1126" y="298" width="6" height="7" />
    </g>
  </svg>
);

const StaticBrickStackObstacle: React.FC = () => (
  <svg
    viewBox="0 0 64 58"
    className="w-12 h-11 sm:w-14 sm:h-13 block"
    aria-hidden="true"
  >
    {/* Bottom course */}
    <rect x="2" y="38" width="28" height="18" fill="#8F3D24" stroke="#0E0D0C" strokeWidth="3" />
    <rect x="30" y="38" width="32" height="18" fill="#732F1B" stroke="#0E0D0C" strokeWidth="3" />
    {/* Middle course */}
    <rect x="10" y="20" width="24" height="18" fill="#A84A2C" stroke="#0E0D0C" strokeWidth="3" />
    <rect x="34" y="20" width="24" height="18" fill="#8F3D24" stroke="#0E0D0C" strokeWidth="3" />
    {/* Top brick */}
    <rect x="18" y="3" width="28" height="17" fill="#C23B22" stroke="#0E0D0C" strokeWidth="3" />
  </svg>
);

const StaticRedCandleObstacle: React.FC = () => (
  <svg
    viewBox="0 0 36 86"
    className="w-7 h-16 sm:w-8 sm:h-20 block"
    aria-hidden="true"
  >
    {/* Upper & lower wicks */}
    <line x1="18" y1="2" x2="18" y2="20" stroke="#0E0D0C" strokeWidth="5" strokeLinecap="round" />
    <line x1="18" y1="2" x2="18" y2="20" stroke="#E8DFC9" strokeWidth="2" strokeLinecap="round" />
    <line x1="18" y1="72" x2="18" y2="85" stroke="#0E0D0C" strokeWidth="5" strokeLinecap="round" />
    <line x1="18" y1="72" x2="18" y2="85" stroke="#E8DFC9" strokeWidth="2" strokeLinecap="round" />
    {/* Red candle body */}
    <rect x="6" y="18" width="24" height="54" fill="#C23B22" stroke="#0E0D0C" strokeWidth="3.5" />
    <rect x="10" y="22" width="5" height="46" fill="#E05A40" fillOpacity="0.45" />
  </svg>
);

const StaticBearEdge: React.FC = () => (
  <svg
    viewBox="0 0 140 160"
    className="w-full h-full block"
    aria-hidden="true"
  >
    {/* Charging suited bear edge peeking from left border */}
    <g stroke="#0E0D0C" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
      {/* Dark suit torso / shoulder */}
      <path d="M-15 62 L58 64 L78 108 L44 156 L-15 156 Z" fill="#2A241E" />
      {/* White shirt & red tie */}
      <path d="M22 68 L48 68 L44 114 L22 104 Z" fill="#E8DFC9" />
      <path d="M36 74 L52 82 L46 118 L34 112 Z" fill="#C23B22" />
      {/* Raised clawed forepaw */}
      <path d="M52 72 L94 60 L108 74 L92 92 L58 88 Z" fill="#6E4323" />
      <path d="M102 64 L116 68 L104 74" fill="#E8DFC9" />
      <path d="M105 74 L118 80 L103 84" fill="#E8DFC9" />
      {/* Bear head & snarling jaw */}
      <path d="M-10 18 Q30 6 58 26 L88 36 L86 52 L60 54 L82 68 L62 76 L26 70 L-10 66 Z" fill="#6E4323" />
      {/* Ear */}
      <circle cx="24" cy="18" r="11" fill="#523018" />
      {/* Fangs */}
      <polygon points="62,53 67,62 72,53" fill="#E8DFC9" strokeWidth="2" />
      <polygon points="75,52 80,61 84,52" fill="#E8DFC9" strokeWidth="2" />
      {/* Eye */}
      <polygon points="44,32 58,34 52,40" fill="#E8DFC9" strokeWidth="2" />
      {/* Forward boot / hoof stride */}
      <path d="M24 134 L62 128 L72 152 L20 156 Z" fill="#3D2616" />
    </g>
  </svg>
);

export const ComingSoon: React.FC = () => {
  // Ensure noindex meta tag is present in DOM while flag is active
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      robots.content = 'noindex';
      document.head.appendChild(robots);
    } else if (robots.content !== 'noindex') {
      robots.content = 'noindex';
    }
  }, []);

  const handleBack = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      if (document.referrer) {
        const refOrigin = new URL(document.referrer).origin;
        if (refOrigin === window.location.origin) {
          window.history.back();
          return;
        }
      }
    } catch {
      // Fallback to "/"
    }
    window.location.href = '/';
  }, []);

  return (
    <div
      className="play-page coming-soon-root relative w-full bg-[#0E0D0C] text-[#E8DFC9] overflow-hidden select-none flex flex-col items-center justify-center"
      style={{
        height: '100vh',
        minHeight: '100vh',
      }}
    >
      {/* Inline SVG turbulence mask filter for slightly rough rubber-stamp edges */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="coming-soon-stamp-mask" x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.085"
              numOctaves="3"
              seed="7"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="2.1"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.4 0 0 0 -0.22"
              result="roughMask"
            />
            <feComposite in="displaced" in2="roughMask" operator="in" />
          </filter>
        </defs>
      </svg>

      {/* Blurred, barely visible static game still (never moves, no game code) */}
      <div
        aria-hidden="true"
        className="absolute -inset-4 bg-[#0E0D0C] pointer-events-none overflow-hidden z-0"
        style={{ filter: 'blur(9px) brightness(0.45)' }}
      >
        <div className="relative w-full h-full">
          {/* Dark sky + Two skyline silhouettes sitting cleanly on the 68% ground line */}
          <div className="absolute inset-x-0 top-0 bottom-[32%] overflow-hidden">
            <StaticSkylineStill />
          </div>

          {/* Brick ground below 68% */}
          <div className="absolute inset-x-0 top-[68%] bottom-0 overflow-hidden">
            <StaticBrickGround />
          </div>

          {/* Ground line (#C97B1A) at 68% of the height */}
          <div
            className="absolute inset-x-0 h-[3px] bg-[#C97B1A]"
            style={{ top: '68%' }}
          />

          {/* Two small obstacles on the 68% ground line */}
          <div
            className="absolute"
            style={{ left: '61%', top: '68%', transform: 'translate(-50%, -100%)' }}
          >
            <StaticBrickStackObstacle />
          </div>
          <div
            className="absolute"
            style={{ left: '79%', top: '68%', transform: 'translate(-50%, -100%)' }}
          >
            <StaticRedCandleObstacle />
          </div>

          {/* Edge of the bear at far left */}
          <div
            className="absolute left-0"
            style={{
              top: '68%',
              width: 'clamp(82px, 16vw, 130px)',
              height: 'clamp(96px, 18svh, 152px)',
              transform: 'translateY(-96%)',
            }}
          >
            <StaticBearEdge />
          </div>

          {/* Suited bull on bronze bull at 36% from the left */}
          <div
            className="absolute"
            style={{
              left: '36%',
              top: '68%',
              transform: 'translate(-50%, -97%)',
            }}
          >
            <img
              src="/assets/aistudio/IMG_6489_e00edd76.png"
              alt=""
              width={1536}
              height={1024}
              decoding="async"
              className="h-[clamp(112px,20svh,200px)] w-auto max-w-none block select-none pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* #0E0D0C scrim at 35% */}
      <div className="absolute inset-0 bg-[#0E0D0C]/35 pointer-events-none z-10" aria-hidden="true" />

      {/* Shared site film grain overlay */}
      <div className="comic-grain pointer-events-none z-20" />

      {/* Top-left BACK button */}
      <div
        className="fixed top-0 left-0 z-40 pointer-events-none"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
          paddingLeft: 'max(0.85rem, env(safe-area-inset-left, 0px))',
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label={PLAY_COPY.backAria}
          className="pointer-events-auto inline-flex items-center gap-1.5 min-h-[44px] h-11 px-3.5 sm:px-4 rounded-full bg-[#0E0D0C] border-2 border-[#C97B1A] text-[#E8DFC9] hover:bg-[#C97B1A] hover:text-[#0E0D0C] shadow-[3px_3px_0_rgba(201,123,26,0.45)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_rgba(201,123,26,0.45)] font-plex text-xs sm:text-sm font-semibold uppercase tracking-widest transition-colors duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A] shrink-0 whitespace-nowrap"
        >
          <svg
            viewBox="0 0 16 16"
            className="w-3.5 h-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12.5 8H3.5" />
            <path d="M7.5 4L3.5 8L7.5 12" />
          </svg>
          <span>{PLAY_COPY.backButton}</span>
        </button>
      </div>

      {/* Centered Stamp, Line & Social Ticket Buttons */}
      <main className="relative z-30 flex flex-col items-center justify-center text-center px-4 w-full">
        {/* Big Red Rubber Stamp */}
        <div className="coming-soon-stamp-wrap flex items-center justify-center">
          <div
            className="coming-soon-stamp inline-flex items-center justify-center w-[78vw] max-w-[460px] px-4 py-3 sm:py-4 bg-transparent border-[4px] border-double border-[#C23B22] rounded-[10px]"
            style={{
              filter: 'url(#coming-soon-stamp-mask)',
            }}
          >
            <h1 className="font-anton text-[clamp(2.4rem,10.5vw,4.5rem)] leading-none uppercase text-[#C23B22] tracking-[0.06em] whitespace-nowrap">
              {PLAY_COPY.comingSoon.stamp}
            </h1>
          </div>
        </div>

        {/* Message under the stamp */}
        <p className="mt-7 sm:mt-9 font-plex text-sm sm:text-base text-[#E8DFC9] tracking-wide">
          {PLAY_COPY.comingSoon.message}
        </p>

        {/* Two small buttons side by side in Join the Herd ticket style */}
        <div className="mt-5 w-full max-w-[300px] grid grid-cols-2 gap-3">
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-no-tapfx
            aria-label={PLAY_COPY.comingSoon.xAria}
            className="w-full min-h-[46px] px-3 py-2 bg-[#0E0D0C] border-2 border-[#C97B1A] shadow-[3px_3px_0_#C97B1A] flex items-center justify-center gap-2 select-none outline-none transition-colors hover:bg-[#171410] hover:border-[#F2B24A] active:translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0D0C] cursor-pointer"
          >
            <XMarkIcon />
            <span className="font-anton text-base sm:text-lg tracking-wider uppercase text-white whitespace-nowrap">
              {PLAY_COPY.comingSoon.xLabel}
            </span>
          </a>

          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-no-tapfx
            aria-label={PLAY_COPY.comingSoon.telegramAria}
            className="w-full min-h-[46px] px-3 py-2 bg-[#0E0D0C] border-2 border-[#C97B1A] shadow-[3px_3px_0_#C97B1A] flex items-center justify-center gap-2 select-none outline-none transition-colors hover:bg-[#171410] hover:border-[#F2B24A] active:translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0D0C] cursor-pointer"
          >
            <PaperPlaneIcon />
            <span className="font-anton text-base sm:text-lg tracking-wider uppercase text-white whitespace-nowrap">
              {PLAY_COPY.comingSoon.telegramLabel}
            </span>
          </a>
        </div>
      </main>

      <style>{`
        .coming-soon-root {
          height: 100vh;
          height: 100svh;
          min-height: 100vh;
          min-height: 100svh;
        }
        @keyframes comingSoonThud {
          0% {
            transform: rotate(-8deg) scale(1.6);
            opacity: 0;
          }
          18% {
            opacity: 1;
          }
          100% {
            transform: rotate(-8deg) scale(1);
            opacity: 1;
          }
        }
        @keyframes comingSoonImpactShake {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          20% {
            transform: translate3d(-4px, 3px, 0);
          }
          45% {
            transform: translate3d(4px, -3px, 0);
          }
          70% {
            transform: translate3d(-3px, 2px, 0);
          }
          88% {
            transform: translate3d(2px, -1px, 0);
          }
        }
        .coming-soon-stamp {
          transform: rotate(-8deg) scale(1);
          animation: comingSoonThud 180ms cubic-bezier(0.2, 0.9, 0.3, 1) 1 forwards;
        }
        .coming-soon-stamp-wrap {
          animation: comingSoonImpactShake 160ms ease-out 180ms 1 forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .coming-soon-stamp {
            animation: none !important;
            transform: rotate(-8deg) scale(1) !important;
            opacity: 1 !important;
          }
          .coming-soon-stamp-wrap {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
};
