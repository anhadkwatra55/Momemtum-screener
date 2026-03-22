"use client";

import { forwardRef, type ReactNode, useMemo, memo, useCallback } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn, PaletteColorKey } from "@/lib/utils";
import { CARD_BORDER_RADIUS } from "@/lib/constants";

/* ── Logic-only types (portable) ── */
export interface AppleCardData {
  glowColor?: PaletteColorKey;
  interactive?: boolean;
  padded?: boolean;
  span?: number;
  rowSpan?: number;
  onClick?: () => void;
}

/* ── Presentation Props ── */
interface AppleCardProps
  extends Omit<HTMLMotionProps<"div">, "children">,
    AppleCardData {
  children: ReactNode;
}

const AppleCardComponent = forwardRef<HTMLDivElement, AppleCardProps>(
  function AppleCard(
    { children, glowColor, interactive = true, padded = true, span, rowSpan, onClick, className = "", style, ...rest },
    ref,
  ) {
    const inlineGridStyle = useMemo(() => {
      const gridStyle: React.CSSProperties = { ...style };
      if (span) gridStyle.gridColumn = `span ${span}`;
      if (rowSpan) gridStyle.gridRow = `span ${rowSpan}`;
      return gridStyle;
    }, [style, span, rowSpan]);

    const whileHoverProps = useMemo(() => {
      if (!interactive) return undefined;
      return {
        borderColor: '#00FF66',
      };
    }, [interactive]);

    const whileTapProps = useMemo(() => {
      return interactive ? { scale: 0.995 } : undefined;
    }, [interactive]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
      if (interactive && onClick && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onClick();
      }
    }, [interactive, onClick]);

    return (
      <motion.div
        ref={ref}
        className={cn(
          "relative overflow-hidden group",
          // Carbon Terminal panel surface
          "bg-[#111111] border border-[#2A2A2A]",
          `rounded-[${CARD_BORDER_RADIUS}]`,
          interactive && "cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#00FF66]",
          padded && "p-3 sm:p-4",
          className,
        )}
        style={inlineGridStyle}
        whileHover={whileHoverProps}
        whileTap={whileTapProps}
        transition={{ duration: 0.05, ease: "easeOut" }}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={interactive ? onClick : undefined}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        <div className="relative z-[1]">
          {children}
        </div>
      </motion.div>
    );
  },
);

export const AppleCard = memo(AppleCardComponent);