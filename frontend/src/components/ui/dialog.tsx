"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { AnimatePresence, motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  OVERLAY_TRANSITION,
  OVERLAY_VARIANTS,
  SPRING_TRANSITION,
  DIALOG_MOBILE_VARIANTS,
  DIALOG_DESKTOP_VARIANTS,
  DIALOG_CLOSE_BUTTON_HOVER,
  DIALOG_CLOSE_BUTTON_TAP,
  DIALOG_CLOSE_BUTTON_TRANSITION,
  Z_INDICES, // Imported Z-index constants
  DIALOG_CLOSE_BUTTON_FOCUS_SHADOW, // Imported focus shadow constant
  DIALOG_CLOSE_BUTTON_FOCUS_Y, // Imported focus translateY constant
  DIALOG_CLOSE_BUTTON_FOCUS_BG, // Imported focus background constant
} from "@/lib/constants"

// --- Framer Motion Wrapped Primitives ---

const MotionDialogOverlay = motion.create(DialogPrimitive.Backdrop) as any;
const MotionDialogPopup = motion.create(DialogPrimitive.Popup) as any;

// --- Component Definitions ---

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ children, ...props }: DialogPrimitive.Portal.Props) {
  return (
    <DialogPrimitive.Portal data-slot="dialog-portal" {...props}>
      <AnimatePresence>
        {children}
      </AnimatePresence>
    </DialogPrimitive.Portal>
  )
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <MotionDialogOverlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate",
        `z-[${Z_INDICES.dialogOverlay}]`, // Use Z_INDICES for overlay
        "bg-background/50 glass-heavy",
        className
      )}
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={OVERLAY_VARIANTS}
      transition={OVERLAY_TRANSITION}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  const isMobile = useMediaQuery("(max-width: 639px)");

  return (
    <MotionDialogPopup
      data-slot="dialog-content"
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={isMobile ? DIALOG_MOBILE_VARIANTS : DIALOG_DESKTOP_VARIANTS}
      transition={SPRING_TRANSITION}
      className={cn(
        "fixed grid w-full gap-4 outline-none overflow-hidden",
        `z-[${Z_INDICES.dialogContent}]`, // Use Z_INDICES for content
        "bg-[var(--card)] glass-heavy shadow-[var(--shadow-elevated)]",
        "p-6 sm:p-8",
        isMobile
          ? "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-3xl rounded-b-none"
          : "top-1/2 left-1/2 max-w-lg rounded-3xl",
        className
      )}
      {...props}
    >
      {isMobile && (
        <div
          className={cn(
            "absolute top-3 left-1/2 -translate-x-1/2",
            "w-16 h-3", // Increased size for better visual and touch affordance
            "bg-foreground/20 rounded-full shadow-sm",
            "cursor-grab"
          )}
        />
      )}
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <motion.button
            data-slot="dialog-close"
            className={cn(
              "absolute",
              `z-[${Z_INDICES.dialogCloseButton}]`, // Use Z_INDICES for close button
              "top-4 right-4",
              "p-2 rounded-full",
              "min-w-[44px] min-h-[44px] flex items-center justify-center",
              "text-foreground/80 bg-slate-900/60 backdrop-blur-md",
              // Refactored focus-visible state to use shadow/translateY from constants, removing ring.
              `focus-visible:outline-none focus-visible:shadow-[${DIALOG_CLOSE_BUTTON_FOCUS_SHADOW}] focus-visible:translate-y-[${DIALOG_CLOSE_BUTTON_FOCUS_Y}px] ${DIALOG_CLOSE_BUTTON_FOCUS_BG}`,
              "transition-all duration-150 ease-out" // Added transition for smoother focus state change
            )}
            aria-label="Close dialog"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_TRANSITION, delay: 0.15 }}
            whileHover={{ ...DIALOG_CLOSE_BUTTON_HOVER, transition: DIALOG_CLOSE_BUTTON_TRANSITION }}
            whileTap={{ ...DIALOG_CLOSE_BUTTON_TAP, transition: DIALOG_CLOSE_BUTTON_TRANSITION }}
          >
            <XIcon size={20} strokeWidth={1.5} />
            <span className="sr-only">Close</span>
          </motion.button>
        </DialogPrimitive.Close>
      )}
    </MotionDialogPopup>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 pb-4", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-3 pt-6",
        "sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-2xl font-semibold tracking-[-0.03em] text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground mt-2",
        // Removed opinionated link styling for greater flexibility.
        // Consumers should apply specific link styles as needed.
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}