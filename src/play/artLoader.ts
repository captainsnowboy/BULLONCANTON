import type {
  AnimJsonConfig,
  LoadedGameArt,
  MeasuredSprite,
  OpaqueBox,
  RiderPoseKey,
} from './types';

declare const __GALLOP_EXTRA_FRAMES__: boolean;
declare const __HAS_GAME_ANIM_JSON__: boolean;

export function measureOpaqueBox(img: HTMLImageElement): { box: OpaqueBox; hasTransparency: boolean } {
  const w = img.naturalWidth || 1;
  const h = img.naturalHeight || 1;
  const fallback: OpaqueBox = { x: 0, y: 0, w, h };

  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const octx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!octx) return { box: fallback, hasTransparency: true };

    octx.drawImage(img, 0, 0);
    const data = octx.getImageData(0, 0, w, h).data;

    const cornerOffsets = [
      0,
      (w - 1) * 4,
      (h - 1) * w * 4,
      ((h - 1) * w + (w - 1)) * 4,
    ];
    const hasTransparency = cornerOffsets.some((idx) => data[idx + 3] <= 20);

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y++) {
      const rowStart = y * w * 4;
      for (let x = 0; x < w; x++) {
        if (data[rowStart + x * 4 + 3] > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return { box: fallback, hasTransparency };
    }

    return {
      box: {
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
      },
      hasTransparency,
    };
  } catch {
    return { box: fallback, hasTransparency: true };
  }
}

export function createTintedCanvas(
  img: HTMLImageElement,
  color: string,
  alpha: number
): HTMLCanvasElement | undefined {
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || 1;
    c.height = img.naturalHeight || 1;
    const octx = c.getContext('2d');
    if (!octx) return undefined;
    octx.drawImage(img, 0, 0);
    octx.globalCompositeOperation = 'source-atop';
    octx.globalAlpha = alpha;
    octx.fillStyle = color;
    octx.fillRect(0, 0, c.width, c.height);
    octx.globalCompositeOperation = 'source-over';
    octx.globalAlpha = 1;
    return c;
  } catch {
    return undefined;
  }
}

export function loadMeasuredSprite(src: string, bakeVariants = false): Promise<MeasuredSprite | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const { box, hasTransparency } = measureOpaqueBox(img);
      if (bakeVariants) {
        resolve({
          img,
          box,
          hasTransparency,
          goldTintedCanvas: createTintedCanvas(img, '#F2B24A', 0.45),
          goldOutlineCanvas: createTintedCanvas(img, '#F2B24A', 1),
          creamOutlineCanvas: createTintedCanvas(img, '#E8DFC9', 1),
        });
      } else {
        resolve({ img, box, hasTransparency });
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function loadRawImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function normalizeGameAssetPath(p: string): string {
  if (p.startsWith('/') || p.startsWith('http://') || p.startsWith('https://')) {
    return p;
  }
  return `/assets/game/${p}`;
}

function computeSaddleAccelSmooth(saddle: Array<[number, number]>, frames: number): Float64Array {
  const n = Math.min(frames, saddle.length);
  const out = new Float64Array(Math.max(1, n));
  if (n < 3) return out;

  const d2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const prev = saddle[(i - 1 + n) % n][1];
    const curr = saddle[i][1];
    const next = saddle[(i + 1) % n][1];
    d2[i] = next - 2 * curr + prev;
  }

  for (let i = 0; i < n; i++) {
    out[i] = (d2[(i - 1 + n) % n] + d2[i] + d2[(i + 1) % n]) / 3;
  }
  return out;
}

export async function loadAllGameArt(): Promise<LoadedGameArt> {
  const primaryPromise = loadMeasuredSprite('/assets/aistudio/IMG_6489_e00edd76.png', true);
  const bearPromise = loadMeasuredSprite('/assets/game/bear-run.webp', false);

  let frameBPromise: Promise<MeasuredSprite | null> = Promise.resolve(null);
  let frameCPromise: Promise<MeasuredSprite | null> = Promise.resolve(null);
  if (typeof __GALLOP_EXTRA_FRAMES__ !== 'undefined' && __GALLOP_EXTRA_FRAMES__) {
    frameBPromise = loadMeasuredSprite('/assets/game/bull-ride-b.webp', true);
    frameCPromise = loadMeasuredSprite('/assets/game/bull-ride-c.webp', true);
  }

  let animConfig: AnimJsonConfig | null = null;
  if (typeof __HAS_GAME_ANIM_JSON__ === 'undefined' || __HAS_GAME_ANIM_JSON__) {
    try {
      const res = await fetch('/assets/game/anim.json');
      if (res.ok) {
        animConfig = (await res.json()) as AnimJsonConfig;
      }
    } catch {
      animConfig = null;
    }
  }

  let statueSheet: HTMLImageElement | null = null;
  let bearSheet: HTMLImageElement | null = null;
  let bearStillImg: HTMLImageElement | null = null;
  const riderPoses: Partial<Record<RiderPoseKey, HTMLImageElement>> = {};

  if (animConfig) {
    const jobs: Array<Promise<void>> = [];

    if (animConfig.statue?.sheet) {
      jobs.push(
        loadRawImage(normalizeGameAssetPath(animConfig.statue.sheet)).then((img) => {
          statueSheet = img;
        })
      );
    }

    if (animConfig.bear?.sheet) {
      jobs.push(
        loadRawImage(normalizeGameAssetPath(animConfig.bear.sheet)).then((img) => {
          bearSheet = img;
        })
      );
    }

    if (animConfig.bearStill?.file) {
      jobs.push(
        loadRawImage(normalizeGameAssetPath(animConfig.bearStill.file)).then((img) => {
          bearStillImg = img;
        })
      );
    }

    if (animConfig.rider?.poses) {
      const keys: RiderPoseKey[] = ['up', 'duck', 'hit', 'charge'];
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const poseObj = animConfig.rider.poses[k];
        if (poseObj?.file) {
          jobs.push(
            loadRawImage(normalizeGameAssetPath(poseObj.file)).then((img) => {
              if (img) riderPoses[k] = img;
            })
          );
        }
      }
    }

    await Promise.all(jobs);
  }

  const [fallbackRunner, fallbackBear, frameB, frameC] = await Promise.all([
    primaryPromise,
    bearPromise,
    frameBPromise,
    frameCPromise,
  ]);

  const fallbackExtraFrames: MeasuredSprite[] = [];
  if (fallbackRunner && frameB && frameC) {
    fallbackExtraFrames.push(fallbackRunner, frameB, fallbackRunner, frameC);
  }

  const statueCfg = animConfig?.statue ?? null;
  const riderCfg = animConfig?.rider ?? null;
  const bearCfg = animConfig?.bear ?? null;
  const bearStillCfg = animConfig?.bearStill ?? null;

  const layeredRunnerReady = Boolean(
    statueSheet &&
      statueCfg &&
      statueCfg.frames > 0 &&
      Array.isArray(statueCfg.saddle) &&
      statueCfg.saddle.length > 0 &&
      riderCfg?.poses?.up &&
      riderPoses.up &&
      riderPoses.duck &&
      riderPoses.hit &&
      riderPoses.charge
  );

  const layeredBearReady = Boolean(bearSheet && bearCfg && bearCfg.frames > 0);

  let runnerSheetHeight = 384.5;
  let saddleAccelSmooth: Float64Array = new Float64Array(1);
  if (statueCfg && riderCfg?.poses?.up && Array.isArray(statueCfg.saddle) && statueCfg.saddle.length > 0) {
    const upHipY = riderCfg.poses.up.hip[1];
    let minRiderTop = Infinity;
    for (let i = 0; i < statueCfg.saddle.length; i++) {
      const topY = statueCfg.saddle[i][1] - upHipY;
      if (topY < minRiderTop) minRiderTop = topY;
    }
    if (Number.isFinite(minRiderTop) && statueCfg.groundY > minRiderTop) {
      runnerSheetHeight = statueCfg.groundY - minRiderTop;
    }
    saddleAccelSmooth = computeSaddleAccelSmooth(statueCfg.saddle, statueCfg.frames);
  }

  return {
    statueSheet,
    statueConfig: statueCfg,
    riderConfig: riderCfg,
    riderPoses,
    runnerSheetHeight,
    saddleAccelSmooth,
    layeredRunnerReady,
    bearSheet,
    bearConfig: bearCfg,
    bearStillImg,
    bearStillConfig: bearStillCfg,
    layeredBearReady,
    fallbackRunner,
    fallbackExtraFrames,
    fallbackBear,
  };
}
