"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Carbon Terminal Conviction Tier Configuration
 * Monochrome base with signal colors only: green, red, yellow
 */
const TIER_CONFIG: Record<string, {
  text: string;
  bg: string;
  border: string;
  image: string;
}> = {
  "Ultra Conviction": {
    text: "text-[#00FF66]",
    bg: "bg-[#00FF66]/10",
    border: "border-[#00FF66]/30",
    image: "/images/tiers/ultra.png",
  },
  "High Conviction": {
    text: "text-[#00FF66]",
    bg: "bg-[#00FF66]/8",
    border: "border-[#00FF66]/25",
    image: "/images/tiers/high.png",
  },
  "Moderate Conviction": {
    text: "text-[#C0C0C0]",
    bg: "bg-[#C0C0C0]/8",
    border: "border-[#2A2A2A]",
    image: "/images/tiers/moderate.png",
  },
  "Low Conviction": {
    text: "text-[#6B6B6B]",
    bg: "bg-[#6B6B6B]/8",
    border: "border-[#2A2A2A]",
    image: "/images/tiers/low.png",
  },
  "Contrarian": {
    text: "text-[#FF3333]",
    bg: "bg-[#FF3333]/8",
    border: "border-[#FF3333]/25",
    image: "/images/tiers/contrarian.png",
  },
};

const ACTION_CONFIG: Record<string, {
  text: string;
  bg: string;
  border: string;
}> = {
  "Top Pick": { text: "text-[#00FF66]", bg: "bg-[#00FF66]/10", border: "border-[#00FF66]/25" },
  "Accumulate": { text: "text-[#00FF66]", bg: "bg-[#00FF66]/8", border: "border-[#00FF66]/20" },
  "Hold & Monitor": { text: "text-[#C0C0C0]", bg: "bg-[#C0C0C0]/8", border: "border-[#2A2A2A]" },
  "Caution": { text: "text-[#FFD600]", bg: "bg-[#FFD600]/8", border: "border-[#FFD600]/25" },
  "Reduce Exposure": { text: "text-[#FF3333]", bg: "bg-[#FF3333]/8", border: "border-[#FF3333]/20" },
  "Avoid": { text: "text-[#FF3333]", bg: "bg-[#FF3333]/10", border: "border-[#FF3333]/25" },
};

/** Get tier config with fallback */
export function getTierConfig(tier: string) {
  return TIER_CONFIG[tier] ?? TIER_CONFIG["Low Conviction"];
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
 * Carbon Terminal conviction badge — tight 2px radius, monospace, uppercase.
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
        "inline-flex items-center rounded-[2px] border font-mono-data font-semibold uppercase tracking-[0.1em] whitespace-nowrap",
        config.bg,
        config.border,
        config.text,
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]",
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
 * Carbon Terminal action badge — tight 2px radius, monospace.
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
        "inline-flex items-center rounded-[2px] border font-mono-data font-medium uppercase tracking-[0.08em] whitespace-nowrap",
        config.bg,
        config.border,
        config.text,
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]",
        className,
      )}
    >
      {action}
    </span>
  );
});
