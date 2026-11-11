import React, { useEffect, useState } from 'react';
import { TICKER_ITEMS } from '../copy.js';

export function getNyseStatus(overrideWeekend?: boolean) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  let weekday = '';
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const p of parts) {
    if (p.type === 'weekday') weekday = p.value;
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
    if (p.type === 'second') second = parseInt(p.value, 10);
  }

  const realWeekend = weekday === 'Sat' || weekday === 'Sun';
  const isWeekend = overrideWeekend !== undefined ? overrideWeekend : realWeekend;

  const minuteOfDay = hour * 60 + minute;
  const marketOpen = 9 * 60 + 30; // 9:30 AM (570)
  const marketClose = 16 * 60;    // 16:00 PM (960)

  const isOpen = !isWeekend && minuteOfDay >= marketOpen && minuteOfDay < marketClose;

  return {
    isOpen,
    isWeekend,
    statusText: isOpen ? 'NYSE: OPEN' : 'NYSE: CLOSED',
    timeString: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} NYC`,
    weekday
  };
}

interface TickerTapeProps {
  forceWeekend?: boolean;
}

export const TickerTape: React.FC<TickerTapeProps> = ({ forceWeekend }) => {
  const [nyse, setNyse] = useState(() => getNyseStatus(forceWeekend));

  useEffect(() => {
    const update = () => setNyse(getNyseStatus(forceWeekend));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [forceWeekend]);

  // Combine live NYSE status with fictional joke tickers
  const allItems = [
    { text: nyse.statusText, isLive: true, isOpen: nyse.isOpen },
    ...TICKER_ITEMS.map((item) => ({ text: item, isLive: false, isOpen: false }))
  ];

  return (
    <aside
      aria-label="Market Ticker"
      className="fixed bottom-0 left-0 right-0 z-50 h-9 sm:h-10 bg-[#0E0D0C] border-t-2 border-[#C97B1A] flex items-center overflow-hidden select-none"
    >
      {/* Visual edge fade */}
      <div className="absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-[#0E0D0C] to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-[#0E0D0C] to-transparent pointer-events-none" />

      {/* Infinite Scrolling Ticker Track */}
      <div className="flex whitespace-nowrap animate-ticker">
        {/* Render twice for seamless loop */}
        {[0, 1].map((copyIndex) => (
          <div key={copyIndex} className="flex items-center space-x-6 sm:space-x-8 px-4" aria-hidden={copyIndex === 1}>
            {allItems.map((item, idx) => (
              <div key={idx} className="flex items-center space-x-2 text-xs sm:text-sm font-plex">
                {item.isLive ? (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-bold border ${
                      item.isOpen
                        ? 'border-[#2FD27A] text-[#2FD27A] bg-[#2FD27A]/10'
                        : 'border-[#C23B22] text-[#C23B22] bg-[#C23B22]/10'
                    }`}
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        item.isOpen ? 'bg-[#2FD27A] animate-pulse' : 'bg-[#C23B22]'
                      }`}
                    />
                    {item.text}
                    <span className="text-[10px] opacity-75 font-normal tracking-tight ml-1">
                      ({nyse.timeString})
                    </span>
                  </span>
                ) : (
                  <span className="text-[#E8DFC9] hover:text-[#F2B24A] transition-colors">
                    {item.text}
                  </span>
                )}
                <span className="text-[#C97B1A]/40 font-bold select-none">•</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          display: flex;
          width: max-content;
          animation: tickerScroll 42s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-ticker {
            animation: none !important;
            overflow-x: auto;
          }
        }
      `}</style>
    </aside>
  );
};
