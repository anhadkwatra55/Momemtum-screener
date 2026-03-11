"use client";

import {
  forwardRef,
  type ReactNode,
  useMemo,
  memo,
  useCallback,
  type KeyboardEvent,
} from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn, type PaletteColorKey, getAccentRgba } from "@/lib/utils";

// ── Design Tokens (local) ───────────────────────────────────────────────────
const BORDER_RADIUS = "1.8rem";
const SPRING = { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 };
const ELEVATED_SHADOW =
  "0 8px 40px -6px rgba(0,0,0,0.6), 0 4px 16px -4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)";

// ── Portable Data Interface (RN-ready) ──────────────────────────────────────

/** Business-level card data — no rendering concerns. Portable to React Native. */
export interface BentoCardData {
  /** Named accent glow color from the design palette */
  glowColor?: PaletteColorKey;
  /** Enable hover lift + press scale + keyboard interactivity */
  interactive?: boolean;
  /** Apply responsive inner padding (p-5 sm:p-6) */
  padded?: boolean;
  /** CSS Grid column span (e.g. 2 → grid-column: span 2) */
  span?: number;
  /** CSS Grid row span */
  rowSpan?: number;
}

// ── Presentation Props ──────────────────────────────────────────────────────

interface BentoCardProps
  extends Omit<HTMLMotionProps<"div">, "children">,
    BentoCardData {
  children: ReactNode;
}

// ── Component ───────────────────────────────────────────────────────────────

const BentoCardInner = forwardRef<HTMLDivElement, BentoCardProps>(
  function BentoCard(
    {
      children,
      glowColor,
      interactive = false,
      padded = true,
      span,
      rowSpan,
      onClick,
      className,
      style,
      ...rest
    },
    ref,
  ) {
    // Grid placement + border-radius via inline style (avoids Tailwind JIT issues)
    const mergedStyle = useMemo(() => {
      const s: Record<string, string | number | undefined> = {
        ...style as Record<string, string | number | undefined>,
        borderRadius: BORDER_RADIUS,
      };
      if (span) s.gridColumn = `span ${span}`;
      if (rowSpan) s.gridRow = `span ${rowSpan}`;
      return s;
    }, [style, span, rowSpan]);

    // Dynamic glow shadow (base elevated + accent ring)
    const glowShadow = useMemo(() => {
      if (!glowColor) return ELEVATED_SHADOW;
      const ring = getAccentRgba(glowColor, 0.2);
      const soft = getAccentRgba(glowColor, 0.12);
      return `${ELEVATED_SHADOW}, 0 0 0 1px ${ring}, 0 4px 24px -4px ${soft}`;
    }, [glowColor]);

    // Hover / tap / focus motion props (only for interactive cards)
    const hoverProps = useMemo(
      () =>
        interactive
          ? { y: -2, scale: 1.005, boxShadow: glowShadow }
          : undefined,
      [interactive, glowShadow],
    );

    const tapProps = useMemo(
      () => (interactive ? { scale: 0.98 } : undefined),
      [interactive],
    );

    // Inner radial glow shimmer background
    const innerGlow = useMemo(() => {
      if (!glowColor || !interactive) return undefined;
      const rgba = getAccentRgba(glowColor, 0.06);
      return `radial-gradient(ellipse 60% 40% at 50% 0%, ${rgba}, transparent)`;
    }, [glowColor, interactive]);

    // Keyboard handler for a11y
    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (interactive && onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          (onClick as () => void)();
        }
      },
      [interactive, onClick],
    );

    return (
      <motion.div
        ref={ref}
        className={cn(
          // Surface
          "relative overflow-hidden",
          "bg-white/[0.03] backdrop-blur-xl",
          "border border-white/[0.06]",
          // Shadows
          "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5),0_2px_8px_-2px_rgba(0,0,0,0.3)]",
          // Group for children hover states
          "group",
          // Interactive affordances
          interactive &&
            "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50",
          // Padding
          padded && "p-5 sm:p-6",
          className,
        )}
        style={mergedStyle}
        whileHover={hoverProps}
        whileTap={tapProps}
        whileFocus={interactive ? hoverProps : undefined}
        transition={SPRING}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={interactive ? onClick : undefined}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {/* Radial glow overlay */}
        {innerGlow && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: innerGlow, borderRadius: BORDER_RADIUS }}
          />
        )}
        {/* Content layer (always above glow) */}
        <div className="relative z-[1]">{children}</div>
      </motion.div>
    );
  },
);

/** Universally reusable glassmorphic card enforcing the Apple-tier MOMENTUM aesthetic. */
export const BentoCard = memo(BentoCardInner);
