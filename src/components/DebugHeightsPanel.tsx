import React, { useEffect, useRef, useState, useCallback } from 'react';

interface SectionMetric {
  label: string;
  top: number;
  height: number;
}

interface ViewportMetrics {
  innerHeight: number;
  svh: number;
  lvh: number;
  dvh: number;
  isIosSafari: boolean;
  sections: SectionMetric[];
}

function getElementLabel(el: Element, index: number): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const classList = Array.from(el.classList).filter(
    (c) =>
      c !== 'relative' &&
      c !== 'w-full' &&
      c !== 'select-none' &&
      c !== 'overflow-hidden' &&
      c !== 'box-border' &&
      !c.startsWith('bg-') &&
      !c.startsWith('text-') &&
      !c.startsWith('flex') &&
      !c.startsWith('px-') &&
      !c.startsWith('pt-') &&
      !c.startsWith('pb-')
  );
  if (classList.length > 0) return `.${classList[0]}`;
  return `${tag}[${index}]`;
}

export const DebugHeightsPanel: React.FC = () => {
  const svhProbeRef = useRef<HTMLDivElement>(null);
  const lvhProbeRef = useRef<HTMLDivElement>(null);
  const dvhProbeRef = useRef<HTMLDivElement>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [metrics, setMetrics] = useState<ViewportMetrics>({
    innerHeight: 0,
    svh: 0,
    lvh: 0,
    dvh: 0,
    isIosSafari: false,
    sections: [],
  });

  const measure = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const svh = svhProbeRef.current ? Math.round(svhProbeRef.current.getBoundingClientRect().height) : 0;
    const lvh = lvhProbeRef.current ? Math.round(lvhProbeRef.current.getBoundingClientRect().height) : 0;
    const dvh = dvhProbeRef.current ? Math.round(dvhProbeRef.current.getBoundingClientRect().height) : 0;
    const innerHeight = Math.round(window.innerHeight);
    const isIosSafari = document.documentElement.classList.contains('ios-safari');

    const topLevelNodes = Array.from(
      document.querySelectorAll('main > section, main > .pin-spacer > section, main > footer')
    );

    const sections: SectionMetric[] = topLevelNodes.map((el, idx) => {
      const rect = el.getBoundingClientRect();
      return {
        label: getElementLabel(el, idx),
        top: Math.round(rect.top + window.scrollY),
        height: Math.round(rect.height),
      };
    });

    setMetrics({ innerHeight, svh, lvh, dvh, isIosSafari, sections });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number | null = null;
    const scheduleMeasure = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        measure();
      });
    };

    measure();
    const initTimer = window.setTimeout(measure, 350);

    window.addEventListener('resize', scheduleMeasure, { passive: true });
    window.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('orientationchange', scheduleMeasure);
    window.visualViewport?.addEventListener('resize', scheduleMeasure);
    window.visualViewport?.addEventListener('scroll', scheduleMeasure);

    const mainEl = document.querySelector('main');
    const ro = typeof ResizeObserver !== 'undefined' && mainEl ? new ResizeObserver(scheduleMeasure) : null;
    if (ro && mainEl) ro.observe(mainEl);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.clearTimeout(initTimer);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
      window.visualViewport?.removeEventListener('resize', scheduleMeasure);
      window.visualViewport?.removeEventListener('scroll', scheduleMeasure);
      ro?.disconnect();
    };
  }, [measure]);

  return (
    <>
      {/* Hidden probe elements for live 100svh, 100lvh, and 100dvh pixel measurement */}
      <div aria-hidden="true" className="pointer-events-none fixed left-[-9999px] top-0 w-px invisible">
        <div ref={svhProbeRef} style={{ height: '100svh' }} />
        <div ref={lvhProbeRef} style={{ height: '100lvh' }} />
        <div ref={dvhProbeRef} style={{ height: '100dvh' }} />
      </div>

      {/* Fixed debug heights panel */}
      <aside
        aria-label="Heights debug panel"
        data-no-tapfx
        className="fixed top-2 left-2 z-[99998] w-[260px] max-w-[calc(100vw-16px)] bg-[#0E0D0C]/95 text-[#E8DFC9] border-2 border-[#C97B1A] font-plex text-[10px] leading-snug p-2.5 shadow-[3px_3px_0_#000] select-text"
        style={{ maxHeight: 'calc(100svh - 16px)', overflowY: 'auto' }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#C97B1A]/40 pb-1.5 mb-1.5">
          <span className="font-bold text-[#F2B24A] uppercase tracking-wider">
            HEIGHTS {metrics.isIosSafari ? '[iOS]' : '[DEFAULT]'}
          </span>
          <button
            type="button"
            data-no-tapfx
            onClick={() => setCollapsed((prev) => !prev)}
            className="px-1.5 py-0.5 border border-[#C97B1A]/60 text-[#F2B24A] uppercase text-[9px] cursor-pointer"
          >
            {collapsed ? 'SHOW' : 'HIDE'}
          </button>
        </div>

        {!collapsed && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 tabular-nums border-b border-[#C97B1A]/30 pb-1.5">
              <span>innerHeight: {metrics.innerHeight}px</span>
              <span>100svh: {metrics.svh}px</span>
              <span>100lvh: {metrics.lvh}px</span>
              <span>100dvh: {metrics.dvh}px</span>
            </div>

            <div className="space-y-1 tabular-nums">
              {metrics.sections.map((sec, idx) => (
                <div key={`${sec.label}-${idx}`} className="flex items-center justify-between gap-2">
                  <span className="truncate text-[#F2B24A]">{sec.label}</span>
                  <span className="shrink-0 text-[#E8DFC9]/90">
                    top {sec.top}px · h {sec.height}px
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
