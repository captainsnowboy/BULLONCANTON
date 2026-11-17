import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Download, Share2, Copy, Twitter, Sparkles, RotateCcw, FlipHorizontal, ArrowUpToLine, Trash2, Shuffle } from 'lucide-react';
import { gsap } from 'gsap';
import { MEME_DESK_COPY, CHARGE_COPY, TITLE, UI_COPY } from '../copy.js';
import { Reveal } from '../components/Reveal';
import { isDesktopViewport } from '../utils/desktop';

// =========================================================================
// ENTRANCE & TRANSITION CONSTANTS
// =========================================================================
export const DESK_ENTRANCE_OFFSET_Y = -30; // px
export const DESK_ENTRANCE_ROTATION = -3; // deg
export const DESK_ENTRANCE_DURATION = 0.4; // 400ms
export const DESK_TABS_RISE_Y = 20; // px
export const DESK_TABS_STAGGER = 0.08; // 80ms
export const DESK_ENTRANCE_THRESHOLD = 0.2; // 20% visible
export const DESK_FALLBACK_MS = 2000;

const FACE_NATURAL_W = 1000;
const FACE_NATURAL_H = 859;
const FACE_ASPECT = FACE_NATURAL_H / FACE_NATURAL_W; // 0.859
const FRONTPAGE_BOX = { x: 140, y: 380, w: 800, h: 800 };
const MAX_PROPS = 6;

// =========================================================================
// WORN PROPS TUNING (units follow layout.json: % of face image / px @ 1000w)
// =========================================================================
export const WORN = {
  shadowColor: '#1C0C04',
  shadowRefFaceWidth: 1000,
  crownContactShadow: {
    widthRatio: 0.92,
    heightRatio: 0.16,
    alpha: 0.38,
    color: '#1C0C04',
  },
  neckOverlay: {
    hueMinDeg: 8,
    hueMaxDeg: 55,
    satMin: 0.35,
    valMin: 0.25,
    yStartFrac: 0.4,
    alphaThreshold: 128,
    closeRadiusPx: 2, // 5px closing window at 1000px face width
    dilateRadiusPx: 3, // 3px dilation so dark outlines next to fur are included
  },
  props: {
    shades: {
      layer: 'front',
      shadow: { dx: 0, dy: 6, alpha: 0.28 },
    },
    laser: {
      layer: 'front',
      shadow: null,
    },
    cigar: {
      layer: 'front',
      shadow: { dx: 3, dy: 6, alpha: 0.28 },
      extraShadow: { dx: 3, dy: 6, alpha: 0.28 },
    },
    chain: {
      layer: 'mid',
      snapOffsetY: -2,
      shadow: { dx: 0, dy: 8, alpha: 0.30 },
    },
    nosering: {
      layer: 'front',
      clipTop: 0.38,
      shadow: { dx: 2, dy: 5, alpha: 0.30 },
    },
    earring: {
      layer: 'front',
      clipTop: 0.30,
      shadow: { dx: 2, dy: 4, alpha: 0.30 },
    },
    crown: {
      layer: 'front',
      clipBottomArc: 0.12,
      contactShadow: true,
      shadow: null,
    },
    carnation: {
      layer: 'front',
      shadow: { dx: 2, dy: 3, alpha: 0.28 },
    },
  },
};

const STAMP_FONT = 'bold 44px Anton, sans-serif';
const STAMP_PADDING_X = 32;
const STAMP_INNER_H = 70;
const STAMP_BORDER_W = 8;
const STAMP_INNER_BORDER_W = 2.5;
const STAMP_ROT_DEG = -12;

let stampMeasureCtx = null;
function measureStampTextWidth(stampText) {
  if (typeof document === 'undefined') return stampText.length * 24;
  if (!stampMeasureCtx) {
    const c = document.createElement('canvas');
    stampMeasureCtx = c.getContext('2d');
  }
  if (!stampMeasureCtx) return stampText.length * 24;
  stampMeasureCtx.font = STAMP_FONT;
  return stampMeasureCtx.measureText(stampText).width;
}

// Module-level image & layout caches
const imageCache = new Map();
function loadMemeImage(src) {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src));
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

let cachedLayout = null;
let layoutFetchPromise = null;
function loadMemeLayoutOnce() {
  if (cachedLayout) return Promise.resolve(cachedLayout);
  if (!layoutFetchPromise) {
    layoutFetchPromise = fetch('/assets/meme/layout.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        cachedLayout = data;
        return data;
      })
      .catch((err) => {
        layoutFetchPromise = null;
        throw err;
      });
  }
  return layoutFetchPromise;
}

// Compute drawn face rect { x, y, w, h } for any template (1000:859 transparent faces)
export function faceRect(template) {
  if (template === 'classic') {
    const w = 1080;
    const h = w * FACE_ASPECT;
    return { x: 0, y: 1080 - h, w, h };
  }
  if (template === 'speech') {
    const w = 900;
    const h = w * FACE_ASPECT;
    return { x: (1080 - w) / 2, y: 1080 - h, w, h };
  }
  // frontpage framed photo box
  const w = FRONTPAGE_BOX.w;
  const h = w * FACE_ASPECT;
  return { x: FRONTPAGE_BOX.x, y: FRONTPAGE_BOX.y + FRONTPAGE_BOX.h - h, w, h };
}

function clampNum(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function normalizeAngleDeltaDeg(a, b) {
  return ((a - b + 540) % 360) - 180;
}

// Cached offscreen silhouette shadows (keyed by src + rounded px size)
const shadowSilhouetteCache = new Map();
function getShadowSilhouette(loadedImg, src, drawW, drawH) {
  const w = Math.max(1, Math.round(drawW));
  const h = Math.max(1, Math.round(drawH));
  const key = `${src}|${w}x${h}|${WORN.shadowColor}`;
  if (shadowSilhouetteCache.has(key)) {
    return shadowSilhouetteCache.get(key);
  }
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  if (octx) {
    octx.drawImage(loadedImg, 0, 0, w, h);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = WORN.shadowColor;
    octx.fillRect(0, 0, w, h);
  }
  if (shadowSilhouetteCache.size > 160) {
    const firstKey = shadowSilhouetteCache.keys().next().value;
    shadowSilhouetteCache.delete(firstKey);
  }
  shadowSilhouetteCache.set(key, off);
  return off;
}

// Fast separable binary morphology helpers for neck overlay fur mask
function dilateMask1D(src, w, h, radius) {
  if (radius <= 0) return src;
  const horiz = new Uint8Array(w * h);
  const dst = new Uint8Array(w * h);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    const initEnd = Math.min(w - 1, radius);
    for (let k = 0; k <= initEnd; k++) sum += src[row + k];
    for (let x = 0; x < w; x++) {
      if (sum > 0) horiz[row + x] = 1;
      const outIdx = x - radius;
      const inIdx = x + radius + 1;
      if (outIdx >= 0) sum -= src[row + outIdx];
      if (inIdx < w) sum += src[row + inIdx];
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    let sum = 0;
    const initEnd = Math.min(h - 1, radius);
    for (let k = 0; k <= initEnd; k++) sum += horiz[k * w + x];
    for (let y = 0; y < h; y++) {
      if (sum > 0) dst[y * w + x] = 1;
      const outY = y - radius;
      const inY = y + radius + 1;
      if (outY >= 0) sum -= horiz[outY * w + x];
      if (inY < h) sum += horiz[inY * w + x];
    }
  }
  return dst;
}

function erodeMask1D(src, w, h, radius) {
  if (radius <= 0) return src;
  const horiz = new Uint8Array(w * h);
  const dst = new Uint8Array(w * h);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    const initEnd = Math.min(w - 1, radius);
    for (let k = 0; k <= initEnd; k++) sum += src[row + k];
    for (let x = 0; x < w; x++) {
      const left = Math.max(0, x - radius);
      const right = Math.min(w - 1, x + radius);
      if (sum === right - left + 1) horiz[row + x] = 1;
      const outIdx = x - radius;
      const inIdx = x + radius + 1;
      if (outIdx >= 0) sum -= src[row + outIdx];
      if (inIdx < w) sum += src[row + inIdx];
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    let sum = 0;
    const initEnd = Math.min(h - 1, radius);
    for (let k = 0; k <= initEnd; k++) sum += horiz[k * w + x];
    for (let y = 0; y < h; y++) {
      const top = Math.max(0, y - radius);
      const bottom = Math.min(h - 1, y + radius);
      if (sum === bottom - top + 1) dst[y * w + x] = 1;
      const outY = y - radius;
      const inY = y + radius + 1;
      if (outY >= 0) sum -= horiz[outY * w + x];
      if (inY < h) sum += horiz[inY * w + x];
    }
  }
  return dst;
}

// Cached offscreen neck fur layer per transparent face
const neckOverlayCache = new Map();
function getNeckOverlayCanvas(faceSrc, bullImg) {
  if (!faceSrc || !bullImg || !bullImg.naturalWidth) return null;
  if (neckOverlayCache.has(faceSrc)) {
    return neckOverlayCache.get(faceSrc);
  }

  const w = bullImg.naturalWidth;
  const h = bullImg.naturalHeight;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d', { willReadFrequently: true });
  if (!octx) return null;

  octx.drawImage(bullImg, 0, 0, w, h);
  let imgData;
  try {
    imgData = octx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }

  const data = imgData.data;
  const cfg = WORN.neckOverlay;
  const yStart = Math.floor(h * cfg.yStartFrac);
  const mask = new Uint8Array(w * h);

  for (let y = yStart; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      const p = idx * 4;
      if (data[p + 3] < cfg.alphaThreshold) continue;

      const r = data[p] / 255;
      const g = data[p + 1] / 255;
      const b = data[p + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const v = max;
      if (v <= cfg.valMin || delta === 0) continue;

      const s = delta / max;
      if (s <= cfg.satMin) continue;

      let hue;
      if (max === r) {
        hue = 60 * (((g - b) / delta) % 6);
        if (hue < 0) hue += 360;
      } else if (max === g) {
        hue = 60 * ((b - r) / delta + 2);
      } else {
        hue = 60 * ((r - g) / delta + 4);
      }

      if (hue >= cfg.hueMinDeg && hue <= cfg.hueMaxDeg) {
        mask[idx] = 1;
      }
    }
  }

  const resScale = w / WORN.shadowRefFaceWidth;
  const closeR = Math.max(1, Math.round(cfg.closeRadiusPx * resScale));
  const dilateR = Math.max(1, Math.round(cfg.dilateRadiusPx * resScale));

  const dilatedOnce = dilateMask1D(mask, w, h, closeR);
  const closed = erodeMask1D(dilatedOnce, w, h, closeR);
  const grown = dilateMask1D(closed, w, h, dilateR);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    const aboveCutoff = y < yStart;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      if (aboveCutoff || grown[idx] === 0) {
        data[idx * 4 + 3] = 0;
      }
    }
  }

  octx.putImageData(imgData, 0, 0);
  neckOverlayCache.set(faceSrc, off);
  return off;
}

// Reused offscreen buffer for crown contact shadow masking
let crownShadowBufferCanvas = null;
function drawCrownContactShadowLayer(ctx, rect, bullImg, crownSprites) {
  if (!crownSprites || crownSprites.length === 0 || !bullImg) return;
  const cw = Math.max(1, Math.ceil(rect.w));
  const ch = Math.max(1, Math.ceil(rect.h));
  if (!crownShadowBufferCanvas) {
    crownShadowBufferCanvas = document.createElement('canvas');
  }
  if (crownShadowBufferCanvas.width !== cw || crownShadowBufferCanvas.height !== ch) {
    crownShadowBufferCanvas.width = cw;
    crownShadowBufferCanvas.height = ch;
  }
  const sctx = crownShadowBufferCanvas.getContext('2d');
  if (!sctx) return;

  sctx.clearRect(0, 0, cw, ch);
  sctx.save();
  sctx.fillStyle = WORN.crownContactShadow.color;
  sctx.globalAlpha = WORN.crownContactShadow.alpha;

  for (const s of crownSprites) {
    const loaded = s.img || imageCache.get(s.src);
    if (!loaded) continue;
    const aspect = loaded.naturalWidth > 0 ? loaded.naturalHeight / loaded.naturalWidth : 1;
    const drawW = s.spriteW;
    const drawH = drawW * aspect;

    let lx = (0.5 - s.pivotX) * drawW;
    const ly = (1.0 - s.pivotY) * drawH;
    if (s.flip) lx = -lx;
    const rad = ((s.rotDeg || 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const bcX = s.px + lx * cos - ly * sin - rect.x;
    const bcY = s.py + lx * sin + ly * cos - rect.y;

    const rx = (drawW * WORN.crownContactShadow.widthRatio) / 2;
    const ry = (drawH * WORN.crownContactShadow.heightRatio) / 2;

    sctx.save();
    sctx.translate(bcX, bcY);
    if (rad) sctx.rotate(rad);
    sctx.beginPath();
    sctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    sctx.fill();
    sctx.restore();
  }
  sctx.restore();

  // Keep shadow only where face pixels are opaque
  sctx.globalCompositeOperation = 'destination-in';
  sctx.drawImage(bullImg, 0, 0, cw, ch);
  sctx.globalCompositeOperation = 'source-over';

  ctx.drawImage(crownShadowBufferCanvas, rect.x, rect.y, cw, ch);
}

function applyBottomArcClip(ctx, left, top, drawW, drawH, arcFrac) {
  const right = left + drawW;
  const bottom = top + drawH;
  const rise = drawH * arcFrac;
  const sideBottom = bottom - rise;
  const midX = left + drawW / 2;

  ctx.beginPath();
  ctx.moveTo(left - 2, top - 2);
  ctx.lineTo(right + 2, top - 2);
  ctx.lineTo(right + 2, sideBottom);
  ctx.lineTo(right, sideBottom);
  ctx.quadraticCurveTo(midX, bottom + rise, left, sideBottom);
  ctx.lineTo(left - 2, sideBottom);
  ctx.closePath();
  ctx.clip();
}

// Resolve every sprite & active extra of a placed prop into canvas px geometry
function resolvePropSprites(propItem, layoutProp, faceAnchors, rect) {
  if (!propItem || !layoutProp || !faceAnchors) return [];
  const results = [];
  const baseOffset = layoutProp.offset || { x: 0, y: 0 };
  const wornCfg = WORN.props[layoutProp.id] || {};
  const snapOffsetY = wornCfg.snapOffsetY || 0;
  const layer = wornCfg.layer || 'front';

  for (const sp of layoutProp.sprites || []) {
    const snapName = sp.snap || layoutProp.snap;
    const anchor = faceAnchors[snapName];
    if (!anchor) continue;

    const src = `/assets/meme/${sp.file}`;
    const img = imageCache.get(src);
    const aspect =
      img && img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;

    const lx = anchor.x + (baseOffset.x || 0) + (propItem.dx || 0);
    const ly = anchor.y + (baseOffset.y || 0) + snapOffsetY + (propItem.dy || 0);

    const px = rect.x + (lx / 100) * rect.w;
    const py = rect.y + (ly / 100) * rect.h;
    const spriteW = rect.w * (sp.widthPct / 100) * propItem.scale;
    const spriteH = spriteW * aspect;

    results.push({
      propId: layoutProp.id,
      layer,
      shadow: wornCfg.shadow || null,
      clipTop: wornCfg.clipTop || 0,
      clipBottomArc: wornCfg.clipBottomArc || 0,
      contactShadow: Boolean(wornCfg.contactShadow),
      src,
      img,
      px,
      py,
      spriteW,
      spriteH,
      pivotX: sp.pivot?.x ?? 0.5,
      pivotY: sp.pivot?.y ?? 0.5,
      rotDeg: propItem.rot || 0,
      flip: Boolean(propItem.flip),
      isExtra: false,
    });
  }

  // Optional extras (e.g. cigar smoke)
  for (const extra of layoutProp.extras || []) {
    const isOn =
      propItem.extras && typeof propItem.extras[extra.id] === 'boolean'
        ? propItem.extras[extra.id]
        : Boolean(extra.defaultOn);
    if (!isOn) continue;

    const anchor = faceAnchors[layoutProp.snap];
    if (!anchor) continue;

    const src = `/assets/meme/${extra.file}`;
    const img = imageCache.get(src);
    const aspect =
      img && img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;

    const lx = anchor.x + (baseOffset.x || 0) + (propItem.dx || 0);
    const ly = anchor.y + (baseOffset.y || 0) + snapOffsetY + (propItem.dy || 0);
    const anchorPx = rect.x + (lx / 100) * rect.w;
    const anchorPy = rect.y + (ly / 100) * rect.h;

    const offX =
      ((extra.offsetFromSnap?.x || 0) / 100) *
      rect.w *
      propItem.scale *
      (propItem.flip ? -1 : 1);
    const offY = ((extra.offsetFromSnap?.y || 0) / 100) * rect.h * propItem.scale;
    const rad = ((propItem.rot || 0) * Math.PI) / 180;
    const tipX = anchorPx + offX * Math.cos(rad) - offY * Math.sin(rad);
    const tipY = anchorPy + offX * Math.sin(rad) + offY * Math.cos(rad);

    const spriteW = rect.w * (extra.widthPct / 100) * propItem.scale;
    const spriteH = spriteW * aspect;

    results.push({
      propId: layoutProp.id,
      layer,
      shadow: wornCfg.extraShadow !== undefined ? wornCfg.extraShadow : wornCfg.shadow || null,
      clipTop: 0,
      clipBottomArc: 0,
      contactShadow: false,
      src,
      img,
      px: tipX,
      py: tipY,
      spriteW,
      spriteH,
      pivotX: extra.pivot?.x ?? 0.5,
      pivotY: extra.pivot?.y ?? 1.0,
      rotDeg: 0,
      flip: false,
      isExtra: true,
    });
  }

  return results;
}

// Compute tight oriented bounding box for DOM selection frame in canvas px
function computePropSelectionBox(propItem, resolvedSprites) {
  const primaries = resolvedSprites.filter((s) => !s.isExtra);
  const targetSprites = primaries.length > 0 ? primaries : resolvedSprites;
  if (targetSprites.length === 0) return null;

  const rotDeg = propItem.rot || 0;
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Transform all sprite corners into canvas space, then project into group-rotated axes
  const corners = [];
  for (const s of targetSprites) {
    const signX = s.flip ? -1 : 1;
    const x0 = -s.pivotX * s.spriteW * signX;
    const x1 = (1 - s.pivotX) * s.spriteW * signX;
    const minLx = Math.min(x0, x1);
    const maxLx = Math.max(x0, x1);
    const minLy = -s.pivotY * s.spriteH;
    const maxLy = (1 - s.pivotY) * s.spriteH;

    const sRad = (s.rotDeg * Math.PI) / 180;
    const sCos = Math.cos(sRad);
    const sSin = Math.sin(sRad);

    for (const [lx, ly] of [
      [minLx, minLy],
      [maxLx, minLy],
      [maxLx, maxLy],
      [minLx, maxLy],
    ]) {
      corners.push([
        s.px + lx * sCos - ly * sSin,
        s.py + lx * sSin + ly * sCos,
      ]);
    }
  }

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;

  for (const [cx, cy] of corners) {
    const u = cx * cos + cy * sin;
    const v = -cx * sin + cy * cos;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  const centerU = (minU + maxU) / 2;
  const centerV = (minV + maxV) / 2;
  const centerX = centerU * cos - centerV * sin;
  const centerY = centerU * sin + centerV * cos;

  return {
    centerX,
    centerY,
    width: Math.max(44, maxU - minU),
    height: Math.max(44, maxV - minV),
    rotDeg,
  };
}

// Hit-test a canvas point against a single prop's primary sprites (with generous touch slop)
function hitTestSprites(canvasX, canvasY, resolvedSprites, slopPx = 22) {
  const primaries = resolvedSprites.filter((s) => !s.isExtra);
  for (const s of primaries) {
    const dx = canvasX - s.px;
    const dy = canvasY - s.py;
    const rad = (-s.rotDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    let lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    if (s.flip) lx = -lx;

    const minX = -s.pivotX * s.spriteW - slopPx;
    const maxX = (1 - s.pivotX) * s.spriteW + slopPx;
    const minY = -s.pivotY * s.spriteH - slopPx;
    const maxY = (1 - s.pivotY) * s.spriteH + slopPx;

    if (lx >= minX && lx <= maxX && ly >= minY && ly <= maxY) {
      return true;
    }
  }
  return false;
}

const BRICK_SHADES = ['#8F2617', '#9B2B1A', '#832215', '#A32E1C'];

// Predefined row of OHLC candles (y fractions from top, 0 = top, 1 = bottom)
const CANDLE_SERIES = [
  { o: 0.72, c: 0.56, h: 0.44, l: 0.80 },
  { o: 0.56, c: 0.64, h: 0.48, l: 0.72 },
  { o: 0.64, c: 0.46, h: 0.34, l: 0.70 },
  { o: 0.46, c: 0.53, h: 0.38, l: 0.62 },
  { o: 0.53, c: 0.34, h: 0.22, l: 0.60 },
  { o: 0.34, c: 0.42, h: 0.26, l: 0.50 },
  { o: 0.42, c: 0.28, h: 0.16, l: 0.52 },
  { o: 0.28, c: 0.38, h: 0.19, l: 0.48 },
  { o: 0.38, c: 0.22, h: 0.12, l: 0.46 },
  { o: 0.22, c: 0.31, h: 0.14, l: 0.41 },
  { o: 0.31, c: 0.18, h: 0.09, l: 0.38 },
  { o: 0.18, c: 0.29, h: 0.11, l: 0.40 },
  { o: 0.29, c: 0.16, h: 0.08, l: 0.35 },
  { o: 0.16, c: 0.25, h: 0.10, l: 0.36 },
  { o: 0.25, c: 0.13, h: 0.06, l: 0.32 },
];

function BackgroundPatternPreview({ pattern }) {
  if (pattern === 'brick') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 w-full h-full"
      >
        <rect width="24" height="24" fill="#0E0D0C" />
        <rect x="0" y="0" width="11" height="5" fill="#942919" />
        <rect x="12.5" y="0" width="11.5" height="5" fill="#A32E1C" />
        <rect x="0" y="6.5" width="5" height="5" fill="#832215" />
        <rect x="6.5" y="6.5" width="11" height="5" fill="#942919" />
        <rect x="19" y="6.5" width="5" height="5" fill="#8F2617" />
        <rect x="0" y="13" width="11" height="5" fill="#9B2B1A" />
        <rect x="12.5" y="13" width="11.5" height="5" fill="#8F2617" />
        <rect x="0" y="19.5" width="5" height="4.5" fill="#942919" />
        <rect x="6.5" y="19.5" width="11" height="4.5" fill="#A32E1C" />
        <rect x="19" y="19.5" width="5" height="4.5" fill="#832215" />
      </svg>
    );
  }
  if (pattern === 'candles') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 w-full h-full"
      >
        <rect width="24" height="24" fill="#0E0D0C" />
        <rect x="3.5" y="8" width="1" height="11" fill="#2FD27A" />
        <rect x="2" y="10" width="4" height="7" fill="#2FD27A" />
        <rect x="9" y="5" width="1" height="12" fill="#C23B22" />
        <rect x="7.5" y="7" width="4" height="6" fill="#C23B22" />
        <rect x="14.5" y="4" width="1" height="14" fill="#2FD27A" />
        <rect x="13" y="6" width="4" height="9" fill="#2FD27A" />
        <rect x="20" y="7" width="1" height="12" fill="#C23B22" />
        <rect x="18.5" y="9" width="4" height="7" fill="#C23B22" />
      </svg>
    );
  }
  if (pattern === 'sunburst') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 w-full h-full"
      >
        <rect width="24" height="24" fill="#E8DFC9" />
        <polygon points="12,13 0,0 5,0" fill="#C97B1A" />
        <polygon points="12,13 10,0 14,0" fill="#C97B1A" />
        <polygon points="12,13 19,0 24,0" fill="#C97B1A" />
        <polygon points="12,13 24,5 24,10" fill="#C97B1A" />
        <polygon points="12,13 24,16 24,22" fill="#C97B1A" />
        <polygon points="12,13 18,24 12,24" fill="#C97B1A" />
        <polygon points="12,13 6,24 0,24" fill="#C97B1A" />
        <polygon points="12,13 0,18 0,12" fill="#C97B1A" />
      </svg>
    );
  }
  return null;
}

// Draw solid / newsprint halftone / flat bronze / brick / candles / sunburst background onto a region
function drawBackgroundFill(ctx, bgId, x, y, w, h, focalRect = null) {
  if (bgId === 'newsprint') {
    ctx.fillStyle = '#E8DFC9';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(34, 28, 22, 0.14)';
    const step = 18;
    const startX = x + 9;
    const startY = y + 9;
    for (let px = startX; px < x + w; px += step) {
      for (let py = startY; py < y + h; py += step) {
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  if (bgId === 'bronze') {
    ctx.fillStyle = '#C97B1A';
    ctx.fillRect(x, y, w, h);
    return;
  }

  if (bgId === 'brick') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.fillStyle = '#0E0D0C';
    ctx.fillRect(x, y, w, h);

    const mortar = Math.max(4, Math.round(w * 0.01));
    const cols = 4;
    const brickW = w / cols;
    const brickH = Math.round(brickW * 0.44);
    const rows = Math.ceil(h / brickH) + 1;

    for (let r = 0; r < rows; r++) {
      const stagger = r % 2 === 1 ? -brickW * 0.5 : 0;
      for (let c = -1; c <= cols + 1; c++) {
        const bx = x + c * brickW + stagger + mortar * 0.5;
        const by = y + r * brickH + mortar * 0.5;
        const bw = brickW - mortar;
        const bh = brickH - mortar;
        const shadeIdx = Math.abs(r * 7 + c * 3) % BRICK_SHADES.length;
        ctx.fillStyle = BRICK_SHADES[shadeIdx];
        ctx.fillRect(bx, by, bw, bh);
      }
    }

    ctx.restore();
    return;
  }

  if (bgId === 'candles') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.fillStyle = '#0E0D0C';
    ctx.fillRect(x, y, w, h);

    const n = CANDLE_SERIES.length;
    const slotW = w / n;
    const bodyW = Math.max(8, Math.round(slotW * 0.56));
    const wickW = Math.max(3, Math.round(slotW * 0.1));

    for (let i = 0; i < n; i++) {
      const candle = CANDLE_SERIES[i];
      const cx = x + (i + 0.5) * slotW;
      const isBullish = candle.c < candle.o;
      const color = isBullish ? '#2FD27A' : '#C23B22';

      const highY = y + candle.h * h;
      const lowY = y + candle.l * h;
      const openY = y + candle.o * h;
      const closeY = y + candle.c * h;
      const bodyTop = Math.min(openY, closeY);
      const bodyH = Math.max(6, Math.abs(closeY - openY));

      ctx.fillStyle = color;
      ctx.fillRect(cx - wickW / 2, highY, wickW, Math.max(2, lowY - highY));
      ctx.fillRect(cx - bodyW / 2, bodyTop, bodyW, bodyH);
    }

    ctx.restore();
    return;
  }

  if (bgId === 'sunburst') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.fillStyle = '#E8DFC9';
    ctx.fillRect(x, y, w, h);

    const cx = focalRect ? focalRect.x + focalRect.w * 0.514 : x + w * 0.5;
    const cy = focalRect ? focalRect.y + focalRect.h * 0.4 : y + h * 0.55;
    const radius = Math.hypot(w, h) * 1.25;
    const rayCount = 16;
    const stepAngle = (Math.PI * 2) / rayCount;
    const halfRay = stepAngle * 0.5;

    ctx.fillStyle = '#C97B1A';
    for (let i = 0; i < rayCount; i++) {
      const a0 = i * stepAngle - Math.PI / 2;
      const a1 = a0 + halfRay;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius);
      ctx.lineTo(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
    return;
  }

  ctx.fillStyle = '#0E0D0C';
  ctx.fillRect(x, y, w, h);
}

// Shared pure helpers for transparent face + worn props (used by preview, export, and sticker export)
function collectPropSpritesForList(sortedProps, activeLayout, activeFaceAnchors, rect) {
  if (!activeLayout || !activeFaceAnchors || !sortedProps || sortedProps.length === 0) {
    return [];
  }
  const all = [];
  for (const propItem of sortedProps) {
    const lp = activeLayout.props?.find((item) => item.id === propItem.id);
    if (!lp) continue;
    all.push(...resolvePropSprites(propItem, lp, activeFaceAnchors, rect));
  }
  return all;
}

function drawPropSpritesOnCtx(ctx, spritesList, rect, targetLayer) {
  for (const s of spritesList) {
    if (s.layer !== targetLayer) continue;
    const loaded = s.img || imageCache.get(s.src);
    if (!loaded) continue;

    const aspect = loaded.naturalWidth > 0 ? loaded.naturalHeight / loaded.naturalWidth : 1;
    const drawW = s.spriteW;
    const drawH = drawW * aspect;
    const natW = loaded.naturalWidth || Math.round(drawW);
    const natH = loaded.naturalHeight || Math.round(drawH);
    const left = -s.pivotX * drawW;
    const top = -s.pivotY * drawH;

    // Directional silhouette drop shadow under sprite
    if (s.shadow && s.shadow.alpha > 0) {
      const shadowScale = rect.w / WORN.shadowRefFaceWidth;
      const sil = getShadowSilhouette(loaded, s.src, drawW, drawH);
      const sw = sil.width;
      const sh = sil.height;

      ctx.save();
      ctx.globalAlpha = s.shadow.alpha;
      ctx.translate(s.px + s.shadow.dx * shadowScale, s.py + s.shadow.dy * shadowScale);
      if (s.rotDeg) {
        ctx.rotate((s.rotDeg * Math.PI) / 180);
      }
      if (s.flip) {
        ctx.scale(-1, 1);
      }
      if (s.clipBottomArc > 0) {
        applyBottomArcClip(ctx, left, top, drawW, drawH, s.clipBottomArc);
      }
      if (s.clipTop > 0) {
        const sy = Math.round(sh * s.clipTop);
        const sliceH = Math.max(1, sh - sy);
        const dyOffset = (sy / sh) * drawH;
        const dstH = (sliceH / sh) * drawH;
        ctx.drawImage(sil, 0, sy, sw, sliceH, left, top + dyOffset, drawW, dstH);
      } else {
        ctx.drawImage(sil, left, top, drawW, drawH);
      }
      ctx.restore();
    }

    // Actual prop sprite
    ctx.save();
    ctx.translate(s.px, s.py);
    if (s.rotDeg) {
      ctx.rotate((s.rotDeg * Math.PI) / 180);
    }
    if (s.flip) {
      ctx.scale(-1, 1);
    }
    if (s.clipBottomArc > 0) {
      applyBottomArcClip(ctx, left, top, drawW, drawH, s.clipBottomArc);
    }
    if (s.clipTop > 0) {
      const sy = Math.round(natH * s.clipTop);
      const sliceH = Math.max(1, natH - sy);
      const dyOffset = (sy / natH) * drawH;
      const dstH = (sliceH / natH) * drawH;
      ctx.drawImage(loaded, 0, sy, natW, sliceH, left, top + dyOffset, drawW, dstH);
    } else {
      ctx.drawImage(loaded, left, top, drawW, drawH);
    }
    ctx.restore();
  }
}

function drawTransparentFaceAndPropsOnCtx(
  ctx,
  rect,
  bullImg,
  bullFile,
  sortedProps,
  activeLayout,
  activeFaceAnchors
) {
  const sprites = collectPropSpritesForList(sortedProps, activeLayout, activeFaceAnchors, rect);
  const crownSprites = sprites.filter((s) => s.contactShadow);
  const hasMidProps = sprites.some((s) => s.layer === 'mid');

  // Face
  ctx.drawImage(bullImg, rect.x, rect.y, rect.w, rect.h);

  // Crown contact shadow masked strictly onto the face head pixels
  if (crownSprites.length > 0) {
    drawCrownContactShadowLayer(ctx, rect, bullImg, crownSprites);
  }

  // "mid" props (e.g. chain behind chin/neck)
  if (hasMidProps) {
    drawPropSpritesOnCtx(ctx, sprites, rect, 'mid');

    // Cached neck fur overlay so chain ends tuck behind chin & neck
    const neckOverlay = getNeckOverlayCanvas(`/assets/${bullFile}`, bullImg);
    if (neckOverlay) {
      ctx.drawImage(neckOverlay, rect.x, rect.y, rect.w, rect.h);
    }
  }

  // "front" props
  drawPropSpritesOnCtx(ctx, sprites, rect, 'front');
}

// Ensure fonts are ready before canvas painting
async function ensureFontsReady() {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('bold 60px "Anton"'),
        document.fonts.load('bold 48px "Playfair Display"'),
        document.fonts.load('24px "IBM Plex Mono"'),
      ]);
    } catch {
      // Fallback safe
    }
  }
}

function detectIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
  );
}

export const MemeDesk = () => {
  // Step 1: Bull (browraise default), Background, Props & Template selection
  const [selectedBull, setSelectedBull] = useState(MEME_DESK_COPY.bulls[0]);
  const [selectedBackground, setSelectedBackground] = useState('black');
  const [selectedTemplate, setSelectedTemplate] = useState('classic');
  const [placedProps, setPlacedProps] = useState([]);
  const [selectedPropUid, setSelectedPropUid] = useState(null);
  const [layoutData, setLayoutData] = useState(() => cachedLayout);

  // Step 2: Form Inputs
  const [topText, setTopText] = useState(UI_COPY.memeDesk.defaults.topText);
  const [bottomText, setBottomText] = useState(UI_COPY.memeDesk.defaults.bottomText);
  const [frontHeadline, setFrontHeadline] = useState(UI_COPY.memeDesk.defaults.frontHeadline);
  const [frontCaption, setFrontCaption] = useState(UI_COPY.memeDesk.defaults.frontCaption);
  const [speechText, setSpeechText] = useState(UI_COPY.memeDesk.defaults.speechText);
  const [selectedStamp, setSelectedStamp] = useState('NONE');
  const [stampScale, setStampScale] = useState(1);
  const [stampFrac, setStampFrac] = useState({ x: 0.5, y: 0.5 });
  const [isStampSelected, setIsStampSelected] = useState(false);
  const [isStampHovered, setIsStampHovered] = useState(false);
  const [stampFontReady, setStampFontReady] = useState(false);
  const [addWatermark, setAddWatermark] = useState(true);

  // Status & UI state
  const [statusMsg, setStatusMsg] = useState('');
  const [canShare, setCanShare] = useState(false);
  const [canCopy, setCanCopy] = useState(false);
  const [isIos, setIsIos] = useState(() => detectIosDevice());
  const [iosSaveSheet, setIosSaveSheet] = useState(null);
  const [activeTab, setActiveTab] = useState('pick'); // 'pick' | 'write' | 'send'
  const [isNearDesk, setIsNearDesk] = useState(false);
  const [spriteLoadTick, setSpriteLoadTick] = useState(0);

  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const propUidCounterRef = useRef(1);
  const renderTokenRef = useRef(0);
  const prebuiltExportRef = useRef(null);
  const prebuildTimerRef = useRef(null);
  const exportVersionRef = useRef(0);
  const exportDirtyRef = useRef(true);
  const selectedTemplateRef = useRef(selectedTemplate);
  const iosSaveCloseBtnRef = useRef(null);
  const pendingRevokeTimersRef = useRef(new Set());

  const sectionRef = useRef(null);
  const previewFrameRef = useRef(null);
  const tabsContainerRef = useRef(null);
  const hasTriggeredDeskRef = useRef(false);

  // Multi-pointer refs for selection box (1-finger drag + 2-finger pinch/turn)
  const selectionPointersRef = useRef(new Map());
  const singleDragRef = useRef(null);
  const pinchStartRef = useRef(null);
  const canvasTapRef = useRef(null);

  // Multi-pointer refs for stamp overlay (1-finger drag + 2-finger pinch)
  const stampPointersRef = useRef(new Map());
  const stampSingleDragRef = useRef(null);
  const stampPinchStartRef = useRef(null);

  // Latest props & stamp refs for gesture callbacks without stale closures
  const placedPropsRef = useRef(placedProps);
  useEffect(() => {
    placedPropsRef.current = placedProps;
  }, [placedProps]);

  const stampStateRef = useRef({ frac: stampFrac, scale: stampScale });
  useEffect(() => {
    stampStateRef.current = { frac: stampFrac, scale: stampScale };
  }, [stampFrac, stampScale]);

  useEffect(() => {
    ensureFontsReady().then(() => setStampFontReady(true));
  }, []);

  // Trigger lazy loading of layout.json when section approaches viewport or PICK tab is interacted
  useEffect(() => {
    if (!sectionRef.current || typeof IntersectionObserver === 'undefined') {
      setIsNearDesk(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setIsNearDesk(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px 0px' }
    );
    io.observe(sectionRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if ((activeTab === 'pick' && isNearDesk) || placedProps.length > 0) {
      if (!layoutData) {
        loadMemeLayoutOnce()
          .then((data) => setLayoutData(data))
          .catch(() => {});
      }
    }
  }, [activeTab, isNearDesk, layoutData, placedProps.length]);

  // "The desk is set" Entrance
  useEffect(() => {
    if (!sectionRef.current) return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) {
      if (previewFrameRef.current) {
        gsap.set(previewFrameRef.current, { y: 0, rotation: 0, opacity: 1 });
      }
      if (tabsContainerRef.current) {
        const els = tabsContainerRef.current.querySelectorAll('.desk-tab-item');
        gsap.set(els, { y: 0, opacity: 1 });
      }
      return;
    }

    if (previewFrameRef.current && !hasTriggeredDeskRef.current) {
      gsap.set(previewFrameRef.current, {
        y: DESK_ENTRANCE_OFFSET_Y,
        rotation: DESK_ENTRANCE_ROTATION,
        opacity: 0,
      });
    }
    if (tabsContainerRef.current && !hasTriggeredDeskRef.current) {
      const els = tabsContainerRef.current.querySelectorAll('.desk-tab-item');
      gsap.set(els, { y: DESK_TABS_RISE_Y, opacity: 0 });
    }

    const triggerDeskEntrance = () => {
      if (hasTriggeredDeskRef.current) return;
      hasTriggeredDeskRef.current = true;

      const tl = gsap.timeline();
      if (previewFrameRef.current) {
        tl.to(previewFrameRef.current, {
          y: 0,
          rotation: 0,
          opacity: 1,
          duration: DESK_ENTRANCE_DURATION,
          ease: 'back.out(1.5)',
        });
      }
      if (tabsContainerRef.current) {
        const tabElements = tabsContainerRef.current.querySelectorAll('.desk-tab-item');
        tl.to(
          tabElements,
          {
            y: 0,
            opacity: 1,
            duration: 0.35,
            stagger: DESK_TABS_STAGGER,
            ease: 'power2.out',
          },
          '-=0.05'
        );
      }
    };

    const fallbackTimer = window.setTimeout(() => {
      if (!hasTriggeredDeskRef.current) {
        hasTriggeredDeskRef.current = true;
        if (previewFrameRef.current) {
          gsap.set(previewFrameRef.current, { y: 0, rotation: 0, opacity: 1 });
        }
        if (tabsContainerRef.current) {
          const els = tabsContainerRef.current.querySelectorAll('.desk-tab-item');
          gsap.set(els, { y: 0, opacity: 1 });
        }
      }
    }, DESK_FALLBACK_MS);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio >= DESK_ENTRANCE_THRESHOLD || entry.isIntersecting) {
            triggerDeskEntrance();
            observer.disconnect();
          }
        });
      },
      { threshold: [DESK_ENTRANCE_THRESHOLD] }
    );

    observer.observe(sectionRef.current);
    return () => {
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, []);

  // Check Web Share, Clipboard API, and iOS capabilities
  useEffect(() => {
    setIsIos(detectIosDevice());
    if (typeof navigator !== 'undefined') {
      setCanCopy(Boolean(navigator.clipboard && window.ClipboardItem));
      if (navigator.canShare) {
        try {
          const testFile = new File([''], 'test.png', { type: 'image/png' });
          setCanShare(navigator.canShare({ files: [testFile] }));
        } catch {
          setCanShare(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    selectedTemplateRef.current = selectedTemplate;
  }, [selectedTemplate]);

  useEffect(() => {
    return () => {
      exportVersionRef.current += 1;
      if (prebuildTimerRef.current !== null) {
        window.clearTimeout(prebuildTimerRef.current);
        prebuildTimerRef.current = null;
      }
      pendingRevokeTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      pendingRevokeTimersRef.current.clear();
    };
  }, []);

  const schedulePrebuildExport = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (prebuildTimerRef.current !== null) {
      window.clearTimeout(prebuildTimerRef.current);
    }
    const version = ++exportVersionRef.current;
    prebuildTimerRef.current = window.setTimeout(() => {
      prebuildTimerRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas || version !== exportVersionRef.current) return;
      try {
        canvas.toBlob((blob) => {
          if (!blob || version !== exportVersionRef.current) return;
          const tpl = selectedTemplateRef.current;
          const filename = `bull-on-canton-${tpl}-${Date.now()}.png`;
          const file = new File([blob], filename, { type: 'image/png' });
          prebuiltExportRef.current = {
            blob,
            file,
            filename,
            template: tpl,
          };
          exportDirtyRef.current = false;
        }, 'image/png');
      } catch {
        // Ignore if canvas cannot export
      }
    }, 300);
  }, []);

  // Available props from layout.json excluding pfpOnly (horns)
  const trayProps = useMemo(() => {
    if (!layoutData || !Array.isArray(layoutData.props)) return [];
    return layoutData.props.filter((p) => !p.pfpOnly);
  }, [layoutData]);

  const propsById = useMemo(() => {
    const map = new Map();
    for (const p of trayProps) {
      map.set(p.id, p);
    }
    return map;
  }, [trayProps]);

  const faceAnchors = useMemo(() => {
    if (!layoutData || !Array.isArray(layoutData.faces)) return null;
    const found = layoutData.faces.find((f) => f.id === selectedBull.id);
    return found?.anchors || null;
  }, [layoutData, selectedBull.id]);

  // Sorted placed props in draw order (ascending z)
  const sortedPlacedProps = useMemo(() => {
    return [...placedProps].sort((a, b) => a.z - b.z);
  }, [placedProps]);

  const selectedProp = useMemo(() => {
    if (!selectedPropUid || selectedBull.legacy) return null;
    return placedProps.find((p) => p.uid === selectedPropUid) || null;
  }, [placedProps, selectedPropUid, selectedBull.legacy]);

  // Selected prop's DOM overlay box in canvas percentages
  const selectionBox = useMemo(() => {
    if (!selectedProp || !faceAnchors || selectedBull.legacy) return null;
    const layoutProp = propsById.get(selectedProp.id);
    if (!layoutProp) return null;
    const rect = faceRect(selectedTemplate);
    const resolved = resolvePropSprites(selectedProp, layoutProp, faceAnchors, rect);
    const box = computePropSelectionBox(selectedProp, resolved);
    if (!box) return null;
    const canvasW = 1080;
    const canvasH = selectedTemplate === 'frontpage' ? 1350 : 1080;
    return {
      ...box,
      leftPct: (box.centerX / canvasW) * 100,
      topPct: (box.centerY / canvasH) * 100,
      widthPct: (box.width / canvasW) * 100,
      heightPct: (box.height / canvasH) * 100,
    };
  }, [selectedProp, faceAnchors, selectedBull.legacy, propsById, selectedTemplate, spriteLoadTick]);

  // Single source of truth for stamp geometry in canvas pixels
  const getStampGeometry = useCallback(
    (template) => {
      if (selectedStamp === 'NONE') return null;
      const canvasW = 1080;
      const canvasH = template === 'frontpage' ? 1350 : 1080;
      const textW = measureStampTextWidth(selectedStamp);
      const baseW = textW + STAMP_PADDING_X * 2 + STAMP_BORDER_W;
      const baseH = STAMP_INNER_H + STAMP_BORDER_W;
      return {
        cx: clampNum(stampFrac.x, 0, 1) * canvasW,
        cy: clampNum(stampFrac.y, 0, 1) * canvasH,
        w: baseW * stampScale,
        h: baseH * stampScale,
        rotDeg: STAMP_ROT_DEG,
      };
    },
    [selectedStamp, stampFrac, stampScale, stampFontReady]
  );

  const stampGeom = useMemo(() => {
    return getStampGeometry(selectedTemplate);
  }, [getStampGeometry, selectedTemplate]);

  // Keyboard support: Arrow keys nudge selected prop, Delete removes it
  useEffect(() => {
    if (!selectedPropUid || selectedBull.legacy) return;

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

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setPlacedProps((prev) => prev.filter((p) => p.uid !== selectedPropUid));
        setSelectedPropUid(null);
        return;
      }

      const step = e.shiftKey ? 2 : 0.6;
      let ddx = 0;
      let ddy = 0;
      if (e.key === 'ArrowLeft') ddx = -step;
      else if (e.key === 'ArrowRight') ddx = step;
      else if (e.key === 'ArrowUp') ddy = -step;
      else if (e.key === 'ArrowDown') ddy = step;
      else return;

      e.preventDefault();
      setPlacedProps((prev) =>
        prev.map((p) =>
          p.uid === selectedPropUid
            ? {
                ...p,
                dx: clampNum(Number((p.dx + ddx).toFixed(2)), -120, 120),
                dy: clampNum(Number((p.dy + ddy).toFixed(2)), -120, 120),
              }
            : p
        )
      );
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPropUid, selectedBull.legacy]);

  // Text wrap and auto-shrink helper
  const drawWrappedText = (
    ctx,
    text,
    x,
    y,
    maxWidth,
    initialFontSize,
    fontFamily,
    stroke,
    fill,
    strokeWidth = 8
  ) => {
    let fontSize = initialFontSize;
    let lines = [];

    while (fontSize >= 20) {
      ctx.font = `bold ${fontSize}px ${fontFamily}`;
      const words = text.split(' ');
      lines = [];
      let currentLine = words[0] || '';

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine + ' ' + word;
        const testWidth = ctx.measureText(testLine).width;
        if (testWidth < maxWidth) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);

      const allFit = lines.every((l) => ctx.measureText(l).width <= maxWidth);
      if (allFit && lines.length <= 4) break;
      fontSize -= 4;
    }

    const lineHeight = fontSize * 1.15;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fill;
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth * (fontSize / initialFontSize);
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 2;
    }

    lines.forEach((line, idx) => {
      const lineY = startY + idx * lineHeight;
      if (stroke) {
        ctx.strokeText(line, x, lineY);
      }
      ctx.fillText(line, x, lineY);
    });
  };

  // Main Canvas Render Routine
  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const token = ++renderTokenRef.current;

    await ensureFontsReady();
    if (token !== renderTokenRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isFrontPage = selectedTemplate === 'frontpage';
    const width = 1080;
    const height = isFrontPage ? 1350 : 1080;

    // Load selected bull image
    let bullImg;
    try {
      bullImg = await loadMemeImage(`/assets/${selectedBull.file}`);
    } catch {
      bullImg = await loadMemeImage('/assets/bull-hero-final.webp');
    }
    if (token !== renderTokenRef.current) return;

    const isLegacy = Boolean(selectedBull.legacy);

    // Preload any needed prop images for transparent faces
    const activeLayout = !isLegacy
      ? layoutData || (placedProps.length > 0 ? await loadMemeLayoutOnce().catch(() => null) : null)
      : null;
    if (token !== renderTokenRef.current) return;

    const activeFaceAnchors =
      activeLayout?.faces?.find((f) => f.id === selectedBull.id)?.anchors || null;

    if (!isLegacy && activeLayout && placedProps.length > 0) {
      const spriteUrls = [];
      for (const p of placedProps) {
        const lp = activeLayout.props?.find((item) => item.id === p.id);
        if (!lp) continue;
        for (const sp of lp.sprites || []) {
          spriteUrls.push(`/assets/meme/${sp.file}`);
        }
        for (const ex of lp.extras || []) {
          const isOn =
            p.extras && typeof p.extras[ex.id] === 'boolean'
              ? p.extras[ex.id]
              : Boolean(ex.defaultOn);
          if (isOn) {
            spriteUrls.push(`/assets/meme/${ex.file}`);
          }
        }
      }
      const uncachedUrls = spriteUrls.filter((u) => !imageCache.has(u));
      if (uncachedUrls.length > 0) {
        await Promise.all(uncachedUrls.map((u) => loadMemeImage(u).catch(() => null)));
        if (token !== renderTokenRef.current) return;
        setSpriteLoadTick((t) => t + 1);
      }
    }

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Helper: draw stamp using shared getStampGeometry
    const drawStampLayer = () => {
      const geom = getStampGeometry(selectedTemplate);
      if (!geom) return;
      const rectW = geom.w / stampScale - STAMP_BORDER_W;
      const rectH = geom.h / stampScale - STAMP_BORDER_W;

      ctx.save();
      ctx.translate(geom.cx, geom.cy);
      ctx.rotate((geom.rotDeg * Math.PI) / 180);
      ctx.scale(stampScale, stampScale);

      ctx.font = STAMP_FONT;
      ctx.strokeStyle = '#C23B22';
      ctx.lineWidth = STAMP_BORDER_W;
      ctx.fillStyle = 'rgba(14, 13, 12, 0.85)';
      ctx.fillRect(-rectW / 2, -rectH / 2, rectW, rectH);
      ctx.strokeRect(-rectW / 2, -rectH / 2, rectW, rectH);

      ctx.lineWidth = STAMP_INNER_BORDER_W;
      ctx.strokeRect(-rectW / 2 + 5, -rectH / 2 + 5, rectW - 10, rectH - 10);

      ctx.fillStyle = '#C23B22';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(selectedStamp, 0, 0);

      ctx.restore();
    };

    const drawTransparentFaceAndProps = (rect) => {
      drawTransparentFaceAndPropsOnCtx(
        ctx,
        rect,
        bullImg,
        selectedBull.file,
        sortedPlacedProps,
        activeLayout,
        activeFaceAnchors
      );
    };

    ctx.clearRect(0, 0, width, height);

    // =========================================================================
    // TEMPLATE A: CLASSIC (1080x1080)
    // =========================================================================
    if (selectedTemplate === 'classic') {
      if (isLegacy) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        const imgSize = 980;
        ctx.drawImage(bullImg, (width - imgSize) / 2, (height - imgSize) / 2, imgSize, imgSize);
        drawStampLayer();
      } else {
        const rect = faceRect('classic');
        drawBackgroundFill(ctx, selectedBackground, 0, 0, width, height, rect);
        drawTransparentFaceAndProps(rect);
        drawStampLayer();
      }

      if (topText.trim()) {
        drawWrappedText(
          ctx,
          topText.toUpperCase(),
          width / 2,
          95,
          width - 80,
          72,
          'Anton, sans-serif',
          '#000000',
          '#FFFFFF',
          12
        );
      }

      if (bottomText.trim()) {
        drawWrappedText(
          ctx,
          bottomText.toUpperCase(),
          width / 2,
          height - 105,
          width - 80,
          72,
          'Anton, sans-serif',
          '#000000',
          '#FFFFFF',
          12
        );
      }
    }

    // =========================================================================
    // TEMPLATE B: FRONT PAGE (1080x1350)
    // =========================================================================
    else if (selectedTemplate === 'frontpage') {
      // Newsprint page background
      ctx.fillStyle = '#E8DFC9';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = 'rgba(14, 13, 12, 0.08)';
      for (let x = 12; x < width; x += 24) {
        for (let y = 12; y < height; y += 24) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.fillStyle = '#0E0D0C';
      ctx.fillRect(50, 40, width - 100, 3);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#0E0D0C';
      ctx.font = 'bold 96px Anton, sans-serif';
      ctx.fillText(CHARGE_COPY.beat1.masthead, width / 2, 52);

      ctx.fillRect(50, 168, width - 100, 2);
      ctx.font = '600 18px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(UI_COPY.memeDesk.frontPageVol, 54, 178);
      ctx.textAlign = 'right';
      const todayStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      ctx.fillText(`${todayStr.toUpperCase()} • ${UI_COPY.charge.paperPrice}`, width - 54, 178);
      ctx.fillRect(50, 206, width - 100, 3);

      const { x: frameX, y: frameY, w: frameW, h: frameH } = FRONTPAGE_BOX;

      // Photo frame outer border
      ctx.fillStyle = '#0E0D0C';
      ctx.fillRect(frameX - 8, frameY - 8, frameW + 16, frameH + 16);

      if (isLegacy) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(frameX, frameY, frameW, frameH);
        ctx.drawImage(bullImg, frameX, frameY, frameW, frameH);
      } else {
        const rect = faceRect('frontpage');
        ctx.save();
        ctx.beginPath();
        ctx.rect(frameX, frameY, frameW, frameH);
        ctx.clip();

        drawBackgroundFill(ctx, selectedBackground, frameX, frameY, frameW, frameH, rect);
        drawTransparentFaceAndProps(rect);

        ctx.restore();
      }

      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 2;
      ctx.strokeRect(frameX, frameY, frameW, frameH);

      drawStampLayer();

      const headlineY = 275;
      drawWrappedText(
        ctx,
        frontHeadline.toUpperCase(),
        width / 2,
        headlineY,
        width - 120,
        56,
        '"Playfair Display", serif',
        null,
        '#0E0D0C',
        0
      );

      if (frontCaption.trim()) {
        ctx.fillStyle = '#0E0D0C';
        ctx.font = 'italic 20px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(
          `${UI_COPY.memeDesk.frontPageCaptionPrefix} ${frontCaption}`,
          width / 2,
          frameY + frameH + 18
        );
      }
    }

    // =========================================================================
    // TEMPLATE C: SPEECH BUBBLE (1080x1080)
    // =========================================================================
    else if (selectedTemplate === 'speech') {
      if (isLegacy) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        const imgSize = 880;
        ctx.drawImage(bullImg, (width - imgSize) / 2, height - imgSize + 60, imgSize, imgSize);
        drawStampLayer();
      } else {
        const rect = faceRect('speech');
        drawBackgroundFill(ctx, selectedBackground, 0, 0, width, height, rect);
        drawTransparentFaceAndProps(rect);
        drawStampLayer();
      }

      // Keep bubble in top area; move up for transparent faces so it stays above the face
      const bubbleX = 100;
      const bubbleH = isLegacy ? 220 : 196;
      const bubbleY = isLegacy ? 80 : 42;
      const bubbleW = width - 200;
      const radius = 24;
      const tailDepth = isLegacy ? 75 : 62;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(bubbleX + radius, bubbleY);
      ctx.lineTo(bubbleX + bubbleW - radius, bubbleY);
      ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY, bubbleX + bubbleW, bubbleY + radius);
      ctx.lineTo(bubbleX + bubbleW, bubbleY + bubbleH - radius);
      ctx.quadraticCurveTo(
        bubbleX + bubbleW,
        bubbleY + bubbleH,
        bubbleX + bubbleW - radius,
        bubbleY + bubbleH
      );

      ctx.lineTo(bubbleX + bubbleW * 0.45 + 50, bubbleY + bubbleH);
      ctx.lineTo(bubbleX + bubbleW * 0.45 - 20, bubbleY + bubbleH + tailDepth);
      ctx.lineTo(bubbleX + bubbleW * 0.45, bubbleY + bubbleH);

      ctx.lineTo(bubbleX + radius, bubbleY + bubbleH);
      ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleH, bubbleX, bubbleY + bubbleH - radius);
      ctx.lineTo(bubbleX, bubbleY + radius);
      ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
      ctx.closePath();

      ctx.shadowColor = !isLegacy && selectedBackground === 'bronze' ? '#0E0D0C' : '#C97B1A';
      ctx.shadowOffsetX = 8;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#FFFDF7';
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#0E0D0C';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.restore();

      if (speechText.trim()) {
        drawWrappedText(
          ctx,
          speechText,
          width / 2,
          bubbleY + bubbleH / 2,
          bubbleW - 60,
          44,
          '"IBM Plex Mono", monospace',
          null,
          '#0E0D0C',
          0
        );
      }
    }

    // =========================================================================
    // WATERMARK TAG (Last layer)
    // =========================================================================
    if (addWatermark) {
      ctx.save();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.font = '600 20px "IBM Plex Mono", monospace';

      const tagText = TITLE;
      const tagW = ctx.measureText(tagText).width + 36;
      const tagH = 36;
      const tagX = width - 40;
      const tagY = height - 40;

      ctx.fillStyle = 'rgba(14, 13, 12, 0.88)';
      ctx.fillRect(tagX - tagW, tagY - tagH, tagW, tagH);
      ctx.strokeStyle = '#C97B1A';
      ctx.lineWidth = 2;
      ctx.strokeRect(tagX - tagW, tagY - tagH, tagW, tagH);

      ctx.fillStyle = '#C97B1A';
      ctx.fillRect(tagX - tagW + 10, tagY - tagH + 10, 14, 14);

      ctx.fillStyle = '#E8DFC9';
      ctx.fillText(tagText, tagX - 10, tagY - 9);
      ctx.restore();
    }

    schedulePrebuildExport();
  }, [
    selectedBull,
    selectedBackground,
    selectedTemplate,
    layoutData,
    placedProps,
    sortedPlacedProps,
    topText,
    bottomText,
    frontHeadline,
    frontCaption,
    speechText,
    selectedStamp,
    stampScale,
    getStampGeometry,
    addWatermark,
    schedulePrebuildExport,
  ]);

  // Debounced render trigger
  useEffect(() => {
    exportDirtyRef.current = true;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      renderCanvas();
    });
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [renderCanvas]);

  // Helper: convert clientX/Y to canvas pixel coordinates
  const clientToCanvas = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return { x: 0, y: 0 };
    return {
      x: ((clientX - box.left) / box.width) * canvas.width,
      y: ((clientY - box.top) / box.height) * canvas.height,
    };
  }, []);

  // Toggle prop in PICK tab (add on first tap + select; remove if already present)
  const handlePropChipClick = useCallback(
    async (propDef) => {
      if (selectedBull.legacy) return;

      const existing = placedPropsRef.current.find((p) => p.id === propDef.id);
      if (existing) {
        setPlacedProps((prev) => prev.filter((p) => p.id !== propDef.id));
        if (selectedPropUid === existing.uid) {
          setSelectedPropUid(null);
        }
        return;
      }

      if (placedPropsRef.current.length >= MAX_PROPS) {
        setStatusMsg(MEME_DESK_COPY.propControls.maxProps);
        return;
      }

      const layoutIdx = layoutData?.props
        ? Math.max(0, layoutData.props.findIndex((p) => p.id === propDef.id))
        : placedPropsRef.current.length;

      const uid = `prop-${propUidCounterRef.current++}`;
      const defaultExtras = {};
      for (const ex of propDef.extras || []) {
        defaultExtras[ex.id] = Boolean(ex.defaultOn);
      }

      const newProp = {
        uid,
        id: propDef.id,
        dx: 0,
        dy: 0,
        scale: 1,
        rot: 0,
        flip: false,
        z: layoutIdx,
        extras: defaultExtras,
      };

      setPlacedProps((prev) => [...prev, newProp]);
      setSelectedPropUid(uid);
      setIsStampSelected(false);
      if (statusMsg === MEME_DESK_COPY.propControls.maxProps) {
        setStatusMsg('');
      }
    },
    [selectedBull.legacy, layoutData, selectedPropUid, statusMsg]
  );

  // Canvas tap / click hit-test to select a placed prop or deselect prop & stamp
  const handleCanvasPointerDown = (e) => {
    if (isDesktopViewport() && e.pointerType === 'mouse' && e.button !== 0) return;
    canvasTapRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
    };
  };

  const handleCanvasPointerUp = (e) => {
    if (!canvasTapRef.current) return;
    const start = canvasTapRef.current;
    canvasTapRef.current = null;
    if (start.id !== e.pointerId) return;

    const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (dist > 8) return;

    if (!selectedBull.legacy && faceAnchors && sortedPlacedProps.length > 0) {
      const pt = clientToCanvas(e.clientX, e.clientY);
      const outsideFrontpageBox =
        selectedTemplate === 'frontpage' &&
        (pt.x < FRONTPAGE_BOX.x ||
          pt.x > FRONTPAGE_BOX.x + FRONTPAGE_BOX.w ||
          pt.y < FRONTPAGE_BOX.y ||
          pt.y > FRONTPAGE_BOX.y + FRONTPAGE_BOX.h);

      if (!outsideFrontpageBox) {
        const rect = faceRect(selectedTemplate);
        // Test topmost drawn props first
        for (let i = sortedPlacedProps.length - 1; i >= 0; i--) {
          const p = sortedPlacedProps[i];
          const lp = propsById.get(p.id);
          if (!lp) continue;
          const sprites = resolvePropSprites(p, lp, faceAnchors, rect);
          if (hitTestSprites(pt.x, pt.y, sprites, 24)) {
            setSelectedPropUid(p.uid);
            setIsStampSelected(false);
            return;
          }
        }
      }
    }

    setSelectedPropUid(null);
    setIsStampSelected(false);
  };

  // DOM Selection Box: 1-pointer drag, 2-pointer pinch to scale & turn (touch-action: none here ONLY)
  const snapshotSingleDrag = useCallback((clientX, clientY, prop) => {
    const pt = clientToCanvas(clientX, clientY);
    singleDragRef.current = {
      startCanvasX: pt.x,
      startCanvasY: pt.y,
      dx0: prop.dx,
      dy0: prop.dy,
    };
  }, [clientToCanvas]);

  const snapshotPinch = useCallback((pts, prop) => {
    if (pts.length < 2) return;
    const [p1, p2] = pts;
    const midClientX = (p1.clientX + p2.clientX) / 2;
    const midClientY = (p1.clientY + p2.clientY) / 2;
    const midCanvas = clientToCanvas(midClientX, midClientY);
    const dist0 = Math.max(12, Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY));
    const angle0 = (Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX) * 180) / Math.PI;
    pinchStartRef.current = {
      dist0,
      angle0,
      midCanvasX0: midCanvas.x,
      midCanvasY0: midCanvas.y,
      dx0: prop.dx,
      dy0: prop.dy,
      scale0: prop.scale,
      rot0: prop.rot,
    };
  }, [clientToCanvas]);

  const handlePropBoxPointerDown = (e) => {
    if (isDesktopViewport() && e.pointerType === 'mouse' && e.button !== 0) return;
    if (!selectedProp) return;
    e.stopPropagation();
    setIsStampSelected(false);
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const map = selectionPointersRef.current;
    map.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    if (map.size === 1) {
      pinchStartRef.current = null;
      snapshotSingleDrag(e.clientX, e.clientY, selectedProp);
    } else if (map.size >= 2) {
      singleDragRef.current = null;
      snapshotPinch(Array.from(map.values()), selectedProp);
    }
  };

  const handlePropBoxPointerMove = (e) => {
    const map = selectionPointersRef.current;
    if (!map.has(e.pointerId) || !selectedPropUid) return;
    map.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    const rect = faceRect(selectedTemplate);

    if (map.size >= 2 && pinchStartRef.current) {
      const pts = Array.from(map.values());
      const [p1, p2] = pts;
      const start = pinchStartRef.current;

      const curDist = Math.max(12, Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY));
      const curAngle =
        (Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX) * 180) / Math.PI;
      const dAngle = normalizeAngleDeltaDeg(curAngle, start.angle0);

      const midCanvas = clientToCanvas(
        (p1.clientX + p2.clientX) / 2,
        (p1.clientY + p2.clientY) / 2
      );
      const nextDx = clampNum(
        start.dx0 + ((midCanvas.x - start.midCanvasX0) / rect.w) * 100,
        -120,
        120
      );
      const nextDy = clampNum(
        start.dy0 + ((midCanvas.y - start.midCanvasY0) / rect.h) * 100,
        -120,
        120
      );
      const nextScale = clampNum(
        Number((start.scale0 * (curDist / start.dist0)).toFixed(2)),
        0.5,
        2.0
      );
      const nextRot = clampNum(Math.round(start.rot0 + dAngle), -45, 45);

      setPlacedProps((prev) =>
        prev.map((p) =>
          p.uid === selectedPropUid
            ? { ...p, dx: nextDx, dy: nextDy, scale: nextScale, rot: nextRot }
            : p
        )
      );
      return;
    }

    if (map.size === 1 && singleDragRef.current) {
      const start = singleDragRef.current;
      const curCanvas = clientToCanvas(e.clientX, e.clientY);
      const nextDx = clampNum(
        Number((start.dx0 + ((curCanvas.x - start.startCanvasX) / rect.w) * 100).toFixed(2)),
        -120,
        120
      );
      const nextDy = clampNum(
        Number((start.dy0 + ((curCanvas.y - start.startCanvasY) / rect.h) * 100).toFixed(2)),
        -120,
        120
      );

      setPlacedProps((prev) =>
        prev.map((p) =>
          p.uid === selectedPropUid ? { ...p, dx: nextDx, dy: nextDy } : p
        )
      );
    }
  };

  const handlePropBoxPointerUp = (e) => {
    const map = selectionPointersRef.current;
    if (!map.has(e.pointerId)) return;
    map.delete(e.pointerId);
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    if (map.size === 1 && selectedPropUid) {
      const remaining = Array.from(map.values())[0];
      const latestProp = placedPropsRef.current.find((p) => p.uid === selectedPropUid);
      if (remaining && latestProp) {
        pinchStartRef.current = null;
        snapshotSingleDrag(remaining.clientX, remaining.clientY, latestProp);
      }
    } else if (map.size === 0) {
      singleDragRef.current = null;
      pinchStartRef.current = null;
    }
  };

  // Selected prop control handlers
  const updateSelectedProp = useCallback(
    (updater) => {
      if (!selectedPropUid) return;
      setPlacedProps((prev) =>
        prev.map((p) => (p.uid === selectedPropUid ? updater(p) : p))
      );
    },
    [selectedPropUid]
  );

  const handleBringToFront = useCallback(() => {
    if (!selectedPropUid) return;
    setPlacedProps((prev) => {
      const maxZ = prev.reduce((acc, item) => Math.max(acc, item.z), layoutData?.props?.length || 8);
      return prev.map((p) => (p.uid === selectedPropUid ? { ...p, z: maxZ + 1 } : p));
    });
  }, [selectedPropUid, layoutData]);

  const handleRemoveSelectedProp = useCallback(() => {
    if (!selectedPropUid) return;
    setPlacedProps((prev) => prev.filter((p) => p.uid !== selectedPropUid));
    setSelectedPropUid(null);
  }, [selectedPropUid]);

  const handleResetProps = useCallback(() => {
    setPlacedProps([]);
    setSelectedPropUid(null);
    setStatusMsg('');
  }, []);

  // Give Me a Line button handler
  const handleRandomLine = (fieldSetter) => {
    const lines = MEME_DESK_COPY.starterLines;
    const random = lines[Math.floor(Math.random() * lines.length)];
    fieldSetter(random);
  };

  // Shuffle PICK state: random transparent face, random background, random line, 0..2 random props
  const handleShuffle = useCallback(async () => {
    const transparentBulls = MEME_DESK_COPY.bulls.filter((b) => !b.legacy);
    const facePool =
      transparentBulls.length > 1
        ? transparentBulls.filter((b) => b.id !== selectedBull.id)
        : transparentBulls;
    const nextBull = facePool[Math.floor(Math.random() * facePool.length)] || selectedBull;

    const bgPool =
      MEME_DESK_COPY.backgrounds.length > 1
        ? MEME_DESK_COPY.backgrounds.filter((bg) => bg.id !== selectedBackground)
        : MEME_DESK_COPY.backgrounds;
    const nextBg = bgPool[Math.floor(Math.random() * bgPool.length)] || MEME_DESK_COPY.backgrounds[0];

    const currentLine =
      selectedTemplate === 'frontpage'
        ? frontHeadline
        : selectedTemplate === 'speech'
          ? speechText
          : topText;
    const linePool =
      MEME_DESK_COPY.starterLines.length > 1
        ? MEME_DESK_COPY.starterLines.filter((l) => l !== currentLine)
        : MEME_DESK_COPY.starterLines;
    const nextLine = linePool[Math.floor(Math.random() * linePool.length)] || currentLine;

    let activeLayout = layoutData;
    if (!activeLayout) {
      try {
        activeLayout = await loadMemeLayoutOnce();
        setLayoutData(activeLayout);
      } catch {
        activeLayout = null;
      }
    }

    const availableProps = (activeLayout?.props || []).filter((p) => !p.pfpOnly);
    const propCount = Math.floor(Math.random() * 3); // 0, 1, or 2
    const shuffled = [...availableProps];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const chosen = shuffled.slice(0, propCount);
    const nextProps = chosen.map((propDef) => {
      const layoutIdx = activeLayout?.props
        ? Math.max(0, activeLayout.props.findIndex((p) => p.id === propDef.id))
        : 0;
      const defaultExtras = {};
      for (const ex of propDef.extras || []) {
        defaultExtras[ex.id] = Boolean(ex.defaultOn);
      }
      return {
        uid: `prop-${propUidCounterRef.current++}`,
        id: propDef.id,
        dx: 0,
        dy: 0,
        scale: 1,
        rot: 0,
        flip: false,
        z: layoutIdx,
        extras: defaultExtras,
      };
    });

    setSelectedBull(nextBull);
    setSelectedBackground(nextBg.id);
    if (selectedTemplate === 'frontpage') {
      setFrontHeadline(nextLine);
    } else if (selectedTemplate === 'speech') {
      setSpeechText(nextLine);
    } else {
      setTopText(nextLine);
      setBottomText('');
    }
    setPlacedProps(nextProps);
    setSelectedPropUid(null);
    setIsStampSelected(false);
    setStatusMsg('');
  }, [
    selectedBull,
    selectedBackground,
    selectedTemplate,
    frontHeadline,
    speechText,
    topText,
    layoutData,
  ]);

  // Draggable & pinchable stamp overlay (1-pointer drag, 2-pointer pinch scale; touchAction: 'none' here ONLY)
  const snapshotStampSingleDrag = useCallback(
    (clientX, clientY, frac) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pt = clientToCanvas(clientX, clientY);
      stampSingleDragRef.current = {
        startCanvasX: pt.x,
        startCanvasY: pt.y,
        cx0: frac.x * canvas.width,
        cy0: frac.y * canvas.height,
      };
    },
    [clientToCanvas]
  );

  const snapshotStampPinch = useCallback(
    (pts, state) => {
      const canvas = canvasRef.current;
      if (!canvas || pts.length < 2) return;
      const [p1, p2] = pts;
      const midCanvas = clientToCanvas(
        (p1.clientX + p2.clientX) / 2,
        (p1.clientY + p2.clientY) / 2
      );
      const dist0 = Math.max(12, Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY));
      stampPinchStartRef.current = {
        dist0,
        midCanvasX0: midCanvas.x,
        midCanvasY0: midCanvas.y,
        cx0: state.frac.x * canvas.width,
        cy0: state.frac.y * canvas.height,
        scale0: state.scale,
      };
    },
    [clientToCanvas]
  );

  const handleStampPointerDown = (e) => {
    if (isDesktopViewport() && e.pointerType === 'mouse' && e.button !== 0) return;
    if (selectedStamp === 'NONE') return;
    e.stopPropagation();
    setIsStampSelected(true);
    setSelectedPropUid(null);
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const map = stampPointersRef.current;
    map.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    if (map.size === 1) {
      stampPinchStartRef.current = null;
      snapshotStampSingleDrag(e.clientX, e.clientY, stampStateRef.current.frac);
    } else if (map.size >= 2) {
      stampSingleDragRef.current = null;
      snapshotStampPinch(Array.from(map.values()), stampStateRef.current);
    }
  };

  const handleStampPointerMove = (e) => {
    const map = stampPointersRef.current;
    const canvas = canvasRef.current;
    if (!map.has(e.pointerId) || !canvas || selectedStamp === 'NONE') return;
    map.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    if (map.size >= 2 && stampPinchStartRef.current) {
      const pts = Array.from(map.values());
      const [p1, p2] = pts;
      const start = stampPinchStartRef.current;
      const curDist = Math.max(12, Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY));
      const midCanvas = clientToCanvas(
        (p1.clientX + p2.clientX) / 2,
        (p1.clientY + p2.clientY) / 2
      );

      const nextScale = clampNum(
        Number((start.scale0 * (curDist / start.dist0)).toFixed(2)),
        0.6,
        1.6
      );
      const nextFracX = clampNum(
        (start.cx0 + (midCanvas.x - start.midCanvasX0)) / canvas.width,
        0,
        1
      );
      const nextFracY = clampNum(
        (start.cy0 + (midCanvas.y - start.midCanvasY0)) / canvas.height,
        0,
        1
      );

      setStampScale(nextScale);
      setStampFrac({ x: nextFracX, y: nextFracY });
      return;
    }

    if (map.size === 1 && stampSingleDragRef.current) {
      const start = stampSingleDragRef.current;
      const curCanvas = clientToCanvas(e.clientX, e.clientY);
      const nextFracX = clampNum(
        (start.cx0 + (curCanvas.x - start.startCanvasX)) / canvas.width,
        0,
        1
      );
      const nextFracY = clampNum(
        (start.cy0 + (curCanvas.y - start.startCanvasY)) / canvas.height,
        0,
        1
      );
      setStampFrac({ x: nextFracX, y: nextFracY });
    }
  };

  const handleStampPointerUp = (e) => {
    const map = stampPointersRef.current;
    if (!map.has(e.pointerId)) return;
    map.delete(e.pointerId);
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    if (map.size === 1) {
      const remaining = Array.from(map.values())[0];
      if (remaining) {
        stampPinchStartRef.current = null;
        snapshotStampSingleDrag(
          remaining.clientX,
          remaining.clientY,
          stampStateRef.current.frac
        );
      }
    } else if (map.size === 0) {
      stampSingleDragRef.current = null;
      stampPinchStartRef.current = null;
    }
  };

  // Shared anchor download helper: appends to document.body, builds/uses Blob URL, revokes after 60s
  const triggerAnchorDownload = useCallback((blob, filename, successStatus) => {
    if (!blob) {
      setStatusMsg(MEME_DESK_COPY.status.error);
      return;
    }
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    const revokeTimer = window.setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      pendingRevokeTimersRef.current.delete(revokeTimer);
    }, 60000);
    pendingRevokeTimersRef.current.add(revokeTimer);
    setStatusMsg(successStatus);
  }, []);

  const closeIosSaveSheet = useCallback(() => {
    setIosSaveSheet((prev) => {
      if (prev?.blobUrl) {
        const urlToRevoke = prev.blobUrl;
        window.setTimeout(() => URL.revokeObjectURL(urlToRevoke), 500);
      }
      return null;
    });
  }, []);

  const openIosSaveSheet = useCallback((blob) => {
    if (!blob) {
      setStatusMsg(MEME_DESK_COPY.status.error);
      return;
    }
    const blobUrl = URL.createObjectURL(blob);
    setIosSaveSheet((prev) => {
      if (prev?.blobUrl) {
        const prevUrl = prev.blobUrl;
        window.setTimeout(() => URL.revokeObjectURL(prevUrl), 500);
      }
      return { blobUrl };
    });
  }, []);

  useEffect(() => {
    if (!iosSaveSheet) return;
    const focusTimer = window.setTimeout(() => {
      iosSaveCloseBtnRef.current?.focus({ preventScroll: true });
    }, 20);
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeIosSaveSheet();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [iosSaveSheet, closeIosSaveSheet]);

  // Download Action
  const handleDownload = async () => {
    // iPhone & iPad Safari: share prebuilt File synchronously inside tap (never <a download>), or open in-page save sheet
    if (isIos) {
      const cached = prebuiltExportRef.current;
      if (cached?.file) {
        if (navigator.canShare && navigator.canShare({ files: [cached.file] })) {
          try {
            await navigator.share({
              files: [cached.file],
              title: TITLE,
            });
            setStatusMsg(MEME_DESK_COPY.status.shared);
            return;
          } catch (err) {
            if (err && err.name === 'AbortError') {
              return;
            }
            // Non-abort error: fall through to in-page save sheet
          }
        }
        openIosSaveSheet(cached.blob);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.toBlob((blob) => {
        if (!blob) {
          setStatusMsg(MEME_DESK_COPY.status.error);
          return;
        }
        openIosSaveSheet(blob);
      }, 'image/png');
      return;
    }

    // Chrome, Android, and macOS Safari: anchor path using Blob URL + 60s delayed revoke (no data URLs)
    const cached = prebuiltExportRef.current;
    if (!exportDirtyRef.current && cached?.blob && cached.template === selectedTemplate) {
      triggerAnchorDownload(
        cached.blob,
        `bull-on-canton-${selectedTemplate}-${Date.now()}.png`,
        MEME_DESK_COPY.status.saved
      );
      return;
    }

    await renderCanvas();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const filename = `bull-on-canton-${selectedTemplate}-${Date.now()}.png`;
    canvas.toBlob((blob) => {
      triggerAnchorDownload(blob, filename, MEME_DESK_COPY.status.saved);
    }, 'image/png');
  };

  // Download Sticker Action (512x512 transparent PNG, face + props only, centered with 24px padding)
  const handleDownloadSticker = async () => {
    if (selectedBull.legacy) return;

    let bullImg;
    try {
      bullImg = await loadMemeImage(`/assets/${selectedBull.file}`);
    } catch {
      return;
    }

    let activeLayout = layoutData;
    if (!activeLayout && sortedPlacedProps.length > 0) {
      activeLayout = await loadMemeLayoutOnce().catch(() => null);
    }
    const activeFaceAnchors =
      activeLayout?.faces?.find((f) => f.id === selectedBull.id)?.anchors || null;

    if (activeLayout && sortedPlacedProps.length > 0) {
      const urls = [];
      for (const p of sortedPlacedProps) {
        const lp = activeLayout.props?.find((item) => item.id === p.id);
        if (!lp) continue;
        for (const sp of lp.sprites || []) {
          urls.push(`/assets/meme/${sp.file}`);
        }
        for (const ex of lp.extras || []) {
          const isOn =
            p.extras && typeof p.extras[ex.id] === 'boolean'
              ? p.extras[ex.id]
              : Boolean(ex.defaultOn);
          if (isOn) urls.push(`/assets/meme/${ex.file}`);
        }
      }
      await Promise.all(
        urls.filter((u) => !imageCache.has(u)).map((u) => loadMemeImage(u).catch(() => null))
      );
    }

    const scratchSize = 1800;
    const scratch = document.createElement('canvas');
    scratch.width = scratchSize;
    scratch.height = scratchSize;
    const sctx = scratch.getContext('2d', { willReadFrequently: true });
    if (!sctx) return;

    const scratchRect = {
      x: Math.round((scratchSize - FACE_NATURAL_W) / 2),
      y: Math.round((scratchSize - FACE_NATURAL_H) / 2),
      w: FACE_NATURAL_W,
      h: FACE_NATURAL_H,
    };

    sctx.clearRect(0, 0, scratchSize, scratchSize);
    drawTransparentFaceAndPropsOnCtx(
      sctx,
      scratchRect,
      bullImg,
      selectedBull.file,
      sortedPlacedProps,
      activeLayout,
      activeFaceAnchors
    );

    // Find tight visible alpha bounds of face + props so sticker fits 512x512 with 24px padding
    let minX = scratchSize;
    let minY = scratchSize;
    let maxX = -1;
    let maxY = -1;
    try {
      const pixels = sctx.getImageData(0, 0, scratchSize, scratchSize).data;
      for (let y = 0; y < scratchSize; y++) {
        const row = y * scratchSize;
        for (let x = 0; x < scratchSize; x++) {
          if (pixels[(row + x) * 4 + 3] >= 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    } catch {
      minX = scratchRect.x;
      minY = scratchRect.y;
      maxX = scratchRect.x + scratchRect.w - 1;
      maxY = scratchRect.y + scratchRect.h - 1;
    }

    if (maxX < minX || maxY < minY) {
      minX = scratchRect.x;
      minY = scratchRect.y;
      maxX = scratchRect.x + scratchRect.w - 1;
      maxY = scratchRect.y + scratchRect.h - 1;
    }

    const bboxX = minX;
    const bboxY = minY;
    const bboxW = maxX - minX + 1;
    const bboxH = maxY - minY + 1;

    const stickerSize = 512;
    const padding = 24;
    const targetMax = stickerSize - padding * 2; // 464px
    const scale = Math.min(targetMax / bboxW, targetMax / bboxH);
    const dstW = bboxW * scale;
    const dstH = bboxH * scale;
    const dstX = (stickerSize - dstW) / 2;
    const dstY = (stickerSize - dstH) / 2;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = stickerSize;
    outCanvas.height = stickerSize;
    const octx = outCanvas.getContext('2d');
    if (!octx) return;

    octx.clearRect(0, 0, stickerSize, stickerSize);
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(scratch, bboxX, bboxY, bboxW, bboxH, dstX, dstY, dstW, dstH);

    const filename = `bull-on-canton-sticker-${selectedBull.id}-${Date.now()}.png`;
    outCanvas.toBlob((blob) => {
      if (!blob) {
        setStatusMsg(MEME_DESK_COPY.status.error);
        return;
      }
      if (isIos) {
        openIosSaveSheet(blob);
        return;
      }
      triggerAnchorDownload(blob, filename, MEME_DESK_COPY.status.stickerSaved);
    }, 'image/png');
  };

  // Native Share Action (uses cached File without awaiting so iOS tap activation stays intact)
  const handleShare = async () => {
    if (!navigator.share) return;

    const cached = prebuiltExportRef.current;
    if (cached?.file) {
      try {
        await navigator.share({
          title: UI_COPY.memeDesk.shareTitle,
          text: MEME_DESK_COPY.xPrefillText,
          files: [cached.file],
        });
        setStatusMsg(MEME_DESK_COPY.status.shared);
      } catch {
        // User cancelled or share dismissed
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'bull-on-canton-meme.png', { type: 'image/png' });
      try {
        await navigator.share({
          title: UI_COPY.memeDesk.shareTitle,
          text: MEME_DESK_COPY.xPrefillText,
          files: [file],
        });
        setStatusMsg(MEME_DESK_COPY.status.shared);
      } catch {
        // User cancelled or share dismissed
      }
    }, 'image/png');
  };

  // Copy Image Action
  const handleCopy = async () => {
    await renderCanvas();
    const canvas = canvasRef.current;
    if (!canvas || !navigator.clipboard) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const item = new window.ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        setStatusMsg(MEME_DESK_COPY.status.copied);
      } catch {
        setStatusMsg(MEME_DESK_COPY.status.error);
      }
    }, 'image/png');
  };

  // Post on X Action
  const handlePostOnX = () => {
    const text = encodeURIComponent(MEME_DESK_COPY.xPrefillText);
    const url = `https://twitter.com/intent/tweet?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const selectedLayoutProp = selectedProp ? propsById.get(selectedProp.id) : null;
  const activeBgObj =
    MEME_DESK_COPY.backgrounds.find((b) => b.id === selectedBackground) ||
    MEME_DESK_COPY.backgrounds[0];
  const isLegacySelected = Boolean(selectedBull.legacy);

  return (
    <section
      ref={sectionRef}
      id="meme-desk"
      aria-label={MEME_DESK_COPY.heading}
      className="relative w-full bg-black text-[#E8DFC9] px-3 sm:px-6 border-t-2 border-[#C97B1A]/40 select-none pb-32 sm:pb-36 scroll-mt-12"
      style={{
        paddingTop: 'clamp(24px, 6svh, 64px)',
        scrollMarginTop: 'clamp(32px, 5vh, 64px)',
      }}
    >
      <div className="max-w-6xl mx-auto flex flex-col">
        {/* Section Header */}
        <div className="border-b-2 border-[#C97B1A] pb-4 mb-6 sm:mb-8 text-center sm:text-left">
          <Reveal variant="stamp">
            <h2 className="font-anton text-3xl sm:text-5xl text-white uppercase tracking-wide inline-block">
              {MEME_DESK_COPY.heading}
            </h2>
          </Reveal>
          <p className="font-plex text-xs sm:text-sm text-[#F2B24A] font-bold tracking-widest uppercase mt-1">
            {MEME_DESK_COPY.subheading}
          </p>
        </div>

        {/* Blocks under heading animated with variant="rise" */}
        <Reveal variant="rise" stagger={80} className="w-full flex flex-col">
          {/* Live Accessibility Status Banner */}
          <div role="status" aria-live="polite">
            {statusMsg && (
              <div className="mb-4 bg-[#2FD27A]/15 border border-[#2FD27A] text-[#2FD27A] px-4 py-2 font-plex text-xs flex items-center justify-between">
                <span>{statusMsg}</span>
                <button
                  type="button"
                  onClick={() => setStatusMsg('')}
                  className="text-[#2FD27A] hover:underline text-xs min-h-[44px] px-2 cursor-pointer"
                >
                  {UI_COPY.memeDesk.dismiss}
                </button>
              </div>
            )}
          </div>

          {/* Workspace: Canvas Preview + Controls */}
          <div className="grid grid-cols-1 min-[900px]:grid-cols-12 gap-6 min-[900px]:gap-8 items-start">
            {/* Canvas Preview Stage (Sticky top: 8px on mobile, top: 24px on desktop) */}
            <div className="w-full min-[900px]:col-span-5 xl:col-span-6 sticky top-2 min-[900px]:top-6 z-30 flex flex-col items-center">
              <div
                ref={previewFrameRef}
                className="relative w-full max-w-[480px] bg-[#0E0D0C] border-2 sm:border-3 border-[#C97B1A] shadow-[4px_4px_0_#000] sm:shadow-[8px_8px_0_#000] p-1.5 sm:p-2 flex flex-col items-center max-h-[42svh] min-[900px]:max-h-none overflow-hidden will-change-transform"
              >
                {/* Canvas viewport */}
                <div className="relative w-full flex-1 overflow-hidden bg-black flex items-center justify-center">
                  <div className="relative inline-flex items-center justify-center max-w-full max-h-full overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      data-no-tapfx
                      onPointerDown={handleCanvasPointerDown}
                      onPointerUp={handleCanvasPointerUp}
                      className="w-auto h-auto max-w-full max-h-[calc(42svh-28px)] min-[900px]:max-h-[68vh] mx-auto block cursor-default"
                      style={{
                        aspectRatio: selectedTemplate === 'frontpage' ? '4/5' : '1/1',
                      }}
                    />

                    {/* DOM Selection Box for selected prop (never painted on canvas; touch-action: none strictly here) */}
                    {selectionBox && (
                      <div
                        data-no-tapfx
                        role="region"
                        aria-label={MEME_DESK_COPY.propControls.selectionAria}
                        onPointerDown={handlePropBoxPointerDown}
                        onPointerMove={handlePropBoxPointerMove}
                        onPointerUp={handlePropBoxPointerUp}
                        onPointerCancel={handlePropBoxPointerUp}
                        className="absolute border-2 border-dashed border-[#F2B24A] cursor-grab active:cursor-grabbing select-none"
                        style={{
                          zIndex: 25,
                          left: `${selectionBox.leftPct}%`,
                          top: `${selectionBox.topPct}%`,
                          width: `max(32px, ${selectionBox.widthPct}%)`,
                          height: `max(32px, ${selectionBox.heightPct}%)`,
                          transform: `translate(-50%, -50%) rotate(${selectionBox.rotDeg}deg)`,
                          boxShadow: '0 0 0 1px #0E0D0C',
                          touchAction: 'none',
                        }}
                      >
                        <span className="pointer-events-none absolute -top-1 -left-1 w-2 h-2 bg-[#F2B24A] border border-[#0E0D0C]" />
                        <span className="pointer-events-none absolute -top-1 -right-1 w-2 h-2 bg-[#F2B24A] border border-[#0E0D0C]" />
                        <span className="pointer-events-none absolute -bottom-1 -left-1 w-2 h-2 bg-[#F2B24A] border border-[#0E0D0C]" />
                        <span className="pointer-events-none absolute -bottom-1 -right-1 w-2 h-2 bg-[#F2B24A] border border-[#0E0D0C]" />
                      </div>
                    )}

                    {/* Stamp Draggable Target: exact geometry match via getStampGeometry; touchAction: 'none' here ONLY */}
                    {stampGeom && (
                      <div
                        data-no-tapfx
                        role="region"
                        aria-label={UI_COPY.memeDesk.dragStampAria}
                        onPointerEnter={(e) => {
                          if (e.pointerType === 'mouse') setIsStampHovered(true);
                        }}
                        onPointerLeave={() => setIsStampHovered(false)}
                        onPointerDown={handleStampPointerDown}
                        onPointerMove={handleStampPointerMove}
                        onPointerUp={handleStampPointerUp}
                        onPointerCancel={handleStampPointerUp}
                        className={`absolute box-border cursor-grab active:cursor-grabbing select-none border-2 border-dashed transition-colors ${
                          isStampSelected || isStampHovered
                            ? 'border-[#C23B22]'
                            : 'border-transparent'
                        }`}
                        style={{
                          zIndex: isStampSelected ? 26 : 24,
                          left: `${(stampGeom.cx / 1080) * 100}%`,
                          top: `${(stampGeom.cy / (selectedTemplate === 'frontpage' ? 1350 : 1080)) * 100}%`,
                          width: `${(stampGeom.w / 1080) * 100}%`,
                          height: `${(stampGeom.h / (selectedTemplate === 'frontpage' ? 1350 : 1080)) * 100}%`,
                          transform: `translate(-50%, -50%) rotate(${stampGeom.rotDeg}deg)`,
                          touchAction: 'none',
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Resolution Label */}
                <div className="w-full flex items-center justify-between mt-1 px-1 text-[9px] sm:text-[10px] font-plex text-[#E8DFC9]/50 shrink-0">
                  <span>
                    {UI_COPY.memeDesk.exportPrefix}{' '}
                    {selectedTemplate === 'frontpage' ? '1080x1350' : '1080x1080'}
                  </span>
                  <span className="hidden sm:inline">{UI_COPY.memeDesk.renderNote}</span>
                </div>
              </div>
            </div>

            {/* Controls: Three Tabs on mobile, Stacked on desktop */}
            <div
              ref={tabsContainerRef}
              className="w-full min-[900px]:col-span-7 xl:col-span-6 flex flex-col gap-4 sm:gap-6"
            >
              {/* Mobile Tab Bar (< 900px) */}
              <div
                className="desk-tab-item flex min-[900px]:hidden border-2 border-[#C97B1A]/40 bg-[#0E0D0C] p-1 gap-1 shadow-[2px_2px_0_#000]"
                role="tablist"
                aria-label={UI_COPY.memeDesk.stepsAria}
              >
                {[
                  { id: 'pick', label: MEME_DESK_COPY.steps.pick },
                  { id: 'write', label: MEME_DESK_COPY.steps.write },
                  { id: 'send', label: MEME_DESK_COPY.steps.send },
                ].map((tab) => {
                  const isCurrent = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isCurrent}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 py-2 px-1 text-xs font-anton tracking-wider uppercase transition-all min-h-[44px] cursor-pointer border ${
                        isCurrent
                          ? 'bg-[#F2B24A] text-black border-black shadow-[2px_2px_0_#C97B1A]'
                          : 'bg-black/60 text-[#E8DFC9]/70 border-transparent hover:text-white'
                      } focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:outline-none`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* ========================================================= */}
              {/* STEP 1: PICK                                              */}
              {/* ========================================================= */}
              <div
                className={`desk-tab-item ${
                  activeTab === 'pick' ? 'block' : 'hidden'
                } min-[900px]:block bg-[#0E0D0C] border-2 border-[#C97B1A]/60 p-4 sm:p-5 shadow-[4px_4px_0_#000]`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#C97B1A]/40 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-[#C97B1A] rotate-45 inline-block" />
                    <h3 className="font-anton text-lg tracking-wider text-white uppercase">
                      {MEME_DESK_COPY.steps.pick}
                    </h3>
                  </div>

                  <button
                    type="button"
                    data-no-tapfx
                    onClick={handleShuffle}
                    aria-label={MEME_DESK_COPY.shuffleAria}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-black hover:bg-[#1a1510] text-[#E8DFC9] hover:text-white font-plex text-[11px] font-semibold uppercase tracking-wider border border-[#C97B1A]/60 hover:border-[#F2B24A] transition-colors min-h-[36px] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:outline-none"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-[#F2B24A]" />
                    <span>{MEME_DESK_COPY.shuffleButton}</span>
                  </button>
                </div>

                {/* 1. FACE: Horizontal row of face thumbnails */}
                <div className="mb-4">
                  <label className="block text-[11px] font-plex text-[#F2B24A] font-bold tracking-wider uppercase mb-2">
                    {MEME_DESK_COPY.pickSections.face}
                  </label>
                  <div className="flex items-stretch gap-2 overflow-x-auto pb-1.5 monitor-scroll">
                    {MEME_DESK_COPY.bulls.map((bull) => {
                      const isSelected = selectedBull.id === bull.id;
                      const thumbBgStyle = bull.legacy
                        ? { backgroundColor: '#000000' }
                        : { backgroundColor: activeBgObj.color };

                      return (
                        <button
                          key={bull.id}
                          type="button"
                          data-no-tapfx
                          onClick={() => setSelectedBull(bull)}
                          aria-label={bull.label}
                          aria-pressed={isSelected}
                          className={`shrink-0 w-[68px] flex flex-col items-center p-1 border-2 transition-colors outline-none min-h-[44px] cursor-pointer ${
                            isSelected
                              ? 'border-[#F2B24A] bg-[#F2B24A]/20'
                              : 'border-black hover:border-[#C97B1A] bg-black'
                          } focus-visible:ring-2 focus-visible:ring-[#F2B24A]`}
                        >
                          <div
                            className="relative w-full aspect-square overflow-hidden flex items-end justify-center"
                            style={thumbBgStyle}
                          >
                            {!bull.legacy && activeBgObj.halftone && (
                              <div className="halftone-overlay absolute inset-0" />
                            )}
                            {!bull.legacy && activeBgObj.pattern && (
                              <BackgroundPatternPreview pattern={activeBgObj.pattern} />
                            )}
                            <img
                              src={`/assets/${bull.file}`}
                              alt={bull.label}
                              width={80}
                              height={80}
                              loading="lazy"
                              className={`relative w-full ${
                                bull.legacy ? 'h-full object-cover' : 'h-auto object-contain'
                              }`}
                            />
                          </div>
                          <span className="text-[11px] font-plex text-[#E8DFC9] truncate w-full text-center mt-1">
                            {bull.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. BACKGROUND: Swatches (Black, Newsprint, Bronze, Brick, Candles, Sunburst) */}
                <div className="mb-4">
                  <label className="block text-[11px] font-plex text-[#F2B24A] font-bold tracking-wider uppercase mb-2">
                    {MEME_DESK_COPY.pickSections.background}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {MEME_DESK_COPY.backgrounds.map((bg) => {
                      const isSelected = selectedBackground === bg.id && !isLegacySelected;
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          data-no-tapfx
                          disabled={isLegacySelected}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedBackground(bg.id)}
                          className={`flex items-center gap-2 px-2.5 py-2 border-2 transition-colors min-h-[44px] outline-none ${
                            isLegacySelected
                              ? 'border-black bg-black/50 opacity-45 cursor-not-allowed'
                              : isSelected
                                ? 'border-[#F2B24A] bg-[#F2B24A]/15 cursor-pointer'
                                : 'border-black hover:border-[#C97B1A] bg-black cursor-pointer'
                          } focus-visible:ring-2 focus-visible:ring-[#F2B24A]`}
                        >
                          <span
                            aria-hidden="true"
                            className="relative w-5 h-5 shrink-0 border border-[#0E0D0C] overflow-hidden"
                            style={{ backgroundColor: bg.color }}
                          >
                            {bg.halftone && (
                              <span className="halftone-overlay absolute inset-0" />
                            )}
                            {bg.pattern && <BackgroundPatternPreview pattern={bg.pattern} />}
                          </span>
                          <span className="text-[11px] font-plex font-semibold text-[#E8DFC9] truncate">
                            {bg.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. PROPS: Horizontal row of prop chips + control row, or legacy note */}
                <div className="mb-4 pt-3 border-t border-[#C97B1A]/25">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="block text-[11px] font-plex text-[#F2B24A] font-bold tracking-wider uppercase">
                      {MEME_DESK_COPY.pickSections.props}
                    </label>
                    {!isLegacySelected && (
                      <button
                        type="button"
                        data-no-tapfx
                        disabled={placedProps.length === 0}
                        onClick={handleResetProps}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-plex text-[#E8DFC9]/80 hover:text-white border border-[#C97B1A]/40 disabled:opacity-40 disabled:cursor-default cursor-pointer min-h-[32px]"
                      >
                        <RotateCcw className="w-3 h-3 text-[#F2B24A]" />
                        <span>{MEME_DESK_COPY.propControls.reset}</span>
                      </button>
                    )}
                  </div>

                  {isLegacySelected ? (
                    <div className="bg-black/60 border border-[#C97B1A]/30 px-3 py-2.5 text-[11px] font-plex text-[#E8DFC9]/70">
                      {MEME_DESK_COPY.legacyNote}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-stretch gap-2 overflow-x-auto pb-1.5 monitor-scroll">
                        {trayProps.length === 0 ? (
                          <span className="text-[11px] font-plex text-[#E8DFC9]/60 py-2">
                            {MEME_DESK_COPY.propControls.loadingProps}
                          </span>
                        ) : (
                          trayProps.map((propDef) => {
                            const activeItem = placedProps.find((p) => p.id === propDef.id);
                            const isAdded = Boolean(activeItem);
                            const previewFile = propDef.sprites?.[0]?.file;

                            return (
                              <button
                                key={propDef.id}
                                type="button"
                                data-no-tapfx
                                aria-pressed={isAdded}
                                onClick={() => handlePropChipClick(propDef)}
                                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-2 transition-colors min-h-[44px] cursor-pointer outline-none ${
                                  isAdded
                                    ? 'border-[#F2B24A] bg-[#F2B24A]/20 text-white'
                                    : 'border-black bg-black hover:border-[#C97B1A] text-[#E8DFC9]'
                                } focus-visible:ring-2 focus-visible:ring-[#F2B24A]`}
                              >
                                {previewFile && (
                                  <span className="w-7 h-7 shrink-0 bg-[#161412] border border-[#2A1510] flex items-center justify-center p-0.5 overflow-hidden">
                                    <img
                                      src={`/assets/meme/${previewFile}`}
                                      alt=""
                                      loading="lazy"
                                      className="max-w-full max-h-full object-contain"
                                    />
                                  </span>
                                )}
                                <span className="text-[11px] font-plex font-semibold whitespace-nowrap">
                                  {propDef.label}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>

                      {/* Selected Prop Compact Control Row */}
                      {selectedProp && (
                        <div
                          data-no-tapfx
                          className="mt-2.5 bg-black border border-[#F2B24A]/50 p-2.5 flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-plex font-bold text-[#F2B24A] uppercase">
                              {selectedLayoutProp?.label || selectedProp.id}
                            </span>

                            {/* Extra toggle (e.g. Cigar Smoke) */}
                            {selectedLayoutProp?.extras?.map((ex) => {
                              const isOn = Boolean(selectedProp.extras?.[ex.id]);
                              return (
                                <button
                                  key={ex.id}
                                  type="button"
                                  data-no-tapfx
                                  aria-pressed={isOn}
                                  onClick={() =>
                                    updateSelectedProp((p) => ({
                                      ...p,
                                      extras: { ...p.extras, [ex.id]: !isOn },
                                    }))
                                  }
                                  className={`px-2 py-0.5 text-[11px] font-plex font-semibold border min-h-[30px] cursor-pointer ${
                                    isOn
                                      ? 'border-[#F2B24A] bg-[#F2B24A] text-black'
                                      : 'border-[#C97B1A]/50 bg-transparent text-[#E8DFC9]'
                                  }`}
                                >
                                  {ex.label}:{' '}
                                  {isOn
                                    ? MEME_DESK_COPY.propControls.on
                                    : MEME_DESK_COPY.propControls.off}
                                </button>
                              );
                            })}
                          </div>

                          {/* Size (50% - 200%) & Turn (-45 to 45 deg) Sliders */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <label className="flex items-center gap-2 text-[11px] font-plex text-[#E8DFC9]">
                              <span className="w-10 shrink-0 text-[#E8DFC9]/70">
                                {MEME_DESK_COPY.propControls.size}
                              </span>
                              <input
                                type="range"
                                data-no-tapfx
                                min="0.5"
                                max="2"
                                step="0.02"
                                value={selectedProp.scale}
                                onChange={(e) => {
                                  const next = parseFloat(e.target.value);
                                  updateSelectedProp((p) => ({ ...p, scale: next }));
                                }}
                                className="w-full accent-[#F2B24A] cursor-pointer"
                              />
                              <span className="w-10 text-right tabular-nums shrink-0">
                                {Math.round(selectedProp.scale * 100)}%
                              </span>
                            </label>

                            <label className="flex items-center gap-2 text-[11px] font-plex text-[#E8DFC9]">
                              <span className="w-10 shrink-0 text-[#E8DFC9]/70">
                                {MEME_DESK_COPY.propControls.turn}
                              </span>
                              <input
                                type="range"
                                data-no-tapfx
                                min="-45"
                                max="45"
                                step="1"
                                value={selectedProp.rot}
                                onChange={(e) => {
                                  const next = parseInt(e.target.value, 10);
                                  updateSelectedProp((p) => ({ ...p, rot: next }));
                                }}
                                className="w-full accent-[#F2B24A] cursor-pointer"
                              />
                              <span className="w-10 text-right tabular-nums shrink-0">
                                {selectedProp.rot}°
                              </span>
                            </label>
                          </div>

                          {/* Flip, To front, Remove */}
                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              data-no-tapfx
                              aria-pressed={selectedProp.flip}
                              onClick={() =>
                                updateSelectedProp((p) => ({ ...p, flip: !p.flip }))
                              }
                              className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-plex font-semibold border min-h-[36px] cursor-pointer ${
                                selectedProp.flip
                                  ? 'border-[#F2B24A] bg-[#F2B24A] text-black'
                                  : 'border-[#C97B1A]/50 bg-[#0E0D0C] text-[#E8DFC9] hover:border-[#F2B24A]'
                              }`}
                            >
                              <FlipHorizontal className="w-3.5 h-3.5" />
                              <span>{MEME_DESK_COPY.propControls.flip}</span>
                            </button>

                            <button
                              type="button"
                              data-no-tapfx
                              onClick={handleBringToFront}
                              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-plex font-semibold border border-[#C97B1A]/50 bg-[#0E0D0C] text-[#E8DFC9] hover:border-[#F2B24A] min-h-[36px] cursor-pointer"
                            >
                              <ArrowUpToLine className="w-3.5 h-3.5" />
                              <span>{MEME_DESK_COPY.propControls.toFront}</span>
                            </button>

                            <button
                              type="button"
                              data-no-tapfx
                              onClick={handleRemoveSelectedProp}
                              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-plex font-semibold border border-[#C23B22]/70 bg-[#0E0D0C] text-[#E8DFC9] hover:border-[#C23B22] hover:text-white min-h-[36px] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#C23B22]" />
                              <span>{MEME_DESK_COPY.propControls.remove}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* 4. TEMPLATE: Classic / Front Page / Speech Bubble */}
                <div>
                  <label className="block text-[11px] font-plex text-[#F2B24A] font-bold tracking-wider uppercase mb-2">
                    {UI_COPY.memeDesk.pickTemplateLabel}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {MEME_DESK_COPY.templates.map((tpl) => {
                      const isSelected = selectedTemplate === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => setSelectedTemplate(tpl.id)}
                          className={`p-2.5 border-2 text-left transition-all outline-none min-h-[44px] cursor-pointer ${
                            isSelected
                              ? 'border-[#F2B24A] bg-[#F2B24A]/15 shadow-[2px_2px_0_#F2B24A]'
                              : 'border-black hover:border-[#C97B1A]/60 bg-black'
                          } focus-visible:ring-2 focus-visible:ring-[#F2B24A]`}
                        >
                          <div className="font-anton text-sm text-white">{tpl.label}</div>
                          <div className="text-[10px] font-plex text-[#E8DFC9]/60 leading-tight mt-0.5">
                            {tpl.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile NEXT button */}
                <div className="mt-4 pt-3 border-t border-[#C97B1A]/30 flex justify-end min-[900px]:hidden">
                  <button
                    type="button"
                    onClick={() => setActiveTab('write')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F2B24A] hover:bg-[#ffc463] text-black font-anton text-xs tracking-wider uppercase shadow-[2px_2px_0_#000] min-h-[44px] cursor-pointer"
                  >
                    <span>{UI_COPY.memeDesk.nextWrite}</span>
                    <span>▶</span>
                  </button>
                </div>
              </div>

              {/* ========================================================= */}
              {/* STEP 2: WRITE                                             */}
              {/* ========================================================= */}
              <div
                className={`desk-tab-item ${
                  activeTab === 'write' ? 'block' : 'hidden'
                } min-[900px]:block bg-[#0E0D0C] border-2 border-[#C97B1A]/60 p-4 sm:p-5 shadow-[4px_4px_0_#000]`}
              >
                <div className="flex items-center gap-2 border-b border-[#C97B1A]/40 pb-2 mb-3">
                  <span className="w-2.5 h-2.5 bg-[#C97B1A] rotate-45 inline-block" />
                  <h3 className="font-anton text-lg tracking-wider text-white uppercase">
                    {MEME_DESK_COPY.steps.write}
                  </h3>
                </div>

                {/* Dynamic text inputs by template */}
                {selectedTemplate === 'classic' && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label
                          htmlFor="top-text"
                          className="text-[11px] font-plex text-[#F2B24A] font-bold uppercase"
                        >
                          {UI_COPY.memeDesk.topCaptionLabel}
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRandomLine(setTopText)}
                          className="text-[10px] font-plex text-[#E8DFC9]/70 hover:text-white flex items-center gap-1 cursor-pointer min-h-[44px] py-1"
                        >
                          <Sparkles className="w-3 h-3 text-[#F2B24A]" />
                          <span>{MEME_DESK_COPY.giveMeLineButton}</span>
                        </button>
                      </div>
                      <input
                        id="top-text"
                        type="text"
                        maxLength={60}
                        value={topText}
                        onChange={(e) => setTopText(e.target.value)}
                        className="w-full bg-black border-2 border-[#C97B1A]/40 px-3 py-2 font-anton text-base text-white focus:outline-none focus:border-[#F2B24A] min-h-[44px]"
                      />
                      <div className="text-right text-[10px] font-plex text-[#E8DFC9]/40 mt-0.5">
                        {topText.length}/60
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label
                          htmlFor="bottom-text"
                          className="text-[11px] font-plex text-[#F2B24A] font-bold uppercase"
                        >
                          {UI_COPY.memeDesk.bottomCaptionLabel}
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRandomLine(setBottomText)}
                          className="text-[10px] font-plex text-[#E8DFC9]/70 hover:text-white flex items-center gap-1 cursor-pointer min-h-[44px] py-1"
                        >
                          <Sparkles className="w-3 h-3 text-[#F2B24A]" />
                          <span>{MEME_DESK_COPY.giveMeLineButton}</span>
                        </button>
                      </div>
                      <input
                        id="bottom-text"
                        type="text"
                        maxLength={60}
                        value={bottomText}
                        onChange={(e) => setBottomText(e.target.value)}
                        className="w-full bg-black border-2 border-[#C97B1A]/40 px-3 py-2 font-anton text-base text-white focus:outline-none focus:border-[#F2B24A] min-h-[44px]"
                      />
                      <div className="text-right text-[10px] font-plex text-[#E8DFC9]/40 mt-0.5">
                        {bottomText.length}/60
                      </div>
                    </div>
                  </div>
                )}

                {selectedTemplate === 'frontpage' && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label
                          htmlFor="headline-text"
                          className="text-[11px] font-plex text-[#F2B24A] font-bold uppercase"
                        >
                          {UI_COPY.memeDesk.headlineLabel}
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRandomLine(setFrontHeadline)}
                          className="text-[10px] font-plex text-[#E8DFC9]/70 hover:text-white flex items-center gap-1 cursor-pointer min-h-[44px] py-1"
                        >
                          <Sparkles className="w-3 h-3 text-[#F2B24A]" />
                          <span>{MEME_DESK_COPY.giveMeLineButton}</span>
                        </button>
                      </div>
                      <input
                        id="headline-text"
                        type="text"
                        maxLength={70}
                        value={frontHeadline}
                        onChange={(e) => setFrontHeadline(e.target.value)}
                        className="w-full bg-black border-2 border-[#C97B1A]/40 px-3 py-2 font-playfair font-bold text-base text-white focus:outline-none focus:border-[#F2B24A] min-h-[44px]"
                      />
                      <div className="text-right text-[10px] font-plex text-[#E8DFC9]/40 mt-0.5">
                        {frontHeadline.length}/70
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="caption-text"
                        className="block text-[11px] font-plex text-[#F2B24A] font-bold uppercase mb-1"
                      >
                        {UI_COPY.memeDesk.photoCaptionLabel}
                      </label>
                      <input
                        id="caption-text"
                        type="text"
                        maxLength={60}
                        value={frontCaption}
                        onChange={(e) => setFrontCaption(e.target.value)}
                        className="w-full bg-black border-2 border-[#C97B1A]/40 px-3 py-2 font-plex text-base text-white focus:outline-none focus:border-[#F2B24A] min-h-[44px]"
                      />
                      <div className="text-right text-[10px] font-plex text-[#E8DFC9]/40 mt-0.5">
                        {frontCaption.length}/60
                      </div>
                    </div>
                  </div>
                )}

                {selectedTemplate === 'speech' && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label
                        htmlFor="speech-text"
                        className="text-[11px] font-plex text-[#F2B24A] font-bold uppercase"
                      >
                        {UI_COPY.memeDesk.speechBubbleLabel}
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRandomLine(setSpeechText)}
                        className="text-[10px] font-plex text-[#E8DFC9]/70 hover:text-white flex items-center gap-1 cursor-pointer min-h-[44px] py-1"
                      >
                        <Sparkles className="w-3 h-3 text-[#F2B24A]" />
                        <span>{MEME_DESK_COPY.giveMeLineButton}</span>
                      </button>
                    </div>
                    <input
                      id="speech-text"
                      type="text"
                      maxLength={80}
                      value={speechText}
                      onChange={(e) => setSpeechText(e.target.value)}
                      className="w-full bg-black border-2 border-[#C97B1A]/40 px-3 py-2 font-plex text-base text-white focus:outline-none focus:border-[#F2B24A] min-h-[44px]"
                    />
                    <div className="text-right text-[10px] font-plex text-[#E8DFC9]/40 mt-0.5">
                      {speechText.length}/80
                    </div>
                  </div>
                )}

                {/* Rubber Stamp Selector */}
                <div className="mt-4 pt-3 border-t border-[#C97B1A]/20">
                  <label className="block text-[11px] font-plex text-[#F2B24A] font-bold uppercase mb-2">
                    {UI_COPY.memeDesk.stampLabel}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {MEME_DESK_COPY.stamps.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setSelectedStamp(st);
                          if (st === 'NONE') {
                            setIsStampSelected(false);
                          } else {
                            setIsStampSelected(true);
                            setSelectedPropUid(null);
                          }
                        }}
                        className={`px-2.5 py-1.5 text-xs font-anton tracking-wider uppercase border transition-colors min-h-[40px] cursor-pointer ${
                          selectedStamp === st
                            ? 'border-[#C23B22] text-[#C23B22] bg-[#C23B22]/15 font-bold shadow-[2px_2px_0_#C23B22]'
                            : 'border-black text-[#E8DFC9]/70 bg-black hover:text-white'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {/* Stamp Size Slider if active */}
                  {selectedStamp !== 'NONE' && (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-[10px] font-plex text-[#E8DFC9]/70 whitespace-nowrap">
                        {UI_COPY.memeDesk.stampSizeLabel}
                      </span>
                      <input
                        type="range"
                        min="0.6"
                        max="1.6"
                        step="0.05"
                        value={stampScale}
                        onChange={(e) => {
                          setStampScale(parseFloat(e.target.value));
                          setIsStampSelected(true);
                          setSelectedPropUid(null);
                        }}
                        className="w-full accent-[#C23B22] cursor-pointer"
                      />
                      <span className="text-[10px] font-plex text-[#E8DFC9]/70">
                        {Math.round(stampScale * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Watermark Tag Toggle */}
                <div className="mt-4 pt-3 border-t border-[#C97B1A]/20">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-plex text-[#E8DFC9] min-h-[44px] py-1">
                    <input
                      type="checkbox"
                      checked={addWatermark}
                      onChange={(e) => setAddWatermark(e.target.checked)}
                      className="w-4 h-4 accent-[#C97B1A] rounded-none cursor-pointer"
                    />
                    <span>{MEME_DESK_COPY.watermarkToggle}</span>
                  </label>
                </div>

                {/* Mobile Back & Next Buttons */}
                <div className="mt-4 pt-3 border-t border-[#C97B1A]/30 flex justify-between items-center min-[900px]:hidden">
                  <button
                    type="button"
                    onClick={() => setActiveTab('pick')}
                    className="inline-flex items-center gap-1 px-3 py-2 text-[#E8DFC9]/70 hover:text-white font-plex text-xs uppercase min-h-[44px] cursor-pointer"
                  >
                    <span>{UI_COPY.memeDesk.backPick}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('send')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F2B24A] hover:bg-[#ffc463] text-black font-anton text-xs tracking-wider uppercase shadow-[2px_2px_0_#000] min-h-[44px] cursor-pointer"
                  >
                    <span>{UI_COPY.memeDesk.nextSend}</span>
                    <span>▶</span>
                  </button>
                </div>
              </div>

              {/* ========================================================= */}
              {/* STEP 3: SEND                                              */}
              {/* ========================================================= */}
              <div
                className={`desk-tab-item ${
                  activeTab === 'send' ? 'block' : 'hidden'
                } min-[900px]:block bg-[#0E0D0C] border-2 border-[#C97B1A]/60 p-4 sm:p-5 shadow-[4px_4px_0_#000] pb-6`}
              >
                <div className="flex items-center gap-2 border-b border-[#C97B1A]/40 pb-2 mb-3">
                  <span className="w-2.5 h-2.5 bg-[#C97B1A] rotate-45 inline-block" />
                  <h3 className="font-anton text-lg tracking-wider text-white uppercase">
                    {MEME_DESK_COPY.steps.send}
                  </h3>
                </div>

                {/* Export Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center justify-center gap-2 bg-[#C97B1A] hover:bg-[#d88720] text-black font-anton text-base tracking-wider uppercase py-3 px-4 border-2 border-black shadow-[3px_3px_0_#000] active:translate-y-0.5 cursor-pointer min-h-[44px]"
                  >
                    <Download className="w-4 h-4" />
                    <span>{MEME_DESK_COPY.buttons.download}</span>
                  </button>

                  {!isLegacySelected && (
                    <button
                      type="button"
                      data-no-tapfx
                      onClick={handleDownloadSticker}
                      className="inline-flex items-center justify-center gap-2 bg-black hover:bg-[#1f1a14] text-[#F2B24A] font-plex text-xs font-bold tracking-wider uppercase py-3 px-4 border-2 border-[#C97B1A] shadow-[3px_3px_0_#000] active:translate-y-0.5 cursor-pointer min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:outline-none"
                    >
                      <Download className="w-4 h-4 text-[#F2B24A]" />
                      <span>{MEME_DESK_COPY.buttons.downloadSticker}</span>
                    </button>
                  )}

                  {canCopy && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center justify-center gap-2 bg-black hover:bg-[#1f1a14] text-[#E8DFC9] font-plex text-xs font-bold tracking-wider uppercase py-3 px-4 border-2 border-[#C97B1A]/60 active:translate-y-0.5 cursor-pointer min-h-[44px]"
                    >
                      <Copy className="w-4 h-4 text-[#F2B24A]" />
                      <span>{MEME_DESK_COPY.buttons.copy}</span>
                    </button>
                  )}

                  {canShare && (
                    <button
                      type="button"
                      onClick={handleShare}
                      className="inline-flex items-center justify-center gap-2 bg-black hover:bg-[#1f1a14] text-[#E8DFC9] font-plex text-xs font-bold tracking-wider uppercase py-3 px-4 border-2 border-[#C97B1A]/60 active:translate-y-0.5 cursor-pointer min-h-[44px]"
                    >
                      <Share2 className="w-4 h-4 text-[#2FD27A]" />
                      <span>{MEME_DESK_COPY.buttons.share}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handlePostOnX}
                    className="inline-flex items-center justify-center gap-2 bg-[#1DA1F2] hover:bg-[#1a94df] text-white font-plex text-xs font-bold tracking-wider uppercase py-3 px-4 border-2 border-black shadow-[3px_3px_0_#000] active:translate-y-0.5 cursor-pointer min-h-[44px]"
                  >
                    <Twitter className="w-4 h-4" />
                    <span>{MEME_DESK_COPY.buttons.postX}</span>
                  </button>
                </div>

                {/* iOS Save Hint */}
                {isIos && (
                  <p className="font-plex text-[11px] text-[#F2B24A]/85 mt-3 text-center sm:text-left leading-relaxed">
                    {MEME_DESK_COPY.iosSaveHint}
                  </p>
                )}

                {/* X limitation note */}
                <p className="font-plex text-[11px] text-[#E8DFC9]/60 mt-3 text-center sm:text-left leading-relaxed">
                  {MEME_DESK_COPY.xNotice}
                </p>

                {/* Mobile Back Button */}
                <div className="mt-4 pt-2 flex justify-start min-[900px]:hidden">
                  <button
                    type="button"
                    onClick={() => setActiveTab('write')}
                    className="inline-flex items-center gap-1 px-3 py-2 text-[#E8DFC9]/70 hover:text-white font-plex text-xs uppercase min-h-[44px] cursor-pointer"
                  >
                    <span>{UI_COPY.memeDesk.backWrite}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Full-screen iOS long-press save sheet fallback */}
      {iosSaveSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={MEME_DESK_COPY.iosSaveSheetAria}
          data-no-tapfx
          onClick={closeIosSaveSheet}
          className="fixed inset-0 z-[1100] bg-[#0E0D0C]/95 flex flex-col items-center justify-center p-4 sm:p-6 select-auto"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg flex flex-col items-center text-center"
          >
            <img
              src={iosSaveSheet.blobUrl}
              alt={MEME_DESK_COPY.iosSaveSheetImgAlt}
              className="max-w-full max-h-[68svh] w-auto h-auto object-contain border-2 border-[#C97B1A] shadow-[6px_6px_0_#000] select-auto"
              style={{ WebkitTouchCallout: 'default', WebkitUserSelect: 'auto' }}
            />
            <p className="font-plex text-sm text-[#E8DFC9] mt-4 leading-relaxed">
              {MEME_DESK_COPY.iosSaveSheetInstruction}
            </p>
            <button
              ref={iosSaveCloseBtnRef}
              type="button"
              onClick={closeIosSaveSheet}
              className="mt-4 inline-flex items-center justify-center min-h-[44px] px-6 py-2 rounded-full bg-[#0E0D0C] border-2 border-[#C97B1A] text-[#E8DFC9] hover:bg-[#C97B1A] hover:text-[#0E0D0C] font-plex text-xs font-semibold uppercase tracking-widest cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F2B24A]"
            >
              {MEME_DESK_COPY.iosSaveSheetClose}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
