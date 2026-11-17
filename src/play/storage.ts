import { ANIM_TUNE, HERD_CODES, SEASON } from '../config.js';
import { PLAY_COPY } from '../copy.js';
import type {
  AnimTuneSettings,
  FreeUnlockId,
  HerdPassState,
  HerdTier,
  LocationId,
  RiderPoseKey,
} from './types';

const BEST_SCORE_KEY = 'bulloncanton_play_best';
const UNLOCKS_KEY = 'bulloncanton_play_unlocks';
const FIRST_JUMP_KEY = 'bulloncanton_play_first_jump';
const HERD_PASS_KEY = 'bulloncanton_herd_pass';
const HERD_RATE_KEY = 'bulloncanton_herd_rate';
const WEEKLY_KEY = 'bulloncanton_weekly_challenge';
const LOCATION_KEY = 'bulloncanton_play_location';
const ANIM_TUNE_KEY = 'animTune';

const TIER_ORDER: Record<HerdTier, number> = {
  herd: 1,
  bull: 2,
  alpha: 3,
};

let memoryBestScore = 0;
let memoryUnlocks: FreeUnlockId[] = [];
let memoryFirstJump = false;
let memoryHerdPass: HerdPassState | null = null;
let memoryRateState: { fails: number; lockUntilMs: number } = { fails: 0, lockUntilMs: 0 };
let memoryWeeklyBeatenWeek: string | null = null;
let memoryLocation: LocationId = 'wallStreet';

export function loadBestScore(): number {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        memoryBestScore = Math.max(memoryBestScore, parsed);
        return memoryBestScore;
      }
    }
  } catch {
    // Fallback to in-memory score
  }
  return memoryBestScore;
}

export function saveBestScore(score: number): number {
  const normalized = Math.max(0, Math.floor(score));
  if (normalized > memoryBestScore) {
    memoryBestScore = normalized;
  }
  let finalBest = memoryBestScore;
  try {
    const existing = loadBestScore();
    finalBest = Math.max(existing, normalized);
    memoryBestScore = finalBest;
    window.localStorage.setItem(BEST_SCORE_KEY, String(finalBest));
  } catch {
    // Ignore storage write errors
  }
  syncFreeUnlocks(finalBest);
  return finalBest;
}

export function getFreeUnlocksForScore(bestScore: number): FreeUnlockId[] {
  const list: FreeUnlockId[] = [];
  for (let i = 0; i < PLAY_COPY.freeUnlocks.length; i++) {
    const item = PLAY_COPY.freeUnlocks[i];
    if (bestScore >= item.minScore) {
      list.push(item.id as FreeUnlockId);
    }
  }
  return list;
}

export function syncFreeUnlocks(bestScore: number): FreeUnlockId[] {
  const earned = getFreeUnlocksForScore(bestScore);
  const merged = Array.from(new Set([...memoryUnlocks, ...earned])) as FreeUnlockId[];
  memoryUnlocks = merged;
  try {
    const raw = window.localStorage.getItem(UNLOCKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (let i = 0; i < parsed.length; i++) {
          if (typeof parsed[i] === 'string' && !merged.includes(parsed[i] as FreeUnlockId)) {
            merged.push(parsed[i] as FreeUnlockId);
          }
        }
      }
    }
    memoryUnlocks = merged;
    window.localStorage.setItem(UNLOCKS_KEY, JSON.stringify(merged));
  } catch {
    // Fallback to in-memory list
  }
  return merged;
}

export function loadFreeUnlocks(): FreeUnlockId[] {
  const best = loadBestScore();
  return syncFreeUnlocks(best);
}

export function hasDoneFirstJump(): boolean {
  if (memoryFirstJump) return true;
  try {
    const val = window.localStorage.getItem(FIRST_JUMP_KEY);
    if (val === '1') {
      memoryFirstJump = true;
      return true;
    }
  } catch {
    // Ignore storage errors
  }
  return memoryFirstJump;
}

export function markFirstJumpDone(): void {
  memoryFirstJump = true;
  try {
    window.localStorage.setItem(FIRST_JUMP_KEY, '1');
  } catch {
    // Ignore storage errors
  }
}

export function getRankLabel(score: number): string {
  const tiers = PLAY_COPY.ranks;
  let active = tiers[0]?.label ?? 'Intern';
  for (let i = 0; i < tiers.length; i++) {
    if (score >= tiers[i].minScore) {
      active = tiers[i].label;
    }
  }
  return active;
}

// ============================================================================
// WEEKLY CHALLENGE
// ============================================================================
export function isWeeklyChallengeBeaten(week: string): boolean {
  if (memoryWeeklyBeatenWeek === week) return true;
  try {
    const raw = window.localStorage.getItem(WEEKLY_KEY);
    if (raw === week) {
      memoryWeeklyBeatenWeek = week;
      return true;
    }
  } catch {
    // Ignore storage errors
  }
  return false;
}

export function recordWeeklyScore(week: string, score: number, target: number): boolean {
  if (score < target) {
    return isWeeklyChallengeBeaten(week);
  }
  memoryWeeklyBeatenWeek = week;
  try {
    window.localStorage.setItem(WEEKLY_KEY, week);
  } catch {
    // Ignore storage errors
  }
  return true;
}

// ============================================================================
// HERD PASS & CODE VERIFICATION
// ============================================================================
export function isSeasonActive(now = new Date()): boolean {
  const endsStr = typeof SEASON?.ends === 'string' ? SEASON.ends.trim() : '';
  if (!endsStr) return false;
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayYmd = `${year}-${month}-${day}`;
  return todayYmd <= endsStr;
}

export function hasTierPrivilege(activeTier: HerdTier | null, required: HerdTier): boolean {
  if (!activeTier) return false;
  return (TIER_ORDER[activeTier] || 0) >= (TIER_ORDER[required] || 99);
}

export function loadHerdPass(): HerdPassState | null {
  if (!isSeasonActive()) {
    memoryHerdPass = null;
    try {
      window.localStorage.removeItem(HERD_PASS_KEY);
    } catch {
      // Ignore
    }
    return null;
  }

  try {
    const raw = window.localStorage.getItem(HERD_PASS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HerdPassState>;
      if (
        parsed &&
        parsed.season === SEASON.id &&
        (parsed.tier === 'herd' || parsed.tier === 'bull' || parsed.tier === 'alpha')
      ) {
        memoryHerdPass = { tier: parsed.tier, season: parsed.season };
        return memoryHerdPass;
      }
      // Season mismatch or invalid -> revert to locked
      window.localStorage.removeItem(HERD_PASS_KEY);
      memoryHerdPass = null;
      return null;
    }
  } catch {
    // Fallback to memory state
  }

  if (memoryHerdPass && memoryHerdPass.season === SEASON.id) {
    return memoryHerdPass;
  }
  return null;
}

function saveHerdPass(pass: HerdPassState): void {
  memoryHerdPass = pass;
  try {
    window.localStorage.setItem(HERD_PASS_KEY, JSON.stringify(pass));
  } catch {
    // Ignore
  }
}

function loadRateState(): { fails: number; lockUntilMs: number } {
  try {
    const raw = window.localStorage.getItem(HERD_RATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { fails?: number; lockUntilMs?: number };
      memoryRateState = {
        fails: typeof parsed.fails === 'number' ? parsed.fails : 0,
        lockUntilMs: typeof parsed.lockUntilMs === 'number' ? parsed.lockUntilMs : 0,
      };
    }
  } catch {
    // Use memory fallback
  }
  return memoryRateState;
}

function saveRateState(next: { fails: number; lockUntilMs: number }): void {
  memoryRateState = next;
  try {
    window.localStorage.setItem(HERD_RATE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
}

export function getCodeLockoutRemainingSeconds(): number {
  const st = loadRateState();
  const remMs = st.lockUntilMs - Date.now();
  return remMs > 0 ? Math.ceil(remMs / 1000) : 0;
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto unavailable');
  }
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type VerifyCodeResult =
  | { ok: true; pass: HerdPassState }
  | { ok: false; reason: 'ended' | 'ratelimit' | 'invalid'; retrySeconds?: number };

export async function verifyAndUnlockHerdCode(rawCode: string): Promise<VerifyCodeResult> {
  if (!isSeasonActive()) {
    return { ok: false, reason: 'ended' };
  }

  const remaining = getCodeLockoutRemainingSeconds();
  if (remaining > 0) {
    return { ok: false, reason: 'ratelimit', retrySeconds: remaining };
  }

  const normalized = rawCode.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, reason: 'invalid' };
  }

  let hex = '';
  try {
    hex = await sha256Hex(normalized);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const codes = Array.isArray(HERD_CODES) ? HERD_CODES : [];
  const matched = codes.find(
    (entry) =>
      entry &&
      entry.season === SEASON.id &&
      typeof entry.hash === 'string' &&
      entry.hash.toLowerCase() === hex &&
      (entry.tier === 'herd' || entry.tier === 'bull' || entry.tier === 'alpha')
  );

  if (matched) {
    saveRateState({ fails: 0, lockUntilMs: 0 });
    const existing = loadHerdPass();
    const finalTier =
      existing && TIER_ORDER[existing.tier] > TIER_ORDER[matched.tier]
        ? existing.tier
        : matched.tier;
    const pass: HerdPassState = { tier: finalTier, season: SEASON.id };
    saveHerdPass(pass);
    return { ok: true, pass };
  }

  const st = loadRateState();
  const nextFails = (st.lockUntilMs > 0 && Date.now() >= st.lockUntilMs ? 0 : st.fails) + 1;
  if (nextFails >= 5) {
    const lockUntilMs = Date.now() + 30_000;
    saveRateState({ fails: 5, lockUntilMs });
    return { ok: false, reason: 'ratelimit', retrySeconds: 30 };
  }

  saveRateState({ fails: nextFails, lockUntilMs: 0 });
  return { ok: false, reason: 'invalid' };
}

// ============================================================================
// LOCATIONS & DAILY RUN SEED
// ============================================================================
export function getLocationUnlockScore(locId: LocationId): number {
  if (locId === 'bearStorm') return 2500;
  if (locId === 'cantonDawn') return 6000;
  return 0;
}

export function isLocationUnlocked(locId: LocationId, bestScore: number): boolean {
  return bestScore >= getLocationUnlockScore(locId);
}

export function loadSelectedLocation(bestScore?: number): LocationId {
  const best = typeof bestScore === 'number' ? bestScore : loadBestScore();
  let chosen: LocationId = memoryLocation;
  try {
    const raw = window.localStorage.getItem(LOCATION_KEY);
    if (raw === 'wallStreet' || raw === 'bearStorm' || raw === 'cantonDawn') {
      chosen = raw;
    }
  } catch {
    // Use memory fallback
  }
  if (!isLocationUnlocked(chosen, best)) {
    return 'wallStreet';
  }
  memoryLocation = chosen;
  return chosen;
}

export function saveSelectedLocation(locId: LocationId): void {
  memoryLocation = locId;
  try {
    window.localStorage.setItem(LOCATION_KEY, locId);
  } catch {
    // Ignore storage errors
  }
}

export function getUtcDateString(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function hashStringToSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 123456;
}

// ============================================================================
// ANIMATION TUNING (?debug=anim + ANIM_TUNE in config.js + localStorage)
// ============================================================================
function mergeAnimTune(
  base: AnimTuneSettings,
  patch: Partial<AnimTuneSettings> | Record<string, unknown> | null | undefined
): AnimTuneSettings {
  if (!patch || typeof patch !== 'object') return base;
  const p = patch as Partial<AnimTuneSettings>;
  const poseKeys: RiderPoseKey[] = ['up', 'duck', 'hit', 'charge'];
  const mergedPoses: AnimTuneSettings['poses'] = {
    up: { ...base.poses.up },
    duck: { ...base.poses.duck },
    hit: { ...base.poses.hit },
    charge: { ...base.poses.charge },
  };
  if (p.poses && typeof p.poses === 'object') {
    for (let i = 0; i < poseKeys.length; i++) {
      const k = poseKeys[i];
      const entry = p.poses[k];
      if (entry && typeof entry === 'object') {
        if (typeof entry.x === 'number' && Number.isFinite(entry.x)) mergedPoses[k].x = entry.x;
        if (typeof entry.y === 'number' && Number.isFinite(entry.y)) mergedPoses[k].y = entry.y;
      }
    }
  }
  return {
    saddleX: typeof p.saddleX === 'number' && Number.isFinite(p.saddleX) ? p.saddleX : base.saddleX,
    saddleY: typeof p.saddleY === 'number' && Number.isFinite(p.saddleY) ? p.saddleY : base.saddleY,
    scaleMult:
      typeof p.scaleMult === 'number' && Number.isFinite(p.scaleMult) && p.scaleMult > 0
        ? p.scaleMult
        : base.scaleMult,
    poses: mergedPoses,
    springK: typeof p.springK === 'number' && Number.isFinite(p.springK) ? p.springK : base.springK,
    springC: typeof p.springC === 'number' && Number.isFinite(p.springC) ? p.springC : base.springC,
    showSaddlePoints:
      typeof p.showSaddlePoints === 'boolean' ? p.showSaddlePoints : base.showSaddlePoints,
    showHitbox: typeof p.showHitbox === 'boolean' ? p.showHitbox : base.showHitbox,
  };
}

export function getDefaultAnimTune(): AnimTuneSettings {
  const base: AnimTuneSettings = {
    saddleX: 0,
    saddleY: 0,
    scaleMult: 1,
    poses: {
      up: { x: 0, y: 0 },
      duck: { x: 0, y: 0 },
      hit: { x: 0, y: 0 },
      charge: { x: 0, y: 0 },
    },
    springK: 90,
    springC: 12,
    showSaddlePoints: false,
    showHitbox: false,
  };
  return mergeAnimTune(base, ANIM_TUNE as Record<string, unknown>);
}

export function loadAnimTune(): AnimTuneSettings {
  const defaults = getDefaultAnimTune();
  try {
    const raw = window.localStorage.getItem(ANIM_TUNE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return mergeAnimTune(defaults, parsed);
    }
  } catch {
    // Ignore storage read/parse errors
  }
  return defaults;
}

export function saveAnimTune(next: AnimTuneSettings): void {
  try {
    window.localStorage.setItem(ANIM_TUNE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
}

export function resetAnimTune(): AnimTuneSettings {
  try {
    window.localStorage.removeItem(ANIM_TUNE_KEY);
  } catch {
    // Ignore storage errors
  }
  return getDefaultAnimTune();
}


