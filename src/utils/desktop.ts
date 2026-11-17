export const DESKTOP_MEDIA_QUERY = '(min-width: 1024px) and (pointer: fine)';

export function isDesktopViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}
