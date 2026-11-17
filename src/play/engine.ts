import { HERD_PERKS_ENABLED, WEEKLY_CHALLENGE } from '../config.js';
import { PLAY_COPY } from '../copy.js';
import { loadAllGameArt } from './artLoader';
import { getLocationConfig, LocationRenderer } from './locations';
import {
  createPatternSelectorState,
  pickNextPattern,
  type PatternBuildContext,
  type PatternSelectorState,
} from './patterns';
import { playGameSound } from './sound';
import {
  getUtcDateString,
  hasDoneFirstJump,
  hasTierPrivilege,
  hashStringToSeed,
  isLocationUnlocked,
  loadAnimTune,
  loadBestScore,
  loadFreeUnlocks,
  loadHerdPass,
  loadSelectedLocation,
  markFirstJumpDone,
  recordWeeklyScore,
  saveBestScore,
  saveSelectedLocation,
  syncFreeUnlocks,
} from './storage';
import type {
  AfterimageSample,
  AnimTuneSettings,
  BurstCoinParticle,
  CandleTrailParticle,
  Coin,
  CoinItemKind,
  DebrisParticle,
  DustParticle,
  FloatingPopup,
  FlyingHudCoin,
  FreeUnlockId,
  GameHudSnapshot,
  GamePhase,
  HerdTier,
  LoadedGameArt,
  LocationId,
  Obstacle,
  ObstacleKind,
  OpaqueBox,
  PopupRing,
  RiderPoseKey,
  RunnerState,
  SpeedLine,
} from './types';

export const RUNNER_H_FRAC = 0.2;

const FIXED_DT = 1 / 60;
const MAX_ACCUM_STEPS = 5;
const MIN_SPEED_REF = 340;
const MAX_SPEED_REF = 760;
const SPEED_RAMP_SECONDS = 100;
const GRAVITY_REF = 2650;
const JUMP_VY_REF = -760;
const JUMP_HOLD_MAX = 0.18;
const COYOTE_TIME = 0.09;
const JUMP_BUFFER_TIME = 0.1;
const SWIPE_DUCK_DURATION = 0.5;
const DUCK_HOLD_MAX = 0.7;
const DUCK_COOLDOWN = 0.25;
const HIT_STOP_DURATION = 0.06;
const HIT_STUN_DURATION = 0.45;
const HIT_SLOW_STATUE_DURATION = 0.2;
const DUST_LIFE = 0.4;
const DUST_INTERVAL_FALLBACK = 0.13;

const BEAR_HIT_COST = 30;
const BEAR_COIN_GAIN = 2;
const BEAR_REGROW_DELAY = 3.0;
const BEAR_REGEN_PER_SEC = 5.0;

const CHARGE_COINS_REQUIRED = 12;
const CHARGE_DURATION = 3.5;
const MAGNET_DURATION = 8.0;
const MAGNET_RADIUS_REF = 220;
const COMBO_WINDOW = 1.2;
const DYING_DURATION = 0.62;
const GO_DURATION = 0.24;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function drawCrescentHorn(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const s = r * 0.56;
  ctx.beginPath();
  ctx.moveTo(cx - 0.95 * s, cy - 0.52 * s);
  ctx.bezierCurveTo(
    cx - 0.95 * s,
    cy + 0.18 * s,
    cx - 0.5 * s,
    cy + 0.56 * s,
    cx,
    cy + 0.56 * s
  );
  ctx.bezierCurveTo(
    cx + 0.5 * s,
    cy + 0.56 * s,
    cx + 0.95 * s,
    cy + 0.18 * s,
    cx + 0.95 * s,
    cy - 0.52 * s
  );
  ctx.bezierCurveTo(
    cx + 0.7 * s,
    cy - 0.06 * s,
    cx + 0.36 * s,
    cy + 0.1 * s,
    cx,
    cy + 0.1 * s
  );
  ctx.bezierCurveTo(
    cx - 0.36 * s,
    cy + 0.1 * s,
    cx - 0.7 * s,
    cy - 0.06 * s,
    cx - 0.95 * s,
    cy - 0.52 * s
  );
  ctx.closePath();
  ctx.fill();
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

interface LayeredAfterimage extends AfterimageSample {
  statueFrame: number;
  oy: number;
  angleRad: number;
}

export class BullRunEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onSnapshot: (snap: GameHudSnapshot) => void;
  private prefersReducedMotion: boolean;

  private width = 390;
  private height = 664;
  private dpr = 1;
  private maxDprCap = 2;
  private slowFrameTimer = 0;
  private lastResizedW = 0;
  private lastResizedH = 0;

  private phase: GamePhase = 'START';
  private phaseBeforePause: GamePhase = 'PLAYING';
  private rafId: number | null = null;
  private lastFrameMs = 0;
  private accumulator = 0;
  private disposed = false;

  // Art, Locations & Live Tuning
  private art: LoadedGameArt = {
    statueSheet: null,
    statueConfig: null,
    riderConfig: null,
    riderPoses: {},
    runnerSheetHeight: 384.5,
    saddleAccelSmooth: new Float64Array(1),
    layeredRunnerReady: false,
    bearSheet: null,
    bearConfig: null,
    bearStillImg: null,
    bearStillConfig: null,
    layeredBearReady: false,
    fallbackRunner: null,
    fallbackExtraFrames: [],
    fallbackBear: null,
  };
  private animTune: AnimTuneSettings = loadAnimTune();
  private locationRenderer: LocationRenderer;
  private locationId: LocationId = 'wallStreet';
  private locationBannerTimer = 0;
  private isDailyRun = false;
  private dailyDate = '';

  // Transition
  private transitionProgress = 0;
  private goTimer = 0;

  // Run state & scoring
  private rng = createMulberry32(1);
  private runTime = 0;
  private distanceNormPx = 0;
  private distanceScore = 0;
  private coinScore = 0;
  private closeCallScore = 0;
  private perfectScore = 0;
  private score = 0;
  private bestScore = 0;
  private previousBestAtRunStart = 0;
  private isNewBest = false;
  private firstJumpDone = false;
  private tapHintTimer = 0;

  // Coin & combo / powerups / charge
  private coinCount = 0;
  private comboCount = 0;
  private comboLevel = 1;
  private comboTimer = 0;
  private counterBumpKey = 0;
  private chargeCoins = 0;
  private chargeTimer = 0;
  private magnetTimer = 0;
  private hasPickupShield = false;
  private nextPowerupTimer = 32;
  private pendingPowerup: 'magnet' | 'shield' | null = null;
  private nextArcGroupId = 1;
  private arcTotalCounts = new Int16Array(256);
  private arcCollectedCounts = new Int16Array(256);

  // Runner physics & states
  private runnerState: RunnerState = 'run';
  private runnerYOffset = 0;
  private runnerVy = 0;
  private onGround = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private isHoldingJump = false;
  private jumpHoldTimer = 0;
  private duckHeld = false;
  private swipeDuckTimer = 0;
  private wasDucking = false;
  private duckDurationTimer = 0;
  private duckCooldownTimer = 0;
  private duckBlend = 0;
  private fallbackLeanAngle = 0;
  private squashTimer = 0;
  private fallbackDustTimer = 0;
  private hitStopTimer = 0;
  private hitStunTimer = 0;
  private hitSlowStatueTimer = 0;
  private hitFlashTimer = 0;
  private statueAnimPhase = 0;
  private lastStatueFrame = 0;
  private bearAnimPhase = 0;

  // 2nd-order Rider Spring: oy'' = -k*oy - c*oy' - 0.55*a
  private riderSpringY = 0;
  private riderSpringVy = 0;
  private riderAirLeanDeg = 0;
  private hitJoltAngleDeg = 0;
  private prevRiderPose: RiderPoseKey = 'up';
  private curRiderPose: RiderPoseKey = 'up';
  private riderPoseFade = 1;

  // Bear chase (0..100)
  private bearGap = 100;
  private timeSinceLastHit = 99;
  private bearGrowlPlayed = false;
  private dyingTimer = 0;
  private catchBearStartX = -100;
  private rumbleTimer = 0;
  private screenShakeTimer = 0;
  private screenShakeAmp = 0;
  private perfectSlowTimer = 0;
  private cameraZoom = 1;

  // Spawner
  private selectorState: PatternSelectorState = createPatternSelectorState();
  private nextSpawnPx = 280;
  private buildCtx: PatternBuildContext;

  // Progression
  private activeTier: HerdTier | null = null;
  private freeUnlocks: Set<FreeUnlockId> = new Set();
  private secondWindAvailable = false;
  private secondWindUsed = false;
  private runSeed = 1;
  private runStartMinute = 0;
  private endedByCatch = false;
  private weeklyBeatenThisRun = false;
  private candleTrailTimer = 0;
  private bronzeStreakTimer = 0;
  private afterimageTimer = 0;
  private afterimageHead = 0;

  // Pre-allocated object pools
  private obstacles: Obstacle[] = [];
  private coins: Coin[] = [];
  private flyingCoins: FlyingHudCoin[] = [];
  private popupRings: PopupRing[] = [];
  private popups: FloatingPopup[] = [];
  private dust: DustParticle[] = [];
  private debris: DebrisParticle[] = [];
  private speedLines: SpeedLine[] = [];
  private candleTrail: CandleTrailParticle[] = [];
  private burstCoins: BurstCoinParticle[] = [];
  private bronzeStreaks: SpeedLine[] = [];
  private afterimages: LayeredAfterimage[] = [];

  // Snapshot cache
  private lastPublishedScore = -1;
  private lastPublishedGap = -1;
  private lastPublishedPhase: GamePhase | null = null;
  private lastPublishedCoins = -1;
  private lastPublishedCombo = -1;
  private lastPublishedChargeCoins = -1;
  private lastPublishedChargeStep = -1;
  private lastPublishedMagnetStep = -1;
  private lastPublishedShield = false;
  private lastPublishedPaw = false;
  private lastPublishedGo = false;
  private lastPublishedTapHint = false;
  private lastPublishedBanner = false;
  private lastPublishedSecondWindAvail = false;
  private lastPublishedSecondWindUsed = false;

  constructor(
    canvas: HTMLCanvasElement,
    onSnapshot: (snap: GameHudSnapshot) => void,
    prefersReducedMotion: boolean
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Canvas 2D context unavailable');
    }
    this.ctx = context;
    this.onSnapshot = onSnapshot;
    this.prefersReducedMotion = prefersReducedMotion;
    this.locationRenderer = new LocationRenderer(this.ctx);

    this.bestScore = loadBestScore();
    this.firstJumpDone = hasDoneFirstJump();
    this.locationId = loadSelectedLocation(this.bestScore);
    this.dailyDate = getUtcDateString();
    this.refreshProgression();

    this.initPools();

    this.buildCtx = {
      startX: 0,
      groundY: 0,
      scale: 1,
      worldSpeed: 340,
      runnerH: 130,
      rng: () => this.rng(),
      nextArcGroupId: () => {
        const id = (this.nextArcGroupId % 250) + 1;
        this.nextArcGroupId = id;
        this.arcTotalCounts[id] = 0;
        this.arcCollectedCounts[id] = 0;
        return id;
      },
      spawnObstacle: (kind, x, y, w, h, isOverhead, opts) => {
        this.allocObstacle(kind, x, y, w, h, isOverhead, opts);
      },
      spawnCoin: (x, y, kind, r, spinPhase, arcGroupId) => {
        this.allocCoin(x, y, kind, r, spinPhase, arcGroupId);
      },
    };

    this.resize(true);
    void this.loadAssets();
    this.render();
    this.emitSnapshot(true);
  }

  private initPools(): void {
    for (let i = 0; i < 20; i++) {
      this.obstacles.push({
        active: false,
        kind: 'brick1',
        isOverhead: false,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        wickTopH: 0,
        pivotY: 0,
        ropeLen: 0,
        swingPhase: 0,
        speedBonus: 0,
        hit: false,
        closeChecked: false,
      });
    }
    for (let i = 0; i < 64; i++) {
      this.coins.push({
        active: false,
        kind: 'coin',
        x: 0,
        y: 0,
        r: 13,
        collected: false,
        spinPhase: 0,
        arcGroupId: -1,
      });
    }
    for (let i = 0; i < 16; i++) {
      this.flyingCoins.push({
        active: false,
        startX: 0,
        startY: 0,
        ctrlX: 0,
        ctrlY: 0,
        endX: 0,
        endY: 0,
        t: 0,
        duration: 0.35,
        isGoldBar: false,
      });
    }
    for (let i = 0; i < 16; i++) {
      this.popupRings.push({
        active: false,
        x: 0,
        y: 0,
        maxR: 26,
        life: 0,
        maxLife: 0.25,
        color: '#F2B24A',
      });
    }
    for (let i = 0; i < 12; i++) {
      this.popups.push({
        active: false,
        text: '',
        x: 0,
        y: 0,
        vy: -54,
        color: '#F2B24A',
        life: 0,
        maxLife: 0.75,
      });
    }
    for (let i = 0; i < 32; i++) {
      this.dust.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 7,
        life: 0,
        maxLife: DUST_LIFE,
        fillColor: '#E8DFC9',
      });
    }
    for (let i = 0; i < 48; i++) {
      this.debris.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        w: 10,
        h: 6,
        rot: 0,
        vRot: 0,
        color: '#B5472B',
        life: 0,
        maxLife: 0.7,
      });
    }
    for (let i = 0; i < 20; i++) {
      this.speedLines.push({
        active: false,
        x: 0,
        y: 0,
        len: 80,
        speed: 1300,
        thickness: 2,
        color: '#E8DFC9',
      });
    }
    for (let i = 0; i < 24; i++) {
      this.candleTrail.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        w: 8,
        h: 20,
        life: 0,
        maxLife: 0.45,
      });
    }
    for (let i = 0; i < 16; i++) {
      this.burstCoins.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        r: 8,
        life: 0,
        maxLife: 0.65,
      });
    }
    for (let i = 0; i < 10; i++) {
      this.bronzeStreaks.push({
        active: false,
        x: 0,
        y: 0,
        len: 40,
        speed: 600,
        thickness: 3,
        color: '#C97B1A',
      });
    }
    for (let i = 0; i < 3; i++) {
      this.afterimages.push({
        active: false,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        alpha: 0.3,
        life: 0,
        statueFrame: 0,
        oy: 0,
        angleRad: 0,
      });
    }
  }

  private async loadAssets(): Promise<void> {
    const loaded = await loadAllGameArt();
    if (this.disposed) return;
    this.art = loaded;
    this.render();
    this.emitSnapshot(true);
  }

  public setAnimTune(next: AnimTuneSettings): void {
    this.animTune = next;
    this.render();
  }

  public getAnimTune(): AnimTuneSettings {
    return this.animTune;
  }

  public refreshProgression(): void {
    this.activeTier = loadHerdPass()?.tier ?? null;
    this.freeUnlocks = new Set(loadFreeUnlocks());
    if (!isLocationUnlocked(this.locationId, this.bestScore)) {
      this.locationId = 'wallStreet';
    }
    if (this.phase === 'START') {
      this.secondWindAvailable = Boolean(
        HERD_PERKS_ENABLED && hasTierPrivilege(this.activeTier, 'bull')
      );
      this.secondWindUsed = false;
    }
    this.emitSnapshot(true);
  }

  public setLocation(locId: LocationId): void {
    if (!isLocationUnlocked(locId, this.bestScore)) return;
    this.locationId = locId;
    saveSelectedLocation(locId);
    playGameSound('ui');
    this.render();
    this.emitSnapshot(true);
  }

  public setDailyRun(enabled: boolean): void {
    this.isDailyRun = enabled;
    this.dailyDate = getUtcDateString();
    playGameSound('ui');
    this.emitSnapshot(true);
  }

  public setReducedMotion(val: boolean): void {
    this.prefersReducedMotion = val;
  }

  public getPhase(): GamePhase {
    return this.phase;
  }

  public getPrimaryOpaqueBox(): OpaqueBox | null {
    return this.art.fallbackRunner?.box ?? null;
  }

  public getScale(): number {
    return this.height / 800;
  }

  private getRunnerMetrics(): {
    targetRunnerHeight: number;
    runnerScale: number;
    drawW: number;
    drawH: number;
    leftX: number;
    topY: number;
    groundY: number;
  } {
    const groundY = this.height * 0.68;
    const targetRunnerHeight = clamp(this.height * RUNNER_H_FRAC, 105, 200);

    if (this.art.layeredRunnerReady && this.art.statueConfig) {
      const sc = this.art.statueConfig;
      const runnerScale = targetRunnerHeight / this.art.runnerSheetHeight;
      const drawW = sc.fw * runnerScale;
      const drawH = sc.fh * runnerScale;
      const leftX = this.width * 0.36 - drawW * 0.5;
      const topY = groundY - sc.groundY * runnerScale;
      return {
        targetRunnerHeight,
        runnerScale,
        drawW,
        drawH,
        leftX,
        topY,
        groundY,
      };
    }

    const sprite = this.art.fallbackRunner;
    const aspect = sprite ? sprite.box.w / sprite.box.h : 1030 / 1004;
    const drawH = targetRunnerHeight;
    const drawW = drawH * aspect;
    const leftX = this.width * 0.36 - drawW * 0.5;
    const topY = groundY - drawH;
    return {
      targetRunnerHeight,
      runnerScale: 1,
      drawW,
      drawH,
      leftX,
      topY,
      groundY,
    };
  }

  public getRunnerTargetRect(): { x: number; y: number; w: number; h: number; groundY: number } {
    const m = this.getRunnerMetrics();
    return {
      x: m.leftX,
      y: m.groundY - m.targetRunnerHeight,
      w: m.drawW,
      h: m.targetRunnerHeight,
      groundY: m.groundY,
    };
  }

  public resize(force = false): void {
    if (typeof window === 'undefined') return;
    const rect = this.canvas.getBoundingClientRect();
    const vv = window.visualViewport;
    const availW = vv ? vv.width : window.innerWidth;
    const availH = vv ? vv.height : window.innerHeight;
    const nextW = Math.max(280, Math.round(rect.width || Math.min(availW, 520)));
    const nextH = Math.max(380, Math.round(rect.height || Math.min(availH, 920)));

    const isActiveRun = this.phase === 'PLAYING' || this.phase === 'DYING';
    if (!force && isActiveRun) {
      const widthChanged = Math.abs(nextW - this.lastResizedW) >= 2;
      const heightChangedBig = Math.abs(nextH - this.lastResizedH) >= 60;
      if (!widthChanged && !heightChangedBig) {
        return;
      }
    }

    this.lastResizedW = nextW;
    this.lastResizedH = nextH;
    this.width = nextW;
    this.height = nextH;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDprCap);

    this.canvas.width = Math.round(nextW * this.dpr);
    this.canvas.height = Math.round(nextH * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    if (this.phase === 'START' || this.phase === 'GAME_OVER' || this.phase === 'PAUSED') {
      this.render();
    }
    this.emitSnapshot(true);
  }

  public setTransitionReveal(progress: number): void {
    this.transitionProgress = clamp(progress, 0, 1);
    this.render();
  }

  public beginStartingTransition(): void {
    this.stopLoop();
    this.phase = 'STARTING';
    this.transitionProgress = 0;
    this.goTimer = 0;
    this.resetRunEntities();
    this.render();
    this.emitSnapshot(true);
  }

  public startRun(_showGoOnly: boolean): void {
    this.stopLoop();
    this.resetRunEntities();
    this.transitionProgress = 1;
    this.phase = 'PLAYING';
    this.goTimer = GO_DURATION;
    this.locationBannerTimer = 1.6;
    this.tapHintTimer = this.firstJumpDone ? 0 : 3.0;
    this.emitSnapshot(true);
    this.startLoop();
  }

  public pause(): void {
    if (this.phase !== 'PLAYING' && this.phase !== 'STARTING' && this.phase !== 'DYING') {
      return;
    }
    this.phaseBeforePause = this.phase;
    this.phase = 'PAUSED';
    this.isHoldingJump = false;
    this.duckHeld = false;
    this.stopLoop();
    this.render();
    this.emitSnapshot(true);
  }

  public resume(): void {
    if (this.phase !== 'PAUSED') return;
    this.phase = this.phaseBeforePause === 'DYING' ? 'DYING' : 'PLAYING';
    playGameSound('ui');
    this.emitSnapshot(true);
    this.startLoop();
  }

  public returnToStart(): void {
    this.stopLoop();
    this.phase = 'START';
    this.transitionProgress = 0;
    this.goTimer = 0;
    this.resetRunEntities();
    this.render();
    this.emitSnapshot(true);
  }

  public dispose(): void {
    this.disposed = true;
    this.stopLoop();
  }

  // Input handlers
  public pressJump(): void {
    if (this.phase !== 'PLAYING') return;
    this.isHoldingJump = true;
    this.jumpBufferTimer = JUMP_BUFFER_TIME;
    this.tryExecuteJump();
  }

  public releaseJump(): void {
    this.isHoldingJump = false;
    if (this.phase !== 'PLAYING') return;
    const minCutVy = -340 * this.getScale();
    if (this.runnerVy < minCutVy) {
      this.runnerVy = minCutVy;
    }
  }

  public setDuckHeld(held: boolean): void {
    if (held) {
      this.duckHeld = true;
      if (this.phase === 'PLAYING' && !this.onGround) {
        this.triggerFastFall();
      }
    } else {
      this.duckHeld = false;
    }
  }

  public triggerSwipeDuck(): void {
    if (this.phase !== 'PLAYING') return;
    if (this.duckCooldownTimer <= 0) {
      this.swipeDuckTimer = SWIPE_DUCK_DURATION;
    }
    if (!this.onGround) {
      this.triggerFastFall();
    }
  }

  private triggerFastFall(): void {
    this.isHoldingJump = false;
    const scale = this.getScale();
    this.runnerVy = Math.max(this.runnerVy, 720 * scale);
  }

  public activateCharge(): void {
    if (this.phase !== 'PLAYING') return;
    if (this.chargeTimer > 0 || this.chargeCoins < CHARGE_COINS_REQUIRED) return;

    this.chargeCoins = 0;
    this.chargeTimer = CHARGE_DURATION;
    this.seedSpeedLines();

    const scale = this.getScale();
    const rt = this.getRunnerTargetRect();
    const groundY = this.height * 0.68;

    this.spawnFloatingPopup(
      PLAY_COPY.chargePopup,
      rt.x + rt.w * 0.5,
      groundY + this.runnerYOffset - rt.h * 0.95,
      '#F2B24A'
    );

    if (this.freeUnlocks.has('coinBurst')) {
      this.spawnCoinBurst(
        rt.x + rt.w * 0.5,
        groundY + this.runnerYOffset - rt.h * 0.5,
        scale
      );
    }

    playGameSound('charge');
    this.emitSnapshot(true);
  }

  private tryExecuteJump(): void {
    if (!this.onGround && this.coyoteTimer <= 0) return;

    const scale = this.getScale();
    this.onGround = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.swipeDuckTimer = 0;
    if (this.wasDucking) {
      this.wasDucking = false;
      this.duckDurationTimer = 0;
      this.duckCooldownTimer = DUCK_COOLDOWN;
    }
    this.jumpHoldTimer = 0;
    this.runnerVy = JUMP_VY_REF * scale;
    this.squashTimer = 0;
    // Compression impulse on takeoff (+7px)
    this.riderSpringVy += 96;

    if (!this.firstJumpDone) {
      this.firstJumpDone = true;
      this.tapHintTimer = 0;
      markFirstJumpDone();
      this.emitSnapshot(true);
    }

    playGameSound('jump');
  }

  private resetRunEntities(): void {
    this.activeTier = loadHerdPass()?.tier ?? null;
    this.freeUnlocks = new Set(loadFreeUnlocks());
    this.dailyDate = getUtcDateString();

    if (this.isDailyRun) {
      this.runSeed = hashStringToSeed(`BULLRUN-DAILY-${this.dailyDate}-${this.locationId}`);
    } else {
      const rawSeed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
      this.runSeed = rawSeed || 123456;
    }

    this.runStartMinute = Math.floor(Date.now() / 60000);
    this.endedByCatch = false;
    this.weeklyBeatenThisRun = false;
    this.secondWindAvailable = Boolean(
      HERD_PERKS_ENABLED && hasTierPrivilege(this.activeTier, 'bull')
    );
    this.secondWindUsed = false;

    this.rng = createMulberry32(this.runSeed);
    this.selectorState = createPatternSelectorState();
    this.locationRenderer.resetMotion();

    this.runTime = 0;
    this.distanceNormPx = 0;
    this.distanceScore = 0;
    this.coinScore = 0;
    this.closeCallScore = 0;
    this.perfectScore = 0;
    this.score = 0;
    this.previousBestAtRunStart = this.bestScore;
    this.isNewBest = false;

    this.coinCount = 0;
    this.comboCount = 0;
    this.comboLevel = 1;
    this.comboTimer = 0;
    this.chargeCoins = 0;
    this.chargeTimer = 0;
    this.magnetTimer = 0;
    this.hasPickupShield = false;
    this.nextPowerupTimer = 30 + this.rng() * 10;
    this.pendingPowerup = null;
    this.nextArcGroupId = 1;
    this.arcTotalCounts.fill(0);
    this.arcCollectedCounts.fill(0);

    this.runnerState = 'run';
    this.runnerYOffset = 0;
    this.runnerVy = 0;
    this.onGround = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.isHoldingJump = false;
    this.jumpHoldTimer = 0;
    this.duckHeld = false;
    this.swipeDuckTimer = 0;
    this.wasDucking = false;
    this.duckDurationTimer = 0;
    this.duckCooldownTimer = 0;
    this.duckBlend = 0;
    this.fallbackLeanAngle = 0;
    this.squashTimer = 0;
    this.fallbackDustTimer = 0;
    this.hitStopTimer = 0;
    this.hitStunTimer = 0;
    this.hitSlowStatueTimer = 0;
    this.hitFlashTimer = 0;
    this.statueAnimPhase = 0;
    this.lastStatueFrame = 0;
    this.bearAnimPhase = 0;
    this.riderSpringY = 0;
    this.riderSpringVy = 0;
    this.riderAirLeanDeg = 0;
    this.hitJoltAngleDeg = 0;
    this.prevRiderPose = 'up';
    this.curRiderPose = 'up';
    this.riderPoseFade = 1;

    this.bearGap = 100;
    this.timeSinceLastHit = 99;
    this.bearGrowlPlayed = false;
    this.dyingTimer = 0;
    this.catchBearStartX = -100;
    this.rumbleTimer = 0;
    this.screenShakeTimer = 0;
    this.screenShakeAmp = 0;
    this.perfectSlowTimer = 0;
    this.cameraZoom = 1;
    this.candleTrailTimer = 0;
    this.bronzeStreakTimer = 0;
    this.afterimageTimer = 0;
    this.nextSpawnPx = 280;

    for (let i = 0; i < this.obstacles.length; i++) this.obstacles[i].active = false;
    for (let i = 0; i < this.coins.length; i++) this.coins[i].active = false;
    for (let i = 0; i < this.flyingCoins.length; i++) this.flyingCoins[i].active = false;
    for (let i = 0; i < this.popupRings.length; i++) this.popupRings[i].active = false;
    for (let i = 0; i < this.popups.length; i++) this.popups[i].active = false;
    for (let i = 0; i < this.dust.length; i++) this.dust[i].active = false;
    for (let i = 0; i < this.debris.length; i++) this.debris[i].active = false;
    for (let i = 0; i < this.speedLines.length; i++) this.speedLines[i].active = false;
    for (let i = 0; i < this.candleTrail.length; i++) this.candleTrail[i].active = false;
    for (let i = 0; i < this.burstCoins.length; i++) this.burstCoins[i].active = false;
    for (let i = 0; i < this.bronzeStreaks.length; i++) this.bronzeStreaks[i].active = false;
    for (let i = 0; i < this.afterimages.length; i++) this.afterimages[i].active = false;
  }

  private startLoop(): void {
    if (this.rafId !== null || this.disposed) return;
    this.lastFrameMs = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.loop);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (nowMs: number): void => {
    this.rafId = null;
    if (this.disposed) return;
    if (this.phase !== 'PLAYING' && this.phase !== 'DYING') return;

    const frameMs = nowMs - this.lastFrameMs;
    this.lastFrameMs = nowMs;

    if (this.maxDprCap > 1.5 && frameMs > 20 && frameMs < 200) {
      this.slowFrameTimer += frameMs / 1000;
      if (this.slowFrameTimer >= 2.0) {
        this.maxDprCap = 1.5;
        this.slowFrameTimer = 0;
        this.resize(true);
      }
    } else if (frameMs <= 20) {
      this.slowFrameTimer = Math.max(0, this.slowFrameTimer - 0.05);
    }

    const rawDt = Math.min(0.1, Math.max(0, frameMs / 1000));
    this.accumulator += rawDt;

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_ACCUM_STEPS) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps >= MAX_ACCUM_STEPS) {
      this.accumulator = 0;
    }

    this.render();
    this.emitSnapshot(false);

    if (this.phase === 'PLAYING' || this.phase === 'DYING') {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };

  private computeBearX(metrics: { leftX: number; drawW: number; targetRunnerHeight: number }): number {
    const scale = this.getScale();
    const bearH =
      this.art.layeredBearReady && this.art.bearConfig
        ? (0.85 * metrics.targetRunnerHeight / this.art.bearConfig.avgH) * this.art.bearConfig.fh
        : Math.min(200, Math.max(105, this.height * 0.19));
    const aspect =
      this.art.layeredBearReady && this.art.bearConfig
        ? this.art.bearConfig.fw / this.art.bearConfig.fh
        : this.art.fallbackBear
        ? this.art.fallbackBear.box.w / this.art.fallbackBear.box.h
        : 800 / 624;
    const bearW = bearH * aspect;

    if (this.bearGap >= 30) {
      const t = clamp((45 - this.bearGap) / 15, 0, 1);
      return (-0.95 + 0.35 * t) * bearW;
    }
    if (this.bearGap >= 15) {
      const t = clamp((30 - this.bearGap) / 15, 0, 1);
      return (-0.6 + 0.4 * t) * bearW;
    }
    const t = clamp((15 - this.bearGap) / 15, 0, 1);
    const caughtX = metrics.leftX + metrics.drawW * 0.22 - bearW + 4 * scale;
    return -0.2 * bearW + (caughtX + 0.2 * bearW) * t;
  }

  private step(baseDt: number): void {
    const scale = this.getScale();
    const groundY = this.height * 0.68;
    const metrics = this.getRunnerMetrics();
    const locCfg = getLocationConfig(this.locationId);

    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer = Math.max(0, this.screenShakeTimer - baseDt);
    }
    if (this.rumbleTimer > 0) {
      this.rumbleTimer = Math.max(0, this.rumbleTimer - baseDt);
    }
    if (this.locationBannerTimer > 0) {
      this.locationBannerTimer = Math.max(0, this.locationBannerTimer - baseDt);
    }

    if (this.phase === 'DYING') {
      this.dyingTimer += baseDt;
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - baseDt);
      this.updateParticles(baseDt, scale, groundY);
      if (this.dyingTimer >= DYING_DURATION) {
        this.phase = 'GAME_OVER';
        this.stopLoop();
        this.render();
        this.emitSnapshot(true);
      }
      return;
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - baseDt);
      return;
    }

    let dt = baseDt;
    if (this.perfectSlowTimer > 0) {
      this.perfectSlowTimer = Math.max(0, this.perfectSlowTimer - baseDt);
      dt = baseDt * 0.7;
    }

    this.runTime += dt;
    if (this.goTimer > 0) this.goTimer = Math.max(0, this.goTimer - dt);
    if (this.tapHintTimer > 0) this.tapHintTimer = Math.max(0, this.tapHintTimer - dt);
    if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    if (this.hitStunTimer > 0) this.hitStunTimer = Math.max(0, this.hitStunTimer - dt);
    if (this.hitSlowStatueTimer > 0) this.hitSlowStatueTimer = Math.max(0, this.hitSlowStatueTimer - dt);
    if (this.squashTimer > 0) this.squashTimer = Math.max(0, this.squashTimer - dt);
    if (this.swipeDuckTimer > 0) this.swipeDuckTimer = Math.max(0, this.swipeDuckTimer - dt);
    if (this.duckCooldownTimer > 0) this.duckCooldownTimer = Math.max(0, this.duckCooldownTimer - dt);

    const isCharging = this.chargeTimer > 0;
    if (isCharging) {
      this.chargeTimer = Math.max(0, this.chargeTimer - dt);
      this.updateSpeedLines(dt);
    }
    if (this.magnetTimer > 0) {
      this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    }

    if (!this.pendingPowerup) {
      this.nextPowerupTimer -= dt;
      if (this.nextPowerupTimer <= 0) {
        this.pendingPowerup = this.rng() < 0.5 ? 'magnet' : 'shield';
        this.nextPowerupTimer = 30 + this.rng() * 10;
      }
    }

    if (this.comboCount > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboLevel = 1;
        this.comboTimer = 0;
      }
    }

    this.timeSinceLastHit += dt;
    if (this.timeSinceLastHit >= BEAR_REGROW_DELAY && this.bearGap < 100) {
      this.bearGap = Math.min(100, this.bearGap + BEAR_REGEN_PER_SEC * locCfg.bearRegrowthMult * dt);
    }

    if (this.bearGap < 45) {
      if (!this.bearGrowlPlayed) {
        this.bearGrowlPlayed = true;
        playGameSound('growl');
      }
      if (
        !this.prefersReducedMotion &&
        this.rumbleTimer <= 0 &&
        Math.floor(this.runTime * 3) !== Math.floor((this.runTime - dt) * 3)
      ) {
        this.rumbleTimer = 0.08;
      }
    } else {
      this.bearGrowlPlayed = false;
    }

    const speedProgress = Math.min(1, this.runTime / SPEED_RAMP_SECONDS);
    let effectiveRefSpeed =
      (MIN_SPEED_REF + (MAX_SPEED_REF - MIN_SPEED_REF) * speedProgress) * locCfg.speedMult;
    if (isCharging) {
      effectiveRefSpeed *= 1.2;
    } else if (this.hitStunTimer > 0) {
      effectiveRefSpeed *= 0.68;
    }
    const worldSpeed = effectiveRefSpeed * scale;

    if (effectiveRefSpeed > 600 && !isCharging && !this.prefersReducedMotion) {
      this.ensureAmbientSpeedLines();
      this.updateSpeedLines(dt);
    }

    const targetZoom = this.prefersReducedMotion
      ? 1
      : isCharging
      ? 1.08
      : 1.0 - 0.06 * speedProgress;
    this.cameraZoom += (targetZoom - this.cameraZoom) * Math.min(1, dt * 8);

    this.locationRenderer.update(
      dt,
      this.locationId,
      worldSpeed,
      this.width,
      groundY,
      scale,
      this.prefersReducedMotion
    );

    this.distanceNormPx += effectiveRefSpeed * dt;
    this.distanceScore = Math.floor(this.distanceNormPx / 10);
    this.score = this.distanceScore + this.coinScore + this.closeCallScore + this.perfectScore;

    if (this.score > this.bestScore) {
      this.bestScore = saveBestScore(this.score);
      this.freeUnlocks = new Set(syncFreeUnlocks(this.bestScore));
      if (this.previousBestAtRunStart > 0 || this.score > 0) {
        this.isNewBest = this.score > this.previousBestAtRunStart;
      }
    }
    if (!this.weeklyBeatenThisRun && this.score >= WEEKLY_CHALLENGE.target) {
      this.weeklyBeatenThisRun = true;
      recordWeeklyScore(WEEKLY_CHALLENGE.week, this.score, WEEKLY_CHALLENGE.target);
    }

    if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    if (this.onGround) {
      this.coyoteTimer = COYOTE_TIME;
      if (this.jumpBufferTimer > 0) {
        this.tryExecuteJump();
      }
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    // Vertical physics
    if (!this.onGround) {
      let g = GRAVITY_REF * scale;
      if (this.duckHeld || this.swipeDuckTimer > 0) {
        g *= 2.4;
      } else if (this.isHoldingJump && this.jumpHoldTimer < JUMP_HOLD_MAX && this.runnerVy < 0) {
        this.jumpHoldTimer += dt;
        g *= 0.42;
      }
      this.runnerVy += g * dt;
      this.runnerYOffset += this.runnerVy * dt;

      if (this.runnerYOffset >= 0) {
        this.runnerYOffset = 0;
        this.runnerVy = 0;
        this.onGround = true;
        this.squashTimer = 0.08;
        // Landing squash impulse (+8px, rebound)
        this.riderSpringVy += 110;
        playGameSound('land');
        if (!this.prefersReducedMotion && !this.art.layeredRunnerReady) {
          this.spawnDust(metrics.leftX + metrics.drawW * 0.25, groundY, scale);
          this.spawnDust(metrics.leftX + metrics.drawW * 0.72, groundY, scale);
        }
        if (this.jumpBufferTimer > 0) {
          this.tryExecuteJump();
        }
      }
    }

    // Duck state with 700ms hold limit & 250ms cooldown
    const wantsDuck = this.onGround && (this.duckHeld || this.swipeDuckTimer > 0);
    let isDucking = false;
    if (wantsDuck && this.duckCooldownTimer <= 0) {
      this.duckDurationTimer += dt;
      if (this.duckDurationTimer >= DUCK_HOLD_MAX) {
        isDucking = false;
        this.duckDurationTimer = 0;
        this.swipeDuckTimer = 0;
        this.duckHeld = false;
        this.duckCooldownTimer = DUCK_COOLDOWN;
      } else {
        isDucking = true;
      }
    } else if (this.wasDucking) {
      this.duckDurationTimer = 0;
      this.duckCooldownTimer = DUCK_COOLDOWN;
    }
    this.wasDucking = isDucking;

    const duckStep = dt / 0.09;
    this.duckBlend = isDucking
      ? Math.min(1, this.duckBlend + duckStep)
      : Math.max(0, this.duckBlend - duckStep);

    // Runner State machine
    if (isCharging) {
      this.runnerState = 'charge';
    } else if (this.hitStunTimer > 0) {
      this.runnerState = 'hit';
    } else if (!this.onGround) {
      this.runnerState = this.runnerVy < 0 ? 'jumpRise' : 'jumpFall';
    } else if (isDucking) {
      this.runnerState = 'duck';
    } else {
      this.runnerState = 'run';
    }

    // Statue gait cycle & dust puffs on contact frames (0, 5, 10, 15)
    const speedFactor = clamp(effectiveRefSpeed / 340, 0.85, 2.0);
    const rateMult =
      (this.onGround ? 1 : 0.3) *
      (isCharging ? 1.25 : 1) *
      (this.hitSlowStatueTimer > 0 ? 0.5 : 1);

    const statueCfg = this.art.statueConfig;
    const baseStatueFps = statueCfg ? statueCfg.fps : 9;
    const effectiveStatueFps = baseStatueFps * speedFactor * rateMult;
    const frameCount = statueCfg && statueCfg.frames > 0 ? statueCfg.frames : 20;

    this.statueAnimPhase = (this.statueAnimPhase + dt * effectiveStatueFps) % frameCount;
    const curStatueFrame = Math.floor(this.statueAnimPhase) % frameCount;

    if (this.art.layeredRunnerReady && statueCfg && this.onGround && !this.prefersReducedMotion) {
      if (curStatueFrame !== this.lastStatueFrame) {
        const hoofX = statueCfg.hoofX ?? [0.18, 0.72];
        const avgScaledW = statueCfg.avgW * metrics.runnerScale;
        let check = (this.lastStatueFrame + 1) % frameCount;
        for (let guard = 0; guard < 4; guard++) {
          if (check === 0 || check === 10) {
            this.spawnDust(metrics.leftX + avgScaledW * hoofX[0], groundY, scale);
          } else if (check === 5 || check === 15) {
            this.spawnDust(metrics.leftX + avgScaledW * hoofX[1], groundY, scale);
          }
          if (check === curStatueFrame) break;
          check = (check + 1) % frameCount;
        }
      }
    } else if (!this.art.layeredRunnerReady && this.onGround && !this.prefersReducedMotion) {
      this.fallbackDustTimer += dt;
      if (this.fallbackDustTimer >= DUST_INTERVAL_FALLBACK) {
        this.fallbackDustTimer -= DUST_INTERVAL_FALLBACK;
        this.spawnDust(metrics.leftX + metrics.drawW * 0.18, groundY, scale);
        this.spawnDust(metrics.leftX + metrics.drawW * 0.72, groundY, scale);
      }
    } else {
      this.fallbackDustTimer = 0;
    }
    this.lastStatueFrame = curStatueFrame;

    // Bear gait phase
    const bearCfg = this.art.bearConfig;
    const bearFps = bearCfg ? bearCfg.fps : 12;
    const bearFrames = bearCfg && bearCfg.frames > 0 ? bearCfg.frames : 15;
    this.bearAnimPhase = (this.bearAnimPhase + dt * bearFps * speedFactor) % bearFrames;

    // 2nd-order Rider Spring: oy'' = -k*oy - c*oy' - 0.55*a
    const k = this.animTune.springK;
    const c = this.animTune.springC;
    const smoothD2 =
      this.art.layeredRunnerReady && curStatueFrame < this.art.saddleAccelSmooth.length
        ? this.art.saddleAccelSmooth[curStatueFrame]
        : 0;
    // Scale saddle second-difference acceleration cleanly into px/s^2
    const saddleAccel = isDucking
      ? 0
      : clamp(smoothD2 * effectiveStatueFps * effectiveStatueFps * metrics.runnerScale, -3200, 3200);
    const springAcc = -k * this.riderSpringY - c * this.riderSpringVy - 0.55 * saddleAccel;
    this.riderSpringVy += springAcc * dt;
    this.riderSpringY += this.riderSpringVy * dt;

    // Air lean (-6deg rising, +5deg falling) + Hit jolt angle (+8deg decaying over 450ms)
    const targetAirLeanDeg = !this.onGround ? (this.runnerVy < 0 ? -6 : 5) : 0;
    this.riderAirLeanDeg += (targetAirLeanDeg - this.riderAirLeanDeg) * Math.min(1, dt * 16);
    if (this.hitStunTimer <= 0) {
      this.hitJoltAngleDeg += (0 - this.hitJoltAngleDeg) * Math.min(1, dt * 14);
    } else {
      const decay = this.hitStunTimer / HIT_STUN_DURATION;
      this.hitJoltAngleDeg = 8 * decay;
    }

    // Rider pose & 120ms crossfade
    const nextPose: RiderPoseKey =
      this.runnerState === 'charge'
        ? 'charge'
        : this.runnerState === 'hit'
        ? 'hit'
        : this.runnerState === 'duck'
        ? 'duck'
        : 'up';
    if (nextPose !== this.curRiderPose) {
      this.prevRiderPose = this.curRiderPose;
      this.curRiderPose = nextPose;
      this.riderPoseFade = 0;
    } else if (this.riderPoseFade < 1) {
      this.riderPoseFade = Math.min(1, this.riderPoseFade + dt / 0.12);
    }

    // Fallback single-sprite lean
    let targetFallbackLean = 0;
    if (!this.onGround) {
      targetFallbackLean = this.runnerVy < 0 ? (-8 * Math.PI) / 180 : (6 * Math.PI) / 180;
    } else if (this.duckBlend > 0.05) {
      targetFallbackLean = ((5 * Math.PI) / 180) * this.duckBlend;
    } else {
      targetFallbackLean = Math.cos(this.runTime * 9 * Math.PI * 2) * ((1.5 * Math.PI) / 180);
    }
    this.fallbackLeanAngle += (targetFallbackLean - this.fallbackLeanAngle) * Math.min(1, dt * 16);

    // Charge 3 afterimages at 30% opacity
    const totalRiderDeg = this.riderSpringY * 0.12 + this.riderAirLeanDeg + this.hitJoltAngleDeg;
    if (isCharging && !this.prefersReducedMotion) {
      this.afterimageTimer += dt;
      if (this.afterimageTimer >= 0.045) {
        this.afterimageTimer = 0;
        const slot = this.afterimages[this.afterimageHead % this.afterimages.length];
        this.afterimageHead++;
        slot.active = true;
        slot.x = metrics.leftX;
        slot.y = groundY + this.runnerYOffset;
        slot.w = metrics.drawW;
        slot.h = metrics.targetRunnerHeight;
        slot.alpha = 0.3;
        slot.life = 0.16;
        slot.statueFrame = curStatueFrame;
        slot.oy = this.riderSpringY;
        slot.angleRad = (totalRiderDeg * Math.PI) / 180;
      }
    }
    for (let i = 0; i < this.afterimages.length; i++) {
      const a = this.afterimages[i];
      if (!a.active) continue;
      a.x -= worldSpeed * 0.55 * dt;
      a.life -= dt;
      a.alpha = Math.max(0, (a.life / 0.16) * 0.3);
      if (a.life <= 0) a.active = false;
    }

    // Green-candle & Bronze streak unlock trails
    if (
      !this.prefersReducedMotion &&
      (this.freeUnlocks.has('greenCandle') || hasTierPrivilege(this.activeTier, 'alpha'))
    ) {
      this.candleTrailTimer += dt;
      if (this.candleTrailTimer >= 0.095) {
        this.candleTrailTimer -= 0.095;
        this.spawnCandleTrail(
          metrics.leftX + metrics.drawW * 0.14,
          groundY + this.runnerYOffset - metrics.targetRunnerHeight * 0.34,
          worldSpeed,
          scale
        );
      }
    }
    if (!this.prefersReducedMotion && this.freeUnlocks.has('bronzeStreak')) {
      this.bronzeStreakTimer += dt;
      if (this.bronzeStreakTimer >= 0.08) {
        this.bronzeStreakTimer -= 0.08;
        this.spawnBronzeStreak(
          metrics.leftX + metrics.drawW * 0.25,
          groundY + this.runnerYOffset - metrics.targetRunnerHeight * (0.2 + Math.random() * 0.58),
          worldSpeed,
          scale
        );
      }
    }

    this.updateParticles(dt, scale, groundY);

    // Spawner
    this.nextSpawnPx -= worldSpeed * dt;
    if (this.nextSpawnPx <= 0) {
      this.spawnNextPattern(worldSpeed, scale, groundY, metrics.targetRunnerHeight, speedProgress);
    }

    // Runner Hitbox: 40% total width, 55% total height centered low (drops to 45% when ducking)
    const hbW = metrics.drawW * 0.4;
    const hbLeft = this.width * 0.36 - hbW * 0.5;
    const hbRight = hbLeft + hbW;
    const hbBottom = groundY + this.runnerYOffset;
    const hbFrac = 0.55 - 0.1 * this.duckBlend;
    const hbTop = hbBottom - metrics.targetRunnerHeight * hbFrac;

    // Move & collide obstacles
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (!obs.active) continue;

      const obsMove = worldSpeed * (1 + obs.speedBonus) * dt;
      obs.x -= obsMove;
      if (obs.kind === 'wreckingBall') {
        obs.swingPhase += (dt * Math.PI * 2) / 1.4;
      }

      if (obs.x + obs.w < -110) {
        obs.active = false;
        continue;
      }

      let curX = obs.x;
      let curY = obs.y;
      if (obs.kind === 'wreckingBall') {
        const swingAng = Math.sin(obs.swingPhase) * 0.26;
        const cx = obs.x + obs.w * 0.5 + Math.sin(swingAng) * obs.ropeLen * 0.45;
        const cy = obs.pivotY + Math.cos(swingAng) * obs.ropeLen;
        curX = cx - obs.w * 0.5;
        curY = cy - obs.h * 0.5;
      }

      const insetX = Math.min(6, obs.w * 0.12);
      const insetY = Math.min(5, obs.h * 0.12);
      const obsLeft = curX + insetX;
      const obsRight = curX + obs.w - insetX;
      const obsTop = curY + insetY;
      const obsBottom = curY + obs.h - insetY;

      if (!obs.hit) {
        if (hbRight > obsLeft && hbLeft < obsRight && hbBottom > obsTop && hbTop < obsBottom) {
          obs.hit = true;
          this.comboCount = 0;
          this.comboLevel = 1;
          this.comboTimer = 0;

          if (isCharging) {
            obs.active = false;
            this.shatterObstacle(obs, curX, curY, scale);
            playGameSound('hit');
          } else if (this.hasPickupShield) {
            this.hasPickupShield = false;
            obs.active = false;
            this.shatterObstacle(obs, curX, curY, scale);
            this.hitFlashTimer = 0.28;
            playGameSound('hit');
            this.emitSnapshot(true);
          } else if (this.secondWindAvailable) {
            this.secondWindAvailable = false;
            this.secondWindUsed = true;
            obs.active = false;
            this.shatterObstacle(obs, curX, curY, scale);
            this.hitFlashTimer = 0.35;
            playGameSound('hit');
            this.emitSnapshot(true);
          } else {
            this.bearGap = Math.max(0, this.bearGap - BEAR_HIT_COST);
            this.timeSinceLastHit = 0;
            this.hitStopTimer = HIT_STOP_DURATION;
            this.hitStunTimer = HIT_STUN_DURATION;
            this.hitSlowStatueTimer = HIT_SLOW_STATUE_DURATION;
            this.hitFlashTimer = 0.28;
            // Hit jolt impulse: -10px upward & +8deg
            this.riderSpringVy -= 136;
            this.hitJoltAngleDeg = 8;
            obs.active = false;
            this.shatterObstacle(obs, curX, curY, scale);
            if (!this.prefersReducedMotion) {
              this.screenShakeTimer = 0.2;
              this.screenShakeAmp = 6;
            }
            playGameSound('hit');

            if (this.bearGap <= 0) {
              this.triggerCaught(metrics);
              return;
            }
          }
        } else if (!obs.closeChecked && obsRight < hbLeft && obsRight > hbLeft - 24 * scale) {
          obs.closeChecked = true;
          const vGap = obs.isOverhead ? hbTop - obsBottom : obsTop - hbBottom;
          if (vGap >= 0 && vGap <= 24 * scale) {
            this.closeCallScore += 25;
            this.spawnFloatingPopup(
              PLAY_COPY.closePopup,
              this.width * 0.36,
              groundY + this.runnerYOffset - metrics.targetRunnerHeight * 0.9,
              '#E8DFC9'
            );
          }
        }
      }
    }

    // Move, magnetize & collect coins/powerups
    const runnerCx = this.width * 0.36;
    const runnerCy = groundY + this.runnerYOffset - metrics.targetRunnerHeight * 0.45;
    const magnetRadius = MAGNET_RADIUS_REF * scale;
    const magnetActive = this.magnetTimer > 0;
    const hudTargetX = Math.max(70, this.width * 0.25);
    const hudTargetY = Math.max(24, this.height * 0.055);

    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      if (!c.active) continue;

      if (magnetActive && (c.kind === 'coin' || c.kind === 'goldBar')) {
        const dx = runnerCx - c.x;
        const dy = runnerCy - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1 && dist < magnetRadius) {
          const pull = (580 + (1 - dist / magnetRadius) * 420) * scale;
          c.x += (dx / dist) * pull * dt;
          c.y += (dy / dist) * pull * dt;
        } else {
          c.x -= worldSpeed * dt;
        }
      } else {
        c.x -= worldSpeed * dt;
      }

      c.spinPhase += dt * 5.2;
      if (c.x + c.r < -40) {
        c.active = false;
        continue;
      }

      if (!c.collected) {
        const pickLeft = hbLeft - c.r * 0.45;
        const pickRight = hbRight + c.r * 0.45;
        const pickTop = hbBottom - metrics.targetRunnerHeight * 0.72 - c.r * 0.65;
        const pickBottom = hbBottom;

        if (c.x + c.r > pickLeft && c.x - c.r < pickRight && c.y + c.r > pickTop && c.y - c.r < pickBottom) {
          c.collected = true;
          c.active = false;

          if (c.kind === 'magnet') {
            this.magnetTimer = MAGNET_DURATION;
            this.spawnPopupRing(c.x, c.y, '#2FD27A');
            this.spawnFloatingPopup(PLAY_COPY.magnetPopup, c.x, c.y - 14 * scale, '#2FD27A');
            playGameSound('pickup');
            this.emitSnapshot(true);
            continue;
          }

          if (c.kind === 'shield') {
            this.hasPickupShield = true;
            this.spawnPopupRing(c.x, c.y, '#F2B24A');
            this.spawnFloatingPopup(PLAY_COPY.shieldPopup, c.x, c.y - 14 * scale, '#F2B24A');
            playGameSound('pickup');
            this.emitSnapshot(true);
            continue;
          }

          const isGoldBar = c.kind === 'goldBar';
          const valueCoins = isGoldBar ? 10 : 1;
          this.coinCount += valueCoins;

          if (this.comboTimer > 0) {
            this.comboCount += 1;
          } else {
            this.comboCount = 1;
          }
          this.comboTimer = COMBO_WINDOW;
          const nextComboLevel = Math.min(5, 1 + Math.floor(this.comboCount / 5));
          if (nextComboLevel > this.comboLevel) {
            this.comboLevel = nextComboLevel;
            this.spawnFloatingPopup(
              `x${this.comboLevel}`,
              runnerCx + 12 * scale,
              groundY + this.runnerYOffset - metrics.targetRunnerHeight * 0.96,
              '#F2B24A'
            );
            playGameSound('combo');
          } else {
            playGameSound('coin');
          }

          this.coinScore += 10 * valueCoins * this.comboLevel;
          this.bearGap = Math.min(100, this.bearGap + BEAR_COIN_GAIN * (isGoldBar ? 3 : 1));

          if (this.chargeTimer <= 0 && this.chargeCoins < CHARGE_COINS_REQUIRED) {
            this.chargeCoins = Math.min(CHARGE_COINS_REQUIRED, this.chargeCoins + valueCoins);
          }

          this.spawnPopupRing(c.x, c.y, isGoldBar ? '#2FD27A' : '#F2B24A');
          this.spawnFlyingCoin(c.x, c.y, hudTargetX, hudTargetY, isGoldBar);
          try {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              navigator.vibrate(8);
            }
          } catch {
            // Ignore
          }

          if (c.arcGroupId > 0) {
            this.arcCollectedCounts[c.arcGroupId] += 1;
            const total = this.arcTotalCounts[c.arcGroupId];
            if (total >= 3 && this.arcCollectedCounts[c.arcGroupId] === total) {
              this.arcTotalCounts[c.arcGroupId] = 0;
              this.perfectScore += 100;
              this.perfectSlowTimer = 0.25;
              this.spawnFloatingPopup(PLAY_COPY.perfectPopup, c.x, c.y - 18 * scale, '#2FD27A');
              playGameSound('combo');
            }
          }
        }
      }
    }
  }

  private triggerCaught(metrics: { leftX: number; drawW: number; targetRunnerHeight: number }): void {
    this.phase = 'DYING';
    this.dyingTimer = 0;
    this.endedByCatch = true;
    this.isHoldingJump = false;
    this.duckHeld = false;
    this.runnerState = 'hit';
    this.curRiderPose = 'hit';
    this.riderPoseFade = 1;
    this.catchBearStartX = this.computeBearX(metrics);
    recordWeeklyScore(WEEKLY_CHALLENGE.week, this.score, WEEKLY_CHALLENGE.target);
    if (!this.prefersReducedMotion) {
      this.screenShakeTimer = 0.2;
      this.screenShakeAmp = 6;
    }
    playGameSound('caught');
    this.emitSnapshot(true);
  }

  private spawnNextPattern(
    worldSpeed: number,
    scale: number,
    groundY: number,
    runnerH: number,
    speedProgress: number
  ): void {
    const locCfg = getLocationConfig(this.locationId);
    const chosen = pickNextPattern(
      this.selectorState,
      this.runTime,
      locCfg.overheadWeightMult,
      locCfg.coinWeightMult,
      () => this.rng()
    );

    const startX = this.width + 52;
    this.buildCtx.startX = startX;
    this.buildCtx.groundY = groundY;
    this.buildCtx.scale = scale;
    this.buildCtx.worldSpeed = worldSpeed;
    this.buildCtx.runnerH = runnerH;

    const patternSpanPx = chosen.build(this.buildCtx);

    if (chosen.hasWreckingBall) {
      playGameSound('wreck');
    } else if (chosen.type === 'overhead') {
      playGameSound('banner');
    }

    const timeGapSec = 1.15 - (1.15 - 0.65) * speedProgress;
    const minGapPx = worldSpeed * timeGapSec;
    const extraGapPx = worldSpeed * (0.08 + this.rng() * 0.24);
    const totalGapPx = minGapPx + extraGapPx;

    if (this.pendingPowerup) {
      const puKind = this.pendingPowerup;
      this.pendingPowerup = null;
      this.allocCoin(
        startX + patternSpanPx + totalGapPx * 0.5,
        groundY - 78 * scale,
        puKind,
        15 * scale,
        0,
        -1
      );
    }

    this.nextSpawnPx = patternSpanPx + totalGapPx;
  }

  private allocObstacle(
    kind: ObstacleKind,
    x: number,
    y: number,
    w: number,
    h: number,
    isOverhead: boolean,
    opts?: { wickTopH?: number; pivotY?: number; ropeLen?: number; speedBonus?: number }
  ): void {
    for (let i = 0; i < this.obstacles.length; i++) {
      const o = this.obstacles[i];
      if (!o.active) {
        o.active = true;
        o.kind = kind;
        o.isOverhead = isOverhead;
        o.x = x;
        o.y = y;
        o.w = w;
        o.h = h;
        o.wickTopH = opts?.wickTopH ?? 0;
        o.pivotY = opts?.pivotY ?? 0;
        o.ropeLen = opts?.ropeLen ?? 0;
        o.swingPhase = 0;
        o.speedBonus = opts?.speedBonus ?? 0;
        o.hit = false;
        o.closeChecked = false;
        return;
      }
    }
  }

  private allocCoin(
    x: number,
    y: number,
    kind: CoinItemKind,
    r: number,
    spinPhase: number,
    arcGroupId: number
  ): void {
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      if (!c.active) {
        c.active = true;
        c.kind = kind;
        c.x = x;
        c.y = y;
        c.r = Math.max(10, r);
        c.collected = false;
        c.spinPhase = spinPhase;
        c.arcGroupId = arcGroupId;
        if (arcGroupId > 0) {
          this.arcTotalCounts[arcGroupId] += 1;
        }
        return;
      }
    }
  }

  private spawnFlyingCoin(
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    isGoldBar: boolean
  ): void {
    if (this.prefersReducedMotion) {
      this.counterBumpKey += 1;
      return;
    }
    for (let i = 0; i < this.flyingCoins.length; i++) {
      const fc = this.flyingCoins[i];
      if (!fc.active) {
        fc.active = true;
        fc.startX = sx;
        fc.startY = sy;
        fc.endX = ex;
        fc.endY = ey;
        fc.ctrlX = (sx + ex) * 0.5 - 32;
        fc.ctrlY = Math.min(sy, ey) - 65;
        fc.t = 0;
        fc.duration = 0.35;
        fc.isGoldBar = isGoldBar;
        return;
      }
    }
  }

  private spawnPopupRing(x: number, y: number, color: string): void {
    if (this.prefersReducedMotion) return;
    for (let i = 0; i < this.popupRings.length; i++) {
      const r = this.popupRings[i];
      if (!r.active) {
        r.active = true;
        r.x = x;
        r.y = y;
        r.maxR = 26 * this.getScale();
        r.life = 0;
        r.maxLife = 0.24;
        r.color = color;
        return;
      }
    }
  }

  private spawnFloatingPopup(text: string, x: number, y: number, color: string): void {
    for (let i = 0; i < this.popups.length; i++) {
      const p = this.popups[i];
      if (!p.active) {
        p.active = true;
        p.text = text;
        p.x = x;
        p.y = y;
        p.vy = -56 * this.getScale();
        p.color = color;
        p.life = 0;
        p.maxLife = 0.72;
        return;
      }
    }
  }

  private spawnDust(x: number, y: number, scale: number): void {
    const hasGoldDust = hasTierPrivilege(this.activeTier, 'herd');
    const hasBronzeDust = this.freeUnlocks.has('bronzeDust');
    const fillColor = hasGoldDust
      ? '#F2B24A'
      : hasBronzeDust
      ? '#C97B1A'
      : '#E8DFC9';

    for (let i = 0; i < this.dust.length; i++) {
      const d = this.dust[i];
      if (!d.active) {
        d.active = true;
        d.x = x + (Math.random() - 0.5) * 6 * scale;
        d.y = y - 3 * scale;
        d.vx = -(75 + Math.random() * 80) * scale;
        d.vy = -(22 + Math.random() * 38) * scale;
        d.size = (6 + Math.random() * 4) * scale;
        d.life = 0;
        d.maxLife = DUST_LIFE;
        d.fillColor = fillColor;
        return;
      }
    }
  }

  private spawnCandleTrail(x: number, y: number, worldSpeed: number, scale: number): void {
    for (let i = 0; i < this.candleTrail.length; i++) {
      const c = this.candleTrail[i];
      if (!c.active) {
        c.active = true;
        c.x = x;
        c.y = y + (Math.random() - 0.5) * 20 * scale;
        c.vx = -worldSpeed * 0.88;
        c.w = (8 + Math.random() * 4) * scale;
        c.h = (16 + Math.random() * 14) * scale;
        c.life = 0;
        c.maxLife = 0.42;
        return;
      }
    }
  }

  private spawnCoinBurst(cx: number, cy: number, scale: number): void {
    if (this.prefersReducedMotion) return;
    let spawned = 0;
    const total = 12;
    for (let i = 0; i < this.burstCoins.length && spawned < total; i++) {
      const bc = this.burstCoins[i];
      if (!bc.active) {
        const angle = (spawned / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const speed = (220 + Math.random() * 200) * scale;
        bc.active = true;
        bc.x = cx;
        bc.y = cy;
        bc.vx = Math.cos(angle) * speed;
        bc.vy = Math.sin(angle) * speed - 90 * scale;
        bc.r = Math.max(6, 8 * scale);
        bc.life = 0;
        bc.maxLife = 0.58 + Math.random() * 0.15;
        spawned++;
      }
    }
  }

  private spawnBronzeStreak(x: number, y: number, worldSpeed: number, scale: number): void {
    for (let i = 0; i < this.bronzeStreaks.length; i++) {
      const s = this.bronzeStreaks[i];
      if (!s.active) {
        s.active = true;
        s.x = x;
        s.y = y;
        s.len = (34 + Math.random() * 48) * scale;
        s.speed = worldSpeed * 1.15;
        s.thickness = Math.max(2, Math.round(3 * scale));
        s.color = '#C97B1A';
        return;
      }
    }
  }

  private shatterObstacle(obs: Obstacle, curX: number, curY: number, scale: number): void {
    if (this.prefersReducedMotion) return;
    const colors =
      obs.kind === 'candle'
        ? ['#C23B22', '#E8DFC9', '#942919']
        : obs.kind === 'bearTrap' || obs.kind === 'wreckingBall'
        ? ['#6B7480', '#383E46', '#0E0D0C']
        : obs.kind === 'banner' || obs.kind === 'paperPlanes'
        ? ['#E8DFC9', '#C23B22', '#C97B1A']
        : ['#B5472B', '#A23D25', '#BF5233'];

    let spawned = 0;
    for (let i = 0; i < this.debris.length && spawned < 10; i++) {
      const p = this.debris[i];
      if (!p.active) {
        p.active = true;
        p.x = curX + Math.random() * obs.w;
        p.y = curY + Math.random() * obs.h;
        p.vx = (240 + Math.random() * 400) * scale;
        p.vy = -(160 + Math.random() * 320) * scale;
        p.w = (8 + Math.random() * 8) * scale;
        p.h = (5 + Math.random() * 6) * scale;
        p.rot = Math.random() * Math.PI;
        p.vRot = (Math.random() - 0.5) * 18;
        p.color = colors[spawned % colors.length];
        p.life = 0;
        p.maxLife = 0.55 + Math.random() * 0.25;
        spawned++;
      }
    }
  }

  private seedSpeedLines(): void {
    for (let i = 0; i < this.speedLines.length; i++) {
      const l = this.speedLines[i];
      l.active = true;
      l.x = Math.random() * this.width;
      l.y = Math.random() * (this.height * 0.68);
      l.len = 60 + Math.random() * 140;
      l.speed = 1100 + Math.random() * 900;
      l.thickness = i % 3 === 0 ? 3 : 2;
      l.color = i % 2 === 0 ? '#E8DFC9' : '#C97B1A';
    }
  }

  private ensureAmbientSpeedLines(): void {
    let anyActive = false;
    for (let i = 0; i < this.speedLines.length; i++) {
      if (this.speedLines[i].active) {
        anyActive = true;
        break;
      }
    }
    if (!anyActive) {
      for (let i = 0; i < 8; i++) {
        const l = this.speedLines[i];
        l.active = true;
        l.x = Math.random() * this.width;
        l.y = Math.random() * (this.height * 0.65);
        l.len = 40 + Math.random() * 80;
        l.speed = 1100 + Math.random() * 700;
        l.thickness = 2;
        l.color = 'rgba(232, 223, 201, 0.35)';
      }
    }
  }

  private updateSpeedLines(dt: number): void {
    for (let i = 0; i < this.speedLines.length; i++) {
      const l = this.speedLines[i];
      if (!l.active) continue;
      l.x -= l.speed * dt;
      if (l.x + l.len < 0) {
        l.x = this.width + Math.random() * 120;
        l.y = Math.random() * (this.height * 0.66);
      }
    }
  }

  private updateParticles(dt: number, scale: number, groundY: number): void {
    for (let i = 0; i < this.dust.length; i++) {
      const d = this.dust[i];
      if (!d.active) continue;
      d.life += dt;
      if (d.life >= d.maxLife) {
        d.active = false;
        continue;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }

    for (let i = 0; i < this.debris.length; i++) {
      const p = this.debris[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.vy += 1400 * scale * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vRot * dt;
      if (p.y > groundY) {
        p.y = groundY;
        p.vy *= -0.35;
      }
    }

    for (let i = 0; i < this.candleTrail.length; i++) {
      const c = this.candleTrail[i];
      if (!c.active) continue;
      c.life += dt;
      if (c.life >= c.maxLife) {
        c.active = false;
        continue;
      }
      c.x += c.vx * dt;
    }

    for (let i = 0; i < this.burstCoins.length; i++) {
      const bc = this.burstCoins[i];
      if (!bc.active) continue;
      bc.life += dt;
      if (bc.life >= bc.maxLife) {
        bc.active = false;
        continue;
      }
      bc.vy += 900 * scale * dt;
      bc.x += bc.vx * dt;
      bc.y += bc.vy * dt;
    }

    for (let i = 0; i < this.bronzeStreaks.length; i++) {
      const s = this.bronzeStreaks[i];
      if (!s.active) continue;
      s.x -= s.speed * dt;
      if (s.x + s.len < -10) s.active = false;
    }

    for (let i = 0; i < this.popupRings.length; i++) {
      const r = this.popupRings[i];
      if (!r.active) continue;
      r.life += dt;
      if (r.life >= r.maxLife) r.active = false;
    }

    for (let i = 0; i < this.popups.length; i++) {
      const p = this.popups[i];
      if (!p.active) continue;
      p.life += dt;
      p.y += p.vy * dt;
      if (p.life >= p.maxLife) p.active = false;
    }

    for (let i = 0; i < this.flyingCoins.length; i++) {
      const fc = this.flyingCoins[i];
      if (!fc.active) continue;
      fc.t += dt / fc.duration;
      if (fc.t >= 1) {
        fc.active = false;
        this.counterBumpKey += 1;
      }
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const W = this.width;
    const H = this.height;
    const scale = this.getScale();
    const groundY = Math.round(H * 0.68);
    const metrics = this.getRunnerMetrics();
    const isStartOrIntro = this.phase === 'START' || this.phase === 'STARTING';

    ctx.save();

    if (!isStartOrIntro && Math.abs(this.cameraZoom - 1) > 0.001) {
      const zx = W * 0.36;
      const zy = groundY * 0.78;
      ctx.translate(zx, zy);
      ctx.scale(this.cameraZoom, this.cameraZoom);
      ctx.translate(-zx, -zy);
    }

    if (!this.prefersReducedMotion && (this.screenShakeTimer > 0 || this.rumbleTimer > 0)) {
      const amp = this.screenShakeTimer > 0 ? this.screenShakeAmp : 1.5;
      const sx = (Math.random() - 0.5) * 2 * amp;
      const sy = (Math.random() - 0.5) * 2 * amp;
      ctx.translate(sx, sy);
    }

    const revealAlpha = isStartOrIntro ? 0.45 + 0.55 * this.transitionProgress : 1;
    const slideLift = isStartOrIntro ? (1 - this.transitionProgress) * 18 : 0;

    this.locationRenderer.renderBackground(
      ctx,
      this.locationId,
      W,
      H,
      groundY,
      scale,
      revealAlpha,
      slideLift,
      this.prefersReducedMotion
    );

    if (!isStartOrIntro) {
      if (!this.prefersReducedMotion) {
        for (let i = 0; i < this.speedLines.length; i++) {
          const l = this.speedLines[i];
          if (!l.active) continue;
          ctx.fillStyle = l.color;
          ctx.fillRect(l.x, l.y, l.len, l.thickness);
        }
      }

      if (this.bearGap < 45) {
        const threat = clamp((45 - this.bearGap) / 45, 0, 1);
        const bandW = Math.round(12 + threat * 26);
        const hudFloor = Math.round(H * 0.12);
        ctx.fillStyle = `rgba(194, 59, 34, ${(0.22 + threat * 0.42).toFixed(2)})`;
        ctx.fillRect(0, hudFloor, bandW, groundY - hudFloor);
      }

      for (let i = 0; i < this.obstacles.length; i++) {
        const obs = this.obstacles[i];
        if (obs.active) this.drawObstacle(ctx, obs, scale);
      }

      for (let i = 0; i < this.coins.length; i++) {
        const c = this.coins[i];
        if (c.active && !c.collected) this.drawCoinItem(ctx, c, scale);
      }

      for (let i = 0; i < this.bronzeStreaks.length; i++) {
        const s = this.bronzeStreaks[i];
        if (!s.active) continue;
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x - s.len, s.y, s.len, s.thickness);
      }

      for (let i = 0; i < this.candleTrail.length; i++) {
        const c = this.candleTrail[i];
        if (!c.active) continue;
        const alpha = 1 - c.life / c.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = '#E8DFC9';
        ctx.fillRect(c.x + c.w * 0.5 - 1, c.y - c.h * 0.7, 2, c.h * 1.4);
        ctx.fillStyle = '#2FD27A';
        ctx.strokeStyle = '#0E0D0C';
        ctx.lineWidth = 2;
        ctx.fillRect(c.x, c.y - c.h * 0.5, c.w, c.h);
        ctx.strokeRect(c.x, c.y - c.h * 0.5, c.w, c.h);
        ctx.restore();
      }

      // Flat cream dust squares, transform and opacity only
      for (let i = 0; i < this.dust.length; i++) {
        const d = this.dust[i];
        if (!d.active) continue;
        const t = d.life / d.maxLife;
        const alpha = 1 - t;
        const boxScale = 1 - 0.35 * t;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(d.x, d.y);
        ctx.scale(boxScale, boxScale);
        ctx.fillStyle = d.fillColor;
        ctx.fillRect(-d.size * 0.5, -d.size * 0.5, d.size, d.size);
        ctx.restore();
      }

      for (let i = 0; i < this.burstCoins.length; i++) {
        const bc = this.burstCoins[i];
        if (!bc.active) continue;
        const alpha = 1 - bc.life / bc.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#F2B24A';
        ctx.strokeStyle = '#0E0D0C';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bc.x, bc.y, bc.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      for (let i = 0; i < this.debris.length; i++) {
        const p = this.debris[i];
        if (!p.active) continue;
        const alpha = 1 - p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#0E0D0C';
        ctx.lineWidth = 2;
        ctx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
        ctx.strokeRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
        ctx.restore();
      }

      // Draw Runner & Bear
      this.drawRunner(ctx, metrics, groundY, scale);
      this.drawBear(ctx, metrics, groundY, scale);

      // Debug overlays (?debug=anim)
      if (this.animTune.showHitbox) {
        const hbW = metrics.drawW * 0.4;
        const hbLeft = W * 0.36 - hbW * 0.5;
        const hbBottom = groundY + this.runnerYOffset;
        const hbH = metrics.targetRunnerHeight * (0.55 - 0.1 * this.duckBlend);
        ctx.save();
        ctx.strokeStyle = '#2FD27A';
        ctx.lineWidth = 2;
        ctx.strokeRect(hbLeft, hbBottom - hbH, hbW, hbH);
        ctx.restore();
      }

      for (let i = 0; i < this.popupRings.length; i++) {
        const pr = this.popupRings[i];
        if (!pr.active) continue;
        const t = pr.life / pr.maxLife;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = pr.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.maxR * (0.4 + 0.8 * t), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      for (let i = 0; i < this.flyingCoins.length; i++) {
        const fc = this.flyingCoins[i];
        if (!fc.active) continue;
        const t = fc.t;
        const omt = 1 - t;
        const fx = omt * omt * fc.startX + 2 * omt * t * fc.ctrlX + t * t * fc.endX;
        const fy = omt * omt * fc.startY + 2 * omt * t * fc.ctrlY + t * t * fc.endY;
        ctx.save();
        ctx.fillStyle = fc.isGoldBar ? '#2FD27A' : '#F2B24A';
        ctx.strokeStyle = '#0E0D0C';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(fx, fy, 8 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      for (let i = 0; i < this.popups.length; i++) {
        const pop = this.popups[i];
        if (!pop.active) continue;
        const alpha = Math.max(0, 1 - pop.life / pop.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `400 ${Math.max(15, Math.round(18 * scale))}px "Anton", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#0E0D0C';
        ctx.strokeText(pop.text, pop.x, pop.y);
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  private drawRiderPoseImage(
    ctx: CanvasRenderingContext2D,
    poseKey: RiderPoseKey,
    hipCanvasX: number,
    hipCanvasY: number,
    effectiveRiderScale: number,
    angleRad: number,
    alpha: number
  ): void {
    const img = this.art.riderPoses[poseKey];
    const poseCfg = this.art.riderConfig?.poses[poseKey];
    if (!img || !poseCfg) return;

    const pt = this.animTune.poses[poseKey];
    const drawHipX = hipCanvasX + pt.x * effectiveRiderScale;
    const drawHipY = hipCanvasY + pt.y * effectiveRiderScale;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(drawHipX, drawHipY);
    ctx.rotate(angleRad);
    ctx.drawImage(
      img,
      -poseCfg.hip[0] * effectiveRiderScale,
      -poseCfg.hip[1] * effectiveRiderScale,
      poseCfg.w * effectiveRiderScale,
      poseCfg.h * effectiveRiderScale
    );
    ctx.restore();
  }

  private drawLayeredRunnerFrame(
    ctx: CanvasRenderingContext2D,
    metrics: {
      targetRunnerHeight: number;
      runnerScale: number;
      drawW: number;
      drawH: number;
      leftX: number;
      topY: number;
      groundY: number;
    },
    frameIdx: number,
    leftX: number,
    yOffset: number,
    oySpring: number,
    riderAngleRad: number,
    baseAlpha: number,
    showDebugMarkers: boolean
  ): void {
    const sc = this.art.statueConfig!;
    const rc = this.art.riderConfig!;
    const sheet = this.art.statueSheet!;

    const cols = Math.max(1, sc.cols);
    const col = frameIdx % cols;
    const row = Math.floor(frameIdx / cols);
    const sx = col * sc.fw;
    const sy = row * sc.fh;
    const statueTopY = metrics.groundY + yOffset - sc.groundY * metrics.runnerScale;

    // 1. Statue first
    ctx.save();
    ctx.globalAlpha = baseAlpha;
    ctx.drawImage(
      sheet,
      sx,
      sy,
      sc.fw,
      sc.fh,
      leftX,
      statueTopY,
      metrics.drawW,
      metrics.drawH
    );
    ctx.restore();

    // 2. Saddle anchor + tune + spring + duck offset (6px down when ducking)
    const saddlePair = sc.saddle[frameIdx] ?? sc.saddle[0];
    const saddleCanvasX = leftX + (saddlePair[0] + this.animTune.saddleX) * metrics.runnerScale;
    const saddleCanvasY =
      statueTopY +
      (saddlePair[1] + this.animTune.saddleY) * metrics.runnerScale +
      oySpring +
      6 * this.duckBlend;
    const effectiveRiderScale = metrics.runnerScale * (rc.scale ?? 1) * this.animTune.scaleMult;

    // 3. Rider on top (120ms crossfade by drawing both with alpha)
    if (this.prevRiderPose !== this.curRiderPose && this.riderPoseFade < 1) {
      this.drawRiderPoseImage(
        ctx,
        this.prevRiderPose,
        saddleCanvasX,
        saddleCanvasY,
        effectiveRiderScale,
        riderAngleRad,
        baseAlpha * (1 - this.riderPoseFade)
      );
      this.drawRiderPoseImage(
        ctx,
        this.curRiderPose,
        saddleCanvasX,
        saddleCanvasY,
        effectiveRiderScale,
        riderAngleRad,
        baseAlpha * this.riderPoseFade
      );
    } else {
      this.drawRiderPoseImage(
        ctx,
        this.curRiderPose,
        saddleCanvasX,
        saddleCanvasY,
        effectiveRiderScale,
        riderAngleRad,
        baseAlpha
      );
    }

    if (showDebugMarkers && this.animTune.showSaddlePoints) {
      ctx.save();
      ctx.strokeStyle = '#C23B22';
      ctx.fillStyle = '#F2B24A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(saddleCanvasX, saddleCanvasY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawRunner(
    ctx: CanvasRenderingContext2D,
    metrics: {
      targetRunnerHeight: number;
      runnerScale: number;
      drawW: number;
      drawH: number;
      leftX: number;
      topY: number;
      groundY: number;
    },
    groundY: number,
    scale: number
  ): void {
    const airHeightRatio = Math.min(1, Math.abs(this.runnerYOffset) / 170);
    const shadowRx = metrics.drawW * 0.34 * (1 - 0.5 * airHeightRatio);
    const shadowRy = Math.max(4, metrics.targetRunnerHeight * 0.055 * (1 - 0.45 * airHeightRatio));

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.65 - 0.35 * airHeightRatio).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(this.width * 0.36, groundY + 4, shadowRx, shadowRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.art.layeredRunnerReady && this.art.statueConfig && this.art.riderConfig) {
      const frameCount = Math.max(1, this.art.statueConfig.frames);
      const curFrame = Math.floor(this.statueAnimPhase) % frameCount;
      const baseAlpha =
        this.hitFlashTimer > 0 && Math.floor(this.hitFlashTimer * 24) % 2 === 0 ? 0.55 : 1;

      // Catch ending: rider hit pose falling (-25deg rotate, +14px drop over 250ms)
      let extraDropY = 0;
      let riderDeg = this.riderSpringY * 0.12 + this.riderAirLeanDeg + this.hitJoltAngleDeg;
      if (this.phase === 'DYING') {
        const fallT = clamp(this.dyingTimer / 0.25, 0, 1);
        extraDropY = 14 * fallT;
        riderDeg = -25 * fallT;
      }

      // 3 Charge afterimages at 30% opacity
      if (this.chargeTimer > 0 && !this.prefersReducedMotion) {
        for (let i = 0; i < this.afterimages.length; i++) {
          const a = this.afterimages[i];
          if (!a.active || a.alpha <= 0.02) continue;
          this.drawLayeredRunnerFrame(
            ctx,
            metrics,
            a.statueFrame,
            a.x,
            a.y - groundY,
            a.oy,
            a.angleRad,
            a.alpha,
            false
          );
        }
      }

      const riderAngleRad = (riderDeg * Math.PI) / 180;
      this.drawLayeredRunnerFrame(
        ctx,
        metrics,
        curFrame,
        metrics.leftX,
        this.runnerYOffset + extraDropY,
        this.riderSpringY,
        riderAngleRad,
        baseAlpha,
        true
      );

      // Rings / indicators around layered runner
      if (this.hasPickupShield) {
        ctx.save();
        ctx.strokeStyle = '#F2B24A';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.ellipse(
          this.width * 0.36,
          groundY + this.runnerYOffset - metrics.targetRunnerHeight * 0.48,
          metrics.drawW * 0.44,
          metrics.targetRunnerHeight * 0.48,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.restore();
      } else if (this.magnetTimer > 0) {
        ctx.save();
        ctx.strokeStyle = '#2FD27A';
        ctx.lineWidth = 2.5 * scale;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.ellipse(
          this.width * 0.36,
          groundY + this.runnerYOffset - metrics.targetRunnerHeight * 0.48,
          metrics.drawW * 0.42,
          metrics.targetRunnerHeight * 0.46,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      return;
    }

    // Fallback single-sprite animation
    const frames = this.art.fallbackExtraFrames;
    const primary = this.art.fallbackRunner;
    if (!primary) return;

    let sprite = primary;
    if (frames.length > 1 && this.onGround && this.phase === 'PLAYING') {
      const idx = Math.floor(this.statueAnimPhase) % frames.length;
      sprite = frames[idx] || primary;
    }

    const gallopBob =
      this.onGround && this.phase === 'PLAYING' && !this.prefersReducedMotion && this.duckBlend < 0.2
        ? Math.sin(this.runTime * 9 * Math.PI * 2) * 5
        : 0;

    let scaleY = 1 - 0.16 * this.duckBlend;
    let scaleX = 1 + 0.06 * this.duckBlend;
    if (this.squashTimer > 0 && !this.prefersReducedMotion) {
      const p = this.squashTimer / 0.08;
      scaleY *= 1 - 0.1 * p;
      scaleX *= 1 + 0.06 * p;
    }

    const duckShiftY = metrics.drawH * 0.06 * this.duckBlend;
    const fallOffset = this.phase === 'DYING' ? 14 * clamp(this.dyingTimer / 0.25, 0, 1) : 0;
    const pivotX = this.width * 0.36;
    const pivotY = groundY + this.runnerYOffset + gallopBob + duckShiftY + fallOffset;

    ctx.save();
    ctx.translate(pivotX, pivotY);
    if (this.phase === 'DYING') {
      ctx.rotate((-25 * Math.PI) / 180 * clamp(this.dyingTimer / 0.25, 0, 1));
    } else if (!this.prefersReducedMotion) {
      ctx.rotate(this.fallbackLeanAngle);
    }
    ctx.scale(scaleX, scaleY);

    if (this.hitFlashTimer > 0 && Math.floor(this.hitFlashTimer * 24) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    const runnerSource: CanvasImageSource =
      hasTierPrivilege(this.activeTier, 'bull') && sprite.goldTintedCanvas
        ? sprite.goldTintedCanvas
        : sprite.img;

    ctx.drawImage(
      runnerSource,
      sprite.box.x,
      sprite.box.y,
      sprite.box.w,
      sprite.box.h,
      -metrics.drawW * 0.5,
      -metrics.drawH,
      metrics.drawW,
      metrics.drawH
    );
    ctx.restore();
  }

  private drawBear(
    ctx: CanvasRenderingContext2D,
    metrics: {
      targetRunnerHeight: number;
      runnerScale: number;
      drawW: number;
      drawH: number;
      leftX: number;
      topY: number;
      groundY: number;
    },
    groundY: number,
    scale: number
  ): void {
    if (this.phase !== 'DYING' && this.bearGap >= 45) return;

    // Caught sequence: bearStill scaled 1.1x slides smoothly to runner over 250ms
    if (this.phase === 'DYING' && this.art.bearStillImg && this.art.bearStillConfig) {
      const bStill = this.art.bearStillImg;
      const bCfg = this.art.bearStillConfig;
      const stillH = 0.85 * metrics.targetRunnerHeight * 1.1;
      const stillW = stillH * (bCfg.w / bCfg.h);
      const slideT = clamp(this.dyingTimer / 0.25, 0, 1);
      const easedSlide = 1 - Math.pow(1 - slideT, 3);
      const targetX = this.width * 0.36 - stillW * 0.82;
      const bx = this.catchBearStartX + (targetX - this.catchBearStartX) * easedSlide;
      const by = groundY - stillH;

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
      ctx.beginPath();
      ctx.ellipse(bx + stillW * 0.5, groundY + 4, stillW * 0.36, Math.max(4, stillH * 0.055), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(bStill, bx, by, stillW, stillH);
      ctx.restore();
      return;
    }

    // Layered animated bear sheet: bear.avgH * bearScale = 0.85 * runnerDrawnHeight
    if (this.art.layeredBearReady && this.art.bearSheet && this.art.bearConfig) {
      const bc = this.art.bearConfig;
      const bearScale = (0.85 * metrics.targetRunnerHeight) / bc.avgH;
      const bearW = bc.fw * bearScale;
      const bearH = bc.fh * bearScale;
      const bearX = this.computeBearX(metrics);
      if (bearX + bearW < -4) return;

      const bearTopY = groundY - bc.groundY * bearScale;
      const frameIdx = Math.floor(this.bearAnimPhase) % Math.max(1, bc.frames);
      const cols = Math.max(1, bc.cols);
      const sx = (frameIdx % cols) * bc.fw;
      const sy = Math.floor(frameIdx / cols) * bc.fh;

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
      ctx.beginPath();
      ctx.ellipse(bearX + bearW * 0.5, groundY + 4, bearW * 0.34, Math.max(4, bearH * 0.05), 0, 0, Math.PI * 2);
      ctx.fill();

      if (this.bearGap > 30) {
        ctx.globalAlpha = clamp((45 - this.bearGap) / 15, 0.3, 1);
      }

      ctx.drawImage(this.art.bearSheet, sx, sy, bc.fw, bc.fh, bearX, bearTopY, bearW, bearH);

      if (this.bearGap <= 15 && this.phase === 'PLAYING' && !this.prefersReducedMotion) {
        const swipePulse = Math.sin(this.runTime * 16);
        if (swipePulse > 0.35) {
          ctx.strokeStyle = '#C23B22';
          ctx.lineWidth = 3;
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.moveTo(bearX + bearW * 0.82, groundY - bearH * 0.56 + k * 10 * scale);
            ctx.lineTo(bearX + bearW * 1.02, groundY - bearH * 0.42 + k * 10 * scale);
            ctx.stroke();
          }
        }
      }

      ctx.restore();
      return;
    }

    // Fallback single-sprite bear
    const sprite = this.art.fallbackBear;
    if (!sprite) return;
    const bearH = Math.min(200, Math.max(105, this.height * 0.19));
    const bearW = bearH * (sprite.box.w / sprite.box.h);
    const bearX = this.computeBearX(metrics);
    if (bearX + bearW < -4) return;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
    ctx.beginPath();
    ctx.ellipse(bearX + bearW * 0.5, groundY + 4, bearW * 0.36, Math.max(4, bearH * 0.055), 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.bearGap > 30 && this.phase !== 'DYING') {
      ctx.globalAlpha = clamp((45 - this.bearGap) / 15, 0.3, 1);
    }
    ctx.drawImage(
      sprite.img,
      sprite.box.x,
      sprite.box.y,
      sprite.box.w,
      sprite.box.h,
      bearX,
      groundY - bearH,
      bearW,
      bearH
    );
    ctx.restore();
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, scale: number): void {
    const x = obs.x;
    const y = obs.y;
    const w = obs.w;
    const h = obs.h;

    if (obs.kind === 'candle') {
      const wickW = Math.max(4, 4 * scale);
      const wickX = x + w * 0.5 - wickW * 0.5;
      const bodyTop = y + obs.wickTopH;
      const bodyH = Math.max(18, h - obs.wickTopH - 10 * scale);

      ctx.fillStyle = '#E8DFC9';
      ctx.strokeStyle = '#0E0D0C';
      ctx.lineWidth = 3;
      ctx.fillRect(wickX, y, wickW, h);
      ctx.strokeRect(wickX, y, wickW, h);

      ctx.fillStyle = '#C23B22';
      ctx.fillRect(x, bodyTop, w, bodyH);
      ctx.fillStyle = '#942919';
      ctx.fillRect(x + w * 0.68, bodyTop, w * 0.32, bodyH);
      ctx.strokeRect(x, bodyTop, w, bodyH);

      const arrowY = bodyTop + bodyH * 0.48;
      ctx.fillStyle = '#E8DFC9';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, arrowY - 5 * scale);
      ctx.lineTo(x + w * 0.7, arrowY - 5 * scale);
      ctx.lineTo(x + w * 0.5, arrowY + 7 * scale);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (obs.kind === 'bearTrap') {
      ctx.strokeStyle = '#0E0D0C';
      ctx.lineWidth = 3;
      ctx.fillStyle = '#4D555E';
      ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
      ctx.strokeRect(x, y + h * 0.55, w, h * 0.45);
      ctx.fillStyle = '#2F363D';
      ctx.fillRect(x + w * 0.72, y + h * 0.55, w * 0.28, h * 0.45);

      ctx.fillStyle = '#E8DFC9';
      const teeth = 5;
      const tw = (w - 8 * scale) / teeth;
      for (let t = 0; t < teeth; t++) {
        const tx = x + 4 * scale + t * tw;
        ctx.beginPath();
        ctx.moveTo(tx, y + h * 0.55);
        ctx.lineTo(tx + tw * 0.5, y);
        ctx.lineTo(tx + tw, y + h * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      return;
    }

    if (obs.kind === 'banner') {
      ctx.strokeStyle = '#0E0D0C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 24 * scale, y - 4 * scale);
      ctx.lineTo(x + w + 24 * scale, y - 4 * scale);
      ctx.stroke();

      ctx.fillStyle = '#171513';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#C23B22';
      ctx.fillRect(x, y, w, Math.max(12 * scale, h * 0.24));
      ctx.fillStyle = '#0E0D0C';
      ctx.fillRect(x + w * 0.76, y, w * 0.24, h);
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = '#E8DFC9';
      ctx.fillRect(x + 12 * scale, y + h * 0.44, w * 0.52, 5 * scale);
      ctx.fillStyle = '#C97B1A';
      ctx.fillRect(x + 12 * scale, y + h * 0.64, w * 0.36, 4 * scale);
      return;
    }

    if (obs.kind === 'wreckingBall') {
      const swingAng = Math.sin(obs.swingPhase) * 0.26;
      const anchorX = x + w * 0.5;
      const cx = anchorX + Math.sin(swingAng) * obs.ropeLen * 0.45;
      const cy = obs.pivotY + Math.cos(swingAng) * obs.ropeLen;
      const r = w * 0.5;

      ctx.strokeStyle = '#0E0D0C';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(anchorX, 0);
      ctx.lineTo(anchorX, obs.pivotY);
      ctx.lineTo(cx, cy - r * 0.8);
      ctx.stroke();

      ctx.strokeStyle = '#C97B1A';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(anchorX, obs.pivotY);
      ctx.lineTo(cx, cy - r * 0.8);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#383E46';
      ctx.strokeStyle = '#0E0D0C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1E2329';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.88, -0.5, 1.8);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    if (obs.kind === 'paperPlanes') {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0E0D0C';
      const planePositions: Array<[number, number]> = [
        [0, h * 0.35],
        [w * 0.34, 0],
        [w * 0.58, h * 0.48],
      ];
      const pw = Math.max(28 * scale, w * 0.36);
      const ph = Math.max(14 * scale, h * 0.42);
      for (let p = 0; p < planePositions.length; p++) {
        const px = x + planePositions[p][0];
        const py = y + planePositions[p][1];
        ctx.fillStyle = '#E8DFC9';
        ctx.beginPath();
        ctx.moveTo(px, py + ph * 0.5);
        ctx.lineTo(px + pw, py);
        ctx.lineTo(px + pw * 0.82, py + ph);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#B8AF99';
        ctx.beginPath();
        ctx.moveTo(px, py + ph * 0.5);
        ctx.lineTo(px + pw * 0.82, py + ph);
        ctx.lineTo(px + pw * 0.88, py + ph * 0.52);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      return;
    }

    const rows = obs.kind === 'brick1' ? 2 : obs.kind === 'brick2' ? 3 : 4;
    const rowH = h / rows;
    ctx.lineWidth = 2.5;
    for (let r = 0; r < rows; r++) {
      const ry = y + r * rowH;
      const bw = w * 0.5;
      ctx.fillStyle = r % 2 === 0 ? '#B5472B' : '#A23D25';
      ctx.fillRect(x, ry, bw, rowH);
      ctx.fillStyle = r % 2 === 0 ? '#942919' : '#852416';
      ctx.fillRect(x + bw, ry, bw, rowH);
      ctx.strokeStyle = '#0E0D0C';
      ctx.strokeRect(x, ry, bw, rowH);
      ctx.strokeRect(x + bw, ry, bw, rowH);
    }
    ctx.strokeStyle = '#0E0D0C';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  }

  private drawCoinItem(ctx: CanvasRenderingContext2D, c: Coin, scale: number): void {
    ctx.save();
    ctx.translate(c.x, c.y);

    if (c.kind === 'goldBar') {
      const bw = 26 * scale;
      const bh = 16 * scale;
      ctx.fillStyle = '#F2B24A';
      ctx.strokeStyle = '#0E0D0C';
      ctx.lineWidth = 3;
      ctx.fillRect(-bw * 0.5, -bh * 0.5, bw, bh);
      ctx.fillStyle = '#C97B1A';
      ctx.fillRect(-bw * 0.5, 0, bw, bh * 0.5);
      ctx.strokeRect(-bw * 0.5, -bh * 0.5, bw, bh);
      ctx.restore();
      return;
    }

    if (c.kind === 'magnet') {
      const r = c.r;
      ctx.fillStyle = '#2FD27A';
      ctx.strokeStyle = '#0E0D0C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#0E0D0C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 1 * scale, r * 0.45, 0, Math.PI, false);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (c.kind === 'shield') {
      const r = c.r;
      ctx.fillStyle = '#F2B24A';
      ctx.strokeStyle = '#0E0D0C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.85, -r * 0.55);
      ctx.lineTo(r * 0.72, r * 0.4);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.72, r * 0.4);
      ctx.lineTo(-r * 0.85, -r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }

    const r = c.r;
    const spinW = 0.8 + 0.2 * Math.abs(Math.cos(c.spinPhase));
    ctx.scale(spinW, 1);

    ctx.fillStyle = '#F2B24A';
    ctx.strokeStyle = '#0E0D0C';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#C97B1A';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#5C3A06';
    drawCrescentHorn(ctx, 0, 0, r);

    ctx.restore();
  }

  private emitSnapshot(force: boolean): void {
    const roundedGap = Math.round(this.bearGap);
    const showPaw = roundedGap < 45;
    const chargeStep = this.chargeTimer > 0 ? Math.ceil(this.chargeTimer * 10) : 0;
    const magnetStep = this.magnetTimer > 0 ? Math.ceil(this.magnetTimer * 10) : 0;
    const goVisible = this.goTimer > 0;
    const tapHintVisible = this.tapHintTimer > 0 && !this.firstJumpDone;
    const bannerVisible = this.locationBannerTimer > 0;

    if (
      !force &&
      this.score === this.lastPublishedScore &&
      roundedGap === this.lastPublishedGap &&
      this.phase === this.lastPublishedPhase &&
      this.coinCount === this.lastPublishedCoins &&
      this.comboLevel === this.lastPublishedCombo &&
      this.chargeCoins === this.lastPublishedChargeCoins &&
      chargeStep === this.lastPublishedChargeStep &&
      magnetStep === this.lastPublishedMagnetStep &&
      this.hasPickupShield === this.lastPublishedShield &&
      showPaw === this.lastPublishedPaw &&
      goVisible === this.lastPublishedGo &&
      tapHintVisible === this.lastPublishedTapHint &&
      bannerVisible === this.lastPublishedBanner &&
      this.secondWindAvailable === this.lastPublishedSecondWindAvail &&
      this.secondWindUsed === this.lastPublishedSecondWindUsed
    ) {
      return;
    }

    this.lastPublishedScore = this.score;
    this.lastPublishedGap = roundedGap;
    this.lastPublishedPhase = this.phase;
    this.lastPublishedCoins = this.coinCount;
    this.lastPublishedCombo = this.comboLevel;
    this.lastPublishedChargeCoins = this.chargeCoins;
    this.lastPublishedChargeStep = chargeStep;
    this.lastPublishedMagnetStep = magnetStep;
    this.lastPublishedShield = this.hasPickupShield;
    this.lastPublishedPaw = showPaw;
    this.lastPublishedGo = goVisible;
    this.lastPublishedTapHint = tapHintVisible;
    this.lastPublishedBanner = bannerVisible;
    this.lastPublishedSecondWindAvail = this.secondWindAvailable;
    this.lastPublishedSecondWindUsed = this.secondWindUsed;

    const anchor = this.getRunnerTargetRect();
    this.onSnapshot({
      phase: this.phase,
      locationId: this.locationId,
      locationBannerTimer: this.locationBannerTimer,
      isDailyRun: this.isDailyRun,
      dailyDate: this.dailyDate,
      score: this.score,
      bestScore: this.bestScore,
      isNewBest: this.isNewBest,
      coinCount: this.coinCount,
      comboLevel: this.comboLevel,
      comboTimer: this.comboTimer,
      counterBumpKey: this.counterBumpKey,
      bearGap: roundedGap,
      showBearPaw: showPaw,
      chargeCoins: this.chargeCoins,
      chargeReady: this.chargeCoins >= CHARGE_COINS_REQUIRED && this.chargeTimer <= 0,
      chargeTimer: this.chargeTimer,
      magnetTimer: this.magnetTimer,
      hasPickupShield: this.hasPickupShield,
      secondWindAvailable: this.secondWindAvailable,
      secondWindUsed: this.secondWindUsed,
      showGoBadge: goVisible,
      showTapHint: tapHintVisible,
      breakdown: {
        distance: this.distanceScore,
        coinsCombo: this.coinScore,
        closeCalls: this.closeCallScore,
        perfects: this.perfectScore,
      },
      runSeed: this.runSeed,
      runStartMinute: this.runStartMinute,
      endedByCatch: this.endedByCatch,
      runnerAnchor: { x: anchor.x, y: anchor.y, w: anchor.w, h: anchor.h },
    });
  }
}
