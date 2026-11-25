/**
 * Verified creator wallet buyback history and live Supanova trade merger for THE TAPE.
 * Buys only — sells are strictly excluded by design.
 */

export const CREATOR_PARTY_ID =
  'supa1::1220fde25338b0e52e4a7ce189e2c720f30bd3fe26161bad9bad1ce53286d74b101d';

export interface CreatorBuybackEntry {
  key: string;
  publicReference: string | null;
  occurredAtMs: number;
  utcDate: string;
  dateLabel: string;
  cc: number;
  tokens: number;
  isLaunch?: boolean;
}

// Verified baseline totals (baked in from the public Supanova record)
export const BASELINE_BUYBACKS_CC = 4376;
export const BASELINE_BUYBACKS_TOKENS = 10924029;
export const BASELINE_WALLET_TOTAL_CC = 11405;
export const BASELINE_WALLET_TOTAL_TOKENS = 32125758;

// Latest verified baseline timestamp (2026-11-25 buyback) so historical trades in the
// recent-100 window are never double-counted against the baked-in baseline.
const BASELINE_CUTOFF_MS = Date.parse('2026-11-25T10:02:05.122Z');

const BASELINE_KNOWN_REFS = new Set<string>([
  'trade_ref_e6a7ed4c07ee483ba213205e3f7b0c25', // 2026-11-25 buyback
  'trade_ref_f33f1499bbc8f524c7d3be3352f2edf6', // 2026-11-22 buyback
  'trade_ref_0111262ad99c9f81448972ecb43fd15b', // 2026-11-21 buyback
]);

/**
 * Verified static baseline buyback history, newest first.
 */
export const VERIFIED_BASELINE_BUYBACKS: readonly CreatorBuybackEntry[] = [
  {
    key: 'baseline-2026-11-25',
    publicReference: 'trade_ref_e6a7ed4c07ee483ba213205e3f7b0c25',
    occurredAtMs: Date.parse('2026-11-25T10:02:05.122Z'),
    utcDate: '2026-11-25',
    dateLabel: 'Nov 25',
    cc: 297,
    tokens: 1125668,
  },
  {
    key: 'baseline-2026-11-22',
    publicReference: 'trade_ref_f33f1499bbc8f524c7d3be3352f2edf6',
    occurredAtMs: Date.parse('2026-11-22T22:20:37.377Z'),
    utcDate: '2026-11-22',
    dateLabel: 'Nov 22',
    cc: 237.6,
    tokens: 847196,
  },
  {
    key: 'baseline-2026-11-21',
    publicReference: 'trade_ref_0111262ad99c9f81448972ecb43fd15b',
    occurredAtMs: Date.parse('2026-11-21T20:18:05.203Z'),
    utcDate: '2026-11-21',
    dateLabel: 'Nov 21',
    cc: 743,
    tokens: 2048361,
  },
  {
    key: 'baseline-2026-11-19-2',
    publicReference: null,
    occurredAtMs: Date.parse('2026-11-19T12:00:00.000Z'),
    utcDate: '2026-11-19',
    dateLabel: 'Nov 19',
    cc: 822,
    tokens: 1818914,
  },
  {
    key: 'baseline-2026-11-19-1',
    publicReference: null,
    occurredAtMs: Date.parse('2026-11-19T06:00:00.000Z'),
    utcDate: '2026-11-19',
    dateLabel: 'Nov 19',
    cc: 2277,
    tokens: 5083889,
  },
  {
    key: 'baseline-2026-11-18-launch',
    publicReference: null,
    occurredAtMs: Date.parse('2026-11-18T00:00:00.000Z'),
    utcDate: '2026-11-18',
    dateLabel: 'Nov 18',
    cc: 7029,
    tokens: 21201729,
    isLaunch: true,
  },
];

const MONTHS_SHORT_UTC = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function parsePositiveNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseTimestampMs(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1e12 ? raw : raw * 1000;
  }
  const ms = Date.parse(String(raw));
  return Number.isNaN(ms) ? null : ms;
}

export function formatBuybackDateUtc(ms: number): { utcDate: string; dateLabel: string } {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const monthIdx = d.getUTCMonth();
  const day = d.getUTCDate();
  const utcDate = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dateLabel = `${MONTHS_SHORT_UTC[monthIdx]} ${day}`;
  return { utcDate, dateLabel };
}

/**
 * Formats CC with thousands separators and no decimals when whole (e.g. 7,029 not 7029.0).
 */
export function formatBuybackCc(value: number): string {
  const rounded2 = Math.round(value * 100) / 100;
  const isWhole = Math.abs(rounded2 - Math.round(rounded2)) < 0.005;
  if (isWhole) {
    return Math.round(rounded2).toLocaleString('en-US');
  }
  return rounded2.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats exact whole token amounts for individual buyback rows.
 */
export function formatBuybackTokensExact(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/**
 * Formats million-scale token totals (e.g. "9.8M", "31.0M") for the two summary lines.
 */
export function formatBuybackTokensMillions(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  return Math.round(value).toLocaleString('en-US');
}

function matchesBaselineEntry(
  publicRef: string | null,
  occurredAtMs: number,
  utcDate: string,
  cc: number,
  tokens: number
): boolean {
  if (publicRef && BASELINE_KNOWN_REFS.has(publicRef)) {
    return true;
  }
  if (occurredAtMs <= BASELINE_CUTOFF_MS) {
    return true;
  }
  return VERIFIED_BASELINE_BUYBACKS.some(
    (b) =>
      b.utcDate === utcDate &&
      Math.abs(Math.round(cc) - b.cc) <= 1 &&
      Math.abs(Math.round(tokens) - b.tokens) <= 2
  );
}

/**
 * Extracts strictly NEW creator-wallet buy trades from a Supanova /trades payload.
 * Never includes sells and never duplicates entries already in the static baseline.
 */
export function extractLiveCreatorBuybacks(payload: unknown): CreatorBuybackEntry[] {
  let list: unknown[] = [];
  if (Array.isArray(payload)) {
    list = payload;
  } else if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.items)) list = obj.items;
    else if (Array.isArray(obj.trades)) list = obj.trades;
    else if (Array.isArray(obj.data)) list = obj.data;
  }

  const seen = new Set<string>();
  const results: CreatorBuybackEntry[] = [];

  for (const rawItem of list) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const item = rawItem as Record<string, unknown>;

    // Strictly buys only — never include sells
    const side = String(item.side ?? '').trim().toLowerCase();
    if (side !== 'buy') continue;

    // Creator wallet filter: match on creator Party ID ONLY (never use isCreator)
    const partyId = typeof item.partyId === 'string' ? item.partyId.trim() : '';
    if (partyId !== CREATOR_PARTY_ID) continue;

    const cc = parsePositiveNumber(item.notionalCc);
    const tokens = parsePositiveNumber(item.tokenAmount);
    const occurredAtMs = parseTimestampMs(item.occurredAt ?? item.timestamp ?? item.createdAt);
    if (cc === null || tokens === null || occurredAtMs === null) continue;

    const publicReference =
      typeof item.publicReference === 'string' && item.publicReference.trim().length > 0
        ? item.publicReference.trim()
        : null;
    const rawId =
      typeof item.id === 'string' && item.id.trim().length > 0 ? item.id.trim() : null;

    const { utcDate, dateLabel } = formatBuybackDateUtc(occurredAtMs);

    if (matchesBaselineEntry(publicReference, occurredAtMs, utcDate, cc, tokens)) {
      continue;
    }

    // Prefer stable publicReference over positional id to avoid duplicates across polls
    const key = publicReference || rawId || `live-${occurredAtMs}-${Math.round(cc)}-${Math.round(tokens)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      key,
      publicReference,
      occurredAtMs,
      utcDate,
      dateLabel,
      cc,
      tokens,
    });
  }

  return results.sort((a, b) => b.occurredAtMs - a.occurredAtMs);
}

/**
 * Merges incoming live creator buybacks with any previously seen live buybacks without duplicates.
 */
export function mergeCreatorBuybacks(
  existingLive: CreatorBuybackEntry[],
  incomingLive: CreatorBuybackEntry[]
): CreatorBuybackEntry[] {
  if (incomingLive.length === 0) return existingLive;

  const byKey = new Map<string, CreatorBuybackEntry>();
  for (const item of existingLive) {
    byKey.set(item.key, item);
  }
  let changed = false;
  for (const item of incomingLive) {
    if (!byKey.has(item.key)) {
      byKey.set(item.key, item);
      changed = true;
    }
  }
  if (!changed) return existingLive;

  return Array.from(byKey.values()).sort((a, b) => b.occurredAtMs - a.occurredAtMs);
}

export interface BuybackSummary {
  rows: CreatorBuybackEntry[];
  buybacksCc: number;
  buybacksTokens: number;
  walletTotalCc: number;
  walletTotalTokens: number;
}

export function computeBuybackSummary(liveNewEntries: CreatorBuybackEntry[]): BuybackSummary {
  let addedCc = 0;
  let addedTokens = 0;
  for (const entry of liveNewEntries) {
    addedCc += entry.cc;
    addedTokens += entry.tokens;
  }

  return {
    rows: [...liveNewEntries, ...VERIFIED_BASELINE_BUYBACKS],
    buybacksCc: BASELINE_BUYBACKS_CC + addedCc,
    buybacksTokens: BASELINE_BUYBACKS_TOKENS + addedTokens,
    walletTotalCc: BASELINE_WALLET_TOTAL_CC + addedCc,
    walletTotalTokens: BASELINE_WALLET_TOTAL_TOKENS + addedTokens,
  };
}
