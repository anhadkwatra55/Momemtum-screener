"use client";

import { forwardRef, type ReactNode, useMemo, memo, useCallback } from "react";
import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";
import { cn, PaletteColorKey, getAccentRgba, getAccentShadowStyle } from "@/lib/utils";
import { SPRING_TRANSITION, ELEVATED_SHADOW_DEFAULT, Z_INDEX_GLOW, Z_INDEX_CONTENT, CARD_BORDER_RADIUS } from "@/lib/constants";

/* ── Logic-only types (portable) ── */
export interface AppleCardData {
  glowColor?: PaletteColorKey; // Named accent color key for glow, using centralized type
  interactive?: boolean; // Enables hover lift + press scale animations
  padded?: boolean; // Adds responsive padding (p-4 sm:p-6)
  span?: number; // Bento grid column span (e.g., 2 for grid-column: span 2)
  rowSpan?: number; // Bento grid row span (e.g., 2 for grid-row: span 2)
  onClick?: () => void; // Added for comprehensive interactivity
}

/* ── Presentation Props ── */
interface AppleCardProps
  extends Omit<HTMLMotionProps<"div">, "children">,
    AppleCardData {
  children: ReactNode;
}

// Internal component for memoization and Framer Motion integration.
const AppleCardComponent = forwardRef<HTMLDivElement, AppleCardProps>(
  function AppleCard(
    { children, glowColor, interactive = true, padded = true, span, rowSpan, onClick, className = "", style, ...rest },
    ref,
  ) {
    // Memoize inline grid styling to prevent unnecessary re-renders.
    const inlineGridStyle = useMemo(() => {
      const gridStyle: React.CSSProperties = { ...style };
      if (span) {
        gridStyle.gridColumn = `span ${span}`;
      }
      if (rowSpan) {
        gridStyle.gridRow = `span ${rowSpan}`;
      }
      return gridStyle;
    }, [style, span, rowSpan]);

    // Dynamically generate the box shadow, combining base elevated shadow with an accent glow.
    const combinedBoxShadow = useMemo(() => {
      return glowColor
        ? getAccentShadowStyle(glowColor, ELEVATED_SHADOW_DEFAULT)
        : ELEVATED_SHADOW_DEFAULT;
    }, [glowColor]);

    // Memoize Framer Motion's `whileHover` properties for performance and consistency.
    const whileHoverProps = useMemo(() => {
      if (!interactive) return undefined;

      return {
        y: -2,        // Subtle lift on hover.
        scale: 1.005, // Slight scale increase for a premium feel.
        boxShadow: combinedBoxShadow, // Apply dynamic shadow/glow from centralized utility.
      };
    }, [interactive, combinedBoxShadow]);

    // Memoize Framer Motion's `whileTap` properties.
    const whileTapProps = useMemo(() => {
      return interactive ? { scale: 0.98 } : undefined; // Subtle press down effect on tap.
    }, [interactive]);

    // Memoize Framer Motion's `whileFocus` properties, mirroring hover for comprehensive keyboard accessibility.
    const whileFocusProps = useMemo(() => {
      if (!interactive) return undefined;
      return {
        y: -2,
        scale: 1.005,
        boxShadow: combinedBoxShadow,
      };
    }, [interactive, combinedBoxShadow]);

    // Memoize Framer Motion's transition properties for the main card.
    // Uses centralized spring physics for snappy and natural motion, defined in constants.
    const cardTransition = useMemo(() => SPRING_TRANSITION, []);

    // Memoized background style for the inner radial glow shimmer.
    // Uses the `getAccentRgba` utility for consistent color handling.
    const innerGlowBackground = useMemo(() => {
      if (!glowColor) return undefined;
      // Use 8% opacity for the subtle inner radial glow, consistent with Apple's vibrancy.
      const rgba = getAccentRgba(glowColor, 0.08);
      return `radial-gradient(ellipse 60% 40% at 50% 0%, ${rgba}, transparent)`;
    }, [glowColor]);

    // Memoize Framer Motion's transition for the inner glow's opacity.
    const innerGlowTransition = useMemo(() => ({
      type: "tween",
      duration: 0.2,
      ease: "easeOut",
    }), []);

    // Handle keyboard activation for interactive cards, ensuring accessibility.
    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
      if (interactive && onClick && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); // Prevent default scroll for spacebar
        onClick();
      }
    }, [interactive, onClick]);

    return (
      <motion.div
        ref={ref}
        className={cn(
          "apple-card relative overflow-hidden group backdrop-blur-md", // Added backdrop-blur-md for glass/translucency as per globals.css.
          `rounded-[${CARD_BORDER_RADIUS}]`, // Use constant for consistent border radius across design system.
          "bg-[rgba(15,23,42,0.45)]", // Explicitly set card background as per globals.css palette for consistency.
          interactive && "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50", // Add clear, subtle focus styles.
          padded && "p-4 sm:p-6", // Responsive padding adhering to 'generous padding' design.
          className, // Allow custom classes to override or extend.
        )}
        style={inlineGridStyle}
        whileHover={whileHoverProps}
        whileTap={whileTapProps}
        whileFocus={whileFocusProps} // Add whileFocus state for keyboard users, mirroring hover.
        transition={cardTransition}
        role={interactive ? "button" : undefined} // Add semantic role for accessibility.
        tabIndex={interactive ? 0 : undefined} // Enable keyboard navigation for interactive cards.
        onClick={interactive ? onClick : undefined} // Pass onClick prop to the root div.
        onKeyDown={handleKeyDown} // Handle keyboard events for activation (Enter/Space).
        {...rest}
      >
        {/* AnimatePresence manages the mount and unmount animations of the inner glow. */}
        <AnimatePresence mode="sync">
          {interactive && glowColor && innerGlowBackground && (
            <motion.div
              key={glowColor} // Key ensures AnimatePresence tracks changes to glowColor for smooth transitions.
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={innerGlowTransition} // Smooth tween transition for the glow fade.
              className={cn(
                `pointer-events-none absolute inset-0 rounded-[${CARD_BORDER_RADIUS}]`, // Matches card rounding.
                `z-[${Z_INDEX_GLOW}]`, // Uses semantic z-index constant for layering.
              )}
              style={{ background: innerGlowBackground }}
            />
          )}
        </AnimatePresence>
        {/* Wrapper for children content, ensuring it's always above the inner glow layer. */}
        <div className={cn("relative", `z-[${Z_INDEX_CONTENT}]`)}>
          {children}
        </div>
      </motion.div>
    );
  },
);

// Export the component wrapped with React.memo for optimal rendering performance.
export const AppleCard = memo(AppleCardComponent);