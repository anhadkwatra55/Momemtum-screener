"use client";

import React from "react";
import {
  Zap,
  ZapOff,
  Leaf,
  Flame,
  Tornado,
  Target,
  DollarSign,
  Rocket,
  Box,
  Diamond,
  Radio,
  FlaskConical,
  Map,
  BarChart3,
  TrendingUp,
  TrendingDown,
  PieChart,
  Wifi,
  ArrowRight,
  RotateCw,
  ArrowLeft,
  ArrowUpCircle,
  ArrowDownCircle,
  Circle,
  AlertTriangle,
  X,
  Menu,
  ClipboardList,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  Search,
  ExternalLink,
  Globe,
  Crown,
  Hand,
  Receipt,
  HardDrive,
  type LucideIcon,
} from "lucide-react";

/**
 * SFIcon — Maps SF Symbol-style names to lucide-react SVG icons.
 * Zero emojis. All icons are crisp vector SVGs rendered inline.
 */

const ICON_MAP: Record<string, LucideIcon> = {
  "bolt.fill": Zap,
  "bolt.slash.fill": ZapOff,
  "bolt.circle.fill": Zap,
  "leaf.fill": Leaf,
  "flame.fill": Flame,
  "tornado": Tornado,
  "target": Target,
  "dollarsign.circle.fill": DollarSign,
  "dollarsign.square.fill": DollarSign,
  "rocket.fill": Rocket,
  "cube.fill": Box,
  "diamond.fill": Diamond,
  "radar.fill": Radio,
  "flask.fill": FlaskConical,
  "map.fill": Map,
  "chart.bar.fill": BarChart3,
  "chart.line.uptrend.rectangle.fill": TrendingUp,
  "chart.line.uptrend.rectangle.slash": TrendingDown,
  "chart.bar.xaxis.slash": BarChart3,
  "chart.line.uptrend.xyaxis": TrendingUp,
  "chart.line.downswing.xyaxis": TrendingDown,
  "chart.pie.fill": PieChart,
  "antenna.radiowaves.left.and.right": Wifi,
  "arrow.right": ArrowRight,
  "arrow.clockwise": RotateCw,
  "arrow.left": ArrowLeft,
  "arrow.up.circle.fill": ArrowUpCircle,
  "arrow.down.circle.fill": ArrowDownCircle,
  "circle.dotted": Circle,
  "exclamationmark.triangle.fill": AlertTriangle,
  "xmark": X,
  "line.3.horizontal": Menu,
  "line.horizontal.3": Menu,
  "list.bullet.rectangle.portrait": ClipboardList,
  "chevron.right": ChevronRight,
  "chevron.down": ChevronDown,
  "chevron.up": ChevronUp,
  "gearshape.fill": Settings,
  "magnifyingglass": Search,
  "square.and.arrow.up": ExternalLink,
  "globe.americas.fill": Globe,
  "chess.piece.queen.fill": Crown,
  "hand.wave.fill": Hand,
  "receipt.text.fill": Receipt,
  "database": HardDrive,
};

// Re-export the type for consumers that need it
export type SFSymbolName = string;

interface SFIconProps {
  /** SF Symbol name – accepts both `name` and `icon` props */
  name?: string;
  icon?: string;
  /** Size – number for px dimensions, or Tailwind class string (e.g. "text-5xl") */
  size?: number | string;
  className?: string;
}

export const SFIcon = React.memo(({ name, icon, size, className = "" }: SFIconProps) => {
  const symbolName = name || icon || "";
  const IconComponent = ICON_MAP[symbolName];

  // If size is a Tailwind class string (e.g. "text-5xl"), use it as className
  const isStringSize = typeof size === "string";
  const sizeClass = isStringSize ? size : "";

  // For numeric size, compute pixel dimensions
  const pxSize = typeof size === "number" ? size : 18;

  if (!IconComponent) {
    // Fallback: render a small dot for unknown icons (instead of emoji)
    return (
      <span
        className={`inline-flex items-center justify-center ${sizeClass} ${className}`.trim()}
        style={{
          width: typeof size === "number" ? size : undefined,
          height: typeof size === "number" ? size : undefined,
          lineHeight: 1,
        }}
        role="img"
        aria-label={symbolName}
      >
        <Circle className="w-3 h-3 text-current opacity-40" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center ${sizeClass} ${className}`.trim()}
      style={{ lineHeight: 1 }}
      role="img"
      aria-label={symbolName}
    >
      <IconComponent
        size={isStringSize ? undefined : pxSize}
        className={isStringSize ? "w-[1em] h-[1em]" : undefined}
        strokeWidth={1.8}
      />
    </span>
  );
});
SFIcon.displayName = "SFIcon";

export default SFIcon;
