"use client";

import { forwardRef, type ReactNode, memo, useMemo } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import {
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
  glowColor?: string;
}

// Carbon Terminal button styles
const variantStyles: Record<Variant, string> = {
  primary:
    "bg-[#00FF66] text-black font-semibold",
  secondary:
    "bg-[#1C1C1C] text-[#C0C0C0] border border-[#2A2A2A]",
  ghost:
    "bg-transparent text-[#6B6B6B] hover:bg-[#1C1C1C] hover:text-[#E8E8E8]",
  danger:
    "bg-[#FF3333] text-white font-semibold",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[10px] gap-1.5 rounded-[2px] min-h-[28px] font-mono-data tracking-[0.04em] uppercase",
  md: "px-4 py-2 text-xs gap-2 rounded-[2px] min-h-[32px] font-mono-data tracking-[0.04em] uppercase",
  lg: "px-5 py-2.5 text-xs gap-2.5 rounded-[3px] min-h-[36px] font-mono-data tracking-[0.04em] uppercase",
};

const whileTapProps = { scale: 0.97 };

export const AppleButton = memo(
  forwardRef<HTMLButtonElement, AppleButtonProps>(
    function AppleButton(
      { variant = "primary", size = "md", icon, children, loading, className, disabled, glowColor: _glowColor, ...rest },
      ref,
    ) {
      const isDisabled = disabled || loading;

      const whileHoverProps = useMemo(() => {
        if (isDisabled) return undefined;
        // Carbon Terminal: border glow on hover
        const focusMap: Record<Variant, string> = {
          primary: SHADOW_BUTTON_PRIMARY_FOCUS,
          danger: SHADOW_BUTTON_DANGER_FOCUS,
          secondary: SHADOW_BUTTON_SECONDARY_FOCUS,
          ghost: SHADOW_BUTTON_GHOST_FOCUS,
        };
        return { boxShadow: focusMap[variant] };
      }, [isDisabled, variant]);

      return (
        <motion.button
          ref={ref}
          className={cn(
            "inline-flex items-center justify-center font-medium outline-none",
            "transition-all duration-[50ms] ease-out relative overflow-hidden",
            variantStyles[variant],
            sizeStyles[size],
            isDisabled && "opacity-40 cursor-not-allowed",
            className,
          )}
          whileHover={whileHoverProps}
          whileTap={!isDisabled ? whileTapProps : undefined}
          transition={{ duration: 0.05, ease: "easeOut" }}
          disabled={isDisabled}
          {...rest}
        >
          {loading ? (
            <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : icon ? (
            <span className="flex-shrink-0">{icon}</span>
          ) : null}
          {children}
        </motion.button>
      );
    },
  ),
);