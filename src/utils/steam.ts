export interface EmitSteamOptions {
  scale?: number;
  driftDir?: -1 | 1;
  jitterPx?: number;
}

/**
 * Emits 5 to 7 flat cream steam puffs (#E8DFC9 @ 60% opacity) rising 40-70px
 * and drifting outward over 900ms with cubic-bezier(0.25, 1, 0.5, 1) easing.
 */
export function emitSteam(
  layer: HTMLElement | null,
  x: number,
  y: number,
  opts?: EmitSteamOptions
): void {
  if (!layer || typeof document === 'undefined') return;
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  const scale = opts?.scale ?? 1;
  const jitter = (opts?.jitterPx ?? 4) * scale;
  const count = Math.floor(5 + Math.random() * 3); // 5 to 7 puffs

  for (let i = 0; i < count; i++) {
    const sizePx = Math.round((8 + Math.random() * 8) * scale); // 8 to 16px
    const risePx = Math.round((40 + Math.random() * 30) * scale); // 40 to 70px
    const dir = opts?.driftDir ?? (Math.random() < 0.5 ? -1 : 1);
    const driftPx = dir * Math.round((8 + Math.random() * 14) * scale);

    const sx = x + (Math.random() - 0.5) * jitter * 2;
    const sy = y + (Math.random() - 0.5) * jitter * 2;

    const puff = document.createElement('div');
    Object.assign(puff.style, {
      position: 'absolute',
      left: `${sx}px`,
      top: `${sy}px`,
      width: `${sizePx}px`,
      height: `${sizePx}px`,
      borderRadius: '50%',
      backgroundColor: 'rgba(232, 223, 201, 0.6)',
      pointerEvents: 'none',
      opacity: '0',
    });
    layer.appendChild(puff);

    const anim = puff.animate(
      [
        {
          opacity: 0.6,
          transform: 'translate(-50%, -50%) translate3d(0, 0, 0) scale(0.7)',
        },
        {
          opacity: 0.45,
          offset: 0.7,
        },
        {
          opacity: 0,
          transform: `translate(-50%, -50%) translate3d(${driftPx}px, -${risePx}px, 0) scale(1.3)`,
        },
      ],
      {
        duration: 900,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        fill: 'forwards',
      }
    );
    anim.onfinish = () => puff.remove();
    anim.oncancel = () => puff.remove();
  }
}
