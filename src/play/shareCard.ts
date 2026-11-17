import { SEASON, TOKEN_TICKER, WEEKLY_CHALLENGE } from '../config.js';
import { PLAY_COPY } from '../copy.js';
import { getRankLabel, hasTierPrivilege } from './storage';
import type { HerdTier, OpaqueBox } from './types';

const CARD_W = 1080;
const CARD_H = 1350;

const IMG_BULL_DEFAULT_BOX: OpaqueBox = { x: 263, y: 10, w: 1030, h: 1004 };
const IMG_BEAR_DEFAULT_BOX: OpaqueBox = { x: 2, y: 2, w: 796, h: 620 };

export interface ShareCardParams {
  score: number;
  seed: number;
  startMinute: number;
  tier: HerdTier | null;
  endedByCatch: boolean;
  locationName?: string;
  isDailyRun?: boolean;
  dailyDate?: string;
}

export interface BuiltShareCard {
  blob: Blob;
  file: File;
  runCode: string;
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function createGoldTintedBullCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || 1536;
  c.height = img.naturalHeight || 1024;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#F2B24A';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  return c;
}

export async function computeRunCode(
  score: number,
  seed: number,
  startMinute: number,
  tier: HerdTier | null
): Promise<string> {
  const payload = `${Math.floor(score)}|${seed}|${startMinute}|${tier ?? 'open'}`;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const bytes = new TextEncoder().encode(payload);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      return hex.slice(0, 6);
    }
  } catch {
    // Deterministic FNV fallback if subtle unavailable
  }
  let h = 2166136261 >>> 0;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(6, '0').slice(0, 6);
}

function drawHalftoneBackdrop(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#0E0D0C';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const step = 28;
  ctx.fillStyle = 'rgba(201, 123, 26, 0.08)';
  for (let y = 14; y < CARD_H; y += step) {
    const offset = Math.floor(y / step) % 2 === 0 ? 0 : step * 0.5;
    for (let x = 14 + offset; x < CARD_W; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export async function buildShareCard(params: ShareCardParams): Promise<BuiltShareCard | null> {
  if (typeof document === 'undefined') return null;

  try {
    if (document.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((res) => setTimeout(res, 1200)),
      ]);
    }
  } catch {
    // Proceed even if fonts check rejects
  }

  const [runCode, bullImg, bearImg] = await Promise.all([
    computeRunCode(params.score, params.seed, params.startMinute, params.tier),
    loadImg('/assets/aistudio/IMG_6489_e00edd76.png'),
    params.endedByCatch ? loadImg('/assets/game/bear-run.webp') : Promise.resolve(null),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const hasPass = params.tier !== null;
  const hasGoldFrame = hasTierPrivilege(params.tier, 'herd');
  const hasGoldBull = hasTierPrivilege(params.tier, 'bull');
  const isAlpha = params.tier === 'alpha';
  const challengeBeaten = params.score >= WEEKLY_CHALLENGE.target;

  const frameColor = hasGoldFrame ? '#F2B24A' : '#C97B1A';
  const leagueLabel = hasPass ? PLAY_COPY.herdLeague : PLAY_COPY.openLeague;
  const rankLabel = getRankLabel(params.score);

  // 1. Ink #0E0D0C + halftone dots
  drawHalftoneBackdrop(ctx);

  // 2. Card frame
  ctx.strokeStyle = frameColor;
  ctx.lineWidth = 10;
  ctx.strokeRect(24, 24, CARD_W - 48, CARD_H - 48);

  ctx.strokeStyle = 'rgba(232, 223, 201, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(42, 42, CARD_W - 84, CARD_H - 84);

  // 3. Top header metadata (League left, Season center, TOKEN_TICKER right)
  ctx.fillStyle = frameColor;
  ctx.font = '700 28px "IBM Plex Mono", monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(leagueLabel, 72, 68);

  ctx.fillStyle = 'rgba(232, 223, 201, 0.72)';
  ctx.textAlign = 'center';
  ctx.fillText(SEASON.name.toUpperCase(), CARD_W / 2, 68);

  ctx.fillStyle = '#E8DFC9';
  ctx.textAlign = 'right';
  ctx.fillText(TOKEN_TICKER, CARD_W - 72, 68);

  // Top divider rule
  ctx.fillStyle = 'rgba(201, 123, 26, 0.45)';
  ctx.fillRect(72, 118, CARD_W - 144, 2);

  // 4. Scene Arena (Bear snarling at left edge if caught + large suited bull on bronze bull)
  const arenaGroundY = 740;

  // Faint skyline blocks in card arena background
  ctx.fillStyle = '#171513';
  const cardSky = [
    { x: 64, w: 120, h: 170 },
    { x: 196, w: 96, h: 240 },
    { x: 304, w: 140, h: 150 },
    { x: 620, w: 130, h: 210 },
    { x: 766, w: 110, h: 260 },
    { x: 890, w: 126, h: 185 },
  ];
  for (let i = 0; i < cardSky.length; i++) {
    const b = cardSky[i];
    ctx.fillRect(b.x, arenaGroundY - b.h, b.w, b.h);
  }

  // Ground surface
  ctx.fillStyle = '#1A1714';
  ctx.fillRect(48, arenaGroundY, CARD_W - 96, 86);
  ctx.fillStyle = frameColor;
  ctx.fillRect(48, arenaGroundY, CARD_W - 96, 5);

  // Bear snarling at left edge when caught
  if (bearImg && params.endedByCatch) {
    const bearH = 380;
    const bearW = bearH * (IMG_BEAR_DEFAULT_BOX.w / IMG_BEAR_DEFAULT_BOX.h);
    const bearX = -bearW * 0.2;
    const bearY = arenaGroundY - bearH;

    ctx.save();
    ctx.beginPath();
    ctx.rect(48, 120, CARD_W - 96, arenaGroundY - 120 + 60);
    ctx.clip();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(bearX + bearW * 0.5, arenaGroundY + 8, bearW * 0.34, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(
      bearImg,
      IMG_BEAR_DEFAULT_BOX.x,
      IMG_BEAR_DEFAULT_BOX.y,
      IMG_BEAR_DEFAULT_BOX.w,
      IMG_BEAR_DEFAULT_BOX.h,
      bearX,
      bearY,
      bearW,
      bearH
    );
    ctx.restore();
  }

  // Large suited bull on bronze bull
  if (bullImg) {
    const bullH = 520;
    const bullW = bullH * (IMG_BULL_DEFAULT_BOX.w / IMG_BULL_DEFAULT_BOX.h);
    const bullX = params.endedByCatch ? CARD_W * 0.57 - bullW * 0.5 : CARD_W * 0.5 - bullW * 0.5;
    const bullY = arenaGroundY - bullH;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.ellipse(bullX + bullW * 0.5, arenaGroundY + 10, bullW * 0.34, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    const drawSource: CanvasImageSource = hasGoldBull
      ? createGoldTintedBullCanvas(bullImg)
      : bullImg;

    ctx.drawImage(
      drawSource,
      IMG_BULL_DEFAULT_BOX.x,
      IMG_BULL_DEFAULT_BOX.y,
      IMG_BULL_DEFAULT_BOX.w,
      IMG_BULL_DEFAULT_BOX.h,
      bullX,
      bullY,
      bullW,
      bullH
    );
  }

  // 5. Optional Stamps (ALPHA & Challenge Beaten)
  if (isAlpha) {
    ctx.save();
    ctx.translate(CARD_W - 220, 215);
    ctx.rotate(-0.1);
    const label = `${SEASON.name.toUpperCase()} ${PLAY_COPY.shareCard.alphaStampSuffix}`;
    ctx.fillStyle = '#0E0D0C';
    ctx.strokeStyle = '#F2B24A';
    ctx.lineWidth = 5;
    ctx.fillRect(-165, -34, 330, 68);
    ctx.strokeRect(-165, -34, 330, 68);
    ctx.fillStyle = '#F2B24A';
    ctx.font = '700 26px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }

  if (challengeBeaten) {
    ctx.save();
    ctx.translate(225, 225);
    ctx.rotate(0.08);
    ctx.fillStyle = 'rgba(14, 13, 12, 0.92)';
    ctx.strokeStyle = '#C23B22';
    ctx.lineWidth = 5;
    ctx.fillRect(-155, -32, 310, 64);
    ctx.strokeRect(-155, -32, 310, 64);
    ctx.fillStyle = '#C23B22';
    ctx.font = '700 23px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(PLAY_COPY.challengeBeaten.toUpperCase(), 0, 1);
    ctx.restore();
  }

  // 6. Headline: "OUTRAN THE BEAR FOR {score}" in Anton
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#E8DFC9';
  ctx.font = '400 54px "Anton", sans-serif';
  ctx.fillText(PLAY_COPY.shareCard.titlePrefix, CARD_W / 2, 868);

  ctx.fillStyle = frameColor;
  ctx.font = '400 132px "Anton", sans-serif';
  ctx.fillText(params.score.toLocaleString('en-US'), CARD_W / 2, 926);

  // 7. Rank, Location & Weekly/Daily challenge summary
  ctx.fillStyle = '#E8DFC9';
  ctx.font = '700 30px "IBM Plex Mono", monospace';
  ctx.fillText(`${PLAY_COPY.rankLabel}: ${rankLabel.toUpperCase()}`, CARD_W / 2, 1082);

  const metaParts: string[] = [];
  if (params.isDailyRun && params.dailyDate) {
    metaParts.push(`${PLAY_COPY.dailyRunTag} · ${params.dailyDate}`);
  }
  if (params.locationName) {
    metaParts.push(params.locationName);
  }
  metaParts.push(`${WEEKLY_CHALLENGE.week} · ${WEEKLY_CHALLENGE.text}`);

  ctx.fillStyle = 'rgba(232, 223, 201, 0.72)';
  ctx.font = '500 20px "IBM Plex Mono", monospace';
  ctx.fillText(metaParts.slice(0, 2).join('  ·  '), CARD_W / 2, 1138);

  // Bottom divider
  ctx.fillStyle = 'rgba(201, 123, 26, 0.35)';
  ctx.fillRect(72, 1205, CARD_W - 144, 2);

  // 8. Run code (left) + Watermark (right)
  ctx.font = '700 24px "IBM Plex Mono", monospace';
  ctx.fillStyle = frameColor;
  ctx.textAlign = 'left';
  ctx.fillText(`${PLAY_COPY.shareCard.runCodePrefix} ${runCode}`, 72, 1236);

  ctx.fillStyle = 'rgba(232, 223, 201, 0.5)';
  ctx.textAlign = 'right';
  ctx.fillText(PLAY_COPY.shareCard.watermark, CARD_W - 72, 1236);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) return null;

  const file = new File([blob], `bull-run-${params.score}-${runCode}.png`, {
    type: 'image/png',
  });
  return { blob, file, runCode };
}

export function isIosSafariDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60_000);
}
