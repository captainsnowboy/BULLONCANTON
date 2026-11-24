/**
 * BULL ON CANTON - COPY & TEXT REPOSITORY
 * All textual copy, one-liners, disclaimers, and ticker items.
 */

import { CBULL } from './config/cbull';

export const SLOGAN = "THE BULLS ARE ONCHAIN.";
export const TITLE = "BULL ON CANTON";
export const SUB_LABEL = "BULL ON CANTON";

// Weekend banner text
export const WEEKEND_BANNER = "WALL STREET IS CLOSED. BULL IS NOT.";

// Hero plain labels
export const HERO_COPY = {
  eyesOn: "Eyes on", eyesOff: "Eyes off", eyesToggleAria: "Toggle eye mode",
  pinAria: "Lapel pin", bellAria: "Bell", orderSubmitted: "On Supanova."
};

// Bull one-liners triggered on bull taps (grouped by hit region)
export const BULL_TAP_LINES = {
  horns: ["Mind the horns.", "Don't make me come over there.", "Still here."],
  face: ["Yes?", "I heard you the first time.", "That's the good side.", "You can stop now.",
         "I was never worried.", "I've seen this cycle before."],
  suit: ["Not now. Suit's pressed.", "Per my last block.", "Market's closed. I'm not.",
         "Sir, this is a Saturday.", "Noted."]
};

// Rapid tap special reaction (after 5 rapid taps)
export const RAPID_TAP_LINE = "I'm working.";

export const TAP_FX_WORDS = ["SNORT"];

// Lapel pin tap lines
export const PIN_TAP_LINES = [
  "It's just a pin.", "Don't touch the merchandise.", "Yes, it's a C. Moving on.",
  "Lapel pin. Standard issue."
];

// Idle 20 seconds speech tag
export const IDLE_WATCH_LINE = "Any day now.";

// Buy button interactions
export const BUY_BUTTON = {
  label: `BUY ${CBULL.ticker}`,
  subtitle: "TAP TO BUY",
  pendingStamp: "SUPANOVA",
  notLiveText: "Follow on X for updates.",
  notLiveLinkText: "Follow on X"
};

// Ticker tape items (fictional joke tickers only - NEVER real company tickers or real prices)
export const TICKER_ITEMS = [
  "COFFEE +800%", "SUITS PRESSED +100%", "COMMITTEES FORMED: 12", "COMMITTEES DECIDED: 0",
  "WEEKEND MARKETS: CLOSED", "THE BULL: NOT CLOSED", "ANY DAY NOW: DAY 3,287",
  "EMAILS UNANSWERED: 4,112", "MEETINGS THAT COULD BE BLOCKS: ALL", "HORNS: 2", "TIES: BLACK"
];

// Verbatim required disclaimer
export const DISCLAIMER =
  "Independent community meme. Not affiliated with or endorsed by Canton Network, Digital Asset or any institution named. Not financial advice. This token has no intrinsic value.";

// Socials fallback text
export const SOCIAL_FALLBACKS = { x: "Follow on X", telegram: "Join the Telegram" };

// =========================================================================
// STAGE 2: THE CHARGE SEQUENCE COPY
// =========================================================================
export const CHARGE_COPY = {
  beat1: {
    heading: "For years, crypto waited for Wall Street.",
    masthead: "THE DAILY WAIT",
    subtitle: "THE GLOBAL NEWSPAPER OF PROLONGED ANTICIPATION • EST. 2017",
    caption: "(satire)",
    tossAria: "Toss this newspaper",
    tapToToss: "Tap to toss",
    headlines: [
      { volume: "VOL. XII No. 4", headline: "BULL MOVES TO CANTON",
        sub: "Wall Street's bull has a new home. More are on the way.", stamp: "NEW ADDRESS" },
      { volume: "VOL. XII No. 3", headline: "BANKS QUIETLY TRY BLOCKCHAIN. FOR REAL.",
        sub: "Some pilots. Some already live. Receipts further down.", stamp: "SOME ARE LIVE" },
      { volume: "VOL. XII No. 2", headline: "WALL STREET BULL HAS NO COMMENT",
        sub: "The symbol of traditional finance was last seen checking his watch.", stamp: "NO COMMENT" },
      { volume: "VOL. XII No. 1", headline: "CRYPTO STILL WAITING FOR WALL STREET",
        sub: "Experts say institutions are coming. They said that last year too.", stamp: "STILL WAITING" }
    ]
  },
  beat2: {
    sign: "WALL ST.",
    heading: "Wall Street. It was always a wall."
  },
  beat4: {
    heading: "The Wall Street bull has found a new home.",
    subheading: "The bulls are on Canton. More are coming.",
    bullLine: "Took you long enough."
  },
  mobileButton: {
    holdText: "HOLD TO CHARGE",
    chargingText: "CHARGING...",
    brokenText: "WALL DOWN"
  },
  runItBack: "RUN IT BACK",
  reducedMotion: {
    introCaption: "Four front pages from The Daily Wait, a satirical newspaper about waiting for Wall Street.",
    wallCaption: "Wall Street. A very solid wall.",
    crackedCaption: "The bull hits the wall. Cracks appear.",
    breachedCaption: "The wall is down. The bull is on Canton."
  }
};

// =========================================================================
// STAGE 3: THE ARRIVALS BOARD COPY
// =========================================================================
export const ARRIVALS_COPY = {
  title: "THE RECEIPTS",
  subtitle: "Click a row. Read the source.",
  counterLabel: "RECEIPTS",
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
    "Source attached.", "Go read it.", "Don't take my word. Open the link.",
    "Filed.", "Check the date too.", "Read the whole thing."
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
  emptyFilterText: "Nothing here yet.",
  printer: {
    slotLabel: "RECEIPT PRINTER",
    selectPrompt: "Pick a row to print its receipt.",
    typeLabel: "TYPE",
    recordedByLabel: "POSTED BY",
    dateLabel: "SOURCE DATE",
    institutionLabel: "WHO",
    verifiedHeader: "RECEIPT",
    noteLabel: "NOTE",
    alsoReadLabel: "ALSO READ",
    yourBankNotice: "STATUS: IN A MEETING",
    yourBankDesc: "Still waiting on a committee. The bull started without them.",
    closeSheet: "Close receipt",
    grabHandle: "Drag down to close"
  },
  legalText: "Links to public announcements, with names as each source wrote them. No partnership or endorsement is implied. Status labels follow what each source says.",
  submitPrompt: "Know one we missed? Send it."
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
    { id: "browraise", label: "Brow raised", file: "meme/faces/browraise.webp", transparent: true },
    { id: "smug", label: "Smug", file: "meme/faces/smug.webp", transparent: true },
    { id: "shocked", label: "Shocked", file: "meme/faces/shocked.webp", transparent: true },
    { id: "sideeye", label: "Side-eye", file: "meme/faces/sideeye.webp", transparent: true },
    { id: "laughing", label: "Laughing", file: "meme/faces/laughing.webp", transparent: true },
    { id: "angry", label: "Angry", file: "meme/faces/angry.webp", transparent: true },
    { id: "deadpan", label: "Deadpan", file: "bull-hero-final.webp", legacy: true },
    { id: "watch", label: "Watch", file: "bull-watch.webp", legacy: true }
  ],
  backgrounds: [
    { id: "black", label: "Black", color: "#0E0D0C" },
    { id: "newsprint", label: "Newsprint", color: "#E8DFC9", halftone: true },
    { id: "bronze", label: "Bronze", color: "#C97B1A" },
    { id: "brick", label: "Brick", color: "#942919", pattern: "brick" },
    { id: "candles", label: "Candles", color: "#0E0D0C", pattern: "candles" },
    { id: "sunburst", label: "Sunburst", color: "#E8DFC9", pattern: "sunburst" }
  ],
  shuffleButton: "Shuffle",
  shuffleAria: "Shuffle face, background, line and props",
  pickSections: {
    face: "FACE",
    background: "BACKGROUND",
    props: "PROPS",
    template: "TEMPLATE"
  },
  legacyNote: "Props work on the new faces.",
  propControls: {
    size: "Size",
    turn: "Turn",
    flip: "Flip",
    toFront: "To front",
    remove: "Remove",
    reset: "Reset props",
    smoke: "Smoke",
    on: "On",
    off: "Off",
    maxProps: "Maximum 6 props.",
    loadingProps: "Loading props.",
    selectionAria: "Selected prop frame"
  },
  templates: [
    { id: "classic", label: "Classic", desc: "Top & bottom captions (1:1)" },
    { id: "frontpage", label: "Front Page", desc: "The Daily Wait newspaper (4:5)" },
    { id: "speech", label: "Speech Bubble", desc: "Comic callout bubble (1:1)" }
  ],
  stamps: ["NONE", "ORDER PENDING", "MARKET CLOSED", "APPROVED", "DENIED"],
  giveMeLineButton: "Give me a line",
  watermarkToggle: "Add BULL ON CANTON tag",
  starterLines: [
    "Told you I'd get here.", "Market's closed. I'm still working.",
    "I was never worried.", "Took you long enough.", "Anyway.", "I wore the suit for this.",
    "You said \"any day now\" in 2021.", "Yes, I'm onchain. No, I won't explain it.",
    "Hold my coffee. I'm going through the wall.", "Wall Street has entered the chat.",
    "The bull is on Canton.", "Still bullish. Still in a suit.", "I've seen this movie before.",
    "He was always going to end up here.", "Sir, this is a Saturday.", "Per my last block."
  ],
  buttons: {
    download: "Download PNG",
    downloadSticker: "Download sticker (PNG)",
    share: "Share",
    copy: "Copy Image",
    postX: "Post on X"
  },
  xNotice: "X can't attach the image for you. Save it, then add it to your post.",
  xPrefillText: `The bulls are onchain. ${CBULL.ticker}`,
  iosFallbackNotice: "Press and hold the image to save it.",
  iosSaveHint: "On iPhone: tap Download, then Save Image.",
  iosSaveSheetInstruction: "Press and hold the image, then tap Save to Photos.",
  iosSaveSheetClose: "Close",
  iosSaveSheetAria: "Save meme image",
  iosSaveSheetImgAlt: "Meme image ready to save",
  status: {
    copied: "Image copied to clipboard.",
    saved: "Meme image downloaded.",
    stickerSaved: "Sticker image downloaded.",
    shared: "Share opened.",
    error: "Your browser can't do that."
  }
};

// =========================================================================
// STAGE 5: HERD & EASTER EGGS
// =========================================================================
export const HERD_COPY = {
  heading: "JOIN THE HERD",
  runButton: "Run with the herd",
  herdSizePrefix: "Herd size: ",
  socials: {
    xLabel: "X",
    telegramLabel: "Telegram",
    soon: "Soon",
    xSoonAria: "X, link coming soon",
    telegramSoonAria: "Telegram, link coming soon",
    xAria: "Open X in a new tab",
    telegramAria: "Open Telegram in a new tab"
  },
  address: {
    label: "TOKEN ADDRESS",
    copyButton: "COPY",
    copiedButton: "COPIED",
    copyAria: "Copy token address",
    copiedLive: "Token address copied",
    copyFailedLive: "Select the highlighted address to copy it",
    viewOnSupanova: "View on Supanova",
    safetyNote: "Buy only from this link. Anyone else is selling you a costume."
  }
};

export const SOUND_COPY = {
  on: "Sound on",
  off: "Sound off"
};

export const EASTER_EGG_COPY = {
  wenLines: [
    "Soon.", "Ask me Monday.", "Wen what.", "Check the ticker.",
    "Don't rush a bull."
  ],
  disclaimerToast: "Yes, it says what it says."
};

export const FOOTER_COPY = {
  backToTop: "Back to top",
  trustLine: "This site never asks you to connect a wallet."
};

// =========================================================================
// COMPONENT UI STRINGS (MOVED OUT OF COMPONENTS)
// =========================================================================
export const UI_COPY = {
  hero: {
    sloganLine1: "THE BULLS",
    sloganLine2: "ARE ONCHAIN.",
    tapBullTitle: "Tap the bull"
  },
  buyTicket: {
    header: "ORDER TICKET",
    buttonAria: `Buy ${CBULL.ticker} on Supanova`,
    orderStatusAria: "Order Status",
    dismiss: "Dismiss"
  },
  ticker: {
    marketOpen: "NYSE: OPEN",
    marketClosed: "NYSE: CLOSED",
    tzSuffix: "NYC",
    ariaLabel: "Market Ticker"
  },
  charge: {
    impactHeading: "THE IMPACT",
    paperPrice: "PRICE: 2 SATOSHIS",
    holdAria: "Hold to charge through the wall",
    progressAria: "Charge Progress"
  },
  arrivals: {
    yourBankSourceBy: "The Bull",
    yourBankSourceType: "pending",
    receiptAction: "RECEIPT ▶",
    filterAria: "Filter arrivals",
    boardAria: "Arrivals Board",
    columns: {
      status: "STATUS",
      institution: "WHO",
      headline: "HEADLINE",
      date: "DATE"
    },
    noSourceAvailable: "No source link.",
    printerBadge: "THE RECEIPTS",
    verdictHeader: "VERDICT"
  },
  memeDesk: {
    defaults: {
      topText: "MARKET CLOSED",
      bottomText: "I'M STILL WORKING",
      frontHeadline: "BULL COMPLETES SETTLEMENT WITHOUT ASKING PERMISSION",
      frontCaption: "The bull in a black suit, entirely unconcerned.",
      speechText: "Per my last block."
    },
    frontPageVol: "VOL. XIV NO. 420. (satire)",
    frontPageCaptionPrefix: "Fig 1.",
    shareTitle: "BULL ON CANTON Meme",
    dismiss: "Dismiss",
    dragStampAria: "Draggable Stamp",
    dragLabel: "DRAG",
    exportPrefix: "EXPORT:",
    renderNote: "100% PRIVATE CLIENT RENDER",
    stepsAria: "Meme editor steps",
    pickExpressionLabel: "Select Mascot Expression",
    pickTemplateLabel: "Select Layout Template",
    nextWrite: "NEXT: WRITE",
    topCaptionLabel: "Top Caption",
    bottomCaptionLabel: "Bottom Caption",
    headlineLabel: "Newspaper Headline",
    photoCaptionLabel: "Photo Caption",
    speechBubbleLabel: "Speech Bubble Text",
    stampLabel: "Optional Red Rubber Stamp",
    stampSizeLabel: "STAMP SIZE:",
    backPick: "◀ BACK: PICK",
    nextSend: "NEXT: SEND",
    backWrite: "◀ BACK: WRITE"
  },
  footer: {
    xLabel: "X",
    telegramLabel: "TELEGRAM",
    disclaimerTitle: "Disclaimer"
  }
};

export const OFFICE_COPY = {
  heading: "THE DESK",
  cordHint: "Pull",
  cordAria: "Turn on the light",
  deskLampAria: "Desk lamp",
  coinAria: "Coin",
  deskAlt: "Front-facing wooden office desk with a monitor showing the receipts board",
  bullAlt: "Bull peeking over the top of the monitor",
  watchAlt: "Framed portrait of the bull checking his watch",
  bullReactionAlt: "Bull reaction",
  screenTitle: "THE RECEIPTS",
  receiptHeader: "RECEIPT",
  back: "BACK",
  filters: {
    all: "ALL",
    arrived: "ARRIVED",
    pilot: "PILOT",
    announced: "ANNOUNCED"
  },
  whoLabel: "WHO",
  dateLabel: "SOURCE DATE",
  postedByLabel: "POSTED BY",
  typeLabel: "TYPE",
  noteLabel: "NOTE",
  viewOnX: "VIEW ON X",
  viewSource: "VIEW SOURCE",
  alsoReadPrefix: "ALSO READ:",
  stampLabel: "SOURCE ATTACHED",
  prevAria: "Previous receipt",
  nextAria: "Next receipt",
  screenAria: "The Receipts monitor",
  legendButton: "?",
  legendAria: "Status legend",
  legendCloseAria: "Close status legend",
  legendItems: [
    { status: "ANNOUNCED", text: "They said it." },
    { status: "PILOT", text: "They are testing it." },
    { status: "ARRIVED", text: "The source says it is live." }
  ],
  updatedPrefix: "UPDATED",
  monthsShort: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
};

// =========================================================================
// END CREDITS COPY
// =========================================================================
export const CREDITS_COPY = {
  triggerButton: "ROLL CREDITS",
  triggerAria: "Roll end credits",
  regionAria: "End credits",
  closeAria: "Close credits",
  muteAria: "Mute music",
  backButton: "Back to the site",
  playButton: "Play",
  playAria: "Play credits",
  pauseAria: "Pause or resume credits",
  pausedStatus: "Credits paused",
  resumedStatus: "Credits playing",
  heroAlt: "The bull in a black suit",
  smugAlt: "Smug bull",
  title: "BULL ON CANTON",
  subtitle: "A film about waiting.",
  starringHeading: "STARRING",
  starring: [
    { name: "THE BULL", role: "as himself" },
    { name: "THE WALL", role: "as the wall (until act two)" },
    { name: "ANY DAY NOW", role: "as the plot" },
    { name: "A COMMITTEE OF TWELVE", role: "as themselves" }
  ],
  storyHeading: "THE STORY",
  storyLines: [
    "For years, crypto has waited for Wall Street to come onchain.",
    "The banks. The markets. The trillions moving through traditional finance.",
    "Everyone said it was coming.",
    "Now the transition is taking shape.",
    "Canton Network is building the infrastructure to bring financial institutions, markets and real-world assets onchain.",
    "Major banks and market operators are already involved. Real use cases are starting to appear.",
    "The Wall Street bull has always stood for traditional finance.",
    "So we gave him a new home.",
    "The bull is Wall Street. Canton is where Wall Street is moving.",
    "A bull in a business suit, standing for the institutions, the capital and the markets making their way onchain.",
    "If the institutions are coming onchain, the bull has to be there too.",
    "BULL ON CANTON is launching on Canton.",
    "The bulls are on Canton. The bulls are onchain. And more are coming."
  ],
  crewHeading: "CREW",
  crew: [
    "Suit: pressed",
    "Horns: two",
    "Pin: C",
    "Coffee: +800%",
    "Saturdays: closed. The bull: not."
  ],
  thanksHeading: "SPECIAL THANKS",
  thanksText: "Every meeting that could have been a block.",
  locationHeading: "FILMED ON LOCATION",
  locationText: "Wall Street (closed on weekends)",
  smallPrint: "An independent community meme. Not affiliated with Canton or any institution. We are turning one of crypto's biggest stories into a character.",
  musicCredit: "",
  disclaimer: DISCLAIMER,
  finalTitle: "THE BULLS ARE ONCHAIN.",
  finalSubtitle: "Wall Street has a new home."
};

// =========================================================================
// PLAY PAGE & STICKY BUTTON COPY
// =========================================================================
export const PLAY_COPY = {
  button: "PLAY",
  stickyAria: "Play the game, coming soon",
  backButton: "BACK",
  backAria: "Go back",
  bullAlt: "The suited bull riding a charging bronze bull",
  heading: "BULL RUN",
  subtitle: "Outrun the bear.",
  comingSoon: {
    stamp: "COMING SOON",
    message: "Bull Run is almost ready.",
    xLabel: "X",
    telegramLabel: "TELEGRAM",
    xAria: "Follow on X",
    telegramAria: "Join on Telegram"
  },
  tapToPlay: "TAP TO PLAY",
  howTo: "Tap above deck or JUMP to leap. Hold DODGE to duck.",
  jumpLegend: "JUMP (tap)",
  dodgeLegend: "DODGE (hold)",
  jumpLabel: "JUMP",
  dodgeLabel: "DODGE",
  chargeButtonLabel: "CHARGE",
  jumpAria: "Jump",
  dodgeAria: "Hold to dodge",
  chargeAria: "Trigger charge",
  pauseAria: "Pause game",
  bestLabel: "BEST",
  scoreLabel: "SCORE",
  coinsLabel: "COINS",
  rankLabel: "RANK",
  followLine: "Follow on X",
  xAria: "Follow on X",
  dailyRunLabel: "DAILY RUN",
  dailyRunDesc: "Same seed for everyone today.",
  dailyRunTag: "DAILY RUN",
  locationsHeading: "LOCATION",
  locationLocked: "Unlocks at {score}",
  locations: [
    {
      id: "wallStreet",
      name: "WALL STREET, NIGHT",
      note: "Bronze lamps and late blocks.",
      unlockScore: 0
    },
    {
      id: "bearStorm",
      name: "BEAR MARKET STORM",
      note: "Red rain and extra overhead.",
      unlockScore: 2500
    },
    {
      id: "cantonDawn",
      name: "CANTON DAWN",
      note: "Warm dawn and more coins.",
      unlockScore: 6000
    }
  ],
  ranks: [
    { minScore: 0, label: "Intern" },
    { minScore: 600, label: "Analyst" },
    { minScore: 1800, label: "Associate" },
    { minScore: 4000, label: "VP" },
    { minScore: 8000, label: "Managing Director" },
    { minScore: 15000, label: "The Bull" }
  ],
  freeUnlocks: [
    { minScore: 600, id: "bronzeDust", label: "Bronze dust" },
    { minScore: 1800, id: "greenCandle", label: "Green candle trail" },
    { minScore: 4000, id: "coinBurst", label: "Charge coin burst" },
    { minScore: 8000, id: "creamOutline", label: "Cream outline" },
    { minScore: 15000, id: "bronzeStreak", label: "Bronze streak" }
  ],
  unlocksHeading: "UNLOCKS",
  noUnlocksYet: "Run to unlock cosmetics.",
  goText: "GO",
  firstJumpHint: "TAP",
  bearLabel: "BEAR",
  chargeLabel: "CHARGE",
  secondWindLabel: "SECOND WIND",
  secondWindUsed: "SHIELD USED",
  perfectPopup: "PERFECT",
  closePopup: "CLOSE",
  shieldPopup: "SHIELD",
  magnetPopup: "MAGNET",
  chargePopup: "CHARGE",
  pausedTitle: "PAUSED",
  pausedPrompt: "PAUSED, tap resume to continue",
  resumeButton: "RESUME",
  quitButton: "QUIT",
  canvasAria: "Bull Run game canvas",
  caughtTitle: "CAUGHT.",
  newBestBadge: "New best",
  runAgainButton: "RUN AGAIN",
  changeLocationButton: "CHANGE LOCATION",
  breakdownDistance: "Distance",
  breakdownCoins: "Coins x Combo",
  breakdownClose: "Close calls",
  breakdownPerfect: "Perfect arcs",
  openLeague: "OPEN LEAGUE",
  herdLeague: "HERD LEAGUE",
  weeklyHeading: "WEEKLY CHALLENGE",
  challengeBeaten: "Challenge beaten",
  herdPass: {
    heading: "HERD PASS",
    haveCodeButton: "I have a code",
    locked: "Locked",
    unlocked: "Active",
    expiredNote: "Season ended.",
    tiers: [
      {
        id: "herd",
        name: "HERD",
        preview: "Gold outline, gold dust trail, gold share frame"
      },
      {
        id: "bull",
        name: "BULL",
        preview: "Gold bronze bull, Second wind shield"
      },
      {
        id: "alpha",
        name: "ALPHA",
        preview: "Green candle trail, Alpha share stamp"
      }
    ],
    telegramNotePrefix: "Codes are given out in the Herd Room on Telegram.",
    telegramLinkText: "Open Telegram",
    noWalletNote: "This site never asks you to connect a wallet.",
    sheetTitle: "ENTER HERD CODE",
    codePlaceholder: "Paste code",
    codeInputLabel: "Herd Pass code",
    submitCode: "UNLOCK",
    closeSheet: "Cancel",
    invalidCode: "Code not recognized for this season.",
    seasonEndedError: "Current season has ended.",
    rateLimited: "Too many tries. Wait {seconds} seconds.",
    codeAccepted: "Pass unlocked."
  },
  shareCard: {
    titlePrefix: "OUTRAN THE BEAR FOR",
    watermark: "BULL ON CANTON",
    runCodePrefix: "RUN",
    alphaStampSuffix: "ALPHA",
    shareButton: "SHARE CARD",
    postXButton: "POST ON X",
    xPostTemplate: "Outran the bear for {score}. Rank: {rank}. {ticker}",
    xAttachNote: "Save the card first, then attach the image to your post on X.",
    preparingCard: "Building card...",
    cardSavedStatus: "Share card downloaded.",
    cardSharedStatus: "Share card ready.",
    cardErrorStatus: "Could not build share card.",
    iosSheetInstruction: "Press and hold the image, then tap Save to Photos.",
    iosSheetClose: "Close",
    iosSheetAlt: "Bull Run score share card"
  },
  debugAnim: {
    toggleLabel: "ANIM TUNE",
    collapseLabel: "Hide",
    expandLabel: "Open",
    saddleX: "Saddle X",
    saddleY: "Saddle Y",
    scaleMult: "Scale",
    poseHeading: "Pose offset",
    poseX: "Pose X",
    poseY: "Pose Y",
    springK: "Spring K",
    springC: "Spring C",
    showSaddle: "Show saddle points",
    showHitbox: "Show hitbox",
    copyButton: "Copy settings",
    copiedButton: "Copied",
    resetButton: "Reset"
  }
};

// =========================================================================
// STAGE 6: THE TAPE (LIVE SUPANOVA ANALYTICS)
// =========================================================================
export const THE_TAPE_COPY = {
  kicker: "MARKET DESK • LIVE FROM SUPANOVA",
  heading: "THE TAPE",
  tagline: "The bull has no comment. The tape does.",
  stats: {
    price: "PRICE",
    change24h: "24H",
    marketCap: "MARKET CAP",
    volume24h: "VOLUME 24H",
    herd: "THE HERD",
    toGraduation: "TO GRADUATION"
  },
  tradesSuffix: "trades",
  inOrbitStamp: "IN ORBIT — GRADUATED",
  sparklineLabel: "TAPE LINE",
  lastPrintsLabel: "LAST PRINTS",
  asOfPrefix: "As of",
  staleBadge: "STALE",
  supanovaLink: "Full chart & trading on Supanova →",
  missingValue: "—"
};

// =========================================================================
// STAGE 7: THE TAPE, IN YOUR GROUP (STATIC TELEGRAM BOT SECTION)
// =========================================================================
export const THE_TAPE_BOT_COPY = {
  kicker: "THE BOT • FREE FOR EVERY CANTON GROUP",
  heading: "THE TAPE, IN YOUR GROUP",
  standfirst: "THE BULL is all in one bot for degens on the Canton network",
  watchButton: "WATCH THE BOT AT WORK",
  videoModal: {
    dialogAria: "THE BULL bot showcase video",
    closeAria: "Close video",
    src: "/assets/the-bull-showcase.mp4",
    poster: "/assets/the-bull-showcase-poster.jpg"
  },
  rows: [
    {
      id: "ask-anything",
      title: "ASK ANYTHING",
      summary: "Any coin, answered on the spot.",
      entries: [
        {
          trigger: "$TICKER",
          description:
            "drop any ticker mid-conversation; the full card appears: price, market cap, holders, top holders, dev record, new money."
        },
        {
          trigger: "Paste a Supanova or OnePump link",
          description: "the same card, no command needed."
        },
        {
          trigger: "/t TICKER",
          description: "the full card on demand, with chart and a reload button."
        },
        {
          trigger: "/more TICKER",
          description: "the deep dive: top holders, the dev's full record, the early buyers."
        },
        {
          trigger: "One ticker, two launchpads",
          description:
            "if a ticker lives on both Supanova and OnePump, the bot asks which one you mean before it answers. No wrong cards."
        },
        {
          trigger: "An ATH with receipts",
          description:
            "a high only counts when real trading reached it: real size and a crowd of trades behind it, never one lucky print."
        },
        {
          trigger: "Beta launch, badged",
          description:
            "coins from Supanova's test period carry the badge on their card, so test-period numbers are never read as real market history."
        }
      ]
    },
    {
      id: "calls-and-receipts",
      title: "CALLS & RECEIPTS",
      summary: "Every call tracked. Every win proven.",
      entries: [
        {
          trigger: "First drop gets the call",
          description: "the bot records who called the coin, and at what market cap."
        },
        {
          trigger: "2x · 5x · 10x",
          description: "when a call runs, the milestone alert replies under the original call."
        },
        {
          trigger: "/lb",
          description: "the group's caller leaderboard, ranked by results."
        },
        {
          trigger: "/calls",
          description: "the group's last ten calls, each with its Now and its ATH."
        },
        {
          trigger: "/pnl TICKER",
          description:
            "the flex card: the giant multiple and the caller's face on it. Made to be screenshotted."
        }
      ]
    },
    {
      id: "wallets",
      title: "WALLETS",
      summary: "See who holds what.",
      entries: [
        {
          trigger: "/th TICKER",
          description: "the full top-holder list."
        },
        {
          trigger: "/w ADDRESS",
          description: "any wallet's card: what it holds and how it is doing."
        },
        {
          trigger: "/watch ADDRESS",
          description:
            "an alert when that wallet trades. (Public trades only — Canton keeps transfers private.)"
        },
        {
          trigger: "/bubbles TICKER",
          description: "the holder bubble map."
        }
      ]
    },
    {
      id: "charts-and-lists",
      title: "CHARTS & LISTS",
      summary: "The market at a glance.",
      entries: [
        {
          trigger: "/c TICKER",
          description: "the candlestick chart, with your group's call marked on it."
        },
        {
          trigger: "/top TICKER",
          description: "a coin's top traders by realised profit."
        },
        {
          trigger: "/new",
          description: "the latest launches, as they land."
        },
        {
          trigger: "/tape",
          description: "what is trending right now."
        },
        {
          trigger: "/today",
          description: "today on Canton, at a glance."
        }
      ]
    },
    {
      id: "for-group-admins",
      title: "FOR GROUP ADMINS",
      summary: "Your coin, on autopilot.",
      entries: [
        {
          trigger: "/setcoin TICKER",
          description:
            "pin your group's coin: its buys and its graduation milestones post here on their own."
        },
        {
          trigger: "/settopic",
          description:
            "forum groups: bind the bot to one topic, and it answers there only."
        },
        {
          trigger: "/fix TICKER",
          description:
            "shared ticker? Pin which launchpad's coin it means in this group."
        },
        {
          trigger: "/alerts",
          description:
            "graduation runs, heating-up coins, and launches from creators who have graduated before."
        },
        {
          trigger: "/settings",
          description:
            "card density and alert controls, plus your group's own buy-alert style: minimum buy, emoji and GIF."
        }
      ]
    }
  ],
  teaserRow: {
    title: "IN THE WORKSHOP",
    line: "More functions are being built. The tape keeps shipping.",
    stamp: "IN TRANSIT"
  },
  quickStart: {
    heading: "USE IT IN 30 SECONDS",
    steps: [
      "Add @bulloncanton_buybot to your group.",
      "Make it an admin, so it can see ticker drops.",
      "Drop a $TICKER. That is the whole manual."
    ],
    primaryCta: {
      label: "ADD THE BOT",
      href: "https://t.me/bulloncanton_buybot?startgroup=true"
    },
    secondaryCta: {
      label: "JOIN @THEBULL_TAPE",
      href: "https://t.me/thebull_tape"
    }
  }
};

export const DESK_NAV_COPY = {
  triggerLabel: "DESK",
  navAria: "Desk menu",
  items: [
    { id: "play", label: "PLAY", href: "/play" },
    { id: "tape", label: "THE TAPE", href: "/#tape" },
    { id: "bot", label: "THE BOT", href: "/#bot" }
  ]
};







