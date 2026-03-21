"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Conviction tier configuration — maps each tier to its visual style.
 * No emojis — pure color-coded gradients with tracked typography.
 */
const TIER_CONFIG: Record<string, {
  gradient: string;
  text: string;
  border: string;
  bg: string;
  image: string;
}> = {
  "Ultra Conviction": {
    gradient: "from-amber-500/20 to-yellow-600/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    image: "/images/tiers/ultra.png",
  },
  "High Conviction": {
    gradient: "from-emerald-500/20 to-teal-600/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    image: "/images/tiers/high.png",
  },
  "Moderate Conviction": {
    gradient: "from-cyan-500/20 to-blue-600/10",
    text: "text-cyan-400",
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/10",
    image: "/images/tiers/moderate.png",
  },
  "Low Conviction": {
    gradient: "from-slate-400/20 to-zinc-500/10",
    text: "text-slate-400",
    border: "border-slate-400/30",
    bg: "bg-slate-500/10",
    image: "/images/tiers/low.png",
  },
  "Contrarian": {
    gradient: "from-rose-500/20 to-fuchsia-600/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
    bg: "bg-rose-500/10",
    image: "/images/tiers/contrarian.png",
  },
};

const ACTION_CONFIG: Record<string, {
  text: string;
  bg: string;
  border: string;
}> = {
  "Top Pick": { text: "text-amber-300", bg: "bg-amber-500/15", border: "border-amber-500/25" },
  "Accumulate": { text: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/25" },
  "Hold & Monitor": { text: "text-cyan-400", bg: "bg-cyan-500/15", border: "border-cyan-500/25" },
  "Caution": { text: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/25" },
  "Reduce Exposure": { text: "text-rose-400", bg: "bg-rose-500/15", border: "border-rose-500/25" },
  "Avoid": { text: "text-rose-500", bg: "bg-rose-600/15", border: "border-rose-600/25" },
};

/** Get tier config with fallback */
export function getTierConfig(tier: string) {
  return TIER_CONFIG[tier] ?? TIER_CONFIG["Contrarian"];
}

/** Get action config with fallback */
export function getActionConfig(action: string) {
  return ACTION_CONFIG[action] ?? ACTION_CONFIG["Hold & Monitor"];
}

/** Conviction tier names in display order */
export const TIER_ORDER = ["Ultra Conviction", "High Conviction", "Moderate Conviction", "Low Conviction", "Contrarian"] as const;

/** Action category names in display order */
export const ACTION_ORDER = ["Top Pick", "Accumulate", "Hold & Monitor", "Caution", "Reduce Exposure", "Avoid"] as const;

interface ConvictionBadgeProps {
  tier: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Pill-shaped conviction tier badge with gradient border.
 * No emojis — bold text with color-coded background.
 */
export const ConvictionBadge = React.memo(function ConvictionBadge({
  tier,
  size = "sm",
  className,
}: ConvictionBadgeProps) {
  const config = getTierConfig(tier);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-[0.08em] whitespace-nowrap",
        config.bg,
        config.border,
        config.text,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        className,
      )}
    >
      {tier}
    </span>
  );
});

interface ActionBadgeProps {
  action: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Action category badge — minimal pill with color accent.
 */
export const ActionBadge = React.memo(function ActionBadge({
  action,
  size = "sm",
  className,
}: ActionBadgeProps) {
  const config = getActionConfig(action);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-[0.06em] whitespace-nowrap",
        config.bg,
        config.border,
        config.text,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        className,
      )}
    >
      {action}
    </span>
  );
});
