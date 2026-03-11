import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { motion, type MotionProps } from "framer-motion"

import { cn } from "@/lib/utils"
import { INTERACTIVE_TRANSITION } from "@/lib/constants"

const MotionInputPrimitive = motion(InputPrimitive)

const Input = React.memo(
  React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>(
    ({ className, type, ...props }, ref) => {
      const motionProps: MotionProps = React.useMemo(
        () => ({
          initial: {
            y: 0,
            boxShadow: 'var(--shadow-soft)', // Subtle initial shadow for depth
            scale: 1, // Initial scale for uniform interaction
          },
          whileHover: {
            y: -2,
            boxShadow: 'var(--shadow-glow-cyan)', // Elevated shadow with accent glow on hover
          },
          whileFocus: {
            y: -2,
            boxShadow: 'var(--shadow-glow-cyan)', // Elevated shadow with accent glow on focus, consistent with hover
          },
          whileTap: { // Distinct pressed state for tactile feedback
            y: 0.5, // Slightly press down, simulating physical depth
            boxShadow: 'var(--shadow-soft)', // Revert to initial soft shadow to imply depression
            scale: 0.995, // Subtle scaling down for a physical press sensation
          },
          transition: INTERACTIVE_TRANSITION, // Centralized spring physics for all states
        }),
        []
      )

      return (
        <MotionInputPrimitive
          ref={ref}
          type={type}
          data-slot="input"
          className={cn(
            "min-h-[44px] w-full min-w-0 rounded-[var(--radius-lg)]",
            "bg-[var(--card)] glass-subtle",
            // Removed default 'border border-[var(--border)]' to align with 'minimal borders' philosophy,
            // relying on shadows and background tints for visual separation and depth.
            "px-4 py-2.5 text-sm sm:text-base",
            type === "number" || type === "tel" ? "font-mono" : "font-sans",
            // Removed 'transition-[background-color,box-shadow] duration-200 ease-out'
            // as Framer Motion now fully orchestrates box-shadow and transform animations for consistency and performance.
            "outline-none",
            "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
            "placeholder:text-muted-foreground",
            "focus-visible:ring-0",
            // Removed 'focus-visible:border-[var(--color-mo-cyan)/50]' to maintain a consistent
            // elevation system on focus, relying purely on the elevated shadow and transform.
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
            "aria-invalid:border-[var(--rose)/40] aria-invalid:shadow-[var(--shadow-glow-rose)]", // Retained for explicit error states
            className
          )}
          {...motionProps}
          {...props}
        />
      )
    }
  )
)

Input.displayName = "Input"

export { Input }