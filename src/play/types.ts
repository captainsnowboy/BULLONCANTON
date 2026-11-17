export type GamePhase = 'START' | 'STARTING' | 'PLAYING' | 'PAUSED' | 'DYING' | 'GAME_OVER';

export type GameSoundName =
  | 'jump'
  | 'land'
  | 'coin'
  | 'combo'
  | 'hit'
  | 'charge'
  | 'growl'
  | 'banner'
  | 'wreck'
  | 'pickup'
  | 'ui'
  | 'caught';

export type LocationId = 'wallStreet' | 'bearStorm' | 'cantonDawn';

export type RunnerState = 'run' | 'jumpRise' | 'jumpFall' | 'duck' | 'hit' | 'charge';

export type RiderPoseKey = 'up' | 'duck' | 'hit' | 'charge';

export type HerdTier = 'herd' | 'bull' | 'alpha';

export type FreeUnlockId =
  | 'bronzeDust'
  | 'greenCandle'
  | 'coinBurst'
  | 'creamOutline'
  | 'bronzeStreak';

export interface HerdPassState {
  tier: HerdTier;
  season: string;
}

export interface OpaqueBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MeasuredSprite {
  img: HTMLImageElement;
  box: OpaqueBox;
  hasTransparency: boolean;
  /** Pre-rendered #F2B24A 45% source-atop tinted offscreen canvas for BULL/ALPHA tiers */
  goldTintedCanvas?: HTMLCanvasElement;
  /** Pre-rendered solid #F2B24A silhouette for crisp flat gold outline */
  goldOutlineCanvas?: HTMLCanvasElement;
  /** Pre-rendered solid #E8DFC9 silhouette for crisp flat cream outline */
  creamOutlineCanvas?: HTMLCanvasElement;
}

export interface AnimJsonStatueConfig {
  sheet: string;
  frames: number;
  cols: number;
  fw: number;
  fh: number;
  fps: number;
  groundY: number;
  avgW: number;
  avgH: number;
  saddle: Array<[number, number]>;
  hoofX?: [number, number];
}

export interface AnimJsonRiderPoseConfig {
  file: string;
  w: number;
  h: number;
  hip: [number, number];
}

export interface AnimJsonRiderConfig {
  scale?: number;
  poses: Record<RiderPoseKey, AnimJsonRiderPoseConfig>;
}

export interface AnimJsonBearConfig {
  sheet: string;
  frames: number;
  cols: number;
  fw: number;
  fh: number;
  fps: number;
  groundY: number;
  avgH: number;
  hoofX?: [number, number];
}

export interface AnimJsonBearStillConfig {
  file: string;
  w: number;
  h: number;
}

export interface AnimJsonConfig {
  version?: number;
  statue: AnimJsonStatueConfig;
  rider: AnimJsonRiderConfig;
  bear: AnimJsonBearConfig;
  bearStill: AnimJsonBearStillConfig;
}

export interface AnimTuneSettings {
  saddleX: number;
  saddleY: number;
  scaleMult: number;
  poses: Record<RiderPoseKey, { x: number; y: number }>;
  springK: number;
  springC: number;
  showSaddlePoints: boolean;
  showHitbox: boolean;
}

export interface LoadedGameArt {
  statueSheet: HTMLImageElement | null;
  statueConfig: AnimJsonStatueConfig | null;
  riderConfig: AnimJsonRiderConfig | null;
  riderPoses: Partial<Record<RiderPoseKey, HTMLImageElement>>;
  /** Height from statue.groundY up to highest rider-up top in sheet pixels */
  runnerSheetHeight: number;
  /** Cyclic second difference of saddle.y smoothed over 3 frames, per statue frame */
  saddleAccelSmooth: Float64Array;
  layeredRunnerReady: boolean;
  bearSheet: HTMLImageElement | null;
  bearConfig: AnimJsonBearConfig | null;
  bearStillImg: HTMLImageElement | null;
  bearStillConfig: AnimJsonBearStillConfig | null;
  layeredBearReady: boolean;
  fallbackRunner: MeasuredSprite | null;
  fallbackExtraFrames: MeasuredSprite[];
  fallbackBear: MeasuredSprite | null;
}

export type ObstacleKind =
  | 'brick1'
  | 'brick2'
  | 'brick3'
  | 'candle'
  | 'bearTrap'
  | 'banner'
  | 'wreckingBall'
  | 'paperPlanes';

export type PatternType = 'ground' | 'overhead' | 'mixed' | 'rest' | 'coinShow';

export interface Obstacle {
  active: boolean;
  kind: ObstacleKind;
  isOverhead: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  wickTopH: number;
  pivotY: number;
  ropeLen: number;
  swingPhase: number;
  speedBonus: number;
  hit: boolean;
  closeChecked: boolean;
}

export type CoinItemKind = 'coin' | 'goldBar' | 'magnet' | 'shield';

export interface Coin {
  active: boolean;
  kind: CoinItemKind;
  x: number;
  y: number;
  r: number;
  collected: boolean;
  spinPhase: number;
  arcGroupId: number;
}

export interface FlyingHudCoin {
  active: boolean;
  startX: number;
  startY: number;
  ctrlX: number;
  ctrlY: number;
  endX: number;
  endY: number;
  t: number;
  duration: number;
  isGoldBar: boolean;
}

export interface PopupRing {
  active: boolean;
  x: number;
  y: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface FloatingPopup {
  active: boolean;
  text: string;
  x: number;
  y: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface DustParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  fillColor: string;
}

export interface CandleTrailParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  w: number;
  h: number;
  life: number;
  maxLife: number;
}

export interface BurstCoinParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
}

export interface DebrisParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vRot: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface SpeedLine {
  active: boolean;
  x: number;
  y: number;
  len: number;
  speed: number;
  thickness: number;
  color: string;
}

export interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
}

export interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vRot: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface AfterimageSample {
  active: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
  life: number;
}

export interface ScoreBreakdown {
  distance: number;
  coinsCombo: number;
  closeCalls: number;
  perfects: number;
}

export interface GameHudSnapshot {
  phase: GamePhase;
  locationId: LocationId;
  locationBannerTimer: number;
  isDailyRun: boolean;
  dailyDate: string;
  score: number;
  bestScore: number;
  isNewBest: boolean;
  coinCount: number;
  comboLevel: number;
  comboTimer: number;
  counterBumpKey: number;
  bearGap: number;
  showBearPaw: boolean;
  chargeCoins: number;
  chargeReady: boolean;
  chargeTimer: number;
  magnetTimer: number;
  hasPickupShield: boolean;
  secondWindAvailable: boolean;
  secondWindUsed: boolean;
  showGoBadge: boolean;
  showTapHint: boolean;
  breakdown: ScoreBreakdown;
  runSeed: number;
  runStartMinute: number;
  endedByCatch: boolean;
  runnerAnchor: { x: number; y: number; w: number; h: number };
}
