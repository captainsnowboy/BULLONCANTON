let currentToastText = '';
const toastListeners = new Set<(text: string) => void>();
let hideTimeout: number | null = null;

export function showToast(text: string, duration = 3000): void {
  if (typeof window === 'undefined') return;
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  currentToastText = text;
  toastListeners.forEach((fn) => fn(currentToastText));

  hideTimeout = window.setTimeout(() => {
    currentToastText = '';
    toastListeners.forEach((fn) => fn(''));
    hideTimeout = null;
  }, duration);
}

export function subscribeToast(fn: (text: string) => void): () => void {
  toastListeners.add(fn);
  return () => {
    toastListeners.delete(fn);
  };
}
