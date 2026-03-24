import * as React from "react"
import { motion, LayoutGroup } from "framer-motion"

import { cn } from "@/lib/utils"

/**
 * Card — Artifacts Panel Surface
 * Layered #1a1a1a with 1px #2d2d2d border, 8px radius, subtle shadow
 */

interface CardProps extends React.ComponentProps<typeof motion.div> {
  variant?: "default" | "interactive"
  size?: "default" | "sm"
}

const Card = React.memo(
  React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = "default", size = "default", children, ...props }, ref) => {
      const isInteractive = variant === "interactive"

      const baseClasses = cn(
        "group/card flex flex-col overflow-hidden text-sm text-card-foreground",
        "gap-3",
        "data-[size=sm]:gap-2",
        // Artifacts surface
        "bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg",
        className
      )

      const interactiveMotionProps = React.useMemo(() => {
        if (isInteractive) {
          return {
            tabIndex: 0,
            whileHover: {
              borderColor: '#e2b857',
            },
            whileFocus: {
              borderColor: '#e2b857',
            },
            transition: { duration: 0.2, ease: "easeOut" as const },
            className: cn(
              baseClasses,
              "cursor-pointer",
              "focus-visible:outline-none",
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
            layout
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
        "gap-1.5",
        "px-4 pt-4 sm:px-5 sm:pt-5",
        "group-data-[size=sm]/card:px-3 group-data-[size=sm]/card:pt-3",
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
        "text-sm leading-snug font-semibold tracking-[-0.01em] text-[#e0e0e0] group-data-[size=sm]/card:text-xs",
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
      className={cn("text-xs text-[#707070]", className)}
      {...props}
    />
  )
)
CardDescription.displayName = "CardDescription"

const CardAction = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        "min-w-[32px] min-h-[32px] flex items-center justify-center",
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
        "px-4 sm:px-5",
        "group-data-[size=sm]/card:px-3",
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
        "bg-[#141414]",
        "flex items-center",
        "rounded-b-lg",
        "border-t border-[#2d2d2d]",
        "px-4 pb-4 sm:px-5 sm:pb-5",
        "group-data-[size=sm]/card:px-3 group-data-[size=sm]/card:pb-3",
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