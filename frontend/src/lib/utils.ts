import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { SENTIMENT_STYLES, REGIME_STYLES } from "./constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a hex color string to an rgba() string.
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── App Logger ─────────────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';

interface LogContext {
  [key: string]: any;
}

export const appLogger = {
  warn: (message: string, context?: LogContext) => {
    if (!isProduction) {
      console.warn(`[App Warning] ${message}`, context ? { context } : '');
    }
  },
};
// ───────────────────────────────────────────────────────────────────────────

// ── Design Token Helpers ───────────────────────────────────────────────────

/**
 * Represents the valid keys from the extended color palette that are intended
 * for direct mapping to Tailwind CSS classes with shades (e.g., 'text-cyan-400', 'bg-emerald-500').
 * This type guides developers to use colors that are part of the core design system
 * and have corresponding Tailwind utility classes with defined shades.
 * It is exported to be usable by other design token configuration files (e.g., lib/constants.ts).
 */
export type PaletteColorKey =
  | 'cyan'
  | 'emerald'
  | 'rose'
  | 'amber'
  | 'violet';

/**
 * Interface representing the structured configuration for sentiment-based styles.
 * This type is used to interpret the refactored SENTIMENT_STYLES object from constants.ts.
 * Defined locally as per "Do NOT change import paths" constraint, assuming it's
 * not directly exported from constants.ts for utility consumption.
 */
interface SentimentConfig {
  colorKey: PaletteColorKey;
  bgShade?: string;
  bgOpacity?: string;
  textShade?: string;
  borderShade?: string;
  borderOpacity?: string;
}

/**
 * Interface representing the structured configuration for market regime-based styles.
 * This type is used to interpret the refactored REGIME_STYLES object from constants.ts.
 * Defined locally for the same reasons as SentimentConfig.
 */
interface RegimeConfig {
  colorKey: PaletteColorKey;
  bgShade?: string;
  bgOpacity?: string;
  textShade?: string;
  borderShade?: string;
  borderOpacity?: string;
}

/**
 * Retrieves a set of Tailwind class strings for a given sentiment.
 * This utility centralizes the visual representation of sentiment, ensuring
 * consistency across the platform. It provides classes for background, text,
 * and border, allowing components to selectively apply elements to adhere
 * to the 'minimal borders' philosophy where appropriate.
 *
 * @param sentiment - The semantic sentiment level (e.g., "Strong Bullish", "Neutral").
 * @returns An object containing `bg`, `text`, and `border` Tailwind class strings.
 *          Defaults to "Neutral" styles if the sentiment is unrecognized, logging a warning.
 */
export type SentimentType = keyof typeof SENTIMENT_STYLES;
export function getSentimentClasses(sentiment: SentimentType) {
  const styles = SENTIMENT_STYLES[sentiment];
  if (!styles) {
    appLogger.warn(`Unknown sentiment: "${sentiment}". Falling back to "Neutral" styles.`);
    const fallback = SENTIMENT_STYLES["Neutral"];
    return { bg: fallback.bg, text: fallback.text, border: fallback.border };
  }
  return { bg: styles.bg, text: styles.text, border: styles.border };
}

/**
 * Retrieves a set of Tailwind class strings for a given market regime.
 */
type RegimeType = keyof typeof REGIME_STYLES;
export function getRegimeClasses(regime: RegimeType) {
  const styles = REGIME_STYLES[regime];
  if (!styles) {
    appLogger.warn(`Unknown regime: "${regime}". Falling back to "Choppy" styles.`);
    const fallback = REGIME_STYLES["Choppy"];
    return { bg: fallback.bg, text: fallback.text, border: fallback.border };
  }
  return { bg: styles.bg, text: styles.text, border: styles.border };
}

/**
 * Generates a Tailwind CSS class string for text color using a predefined palette color.
 * This ensures that text colors adhere to the established design system, promoting
 * consistency in typography and color hierarchy.
 *
 * @param colorKey - A key from `PaletteColorKey` (e.g., "cyan" for primary accent, "emerald" for bullish).
 * @param shade - The Tailwind color shade (e.g., '400', '500'). Defaults to '400' for text for optimal readability.
 * @returns A Tailwind `text-{colorKey}-{shade}` class string.
 */
export function getTextColorClass(colorKey: PaletteColorKey, shade: string = '400'): string {
  return `text-${colorKey}-${shade}`;
}

/**
 * Generates a Tailwind CSS class string for background color using a predefined palette color.
 * This utility centralizes the application of background tints and colors, crucial for
 * creating depth and hierarchy with tonal surfaces, while respecting the 'monochrome
 * with one accent' principle.
 *
 * @param colorKey - A key from `PaletteColorKey`.
 * @param shade - The Tailwind color shade (e.g., '500'). Defaults to '500'.
 * @param opacity - Optional Tailwind opacity value (e.g., '10', '15').
 * @returns A Tailwind `bg-{colorKey}-{shade}` or `bg-{colorKey}-{shade}/{opacity}` class string.
 */
export function getBackgroundColorClass(colorKey: PaletteColorKey, shade: string = '500', opacity?: string): string {
  return opacity ? `bg-${colorKey}-${shade}/${opacity}` : `bg-${colorKey}-${shade}`;
}

/**
 * Generates a Tailwind CSS class string for border color using a predefined palette color.
 * This helper facilitates the use of subtle, intentional borders, aligning with the
 * 'minimal borders' design philosophy by providing explicit color tokens.
 *
 * @param colorKey - A key from `PaletteColorKey`.
 * @param shade - The Tailwind color shade (e.g., '500'). Defaults to '500'.
 * @param opacity - Optional Tailwind opacity value (e.g., '20', '30').
 * @returns A Tailwind `border-{colorKey}-{shade}` or `border-{colorKey}-{shade}/{opacity}` class string.
 */
export function getBorderColorClass(colorKey: PaletteColorKey, shade: string = '500', opacity?: string): string {
  return opacity ? `border-${colorKey}-${shade}/${opacity}` : `border-${colorKey}-${shade}`;
}

/**
 * Generates a Tailwind CSS class for gradient `from-` color.
 */
export function getFromColorClass(colorKey: PaletteColorKey, shade: string = '500'): string {
  return `from-${colorKey}-${shade}`;
}

/**
 * Generates a Tailwind CSS class for gradient `to-` color.
 */
export function getToColorClass(colorKey: PaletteColorKey, shade: string = '500'): string {
  return `to-${colorKey}-${shade}`;
}

// ── Additional Utility Functions (referenced across components) ─────────────

const ACCENT_HEX_MAP: Record<string, string> = {
  cyan: "#06b6d4",
  emerald: "#10b981",
  rose: "#f43f5e",
  amber: "#f59e0b",
  violet: "#8b5cf6",
  blue: "#3b82f6",
  lime: "#84cc16",
  orange: "#f97316",
  slate: "#64748b",
};

/** Get an rgba string from a hex color and alpha, useful for dynamic inline styles */
export function getRgbaString(hex: string, alpha: number = 1): string {
  if (!hex) return "rgba(148,163,184,0.15)"; // safe fallback for undefined/null
  return hexToRgba(hex, alpha);
}

/** Get rgba for a named accent color key and alpha */
export function getAccentRgba(colorKey: PaletteColorKey | string, alpha: number = 1): string {
  return hexToRgba(ACCENT_HEX_MAP[colorKey] || "#06b6d4", alpha);
}

/** Get rgba for card background */
export function getCardBgRgba(alpha: number = 0.45): string {
  return `rgba(15, 23, 42, ${alpha})`;
}

/** Get accent shadow style for inline use */
export function getAccentShadowStyle(colorKey: PaletteColorKey | string, intensity: number = 0.15): string {
  const rgb = ACCENT_HEX_MAP[colorKey] || "#06b6d4";
  const rgba = hexToRgba(rgb, intensity);
  return `0 4px 24px -4px ${rgba}, 0 0 0 1px ${hexToRgba(rgb, intensity * 1.3)}`;
}

/** Get hover accent shadow for interactive elements */
export function getHoverAccentShadow(colorKey: PaletteColorKey | string): string {
  return getAccentShadowStyle(colorKey, 0.2);
}

/** Get glow shadow style (used by SentimentBadge etc.) */
export function getGlowShadowStyle(colorKey: PaletteColorKey | string, intensity: number = 0.12): string {
  return getAccentShadowStyle(colorKey, intensity);
}

/** Get a color hex with alpha as a hex string */
export function getColorWithAlpha(hex: string, alpha: number): string {
  const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${alphaHex}`;
}

/** Format a number for display */
export function formatNumber(value: number, decimals: number = 2): string {
  if (isNaN(value)) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Format a value for display (numbers or strings) */
export function formatValue(value: unknown, decimals: number = 2): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return formatNumber(value, decimals);
  return String(value);
}

/** Simple logger (alias for appLogger) */
export const Log = appLogger;