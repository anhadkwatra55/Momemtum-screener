"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"
// Assuming these Z-index constants are now defined in lib/constants.ts as per previous fixes
import { SPRING_PHYSICS_DEFAULT, OVERLAY_TRANSITION_DEFAULT, Z_INDEX_OVERLAY, Z_INDEX_SHEET_CONTENT } from "@/lib/constants"

// Define motion versions of the primitive components for animation
const MotionSheetPrimitiveBackdrop = motion(SheetPrimitive.Backdrop);
const MotionSheetPrimitivePopup = motion(SheetPrimitive.Popup);

// Sheet Root
function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

// Sheet Trigger
function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

// Sheet Close
function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

// Sheet Portal
function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

// Sheet Overlay
function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <AnimatePresence>
      <MotionSheetPrimitiveBackdrop
        key="sheet-overlay-motion"
        data-slot="sheet-overlay"
        className={cn(
          `fixed inset-0 z-[${Z_INDEX_OVERLAY}] bg-black/40 supports-backdrop-filter:backdrop-blur-sm`,
          className
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={OVERLAY_TRANSITION_DEFAULT}
        {...props}
      />
    </AnimatePresence>
  )
}

// Sheet Content
function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  const popupVariants = React.useMemo(() => {
    const closedState = { opacity: 0 };
    const commonOpenTransition = SPRING_PHYSICS_DEFAULT;

    return {
      top: {
        closed: { y: "-100%", ...closedState },
        open: { y: "0%", opacity: 1, transition: commonOpenTransition },
      },
      bottom: {
        closed: { y: "100%", ...closedState },
        open: { y: "0%", opacity: 1, transition: commonOpenTransition },
        handle: {
          closed: { opacity: 0, y: 10 }, // Animate handle slightly down on close
          open: { opacity: 1, y: 0, transition: OVERLAY_TRANSITION_DEFAULT },
        },
      },
      left: {
        closed: { x: "-100%", ...closedState },
        open: { x: "0%", opacity: 1, transition: commonOpenTransition },
      },
      right: {
        closed: { x: "100%", ...closedState },
        open: { x: "0%", opacity: 1, transition: commonOpenTransition },
      },
      // Common variants for the close button
      closeButton: {
        closed: { opacity: 0, scale: 0.9, transition: { ...OVERLAY_TRANSITION_DEFAULT, duration: 0.15 } },
        open: { opacity: 1, scale: 1, transition: OVERLAY_TRANSITION_DEFAULT },
      },
    };
  }, []);

  const handleClose = React.useCallback(() => {
    // This function will be passed to SheetPrimitive.Close, but when used with the handle it needs to be explicitly invoked
    // SheetPrimitive.Close can be called directly or implicitly via render prop
    const closeFn = (props as any).onClose || (() => {}); // Get close function from props or provide a no-op
    closeFn();
  }, [props]);

  return (
    <SheetPortal>
      <AnimatePresence>
        <MotionSheetPrimitivePopup
          key="sheet-content-motion"
          data-slot="sheet-content"
          data-side={side}
          className={cn(
            `fixed z-[${Z_INDEX_SHEET_CONTENT}] flex flex-col gap-4 text-sm`,
            "bg-card supports-backdrop-filter:backdrop-blur-xl", // Premium glassmorphism effect
            "rounded-2xl shadow-[var(--shadow-elevated)]", // Generous default rounded corners, elevation with custom shadow
            // Responsive width/height for different sides, prioritizing mobile-first full width
            "data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:max-h-[90dvh]", // Bottom sheet with max height
            "data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-full data-[side=left]:sm:max-w-sm", // Full width on mobile, max-w-sm on larger screens
            "data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-full data-[side=right]:sm:max-w-sm", // Full width on mobile, max-w-sm on larger screens
            "data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto",
            // Specific rounded corners to apply based on side, overriding global `rounded-2xl` where appropriate
            "data-[side=bottom]:rounded-t-2xl data-[side=bottom]:rounded-b-none data-[side=bottom]:pt-11", // Added top padding for handle
            "data-[side=top]:rounded-b-2xl data-[side=top]:rounded-t-none",
            "data-[side=left]:rounded-r-2xl data-[side=left]:rounded-l-none",
            "data-[side=right]:rounded-l-2xl data-[side=right]:rounded-r-none",
            className
          )}
          initial="closed"
          animate="open"
          exit="closed"
          variants={popupVariants[side]}
          {...props}
        >
          {/* Subtle and accessible drag handle for bottom sheets, positioned absolutely at the top */}
          {side === "bottom" && (
            <motion.button
              key="bottom-sheet-drag-handle"
              className={cn(
                "absolute top-0 left-0 right-0 z-10 flex h-11 justify-center py-2 cursor-grab active:cursor-grabbing", // Ensure min-height:44px, use py-2 to center visual element
                "focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-b-xl focus-visible:outline-none" // Accessibility, rounded bottom, remove default outline
              )}
              aria-label="Dismiss sheet"
              variants={popupVariants[side].handle}
              initial="closed"
              animate="open"
              exit="closed"
              onClick={handleClose} // Use useCallback for close action
              onKeyDown={React.useCallback((e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClose();
                }
              }, [handleClose])}
            >
              <div className="h-1.5 w-16 rounded-full bg-white/10" /> {/* Visual handle */}
            </motion.button>
          )}
          {children}
          {showCloseButton && (
            <motion.div
              key="sheet-close-button-wrapper"
              variants={popupVariants.closeButton}
              initial="closed"
              animate="open"
              exit="closed"
            >
              <SheetPrimitive.Close
                data-slot="sheet-close"
                render={
                  <Button
                    variant="ghost"
                    className={cn(
                      "absolute z-20 h-11 w-11 p-0 rounded-full text-foreground/70", // 44x44px touch target, subtle initial color
                      "hover:text-foreground hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-500", // Interactive states
                      // Position close button based on side, adjusting for larger screens
                      side === "bottom" ? "top-4 right-4 sm:top-6 sm:right-6" : "top-4 right-4"
                    )}
                    aria-label="Close"
                  >
                    <XIcon className="h-5 w-5" />
                  </Button>
                }
              >
                <span className="sr-only">Close</span>
              </SheetPrimitive.Close>
            </motion.div>
          )}
        </MotionSheetPrimitivePopup>
      </AnimatePresence>
    </SheetPortal>
  )
}

// Sheet Header
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col space-y-2 p-6", className)} // Generous padding, flexible spacing for title/description
      {...props}
    />
  )
}

// Sheet Footer
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex flex-col gap-2 p-6", // Auto margin to push to bottom, consistent padding
        "bg-background/80", // Tonal surface for elevation, replacing border-t
        className
      )}
      {...props}
    />
  )
}

// Sheet Title
function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "text-2xl font-bold text-foreground tracking-tight font-inter", // Bold, large typography for hierarchy, tight tracking
        className
      )}
      {...props}
    />
  )
}

// Sheet Description
function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground leading-relaxed font-inter", className)} // Clear, readable supporting text
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}