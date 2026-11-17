import React from 'react';
import { COIN_TEXT } from '../config.js';

const REEDED_TICKS = Array.from({ length: 48 }, (_, idx) => {
  const angle = (idx * 2 * Math.PI) / 48;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x1: (50 + 47 * cos).toFixed(2),
    y1: (50 + 47 * sin).toFixed(2),
    x2: (50 + 44 * cos).toFixed(2),
    y2: (50 + 44 * sin).toFixed(2),
  };
});

// Crescent-horn emblem scaled ~11px tall centred around y = 34
const HORN_EMBLEM_PATH =
  'M39.5 28.5 C39.5 35.8, 44.5 39.5, 50 39.5 C55.5 39.5, 60.5 35.8, 60.5 28.5 C57.8 33.2, 54 34.8, 50 34.8 C46 34.8, 42.2 33.2, 39.5 28.5 Z';

export const MetalCoinSvg = ({ idPrefix = 'coin', isLit = false, specularRef = null, className = '' }) => {
  const rimId = `${idPrefix}-rim-grad`;
  const faceId = `${idPrefix}-face-grad`;
  const faceClipId = `${idPrefix}-face-clip`;
  const specBandId = `${idPrefix}-spec-band`;

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      className={`w-full h-full block overflow-visible ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* 135deg metallic rim gradient */}
        <linearGradient id={rimId} x1="15%" y1="15%" x2="85%" y2="85%">
          <stop offset="0%" stopColor="#FFF0B3" />
          <stop offset="35%" stopColor="#E0A82E" />
          <stop offset="70%" stopColor="#A66F12" />
          <stop offset="100%" stopColor="#F7D774" />
        </linearGradient>

        {/* Radial face gradient (centre 35% 30%) */}
        <radialGradient id={faceId} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#FBE08A" />
          <stop offset="55%" stopColor="#E0AA30" />
          <stop offset="100%" stopColor="#BB7F18" />
        </radialGradient>

        {/* Clip region for face specular band */}
        <clipPath id={faceClipId}>
          <circle cx="50" cy="50" r="39" />
        </clipPath>

        {/* Soft diagonal specular highlight band (white 30% to 0) */}
        <linearGradient id={specBandId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 1. Contact shadow ellipse & 3px thickness circle */}
      <ellipse cx="53" cy="55" rx="48" ry="48" fill="#000000" fillOpacity="0.4" />
      <circle cx="50" cy="53" r="48" fill="#8A5A0E" />

      {/* 2. Metallic rim + 48 short reeding ticks */}
      <circle cx="50" cy="50" r="48" fill={`url(#${rimId})`} stroke="#5C3A06" strokeWidth="1.5" />
      <g>
        {REEDED_TICKS.map((tick, idx) => (
          <line
            key={idx}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="#8A5A0E"
            strokeOpacity="0.6"
            strokeWidth="0.95"
            strokeLinecap="round"
          />
        ))}
      </g>

      {/* 3. Metallic face + inner ring r=37 */}
      <circle cx="50" cy="50" r="39" fill={`url(#${faceId})`} />
      <circle cx="50" cy="50" r="37" fill="none" stroke="#7A4C0A" strokeOpacity="0.6" strokeWidth="1.2" />

      {/* 4. Crescent-horn emblem (size 11, y=34) + engraved Anton $QQQ (y=60) */}
      <path d={HORN_EMBLEM_PATH} fill="#5C3A06" />

      <text
        x="50.6"
        y="60.6"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Anton', sans-serif"
        fontSize="24"
        letterSpacing="0.04em"
        textLength="56"
        lengthAdjust="spacingAndGlyphs"
        fill="#FFF1BE"
      >
        {COIN_TEXT}
      </text>
      <text
        x="50"
        y="60"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Anton', sans-serif"
        fontSize="24"
        letterSpacing="0.04em"
        textLength="56"
        lengthAdjust="spacingAndGlyphs"
        fill="#3B2303"
        stroke="#FFF1BE"
        strokeOpacity="0.6"
        strokeWidth="0.4"
        style={{ paintOrder: 'stroke fill' }}
      >
        {COIN_TEXT}
      </text>

      {/* 5. Soft diagonal specular band clipped to coin face, only when lit */}
      <g
        clipPath={`url(#${faceClipId})`}
        style={{
          opacity: isLit ? 1 : 0,
          transition: 'opacity 300ms ease-in-out',
        }}
      >
        <g ref={specularRef}>
          <g transform="rotate(-30 50 50)">
            <rect x="26" y="-10" width="24" height="120" fill={`url(#${specBandId})`} />
          </g>
        </g>
      </g>
    </svg>
  );
};
