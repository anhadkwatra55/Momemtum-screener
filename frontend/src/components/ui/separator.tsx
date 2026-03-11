"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn, getBackgroundColorClass } from "@/lib/utils"
import { SEPARATOR_MOTION_PROPS } from "@/lib/constants"

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The orientation of the separator.
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical";
}

const Separator = React.memo(
  ({
    className,
    orientation = "horizontal",
    ...props
  }: SeparatorProps) => {

    // Achieve separation with a very subtle background tint, avoiding explicit borders.
    // Using a very dark slate with low opacity creates a tonal surface difference
    // that aligns with Apple's minimal design and the "IQ 300" standard.
    const subtleSeparatorTint = getBackgroundColorClass('slate', '900', '15').replace('bg-', '');

    return (
      <motion.div
        role="separator"
        aria-orientation={orientation}
        className={cn(
          "shrink-0",
          orientation === "horizontal"
            ? `h-px w-full bg-gradient-to-r from-transparent via-${subtleSeparatorTint} to-transparent`
            : `w-px h-full bg-gradient-to-b from-transparent via-${subtleSeparatorTint} to-transparent`,
          "rounded-full", // Ensures subtle rounded caps for the separator, aligning with global corner radius
          className
        )}
        {...SEPARATOR_MOTION_PROPS}
        {...props}
      />
    );
  }
);

Separator.displayName = "Separator";

export { Separator };