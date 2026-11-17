import type { Coin, CoinItemKind, Obstacle, ObstacleKind, PatternType } from './types';

export interface PatternBuildContext {
  startX: number;
  groundY: number;
  scale: number;
  worldSpeed: number;
  runnerH: number;
  rng: () => number;
  nextArcGroupId: () => number;
  spawnObstacle: (
    kind: ObstacleKind,
    x: number,
    y: number,
    w: number,
    h: number,
    isOverhead: boolean,
    opts?: { wickTopH?: number; pivotY?: number; ropeLen?: number; speedBonus?: number }
  ) => void;
  spawnCoin: (
    x: number,
    y: number,
    kind: CoinItemKind,
    r: number,
    spinPhase: number,
    arcGroupId: number
  ) => void;
}

export interface TaggedPattern {
  id: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  type: PatternType;
  minTime: number;
  hasWreckingBall?: boolean;
  build: (c: PatternBuildContext) => number;
}

// Standing runner hitbox top reaches 55% runnerH; ducking drops top to 45% runnerH.
// Placing overhead obstacle bottom edge at 50% runnerH hits standing/jumping and clears ducking cleanly.
function overheadBottom(c: PatternBuildContext): number {
  return c.groundY - c.runnerH * 0.5;
}

function addArcCoins(
  c: PatternBuildContext,
  cx: number,
  peakY: number,
  width: number,
  rise: number,
  count: number,
  groupId: number
): void {
  const half = width * 0.5;
  const r = 13 * c.scale;
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const norm = (t - 0.5) * 2;
    const x = cx + norm * half;
    const y = peakY + norm * norm * rise;
    c.spawnCoin(x, y, 'coin', r, i * 0.45, groupId);
  }
}

function addCrescentHornShow(c: PatternBuildContext, startX: number): number {
  const s = c.scale;
  const groupId = c.nextArcGroupId();
  const cy = c.groundY - 120 * s;
  const rx = 128 * s;
  const ry = 54 * s;
  const count = 9;
  const r = 13 * s;

  // Crescent-horn 'C' / U curve of 9 coins
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const angle = Math.PI * (0.12 + 0.76 * t);
    const x = startX + rx * 0.85 + Math.cos(angle) * rx * 0.85;
    const y = cy - Math.sin(angle) * ry;
    c.spawnCoin(x, y, 'coin', r, i * 0.35, groupId);
  }

  return rx * 1.7 + 20 * s;
}

export const PATTERNS: TaggedPattern[] = [
  // 0: Single low brick1 + 3-coin arc (D1 ground)
  {
    id: 0,
    difficulty: 1,
    type: 'ground',
    minTime: 0,
    build: (c) => {
      const s = c.scale;
      const w = 44 * s;
      const h = 40 * s;
      c.spawnObstacle('brick1', c.startX, c.groundY - h, w, h, false);
      const gid = c.nextArcGroupId();
      addArcCoins(c, c.startX + w * 0.5, c.groundY - 122 * s, 96 * s, 20 * s, 3, gid);
      return w;
    },
  },
  // 1: Medium brick2 + 4-coin arc (D1 ground)
  {
    id: 1,
    difficulty: 1,
    type: 'ground',
    minTime: 0,
    build: (c) => {
      const s = c.scale;
      const w = 48 * s;
      const h = 58 * s;
      c.spawnObstacle('brick2', c.startX, c.groundY - h, w, h, false);
      const gid = c.nextArcGroupId();
      addArcCoins(c, c.startX + w * 0.5, c.groundY - 134 * s, 112 * s, 22 * s, 4, gid);
      return w;
    },
  },
  // 2: Low coin line (rest, D1)
  {
    id: 2,
    difficulty: 1,
    type: 'rest',
    minTime: 0,
    build: (c) => {
      const s = c.scale;
      const gid = c.nextArcGroupId();
      const spacing = 36 * s;
      for (let i = 0; i < 4; i++) {
        c.spawnCoin(c.startX + i * spacing, c.groundY - 30 * s, 'coin', 13 * s, i * 0.4, gid);
      }
      return 3 * spacing + 24 * s;
    },
  },
  // 3: Tall brick3 + 5-coin arc (D2 ground)
  {
    id: 3,
    difficulty: 2,
    type: 'ground',
    minTime: 0,
    build: (c) => {
      const s = c.scale;
      const w = 52 * s;
      const h = 76 * s;
      c.spawnObstacle('brick3', c.startX, c.groundY - h, w, h, false);
      const gid = c.nextArcGroupId();
      addArcCoins(c, c.startX + w * 0.5, c.groundY - (h + 64 * s), 124 * s, 24 * s, 5, gid);
      return w;
    },
  },
  // 4: Bear Trap wide steel jaws + high jump arc (D2 ground)
  {
    id: 4,
    difficulty: 2,
    type: 'ground',
    minTime: 0,
    build: (c) => {
      const s = c.scale;
      const w = 78 * s;
      const h = 28 * s;
      c.spawnObstacle('bearTrap', c.startX, c.groundY - h, w, h, false);
      const gid = c.nextArcGroupId();
      addArcCoins(c, c.startX + w * 0.5, c.groundY - 118 * s, 116 * s, 20 * s, 5, gid);
      return w;
    },
  },
  // 5: Crescent-horn 9-coin show (D1 coinShow)
  {
    id: 5,
    difficulty: 1,
    type: 'coinShow',
    minTime: 0,
    build: (c) => addCrescentHornShow(c, c.startX),
  },
  // 6: Double brick1 hop with safe landing gap (D2 ground)
  {
    id: 6,
    difficulty: 2,
    type: 'ground',
    minTime: 0,
    build: (c) => {
      const s = c.scale;
      const w1 = 42 * s;
      const h1 = 42 * s;
      const gap = Math.max(165 * s, c.worldSpeed * 0.6);
      const w2 = 44 * s;
      const h2 = 52 * s;
      c.spawnObstacle('brick1', c.startX, c.groundY - h1, w1, h1, false);
      c.spawnObstacle('brick2', c.startX + w1 + gap, c.groundY - h2, w2, h2, false);
      const gid1 = c.nextArcGroupId();
      const gid2 = c.nextArcGroupId();
      addArcCoins(c, c.startX + w1 * 0.5, c.groundY - 126 * s, 86 * s, 16 * s, 3, gid1);
      addArcCoins(c, c.startX + w1 + gap + w2 * 0.5, c.groundY - 132 * s, 86 * s, 16 * s, 3, gid2);
      return w1 + gap + w2;
    },
  },
  // 7: Hanging banner overhead + ground coin line (D2 overhead, >=12s)
  {
    id: 7,
    difficulty: 2,
    type: 'overhead',
    minTime: 12,
    build: (c) => {
      const s = c.scale;
      const bottom = overheadBottom(c);
      const w = 112 * s;
      const h = Math.max(66 * s, bottom * 0.68);
      c.spawnObstacle('banner', c.startX, bottom - h, w, h, true);
      const gid = c.nextArcGroupId();
      for (let i = 0; i < 4; i++) {
        c.spawnCoin(c.startX + 16 * s + i * 28 * s, c.groundY - 26 * s, 'coin', 12 * s, i * 0.4, gid);
      }
      return w;
    },
  },
  // 8: Tall Red Candle + 5-coin arc (D3 ground)
  {
    id: 8,
    difficulty: 3,
    type: 'ground',
    minTime: 0,
    build: (c) => {
      const s = c.scale;
      const w = 36 * s;
      const h = 94 * s;
      c.spawnObstacle('candle', c.startX, c.groundY - h, w, h, false, { wickTopH: 16 * s });
      const gid = c.nextArcGroupId();
      addArcCoins(c, c.startX + w * 0.5, c.groundY - (h + 56 * s), 124 * s, 22 * s, 5, gid);
      return w;
    },
  },
  // 9: Elevated coin arc + optional rare Gold Bar (D2 coinShow)
  {
    id: 9,
    difficulty: 2,
    type: 'coinShow',
    minTime: 0,
    build: (c) => {
      const s = c.scale;
      const gid = c.nextArcGroupId();
      const span = 180 * s;
      addArcCoins(c, c.startX + span * 0.5, c.groundY - 135 * s, span, 28 * s, 5, gid);
      if (c.rng() < 0.25) {
        c.spawnCoin(c.startX + span * 0.5, c.groundY - 166 * s, 'goldBar', 16 * s, 0, -1);
      }
      return span + 20 * s;
    },
  },
  // 10: Long Hanging Banner duck run (D3 overhead, >=12s)
  {
    id: 10,
    difficulty: 3,
    type: 'overhead',
    minTime: 12,
    build: (c) => {
      const s = c.scale;
      const bottom = overheadBottom(c);
      const w = 152 * s;
      const h = Math.max(70 * s, bottom * 0.65);
      c.spawnObstacle('banner', c.startX, bottom - h, w, h, true);
      const gid = c.nextArcGroupId();
      for (let i = 0; i < 5; i++) {
        c.spawnCoin(c.startX + 18 * s + i * 29 * s, c.groundY - 26 * s, 'coin', 12 * s, i * 0.35, gid);
      }
      return w;
    },
  },
  // 11: Folded Paper Planes flying left at head height (D3 overhead, >=12s)
  {
    id: 11,
    difficulty: 3,
    type: 'overhead',
    minTime: 12,
    build: (c) => {
      const s = c.scale;
      const bottom = overheadBottom(c);
      const w = 118 * s;
      const h = 44 * s;
      c.spawnObstacle('paperPlanes', c.startX, bottom - h, w, h, true, { speedBonus: 0.22 });
      const gid = c.nextArcGroupId();
      for (let i = 0; i < 3; i++) {
        c.spawnCoin(c.startX + 20 * s + i * 32 * s, c.groundY - 26 * s, 'coin', 12 * s, i * 0.5, gid);
      }
      return w;
    },
  },
  // 12: Rest coin strip (D1 rest)
  {
    id: 12,
    difficulty: 1,
    type: 'rest',
    minTime: 0,
    build: (c) => {
      const s = c.scale;
      const gid = c.nextArcGroupId();
      const step = 38 * s;
      for (let i = 0; i < 3; i++) {
        c.spawnCoin(c.startX + i * step, c.groundY - 46 * s, 'coin', 13 * s, i * 0.5, gid);
      }
      return 2 * step + 28 * s;
    },
  },
  // 13: Zigzag coin path + brick1 + banner (D3 mixed, >=35s)
  {
    id: 13,
    difficulty: 3,
    type: 'mixed',
    minTime: 35,
    build: (c) => {
      const s = c.scale;
      const bW = 44 * s;
      const bH = 44 * s;
      const gap = Math.max(178 * s, c.worldSpeed * 0.62);
      const banW = 104 * s;
      const bottom = overheadBottom(c);
      const banH = Math.max(66 * s, bottom * 0.65);

      c.spawnObstacle('brick1', c.startX, c.groundY - bH, bW, bH, false);
      c.spawnObstacle('banner', c.startX + bW + gap, bottom - banH, banW, banH, true);

      // Zigzag coin trail guiding jump then dodge
      const gid = c.nextArcGroupId();
      c.spawnCoin(c.startX + bW * 0.5, c.groundY - 128 * s, 'coin', 12 * s, 0, gid);
      c.spawnCoin(c.startX + bW + gap * 0.45, c.groundY - 78 * s, 'coin', 12 * s, 0.4, gid);
      c.spawnCoin(c.startX + bW + gap + banW * 0.3, c.groundY - 26 * s, 'coin', 12 * s, 0.8, gid);
      c.spawnCoin(c.startX + bW + gap + banW * 0.7, c.groundY - 26 * s, 'coin', 12 * s, 1.2, gid);

      return bW + gap + banW;
    },
  },
  // 14: Banner duck into bearTrap jump (D4 mixed, >=35s)
  {
    id: 14,
    difficulty: 4,
    type: 'mixed',
    minTime: 35,
    build: (c) => {
      const s = c.scale;
      const bottom = overheadBottom(c);
      const banW = 102 * s;
      const banH = Math.max(64 * s, bottom * 0.64);
      const gap = Math.max(175 * s, c.worldSpeed * 0.6);
      const trapW = 74 * s;
      const trapH = 28 * s;

      c.spawnObstacle('banner', c.startX, bottom - banH, banW, banH, true);
      c.spawnObstacle('bearTrap', c.startX + banW + gap, c.groundY - trapH, trapW, trapH, false);

      const gid = c.nextArcGroupId();
      c.spawnCoin(c.startX + banW * 0.5, c.groundY - 26 * s, 'coin', 12 * s, 0, gid);
      addArcCoins(c, c.startX + banW + gap + trapW * 0.5, c.groundY - 122 * s, 96 * s, 18 * s, 3, gid);
      return banW + gap + trapW;
    },
  },
  // 15: Brick2 -> Candle double jump (D4 ground)
  {
    id: 15,
    difficulty: 4,
    type: 'ground',
    minTime: 18,
    build: (c) => {
      const s = c.scale;
      const w1 = 46 * s;
      const h1 = 56 * s;
      const gap = Math.max(185 * s, c.worldSpeed * 0.64);
      const w2 = 34 * s;
      const h2 = 90 * s;
      c.spawnObstacle('brick2', c.startX, c.groundY - h1, w1, h1, false);
      c.spawnObstacle('candle', c.startX + w1 + gap, c.groundY - h2, w2, h2, false, { wickTopH: 15 * s });

      const gid1 = c.nextArcGroupId();
      const gid2 = c.nextArcGroupId();
      addArcCoins(c, c.startX + w1 * 0.5, c.groundY - 134 * s, 84 * s, 16 * s, 3, gid1);
      addArcCoins(c, c.startX + w1 + gap + w2 * 0.5, c.groundY - 150 * s, 92 * s, 18 * s, 3, gid2);
      return w1 + gap + w2;
    },
  },
  // 16: Twin Candles with gap (D4 ground)
  {
    id: 16,
    difficulty: 4,
    type: 'ground',
    minTime: 24,
    build: (c) => {
      const s = c.scale;
      const w = 34 * s;
      const h = 88 * s;
      const gap = Math.max(195 * s, c.worldSpeed * 0.66);
      c.spawnObstacle('candle', c.startX, c.groundY - h, w, h, false, { wickTopH: 14 * s });
      c.spawnObstacle('candle', c.startX + w + gap, c.groundY - h, w, h, false, { wickTopH: 14 * s });

      const gid = c.nextArcGroupId();
      addArcCoins(c, c.startX + w * 0.5, c.groundY - 148 * s, 88 * s, 16 * s, 3, gid);
      return w + gap + w;
    },
  },
  // 17: Wrecking Ball swinging overhead (>=50s, D4 overhead)
  {
    id: 17,
    difficulty: 4,
    type: 'overhead',
    minTime: 50,
    hasWreckingBall: true,
    build: (c) => {
      const s = c.scale;
      const bottom = overheadBottom(c);
      const diameter = Math.min(72 * s, Math.max(46 * s, c.runnerH * 0.52));
      const topY = bottom - diameter;
      const pivotY = Math.max(12, topY - 110 * s);
      const ropeLen = topY + diameter * 0.5 - pivotY;
      c.spawnObstacle('wreckingBall', c.startX, topY, diameter, diameter, true, {
        pivotY,
        ropeLen,
      });
      const gid = c.nextArcGroupId();
      for (let i = 0; i < 3; i++) {
        c.spawnCoin(c.startX + (i - 0.5) * 28 * s, c.groundY - 26 * s, 'coin', 12 * s, i * 0.4, gid);
      }
      return diameter + 30 * s;
    },
  },
  // 18: Brick3 + Paper Planes combo (D4 mixed, >=35s)
  {
    id: 18,
    difficulty: 4,
    type: 'mixed',
    minTime: 35,
    build: (c) => {
      const s = c.scale;
      const bW = 50 * s;
      const bH = 74 * s;
      const gap = Math.max(195 * s, c.worldSpeed * 0.65);
      const planeW = 114 * s;
      const planeH = 44 * s;
      const bottom = overheadBottom(c);

      c.spawnObstacle('brick3', c.startX, c.groundY - bH, bW, bH, false);
      c.spawnObstacle('paperPlanes', c.startX + bW + gap, bottom - planeH, planeW, planeH, true, {
        speedBonus: 0.2,
      });

      const gid = c.nextArcGroupId();
      addArcCoins(c, c.startX + bW * 0.5, c.groundY - 144 * s, 96 * s, 18 * s, 3, gid);
      return bW + gap + planeW;
    },
  },
  // 19: Gold Bar + Crescent Show (D2 coinShow)
  {
    id: 19,
    difficulty: 2,
    type: 'coinShow',
    minTime: 16,
    build: (c) => {
      const s = c.scale;
      const w = addCrescentHornShow(c, c.startX);
      c.spawnCoin(c.startX + w * 0.48, c.groundY - 122 * s, 'goldBar', 16 * s, 0, -1);
      return w;
    },
  },
  // 20: Wrecking Ball into Brick2 jump (D5 mixed, >=50s)
  {
    id: 20,
    difficulty: 5,
    type: 'mixed',
    minTime: 50,
    hasWreckingBall: true,
    build: (c) => {
      const s = c.scale;
      const bottom = overheadBottom(c);
      const diameter = Math.min(72 * s, Math.max(46 * s, c.runnerH * 0.52));
      const topY = bottom - diameter;
      const pivotY = Math.max(12, topY - 108 * s);
      const ropeLen = topY + diameter * 0.5 - pivotY;
      const gap = Math.max(185 * s, c.worldSpeed * 0.62);
      const bW = 48 * s;
      const bH = 58 * s;

      c.spawnObstacle('wreckingBall', c.startX, topY, diameter, diameter, true, {
        pivotY,
        ropeLen,
      });
      c.spawnObstacle('brick2', c.startX + diameter + gap, c.groundY - bH, bW, bH, false);

      const gid = c.nextArcGroupId();
      addArcCoins(c, c.startX + diameter + gap + bW * 0.5, c.groundY - 134 * s, 94 * s, 18 * s, 3, gid);
      return diameter + gap + bW;
    },
  },
  // 21: Triple Quick Brick1 -> Trap -> Banner (D5 mixed, >=40s)
  {
    id: 21,
    difficulty: 5,
    type: 'mixed',
    minTime: 40,
    build: (c) => {
      const s = c.scale;
      const bW = 42 * s;
      const bH = 40 * s;
      const gap1 = Math.max(172 * s, c.worldSpeed * 0.58);
      const tW = 70 * s;
      const tH = 28 * s;
      const gap2 = Math.max(180 * s, c.worldSpeed * 0.6);
      const banW = 104 * s;
      const bottom = overheadBottom(c);
      const banH = Math.max(64 * s, bottom * 0.62);

      c.spawnObstacle('brick1', c.startX, c.groundY - bH, bW, bH, false);
      c.spawnObstacle('bearTrap', c.startX + bW + gap1, c.groundY - tH, tW, tH, false);
      c.spawnObstacle('banner', c.startX + bW + gap1 + tW + gap2, bottom - banH, banW, banH, true);

      const gid = c.nextArcGroupId();
      addArcCoins(c, c.startX + bW + gap1 + tW * 0.5, c.groundY - 122 * s, 96 * s, 18 * s, 3, gid);
      return bW + gap1 + tW + gap2 + banW;
    },
  },
  // 22: Candle into Wrecking Ball gauntlet (D5 mixed, >=55s)
  {
    id: 22,
    difficulty: 5,
    type: 'mixed',
    minTime: 55,
    hasWreckingBall: true,
    build: (c) => {
      const s = c.scale;
      const cW = 36 * s;
      const cH = 92 * s;
      const gap = Math.max(198 * s, c.worldSpeed * 0.65);
      const bottom = overheadBottom(c);
      const diameter = Math.min(72 * s, Math.max(46 * s, c.runnerH * 0.52));
      const topY = bottom - diameter;
      const pivotY = Math.max(12, topY - 108 * s);
      const ropeLen = topY + diameter * 0.5 - pivotY;

      c.spawnObstacle('candle', c.startX, c.groundY - cH, cW, cH, false, { wickTopH: 15 * s });
      c.spawnObstacle('wreckingBall', c.startX + cW + gap, topY, diameter, diameter, true, {
        pivotY,
        ropeLen,
      });

      const gid = c.nextArcGroupId();
      addArcCoins(c, c.startX + cW * 0.5, c.groundY - 150 * s, 90 * s, 18 * s, 3, gid);
      return cW + gap + diameter;
    },
  },
  // 23: BearTrap into Double Banner gauntlet (D5 mixed, >=45s)
  {
    id: 23,
    difficulty: 5,
    type: 'mixed',
    minTime: 45,
    build: (c) => {
      const s = c.scale;
      const tW = 74 * s;
      const tH = 28 * s;
      const gap = Math.max(175 * s, c.worldSpeed * 0.58);
      const banW = 138 * s;
      const bottom = overheadBottom(c);
      const banH = Math.max(66 * s, bottom * 0.64);

      c.spawnObstacle('bearTrap', c.startX, c.groundY - tH, tW, tH, false);
      c.spawnObstacle('banner', c.startX + tW + gap, bottom - banH, banW, banH, true);

      const gid = c.nextArcGroupId();
      addArcCoins(c, c.startX + tW * 0.5, c.groundY - 122 * s, 96 * s, 18 * s, 3, gid);
      for (let i = 0; i < 3; i++) {
        c.spawnCoin(c.startX + tW + gap + 24 * s + i * 34 * s, c.groundY - 26 * s, 'coin', 12 * s, i * 0.4, gid);
      }
      return tW + gap + banW;
    },
  },
];

// Pre-allocated selector buffers to keep spawn zero-allocation
const candidateIndices = new Int16Array(PATTERNS.length);
const candidateWeights = new Float64Array(PATTERNS.length);

export interface PatternSelectorState {
  lastId1: number;
  lastId2: number;
  lastType1: PatternType | null;
  lastType2: PatternType | null;
  lastWasHard: boolean;
  obstaclesSinceRest: number;
  coinEventsCount: number;
  totalEventsCount: number;
}

export function createPatternSelectorState(): PatternSelectorState {
  return {
    lastId1: -1,
    lastId2: -1,
    lastType1: null,
    lastType2: null,
    lastWasHard: false,
    obstaclesSinceRest: 0,
    coinEventsCount: 0,
    totalEventsCount: 0,
  };
}

export function pickNextPattern(
  st: PatternSelectorState,
  runTime: number,
  overheadWeightMult: number,
  coinWeightMult: number,
  rng: () => number
): TaggedPattern {
  const targetD = Math.min(5, 1 + runTime / 22);
  const mustRestOrCoin = st.obstaclesSinceRest >= 5;
  const coinRatioTooHigh =
    st.totalEventsCount >= 4 && st.coinEventsCount / st.totalEventsCount >= 0.25;

  let count = 0;
  let weightSum = 0;

  for (let i = 0; i < PATTERNS.length; i++) {
    const p = PATTERNS[i];
    if (runTime < p.minTime) continue;

    // Force rest / coinShow after every 5 obstacle patterns
    if (mustRestOrCoin && p.type !== 'rest' && p.type !== 'coinShow') continue;

    // Keep coinShow <= 25% of spawn events unless forced after 5 obstacles
    if (!mustRestOrCoin && p.type === 'coinShow' && coinRatioTooHigh) continue;

    // No 3 repeated patterns or types in a row
    if (p.id === st.lastId1 && p.id === st.lastId2) continue;
    if (p.type === st.lastType1 && p.type === st.lastType2) continue;

    // Max 1 hard (>=4) in 2
    if (st.lastWasHard && p.difficulty >= 4) continue;

    // Difficulty gate: allow up to ceil(targetD), with preference near targetD
    if (p.difficulty > Math.ceil(targetD)) continue;

    const diffGap = Math.abs(p.difficulty - targetD);
    let w = Math.max(0.25, 2.2 - diffGap * 0.55);

    if (p.type === 'overhead' || p.type === 'mixed') {
      w *= overheadWeightMult;
    }
    if (p.type === 'coinShow') {
      w *= mustRestOrCoin ? 1.5 : 0.7 * coinWeightMult;
    } else if (p.type === 'rest') {
      w *= mustRestOrCoin ? 1.4 : 0.55;
    }

    candidateIndices[count] = i;
    candidateWeights[count] = w;
    weightSum += w;
    count++;
  }

  let chosen = PATTERNS[0];
  if (count > 0) {
    let roll = rng() * weightSum;
    for (let i = 0; i < count; i++) {
      roll -= candidateWeights[i];
      if (roll <= 0) {
        chosen = PATTERNS[candidateIndices[i]];
        break;
      }
      chosen = PATTERNS[candidateIndices[i]];
    }
  }

  // Update selector history
  st.lastId2 = st.lastId1;
  st.lastId1 = chosen.id;
  st.lastType2 = st.lastType1;
  st.lastType1 = chosen.type;
  st.lastWasHard = chosen.difficulty >= 4;
  st.totalEventsCount += 1;

  if (chosen.type === 'rest' || chosen.type === 'coinShow') {
    st.obstaclesSinceRest = 0;
    if (chosen.type === 'coinShow') {
      st.coinEventsCount += 1;
    }
  } else {
    st.obstaclesSinceRest += 1;
  }

  return chosen;
}

export function resetCoinPoolArray(coins: Coin[]): void {
  for (let i = 0; i < coins.length; i++) {
    coins[i].active = false;
  }
}

export function resetObstaclePoolArray(obstacles: Obstacle[]): void {
  for (let i = 0; i < obstacles.length; i++) {
    obstacles[i].active = false;
  }
}
