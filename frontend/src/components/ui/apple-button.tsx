"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode, memo, useMemo } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  SPRING_TRANSITION,
  SHADOW_BUTTON_SECONDARY_HOVER,
  SHADOW_BUTTON_GHOST_HOVER,
  SHADOW_BUTTON_PRIMARY_FOCUS,
  SHADOW_BUTTON_DANGER_FOCUS,
  SHADOW_BUTTON_SECONDARY_FOCUS,
  SHADOW_BUTTON_GHOST_FOCUS,
} from "@/lib/constants";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface AppleButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  glowColor?: string; // Accepted but not used on button DOM — prevents leak to motion.button
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold shadow-[var(--shadow-glow-cyan)]",
  secondary:
    "bg-white/[0.04] text-secondary-foreground glass-subtle shadow-[var(--shadow-soft)]",
  ghost:
    "bg-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
  danger:
    "bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold shadow-[var(--shadow-glow-rose)]",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5 rounded-[1rem] min-h-[32px]",
  md: "px-4 py-2 text-sm gap-2 rounded-[1rem] min-h-[36px]",
  lg: "px-5 py-2.5 text-sm gap-2.5 rounded-[1rem] min-h-[40px]",
};

const whileTapProps = { scale: 0.96 };

export const AppleButton = memo(
  forwardRef<HTMLButtonElement, AppleButtonProps>(
    function AppleButton(
      { variant = "primary", size = "md", icon, children, loading, className, disabled, glowColor: _glowColor, ...rest },
      ref,
    ) {
      const isDisabled = disabled || loading;

      const whileHoverProps = useMemo(() => {
        if (isDisabled) return undefined;

        let boxShadowValue = undefined;
        if (variant === "secondary") {
          boxShadowValue = SHADOW_BUTTON_SECONDARY_HOVER;
        } else if (variant === "ghost") {
          boxShadowValue = SHADOW_BUTTON_GHOST_HOVER;
        }

        return {
          y: -2,
          boxShadow: boxShadowValue,
        };
      }, [isDisabled, variant]);

      const whileFocusProps = useMemo(() => {
        if (isDisabled) return undefined;

        let boxShadowValue = undefined;
        if (variant === "primary") {
          boxShadowValue = SHADOW_BUTTON_PRIMARY_FOCUS;
        } else if (variant === "danger") {
          boxShadowValue = SHADOW_BUTTON_DANGER_FOCUS;
        } else if (variant === "secondary") {
          boxShadowValue = SHADOW_BUTTON_SECONDARY_FOCUS;
        } else if (variant === "ghost") {
          boxShadowValue = SHADOW_BUTTON_GHOST_FOCUS;
        }

        return {
          y: -2,
          boxShadow: boxShadowValue,
        };
      }, [isDisabled, variant]);

      return (
        <motion.button
          ref={ref}
          className={cn(
            "inline-flex items-center justify-center font-medium outline-none",
            "transition-[background,border-color,color,box-shadow] duration-200 relative overflow-hidden",
            "tracking-[-0.03em]", // Apply precise letter-spacing for UI text
            variantStyles[variant],
            sizeStyles[size],
            isDisabled && "opacity-60 grayscale cursor-not-allowed",
            className,
          )}
          whileHover={whileHoverProps}
          whileFocus={whileFocusProps}
          whileTap={!isDisabled ? whileTapProps : undefined}
          transition={SPRING_TRANSITION}
          disabled={isDisabled}
          {...rest}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : icon ? (
            <span className="flex-shrink-0">{icon}</span>
          ) : null}
          {children}
        </motion.button>
      );
    },
  ),
);