import { TAP_FX_WORDS } from '../copy.js';
import { playTapSound } from './audio';
import { emitSteam } from './steam';
import { isDesktopViewport } from './desktop';

export const STEAM_SCALE = 1;

/**
 * Tap anywhere: nostril-style steam puffs and a bull sound-word appear where the
 * visitor tapped. Everything is created imperatively (no React state per tap) and
 * removed when its animation ends. Only transform and opacity are animated.
 */
const SKIP_SELECTOR =
  'button, a, input, textarea, select, label, summary, canvas, [role="button"], [data-no-tapfx]';
const MAX_ACTIVE = 28;
const MIN_GAP_MS = 180;

export function initTapFx(): () => void {
  if (typeof document === 'undefined') return () => {};

  if (document.fonts?.load) {
    document.fonts.load('24px Bangers').catch(() => {});
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '60',
    overflow: 'hidden',
  });
  document.body.appendChild(layer);

  let down: { x: number; y: number; t: number; id: number; target: EventTarget | null } | null = null;
  let last = 0;

  const spawn = (x: number, y: number) => {
    if (layer.childElementCount > MAX_ACTIVE) return;
    playTapSound();

    // Steam puffs matching hero nostril steam
    if (!reduced) {
      emitSteam(layer, x, y, { scale: STEAM_SCALE });
    }

    // Sound-word just above the steam
    const word = TAP_FX_WORDS[Math.floor(Math.random() * TAP_FX_WORDS.length)];
    const tag = document.createElement('div');
    tag.textContent = word;
    const size = 20 + Math.random() * 8; // 20px to 28px
    const tilt = (Math.random() - 0.5) * 16; // +-8deg
    const cx = Math.min(Math.max(x, 60), window.innerWidth - 60);
    Object.assign(tag.style, {
      position: 'absolute',
      left: `${cx}px`,
      top: `${Math.max(y - 26, 44)}px`,
      font: `400 ${size}px/1 "Bangers", cursive, sans-serif`,
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
      color: '#E8DFC9',
      WebkitTextStroke: '2.5px #0E0D0C',
      paintOrder: 'stroke fill',
      textShadow: '2px 3px 0 #0E0D0C',
      whiteSpace: 'nowrap',
      opacity: '0',
    });
    layer.appendChild(tag);
    const rise = reduced ? 0 : 28;
    tag.animate(
      [
        { transform: `translate(-50%, -100%) rotate(${tilt}deg) scale(0.6)`, opacity: 0 },
        { transform: `translate(-50%, calc(-100% - ${rise * 0.3}px)) rotate(${tilt}deg) scale(1.15)`, opacity: 1, offset: 0.2 },
        { transform: `translate(-50%, calc(-100% - ${rise * 0.7}px)) rotate(${tilt}deg) scale(1)`, opacity: 1, offset: 0.7 },
        { transform: `translate(-50%, calc(-100% - ${rise}px)) rotate(${tilt}deg) scale(1)`, opacity: 0 },
      ],
      { duration: 800, easing: 'ease-out', fill: 'forwards' }
    ).onfinish = () => tag.remove();
  };

  const isOnDesktopScrollbar = (e: PointerEvent) => {
    const doc = document.documentElement;
    return e.clientX >= doc.clientWidth || e.clientY >= doc.clientHeight;
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (isDesktopViewport() && isOnDesktopScrollbar(e)) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, target: e.target };
  };
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    const desktop = isDesktopViewport();
    if (desktop) {
      if (e.pointerId !== down.id) return;
      if (e.pointerType === 'mouse' && e.button !== 0) {
        down = null;
        return;
      }
      if (isOnDesktopScrollbar(e)) {
        down = null;
        return;
      }
    }
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const held = performance.now() - down.t;
    const target = down.target as Element | null;
    down = null;
    if (moved > 10 || held > 500) return; // a scroll or a long press, not a tap
    if (desktop) {
      const sel = window.getSelection?.();
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;
    }
    if (target && target.closest && target.closest(SKIP_SELECTOR)) return;
    const now = performance.now();
    if (now - last < MIN_GAP_MS) return;
    last = now;
    spawn(e.clientX, e.clientY);
  };
  const onCancel = () => {
    down = null;
  };

  document.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('pointerup', onUp, { passive: true });
  document.addEventListener('pointercancel', onCancel, { passive: true });

  return () => {
    document.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
    layer.remove();
  };
}
