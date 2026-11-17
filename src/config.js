/**
 * BULL ON CANTON - CONFIGURATION
 * 
 * Update these constants to configure links and interactive modes.
 */

// Target URL when Buy button charge reaches 100%. If empty (""), shows launch pending stamp.
/** @type {string} */
export const BUY_URL = "";

// If true, loads bull-hero-nopupils.webp and renders live cursor/touch tracking pupils.
// If false, subtly tilts and shifts the whole bull image with cursor parallax.
/** @type {boolean} */
export const EYE_TRACKING = false;

// Social & community links
/** @type {string} */
export const X_URL = "https://x.com/bulloncanton";
/** @type {string} */
export const TELEGRAM_URL = "https://t.me/bulloncanton";
/** @type {string} */
export const TOKEN_TICKER = "$CBULL";

// Separate clue engraved on the desk coin (must stay "$QQQ")
/** @type {string} */
export const COIN_TEXT = "$QQQ";

// Token address displayed in Join the Herd. Leave empty ("") until launched.
/** @type {string} */
export const TOKEN_ADDRESS = "";

// Receipts monitor last-updated date (YYYY-MM-DD). Change whenever arrivals.json changes.
/** @type {string} */
export const RECEIPTS_UPDATED = "2026-11-14";

// Set to false to test the game; set back to true before publishing
/** @type {boolean} */
export const GAME_COMING_SOON = true;

// Bull Run seasonal Herd Pass configuration
/** @type {{ id: string; name: string; ends: string }} */
export const SEASON = { id: "S1", name: "Season 1", ends: "2026-12-31" };

/** @type {Array<{ hash: string; tier: "herd" | "bull" | "alpha"; season: string }>} */
export const HERD_CODES = [];

/** @type {boolean} */
export const HERD_PERKS_ENABLED = true;

// Weekly challenge configuration
/** @type {{ week: string; target: number; text: string }} */
export const WEEKLY_CHALLENGE = {
  week: "2026-W47",
  target: 3000,
  text: "Beat 3,000 this week.",
};

// Optional animation tuning overrides (populated from ?debug=anim "Copy settings")
/** @type {Record<string, unknown>} */
export const ANIM_TUNE = {};

// End credits overlay music track and target volume (0 to 1)
/** @type {string} */
export const CREDITS_AUDIO = "/assets/audio/credits.mp3";
/** @type {number} */
export const CREDITS_MUSIC_VOLUME = 0.55;
