import { useEffect, useRef, useState } from 'react';
import { CBULL } from '../config/cbull';
import { formatWholeNumber } from './decimalFormat';

const SUPANOVA_BASE_URL = 'https://launch-api.supanova.app/api/v1/tokens';
const POLL_INTERVAL_MS = 60_000;
const STALE_THRESHOLD_MS = 5 * 60_000;

export interface SupanovaTokenSnapshot {
  price: unknown;
  priceUsd: unknown;
  change24h: unknown;
  marketCapUsd: unknown;
  marketCap: unknown;
  volume24h: unknown;
  tradeCount24h: unknown;
  holders: unknown;
  holderChange24h: unknown;
  launchProgress: {
    graduationPercent?: unknown;
    stage?: unknown;
  } | null;
  sparkline: unknown[];
  asOf: unknown;
}

export interface SupanovaTradeItem {
  side: string;
  amountCc: unknown;
  timestamp: unknown;
  raw: Record<string, unknown>;
}

export interface SupanovaTapeState {
  isLiveEnabled: boolean;
  visible: boolean;
  token: SupanovaTokenSnapshot | null;
  trades: SupanovaTradeItem[];
  liveHoldersFormatted: string | null;
  isStale: boolean;
  asOfDate: Date | null;
}

function normalizeTokenResponse(payload: unknown): SupanovaTokenSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root.token && typeof root.token === 'object'
      ? (root.token as Record<string, unknown>)
      : root;

  const meta =
    (root.meta as Record<string, unknown> | undefined) ??
    (data.meta as Record<string, unknown> | undefined);
  const provenance = meta?.provenance as Record<string, unknown> | undefined;

  const lp = data.launchProgress as Record<string, unknown> | undefined;

  return {
    price: data.price ?? null,
    priceUsd: data.priceUsd ?? null,
    change24h: data.change24h ?? null,
    marketCapUsd: data.marketCapUsd ?? null,
    marketCap: data.marketCap ?? null,
    volume24h: data.volume24h ?? null,
    tradeCount24h: data.tradeCount24h ?? null,
    holders: data.holders ?? null,
    holderChange24h: data.holderChange24h ?? null,
    launchProgress: lp
      ? {
          graduationPercent: lp.graduationPercent ?? null,
          stage: lp.stage ?? null,
        }
      : null,
    sparkline: Array.isArray(data.sparkline) ? data.sparkline : [],
    asOf: provenance?.asOf ?? null,
  };
}

function normalizeTradesResponse(payload: unknown): SupanovaTradeItem[] {
  let list: unknown[] = [];
  if (Array.isArray(payload)) {
    list = payload;
  } else if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.trades)) list = obj.trades;
    else if (Array.isArray(obj.data)) list = obj.data;
    else if (Array.isArray(obj.items)) list = obj.items;
  }

  return list
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .slice(0, 5)
    .map((item) => {
      const rawSide = String(item.side ?? item.type ?? item.action ?? 'BUY').trim().toUpperCase();
      const side = rawSide === 'SELL' ? 'SELL' : 'BUY';
      const amountCc =
        item.ccAmount ??
        item.amountCc ??
        item.quoteAmount ??
        item.amount ??
        item.cc ??
        item.totalCc ??
        null;
      const timestamp = item.timestamp ?? item.createdAt ?? item.executedAt ?? item.time ?? null;
      return { side, amountCc, timestamp, raw: item };
    });
}

function computeAsOfState(asOfRaw: unknown): { asOfDate: Date | null; isStale: boolean } {
  if (asOfRaw === null || asOfRaw === undefined) {
    return { asOfDate: null, isStale: false };
  }
  const ms =
    typeof asOfRaw === 'number'
      ? asOfRaw > 1e12
        ? asOfRaw
        : asOfRaw * 1000
      : Date.parse(String(asOfRaw));
  if (Number.isNaN(ms)) {
    return { asOfDate: null, isStale: false };
  }
  return {
    asOfDate: new Date(ms),
    isStale: Date.now() - ms > STALE_THRESHOLD_MS,
  };
}

export function useSupanovaLiveData(): SupanovaTapeState {
  const isLive = Boolean(CBULL.isLive && typeof CBULL.tokenSlug === 'string' && CBULL.tokenSlug.trim().length > 0);
  const [token, setToken] = useState<SupanovaTokenSnapshot | null>(null);
  const [trades, setTrades] = useState<SupanovaTradeItem[]>([]);
  const [hasFirstSuccess, setHasFirstSuccess] = useState(false);
  const [, setStaleTick] = useState(0);

  const lastFetchAtRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isLive || typeof window === 'undefined') {
      return;
    }

    let cancelled = false;
    const slug = encodeURIComponent(CBULL.tokenSlug.trim());
    const tokenUrl = `${SUPANOVA_BASE_URL}/${slug}`;
    const tradesUrl = `${SUPANOVA_BASE_URL}/${slug}/trades?limit=5`;

    const fetchLatest = async () => {
      if (cancelled || document.hidden || inFlightRef.current) return;
      inFlightRef.current = true;
      lastFetchAtRef.current = Date.now();

      try {
        const tokenRes = await fetch(tokenUrl);
        if (!tokenRes.ok) {
          return;
        }
        const rawToken = await tokenRes.json();
        const normalized = normalizeTokenResponse(rawToken);
        if (!normalized || cancelled) return;

        setToken(normalized);
        setHasFirstSuccess(true);

        // Fetch last 5 trades independently; omit trades silently on failure
        try {
          const tradesRes = await fetch(tradesUrl);
          if (tradesRes.ok) {
            const rawTrades = await tradesRes.json();
            if (!cancelled) {
              setTrades(normalizeTradesResponse(rawTrades));
            }
          }
        } catch {
          // Omit trades silently on failure; keep last good if already populated or stay empty
        }
      } catch {
        // First fetch failure hides section; subsequent refresh failure retains last good values
      } finally {
        inFlightRef.current = false;
      }
    };

    void fetchLatest();

    // Poll every 60 seconds; pause while tab is hidden
    const pollTimer = window.setInterval(() => {
      if (!document.hidden) {
        void fetchLatest();
      }
    }, POLL_INTERVAL_MS);

    // Refresh stale indicator every 15s while visible
    const staleTimer = window.setInterval(() => {
      if (!document.hidden) {
        setStaleTick((n) => (n + 1) % 10000);
      }
    }, 15_000);

    const handleVisibility = () => {
      if (!document.hidden && Date.now() - lastFetchAtRef.current >= POLL_INTERVAL_MS) {
        void fetchLatest();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      window.clearInterval(staleTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isLive]);

  if (!isLive || !hasFirstSuccess || !token) {
    return {
      isLiveEnabled: isLive,
      visible: false,
      token: null,
      trades: [],
      liveHoldersFormatted: null,
      isStale: false,
      asOfDate: null,
    };
  }

  const { asOfDate, isStale } = computeAsOfState(token.asOf);
  const liveHoldersFormatted = formatWholeNumber(token.holders);

  return {
    isLiveEnabled: true,
    visible: true,
    token,
    trades,
    liveHoldersFormatted,
    isStale,
    asOfDate,
  };
}
