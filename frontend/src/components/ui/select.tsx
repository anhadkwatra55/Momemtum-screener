"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { motion, AnimatePresence } from "framer-motion"

import { cn, getTextColorClass, getBackgroundColorClass, getBorderColorClass } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"
import { useCallback, useContext, createContext, useEffect } from "react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./sheet"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  SPRING_TRANSITION_PROPS,
  PAGE_TRANSITION_Y,
  Z_INDEX_POPUP,         // Semantic z-index for popovers/dropdowns
  Z_INDEX_SHEET_CONTENT, // Semantic z-index for mobile bottom sheets
  Z_INDEX_SCROLL_BUTTON, // Semantic z-index for sticky scroll indicators
} from "@/lib/constants"


// --- Select Context ---
// Provides `isMobile` status, `open`/`onOpenChange` from the root Select primitive,
// and `mobileTitle` for contextual sheet titles.
interface SelectContextType {
  isMobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mobileTitle?: string; // Added for dynamic mobile sheet title
}
const SelectContext = createContext<SelectContextType | null>(null);

const useSelectContext = () => {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error("useSelectContext must be used within a SelectProvider");
  }
  return context;
};

// --- Select (Root Component) ---
// Wraps SelectPrimitive.Root to provide context for mobile detection and state management.
interface SelectProps extends SelectPrimitive.Root.Props {
  mobileTitle?: string; // Prop to customize the mobile sheet title
}

const Select = React.memo(function Select({
  children,
  open: controlledOpen,
  onOpenChange,
  mobileTitle, // Destructure new prop
  ...props
}: SelectProps) {
  const [internalOpen, setInternalOpen] = React.useState(controlledOpen ?? false);

  React.useEffect(() => {
    if (controlledOpen !== undefined) {
      setInternalOpen(controlledOpen);
    }
  }, [controlledOpen]);

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    setInternalOpen(newOpen);
    onOpenChange?.(newOpen);
  }, [onOpenChange]);

  const isMobile = useMediaQuery("(max-width: 767px)"); // Matches Tailwind's md breakpoint for mobile detection

  return (
    <SelectContext.Provider value={{ isMobile, open: internalOpen, onOpenChange: handleOpenChange, mobileTitle }}>
      <SelectPrimitive.Root open={internalOpen} onOpenChange={handleOpenChange} {...props}>
        {children}
      </SelectPrimitive.Root>
    </SelectContext.Provider>
  );
});

// --- SelectGroup ---
const SelectGroup = React.memo(function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-3", className)} // Generous padding as per Wealthsimple/Apple
      {...props}
    />
  )
})

// --- SelectValue ---
const SelectValue = React.memo(function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn(
        "flex flex-1 text-left font-inter text-white", // Ensure text-white for visibility on dark card bg
        className
      )}
      {...props}
    />
  )
})

// --- SelectTrigger ---
const SelectTrigger = React.memo(function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <motion.div
      initial={{ y: 0, boxShadow: "var(--shadow-card)" }}
      whileHover={{ y: -2, boxShadow: "var(--shadow-elevated), var(--shadow-glow-cyan)" }}
      whileFocus={{ y: -2, boxShadow: "var(--shadow-elevated), var(--shadow-glow-cyan)" }}
      transition={SPRING_TRANSITION_PROPS} // Use centralized spring physics
      className="relative inline-block rounded-[1.25rem]"
    >
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        data-size={size}
        className={cn(
          "group flex w-full items-center justify-between gap-2 rounded-[1.25rem] bg-card px-4 py-2.5 text-base font-inter text-white select-none outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          `aria-invalid:ring-2 aria-invalid:ring-rose-500 aria-invalid:ring-offset-1 aria-invalid:ring-offset-background`, // Use a distinct rose color for invalid state
          `data-placeholder:${getTextColorClass('slate')}`, // Consistent muted text color for placeholder
          "data-[size=default]:min-h-[44px] data-[size=sm]:min-h-[38px] data-[size=sm]:px-3 data-[size=sm]:py-2 data-[size=sm]:text-sm", // Mobile touch targets and responsive sizes
          "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2",
          `[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5 ${getTextColorClass('slate')}`, // Default icon color for trigger
          className
        )}
        {...props}
      >
        {children}
        <SelectPrimitive.Icon
          render={
            <ChevronDownIcon className="size-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          }
        />
      </SelectPrimitive.Trigger>
    </motion.div>
  )
})

// --- SelectContent ---
// Conditionally renders a desktop dropdown or a mobile bottom sheet.
const SelectContent = React.memo(function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 8,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  const { isMobile, open, onOpenChange, mobileTitle } = useSelectContext();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className={cn("w-full h-auto max-h-[70vh] rounded-t-3xl bg-card glass-heavy p-0", `z-[${Z_INDEX_SHEET_CONTENT}]`)}>
          <SheetHeader className="p-4 pb-0">
            <SheetTitle className="text-xl font-inter font-bold text-white">
              {mobileTitle || "Select Option"} {/* Dynamic title or fallback */}
            </SheetTitle>
          </SheetHeader>
          <div className="relative overflow-hidden pt-2 pb-safe-offset-4"> {/* `pb-safe-offset-4` for iPhone safe area */}
            <SelectPrimitive.Popup
              data-slot="select-content-mobile-popup"
              className={cn("w-full h-full p-1", className)}
              {...props}
            >
              <SelectScrollUpButton />
              <SelectPrimitive.List className="p-1">
                {children}
              </SelectPrimitive.List>
              <SelectScrollDownButton />
            </SelectPrimitive.Popup>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop rendering
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className={cn("isolate", `z-[${Z_INDEX_POPUP}]`)} // Use semantic z-index constant
      >
        <AnimatePresence>
          {open && ( // Only render motion.div when open to allow exit animation
            <motion.div
              initial={{ opacity: 0, y: PAGE_TRANSITION_Y, scale: 0.98 }} // Subtle y translation and scale for entry
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: PAGE_TRANSITION_Y, scale: 0.98 }}
              transition={SPRING_TRANSITION_PROPS} // Using centralized transition
              data-slot="select-content-wrapper"
              className={cn(
                "relative isolate max-h-[var(--available-height)] w-[var(--anchor-width)] min-w-[14rem] origin-[var(--transform-origin)] overflow-hidden rounded-[1.5rem] bg-card text-popover-foreground shadow-[var(--shadow-elevated)] glass", // Apple-like card with glass and elevated shadow
                className
              )}
              {...props}
            >
              <SelectPrimitive.Popup
                data-slot="select-content"
                data-align-trigger={alignItemWithTrigger}
                className="w-full h-full p-1" // Inner padding for the list
              >
                <SelectScrollUpButton />
                <SelectPrimitive.List className="p-1"> {/* Padding for list items */}
                  {children}
                </SelectPrimitive.List>
                <SelectScrollDownButton />
              </SelectPrimitive.Popup>
            </motion.div>
          )}
        </AnimatePresence>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
})

// --- SelectLabel ---
const SelectLabel = React.memo(function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(`px-4 py-2 text-xs font-inter uppercase tracking-[0.1em] ${getTextColorClass('slate')}`, className)} // Consistent uppercase label styling
      {...props}
    />
  )
})

// --- SelectItem ---
const SelectItem = React.memo(function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  // SelectPrimitive.Item inherently handles role="option" and keyboard accessibility
  // if implemented correctly by the @base-ui/react/select library.
  // We ensure sufficient touch target and visual feedback.
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "var(--shadow-soft), var(--shadow-glow-cyan)" }} // Subtle lift and cyan glow on hover
      transition={SPRING_TRANSITION_PROPS} // Use centralized transition
      className="relative" // Removed z-0 as it's not strictly necessary here and could interfere
    >
      <SelectPrimitive.Item
        data-slot="select-item"
        className={cn(
          "relative flex w-full cursor-pointer items-center gap-2 rounded-2xl min-h-[44px] py-2 px-4 text-sm font-inter text-white outline-none select-none transition-colors", // Min-h for touch target, text-white for clarity
          `data-[focused]:bg-white/5 data-[focused]:text-white data-[focused]:ring-1 ${getBorderColorClass('cyan', '500', '30')} data-[focused]:shadow-[var(--shadow-soft)]`, // Focus state: subtle background, cyan ring, soft shadow
          "data-disabled:pointer-events-none data-disabled:opacity-50",
          "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", // Icon sizing
          "*:data-[slot=select-item-text]:flex *:data-[slot=select-item-text]:flex-1 *:data-[slot=select-item-text]:shrink-0 *:data-[slot=select-item-text]:gap-2 *:data-[slot=select-item-text]:whitespace-nowrap",
          className
        )}
        {...props}
      >
        <SelectPrimitive.ItemText>
          {children}
        </SelectPrimitive.ItemText>
        <SelectPrimitive.ItemIndicator
          render={
            <span className={cn("pointer-events-none absolute right-4 flex size-4 items-center justify-center", getTextColorClass('cyan', '500'))}> {/* Use cyan-500 for the checkmark accent */}
              <CheckIcon className="size-4" />
            </span>
          }
        />
      </SelectPrimitive.Item>
    </motion.div>
  )
})

// --- SelectSeparator ---
const SelectSeparator = React.memo(function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(`pointer-events-none -mx-2 my-2 h-px ${getBackgroundColorClass('slate', '700', '30')}`, className)} // Subtle separator without strong borders
      {...props}
    />
  )
})

// --- SelectScrollUpButton ---
const SelectScrollUpButton = React.memo(function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "sticky top-0 flex h-10 w-full cursor-default items-center justify-center bg-gradient-to-b from-card to-transparent",
        getTextColorClass('slate'), // Gradient for smooth scroll indication
        `z-[${Z_INDEX_SCROLL_BUTTON}]`, // Use semantic z-index constant
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-5" />
    </SelectPrimitive.ScrollUpArrow>
  )
})

// --- SelectScrollDownButton ---
const SelectScrollDownButton = React.memo(function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "sticky bottom-0 flex h-10 w-full cursor-default items-center justify-center bg-gradient-to-t from-card to-transparent",
        getTextColorClass('slate'), // Gradient for smooth scroll indication
        `z-[${Z_INDEX_SCROLL_BUTTON}]`, // Use semantic z-index constant
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-5" />
    </SelectPrimitive.ScrollDownArrow>
  )
})

// --- Exports ---
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}