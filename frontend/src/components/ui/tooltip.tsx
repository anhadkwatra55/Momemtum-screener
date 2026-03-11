"use client"

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { AnimatePresence, motion } from "framer-motion"
import React from "react"

import { SPRING_TRANSITION, TOOLTIP_MOTION_VARIANTS, Z_INDEX_TOOLTIP } from "@/lib/constants"
import { cn } from "@/lib/utils"

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ render, asChild: _asChild, ...props }: TooltipPrimitive.Trigger.Props & { asChild?: boolean }) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" render={render ?? <span />} {...props} />
}

const TooltipContent = React.memo(
  ({
    className,
    side = "top",
    sideOffset = 4,
    align = "center",
    alignOffset = 0,
    children,
    ...props
  }: TooltipPrimitive.Popup.Props) => {
    const MotionPopup = motion(TooltipPrimitive.Popup)

    return (
      <TooltipPrimitive.Portal>
        <AnimatePresence>
          <TooltipPrimitive.Positioner
            align={align}
            alignOffset={alignOffset}
            side={side}
            sideOffset={sideOffset}
            // Use semantic Z_INDEX_TOOLTIP constant
            className={cn("isolate", Z_INDEX_TOOLTIP)}
          >
            <MotionPopup
              data-slot="tooltip-content"
              className={cn(
                // Removed redundant z-50 as Positioner handles stacking context
                // Enhanced typography with explicit font-inter, maintaining text-xs for conciseness
                "inline-flex w-fit max-w-xs items-center gap-1.5 px-3 py-1.5 text-xs font-inter has-data-[slot=kbd]:pr-1.5",
                "rounded-2xl bg-card text-foreground glass-subtle shadow-[var(--shadow-soft)]",
                "origin-[var(--transform-origin)]",
                className
              )}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={TOOLTIP_MOTION_VARIANTS}
              transition={SPRING_TRANSITION}
              {...props}
            >
              {children}
              <TooltipPrimitive.Arrow
                className={cn(
                  // Removed redundant z-50; arrow is within the popup's stacking context
                  // Harmonized border-radius to rounded-2xl for visual consistency
                  "size-2.5 rotate-45 rounded-2xl",
                  "bg-card",
                  "data-[side=bottom]:top-1 data-[side=top]:-bottom-2.5",
                  "data-[side=left]:top-1/2 data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2",
                  "data-[side=right]:top-1/2 data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2",
                  "data-[side=inline-end]:top-1/2 data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2",
                  "data-[side=inline-start]:top-1/2 data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2"
                )}
              />
            </MotionPopup>
          </TooltipPrimitive.Positioner>
        </AnimatePresence>
      </TooltipPrimitive.Portal>
    )
  }
)

TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }