"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion, useMotionValue, useSpring, useTransform, animate } from "framer-motion";

// ── Carbon Terminal Palette Key → color mapping ──
type PaletteColorKey = "cyan" | "emerald" | "amber" | "rose" | "slate" | "violet" | "blue" | "lime" | "orange";

const CT_COLORS: Record<PaletteColorKey, { text: string; border: string; bg: string }> = {
  cyan:    { text: "text-[#00FF66]", border: "border-[#00FF66]/25", bg: "bg-[#00FF66]/6" },
  emerald: { text: "text-[#00FF66]", border: "border-[#00FF66]/25", bg: "bg-[#00FF66]/6" },
  lime:    { text: "text-[#00FF66]", border: "border-[#00FF66]/25", bg: "bg-[#00FF66]/6" },
  amber:   { text: "text-[#FFD600]", border: "border-[#FFD600]/25", bg: "bg-[#FFD600]/6" },
  orange:  { text: "text-[#FFD600]", border: "border-[#FFD600]/25", bg: "bg-[#FFD600]/6" },
  rose:    { text: "text-[#FF3333]", border: "border-[#FF3333]/25", bg: "bg-[#FF3333]/6" },
  slate:   { text: "text-[#6B6B6B]", border: "border-[#2A2A2A]",   bg: "bg-[#6B6B6B]/6" },
  violet:  { text: "text-[#6B6B6B]", border: "border-[#2A2A2A]",   bg: "bg-[#6B6B6B]/6" },
  blue:    { text: "text-[#6B6B6B]", border: "border-[#2A2A2A]",   bg: "bg-[#6B6B6B]/6" },
};

/** Animated number counter — tween to target value */
function AnimatedNumber({ value }: { value: number | string }) {
  const numericValue = typeof value === "string" ? parseFloat(value) || 0 : value;
  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (v) => Math.round(v).toLocaleString());
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(motionValue, numericValue, {
      duration: 0.6,
      ease: "easeOut",
    });
    return controls.stop;
  }, [numericValue, motionValue]);

  useEffect(() => {
    const unsubscribe = display.on("change", (v) => {
      if (ref.current) ref.current.textContent = v;
    });
    return unsubscribe;
  }, [display]);

  return <span ref={ref}>{Math.round(numericValue).toLocaleString()}</span>;
}

/** Single KPI Telemetry Tile */
function KPICard({
  label,
  value,
  colorKey = "cyan",
  prefix = "",
  suffix = "",
}: {
  label: string;
  value: number | string;
  colorKey?: PaletteColorKey;
  prefix?: string;
  suffix?: string;
}) {
  const colors = CT_COLORS[colorKey] ?? CT_COLORS.cyan;

  return (
    <motion.div
      className={cn(
        "relative bg-[#111111] border border-[#2A2A2A] rounded-[3px] p-3",
        "hover:border-[#00FF66]/40 transition-all duration-[50ms] ease-out",
        "group cursor-default"
      )}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
    >
      {/* Label */}
      <div className="text-[10px] font-mono-data font-medium text-[#6B6B6B] uppercase tracking-[0.12em] mb-1.5">
        {label}
      </div>

      {/* Value */}
      <div className={cn("text-2xl font-mono-data font-bold tabular-nums", colors.text)}>
        {prefix}
        <AnimatedNumber value={value} />
        {suffix}
      </div>

      {/* Bottom accent line */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 h-[2px]",
        colors.bg,
        "opacity-60"
      )} />
    </motion.div>
  );
}

// ── Skeleton ──

export function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-[#111111] border border-[#2A2A2A] rounded-[3px] p-3 h-[72px]">
          <div className="skeleton h-3 w-16 mb-2 rounded-[2px]" />
          <div className="skeleton h-6 w-12 rounded-[2px]" />
        </div>
      ))}
    </div>
  );
}

// ── KPI Strip ──

interface KPIStripProps {
  items: Array<{
    label: string;
    value: number | string;
    colorKey?: PaletteColorKey;
    color?: PaletteColorKey; // backward compat alias
    prefix?: string;
    suffix?: string;
  }>;
  className?: string;
}

export function KPIStrip({ items, className }: KPIStripProps) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2", className)}>
      {items.map((item) => (
        <KPICard key={item.label} {...item} colorKey={item.colorKey ?? item.color ?? "cyan"} />
      ))}
    </div>
  );
}