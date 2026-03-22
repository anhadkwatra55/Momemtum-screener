"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";

/**
 * NYSEClock — Shows live NYSE time with pulsing seconds
 */
const NYSEClock = React.memo(function NYSEClock() {
  const [time, setTime] = useState("");
  const [marketStatus, setMarketStatus] = useState<"PRE" | "LIVE" | "AFTER" | "CLOSED">("CLOSED");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      // Convert to ET
      const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      const h = et.getHours();
      const m = et.getMinutes();
      const s = et.getSeconds();

      setTime(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );

      const day = et.getDay();
      const isWeekday = day >= 1 && day <= 5;
      const minuteOfDay = h * 60 + m;

      if (!isWeekday) setMarketStatus("CLOSED");
      else if (minuteOfDay < 570) setMarketStatus("PRE"); // Before 9:30
      else if (minuteOfDay < 960) setMarketStatus("LIVE"); // 9:30 - 16:00
      else if (minuteOfDay < 1080) setMarketStatus("AFTER"); // 16:00 - 18:00
      else setMarketStatus("CLOSED");
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const statusColor = {
    PRE: "text-[#FFD600]",
    LIVE: "text-[#00FF66]",
    AFTER: "text-[#FFD600]",
    CLOSED: "text-[#6B6B6B]",
  }[marketStatus];

  const dotColor = {
    PRE: "bg-[#FFD600]",
    LIVE: "bg-[#00FF66]",
    AFTER: "bg-[#FFD600]",
    CLOSED: "bg-[#6B6B6B]",
  }[marketStatus];

  return (
    <div className="flex items-center gap-2 font-mono-data text-[11px]">
      <span className="text-[#6B6B6B] tracking-[0.08em] uppercase text-[10px]">NYSE</span>
      <span className="text-[#E8E8E8] tabular-nums">
        {time.slice(0, -3)}
        <span className="ct-tick">{time.slice(-3)}</span>
      </span>
      <div className={cn("w-1.5 h-1.5 rounded-full", dotColor, marketStatus === "LIVE" && "ct-pulse")} />
      <span className={cn(statusColor, "text-[10px] tracking-[0.1em] font-semibold")}>{marketStatus}</span>
    </div>
  );
});

interface TopNavProps {
  title?: string;
  icon?: string;
}

export const TopNav = React.memo(function TopNav({
  title = "HEADSTART",
}: TopNavProps) {
  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 h-[48px]",
      "bg-[#0A0A0A] border-b border-[#2A2A2A]",
      "px-4 md:pl-[216px] flex items-center justify-between",
      "z-50"
    )}>
      {/* Left: wordmark + market clock */}
      <div className="flex items-center gap-6">
        <Link href={ROUTES.home} className="flex items-center gap-2 no-underline md:hidden">
          <div className="w-7 h-7 rounded-[2px] flex items-center justify-center text-[11px] font-extrabold text-black bg-[#00FF66] flex-shrink-0 font-mono-data">
            H
          </div>
          <h1 className="text-[13px] font-bold tracking-[0.15em] text-[#E8E8E8] font-mono-data uppercase">
            {title}
          </h1>
        </Link>
        <NYSEClock />
      </div>

      {/* Right: engine status */}
      <div className="flex items-center gap-4">
        {/* Cmd+K search hint */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 border border-[#2A2A2A] rounded-[2px] text-[#6B6B6B] text-[10px] font-mono-data cursor-pointer hover:border-[#00FF66] hover:text-[#00FF66] transition-all duration-[50ms]">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M6.5 1a5.5 5.5 0 014.383 8.823l3.147 3.147a.75.75 0 01-1.06 1.06l-3.147-3.147A5.5 5.5 0 116.5 1zm0 1.5a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
          <span>Search</span>
          <kbd className="px-1 py-0.5 bg-[#1C1C1C] border border-[#2A2A2A] rounded-[1px] text-[9px] text-[#6B6B6B]">⌘K</kbd>
        </div>

        {/* Intelligence Sync */}
        <div className="hidden sm:flex items-center gap-2 font-mono-data text-[10px]">
          <span className="text-[#6B6B6B] tracking-[0.08em] uppercase">SYNC</span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#00FF66] ct-pulse" />
          <span className="text-[#00FF66] tracking-[0.05em]">LIVE</span>
        </div>
      </div>
    </nav>
  );
});