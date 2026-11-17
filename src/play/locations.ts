import { TICKER_ITEMS } from '../copy.js';
import type { AmbientParticle, LocationId, RainDrop } from './types';

export interface LocationConfig {
  id: LocationId;
  unlockScore: number;
  speedMult: number;
  bearRegrowthMult: number;
  overheadWeightMult: number;
  coinWeightMult: number;
  skyTop: string;
  skyBands: string[];
  farColor: string;
  midColor: string;
  midWinColor: string;
  nearColor: string;
  nearWinColor: string;
  outlineColor: string;
  accentColor: string;
  groundFill: string;
  groundBrickAlt: string;
  groundLineColor: string;
}

export const LOCATION_CONFIGS: Record<LocationId, LocationConfig> = {
  wallStreet: {
    id: 'wallStreet',
    unlockScore: 0,
    speedMult: 1.0,
    bearRegrowthMult: 1.0,
    overheadWeightMult: 1.0,
    coinWeightMult: 1.0,
    skyTop: '#0E0D0C',
    skyBands: ['#0E0D0C', '#14110F'],
    farColor: '#131110',
    midColor: '#171513',
    midWinColor: 'rgba(201, 123, 26, 0.22)',
    nearColor: '#1E1B18',
    nearWinColor: 'rgba(201, 123, 26, 0.44)',
    outlineColor: '#0E0D0C',
    accentColor: '#C97B1A',
    groundFill: '#1A1714',
    groundBrickAlt: '#221D19',
    groundLineColor: '#C97B1A',
  },
  bearStorm: {
    id: 'bearStorm',
    unlockScore: 2500,
    speedMult: 1.06,
    bearRegrowthMult: 0.75,
    overheadWeightMult: 1.5,
    coinWeightMult: 1.0,
    skyTop: '#11161C',
    skyBands: ['#11161C', '#151C24', '#1A222B'],
    farColor: '#141A22',
    midColor: '#1A222B',
    midWinColor: 'rgba(194, 59, 34, 0.28)',
    nearColor: '#202A35',
    nearWinColor: 'rgba(232, 223, 201, 0.2)',
    outlineColor: '#0E0D0C',
    accentColor: '#C23B22',
    groundFill: '#171D24',
    groundBrickAlt: '#1F2730',
    groundLineColor: '#C23B22',
  },
  cantonDawn: {
    id: 'cantonDawn',
    unlockScore: 6000,
    speedMult: 0.97,
    bearRegrowthMult: 1.25,
    overheadWeightMult: 1.0,
    coinWeightMult: 1.3,
    skyTop: '#2B3A55',
    skyBands: ['#2B3A55', '#474B66', '#7E5C5B', '#BA7D4B', '#F2B24A'],
    farColor: '#373D52',
    midColor: '#262C3D',
    midWinColor: 'rgba(242, 178, 74, 0.35)',
    nearColor: '#1B212E',
    nearWinColor: 'rgba(242, 178, 74, 0.52)',
    outlineColor: '#0E0D0C',
    accentColor: '#F2B24A',
    groundFill: '#211B18',
    groundBrickAlt: '#2B221D',
    groundLineColor: '#F2B24A',
  },
};

export function getLocationConfig(locId: LocationId): LocationConfig {
  return LOCATION_CONFIGS[locId] ?? LOCATION_CONFIGS.wallStreet;
}

function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TowerRect {
  x: number;
  w: number;
  h: number;
  stepped: boolean;
  windows: Array<{ rx: number; ry: number }>;
}

function buildTowerTile(
  seed: number,
  tileW: number,
  minH: number,
  maxH: number,
  winProb: number
): TowerRect[] {
  const rand = createMulberry32(seed);
  const towers: TowerRect[] = [];
  let cursor = 0;
  while (cursor < tileW) {
    const remaining = tileW - cursor;
    const w = remaining < 96 ? remaining : 46 + Math.floor(rand() * 54);
    const h = minH + rand() * (maxH - minH);
    const windows: Array<{ rx: number; ry: number }> = [];
    const cols = Math.max(1, Math.floor((w - 14) / 14));
    const rows = Math.max(1, Math.floor((h - 22) / 16));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand() < winProb) {
          windows.push({ rx: 7 + c * 14, ry: 12 + r * 16 });
        }
      }
    }
    towers.push({ x: cursor, w, h, stepped: rand() < 0.35, windows });
    cursor += w + (remaining < 96 ? 0 : 4 + Math.floor(rand() * 12));
  }
  return towers;
}

function drawTowersToCanvas(
  tileW: number,
  tileH: number,
  towers: TowerRect[],
  fill: string,
  winColor: string,
  outlineColor: string | null,
  bronzeEdgeColor: string | null
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(tileW));
  c.height = Math.max(1, Math.round(tileH));
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  for (let i = 0; i < towers.length; i++) {
    const t = towers[i];
    const by = tileH - t.h;
    ctx.fillStyle = fill;
    ctx.fillRect(t.x, by, t.w, t.h);

    if (t.stepped && t.h > 44) {
      const capW = Math.max(18, t.w * 0.56);
      const capH = 14;
      const capX = t.x + (t.w - capW) * 0.5;
      ctx.fillRect(capX, by - capH, capW, capH);
      if (outlineColor) {
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(capX, by - capH, capW, capH);
      }
    }

    if (outlineColor) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(t.x, by, t.w, t.h);
    }

    if (bronzeEdgeColor) {
      ctx.fillStyle = bronzeEdgeColor;
      ctx.fillRect(t.x + 2, by + 2, 2.5, t.h - 2);
    }

    ctx.fillStyle = winColor;
    for (let j = 0; j < t.windows.length; j++) {
      const w = t.windows[j];
      ctx.fillRect(t.x + w.rx, by + w.ry, 3, 5);
    }
  }
  return c;
}

interface StreetProp {
  offset: number;
  kind: 'lamp' | 'ticker' | 'manhole';
  tickerText: string;
}

export class LocationRenderer {
  private cachedKey = '';
  private cachedW = 0;
  private cachedGroundY = 0;
  private cachedH = 0;

  private tileW = 1280;
  private skyCanvas: HTMLCanvasElement | null = null;
  private farCanvas: HTMLCanvasElement | null = null; // 0.1x
  private midCanvas: HTMLCanvasElement | null = null; // 0.25x
  private nearCanvas: HTMLCanvasElement | null = null; // 0.5x
  private brickTileCanvas: HTMLCanvasElement | null = null;
  private brickTileW = 112;
  private halftonePattern: CanvasPattern | null = null;

  private offset01 = 0;
  private offset025 = 0;
  private offset05 = 0;
  private offset10 = 0;
  private tickerScroll = 0;

  // Dynamic Wall Street props (pooled / fixed list)
  private props: StreetProp[] = [];
  private steamTimer = 0;
  private steamPuffs: AmbientParticle[] = [];

  // Bear Storm pre-allocated rain + papers + storm flash
  private rainDrops: RainDrop[] = [];
  private newsPages: AmbientParticle[] = [];
  private stormClock = 0;
  private flashTimer = 0;

  // Canton Dawn pre-allocated gold motes
  private goldMotes: AmbientParticle[] = [];

  constructor(ctx: CanvasRenderingContext2D) {
    this.halftonePattern = this.createHalftonePattern(ctx);

    for (let i = 0; i < 40; i++) {
      this.rainDrops.push({
        x: Math.random() * 520,
        y: Math.random() * 620,
        len: 16 + (i % 4) * 5,
        speed: 620 + (i % 5) * 70,
      });
    }

    for (let i = 0; i < 6; i++) {
      this.newsPages.push({
        x: Math.random() * 520,
        y: 60 + Math.random() * 340,
        vx: -(90 + (i % 3) * 35),
        vy: 18 + (i % 2) * 14,
        size: 10 + (i % 3) * 3,
        rot: Math.random() * Math.PI,
        vRot: (i % 2 === 0 ? 1 : -1) * (1.8 + (i % 3) * 0.5),
        alpha: 0.85,
        life: 0,
        maxLife: 1,
      });
    }

    for (let i = 0; i < 16; i++) {
      this.steamPuffs.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 8,
        rot: 0,
        vRot: 0,
        alpha: 0,
        life: 0,
        maxLife: 0.7,
      });
    }

    for (let i = 0; i < 24; i++) {
      this.goldMotes.push({
        x: Math.random() * 520,
        y: 40 + Math.random() * 480,
        vx: -(18 + (i % 4) * 8),
        vy: -(8 + (i % 3) * 5),
        size: 2 + (i % 3),
        rot: 0,
        vRot: 0,
        alpha: 0.45 + (i % 4) * 0.14,
        life: Math.random() * 4,
        maxLife: 4,
      });
    }

    // Build Wall Street props cycle (total cycle 2040px, lamp every ~680px ~1.8s at start speed)
    const tickerA = `${TICKER_ITEMS[0]}   •   ${TICKER_ITEMS[4]}   •   ${TICKER_ITEMS[5]}`;
    const tickerB = `${TICKER_ITEMS[2]}   •   ${TICKER_ITEMS[6]}   •   ${TICKER_ITEMS[9]}`;
    this.props = [
      { offset: 140, kind: 'lamp', tickerText: '' },
      { offset: 410, kind: 'ticker', tickerText: tickerA },
      { offset: 560, kind: 'manhole', tickerText: '' },
      { offset: 820, kind: 'lamp', tickerText: '' },
      { offset: 1120, kind: 'manhole', tickerText: '' },
      { offset: 1460, kind: 'ticker', tickerText: tickerB },
      { offset: 1500, kind: 'lamp', tickerText: '' },
    ];
  }

  private createHalftonePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    try {
      const tile = document.createElement('canvas');
      tile.width = 16;
      tile.height = 16;
      const tctx = tile.getContext('2d');
      if (!tctx) return null;
      tctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      tctx.beginPath();
      tctx.arc(4, 4, 1.35, 0, Math.PI * 2);
      tctx.arc(12, 12, 1.35, 0, Math.PI * 2);
      tctx.fill();
      return ctx.createPattern(tile, 'repeat');
    } catch {
      return null;
    }
  }

  public resetMotion(): void {
    this.offset01 = 0;
    this.offset025 = 0;
    this.offset05 = 0;
    this.offset10 = 0;
    this.tickerScroll = 0;
    this.stormClock = 0;
    this.flashTimer = 0;
    for (let i = 0; i < this.steamPuffs.length; i++) {
      this.steamPuffs[i].alpha = 0;
    }
  }

  private ensureBaked(locId: LocationId, W: number, H: number, groundY: number, scale: number): void {
    const key = `${locId}:${W}:${H}:${groundY}`;
    if (this.cachedKey === key && this.skyCanvas) return;
    this.cachedKey = key;
    this.cachedW = W;
    this.cachedH = H;
    this.cachedGroundY = groundY;

    const cfg = getLocationConfig(locId);
    const tileW = 1280;
    this.tileW = tileW;

    // 1. Pre-bake flat sky bands offscreen
    const skyC = document.createElement('canvas');
    skyC.width = Math.max(1, W);
    skyC.height = Math.max(1, groundY);
    const sctx = skyC.getContext('2d');
    if (sctx) {
      const bands = cfg.skyBands;
      const bandH = groundY / bands.length;
      for (let i = 0; i < bands.length; i++) {
        sctx.fillStyle = bands[i];
        sctx.fillRect(0, Math.floor(i * bandH), W, Math.ceil(bandH) + 1);
      }
      if (this.halftonePattern) {
        sctx.fillStyle = this.halftonePattern;
        sctx.fillRect(0, 0, W, groundY);
      }
    }
    this.skyCanvas = skyC;

    // 2. Parallax 0.1x, 0.25x, 0.5x offscreen canvases
    const bronzeEdge = locId === 'cantonDawn' ? '#C97B1A' : null;
    const farTowers = buildTowerTile(
      locId === 'cantonDawn' ? 911 : 101,
      tileW,
      Math.max(45, groundY * 0.14),
      Math.max(95, groundY * 0.34),
      0.04
    );
    const midTowers = buildTowerTile(
      locId === 'cantonDawn' ? 922 : 202,
      tileW,
      Math.max(60, groundY * 0.2),
      Math.max(130, groundY * 0.44),
      locId === 'cantonDawn' ? 0.18 : 0.14
    );
    const nearTowers = buildTowerTile(
      locId === 'cantonDawn' ? 933 : 303,
      tileW,
      Math.max(70, groundY * 0.24),
      Math.max(150, groundY * 0.5),
      locId === 'cantonDawn' ? 0.28 : 0.24
    );

    const layerH = Math.max(160, Math.round(groundY * 0.65));
    this.farCanvas = drawTowersToCanvas(tileW, layerH, farTowers, cfg.farColor, cfg.midWinColor, null, null);
    this.midCanvas = drawTowersToCanvas(tileW, layerH, midTowers, cfg.midColor, cfg.midWinColor, cfg.outlineColor, bronzeEdge);
    this.nearCanvas = drawTowersToCanvas(tileW, layerH, nearTowers, cfg.nearColor, cfg.nearWinColor, cfg.outlineColor, bronzeEdge);

    // 3. Pre-bake ground brick strip tile
    const bw = Math.max(34, Math.round(56 * scale));
    const bh = Math.max(18, Math.round(26 * scale));
    const groundH = Math.max(20, H - groundY);
    const gTileW = bw * 2;
    this.brickTileW = gTileW;

    const brickC = document.createElement('canvas');
    brickC.width = gTileW;
    brickC.height = groundH;
    const bctx = brickC.getContext('2d');
    if (bctx) {
      bctx.fillStyle = cfg.groundFill;
      bctx.fillRect(0, 0, gTileW, groundH);
      const rows = Math.ceil(groundH / bh) + 1;
      for (let r = 0; r < rows; r++) {
        const y = 3 + r * bh;
        const shift = r % 2 === 0 ? 0 : bw * 0.5;
        for (let c = -1; c <= 2; c++) {
          const x = c * bw + shift;
          if ((c + r) % 2 === 0) {
            bctx.fillStyle = cfg.groundBrickAlt;
            bctx.fillRect(x, y, bw, bh);
          }
          bctx.strokeStyle = '#0E0D0C';
          bctx.lineWidth = 2;
          bctx.strokeRect(x, y, bw, bh);
        }
      }
    }
    this.brickTileCanvas = brickC;
  }

  public update(
    dt: number,
    locId: LocationId,
    worldSpeed: number,
    W: number,
    groundY: number,
    scale: number,
    prefersReducedMotion: boolean
  ): void {
    this.offset01 = (this.offset01 + worldSpeed * 0.1 * dt) % this.tileW;
    this.offset025 = (this.offset025 + worldSpeed * 0.25 * dt) % this.tileW;
    this.offset05 = (this.offset05 + worldSpeed * 0.5 * dt) % this.tileW;
    this.offset10 = (this.offset10 + worldSpeed * 1.0 * dt) % this.brickTileW;
    this.tickerScroll = (this.tickerScroll + 44 * dt) % 420;

    if (prefersReducedMotion) return;

    if (locId === 'wallStreet') {
      this.steamTimer += dt;
      if (this.steamTimer >= 0.22) {
        this.steamTimer -= 0.22;
        const cycleLen = 2040;
        const distTraveled = (this.offset05 * 2 + this.steamTimer * worldSpeed) % cycleLen;
        for (let i = 0; i < this.props.length; i++) {
          const prop = this.props[i];
          if (prop.kind !== 'manhole') continue;
          const screenX = ((prop.offset - (distTraveled % cycleLen) + cycleLen) % cycleLen);
          if (screenX > 20 && screenX < W - 20) {
            for (let s = 0; s < this.steamPuffs.length; s++) {
              const p = this.steamPuffs[s];
              if (p.alpha <= 0) {
                p.x = screenX + (Math.random() - 0.5) * 14 * scale;
                p.y = groundY - 4 * scale;
                p.vx = -worldSpeed * 0.25 - Math.random() * 25;
                p.vy = -(48 + Math.random() * 35) * scale;
                p.size = (7 + Math.random() * 6) * scale;
                p.alpha = 0.42;
                p.life = 0;
                p.maxLife = 0.65;
                break;
              }
            }
          }
        }
      }

      for (let i = 0; i < this.steamPuffs.length; i++) {
        const p = this.steamPuffs[i];
        if (p.alpha <= 0) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.alpha = 0;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += 8 * scale * dt;
        p.alpha = 0.42 * (1 - p.life / p.maxLife);
      }
    } else if (locId === 'bearStorm') {
      // Soft lightning flash max once every 7s, 120ms duration
      this.stormClock += dt;
      if (this.flashTimer > 0) {
        this.flashTimer = Math.max(0, this.flashTimer - dt);
      } else if (this.stormClock >= 7.2) {
        this.stormClock = 0;
        this.flashTimer = 0.12;
      }

      for (let i = 0; i < this.rainDrops.length; i++) {
        const r = this.rainDrops[i];
        r.x -= (r.speed * 0.28 + worldSpeed * 0.15) * dt;
        r.y += r.speed * dt;
        if (r.y > groundY || r.x < -30) {
          r.x = Math.random() * (W + 140);
          r.y = -20 - Math.random() * 80;
        }
      }

      for (let i = 0; i < this.newsPages.length; i++) {
        const p = this.newsPages[i];
        p.x += (p.vx - worldSpeed * 0.18) * dt;
        p.y += Math.sin(this.stormClock * 3 + i) * 18 * dt + p.vy * 0.25 * dt;
        p.rot += p.vRot * dt;
        if (p.x < -30 || p.y > groundY - 20) {
          p.x = W + 20 + Math.random() * 140;
          p.y = 65 + Math.random() * (groundY * 0.65);
        }
      }
    } else if (locId === 'cantonDawn') {
      for (let i = 0; i < this.goldMotes.length; i++) {
        const m = this.goldMotes[i];
        m.life += dt;
        m.x += (m.vx - worldSpeed * 0.08) * dt;
        m.y += Math.sin(m.life * 2.2 + i) * 12 * dt;
        if (m.x < -10) m.x = W + 10;
        if (m.y < 30) m.y = groundY - 30;
        if (m.y > groundY - 12) m.y = 40;
      }
    }
  }

  private drawTiledLayer(
    ctx: CanvasRenderingContext2D,
    layer: HTMLCanvasElement | null,
    offset: number,
    W: number,
    bottomY: number
  ): void {
    if (!layer) return;
    const tw = layer.width;
    const th = layer.height;
    const ox = -((offset % tw + tw) % tw);
    for (let x = ox; x < W; x += tw) {
      ctx.drawImage(layer, Math.round(x), Math.round(bottomY - th));
    }
  }

  public renderBackground(
    ctx: CanvasRenderingContext2D,
    locId: LocationId,
    W: number,
    H: number,
    groundY: number,
    scale: number,
    revealAlpha: number,
    slideLift: number,
    prefersReducedMotion: boolean
  ): void {
    this.ensureBaked(locId, W, H, groundY, scale);
    const cfg = getLocationConfig(locId);

    // 1. Flat Sky Bands + Halftone
    if (this.skyCanvas) {
      ctx.drawImage(this.skyCanvas, 0, 0);
    } else {
      ctx.fillStyle = cfg.skyTop;
      ctx.fillRect(0, 0, W, groundY);
    }

    // Bear Storm soft lightning bump (+12% brightness over sky for 120ms)
    if (locId === 'bearStorm' && this.flashTimer > 0 && !prefersReducedMotion) {
      ctx.fillStyle = 'rgba(232, 223, 201, 0.12)';
      ctx.fillRect(0, 0, W, groundY);
    }

    // 2. Parallax Skyline Layers (0.1x, 0.25x, 0.5x)
    ctx.save();
    ctx.globalAlpha = revealAlpha;
    this.drawTiledLayer(ctx, this.farCanvas, this.offset01, W, groundY + slideLift * 0.4);
    this.drawTiledLayer(ctx, this.midCanvas, this.offset025, W, groundY + slideLift * 0.7);
    this.drawTiledLayer(ctx, this.nearCanvas, this.offset05, W, groundY + slideLift);
    ctx.restore();

    // 3. Location-specific foreground props & atmosphere
    if (revealAlpha > 0.7) {
      if (locId === 'wallStreet') {
        this.renderWallStreetProps(ctx, W, groundY, scale);
      } else if (locId === 'bearStorm') {
        this.renderBearStormProps(ctx);
      } else if (locId === 'cantonDawn') {
        this.renderCantonDawnProps(ctx);
      }
    }

    // 4. Ground Brick Tile Layer (1.0x)
    ctx.fillStyle = cfg.groundFill;
    ctx.fillRect(-10, groundY, W + 20, H - groundY + 12);

    if (this.brickTileCanvas && revealAlpha > 0.38) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (revealAlpha - 0.35) / 0.65);
      const bw = this.brickTileCanvas.width;
      const ox = -((this.offset10 % bw + bw) % bw);
      for (let x = ox - bw; x < W + bw; x += bw) {
        ctx.drawImage(this.brickTileCanvas, Math.round(x), groundY);
      }
      ctx.restore();
    }

    ctx.fillStyle = cfg.groundLineColor;
    ctx.fillRect(-10, groundY, W + 20, 3);
  }

  private renderWallStreetProps(
    ctx: CanvasRenderingContext2D,
    W: number,
    groundY: number,
    scale: number
  ): void {
    const cycleLen = 2040;
    const worldScroll = this.offset05 * 2;
    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i];
      const screenX = ((prop.offset - (worldScroll % cycleLen) + cycleLen) % cycleLen) - 80;
      if (screenX < -160 || screenX > W + 160) continue;

      if (prop.kind === 'lamp') {
        const poleH = 88 * scale;
        const topY = groundY - poleH;
        // Flat warm light cone
        ctx.fillStyle = 'rgba(242, 178, 74, 0.1)';
        ctx.beginPath();
        ctx.moveTo(screenX - 4 * scale, topY + 6 * scale);
        ctx.lineTo(screenX - 30 * scale, groundY);
        ctx.lineTo(screenX + 30 * scale, groundY);
        ctx.lineTo(screenX + 4 * scale, topY + 6 * scale);
        ctx.closePath();
        ctx.fill();

        // Pole & globe
        ctx.fillStyle = '#0E0D0C';
        ctx.fillRect(screenX - 2 * scale, topY, 4 * scale, poleH);
        ctx.fillStyle = '#F2B24A';
        ctx.strokeStyle = '#0E0D0C';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screenX, topY, 5.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (prop.kind === 'ticker') {
        const boardW = 148 * scale;
        const boardH = 22 * scale;
        const boardY = groundY - 96 * scale;
        ctx.fillStyle = '#0E0D0C';
        ctx.strokeStyle = '#C97B1A';
        ctx.lineWidth = 2;
        ctx.fillRect(screenX, boardY, boardW, boardH);
        ctx.strokeRect(screenX, boardY, boardW, boardH);

        ctx.save();
        ctx.beginPath();
        ctx.rect(screenX + 3, boardY + 2, boardW - 6, boardH - 4);
        ctx.clip();
        ctx.fillStyle = '#2FD27A';
        ctx.font = `700 ${Math.max(9, Math.round(10 * scale))}px "IBM Plex Mono", monospace`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(prop.tickerText, screenX + 8 - (this.tickerScroll % 200), boardY + boardH * 0.52);
        ctx.restore();
      } else if (prop.kind === 'manhole') {
        ctx.fillStyle = '#14110F';
        ctx.strokeStyle = '#C97B1A';
        ctx.lineWidth = 1.5;
        ctx.fillRect(screenX - 14 * scale, groundY - 2, 28 * scale, 4);
      }
    }

    // Flat steam puffs
    for (let i = 0; i < this.steamPuffs.length; i++) {
      const p = this.steamPuffs[i];
      if (p.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = '#E8DFC9';
      ctx.strokeStyle = '#0E0D0C';
      ctx.lineWidth = 1.5;
      ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
      ctx.strokeRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
      ctx.restore();
    }
  }

  private renderBearStormProps(ctx: CanvasRenderingContext2D): void {
    // 40 flat diagonal red rain lines
    ctx.strokeStyle = 'rgba(194, 59, 34, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < this.rainDrops.length; i++) {
      const r = this.rainDrops[i];
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - r.len * 0.28, r.y + r.len);
    }
    ctx.stroke();

    // Drifting newspaper pages
    for (let i = 0; i < this.newsPages.length; i++) {
      const p = this.newsPages[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = '#E8DFC9';
      ctx.strokeStyle = '#0E0D0C';
      ctx.lineWidth = 1.8;
      ctx.fillRect(-p.size * 0.6, -p.size * 0.45, p.size * 1.2, p.size * 0.9);
      ctx.strokeRect(-p.size * 0.6, -p.size * 0.45, p.size * 1.2, p.size * 0.9);
      ctx.fillStyle = '#0E0D0C';
      ctx.fillRect(-p.size * 0.35, -p.size * 0.15, p.size * 0.7, 1.5);
      ctx.restore();
    }
  }

  private renderCantonDawnProps(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.goldMotes.length; i++) {
      const m = this.goldMotes[i];
      ctx.save();
      ctx.globalAlpha = m.alpha;
      ctx.fillStyle = '#F2B24A';
      ctx.fillRect(m.x, m.y, m.size, m.size);
      ctx.restore();
    }
  }
}

export function drawLocationPreview(canvas: HTMLCanvasElement, locId: LocationId): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width || 240;
  const h = canvas.height || 108;
  const cfg = getLocationConfig(locId);

  const groundY = Math.round(h * 0.76);
  const bandH = groundY / cfg.skyBands.length;
  for (let i = 0; i < cfg.skyBands.length; i++) {
    ctx.fillStyle = cfg.skyBands[i];
    ctx.fillRect(0, Math.floor(i * bandH), w, Math.ceil(bandH) + 1);
  }

  const heights = [0.42, 0.62, 0.36, 0.55, 0.48, 0.58];
  const bw = Math.floor(w / heights.length);
  for (let i = 0; i < heights.length; i++) {
    const bh = Math.round(groundY * heights[i]);
    const bx = i * bw + 2;
    const by = groundY - bh;
    ctx.fillStyle = i % 2 === 0 ? cfg.midColor : cfg.nearColor;
    ctx.fillRect(bx, by, bw - 5, bh);
    ctx.strokeStyle = cfg.outlineColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw - 5, bh);
    if (locId === 'cantonDawn') {
      ctx.fillStyle = '#C97B1A';
      ctx.fillRect(bx + 2, by + 2, 2, bh - 2);
    }
    ctx.fillStyle = cfg.nearWinColor;
    ctx.fillRect(bx + 6, by + 8, 4, 5);
    ctx.fillRect(bx + 14, by + 16, 4, 5);
  }

  if (locId === 'bearStorm') {
    ctx.strokeStyle = '#C23B22';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const rx = 18 + i * 28;
      const ry = 10 + (i % 3) * 14;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 5, ry + 16);
      ctx.stroke();
    }
  } else if (locId === 'cantonDawn') {
    ctx.fillStyle = '#F2B24A';
    ctx.fillRect(w * 0.25, 18, 4, 4);
    ctx.fillRect(w * 0.65, 26, 3, 3);
    ctx.fillRect(w * 0.82, 14, 4, 4);
  } else {
    // Wall street lamp glow dot
    ctx.fillStyle = '#F2B24A';
    ctx.beginPath();
    ctx.arc(w * 0.72, groundY - 22, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = cfg.groundFill;
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = cfg.groundLineColor;
  ctx.fillRect(0, groundY, w, 3);
}
