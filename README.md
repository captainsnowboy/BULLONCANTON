# BULL ON CANTON (STAGES 1 - 5)

> "THE BULLS ARE ONCHAIN."

A deadpan bronze bull meme website built with Vite, React, Tailwind CSS, and GSAP.

---

## Configuration (`src/config.js`)

Edit `src/config.js` to customize the behavior and links:

```javascript
// Target URL when the BUY button is charged to 100%.
// Leave as empty string "" to display the "ORDER PENDING - MARKET OPENS SOON" stamp.
export const BUY_URL = "";

// Set to true when you replace the hero image with bull-hero-nopupils.png.
// When true, live tracking pupils follow the user's cursor / touch movements.
// When false, the entire bull tilts subtly with cursor parallax.
export const EYE_TRACKING = false;

// Social URLs (leave as "" to show fallback state or hide)
export const X_URL = "";
export const TELEGRAM_URL = "";
```

---

## Assets Directory (`public/assets/`)

Place all image assets in `/public/assets/`. All filenames are strictly mapped:

| Filename | Purpose | Recommended Size | Current Status |
|---|---|---|---|
| `bull-hero-final.png` | Main hero bull character in suit with pupils | 1200 x 1200 px (Square PNG, solid #000 bg) | **Real Image (Active)** |
| `bull-charge.png` | Bull sprinting full-body charging right | 1200 x 1200 px PNG (transparent) | **Real Image (Active)** |
| `bull-peek.png` | Top of bull head peeking over edge | 800 x 800 px PNG (transparent) | **Real Image (Active)** |
| `bull-standing.png` | Full-length standing bull brushing dust off lapel | 1200 x 1600 px PNG (transparent) | **Real Image (Active)** |
| `bull-browraise.png` | Bull eyebrow-raised reaction (Arrivals Board & Meme Desk) | 1200 x 1200 px PNG (solid #000 bg) | **Real Image (Active)** |
| `bull-smug.png` | Bull smug smirk reaction (Arrivals Board & Meme Desk) | 1200 x 1200 px PNG (solid #000 bg) | **Real Image (Active)** |
| `bull-shocked.png` | Deadpan shocked bull expression (Meme Desk) | 1200 x 1200 px PNG (solid #000 bg) | **Real Image (Active in Stage 4)** |
| `bull-watch.png` | Bull checking wristwatch expression (Meme Desk) | 1200 x 1200 px PNG (solid #000 bg) | **Real Image (Active in Stage 4)** |
| `favicon.png` | Browser tab icon | 512 x 512 px PNG | **Real Image (Active)** |
| `og-image.jpg` | Social share preview image (Twitter/OG) | 1200 x 630 px JPG/PNG | **Real Image (Active)** |
| `bull-hero-nopupils.png` | Hero bull character with empty eye whites for pupil tracking | 1200 x 1200 px PNG (solid #000 bg) | **Real Image (Active in Eye Mode)** |

---

## The Arrivals Board (`src/sections/Arrivals.jsx`)

A departure board titled **"WALL STREET -> CANTON"** displaying real verified announcements of institutions building, piloting, or deploying on Canton Network.

- **Split-Flap Animation**: Status and Institution fields flip character-by-character when scrolled into view.
- **Synthesized Click**: Plays procedural Web Audio card ticks when flipping (respects audio toggle).
- **Accordion Receipts**: Clicking any row expands a detailed receipt card with red `"SOURCE ATTACHED"` stamp, smug bull reaction, and direct link to X/source.
- **Final Row**: A permanent static row for `"YOUR BANK"` with status `"BOARDING"`, revealing a skeptical eyebrow-raise bull (`bull-browraise.png`) and the deadpan line *"Don't hold your breath."*

---

## How to add a receipt

All receipts are read strictly from `src/data/arrivals.json`. Never invent institutions or claims.

### Data Schema
Each entry in `src/data/arrivals.json` must follow this schema:

```json
{
  "id": "unique-slug-identifier",
  "institution": "Name exactly as written by source",
  "headline": "One line, plain words describing what happened",
  "date": "YYYY-MM-DD",
  "source": "https://... (direct link to announcement or tweet)",
  "sourceBy": "Author or entity that posted it",
  "sourceType": "official | press release | media report",
  "status": "ARRIVED | PILOT | ANNOUNCED",
  "image": "optional relative path to screenshot, e.g. /assets/receipts/dtcc.jpg",
  "placeholder": false
}
```

### Example Row
```json
{
  "id": "bny-mellon-pilot",
  "institution": "BNY Mellon",
  "headline": "Joined Canton Network interoperability pilot for tokenized assets",
  "date": "2024-03-01",
  "source": "https://x.com/CantonNetwork/status/example",
  "sourceBy": "Canton Network Official",
  "sourceType": "official",
  "status": "PILOT",
  "image": "",
  "placeholder": false
}
```

> **Note on Placeholders**:
> Rows with `"placeholder": true` will display a red `"SAMPLE - REPLACE"` tag on the board and trigger a console warning. Remember to set `"placeholder": false` or remove sample rows once you add real receipts. The counter `"ARRIVALS LOGGED: N"` only counts non-placeholder rows.

---

## The Charge Section (`src/sections/Charge.jsx`)

The Charge sequence is driven by an oblique 3D brick wall engine and a single normalized progress engine (`0.0` to `1.0`) with zero per-frame React re-renders:

- **Torn-Paper Entrance**: An SVG torn-paper edge in newsprint colour (`#E8DFC9`) overlaps the hero bottom, reading as a fresh page.
- **Time-Based Intro**: When ~20% of the section is visible, the headline slams in (`scale 1.15 -> 1`, thud impact), satirical front pages are dealt in from the top stamped red, and `bull-peek.png` rises into view without scrolling or holding.
- **Progression (0.0 to 0.35)**: Front pages slide away upward, the 3D Wall Street brick wall rises from the ground with its WALL ST. sign (dust squares puff on landing), and `bull-charge.png` enters from the left edge to the REST mark (14% of sw from wall outer edge).
- **At Rest (0.35 to 0.62)**: Bull rests with breathing bob (3px, 1.2s loop) and foot stomp (-1° to 1°). While button is held between rams, switches to faster bob and paw-scrape wiggle.
- **Oblique 3D Wall Geometry**:
  - Front face: 11 rows of running-bond bricks (49 individual bricks with 2px jitter and 3px dark ink mortar outlines).
  - Left side face: 11 rows (1 slab piece + 2 struck pieces at contact point height).
  - Top cap: stone coping with 14-unit lighter stone band along front edge.
  - Steel post with blade-style WALL ST. sign plate and red offset shadow (z-index: 22, in front of bull).
- **Ram Thresholds ([0.62, 0.78, 0.90])**:
  - **Ram 1 (0.62)**: 350ms wind-up, 220ms dash with 3 speed lines, 120ms freeze (squash, 8-point starburst, 6px shake, Level 1 cracks, dust squares, side bricks slide 6px, sign post sways ±4°), 450ms hop arc rebound.
  - **Ram 2 (0.78)**: Wind-up, dash, 8px shake, Level 2 cracks, struck bricks slide 12px, 3 loose top bricks drop, post leans -8°, left bolt pops off and falls, plate hangs crooked (-6°), rebound.
  - **Ram 3 (0.90)**: Wind-up, dash, 12px shake, Level 3 cracks reach top & far edge, struck side bricks fall leaving dark holes, front bricks drop, post bends -18°, plate swings like a damped pendulum, rebound.
  - Each ram pauses progress for ~1.3s until its animation finishes.
- **Breach (1.0)**: Final charge goes through the wall; all pieces fly into rubble with random velocities and gravity, sign plate falls and rests at -15°, 14px shake, bull stands 500ms, background shifts from newsprint to ink black (`#0E0D0C`), and `bull-standing.png` rises with deadpan speech bubble.
- **Replay ("RUN IT BACK")**: Restores all bricks, cap, sign, and post in 800ms, clears cracks, returns background to newsprint, and resets progress.
- **Mobile vs Desktop**:
  - **Mobile (<768px)**: Big `HOLD TO CHARGE` button. Held: target rises over 5s. Released: drains slowly, but never below last reached ram threshold so damage stays.
  - **Desktop (>=768px)**: ScrollTrigger pins section for +=350% scroll and maps to target. Scrolling back up below threshold fades cracks out in 300ms.
- **Prefers-Reduced-Motion**: No pin, no shake, no flying pieces. Four static panels (Newspapers, Intact Wall, Cracked Wall, Breached Wall) with SVG states.

### Named Constants
Located at the top of `src/sections/Charge.jsx`:
- `HOLD_SECONDS = 5` (Mobile full charge duration in seconds)
- `RAM_THRESHOLDS = [0.62, 0.78, 0.90]` (Progress thresholds for rams 1, 2, and 3)
- `BREACH = 1` (Threshold for full wall breach)
- `BRICK_CAP = 60` (Maximum animated pieces constraint)

---

## The Meme Desk (`src/sections/MemeDesk.jsx`)

A fast, client-side meme generator built directly with the HTML5 Canvas 2D API. No servers, no uploads, no logins, no analytics.

### Layout & Features
- **Mobile-first**: Canvas preview on top (`max-h-[65vh]`), controls grouped below in 3 steps: `1 Pick`, `2 Write`, `3 Send`.
- **High-Resolution Exports**: Generates crisp 1080x1080px (Classic & Speech Bubble) or 1080x1350px (Front Page) PNGs.
- **Interactive Stamp**: Select an optional red rubber stamp (`ORDER PENDING`, `MARKET CLOSED`, `APPROVED`, `DENIED`), drag it directly across the canvas to reposition, and resize it with the slider.
- **Text Engine**: Auto-shrinks long text down to 20px with word wrapping and high-contrast letter outlines.
- **Export Actions**: Native `navigator.share` (with file attachment), Clipboard API image copying (`navigator.clipboard.write`), one-click PNG download, and pre-filled post on X.

### Image Background Rules
- **Solid Black Backgrounds**: `bull-hero-final.png`, `bull-browraise.png`, `bull-smug.png`, `bull-shocked.png`, and `bull-watch.png` have solid `#000000` backgrounds. In the Front Page template, the image is rendered with a dark mat and an 8px solid border so the black background never clashes with the newsprint texture.
- **Transparent Cutouts**: `bull-charge.png`, `bull-peek.png`, and `bull-standing.png` have transparent backgrounds.

### How to Add a New Mascot Expression
1. Drop the PNG into `/public/assets/` (e.g. `bull-wink.png`).
2. Open `src/copy.js` and add an entry to `MEME_DESK_COPY.bulls`:
   ```javascript
   { id: 'wink', label: 'Wink', file: 'bull-wink.png' },
   ```
3. The thumbnail and canvas renderer will instantly include it.

### How to Add a Template
1. In `src/copy.js`, add a new definition to `MEME_DESK_COPY.templates`:
   ```javascript
   { id: 'breaking', label: 'Breaking News', desc: 'TV broadcast overlay banner' },
   ```
2. In `src/sections/MemeDesk.jsx`, add a render branch in `renderCanvas()` handling canvas dimensions, artwork layout, and text styling.

---

## Herd and Easter Eggs (`src/sections/Herd.jsx`)

### Join The Herd
- **Reused Buy Component**: Directly reuses the Stage 1 `BuyButton` ("Hold to Charge") driven by `BUY_URL`.
- **Stampede ("Run with the herd")**: Spawns 16 bulls (`/assets/bull-charge.png`) running left-to-right across the screen in staggered vertical lanes, different sizes (45–115px), and varied speeds with an up-and-down bob.
  - Layer is fixed full-screen with `pointer-events: none`.
  - All DOM elements are cleaned up once the stampede concludes.
  - Concurrency lock: presses during an active stampede are ignored.
  - `prefers-reduced-motion`: Stampede is bypassed and the community links panel reveals immediately.
- **Herd Size**: A session-only in-memory counter tracks how many times the herd has run.
- **Community Links Panel**: Slides up after the first run displaying configured X and Telegram buttons, or *"Links open at launch."* if unset.

### Sound Toggle Architecture
- **Unified Master Gain**: All synthesized procedural sounds (NYSE bell, bull snort, wall impact thud, split-flap board ticks, and galloping hoof thuds) now route through a single shared `AudioContext` and one master `GainNode` in `src/utils/audio.ts`.
- **Default State**: Sound is strictly **OFF** by default. No audio plays until the user explicitly clicks the fixed top-right toggle.
- **Corner Button**: Fixed at the top-right corner with `aria-pressed`, 44px+ touch target, and high-contrast labels (`Sound on` / `Sound off`).

### Easter Eggs
- **Typing "wen"**: Typing `wen` anywhere on the page (outside input/textarea fields) triggers a 3-second toast cycling through dry corporate-degen lines (*"Check the ticker."*, *"Soon enough."*, *"Ask me on a weekday."*, *"Wen what."*, *"Patience is a position."*).
- **Typing "bull"**: Typing `bull` anywhere on the page triggers the herd stampede.
- **Disclaimer 5-Click**: Rapidly clicking the footer disclaimer text 5 times triggers the toast *"Yes, it says what it says."*
- **Single Toast Discipline**: Managed centrally via `src/utils/toast.ts` so only one toast displays at a time.


