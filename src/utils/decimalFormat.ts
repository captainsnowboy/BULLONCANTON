/**
 * Decimal-safe string formatting utilities for THE TAPE.
 * Never performs raw floating-point arithmetic on money values.
 */

export const MISSING_VALUE = '—';

interface DecimalParts {
  negative: boolean;
  intDigits: string;
  fracDigits: string;
}

function expandScientificNotation(raw: string): string | null {
  const m = raw.match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!m) return null;
  const sign = m[1] === '-' ? '-' : '';
  const intPart = m[2];
  const fracPart = m[3] ?? '';
  const exp = parseInt(m[4], 10);
  if (!Number.isFinite(exp)) return null;

  const digits = intPart + fracPart;
  const pointIndex = intPart.length + exp;

  if (pointIndex <= 0) {
    return `${sign}0.${'0'.repeat(-pointIndex)}${digits}`;
  }
  if (pointIndex >= digits.length) {
    return `${sign}${digits}${'0'.repeat(pointIndex - digits.length)}`;
  }
  return `${sign}${digits.slice(0, pointIndex)}.${digits.slice(pointIndex)}`;
}

export function parseDecimalParts(raw: unknown): DecimalParts | null {
  if (raw === null || raw === undefined) return null;
  let str = typeof raw === 'number' ? (Number.isFinite(raw) ? String(raw) : '') : String(raw);
  str = str.trim().replace(/,/g, '');
  if (!str) return null;

  if (/[eE]/.test(str)) {
    const expanded = expandScientificNotation(str);
    if (!expanded) return null;
    str = expanded;
  }

  const m = str.match(/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/);
  if (!m) return null;

  const negative = m[1] === '-';
  const rawInt = (m[2] ?? '0').replace(/^0+(?=\d)/, '') || '0';
  const rawFrac = m[3] ?? m[4] ?? '';

  const allZero = /^0+$/.test(rawInt) && (rawFrac === '' || /^0+$/.test(rawFrac));
  return {
    negative: allZero ? false : negative,
    intDigits: rawInt,
    fracDigits: rawFrac,
  };
}

function addCommas(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function roundDigitArray(digits: string[], keepCount: number): { digits: string[]; carried: boolean } {
  if (keepCount >= digits.length) {
    const padded = [...digits];
    while (padded.length < keepCount) padded.push('0');
    return { digits: padded, carried: false };
  }

  const kept = digits.slice(0, keepCount);
  const nextChar = digits[keepCount];
  if (nextChar < '5') {
    return { digits: kept, carried: false };
  }

  for (let i = kept.length - 1; i >= 0; i--) {
    const d = kept[i].charCodeAt(0) - 48 + 1;
    if (d < 10) {
      kept[i] = String(d);
      return { digits: kept, carried: false };
    }
    kept[i] = '0';
  }
  return { digits: ['1', ...kept], carried: true };
}

/**
 * Formats a decimal string to at least `sigFigs` significant figures using pure string rounding.
 * Tiny values like "0.000012345" format to "0.00001235" (never rounded to 0.00).
 */
export function formatSigFigs(raw: unknown, sigFigs = 4): string | null {
  const parts = parseDecimalParts(raw);
  if (!parts) return null;

  const sign = parts.negative ? '-' : '';
  const combined = (parts.intDigits + parts.fracDigits).split('');
  const firstNz = combined.findIndex((c) => c !== '0');

  if (firstNz === -1) {
    return `0.${'0'.repeat(Math.max(1, sigFigs))}`;
  }

  let scale = parts.intDigits.length;
  const sigSlice = combined.slice(firstNz);
  const { digits: rounded, carried } = roundDigitArray(sigSlice, sigFigs);

  if (carried) {
    // Rounding carried an extra digit (e.g. 9999 -> 10000); keep sigFigs digits and bump magnitude
    const finalSig = rounded.slice(0, sigFigs);
    const shift = firstNz - 1;
    if (shift < 0) {
      scale += 1;
      return placeDecimalFromFirstNz(sign, 0, scale, finalSig);
    }
    return placeDecimalFromFirstNz(sign, shift, scale, finalSig);
  }

  return placeDecimalFromFirstNz(sign, firstNz, scale, rounded);
}

function placeDecimalFromFirstNz(
  sign: string,
  firstNz: number,
  scale: number,
  sigDigits: string[]
): string {
  if (firstNz < scale) {
    const intSigCount = scale - firstNz;
    if (intSigCount >= sigDigits.length) {
      const intOut = sigDigits.join('') + '0'.repeat(intSigCount - sigDigits.length);
      return `${sign}${addCommas(intOut)}`;
    }
    const intPart = sigDigits.slice(0, intSigCount).join('');
    const fracPart = sigDigits.slice(intSigCount).join('');
    return `${sign}${addCommas(intPart)}.${fracPart}`;
  }

  const leadingZeros = firstNz - scale;
  return `${sign}0.${'0'.repeat(leadingZeros)}${sigDigits.join('')}`;
}

export function formatPriceCc(raw: unknown): string {
  const formatted = formatSigFigs(raw, 4);
  return formatted === null ? MISSING_VALUE : `${formatted} CC`;
}

export function formatPriceUsd(raw: unknown): string {
  const formatted = formatSigFigs(raw, 4);
  if (formatted === null) return MISSING_VALUE;
  if (formatted.startsWith('-')) return `-$${formatted.slice(1)}`;
  return `$${formatted}`;
}

/**
 * Formats large decimal strings compactly (e.g. 105500 -> "105.5K", 1270000 -> "1.27M")
 * without floating-point math.
 */
export function formatCompactDecimal(raw: unknown): string | null {
  const parts = parseDecimalParts(raw);
  if (!parts) return null;

  const sign = parts.negative ? '-' : '';
  const { intDigits, fracDigits } = parts;

  if (intDigits === '0') {
    if (fracDigits === '' || /^0+$/.test(fracDigits)) return '0';
    const sub = formatSigFigs(raw, 4);
    return sub;
  }

  const tiers: Array<{ minLen: number; pow: number; suffix: string }> = [
    { minLen: 13, pow: 12, suffix: 'T' },
    { minLen: 10, pow: 9, suffix: 'B' },
    { minLen: 7, pow: 6, suffix: 'M' },
    { minLen: 4, pow: 3, suffix: 'K' },
  ];

  const matchIdx = tiers.findIndex((t) => intDigits.length >= t.minLen);
  if (matchIdx === -1) {
    // Value between 1 and 999
    if (!fracDigits) return `${sign}${intDigits}`;
    const padded = (intDigits + fracDigits).split('');
    const { digits: rounded, carried } = roundDigitArray(padded, intDigits.length + 2);
    const outDigits = carried ? rounded : rounded;
    const newIntLen = carried ? intDigits.length + 1 : intDigits.length;
    if (newIntLen >= 4) {
      return formatCompactDecimal(`${sign}${outDigits.slice(0, newIntLen).join('')}`);
    }
    const intOut = outDigits.slice(0, newIntLen).join('');
    const fracOut = outDigits.slice(newIntLen, newIntLen + 2).join('').replace(/0+$/, '');
    return fracOut ? `${sign}${intOut}.${fracOut}` : `${sign}${intOut}`;
  }

  let tierIdx = matchIdx;
  while (tierIdx >= 0) {
    const tier = tiers[tierIdx];
    const scaledIntLen = intDigits.length - tier.pow;
    const decimals = scaledIntLen === 1 ? 2 : 1;
    const combined = (intDigits + fracDigits).split('');
    const { digits: rounded, carried } = roundDigitArray(combined, scaledIntLen + decimals);

    const effIntLen = carried ? scaledIntLen + 1 : scaledIntLen;
    if (effIntLen >= 4 && tierIdx > 0) {
      // Carry crossed into next suffix (e.g. 999.95K -> 1.00M)
      tierIdx -= 1;
      const nextTier = tiers[tierIdx];
      const zeroPad = '0'.repeat(nextTier.pow);
      const promotedInt = rounded.slice(0, 1).join('') + zeroPad;
      const promotedFrac = rounded.slice(1).join('');
      return formatCompactDecimal(`${sign}${promotedInt}.${promotedFrac}`);
    }

    const intPart = rounded.slice(0, effIntLen).join('');
    const fracPart = rounded.slice(effIntLen, effIntLen + decimals).join('').replace(/0+$/, '');
    return fracPart ? `${sign}${intPart}.${fracPart}${tier.suffix}` : `${sign}${intPart}${tier.suffix}`;
  }

  return `${sign}${addCommas(intDigits)}`;
}

export function formatMarketCapUsd(raw: unknown): string {
  const c = formatCompactDecimal(raw);
  if (c === null) return MISSING_VALUE;
  if (c.startsWith('-')) return `-$${c.slice(1)}`;
  return `$${c}`;
}

export function formatCompactCc(raw: unknown): string {
  const c = formatCompactDecimal(raw);
  return c === null ? MISSING_VALUE : `${c} CC`;
}

export function formatWholeNumber(raw: unknown): string | null {
  const parts = parseDecimalParts(raw);
  if (!parts) return null;

  const sign = parts.negative ? '-' : '';
  const allDigits = (parts.intDigits + parts.fracDigits).split('');
  const { digits: rounded } = roundDigitArray(allDigits, parts.intDigits.length);
  const whole = rounded.join('').replace(/^0+(?=\d)/, '') || '0';
  return `${sign}${addCommas(whole)}`;
}

export function formatHolderDelta(raw: unknown): string {
  const parts = parseDecimalParts(raw);
  if (!parts) return MISSING_VALUE;
  const whole = formatWholeNumber(raw);
  if (whole === null) return MISSING_VALUE;
  if (whole === '0' || whole.startsWith('-')) return `${whole} today`;
  return `+${whole} today`;
}

export function formatChange24h(raw: unknown): { arrow: '▲' | '▼' | ''; text: string } {
  const parts = parseDecimalParts(raw);
  if (!parts) return { arrow: '', text: MISSING_VALUE };

  const allDigits = (parts.intDigits + parts.fracDigits).split('');
  const { digits: rounded } = roundDigitArray(allDigits, parts.intDigits.length + 2);
  const intLen = rounded.length - 2;
  const intPart = addCommas(rounded.slice(0, intLen).join('').replace(/^0+(?=\d)/, '') || '0');
  const fracPart = rounded.slice(intLen).join('').padEnd(2, '0');

  const isZero = intPart === '0' && fracPart === '00';
  if (isZero) {
    return { arrow: '', text: '0.00%' };
  }
  return {
    arrow: parts.negative ? '▼' : '▲',
    text: `${intPart}.${fracPart}%`,
  };
}

export function formatGraduationPercent(raw: unknown): {
  text: string;
  barWidthPct: string | null;
} {
  const parts = parseDecimalParts(raw);
  if (!parts) return { text: MISSING_VALUE, barWidthPct: null };

  if (parts.negative) {
    return { text: '0%', barWidthPct: '0%' };
  }

  // Clamp >= 100 purely on string digits
  if (parts.intDigits.length > 3 || (parts.intDigits.length === 3 && parts.intDigits >= '100')) {
    return { text: '100%', barWidthPct: '100%' };
  }

  const allDigits = (parts.intDigits + parts.fracDigits).split('');
  const { digits: rounded } = roundDigitArray(allDigits, parts.intDigits.length + 1);
  const intLen = rounded.length - 1;
  const intPart = rounded.slice(0, intLen).join('').replace(/^0+(?=\d)/, '') || '0';
  const fracPart = rounded.slice(intLen).join('');

  if (intPart.length > 3 || (intPart.length === 3 && intPart >= '100')) {
    return { text: '100%', barWidthPct: '100%' };
  }

  const formatted = fracPart === '0' ? `${intPart}%` : `${intPart}.${fracPart}%`;
  return { text: formatted, barWidthPct: `${intPart}.${fracPart}%` };
}

export function formatTradeAmountCc(raw: unknown): string {
  const parts = parseDecimalParts(raw);
  if (!parts) return MISSING_VALUE;

  if (parts.intDigits === '0') {
    const sig = formatSigFigs(raw, 4);
    return sig === null ? MISSING_VALUE : `${sig} CC`;
  }

  if (parts.intDigits.length >= 4) {
    const whole = formatWholeNumber(raw);
    return whole === null ? MISSING_VALUE : `${whole} CC`;
  }

  // 1..999: up to 2 decimal places
  const combined = (parts.intDigits + parts.fracDigits).split('');
  const { digits: rounded } = roundDigitArray(combined, parts.intDigits.length + 2);
  const intLen = rounded.length - 2;
  const intPart = rounded.slice(0, intLen).join('');
  const fracPart = rounded.slice(intLen).join('').replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart} CC` : `${intPart} CC`;
}

export function formatRelativeTime(isoOrTimestamp: unknown, nowMs: number): string {
  if (isoOrTimestamp === null || isoOrTimestamp === undefined) return MISSING_VALUE;
  let ms: number;
  if (typeof isoOrTimestamp === 'number') {
    ms = isoOrTimestamp > 1e12 ? isoOrTimestamp : isoOrTimestamp * 1000;
  } else {
    const parsed = Date.parse(String(isoOrTimestamp));
    if (Number.isNaN(parsed)) return MISSING_VALUE;
    ms = parsed;
  }

  const diffSec = Math.max(0, Math.floor((nowMs - ms) / 1000));
  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

/**
 * Extracts only a short display hint for a trade counterparty.
 * Never returns a full Canton Party ID (e.g. `alias::1220...`) or long hex string.
 */
export function formatSafeTraderHint(trade: Record<string, unknown>): string | null {
  const candidates = [
    trade.displayHint,
    trade.traderDisplayHint,
    trade.traderHint,
    trade.handle,
    trade.username,
    trade.alias,
    trade.partyHint,
    trade.trader,
    trade.maker,
    trade.partyId,
  ];

  for (const cand of candidates) {
    if (typeof cand !== 'string') continue;
    const trimmed = cand.trim();
    if (!trimmed) continue;

    // Canton Party IDs contain `::` followed by a long hex fingerprint — strip the fingerprint.
    if (trimmed.includes('::')) {
      const prefix = trimmed.split('::')[0].trim();
      if (prefix && prefix.length <= 14 && !/^[0-9a-f]{12,}$/i.test(prefix)) {
        return prefix;
      }
      return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
    }

    // Any long token-like ID (>= 16 chars without spaces) must be shortened so no full ID ever renders.
    if (trimmed.length >= 16 && !/\s/.test(trimmed)) {
      return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
    }

    return trimmed;
  }

  return null;
}

export function buildSparklinePath(
  pointsRaw: unknown,
  width: number,
  height: number,
  padY = 4
): string | null {
  if (!Array.isArray(pointsRaw) || pointsRaw.length < 2) return null;

  const nums: number[] = [];
  for (const item of pointsRaw) {
    let rawVal: unknown = item;
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      rawVal = obj.price ?? obj.priceUsd ?? obj.value ?? obj.close ?? obj.y;
    }
    const n = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));
    if (Number.isFinite(n)) nums.push(n);
  }

  if (nums.length < 2) return null;

  let min = nums[0];
  let max = nums[0];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] < min) min = nums[i];
    if (nums[i] > max) max = nums[i];
  }

  const span = max - min;
  const innerH = Math.max(1, height - padY * 2);

  return nums
    .map((val, idx) => {
      const x = (idx / (nums.length - 1)) * width;
      const y = span === 0 ? height / 2 : padY + (1 - (val - min) / span) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
