/**
 * BULL ON CANTON - COPY & TEXT REPOSITORY
 * All textual copy, one-liners, disclaimers, and ticker items.
 */

export const SLOGAN = "THE BULLS ARE ONCHAIN.";
export const TITLE = "BULL ON CANTON";
export const SUB_LABEL = "BULL ON CANTON";

// Weekend banner text
export const WEEKEND_BANNER = "WALL STREET IS CLOSED. BULL IS NOT.";

// Hero plain labels
export const HERO_COPY = {
  eyesOn: "Eyes on",
  eyesOff: "Eyes off",
  eyesToggleAria: "Toggle eye mode",
  pinAria: "Lapel pin",
  bellAria: "Bell",
  orderSubmitted: "Order placed."
};

// Bull one-liners triggered on bull taps (dry, deadpan corporate-speak turned degen)
export const BULL_TAP_LINES = [
  "Per my last block.",
  "Circling back.",
  "Sir, this is a Saturday.",
  "Market's closed. I'm not.",
  "Let's take this off-chain.",
  "Action items: hodl.",
  "I don't have bandwidth for your fear.",
  "Ping me at block height 4,000,000.",
  "Please review the attached green candle.",
  "As per our sync, the thesis hasn't changed.",
  "Looping in nobody.",
  "Best regards, The Bull.",
  "Touching base on the breakout.",
  "Hard stop at liquidity.",
  "Aligning deliverables with the ledger.",
  "Let's put a pin in the dip.",
  "Moving forward with maximum leverage.",
  "Thanks for flagging. Still bullish.",
  "Let's table that doubt.",
  "Noted and ignored."
];

// Rapid tap special reaction (after 5 rapid taps)
export const RAPID_TAP_LINE = "I'm working.";

// Lapel pin tap lines
export const PIN_TAP_LINES = [
  "It's a pin. Relax.",
  "Pure Canton bronze.",
  "C-Suite certified.",
  "Don't touch the merchandise.",
  "Standard issue lapel pin."
];

// Idle 20 seconds speech tag
export const IDLE_WATCH_LINE = "Any day now.";

// Buy button interactions
export const BUY_BUTTON = {
  label: "BUY",
  subtitle: "HOLD TO CHARGE",
  earlyReleaseLine: "Not committed enough.",
  pendingStamp: "ORDER PENDING - MARKET OPENS SOON",
  notLiveText: "Not live yet. Follow on X for the launch.",
  notLiveLinkText: "Follow @BullOnCanton on X",
  successText: "Redirecting to swap...",
};

// Ticker tape items (fictional joke tickers only - NEVER real company tickers or real prices)
export const TICKER_ITEMS = [
  "$BULL +420.69%",
  "ANY DAY NOW -",
  "COFFEE +800%",
  "LEVERAGE 100x",
  "SUITS PRESSED +100%",
  "PRINTER: BRRR",
  "BLOCKS: FINAL",
  "CANTON SYNC: 100%",
  "MEMO: BULLISH",
  "FEES: NEGATIVE ZERO",
  "HODL: MANDATORY",
  "QUARTERLY RUN: PERPETUAL",
  "DESK HOURS: 24/7/365",
  "TPS: INNUMERABLE",
  "LIQUIDITY: UNMATCHED"
];

// Verbatim required disclaimer
export const DISCLAIMER =
  "Independent community meme. Not affiliated with or endorsed by Canton Network, Digital Asset or any institution named. Not financial advice. This token has no intrinsic value.";

// Socials fallback text
export const SOCIAL_FALLBACKS = {
  x: "Follow on X (Twitter)",
  telegram: "Join Telegram Community"
};

// =========================================================================
// STAGE 2: THE CHARGE SEQUENCE COPY
// =========================================================================
export const CHARGE_COPY = {
  beat1: {
    heading: "For years, crypto waited for Wall Street.",
    masthead: "THE DAILY WAIT",
    subtitle: "THE GLOBAL NEWSPAPER OF PROLONGED ANTICIPATION • EST. 2017",
    caption: "(satire)",
    headlines: [
      {
        volume: "VOL. IX No. 420",
        headline: "INSTITUTIONS COMING, SOURCES SAY",
        sub: "Committee formed to form subcommittee to evaluate potential pilot."
      },
      {
        volume: "VOL. X No. 690",
        headline: "ANY DAY NOW",
        sub: "Senior managing director spotted reading whitepaper summary on commuter train."
      },
      {
        volume: "VOL. XI No. 888",
        headline: "THIS CYCLE FOR SURE",
        sub: "Working group schedules quarterly symposium to deliberate next quarter's agenda."
      },
      {
        volume: "VOL. XII No. 999",
        headline: "WALL ST. EXPLORING BLOCKCHAIN",
        sub: "PowerPoint deck enters third round of internal compliance revision."
      }
    ]
  },
  beat2: {
    sign: "WALL ST.",
    heading: "Wall Street. It was always a wall."
  },
  beat4: {
    heading: "The Wall Street bull has found a new home.",
    subheading: "The bulls are on Canton. More are coming.",
    bullLine: "Took you long enough.",
    scrollPrompt: "SCROLL ON"
  },
  mobileButton: {
    holdText: "HOLD TO CHARGE",
    chargingText: "CHARGING...",
    brokenText: "WALL BREACHED"
  },
  runItBack: "RUN IT BACK",
  reducedMotion: {
    introCaption: "The Daily Wait. Front pages of prolonged anticipation.",
    wallCaption: "Wall Street. The bull faces the barrier.",
    crackedCaption: "Impact. Cracks fracture the wall.",
    breachedCaption: "Wall breached. The bull has arrived on Canton."
  }
};

// =========================================================================
// STAGE 3: THE ARRIVALS BOARD COPY
// =========================================================================
export const ARRIVALS_COPY = {
  title: "WALL STREET -> CANTON",
  subtitle: "Receipts. Not vibes.",
  counterLabel: "ARRIVALS LOGGED",
  sampleTag: "SAMPLE - REPLACE",
  stampLabel: "SOURCE ATTACHED",
  finalRow: {
    status: "BOARDING",
    institution: "YOUR BANK",
    headline: "Any day now.",
    date: "TBD",
    reaction: "Don't hold your breath."
  },
  smugReactions: [
    "Receipt verified. Carry on.",
    "On-chain doesn't lie.",
    "Paper trails are forever.",
    "Per the public record.",
    "Filed and stamped.",
    "Another one for the ledger."
  ],
  buttonText: {
    x: "VIEW ON X",
    source: "VIEW SOURCE"
  },
  filters: {
    all: "ALL",
    arrived: "ARRIVED",
    pilot: "PILOT",
    announced: "ANNOUNCED",
  },
  sort: {
    newest: "NEWEST",
    oldest: "OLDEST",
    toggleLabel: "Sort by date",
  },
  nowBoardingPrefix: "NOW BOARDING",
  emptyFilterText: "No arrivals match this filter.",
  printer: {
    slotLabel: "RECEIPT PRINTER",
    selectPrompt: "SELECT AN ARRIVAL TO PRINT RECEIPT",
    typeLabel: "TYPE",
    recordedByLabel: "RECORDED BY",
    dateLabel: "EFFECTIVE DATE",
    institutionLabel: "INSTITUTION",
    verifiedHeader: "CANTON ONCHAIN RECEIPT",
    yourBankNotice: "STATUS: PENDING COMPLIANCE REVIEW (EST. 2038)",
    yourBankDesc: "Wall Street moves at the speed of committees. The Canton bull does not wait.",
    closeSheet: "Close receipt",
    grabHandle: "Drag down to close",
  },
  legalText:
    "Community-curated links to public announcements. Names are shown as written by the source. No partnership, endorsement or affiliation is implied. Status labels reflect what the source states and are not a guarantee.",
  submitPrompt: "Spotted one? Send it."
};

// =========================================================================
// STAGE 4: THE MEME DESK COPY
// =========================================================================
export const MEME_DESK_COPY = {
  heading: "THE MEME DESK",
  subheading: "Make one. Post it.",
  steps: {
    pick: "1 Pick",
    write: "2 Write",
    send: "3 Send"
  },
  bulls: [
    { id: "deadpan", label: "Deadpan", file: "bull-hero-final.png" },
    { id: "browraise", label: "Brow Raised", file: "bull-browraise.png" },
    { id: "smug", label: "Smug", file: "bull-smug.png" },
    { id: "shocked", label: "Shocked", file: "bull-shocked.png" },
    { id: "watch", label: "Watch", file: "bull-watch.png" }
  ],
  templates: [
    { id: "classic", label: "Classic", desc: "Top & bottom captions (1:1)" },
    { id: "frontpage", label: "Front Page", desc: "The Daily Wait newspaper (4:5)" },
    { id: "speech", label: "Speech Bubble", desc: "Comic callout bubble (1:1)" }
  ],
  stamps: ["NONE", "ORDER PENDING", "MARKET CLOSED", "APPROVED", "DENIED"],
  giveMeLineButton: "Give me a line",
  watermarkToggle: "Add BULL ON CANTON tag",
  starterLines: [
    "Told you I'd get here.",
    "Market's closed. I'm still working.",
    "Per my last block.",
    "I was never worried.",
    "Sir, this is a Saturday.",
    "Took you long enough.",
    "Anyway.",
    "I wore the suit for this.",
    "This meeting could have been a block.",
    "You said \"any day now\" in 2021.",
    "Yes, I'm onchain. No, I won't explain it.",
    "Hold my coffee. I'm going through the wall.",
    "Looping in the ledger.",
    "Touching base on the breakout.",
    "Hard stop at zero liquidity.",
    "Action items: none.",
    "I don't have bandwidth for your fear.",
    "Please review the attached candle.",
    "Let's take this off-chain.",
    "As per our sync, thesis unchanged.",
    "Best regards, The Bull.",
    "Noted and ignored."
  ],
  buttons: {
    download: "Download PNG",
    share: "Share",
    copy: "Copy Image",
    postX: "Post on X"
  },
  xNotice: "X can't attach the image for you. Save it, then add it to your post.",
  xPrefillText: "The bulls are onchain. $BULL",
  iosFallbackNotice: "Press and hold the image to save it.",
  status: {
    copied: "Image copied to clipboard.",
    saved: "Meme image downloaded.",
    shared: "Share opened.",
    error: "Operation not supported by browser."
  }
};

// =========================================================================
// STAGE 5: HERD & EASTER EGGS
// =========================================================================
export const HERD_COPY = {
  heading: "JOIN THE HERD",
  runButton: "Run with the herd",
  herdSizePrefix: "Herd size: ",
  linksHeading: "COMMUNITY",
  linksOpenAtLaunch: "Links open at launch.",
  xButton: "X",
  telegramButton: "Telegram"
};

export const SOUND_COPY = {
  on: "Sound on",
  off: "Sound off"
};

export const EASTER_EGG_COPY = {
  wenLines: [
    "Check the ticker.",
    "Soon enough.",
    "Ask me on a weekday.",
    "Wen what.",
    "Patience is a position."
  ],
  disclaimerToast: "Yes, it says what it says."
};

export const FOOTER_COPY = {
  backToTop: "Back to top"
};



