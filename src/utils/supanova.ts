import { useEffect, useRef, useState } from 'react';
import { CBULL } from '../config/cbull';
import { formatWholeNumber } from './decimalFormat';
import {
  type CreatorBuybackEntry,
  extractLiveCreatorBuybacks,
  mergeCreatorBuybacks,
} from './creatorBuybacks';

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
  participantHint: string | null;
}

export interface SupanovaTapeState {
  isLiveEnabled: boolean;
  visible: boolean;
  token: SupanovaTokenSnapshot | null;
  trades: SupanovaTradeItem[];
  liveCreatorBuybacks: CreatorBuybackEntry[];
  liveHoldersFormatted: string | null;
  isStale: boolean;
  asOfDate: Date | null;
}

export function normalizeTokenResponse(payload: unknown): SupanovaTokenSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const item =
    root.item && typeof root.item === 'object'
      ? (root.item as Record<string, unknown>)
      : root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;

  const meta = root.meta as Record<string, unknown> | undefined;
  const provenance = meta?.provenance as Record<string, unknown> | undefined;
  const lp = item.launchProgress as Record<string, unknown> | undefined;

  return {
    price: item.price ?? null,
    priceUsd: item.priceUsd ?? null,
    change24h: item.change24h ?? null,
    marketCapUsd: item.marketCapUsd ?? null,
    marketCap: item.marketCap ?? null,
    volume24h: item.volume24h ?? null,
    tradeCount24h: item.tradeCount24h ?? null,
    holders: item.holders ?? null,
    holderChange24h: item.holderChange24h ?? null,
    launchProgress: lp
      ? {
          graduationPercent: lp.graduationPercent ?? null,
          stage: lp.stage ?? null,
        }
      : null,
    sparkline: Array.isArray(item.sparkline) ? item.sparkline : [],
    asOf: provenance?.asOf ?? null,
  };
}

export function normalizeTradesResponse(payload: unknown): SupanovaTradeItem[] {
  let list: unknown[] = [];
  if (Array.isArray(payload)) {
    list = payload;
  } else if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.items)) list = obj.items;
    else if (Array.isArray(obj.trades)) list = obj.trades;
    else if (Array.isArray(obj.data)) list = obj.data;
  }

  return list
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .slice(0, 5)
    .map((item) => {
      const rawSide = String(item.side ?? 'BUY').trim().toUpperCase();
      const side = rawSide === 'SELL' ? 'SELL' : 'BUY';
      const amountCc = item.notionalCc ?? item.amountCc ?? item.ccAmount ?? null;
      const timestamp = item.occurredAt ?? item.timestamp ?? item.createdAt ?? null;
      const participantHint =
        typeof item.participantHint === 'string' ? item.participantHint : null;
      return { side, amountCc, timestamp, participantHint };
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

async function fetchPublicJson(primaryUrl: string, fallbackUrl: string): Promise<unknown | null> {
  for (const url of [primaryUrl, fallbackUrl]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) continue;
      return await res.json();
    } catch {
      // Try next endpoint on network/CORS error
    }
  }
  return null;
}

export function useSupanovaLiveData(): SupanovaTapeState {
  const isLive = Boolean(CBULL.isLive && typeof CBULL.tokenSlug === 'string' && CBULL.tokenSlug.trim().length > 0);
  const [token, setToken] = useState<SupanovaTokenSnapshot | null>(null);
  const [trades, setTrades] = useState<SupanovaTradeItem[]>([]);
  const [liveCreatorBuybacks, setLiveCreatorBuybacks] = useState<CreatorBuybackEntry[]>([]);
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
    const proxyTokenUrl = `/api/supanova/tokens/${slug}`;
    const directTokenUrl = `${SUPANOVA_BASE_URL}/${slug}`;
    const proxyTradesUrl = `/api/supanova/tokens/${slug}/trades?limit=100`;
    const directTradesUrl = `${SUPANOVA_BASE_URL}/${slug}/trades?limit=100`;

    const fetchLatest = async () => {
      if (cancelled || document.hidden || inFlightRef.current) return;
      inFlightRef.current = true;
      lastFetchAtRef.current = Date.now();

      try {
        const rawToken = await fetchPublicJson(proxyTokenUrl, directTokenUrl);
        if (!rawToken || cancelled) return;

        const normalized = normalizeTokenResponse(rawToken);
        if (!normalized || cancelled) return;

        setToken(normalized);
        setHasFirstSuccess(true);

        // Fetch latest 100 public trades on the same 60s cadence for LAST PRINTS (top 5)
        // and live CREATOR BUYBACKS (buys only). Retain last good state on failure.
        const rawTrades = await fetchPublicJson(proxyTradesUrl, directTradesUrl);
        if (rawTrades && !cancelled) {
          setTrades(normalizeTradesResponse(rawTrades));
          const incomingBuybacks = extractLiveCreatorBuybacks(rawTrades);
          if (incomingBuybacks.length > 0) {
            setLiveCreatorBuybacks((prev) => mergeCreatorBuybacks(prev, incomingBuybacks));
          }
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
      liveCreatorBuybacks: [],
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
    liveCreatorBuybacks,
    liveHoldersFormatted,
    isStale,
    asOfDate,
  };
}
