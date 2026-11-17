import { useCallback, useEffect, useRef } from 'react';
import { isDesktopViewport } from './desktop';

export interface DragBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Options {
  /** Viewport-coordinate box the element must stay inside. Defaults to the viewport minus the ticker. */
  getBounds?: (el: HTMLElement, isDragging: boolean) => DragBounds;
  /**
   * Container element (e.g. Hero section). When provided:
   * - Position is stored in memory as fractions (fx, fy) of the container box.
   * - Window resize & scroll listeners are skipped; only a ResizeObserver on the
   *   container re-clamps, ignoring height-only changes < 120px and skipping while off screen.
   */
  getContainer?: (el: HTMLElement) => HTMLElement | null;
  /** Pixels of movement before a press counts as a drag (below this it stays a normal tap). */
  threshold?: number;
  /** Keeps the position in memory if the component remounts. */
  memoryKey?: string;
}

const pixelMemory: Record<string, { x: number; y: number }> = {};
const fractionMemory: Record<string, { fx: number; fy: number }> = {};

function defaultBounds(): DragBounds {
  const ticker = document.querySelector('[data-ticker]') as HTMLElement | null;
  const tickerH = ticker ? ticker.getBoundingClientRect().height : 40;
  return { left: 8, top: 8, right: window.innerWidth - 8, bottom: window.innerHeight - tickerH - 8 };
}

function isRectOffScreen(r: DOMRect): boolean {
  return r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth;
}

/**
 * Makes ONE wrapper element draggable with mouse, touch or pen.
 * Put `ref` and `bind` on a wrapper div and keep the real <button> inside it,
 * so the button keeps its own transforms and click handler.
 * A press that moves less than `threshold` px is a normal click.
 */
export function useDraggable<T extends HTMLElement>({
  getBounds,
  getContainer,
  threshold = 6,
  memoryKey,
}: Options = {}) {
  const ref = useRef<T | null>(null);
  const usesFractions = Boolean(getContainer);
  const offset = useRef(
    !usesFractions && memoryKey && pixelMemory[memoryKey]
      ? { ...pixelMemory[memoryKey] }
      : { x: 0, y: 0 }
  );
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  const apply = useCallback(() => {
    if (ref.current) {
      ref.current.style.transform = `translate3d(${offset.current.x}px, ${offset.current.y}px, 0)`;
    }
  }, []);

  // Nudge the element back inside the bounds (with optional active-drag flag).
  const clamp = useCallback(
    (isDragging = false) => {
      const el = ref.current;
      if (!el) return;
      const b = getBounds ? getBounds(el, isDragging) : defaultBounds();
      const r = el.getBoundingClientRect();
      let dx = 0;
      let dy = 0;
      if (r.left < b.left) dx = b.left - r.left;
      else if (r.right > b.right) dx = b.right - r.right;
      if (r.top < b.top) dy = b.top - r.top;
      else if (r.bottom > b.bottom) dy = b.bottom - r.bottom;
      if (dx || dy) {
        offset.current = { x: offset.current.x + dx, y: offset.current.y + dy };
        apply();
      }
    },
    [getBounds, apply]
  );

  // Sync container fraction (fx, fy) from the element's current center inside its container.
  const syncFractionFromDom = useCallback(() => {
    const el = ref.current;
    if (!el || !getContainer || !memoryKey) return;
    const container = getContainer(el);
    if (!container) return;
    const cr = container.getBoundingClientRect();
    if (cr.width <= 0 || cr.height <= 0) return;
    const er = el.getBoundingClientRect();
    const cx = er.left + er.width / 2;
    const cy = er.top + er.height / 2;
    fractionMemory[memoryKey] = {
      fx: (cx - cr.left) / cr.width,
      fy: (cy - cr.top) / cr.height,
    };
  }, [getContainer, memoryKey]);

  // Reposition element from stored (fx, fy) and clamp strictly inside container bounds.
  const applyFractionAndClamp = useCallback(() => {
    const el = ref.current;
    if (!el || !getContainer) return;
    const container = getContainer(el);
    if (!container) return;
    const cr = container.getBoundingClientRect();
    if (cr.width <= 0 || cr.height <= 0 || isRectOffScreen(cr)) return;

    if (memoryKey && fractionMemory[memoryKey]) {
      const { fx, fy } = fractionMemory[memoryKey];
      const er = el.getBoundingClientRect();
      const curCx = er.left + er.width / 2;
      const curCy = er.top + er.height / 2;
      const restCx = curCx - offset.current.x;
      const restCy = curCy - offset.current.y;
      const targetCx = cr.left + fx * cr.width;
      const targetCy = cr.top + fy * cr.height;
      offset.current = {
        x: targetCx - restCx,
        y: targetCy - restCy,
      };
      apply();
    } else {
      apply();
    }

    clamp(false);
    if (memoryKey && fractionMemory[memoryKey]) {
      syncFractionFromDom();
    }
  }, [getContainer, memoryKey, apply, clamp, syncFractionFromDom]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (getContainer) {
      const container = getContainer(el);
      if (!container) return;

      applyFractionAndClamp();

      const initialRect = container.getBoundingClientRect();
      let lastSize = { width: initialRect.width, height: initialRect.height };
      let firstObservation = true;

      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver((entries) => {
          const entry = entries[0];
          const nextW = entry ? entry.contentRect.width : container.getBoundingClientRect().width;
          const nextH = entry ? entry.contentRect.height : container.getBoundingClientRect().height;

          if (firstObservation) {
            firstObservation = false;
            lastSize = { width: nextW, height: nextH };
            return;
          }

          const cr = container.getBoundingClientRect();
          if (cr.width <= 0 || cr.height <= 0 || isRectOffScreen(cr)) return;

          const dw = Math.abs(nextW - lastSize.width);
          const dh = Math.abs(nextH - lastSize.height);
          // Ignore height-only changes under 120px on mobile (address bar collapse/expand)
          if (!isDesktopViewport() && dw < 1 && dh < 120) return;

          lastSize = { width: nextW, height: nextH };
          applyFractionAndClamp();
        });
        ro.observe(container);
        return () => ro.disconnect();
      }
      return;
    }

    // Viewport-mode (e.g. SoundToggle): ignore height changes < 120px on mobile only
    apply();
    clamp(false);
    let lastViewport = { width: window.innerWidth, height: window.innerHeight };

    const onResize = () => {
      const nextW = window.innerWidth;
      const nextH = window.innerHeight;
      const dw = Math.abs(nextW - lastViewport.width);
      const dh = Math.abs(nextH - lastViewport.height);
      if (!isDesktopViewport() && dw < 1 && dh < 120) return;
      lastViewport = { width: nextW, height: nextH };
      clamp(false);
      if (memoryKey) {
        pixelMemory[memoryKey] = { ...offset.current };
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [getContainer, memoryKey, apply, clamp, applyFractionAndClamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: offset.current.x,
      oy: offset.current.y,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < threshold) return;
      d.moved = true;
      // Capture only once it is a real drag, so a plain tap still reaches the button.
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    offset.current = { x: d.ox + dx, y: d.oy + dy };
    apply();
    clamp(true);
  };

  const end = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.moved) {
      justDragged.current = true;
      setTimeout(() => {
        justDragged.current = false;
      }, 60);
      if (getContainer) {
        syncFractionFromDom();
      } else if (memoryKey) {
        pixelMemory[memoryKey] = { ...offset.current };
      }
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  // After a drag, swallow the click so the button underneath does not toggle.
  const onClickCapture = (e: React.MouseEvent) => {
    if (justDragged.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return {
    ref,
    bind: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onClickCapture },
    style: { touchAction: 'none' as const, cursor: 'grab' as const },
  };
}
