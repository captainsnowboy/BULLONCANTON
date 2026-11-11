# BULL ON CANTON

> "THE BULLS ARE ONCHAIN."

A deadpan bronze bull meme website built with Vite, React, Tailwind CSS, and GSAP.

---

## Configuration (`src/config.js`)

Edit `src/config.js` to customize the behavior and links:

```javascript
// Target URL when the BUY button is charged to 100%.
// Leave as empty string "" to display the "ORDER PENDING - MARKET OPENS SOON" stamp.
export const BUY_URL = "";

// Social URLs (leave as "" to show fallback state or hide)
export const X_URL = "";
export const TELEGRAM_URL = "";
```

---

## Hero Section (`src/components/Hero.tsx`)

The hero presents the mascot, trading desk atmosphere, and core interactive controls:

- **Bronze Trading Bell**: Hanging from the top edge on a short rope on the right side.
  - *Idle*: Gentle pendulum sway (±2°).
  - *On Tap*: Damped pendulum physics swing (starts near 18°, settles over ~2.5s, clapper swings out of phase). Extra taps add energy (capped at 25°).
  - *Sound & Confetti*: Tapping rings a synthesized trading bell (automatically turning sound on if off) and releases ticker-tape confetti from the bell's position.
  - *Reduced Motion*: Sway is disabled; tap gives a quick scale pulse and rings the bell.
- **Eye Mode & Shoulder Sticker**:
  - Located on the bull's right shoulder as a round sticker badge (44px+ hit area).
  - When off: The eyelid icon is closed; the mascot tilts with subtle cursor parallax.
  - When on: The eyelid opens with a quick blink, and the eye pupil tracks pointer/cursor coordinates live within custom almond-shaped eye boundaries.
  - Debugging: Add `?debug=eyes` to the URL to view bounding boxes and pupil coordinates.
- **Lapel Pin**: Standard-issue Canton bronze lapel pin on the bull's suit. Tapping triggers a golden sparkle fade and deadpan one-liners (*"Don't touch the merchandise."*, *"Standard issue lapel pin."*).
- **Mascot Taps**: Tapping the bull character triggers steam puffs from his nostrils, a slight head motion, and deadpan corporate one-liners (*"Per my last block."*, *"Sir, this is a Saturday."*). After 5 rapid taps, he states *"I'm working."* The mascot stays deadpan on tap.
- **Order Ticket (BUY Button)**: An onchain ticket with "HOLD TO CHARGE" button. Holding charges order progress to 100% with audio hum; early release cancels the order.

---

## Sound Architecture (`src/utils/audio.ts` & `src/components/SoundToggle.tsx`)

- **Single Audio Pipeline**: All audio is procedurally synthesized via the Web Audio API routing through a single shared `AudioContext` and master `GainNode`.
- **Default State**: Strictly **OFF** by default.
- **Floating Sound Button**:
  - Positioned at the bottom-right corner, floating safely above the fixed ticker tape and mobile safe areas.
  - *Off*: Speaker icon with slash, breathing gently.
  - *On*: Speaker icon with pulsing sequential sound wave arcs.
  - *On Tap*: Tactile squash-and-stretch bounce.
  - Tapping the hero bell also activates sound.
- **Procedural Synthesizers**: Trading bell, steam snort, wall impact thud, split-flap board ticks, and galloping hoof thuds.

---

## The Charge Section (`src/sections/Charge.jsx`)

The narrative transition where the bull charges Wall Street:

- **Torn-Paper Entrance**: An SVG torn-paper edge in newsprint colour (`#E8DFC9`) overlaps the hero bottom, reading as a fresh page.
- **Time-Based Intro**: When ~20% of the section is visible, the headline slams in (`scale 1.15 -> 1`, thud impact), satirical front pages are dealt in from the top stamped red, and `bull-peek.png` rises into view without scrolling or holding.
- **Progression (0.0 to 0.35)**: Front pages slide away upward, the 3D Wall Street brick wall rises from the ground with its WALL ST. sign, and `bull-charge.png` enters from the left edge to the REST mark.
- **At Rest (0.35 to 0.62)**: Bull rests with breathing bob and foot stomp. While button is held between rams, switches to faster bob and paw-scrape wiggle.
- **Ram Thresholds ([0.62, 0.78, 0.90])**:
  - **Ram 1 (0.62)**: Wind-up, dash with speed lines, freeze impact, 6px screen shake, Level 1 cracks, dust squares, and rebound hop.
  - **Ram 2 (0.78)**: Wind-up, dash, 8px shake, Level 2 cracks, struck bricks slide, loose bricks drop, sign post sways, and rebound hop.
  - **Ram 3 (0.90)**: Wind-up, dash, 12px shake, Level 3 cracks reach edges, sign post bends, plate swings like a damped pendulum, and rebound hop.
  - Each ram pauses progress for ~1s until its animation finishes.
- **Breach (1.0)**: Final charge goes through the wall; all pieces fly into rubble, sign plate falls, 14px shake, and `bull-standing.png` rises with deadpan speech bubble.
- **Replay ("RUN IT BACK")**: Restores wall, clears cracks, returns background to newsprint, and resets progress.
- **Mobile vs Desktop**:
  - **Mobile (<768px)**: `HOLD TO CHARGE` button. Held: progress rises over 5s. Released: drains slowly, but never below last reached ram threshold.
  - **Desktop (>=768px)**: ScrollTrigger pins section and maps scroll to progress. Scrolling back up below threshold fades cracks.
- **Prefers-Reduced-Motion**: No pin, no shake, no flying pieces. Static SVG sequence states.

---

## The Arrivals Board (`src/sections/Arrivals.jsx`)

An airport-style board titled **"WALL STREET -> CANTON"** displaying public announcements of institutions building, piloting, or deploying on Canton Network.

### Layout & Interaction
- **Desktop (≥900px) Two Columns**:
  - *Left*: Arrivals board with filter chips (`ALL`, `ARRIVED`, `PILOT`, `ANNOUNCED`) displaying counts, date sort toggle (`NEWEST` / `OLDEST`), split-flap character flipping on load, a thin bronze marker (`#F2B24A`) pointing at the selected row, and <kbd>↑</kbd>/<kbd>↓</kbd> keyboard arrow navigation.
  - *Right (Sticky)*: Thermal receipt printer with a dark slot graphic. Selecting a row feeds out a paper receipt in discrete steps (~700ms with ratcheting click sounds), showing headline, date, author, source type, optional screenshot, and `VIEW SOURCE` button. A red ink stamp `SOURCE ATTACHED` lands on the receipt. Beside the printer, a bronze framed reaction picture of the bull (`bull-smug.png`) crossfades in.
  - *Tear-off Drop*: Selecting another row tears the old receipt off (drops away) and feeds the new one.
  - *Final Row*: A permanent row for `"YOUR BANK"` with status `"BOARDING"`, showing skeptical bull (`bull-browraise.png`), compliance review notice, and no source button.
- **Mobile (<900px)**:
  - Board renders full width.
  - Tapping a row slides up a 75dvh bottom sheet with a grab handle, reaction thumbnail at the top, stepped receipt printing, and background scroll locking.
  - Dismissible by tapping outside, swiping down, pressing <kbd>Esc</kbd>, or clicking the close button.
- **"Now Boarding" Banner**:
  - Airport announcement banner above the board cycling through public rows every 4 seconds. Stops cycling as soon as the visitor interacts. Tapping opens that row.

### How to add a receipt
All receipts are read strictly from `src/data/arrivals.json`. Never invent institutions or claims.

#### Data Schema
```json
{
  "id": "unique-slug-identifier",
  "institution": "Name exactly as written by source",
  "headline": "One line, plain words describing what happened",
  "date": "YYYY-MM-DD",
  "source": "https://... (direct link to announcement or post)",
  "sourceBy": "Author or entity that posted it",
  "sourceType": "official | press release | media report",
  "status": "ARRIVED | PILOT | ANNOUNCED",
  "image": "optional relative path to screenshot",
  "placeholder": false
}
```

#### Example Row
```json
{
  "id": "example-pilot",
  "institution": "Example Institution",
  "headline": "Example headline",
  "date": "2024-03-01",
  "source": "https://example.com/post",
  "sourceBy": "Example Source",
  "sourceType": "official",
  "status": "PILOT",
  "image": "",
  "placeholder": false
}
```

> **Note on Placeholders**:
> Rows with `"placeholder": true` display a red `"SAMPLE - REPLACE"` tag on the board. The counter `"ARRIVALS LOGGED: N"` only counts non-placeholder rows.

---

## The Meme Desk (`src/sections/MemeDesk.jsx`)

A fast, client-side meme generator built with the HTML5 Canvas 2D API.

### Layout & Interaction
- **Always-Visible Preview**:
  - *Mobile (<900px)*: Pinned in a sticky container at the top of the section (`position: sticky, top: 8px`, `max-h-[42dvh]`, z-index 30). The canvas scales cleanly inside without cropping for both square (1:1) and portrait (4:5) templates. Stays visible above the mobile keyboard while typing.
  - *Desktop (≥900px)*: Two-column layout with preview sticky on the left (`top: 24px`) and controls stacked on the right.
- **Mobile 3-Tab Controls**: Under the preview, controls are divided into three tabs: `1 PICK`, `2 WRITE`, and `3 SEND`. Only one panel is shown at a time to keep the section compact. Each panel includes a small NEXT button.
- **Draggable Stamp**: An optional red rubber stamp (`ORDER PENDING`, `MARKET CLOSED`, `APPROVED`, `DENIED`) with a scale slider. Only the stamp element itself uses `touch-action: none`, allowing standard page scrolling across the canvas and background.
- **Export Actions**: Native `navigator.share`, Clipboard API image copy, one-click PNG download, and pre-filled post on X.
- **Bottom Clearance**: Generous bottom padding ensures the fixed ticker tape and floating sound button never cover the export buttons.

---

## Assets Directory (`public/assets/`)

| Filename | Purpose | Recommended Size | Current Status |
|---|---|---|---|
| `bull-hero-final.png` | Main hero bull character in suit | 1200 x 1200 px PNG (#000 bg) | **Active** |
| `bull-hero-nopupils.png` | Hero bull with empty eye whites for pupil tracking | 1200 x 1200 px PNG (#000 bg) | **Active in Eye Mode** |
| `bull-charge.png` | Bull charging pose | 1200 x 1200 px PNG (transparent) | **Active** |
| `bull-peek.png` | Bull head peeking over edge | 800 x 800 px PNG (transparent) | **Active** |
| `bull-standing.png` | Full-length standing suit pose | 1200 x 1600 px PNG (transparent) | **Active** |
| `bull-browraise.png` | Eyebrow-raised reaction (`YOUR BANK` & Meme Desk) | 1200 x 1200 px PNG (#000 bg) | **Active** |
| `bull-smug.png` | Smug reaction (Arrivals printer & Meme Desk) | 1200 x 1200 px PNG (#000 bg) | **Active** |
| `bull-shocked.png` | Shocked bull expression (Meme Desk) | 1200 x 1200 px PNG (#000 bg) | **Active** |
| `bull-watch.png` | Bull checking wristwatch (Meme Desk) | 1200 x 1200 px PNG (#000 bg) | **Active** |
| `favicon.png` | Browser tab icon | 512 x 512 px PNG | **Active** |
| `og-image.jpg` | Social share preview image | 1200 x 630 px JPG/PNG | **Active** |

---

## Herd and Easter Eggs (`src/sections/Herd.jsx`)

- **Run with the Herd**: Spawns 16 bulls running left-to-right across the screen in staggered vertical lanes with audio hoof thuds.
- **Easter Eggs**:
  - Typing `wen` anywhere on the page cycles through dry corporate one-liner toasts.
  - Typing `bull` anywhere triggers a full-screen stampede.
  - Tapping the footer disclaimer 5 times in quick succession triggers an easter egg toast.
