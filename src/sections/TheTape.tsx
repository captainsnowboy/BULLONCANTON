import React, { useState } from 'react';
import { CBULL } from '../config/cbull';
import { THE_TAPE_COPY } from '../copy.js';
import {
  MISSING_VALUE,
  buildSparklinePath,
  formatChange24h,
  formatCompactCc,
  formatGraduationPercent,
  formatHolderDelta,
  formatMarketCapUsd,
  formatPriceCc,
  formatPriceUsd,
  formatRelativeTime,
  formatSafeTraderHint,
  formatTradeAmountCc,
  formatWholeNumber,
} from '../utils/decimalFormat';
import {
  computeBuybackSummary,
  formatBuybackCc,
  formatBuybackTokensExact,
  formatBuybackTokensMillions,
} from '../utils/creatorBuybacks';
import type { SupanovaTapeState } from '../utils/supanova';

interface TheTapeProps {
  state: SupanovaTapeState;
}

export const TheTape: React.FC<TheTapeProps> = ({ state }) => {
  const [isBuybacksOpen, setIsBuybacksOpen] = useState(false);

  if (!state.visible || !state.token) {
    return null;
  }

  const { token, trades, liveCreatorBuybacks, liveHoldersFormatted, isStale, asOfDate } = state;
  const nowMs = Date.now();
  const buybacks = computeBuybackSummary(liveCreatorBuybacks);
  const walletTotalCcText = formatBuybackCc(buybacks.walletTotalCc);
  const buybacksCcText = formatBuybackCc(buybacks.buybacksCc);
  const buybacksTokensM = formatBuybackTokensMillions(buybacks.buybacksTokens);
  const walletTotalTokensM = formatBuybackTokensMillions(buybacks.walletTotalTokens);

  const priceCc = formatPriceCc(token.price);
  const priceUsd = formatPriceUsd(token.priceUsd);
  const change24h = formatChange24h(token.change24h);
  const marketCapUsd = formatMarketCapUsd(token.marketCapUsd);
  const marketCapCc = formatCompactCc(token.marketCap);
  const volume24hCc = formatCompactCc(token.volume24h);
  const tradeCountWhole = formatWholeNumber(token.tradeCount24h);
  const holderDelta = formatHolderDelta(token.holderChange24h);

  const stage = String(token.launchProgress?.stage ?? '').trim().toLowerCase();
  const isInOrbit = stage === 'in_orbit';
  const graduation = formatGraduationPercent(token.launchProgress?.graduationPercent);
  const graduationBarWidth =
    graduation.barWidthPct !== null ? parseFloat(graduation.barWidthPct) || 0 : 0;

  const sparkPoints = buildSparklinePath(token.sparkline, 360, 44, 4);

  const asOfFormatted = asOfDate
    ? asOfDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : MISSING_VALUE;

  return (
    <section
      id="tape"
      aria-label={THE_TAPE_COPY.heading}
      className="relative w-full bg-[#E8DFC9] text-[#0E0D0C] border-t-[3px] border-b-[3px] border-[#0E0D0C] px-4 sm:px-6 py-10 sm:py-14 z-20 overflow-x-clip"
    >
      <div className="max-w-4xl mx-auto">
        {/* Masthead */}
        <header className="border-t-[3px] border-b border-[#0E0D0C] pt-3 pb-4 mb-5 text-center">
          <p className="font-plex text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-[#0E0D0C]/80 mb-1.5">
            {THE_TAPE_COPY.kicker}
          </p>
          <h2 className="font-anton text-4xl sm:text-6xl uppercase tracking-wider text-[#0E0D0C] leading-none">
            {THE_TAPE_COPY.heading}
          </h2>
          <p className="font-playfair italic text-sm sm:text-base text-[#0E0D0C]/85 mt-2">
            {THE_TAPE_COPY.tagline}
          </p>
        </header>

        {/* Six-Cell Ruled Newspaper Table (2 cols mobile, 3 cols desktop) */}
        <div
          role="region"
          aria-label={THE_TAPE_COPY.heading}
          className="border-2 border-[#0E0D0C] bg-[#0E0D0C] grid grid-cols-2 min-[900px]:grid-cols-3 gap-[1px]"
        >
          {/* 1. PRICE */}
          <div className="bg-[#E8DFC9] p-3.5 sm:p-5 flex flex-col justify-between min-w-0">
            <span className="font-plex text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-[#0E0D0C]/70 mb-2">
              {THE_TAPE_COPY.stats.price}
            </span>
            <div>
              <div className="font-plex text-base sm:text-xl font-bold tabular-nums text-[#0E0D0C] break-words">
                {priceCc}
              </div>
              <div className="font-plex text-xs sm:text-sm tabular-nums text-[#0E0D0C]/75 mt-0.5 break-words">
                {priceUsd}
              </div>
            </div>
          </div>

          {/* 2. 24H */}
          <div className="bg-[#E8DFC9] p-3.5 sm:p-5 flex flex-col justify-between min-w-0">
            <span className="font-plex text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-[#0E0D0C]/70 mb-2">
              {THE_TAPE_COPY.stats.change24h}
            </span>
            <div className="font-plex text-base sm:text-xl font-bold tabular-nums text-[#0E0D0C] break-words">
              {change24h.arrow ? `${change24h.arrow} ` : ''}
              {change24h.text}
            </div>
          </div>

          {/* 3. MARKET CAP */}
          <div className="bg-[#E8DFC9] p-3.5 sm:p-5 flex flex-col justify-between min-w-0">
            <span className="font-plex text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-[#0E0D0C]/70 mb-2">
              {THE_TAPE_COPY.stats.marketCap}
            </span>
            <div>
              <div className="font-plex text-base sm:text-xl font-bold tabular-nums text-[#0E0D0C] break-words">
                {marketCapUsd}
              </div>
              <div className="font-plex text-xs sm:text-sm tabular-nums text-[#0E0D0C]/75 mt-0.5 break-words">
                {marketCapCc}
              </div>
            </div>
          </div>

          {/* 4. VOLUME 24H */}
          <div className="bg-[#E8DFC9] p-3.5 sm:p-5 flex flex-col justify-between min-w-0">
            <span className="font-plex text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-[#0E0D0C]/70 mb-2">
              {THE_TAPE_COPY.stats.volume24h}
            </span>
            <div>
              <div className="font-plex text-base sm:text-xl font-bold tabular-nums text-[#0E0D0C] break-words">
                {volume24hCc}
              </div>
              <div className="font-plex text-xs sm:text-sm tabular-nums text-[#0E0D0C]/75 mt-0.5">
                {tradeCountWhole !== null
                  ? `${tradeCountWhole} ${THE_TAPE_COPY.tradesSuffix}`
                  : MISSING_VALUE}
              </div>
            </div>
          </div>

          {/* 5. THE HERD */}
          <div className="bg-[#E8DFC9] p-3.5 sm:p-5 flex flex-col justify-between min-w-0">
            <span className="font-plex text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-[#0E0D0C]/70 mb-2">
              {THE_TAPE_COPY.stats.herd}
            </span>
            <div>
              <div
                data-testid="tape-herd-count"
                className="font-plex text-base sm:text-xl font-bold tabular-nums text-[#0E0D0C]"
              >
                {liveHoldersFormatted ?? MISSING_VALUE}
              </div>
              <div className="font-plex text-xs sm:text-sm tabular-nums text-[#0E0D0C]/75 mt-0.5">
                {holderDelta}
              </div>
            </div>
          </div>

          {/* 6. TO GRADUATION */}
          <div className="bg-[#E8DFC9] p-3.5 sm:p-5 flex flex-col justify-between min-w-0">
            <span className="font-plex text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-[#0E0D0C]/70 mb-2">
              {THE_TAPE_COPY.stats.toGraduation}
            </span>
            {isInOrbit ? (
              <div className="pt-0.5">
                <span className="inline-block border-2 border-[#C23B22] text-[#C23B22] font-anton text-xs sm:text-sm uppercase tracking-[0.12em] px-2 py-1 -rotate-1 leading-tight">
                  {THE_TAPE_COPY.inOrbitStamp}
                </span>
              </div>
            ) : (
              <div>
                <div className="font-plex text-base sm:text-xl font-bold tabular-nums text-[#0E0D0C] mb-1.5">
                  {graduation.text}
                </div>
                <svg
                  className="w-full h-2.5 border border-[#0E0D0C] bg-[#E8DFC9] block"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                  role="progressbar"
                  aria-label={THE_TAPE_COPY.stats.toGraduation}
                  aria-valuenow={Math.round(graduationBarWidth)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <rect x="0" y="0" width={graduationBarWidth} height="10" fill="#0E0D0C" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Creator Buybacks Button + Inline Accordion Panel (buys only) */}
        <div className="border-x-2 border-b-2 border-[#0E0D0C]">
          <button
            id="creator-buybacks-trigger"
            type="button"
            data-no-tapfx
            aria-expanded={isBuybacksOpen}
            aria-controls="creator-buybacks-panel"
            onClick={() => setIsBuybacksOpen((prev) => !prev)}
            className="w-full min-h-[48px] px-3.5 sm:px-5 py-3 bg-[#0E0D0C] text-[#C97B1A] hover:bg-[#1a1816] active:bg-[#0E0D0C] flex items-center justify-between gap-3 text-left font-plex text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] tabular-nums cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C97B1A] focus-visible:ring-inset"
          >
            <span className="inline-flex items-center gap-2 min-w-0 leading-snug">
              <span aria-hidden="true" className="shrink-0">
                ♻️
              </span>
              <span className="break-words">
                CREATOR BUYBACKS — {walletTotalCcText} CC BOUGHT · 0 SOLD
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`shrink-0 inline-flex items-center justify-center w-6 h-6 font-plex text-xl leading-none font-normal text-[#C97B1A] transition-transform duration-[250ms] ease-in-out motion-reduce:transition-none ${
                isBuybacksOpen ? 'rotate-45' : 'rotate-0'
              }`}
            >
              +
            </span>
          </button>

          <div
            id="creator-buybacks-panel"
            role="region"
            aria-labelledby="creator-buybacks-trigger"
            aria-hidden={!isBuybacksOpen}
            className={`grid bg-[#E8DFC9] text-[#0E0D0C] transition-[grid-template-rows,opacity] duration-[250ms] ease-in-out motion-reduce:transition-none ${
              isBuybacksOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div
                className={`border-t border-[#0E0D0C] px-3.5 sm:px-5 py-4 ${
                  isBuybacksOpen ? 'visible' : 'invisible'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="font-playfair italic text-sm text-[#0E0D0C] leading-snug">
                    The creator wallet buys $CBULL back with trading fees — and has never sold.
                  </p>
                  <button
                    type="button"
                    data-no-tapfx
                    aria-label="Close creator buybacks"
                    onClick={() => setIsBuybacksOpen(false)}
                    className="shrink-0 -mt-1 -mr-1 w-9 h-9 inline-flex items-center justify-center font-plex text-lg leading-none font-bold text-[#0E0D0C]/80 hover:text-[#0E0D0C] hover:bg-[#0E0D0C]/10 cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E0D0C]"
                  >
                    ×
                  </button>
                </div>

                <div className="border-y border-[#0E0D0C]/35 py-2.5 mb-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-baseline gap-y-1 gap-x-6 font-plex text-xs sm:text-[13px] font-bold tabular-nums text-[#0E0D0C]">
                  <div>
                    Buybacks: {buybacksCcText} CC → {buybacksTokensM} $CBULL
                  </div>
                  <div>
                    Wallet total: {walletTotalCcText} CC → {walletTotalTokensM} $CBULL · 0 sold
                  </div>
                </div>

                <ul className="m-0 p-0 list-none divide-y divide-[#0E0D0C]/20 font-plex text-xs sm:text-[13px] tabular-nums text-[#0E0D0C]">
                  {buybacks.rows.map((entry) => (
                    <li key={entry.key} className="py-1.5 leading-snug">
                      {entry.dateLabel} — {formatBuybackCc(entry.cc)} CC →{' '}
                      {formatBuybackTokensExact(entry.tokens)} $CBULL
                      {entry.isLaunch ? ' (launch)' : ''}
                    </li>
                  ))}
                </ul>

                <p className="mt-3 pt-2.5 border-t border-[#0E0D0C]/25 font-plex text-[11px] text-[#0E0D0C]/75">
                  Verified on the public{' '}
                  <a
                    href={CBULL.buyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#0E0D0C] underline underline-offset-4 hover:text-[#C23B22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E0D0C]"
                  >
                    Supanova record
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Extra A: Simple ink sparkline (only if non-empty) */}
        {sparkPoints !== null && (
          <div className="border-x-2 border-b-2 border-[#0E0D0C] bg-[#E8DFC9] px-3.5 sm:px-5 py-3">
            <div className="font-plex text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E0D0C]/70 mb-1.5">
              {THE_TAPE_COPY.sparklineLabel}
            </div>
            <svg
              viewBox="0 0 360 44"
              preserveAspectRatio="none"
              className="w-full h-11 block"
              aria-hidden="true"
            >
              <polyline
                fill="none"
                stroke="#0E0D0C"
                strokeWidth="1.75"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={sparkPoints}
              />
            </svg>
          </div>
        )}

        {/* Extra B: Last 5 prints ticker tape list (omitted silently if empty/failed) */}
        {trades.length > 0 && (
          <div className="border-x-2 border-b-2 border-[#0E0D0C] bg-[#E8DFC9] px-3.5 sm:px-5 py-3">
            <div className="font-plex text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E0D0C]/70 mb-2">
              {THE_TAPE_COPY.lastPrintsLabel}
            </div>
            <ul className="divide-y divide-[#0E0D0C]/20 font-plex text-xs sm:text-[13px] tabular-nums">
              {trades.slice(0, 5).map((trade, idx) => {
                const amount = formatTradeAmountCc(trade.amountCc);
                const ago = formatRelativeTime(trade.timestamp, nowMs);
                const safeHint = formatSafeTraderHint(trade.participantHint);
                return (
                  <li
                    key={`${trade.side}-${amount}-${ago}-${idx}`}
                    className="py-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                  >
                    <span className="text-[#0E0D0C]">
                      <strong className="font-bold">{trade.side}</strong>
                      {' • '}
                      {amount}
                      {' • '}
                      {ago}
                    </span>
                    {safeHint && (
                      <span className="text-[11px] text-[#0E0D0C]/65 truncate max-w-[16ch]">
                        {safeHint}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Section Footer Small Print */}
        <footer className="mt-3 pt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 font-plex text-[11px] text-[#0E0D0C]/75">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {THE_TAPE_COPY.asOfPrefix} {asOfFormatted}
            </span>
            {isStale && (
              <span className="px-1.5 py-0.5 border border-[#C23B22] text-[#C23B22] font-bold text-[10px] uppercase tracking-wider">
                {THE_TAPE_COPY.staleBadge}
              </span>
            )}
          </div>
          <a
            href={CBULL.buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#0E0D0C] underline underline-offset-4 hover:text-[#C23B22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E0D0C] min-h-[36px] inline-flex items-center self-start sm:self-auto"
          >
            {THE_TAPE_COPY.supanovaLink}
          </a>
        </footer>
      </div>
    </section>
  );
};
