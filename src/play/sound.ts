import type { GameSoundName } from './types';

/**
 * Sound hook for BULL RUN.
 * Intentionally a silent no-op until game audio is wired in a later pass.
 * Hook names: jump, land, coin, combo, hit, charge, growl, banner, wreck, pickup, ui, caught.
 */
export function playGameSound(_name: GameSoundName): void {
  // Silent hook preserved cleanly for all game events
}
