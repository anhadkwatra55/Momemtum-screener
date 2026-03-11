"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, AnimatePresence } from "framer-motion"
import React, { useMemo } from "react"

import { cn } from "@/lib/utils"
import { SPRING_PHYSICS_DEFAULT, INTERACTIVE_ELEMENT_HOVER_SHADOW_GLOW } from "@/lib/constants"

// --- Tabs Root ---
function Tabs({
  className,
  orientation = "horizontal",
  value,
  onValueChange,
  ...props
}: TabsPrimitive.Root.Props & { value?: string; onValueChange?: (value: string) => void }) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      value={value}
      onValueChange={onValueChange}
      {...props}
    />
  )
}

// --- TabsList Variants ---
const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-2xl p-2 text-foreground/60 group-data-horizontal/tabs:h-fit group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-card glass-subtle", // Translucent card background with backdrop-blur
        line: "gap-1 bg-transparent", // TradingView-like underline variant
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// --- TabsList Component ---
interface TabsListProps extends TabsPrimitive.List.Props, VariantProps<typeof tabsListVariants> {}

const TabsList = React.memo(
  ({
    className,
    variant = "default",
    ...props
  }: TabsListProps) => {
    return (
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      />
    )
  }
)
TabsList.displayName = "TabsList"

// --- TabsTrigger Component ---
interface TabsTriggerProps extends TabsPrimitive.Tab.Props {}

const TabsTrigger = React.memo(
  ({ className, children, value, ...props }: TabsTriggerProps) => {
    // Destructure data attributes for better readability and explicit access
    const { 
      "data-active": isActive = false, 
      "data-variant": variant = "default", 
      "data-orientation": orientation = "horizontal", 
      ...restProps 
    } = props;

    // Use centralized spring physics from constants
    const springTransition = SPRING_PHYSICS_DEFAULT;

    // Use centralized shadow/glow value from constants for consistent hover effects
    const hoverMotionProps = useMemo(() => ({
      y: -2,
      boxShadow: INTERACTIVE_ELEMENT_HOVER_SHADOW_GLOW, // Elevated shadow with subtle glow
    }), []);

    const tapMotionProps = useMemo(() => ({
      scale: 0.98,
    }), []);

    return (
      <motion.div // Outer motion div for hover/tap animations and shadow
        whileHover={hoverMotionProps}
        whileTap={tapMotionProps}
        transition={springTransition}
        className="relative z-[2]" // Ensure hover shadow is above other elements
      >
        <TabsPrimitive.Tab
          data-slot="tabs-trigger"
          value={value}
          className={cn(
            "relative inline-flex flex-1 items-center justify-center gap-1.5 min-h-[44px] rounded-2xl px-4 py-2 text-base font-medium whitespace-nowrap cursor-pointer",
            "group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start",
            // Refined focus-visible using primary accent color for consistency
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
            className
          )}
          {...restProps} // Pass the rest of the props
        >
          {/* Active Background for 'default' variant */}
          {variant !== "line" && isActive && (
            <motion.span
              className="absolute inset-0 z-0 bg-background rounded-2xl shadow-[var(--shadow-card)]" // Active background, rounded, with elevation
              layoutId="active-tab-indicator" // Ensures smooth animation between tabs
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={springTransition}
            />
          )}

          {/* Active Line Indicator for 'line' variant */}
          {variant === "line" && isActive && (
            <motion.span
              className={cn(
                "absolute bg-cyan-500 rounded-full", // Use primary accent color
                orientation === "horizontal" // Check orientation explicitly
                  ? "bottom-[-6px] left-0 right-0 h-0.5"
                  : "right-[-6px] top-0 bottom-0 w-0.5"
              )}
              layoutId="active-line-indicator" // Ensures smooth animation between tabs
              initial={{ opacity: 0, scale: 0.8 }} // Subtle scale-in for line
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={springTransition}
            />
          )}

          {/* Tab Content (text/icon) with refined typography */}
          <span className={cn(
            "relative z-10 font-inter text-sm uppercase", // Apply Inter, small size, uppercase for label hierarchy
            "tracking-[0.1em]", // Consistent tight tracking for uppercase labels
            isActive ? "text-cyan-500" : "text-foreground/60" // Active text color uses primary accent, inactive muted
          )}>
            {children}
          </span>
        </TabsPrimitive.Tab>
      </motion.div>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";


// --- TabsContent Component ---
interface TabsContentProps extends TabsPrimitive.Panel.Props {
  value: string; // Ensure value is present for keying AnimatePresence
}

const TabsContent = React.memo(
  ({ className, value, children, ...props }: TabsContentProps) => {
    return (
      <AnimatePresence mode="wait"> {/* Wait for exit animation to complete */}
        <motion.div
          key={value} // Crucial for AnimatePresence to detect content changes
          initial={{ opacity: 0, y: 20 }} // Matches page transition standard: y 20->0
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }} // Consistent offset for outgoing tab
          transition={{ duration: 0.3 }} // 300ms transition for content fade
          className={cn("flex-1 outline-none", className)} // flex-1 allows content to dictate its own sizing/typography
        >
          <TabsPrimitive.Panel
            data-slot="tabs-content"
            value={value}
            className="h-full w-full" // Ensure panel takes full space for content
            {...props}
          >
            {children}
          </TabsPrimitive.Panel>
        </motion.div>
      </AnimatePresence>
    )
  }
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }