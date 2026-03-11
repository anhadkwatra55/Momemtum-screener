"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import {
  cn,
  PaletteColorKey, // Imported from lib/utils.ts
  hexToRgba // New utility function from lib/utils.ts
} from "@/lib/utils"
import {
  MOTION_SPRING_CONFIG,
  COLORS, // Needed for internal hexToRgbaString helper
  GLOW_SHADOW_CYAN,
  GLOW_SHADOW_ROSE,
  MIN_BUTTON_HEIGHT_PX,
  BUTTON_HEIGHT_LG_PX,
  BUTTON_ICON_SIZE_PX,
  BUTTON_ICON_SIZE_LG_PX,
  BUTTON_TEXT_LETTER_SPACING_TIGHT,
  BUTTON_TEXT_LETTER_SPACING_NORMAL,
  FOCUS_NEUTRAL_COLOR_KEY, // New constant for neutral focus color key
  FOCUS_NEUTRAL_OPACITY // New constant for neutral focus opacity
} from "@/lib/constants"

// Helper for Framer Motion background color animation
const getFocusBackgroundColorValue = (colorKey: PaletteColorKey, opacity: number): string => {
  const hex = COLORS[colorKey];
  return hexToRgba(hex, opacity);
};

const buttonVariants = cva(
  `group/button
  inline-flex shrink-0 items-center justify-center whitespace-nowrap
  outline-none select-none relative
  rounded-2xl border border-transparent bg-clip-padding
  transition-colors duration-100 ease-in-out // Faster, smoother color transitions
  font-inter antialiased // Apply Inter font and antialiasing for premium typography

  focus-visible:ring-0 focus-visible:ring-offset-0

  disabled:pointer-events-none disabled:saturate-[0.4] disabled:opacity-60 disabled:grayscale-[20%]
  aria-invalid:border-rose-500/50 aria-invalid:ring-1 aria-invalid:ring-rose-500/20
  `,
  {
    variants: {
      variant: {
        default:
          `bg-cyan-600 text-cyan-50 shadow-[var(--shadow-soft)]
          hover:bg-cyan-700 active:bg-cyan-800`,
        outline:
          `glass-subtle bg-card/40 text-foreground shadow-[var(--shadow-soft)]
          hover:bg-card/60`, // Removed explicit border from outline for minimal borders approach
        secondary:
          `glass-subtle bg-violet-600/70 text-violet-50
          shadow-[var(--shadow-soft)]
          hover:bg-violet-700/80`,
        ghost:
          `hover:bg-muted/20 hover:text-foreground`,
        destructive:
          `bg-rose-500/15 text-rose-400 shadow-[var(--shadow-soft)]
          hover:bg-rose-500/25`,
        link:
          `text-cyan-400 underline-offset-4 hover:underline
          hover:text-cyan-300`,
      },
      size: {
        default:
          `min-h-[${MIN_BUTTON_HEIGHT_PX}px] px-4 gap-2 text-sm [letter-spacing:${BUTTON_TEXT_LETTER_SPACING_TIGHT}]
          md:min-h-[${MIN_BUTTON_HEIGHT_PX}px] md:px-4 md:text-sm
          [&_svg:not([class*='size-'])]:size-4`,
        xs:
          `min-h-[${MIN_BUTTON_HEIGHT_PX}px] px-3.5 gap-1.5 text-xs [letter-spacing:${BUTTON_TEXT_LETTER_SPACING_TIGHT}]
          md:min-h-[${MIN_BUTTON_HEIGHT_PX}px] md:px-3.5 md:text-xs
          [&_svg:not([class*='size-'])]:size-3.5`,
        sm:
          `min-h-[${MIN_BUTTON_HEIGHT_PX}px] px-3.5 gap-1.5 text-sm [letter-spacing:${BUTTON_TEXT_LETTER_SPACING_TIGHT}]
          md:min-h-[${MIN_BUTTON_HEIGHT_PX}px] md:px-3.5 md:text-sm
          [&_svg:not([class*='size-'])]:size-3.5`,
        lg:
          `min-h-[${BUTTON_HEIGHT_LG_PX}px] px-5 gap-2.5 text-base [letter-spacing:${BUTTON_TEXT_LETTER_SPACING_NORMAL}]
          md:min-h-[${BUTTON_HEIGHT_LG_PX}px] md:px-5 md:text-base
          [&_svg:not([class*='size-'])]:size-5`,
        icon:
          `size-[${BUTTON_ICON_SIZE_PX}px] [&_svg:not([class*='size-'])]:size-5
          md:size-[${BUTTON_ICON_SIZE_PX}px]`,
        "icon-xs":
          `size-[${BUTTON_ICON_SIZE_PX}px] [&_svg:not([class*='size-'])]:size-4
          md:size-[${BUTTON_ICON_SIZE_PX}px]`,
        "icon-sm":
          `size-[${BUTTON_ICON_SIZE_PX}px] [&_svg:not([class*='size-'])]:size-4.5
          md:size-[${BUTTON_ICON_SIZE_PX}px]`,
        "icon-lg":
          `size-[${BUTTON_ICON_SIZE_LG_PX}px] [&_svg:not([class*='size-'])]:size-6
          md:size-[${BUTTON_ICON_SIZE_LG_PX}px]`,
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const MotionButtonPrimitive = motion(ButtonPrimitive);

interface ButtonProps extends ButtonPrimitive.Props, VariantProps<typeof buttonVariants> {}

const Button = React.memo(React.forwardRef<
  React.ElementRef<typeof ButtonPrimitive>,
  ButtonProps
>(({
  className,
  variant = "default",
  size = "default",
  children,
  disabled,
  ...props
}, ref) => {
  const interactiveGlowShadow = React.useMemo(() => {
    if (variant === "destructive") {
      return GLOW_SHADOW_ROSE;
    }
    if (variant === "link" || variant === "ghost") {
      return 'none';
    }
    return GLOW_SHADOW_CYAN;
  }, [variant]);

  const whileHoverState = React.useMemo(() => disabled ? {} : {
    y: -2,
    boxShadow: `var(--shadow-card), ${interactiveGlowShadow}`,
    transition: MOTION_SPRING_CONFIG,
  }, [disabled, interactiveGlowShadow]);

  const whileFocusState = React.useMemo(() => disabled ? {} : {
    boxShadow: `var(--shadow-elevated), ${interactiveGlowShadow}`,
    // Utilizing getFocusBackgroundColorValue for consistent color tokenization
    // by translating COLORS hex values to rgba strings for Framer Motion's backgroundColor.
    backgroundColor:
      variant === "default"     ? getFocusBackgroundColorValue('cyan', FOCUS_NEUTRAL_OPACITY) :
      variant === "secondary"   ? getFocusBackgroundColorValue('violet', FOCUS_NEUTRAL_OPACITY) :
      variant === "destructive" ? getFocusBackgroundColorValue('rose', FOCUS_NEUTRAL_OPACITY) :
      variant === "outline"     ? getFocusBackgroundColorValue(FOCUS_NEUTRAL_COLOR_KEY, FOCUS_NEUTRAL_OPACITY) :
      variant === "ghost"       ? getFocusBackgroundColorValue(FOCUS_NEUTRAL_COLOR_KEY, FOCUS_NEUTRAL_OPACITY) :
      'transparent', // For link variant or any other future variants
    transition: MOTION_SPRING_CONFIG,
  }, [disabled, interactiveGlowShadow, variant]);

  return (
    <MotionButtonPrimitive
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      initial={{ y: 0, boxShadow: 'var(--shadow-soft)' }}
      whileHover={whileHoverState}
      whileFocus={whileFocusState}
      disabled={disabled}
      {...props}
    >
      {children}
    </MotionButtonPrimitive>
  )
}))
Button.displayName = "Button"

export { Button, buttonVariants }