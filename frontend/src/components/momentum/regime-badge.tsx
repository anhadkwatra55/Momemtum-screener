import { cn, getRegimeClasses } from "@/lib/utils";
import { SPRING_TRANSITION_PROPS, SHADOW_SOFT_VAR, SHADOW_CARD_VAR, SHADOW_GLOW_CYAN_VAR } from "@/lib/constants";
import type { Regime } from "@/types/momentum";
import { motion } from "framer-motion";
import React, { useMemo } from "react";

interface RegimeBadgeProps {
  regime: Regime;
  className?: string;
  onClick?: () => void; // Added for interactivity, making the badge a clickable element
}

export const RegimeBadge = React.memo(function RegimeBadge({ regime, className, onClick }: RegimeBadgeProps) {
  // Leverage the centralized utility function for consistent styling based on the regime
  const style = getRegimeClasses(regime);

  // Define Framer Motion variants using useMemo for optimal performance.
  // This prevents object re-creation on every render, enhancing efficiency.
  const initialVariants = useMemo(() => ({
    opacity: 0,
    y: 5,
    boxShadow: SHADOW_SOFT_VAR, // A subtle, soft shadow at the start
  }), []);

  const animateVariants = useMemo(() => ({
    opacity: 1,
    y: 0,
    boxShadow: SHADOW_SOFT_VAR, // Maintain a soft shadow in the animated-in state
  }), []);

  // Combined interactive variants for hover and focus states, ensuring a unified visual response.
  const interactiveVariants = useMemo(() => ({
    y: -2, // A slight vertical lift to indicate interactivity
    // Apply a more pronounced card shadow for depth, combined with a subtle accent glow
    boxShadow: `${SHADOW_CARD_VAR}, ${SHADOW_GLOW_CYAN_VAR}`,
  }), []);

  return (
    <motion.span
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl font-semibold glass-subtle whitespace-nowrap cursor-default",
        // Mobile-first sizing: Ensure a minimum 44x44px touch target for accessibility.
        // `text-base` (approx. 16px height) + `py-3.5` (14px top + 14px bottom) = 44px total height.
        "text-base px-3 py-3.5 sm:px-4 sm:py-3.5",
        // Apply tight letter-spacing for uppercase/label-like text, consistent with typography standards
        "tracking-[0.1em]",
        // Dynamically apply background and text colors based on the regime
        style.bg,
        style.text,
        // Add a subtle transition for properties not handled by Framer Motion, like background/text color changes
        "transition-colors duration-200 ease-out",
        onClick && "cursor-pointer",
        className,
      )}
      initial={initialVariants}
      animate={animateVariants}
      whileHover={interactiveVariants} // Apply interactive styling on mouse hover
      whileFocus={interactiveVariants} // Mirror hover effect for keyboard focus, crucial for accessibility
      transition={SPRING_TRANSITION_PROPS} // Use global spring physics for consistent, snappy animations
      onClick={onClick} // Pass the click handler to enable interaction
    >
      {regime}
    </motion.span>
  );
});