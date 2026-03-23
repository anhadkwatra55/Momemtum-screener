/**
 * constants.ts — App-wide constants
 *
 * This file centralizes all core constants for the application,
 * including navigation routes, color palette, sidebar items,
 * and critical design system tokens for animation, layout,
 * interactive states, and typography.
 *
 * It acts as the single source of truth for frequently used values,
 * ensuring consistency, maintainability, and strict adherence
 * to the "IQ 300" design philosophy.
 */

// ── Navigation Routes ────────────────────────────────────────────────────────

export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  receipts: "/receipts",
} as const;

// ── Color Palette (for JS usage — mirrors CSS tokens from globals.css) ────────

// These are the core colors used across the application, reflecting
// the Tailwind/CSS utility classes and `--color-mo-*` custom properties.
// `cyan` and `violet` are primary/secondary UI accents.
// Others (`emerald`, `rose`, `amber`, etc.) are primarily for
// data visualization, sentiment indicators, and status messaging,
// maintaining 'monochrome with one accent' in general UI while
// providing rich data context.
export const COLORS = {
  // Carbon Terminal base surfaces
  background: "#000000",
  card: "#111111",
  // Signal colors — ONLY 3 allowed
  cyan: "#00FF66",      // Telemetry Green (was cyan)
  emerald: "#00FF66",   // Positive (mapped to green)
  rose: "#FF3333",      // Negative (red)
  amber: "#FFD600",     // Hazard Yellow
  violet: "#6B6B6B",    // Mapped to silver (monochrome)
  blue: "#6B6B6B",
  lime: "#00FF66",
  orange: "#FFD600",
  slate: "#6B6B6B",
  // Carbon Terminal surface tokens
  carbon: "#111111",
  titanium: "#1C1C1C",
  steel: "#2A2A2A",
  silver: "#6B6B6B",
  chrome: "#C0C0C0",
  white: "#E8E8E8",
  green: "#00FF66",
  red: "#FF3333",
  yellow: "#FFD600",
} as const;

// ── Sidebar Navigation Items ─────────────────────────────────────────────────

export interface NavItem {
  label: string;
  icon: string; // Placeholder for SF Symbol names (e.g., "bolt.fill", "map.fill")
  pageId: string; // Unique identifier for the page/route
  section: string; // Category for grouping in the sidebar
}

export const SIDEBAR_NAV: NavItem[] = [
  // TODAY — "What's happening right now?"
  { label: "Today", icon: "house.fill", pageId: "today", section: "TODAY" },
  { label: "Market Pulse", icon: "bolt.fill", pageId: "market-pulse", section: "TODAY" },
  { label: "Sector Radar", icon: "antenna.radiowaves.left.and.right", pageId: "sector-radar", section: "TODAY" },
  // RESEARCH — "What should I be watching?"
  { label: "Momentum Lifecycle", icon: "leaf.fill", pageId: "momentum-lifecycle", section: "RESEARCH" },
  { label: "Anomaly Detector", icon: "bolt.slash.fill", pageId: "anomaly-detector", section: "RESEARCH" },
  { label: "Hidden Alpha", icon: "diamond.fill", pageId: "hidden-alpha", section: "RESEARCH" },
  // PORTFOLIO — "How do I build a portfolio?"
  { label: "Portfolio X-Ray", icon: "briefcase.fill", pageId: "portfolio-intel", section: "PORTFOLIO" },
  { label: "Income Engine", icon: "dollarsign.circle.fill", pageId: "income-engine", section: "PORTFOLIO" },
  // STRATEGY — "Can I prove this works?"
  { label: "Strategy Lab", icon: "flask.fill", pageId: "strategy", section: "STRATEGY" },
  { label: "Alpha Calls", icon: "chart.line.uptrend.xyaxis", pageId: "alpha-calls", section: "STRATEGY" },
  { label: "Signals & Evidence", icon: "radar.fill", pageId: "signals", section: "STRATEGY" },
  // INTELLIGENCE — "What am I missing?"
  { label: "Whale Flow Intel", icon: "exclamationmark.triangle.fill", pageId: "whale-tracker", section: "INTELLIGENCE" },
  { label: "Insider & Institutional", icon: "person.badge.key.fill", pageId: "insider-buys", section: "INTELLIGENCE" },
  { label: "Ticker Deep Dive", icon: "chart.bar.fill", pageId: "ticker-detail", section: "INTELLIGENCE" },
  { label: "Earnings & Growth", icon: "chart.line.uptrend.xyaxis", pageId: "earnings-growers", section: "INTELLIGENCE" },
];

// ── Shared Numerical Constants ───────────────────────────────────────────────

export const DEFAULT_BACKTEST_HISTORY_DAYS = 10; // Default history period for backtesting

// ── Sentiment Styling ────────────────────────────────────────────────────────

// Defines Tailwind classes for various sentiment levels,
// used to provide consistent visual feedback with minimal borders.
export const SENTIMENT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Strong Bullish": { bg: "bg-[#00FF66]/10", text: "text-[#00FF66]", border: "border-[#2A2A2A]" },
  "Bullish": { bg: "bg-[#00FF66]/8", text: "text-[#00FF66]", border: "border-[#2A2A2A]" },
  "Neutral": { bg: "bg-[#6B6B6B]/10", text: "text-[#6B6B6B]", border: "border-[#2A2A2A]" },
  "Bearish": { bg: "bg-[#FFD600]/8", text: "text-[#FFD600]", border: "border-[#2A2A2A]" },
  "Strong Bearish": { bg: "bg-[#FF3333]/10", text: "text-[#FF3333]", border: "border-[#2A2A2A]" },
};

// ── Regime Styling ───────────────────────────────────────────────────────────

// Defines Tailwind classes for various market regimes,
// used for consistent visual representation with minimal borders.
export const REGIME_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Trending": { bg: "bg-[#00FF66]/8", text: "text-[#00FF66]", border: "border-[#2A2A2A]" },
  "Mean-Reverting": { bg: "bg-[#FFD600]/8", text: "text-[#FFD600]", border: "border-[#2A2A2A]" },
  "Choppy": { bg: "bg-[#6B6B6B]/8", text: "text-[#6B6B6B]", border: "border-[#2A2A2A]" },
};

// ── Animation & Motion Constants ─────────────────────────────────────────────

// Centralized constants for Framer Motion animations and general motion design.
export const MOTION_VARIANTS = {
    // Carbon Terminal: mechanical, no spring overshoot
    SPRING_TRANSITION_DEFAULT: { type: "tween" as const, duration: 0.1, ease: "easeOut" as const },
    SPRING_TRANSITION_FAST: { type: "tween" as const, duration: 0.05, ease: "easeOut" as const },
    STAGGER_CHILDREN_DELAY_MS: 30,
    PAGE_TRANSITION_DURATION_MS: 150,
    PAGE_TRANSITION_INITIAL_Y: 8,
    PAGE_TRANSITION_VARIANTS: {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.15, ease: "easeOut" } },
        exit: { opacity: 0, y: 4, transition: { duration: 0.1, ease: "easeOut" } },
    } as const,
    HOVER_TRANSLATE_Y: 0, // No hover lift — mechanical
    DEFAULT_ANIMATION_DURATION_MS: 100,
    FLASH_ANIMATION_DURATION_MS: 500,
    FADE_IN_OUT_DURATION_MS: 100,
} as const;

// ── Layout & Z-Indexing Constants ────────────────────────────────────────────

// Defines a consistent z-index hierarchy across the application.
export const Z_INDICES = {
    BASE: 10, // Default content layer
    SIDEBAR: 40, // Sidebar navigation
    STICKY_HEADER: 50, // Top navigation and sticky table headers
    DROPDOWN: 60, // Select menus, toolbars, context menus
    TOOLTIP: 70, // Tooltips and popovers
    MODAL_OVERLAY: 80, // Full-screen overlays for modals/sheets
    MODAL: 90, // Centered dialogs
    BOTTOM_SHEET: 100, // Mobile bottom sheets (highest interactive elements)
} as const;

// ── Interactive States & Shadows ─────────────────────────────────────────────

// Centralized definitions for consistent hover, focus, and active states,
// aligning with the "shadow depth and background tints instead" philosophy.
export const INTERACTIVE_STYLES = {
    // Carbon Terminal: no shadows, border-only feedback
    APPLE_CARD_HOVER_SHADOW: '0 0 0 1px #00FF66',
    APPLE_BUTTON_HOVER_SHADOWS: '0 0 0 1px #00FF66',
    APPLE_BUTTON_FOCUS_SHADOWS: '0 0 0 1px #00FF66',
    APPLE_BUTTON_ACTIVE_SHADOWS: 'inset 0 0 0 1px #00FF66',
} as const;

// ── Typography Constants ─────────────────────────────────────────────────────

// Defines precise letter-spacing values to achieve premium typographic control.
export const TYPOGRAPHY = {
    LETTER_SPACING_TIGHT_HEADING: '-0.03em', // For headings, hero text, and large numbers
    LETTER_SPACING_LOOSE_UPPERCASE: '0.1em', // For uppercase labels and badges
    LETTER_SPACING_DEFAULT: '0em', // Standard letter spacing
} as const;

// ── API & Service Constants ──────────────────────────────────────────────────

// Constants related to API interactions and service timings.
export const API_CONSTANTS = {
  DEFAULT_API_TIMEOUT_MS: 10000, // Default timeout for API requests
  POLLING_INTERVAL_MS: 5000, // Default interval for data polling
  DEBOUNCE_DELAY_MS: 300, // General debounce delay for input fields
} as const;

// ── Spring Physics ──────────────────────────────────────────────────────────

// Carbon Terminal: mechanical tween, no spring physics
export const SPRING_PHYSICS_DEFAULT = { type: "tween" as const, duration: 0.1, ease: "easeOut" as const };
export const springTransition = SPRING_PHYSICS_DEFAULT;

// ── API / WebSocket Constants ────────────────────────────────────────────────

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8060";
export const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE ?? API_BASE.replace(/^http/, "ws") + "/ws";

export const API_MAX_RETRIES = 2;
export const API_RETRY_DELAY_MS = 500;
export const API_RETRY_BACKOFF_FACTOR = 2;
export const API_RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
export const API_DEFAULT_CACHE_TTL_SECONDS = 30;

export const WS_RECONNECT_INTERVAL_MS = 3000;
export const WS_MAX_RECONNECT_ATTEMPTS = 10;
export const WS_HEARTBEAT_INTERVAL_MS = 30_000;
export const WS_HEARTBEAT_TIMEOUT_MS = 10_000;

// ── Signal Sorting ──────────────────────────────────────────────────────────

export const SORTABLE_SIGNAL_KEYS = [
  "ticker", "probability", "composite", "daily_change", "sentiment",
  "regime", "sector", "sys1_score", "sys2_score", "sys3_score", "sys4_score",
  "momentum_phase", "return_20d", "vol_spike",
] as const;

export type ValidSignalSortKey = (typeof SORTABLE_SIGNAL_KEYS)[number];

export const DEFAULT_SIGNAL_REFRESH_INTERVAL_MS = 60_000;

// ── Page / UI Constants ─────────────────────────────────────────────────────

export const TOP_SIGNALS_LIMIT = 15;
export const HIGH_CONFIDENCE_THRESHOLD = 65;
export const PAGE_TRANSITION_DURATION = 0.3;
export const SPRING_TRANSITION = SPRING_PHYSICS_DEFAULT;
export const STAGGER_CHILDREN_DELAY = 0.06;
export const INITIAL_STAGGER_DELAY = 0.1;
export const HOVER_Y_LIFT = -2;
export const Z_INDEX_STICKY_HEADER = Z_INDICES.STICKY_HEADER;
export const SHADOW_STICKY_HEADER = "shadow-[0_1px_3px_rgba(0,0,0,0.2)]";
export const TEXT_SHADOW_CYAN_GRADIENT = "";
export const SHADOW_GLOW_CYAN =
  "0 0 0 1px rgba(6, 182, 212, 0.2), 0 4px 24px -4px rgba(6, 182, 212, 0.15)";

// ── Screener Map ────────────────────────────────────────────────────────────

export const SCREENER_MAP: Record<string, string> = {
  fresh: "fresh_momentum",
  exhausting: "exhausting_momentum",
  rotation: "rotation_breakouts",
  shock: "momentum_shock",
  gamma: "gamma_squeeze_ops",
  "smart-money": "smart_money",
  continuation: "momentum_continuation",
  clusters: "momentum_clusters",
  "shock-clusters": "sector_shock_clusters",
  "hidden-gems": "hidden_gems",
  "yield-etfs": "high_yield_etfs",
  "dividend-stocks": "dividend_stocks",
};

// ── Additional Constants (referenced across components) ─────────────────────

// Spring / motion variants
export const TAP_TRANSITION = { type: "spring" as const, stiffness: 500, damping: 40, mass: 0.6 };
export const TAP_PHYSICS_DEFAULT = TAP_TRANSITION;
export const SPRING_TRANSITION_DEFAULTS = SPRING_PHYSICS_DEFAULT;
export const SPRING_TRANSITION_PROPS = SPRING_PHYSICS_DEFAULT;
export const SPRING_MOTION_CONFIG = SPRING_PHYSICS_DEFAULT;
export const TAP_PHYSICS = TAP_TRANSITION;
export const FRAMER_MOTION_SPRING_TRANSITION = SPRING_PHYSICS_DEFAULT;
export const DATA_UPDATE_FLASH_TRANSITION = { duration: 0.5, ease: "easeInOut" as const };
export const INTERACTIVE_TRANSITION = { duration: 0.15, ease: "easeOut" as const };
export const OVERLAY_TRANSITION_DEFAULT = { duration: 0.2, ease: "easeInOut" as const };

// Z-Index aliases
export const Z_INDEX_SIDEBAR = Z_INDICES.SIDEBAR;
export const Z_INDEX_SIDEBAR_OVERLAY = Z_INDICES.MODAL_OVERLAY;
export const Z_INDEX_TOOLTIP = Z_INDICES.TOOLTIP;
export const Z_INDEX_OVERLAY = Z_INDICES.MODAL_OVERLAY;
export const Z_INDEX_SHEET_CONTENT = Z_INDICES.MODAL;
export const Z_INDEX_FLASH = Z_INDICES.BASE;
export const Z_INDEX = Z_INDICES;

// Shadows — Carbon Terminal: border-only
export const COMMON_HOVER_SHADOW = "0 0 0 1px #2A2A2A";
export const CTA_GLOW_SHADOW = "0 0 0 1px #00FF66";
export const ELEVATED_SHADOW_DEFAULT = "none";
export const APPLE_CARD_HOVER_SHADOW = INTERACTIVE_STYLES.APPLE_CARD_HOVER_SHADOW;
export const INTERACTIVE_CARD_SHADOW_GLOW = "0 0 0 1px #00FF66";
export const INTERACTIVE_ELEMENT_HOVER_SHADOW_GLOW = INTERACTIVE_CARD_SHADOW_GLOW;
export const INTERACTIVE_GLOW_CYAN = "0 0 0 1px rgba(0,255,102,0.3)";
export const SHADOW_SOFT_VAR = "var(--shadow-soft)";
export const SHADOW_CARD_VAR = "var(--shadow-card)";
export const SHADOW_GLOW_CYAN_VAR = "var(--shadow-glow-cyan)";
export const SHADOWS = {
  soft: "var(--shadow-soft)",
  card: "var(--shadow-card)",
  elevated: "var(--shadow-elevated)",
  glowCyan: "var(--shadow-glow-cyan)",
};

// Card / Layout
export const CARD_BORDER_RADIUS = "4px";
export const CARD_BORDER_RADIUS_REM = 0.25;
export const Z_INDEX_GLOW = 0;
export const Z_INDEX_CONTENT = 1;
export const CHART_MIN_HEIGHT = 300;
export const HEADING_LETTER_SPACING = "-0.02em";
export const UPPERCASE_LETTER_SPACING = "0.12em";
export const DEFAULT_ACCENT_COLOR = "cyan" as const;

// Animation flash
export const FLASH_ANIMATION_DURATION_IN = 150;
export const FLASH_ANIMATION_DELAY_OUT = 300;
export const FLASH_ANIMATION_DURATION_OUT = 500;
export const FLASH_COLORS = {
  bullish: "rgba(0, 255, 102, 0.15)",
  bearish: "rgba(255, 51, 51, 0.15)",
  positive: "#00FF66",
  negative: "#FF3333",
  neutral: "#6B6B6B",
};
export const FLASH_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.5 } },
};
export const SHIMMER_ANIMATION_PROPS = {
  initial: { opacity: 0.5 },
  animate: { opacity: 1 },
  transition: { repeat: Infinity, repeatType: "reverse" as const, duration: 1.2 },
};
export const ITEM_WHILE_HOVER = { y: 0, transition: SPRING_PHYSICS_DEFAULT }; // No hover lift
export const PAGE_TRANSITION_INITIAL = { opacity: 0, y: 8 };
export const PAGE_TRANSITION_ANIMATE = { opacity: 1, y: 0 };

// Tooltip / motion presets
export const TOOLTIP_MOTION_VARIANTS = {
  initial: { opacity: 0, y: 4, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.15, ease: "easeOut" } },
  exit: { opacity: 0, y: 4, scale: 0.96, transition: { duration: 0.1 } },
};
export const SEPARATOR_MOTION_PROPS = {
  initial: { scaleX: 0 },
  animate: { scaleX: 1 },
  transition: { duration: 0.3, ease: "easeOut" },
};

// Motion grouped namespace (for topnav.tsx)
export const MOTION = MOTION_VARIANTS;

// Thresholds
export const STRONG_TRENDING_COMPOSITE_THRESHOLD = 0.65;
export const STAGGER_CHILDREN_DELAY_MS = 60;
export const BACKTEST_HISTORY_LIMIT = 50;

// RGB / Color helpers
export const COLOR_RGB_COMPONENTS: Record<string, string> = {
  cyan: "0, 255, 102",
  emerald: "0, 255, 102",
  rose: "255, 51, 51",
  amber: "255, 214, 0",
  violet: "107, 107, 107",
  blue: "107, 107, 107",
  lime: "0, 255, 102",
  orange: "255, 214, 0",
  slate: "107, 107, 107",
};

// Internal chart series ID
export const INTERNAL_SERIES_ID_HORIZONTAL_LINES = "__horizontal_lines__";

// ── Button Shadow Constants ─────────────────────────────────────────────────

// Carbon Terminal: minimal border-only focus states
export const SHADOW_BUTTON_SECONDARY_HOVER = "0 0 0 1px #2A2A2A";
export const SHADOW_BUTTON_GHOST_HOVER = "0 0 0 1px #2A2A2A";
export const SHADOW_BUTTON_PRIMARY_FOCUS = "0 0 0 1px #00FF66";
export const SHADOW_BUTTON_DANGER_FOCUS = "0 0 0 1px #FF3333";
export const SHADOW_BUTTON_SECONDARY_FOCUS = "0 0 0 1px #C0C0C0";
export const SHADOW_BUTTON_GHOST_FOCUS = "0 0 0 1px #6B6B6B";

export const GLOW_SHADOW_CYAN = "0 0 0 1px #00FF66";
export const GLOW_SHADOW_ROSE = "0 0 0 1px #FF3333";

// ── Button Dimension Constants ──────────────────────────────────────────────

export const MIN_BUTTON_HEIGHT_PX = 36;
export const BUTTON_HEIGHT_LG_PX = 42;
export const BUTTON_ICON_SIZE_PX = 32;
export const BUTTON_ICON_SIZE_LG_PX = 40;
export const BUTTON_TEXT_LETTER_SPACING_TIGHT = "-0.02em";
export const BUTTON_TEXT_LETTER_SPACING_NORMAL = "-0.01em";
export const FOCUS_NEUTRAL_COLOR_KEY = "slate";
export const FOCUS_NEUTRAL_OPACITY = 0.15;
export const MOTION_SPRING_CONFIG = SPRING_PHYSICS_DEFAULT;

// ── Table Constants ─────────────────────────────────────────────────────────

export const TABLE_ROW_HOVER_SHADOW = "none";
export const CARD_HOVER_Y_OFFSET = 0;
export const Z_INDEX_STICKY_CELL = 10;
export const Z_INDEX_STICKY_HEADER_FOOTER = 20;
export const Z_INDEX_STICKY_HEAD = 25;
export const TABLE_SCROLLED_HEADER_SHADOW = "0 1px 0 0 #2A2A2A";
export const TABLE_SCROLLED_FOOTER_SHADOW = "inset 0 1px 0 0 #2A2A2A";
export const TABLE_SCROLLED_LEFT_COLUMN_SHADOW = "1px 0 0 0 #2A2A2A";
export const TABLE_SCROLLED_RIGHT_COLUMN_SHADOW = "-1px 0 0 0 #2A2A2A";

// ── Dialog Constants ────────────────────────────────────────────────────────

export const OVERLAY_TRANSITION = { duration: 0.2, ease: "easeInOut" as const };
export const OVERLAY_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};
export const DIALOG_MOBILE_VARIANTS = {
  hidden: { opacity: 0, y: "100%" },
  visible: { opacity: 1, y: 0 },
};
export const DIALOG_DESKTOP_VARIANTS = {
  hidden: { opacity: 0, y: 20, x: "-50%", scale: 0.96 },
  visible: { opacity: 1, y: "-50%", x: "-50%", scale: 1 },
};
export const DIALOG_CLOSE_BUTTON_HOVER = { scale: 1.08, backgroundColor: "rgba(42,42,42,0.8)" };
export const DIALOG_CLOSE_BUTTON_TAP = { scale: 0.92 };
export const DIALOG_CLOSE_BUTTON_TRANSITION = SPRING_PHYSICS_DEFAULT;
export const DIALOG_CLOSE_BUTTON_FOCUS_SHADOW = "0 0 0 1px #00FF66";
export const DIALOG_CLOSE_BUTTON_FOCUS_Y = -1;
export const DIALOG_CLOSE_BUTTON_FOCUS_BG = "focus-visible:bg-[#1C1C1C]/80";

// ── Select Constants ────────────────────────────────────────────────────────

export const PAGE_TRANSITION_Y = 8;
export const Z_INDEX_POPUP = Z_INDICES.DROPDOWN;
export const Z_INDEX_SCROLL_BUTTON = 5;

export const TYPOGRAPHY_EXTENDED = {
  letterSpacing: {
    tight: "-0.03em",
    normal: "-0.01em",
    wide: "0.1em",
  },
  fontFamily: {
    sans: "var(--font-sans)",
    mono: "var(--font-mono)",
  },
};

// ── Z_INDICES Extended keys (referenced by dialog.tsx) ──────────────────────

export const Z_INDICES_DIALOG = {
  dialogOverlay: Z_INDICES.MODAL_OVERLAY,
  dialogContent: Z_INDICES.MODAL,
  dialogCloseButton: Z_INDICES.MODAL + 1,
} as const;

// ── Sentiment Badge Constants ───────────────────────────────────────────────

export const SHADOW_SOFT = "var(--shadow-soft)";
export const SHADOW_CARD_ELEVATED = "var(--shadow-elevated)";

// ── Ticker Search Constants ─────────────────────────────────────────────────

export const ITEM_HOVER_Y = -2;
export const MIN_TOUCH_TARGET_SIZE_PX = 44;
export const INPUT_DEFAULT_SHADOW = "var(--shadow-soft)";
export const INPUT_FOCUS_GLOW_SHADOW = "0 0 0 1px #00FF66";
export const ITEM_ACTIVE_BG = "rgba(0, 255, 102, 0.06)";
export const ITEM_FOCUS_GLOW_SHADOW = "0 0 0 1px #00FF6630";
export const Z_INDEX_DROPDOWN_OVERLAY = Z_INDICES.DROPDOWN;

// ── Leaderboard Constants ───────────────────────────────────────────────────

export const AURA_LABELS: Record<string, string> = {
  ultra: "Ultra Instinct",
  elite: "Elite",
  strong: "Strong",
  moderate: "Moderate",
  neutral: "Neutral",
  weak: "Weak",
};
export const AURA_SCORE_THRESHOLDS = { ultra: 90, elite: 75, strong: 60, moderate: 45, neutral: 30, weak: 0 } as const;
export const SPRING_PHYSICS_SNAPPY = { type: "tween" as const, duration: 0.05, ease: "easeOut" as const };
export const FLASH_TRANSITION = {
  duration: 0.5,
  ease: "easeInOut" as const,
  flashColor: COLORS.green,
};
export const LEADERBOARD_SCORE_MULTIPLIER = 100;
export const LEADERBOARD_SCORE_OFFSET = 0;
export const LEADERBOARD_MIN_PROGRESS_SCALE = 0.05;
export const LEADERBOARD_MAX_PROGRESS_SCALE = 1.0;
export const INTERACTIVE_HOVER_PROPS = { y: 0, boxShadow: "0 0 0 1px #00FF66" };
export const INTERACTIVE_FOCUS_PROPS = { y: 0, boxShadow: "0 0 0 1px #00FF66" };

// ── Ticker Modal Constants ──────────────────────────────────────────────────

export const SHADOW_ELEVATED_HOVER = "0 0 0 1px #00FF66";
export const SHADOW_CTA_GLOW = CTA_GLOW_SHADOW;
export const TEXT_GLOW_CYAN = "";
export const LETTER_SPACING = {
  tight: "-0.03em",
  normal: "0em",
  wide: "0.1em",
};

// ── Rotation Signals Constants ──────────────────────────────────────────────

export const CARD_HOVER_BACKGROUND = "rgba(0, 255, 102, 0.04)";
export const SF_SYMBOLS: Record<string, string> = {
  "bolt.fill": "bolt.fill",
  "leaf.fill": "leaf.fill",
  "flame.fill": "flame.fill",
  "diamond.fill": "diamond.fill",
  "rocket.fill": "rocket.fill",
  "chart.bar.fill": "chart.bar.fill",
  "arrow.right": "arrow.right",
  "map.fill": "map.fill",
};

// ── Backtest Constants ──────────────────────────────────────────────────────

export const BACKTEST_INITIAL_RENDER_DELAY_MS = 100;
export const BACKTEST_PRE_API_PROGRESS_SETTLE_DELAY_MS = 500;
export const BACKTEST_PROGRESS_INCREMENT_MAX = 3;
export const BACKTEST_PROGRESS_INCREMENT_MIN = 0.5;
export const BACKTEST_PROGRESS_INTERVAL_MS = 400;
export const BACKTEST_PROGRESS_MAX_SIMULATED = 85;

// ── Chart/Layout Utility Constants ──────────────────────────────────────────

export const TRACKING_HEADING_CLASS = "tracking-[-0.02em]";
export const CARD_HOVER_MOTION_PROPS = { y: 0, boxShadow: "0 0 0 1px #00FF66" };
export const LIST_ITEM_HOVER_MOTION_PROPS = { y: 0, boxShadow: "none" };
export const SHADOW_GLOW_CYAN_VALUE = "0 0 0 1px rgba(0,255,102,0.3)";
export const MIN_CHART_HEIGHT_CLASS = "min-h-[300px]";

// ── Page Motion Variants ────────────────────────────────────────────────────

export const PAGE_MOTION_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.15, ease: "easeOut" } },
  exit: { opacity: 0, y: 4, transition: { duration: 0.1, ease: "easeOut" } },
};
export const PAGE_TRANSITION_VARIANTS_PROPS = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
};

// ── Icon Size Constants ─────────────────────────────────────────────────────

export const DEFAULT_ICON_SIZE_SM = "w-4 h-4";
export const DEFAULT_ICON_SIZE_MD = "w-5 h-5";
export const DEFAULT_ICON_SIZE_LG = "w-6 h-6";
export const DEFAULT_TOUCH_TARGET_MIN_SIZE = "min-w-[44px] min-h-[44px]";

// ── App Shell / Hamburger Button Constants ──────────────────────────────────

export const HAMBURGER_BUTTON_INITIAL_SHADOW = "var(--shadow-soft)";
export const HAMBURGER_BUTTON_HOVER_SHADOW = "var(--shadow-elevated), var(--shadow-glow-cyan)";

// ── Receipts Page Constants ─────────────────────────────────────────────────

export const FILTER_BUTTON_MIN_SIZE = "min-w-[80px] min-h-[40px]";
export const FLASH_ANIMATION_PROPS = {
  flash: { opacity: [1, 0.5, 1], transition: { duration: 0.5, ease: "easeInOut" } },
};
export const TYPOGRAPHY_LETTER_SPACING_UPPERCASE = "0.1em";
export const TYPOGRAPHY_LETTER_SPACING_HEADING = "-0.03em";