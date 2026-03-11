import * as React from "react"
import { motion, LayoutGroup } from "framer-motion"

import { cn } from "@/lib/utils"
import { SPRING_PHYSICS_DEFAULT, INTERACTIVE_CARD_SHADOW_GLOW } from "@/lib/constants"

// --- Design Token Constants (internalized from 'apple-card' class and design philosophy) ---
const CARD_BORDER_RADIUS_REM = "1.25rem"; // Consistent rounded corners everywhere (border-radius: 1rem+)
const CARD_BACKGROUND_COLOR_CLASS = "bg-[rgba(15,23,42,0.45)]"; // From globals.css: Card: rgba(15,23,42,0.45)
const CARD_BACKDROP_BLUR_CLASS = "backdrop-blur-2xl"; // Glass/translucency with backdrop-blur (vibrancy), Apple often uses significant blur
const CARD_DEFAULT_ELEVATION_CLASS = "shadow-md shadow-black/20"; // Subtle elevation for default cards, aligning with Material 3

interface CardProps extends React.ComponentProps<typeof motion.div> {
  variant?: "default" | "interactive"
  size?: "default" | "sm"
}

const Card = React.memo(
  React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = "default", size = "default", children, ...props }, ref) => {
      const isInteractive = variant === "interactive"

      // Core visual properties of the card, internalized from the 'apple-card' concept
      const coreCardStyles = cn(
        CARD_BACKGROUND_COLOR_CLASS,
        CARD_BACKDROP_BLUR_CLASS,
        `rounded-[${CARD_BORDER_RADIUS_REM}]`, // Apply consistent border-radius
        CARD_DEFAULT_ELEVATION_CLASS, // Default shadow for depth
        "border border-white/5", // Very subtle 1px border for definition without being intrusive (minimal borders)
      );

      // Base classes for the card, now including internalized styles instead of relying on an external 'apple-card' class
      const baseClasses = cn(
        "group/card flex flex-col overflow-hidden text-sm text-card-foreground",
        "gap-4", // Default spacing between card elements
        "data-[size=sm]:gap-3", // Reduced spacing for smaller cards
        coreCardStyles, // Apply the internalized core styles
        className
      )

      const interactiveMotionProps = React.useMemo(() => {
        if (isInteractive) {
          return {
            tabIndex: 0,
            whileHover: {
              y: -2, // Subtle lift on hover
              boxShadow: INTERACTIVE_CARD_SHADOW_GLOW, // Elevated shadow with a cyan glow
              borderColor: 'rgba(6, 182, 212, 0.4)' // Subtle border glow on hover, leveraging the primary accent color
            },
            whileFocus: {
              y: -2, // Consistent lift on focus
              boxShadow: INTERACTIVE_CARD_SHADOW_GLOW, // Same glow for focus, adhering to Material 3 state layers without explicit rings
              borderColor: 'rgba(6, 182, 212, 0.4)' // Subtle border glow on focus
            },
            transition: SPRING_PHYSICS_DEFAULT, // Snappy spring physics for all interactions
            className: cn(
              baseClasses,
              "cursor-pointer",
              "focus-visible:outline-none", // Remove default outline, rely on our motion styles for focus feedback
            ),
          }
        }
        return {
          className: baseClasses,
        }
      }, [isInteractive, baseClasses])

      return (
        <LayoutGroup>
          <motion.div
            ref={ref}
            role="group"
            data-slot="card"
            data-size={size}
            layout // Enable Framer Motion layout animations for fluid resizing
            {...interactiveMotionProps}
            {...props}
          >
            {children}
          </motion.div>
        </LayoutGroup>
      )
    }
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start",
        "gap-2",
        // Generous responsive padding for visual breathing room, following Wealthsimple's aesthetic
        "px-5 pt-5 sm:px-6 sm:pt-6 md:px-7 md:pt-7 lg:px-8 lg:pt-8",
        // Reduced padding for 'sm' size cards
        "group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:pt-4 sm:group-data-[size=sm]/card:px-5 sm:group-data-[size=sm]/card:pt-5 md:group-data-[size=sm]/card:px-6 md:group-data-[size=sm]/card:pt-6",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
        className
      )}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLHeadingElement, React.ComponentProps<"h3">>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      data-slot="card-title"
      className={cn(
        // Hero typography with precise letter-spacing for headings (-0.03em)
        "text-lg leading-snug font-semibold tracking-[-0.03em] group-data-[size=sm]/card:text-base",
        className
      )}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
)
CardDescription.displayName = "CardDescription"

// CardAction: A dedicated slot for interactive elements within the header, typically in the top-right.
// It acts as a positioning wrapper. The actual interactive elements (buttons, links) should be children
// and handle their own accessibility attributes and events. The wrapper ensures minimum touch target area.
const CardAction = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        "min-w-[44px] min-h-[44px] flex items-center justify-center", // Ensure touch target minimums for any content placed within
        className
      )}
      {...props}
    />
  )
)
CardAction.displayName = "CardAction"

const CardContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-content"
      className={cn(
        // Responsive padding matching header for content areas
        "px-5 sm:px-6 md:px-7 lg:px-8",
        "group-data-[size=sm]/card:px-4 sm:group-data-[size=sm]/card:px-5 md:group-data-[size=sm]/card:px-6",
        className
      )}
      {...props}
    />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-footer"
      className={cn(
        "bg-card/70 glass-subtle", // Translucent background with backdrop-blur for depth
        "flex items-center",
        `rounded-b-[${CARD_BORDER_RADIUS_REM}]`, // Consistent bottom rounded corners, matching the overall card radius
        "border-t border-white/5", // Subtle top border to visually separate from content, matching card's overall border
        // Generous responsive padding for a premium feel
        "px-5 pb-5 sm:px-6 sm:pb-6 md:px-7 md:pb-7 lg:px-8 lg:pb-8",
        // Reduced padding for 'sm' size cards
        "group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:pb-4 sm:group-data-[size=sm]/card:px-5 sm:group-data-[size=sm]/card:pb-5 md:group-data-[size=sm]/card:px-6 md:group-data-[size=sm]/card:pb-6",
        className
      )}
      {...props}
    />
  )
)
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}