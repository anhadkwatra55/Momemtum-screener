import * as React from "react"
import { motion, LayoutGroup } from "framer-motion"

import { cn } from "@/lib/utils"

/**
 * Card — Carbon Terminal Panel Surface
 * Opaque #111111 with 1px #2A2A2A border, 4px radius, no blur/shadow
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
        // Carbon Terminal surface
        "bg-[#111111] border border-[#2A2A2A] rounded-[4px]",
        className
      )

      const interactiveMotionProps = React.useMemo(() => {
        if (isInteractive) {
          return {
            tabIndex: 0,
            whileHover: {
              borderColor: '#00FF66',
            },
            whileFocus: {
              borderColor: '#00FF66',
            },
            transition: { duration: 0.05, ease: "easeOut" as const },
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
        "px-3 pt-3 sm:px-4 sm:pt-4",
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
        "text-sm leading-snug font-bold tracking-[-0.02em] text-[#E8E8E8] group-data-[size=sm]/card:text-xs",
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
      className={cn("text-xs text-[#6B6B6B]", className)}
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
        "px-3 sm:px-4",
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
        "bg-[#0A0A0A]",
        "flex items-center",
        "rounded-b-[4px]",
        "border-t border-[#2A2A2A]",
        "px-3 pb-3 sm:px-4 sm:pb-4",
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