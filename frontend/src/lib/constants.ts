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
  background: "#050a12", // Near-black with blue tint
  card: "rgba(15,23,42,0.45)", // Translucent card background, synchronized with --card in globals.css
  cyan: "#06b6d4", // Primary accent
  emerald: "#10b981", // Bullish/positive
  rose: "#f43f5e", // Bearish/negative
  amber: "#f59e0b", // Warnings/neutral
  violet: "#8b5cf6", // Secondary accent
  
  blue: "#3b82f6", 
  lime: "#84cc16",
  orange: "#f97316",
  slate: "#64748b",
} as const;

// ── Sidebar Navigation Items ─────────────────────────────────────────────────

export interface NavItem {
  label: string;
  icon: string; // Placeholder for SF Symbol names (e.g., "bolt.fill", "map.fill")
  pageId: string; // Unique identifier for the page/route
  section: string; // Category for grouping in the sidebar
}

export const SIDEBAR_NAV: NavItem[] = [
  // Platform
  { label: "Intelligence", icon: "bolt.fill", pageId: "intelligence", section: "PLATFORM" },
  { label: "Vector Market Map", icon: "map.fill", pageId: "vector-map", section: "PLATFORM" },
  { label: "Sector Intelligence", icon: "antenna.radiowaves.left.and.right", pageId: "sector-intel", section: "PLATFORM" },
  { label: "Portfolio Intelligence", icon: "briefcase.fill", pageId: "portfolio-intel", section: "PLATFORM" },
  { label: "Ticker Detail", icon: "chart.bar.fill", pageId: "ticker-detail", section: "PLATFORM" },
  // Stock Screeners
  { label: "Fresh Momentum", icon: "leaf.fill", pageId: "fresh", section: "STOCK SCREENERS" },
  { label: "Momentum 95+", icon: "star.fill", pageId: "momentum-95", section: "STOCK SCREENERS" },
  { label: "Exhausting Momentum", icon: "flame.fill", pageId: "exhausting", section: "STOCK SCREENERS" },
  { label: "Rotation Breakouts", icon: "tornado", pageId: "rotation", section: "STOCK SCREENERS" },
  { label: "Momentum Shock", icon: "bolt.slash.fill", pageId: "shock", section: "STOCK SCREENERS" },
  { label: "Gamma Squeeze Ops", icon: "target", pageId: "gamma", section: "STOCK SCREENERS" },
  { label: "Smart Money", icon: "dollarsign.circle.fill", pageId: "smart-money", section: "STOCK SCREENERS" },
  { label: "Momentum Continuation", icon: "rocket.fill", pageId: "continuation", section: "STOCK SCREENERS" },
  { label: "Momentum Clusters", icon: "cube.fill", pageId: "clusters", section: "STOCK SCREENERS" },
  { label: "Sector Shock Clusters", icon: "bolt.circle.fill", pageId: "shock-clusters", section: "STOCK SCREENERS" },
  { label: "Hidden Gems", icon: "diamond.fill", pageId: "hidden-gems", section: "STOCK SCREENERS" },
  // ETF
  { label: "ETF Screener", icon: "chart.line.uptrend.rectangle.fill", pageId: "etf-screener", section: "ETF" },
  // Thematic
  { label: "AI Stocks", icon: "brain.fill", pageId: "ai-stocks", section: "THEMATIC" },
  { label: "Bullish Momentum", icon: "arrow.up.right.circle.fill", pageId: "bullish-momentum", section: "THEMATIC" },
  { label: "Volume Gappers", icon: "chart.bar.doc.horizontal.fill", pageId: "volume-gappers", section: "THEMATIC" },
  // Fundamentals
  { label: "Earnings Growers", icon: "chart.line.uptrend.xyaxis", pageId: "earnings-growers", section: "FUNDAMENTALS" },
  // Income
  { label: "High Yield ETFs", icon: "chart.line.uptrend.rectangle.fill", pageId: "yield-etfs", section: "INCOME" },
  { label: "Dividend Stocks", icon: "dollarsign.square.fill", pageId: "dividend-stocks", section: "INCOME" },
  // Research
  { label: "Signals & Strategies", icon: "radar.fill", pageId: "signals", section: "RESEARCH" },
  // Strategy
  { label: "Strategy Builder", icon: "flask.fill", pageId: "strategy", section: "STRATEGY" },
];

// ── Shared Numerical Constants ───────────────────────────────────────────────

export const DEFAULT_BACKTEST_HISTORY_DAYS = 10; // Default history period for backtesting

// ── Sentiment Styling ────────────────────────────────────────────────────────

// Defines Tailwind classes for various sentiment levels,
// used to provide consistent visual feedback with minimal borders.
export const SENTIMENT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Strong Bullish": { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-transparent" },
  "Bullish": { bg: "bg-lime-500/12", text: "text-lime-400", border: "border-transparent" },
  "Neutral": { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-transparent" },
  "Bearish": { bg: "bg-orange-500/12", text: "text-orange-400", border: "border-transparent" },
  "Strong Bearish": { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-transparent" },
};

// ── Regime Styling ───────────────────────────────────────────────────────────

// Defines Tailwind classes for various market regimes,
// used for consistent visual representation with minimal borders.
export const REGIME_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Trending": { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-transparent" },
  "Mean-Reverting": { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-transparent" },
  "Choppy": { bg: "bg-slate-500/8", text: "text-slate-500", border: "border-transparent" },
};

// ── Animation & Motion Constants ─────────────────────────────────────────────

// Centralized constants for Framer Motion animations and general motion design.
export const MOTION_VARIANTS = {
    SPRING_TRANSITION_DEFAULT: { type: "spring", stiffness: 300, damping: 30, mass: 1 } as const, // Snappy defaults
    SPRING_TRANSITION_FAST: { type: "spring", stiffness: 400, damping: 35, mass: 0.8 } as const, // Faster micro-interactions
    STAGGER_CHILDREN_DELAY_MS: 60, // Delay between staggered children animations (e.g., list items)
    PAGE_TRANSITION_DURATION_MS: 300, // Overall duration for page transitions
    PAGE_TRANSITION_INITIAL_Y: 20, // Initial Y offset for page transitions (y 20 -> 0)
    PAGE_TRANSITION_VARIANTS: { // Framer Motion variants for consistent page transitions
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } }, // Apple-esque cubic bezier
        exit: { opacity: 0, y: 10, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } },
    } as const,
    HOVER_TRANSLATE_Y: -2, // Y translation for hover effects (translateY(-2px))
    DEFAULT_ANIMATION_DURATION_MS: 200, // Generic duration for non-spring animations
    FLASH_ANIMATION_DURATION_MS: 500, // Duration for subtle real-time data flash animations
    FADE_IN_OUT_DURATION_MS: 150, // For quick opacity transitions
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
    // General card hover/focus: subtle elevation with a transparent inner border hint
    APPLE_CARD_HOVER_SHADOW: '0 4px 12px rgba(0,0,0,0.3), 0 0 0 1px rgba(15,23,42,0.6)',
    // Button specific states, combining shadow depth with a subtle glow (cyan primary accent)
    APPLE_BUTTON_HOVER_SHADOWS: `0 2px 8px rgba(0, 0, 0, 0.4), 0 0 0 1px ${COLORS.cyan}40`, // Elevation + subtle cyan glow
    APPLE_BUTTON_FOCUS_SHADOWS: `0 0 0 2px ${COLORS.cyan}80`, // Stronger cyan glow for focus-visible
    APPLE_BUTTON_ACTIVE_SHADOWS: `inset 0 1px 2px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(15,23,42,0.6)`, // Inner shadow for pressed state
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

export const SPRING_PHYSICS_DEFAULT = { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 };

/** Convenience export — used across many components for Framer Motion transitions */
export const springTransition = SPRING_PHYSICS_DEFAULT;

// ── API / WebSocket Constants ────────────────────────────────────────────────

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8060";
export const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE ?? "ws://localhost:8060/ws";

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

// Shadows
export const COMMON_HOVER_SHADOW = "0 4px 12px rgba(0,0,0,0.3), 0 0 0 1px rgba(15,23,42,0.6)";
export const CTA_GLOW_SHADOW = `0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px ${COLORS.cyan}40`;
export const ELEVATED_SHADOW_DEFAULT = "0 8px 40px -6px rgba(0,0,0,0.6), 0 4px 16px -4px rgba(0,0,0,0.4)";
export const APPLE_CARD_HOVER_SHADOW = INTERACTIVE_STYLES.APPLE_CARD_HOVER_SHADOW;
export const INTERACTIVE_CARD_SHADOW_GLOW = `0 4px 24px -4px rgba(6,182,212,0.15), 0 0 0 1px rgba(6,182,212,0.1)`;
export const INTERACTIVE_ELEMENT_HOVER_SHADOW_GLOW = INTERACTIVE_CARD_SHADOW_GLOW;
export const INTERACTIVE_GLOW_CYAN = `0 0 0 1px rgba(6,182,212,0.2), 0 4px 24px -4px rgba(6,182,212,0.15)`;
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
export const CARD_BORDER_RADIUS = "1.2rem";
export const CARD_BORDER_RADIUS_REM = 1.2;
export const Z_INDEX_GLOW = 0;
export const Z_INDEX_CONTENT = 1;
export const CHART_MIN_HEIGHT = 300;
export const HEADING_LETTER_SPACING = "-0.03em";
export const UPPERCASE_LETTER_SPACING = "0.1em";
export const DEFAULT_ACCENT_COLOR = "cyan" as const;

// Animation flash
export const FLASH_ANIMATION_DURATION_IN = 150;
export const FLASH_ANIMATION_DELAY_OUT = 300;
export const FLASH_ANIMATION_DURATION_OUT = 500;
export const FLASH_COLORS = {
  bullish: "rgba(16,185,129,0.12)",
  bearish: "rgba(244,63,94,0.12)",
  positive: "#10b981",
  negative: "#f43f5e",
  neutral: "#94a3b8",
};
export const FLASH_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.5 } },
};
export const SHIMMER_ANIMATION_PROPS = {
  initial: { opacity: 0.5 },
  animate: { opacity: 1 },
  transition: { repeat: Infinity, repeatType: "reverse" as const, duration: 1.2 },
};
export const ITEM_WHILE_HOVER = { y: -2, transition: SPRING_PHYSICS_DEFAULT };
export const PAGE_TRANSITION_INITIAL = { opacity: 0, y: 20 };
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
  cyan: "6, 182, 212",
  emerald: "16, 185, 129",
  rose: "244, 63, 94",
  amber: "245, 158, 11",
  violet: "139, 92, 246",
  blue: "59, 130, 246",
  lime: "132, 204, 22",
  orange: "249, 115, 22",
  slate: "100, 116, 139",
};

// Internal chart series ID
export const INTERNAL_SERIES_ID_HORIZONTAL_LINES = "__horizontal_lines__";

// ── Button Shadow Constants ─────────────────────────────────────────────────

export const SHADOW_BUTTON_SECONDARY_HOVER = "0 4px 12px rgba(0,0,0,0.3), 0 0 0 1px rgba(139,92,246,0.2)";
export const SHADOW_BUTTON_GHOST_HOVER = "0 4px 12px rgba(0,0,0,0.15)";
export const SHADOW_BUTTON_PRIMARY_FOCUS = `0 0 0 3px rgba(6,182,212,0.3), 0 4px 16px rgba(6,182,212,0.15)`;
export const SHADOW_BUTTON_DANGER_FOCUS = "0 0 0 3px rgba(244,63,94,0.3), 0 4px 16px rgba(244,63,94,0.15)";
export const SHADOW_BUTTON_SECONDARY_FOCUS = "0 0 0 3px rgba(139,92,246,0.3), 0 4px 16px rgba(139,92,246,0.15)";
export const SHADOW_BUTTON_GHOST_FOCUS = "0 0 0 3px rgba(100,116,139,0.2)";

// ── Button / General Glow Shadows ───────────────────────────────────────────

export const GLOW_SHADOW_CYAN = "0 0 16px -2px rgba(6,182,212,0.35)";
export const GLOW_SHADOW_ROSE = "0 0 16px -2px rgba(244,63,94,0.35)";

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

export const TABLE_ROW_HOVER_SHADOW = "0 4px 16px -2px rgba(0,0,0,0.35), 0 0 0 1px rgba(6,182,212,0.12)";
export const CARD_HOVER_Y_OFFSET = -2;
export const Z_INDEX_STICKY_CELL = 10;
export const Z_INDEX_STICKY_HEADER_FOOTER = 20;
export const Z_INDEX_STICKY_HEAD = 25;
export const TABLE_SCROLLED_HEADER_SHADOW = "0 4px 16px -2px rgba(0,0,0,0.3)";
export const TABLE_SCROLLED_FOOTER_SHADOW = "inset 0 4px 16px -2px rgba(0,0,0,0.3)";
export const TABLE_SCROLLED_LEFT_COLUMN_SHADOW = "4px 0 12px -4px rgba(0,0,0,0.3)";
export const TABLE_SCROLLED_RIGHT_COLUMN_SHADOW = "-4px 0 12px -4px rgba(0,0,0,0.3)";

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
export const DIALOG_CLOSE_BUTTON_HOVER = { scale: 1.08, backgroundColor: "rgba(15,23,42,0.8)" };
export const DIALOG_CLOSE_BUTTON_TAP = { scale: 0.92 };
export const DIALOG_CLOSE_BUTTON_TRANSITION = SPRING_PHYSICS_DEFAULT;
export const DIALOG_CLOSE_BUTTON_FOCUS_SHADOW = "0 0 0 2px rgba(6,182,212,0.4)";
export const DIALOG_CLOSE_BUTTON_FOCUS_Y = -1;
export const DIALOG_CLOSE_BUTTON_FOCUS_BG = "focus-visible:bg-slate-800/80";

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
export const INPUT_FOCUS_GLOW_SHADOW = `0 0 0 2px ${COLORS.cyan}40, ${ELEVATED_SHADOW_DEFAULT}`;
export const ITEM_ACTIVE_BG = "rgba(6, 182, 212, 0.08)";
export const ITEM_FOCUS_GLOW_SHADOW = `0 0 0 1px ${COLORS.cyan}30`;
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
export const SPRING_PHYSICS_SNAPPY = { type: "spring" as const, stiffness: 400, damping: 35, mass: 0.8 };
export const FLASH_TRANSITION = {
  duration: 0.5,
  ease: "easeInOut" as const,
  flashColor: COLORS.cyan,
};
export const LEADERBOARD_SCORE_MULTIPLIER = 100;
export const LEADERBOARD_SCORE_OFFSET = 0;
export const LEADERBOARD_MIN_PROGRESS_SCALE = 0.05;
export const LEADERBOARD_MAX_PROGRESS_SCALE = 1.0;
export const INTERACTIVE_HOVER_PROPS = { y: -2, boxShadow: INTERACTIVE_CARD_SHADOW_GLOW };
export const INTERACTIVE_FOCUS_PROPS = { y: -2, boxShadow: `0 0 0 2px ${COLORS.cyan}60` };

// ── Ticker Modal Constants ──────────────────────────────────────────────────

export const SHADOW_ELEVATED_HOVER = "0 8px 40px -6px rgba(0,0,0,0.6), 0 0 0 1px rgba(6,182,212,0.15)";
export const SHADOW_CTA_GLOW = CTA_GLOW_SHADOW;
export const TEXT_GLOW_CYAN = "";
export const LETTER_SPACING = {
  tight: "-0.03em",
  normal: "0em",
  wide: "0.1em",
};

// ── Rotation Signals Constants ──────────────────────────────────────────────

export const CARD_HOVER_BACKGROUND = "rgba(6, 182, 212, 0.03)";
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

export const TRACKING_HEADING_CLASS = "tracking-[-0.03em]";
export const CARD_HOVER_MOTION_PROPS = { y: -2, boxShadow: INTERACTIVE_CARD_SHADOW_GLOW };
export const LIST_ITEM_HOVER_MOTION_PROPS = { y: -1, boxShadow: "var(--shadow-soft)" };
export const SHADOW_GLOW_CYAN_VALUE = `0 0 0 1px rgba(6,182,212,0.2), 0 4px 24px -4px rgba(6,182,212,0.15)`;
export const MIN_CHART_HEIGHT_CLASS = "min-h-[300px]";

// ── Page Motion Variants ────────────────────────────────────────────────────

export const PAGE_MOTION_VARIANTS = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } },
  exit: { opacity: 0, y: 10, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } },
};
export const PAGE_TRANSITION_VARIANTS_PROPS = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
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