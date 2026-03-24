"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";

/**
 * NYSEClock — Clean, Inter-style market clock
 */
const NYSEClock = React.memo(function NYSEClock() {
  const [time, setTime] = useState("");
  const [marketStatus, setMarketStatus] = useState<"PRE" | "LIVE" | "AFTER" | "CLOSED">("CLOSED");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      const h = et.getHours(), m = et.getMinutes(), s = et.getSeconds();
      setTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      const day = et.getDay();
      const minuteOfDay = h * 60 + m;
      if (day < 1 || day > 5) setMarketStatus("CLOSED");
      else if (minuteOfDay < 570) setMarketStatus("PRE");
      else if (minuteOfDay < 960) setMarketStatus("LIVE");
      else if (minuteOfDay < 1080) setMarketStatus("AFTER");
      else setMarketStatus("CLOSED");
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const colors = {
    PRE: { text: "#e2b857", dot: "#e2b857" },
    LIVE: { text: "#4ade80", dot: "#4ade80" },
    AFTER: { text: "#e2b857", dot: "#e2b857" },
    CLOSED: { text: "#707070", dot: "#707070" },
  }[marketStatus];

  return (
    <div className="flex items-center gap-2 text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <span className="text-[#707070] tracking-wide uppercase text-[10px]">NYSE</span>
      <span className="text-[#e0e0e0] tabular-nums">
        {time.slice(0, -3)}<span style={{ opacity: 0.4 }}>{time.slice(-3)}</span>
      </span>
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: colors.dot, boxShadow: marketStatus === "LIVE" ? `0 0 6px ${colors.dot}` : "none" }} />
      <span style={{ color: colors.text }} className="text-[10px] tracking-wide font-medium">{marketStatus}</span>
    </div>
  );
});

interface TopNavProps {
  onMenuClick?: () => void;
}

export const TopNav = React.memo(function TopNav({ onMenuClick }: TopNavProps) {
  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 h-[48px]",
      "bg-[#111111]/95 backdrop-blur-sm border-b border-[#2d2d2d]",
      "px-3 md:px-4 md:pl-[236px] flex items-center justify-between",
      "z-50"
    )}>
      {/* Left: hamburger (mobile) + logo (mobile) + clock */}
      <div className="flex items-center gap-3 md:gap-6">
        {/* Mobile hamburger inside topnav */}
        <button
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-md text-[#a0a0a0] hover:text-[#e2b857] transition-colors duration-200"
          aria-label="Open menu"
          onClick={onMenuClick}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M2 4h12v1H2zm0 3.5h12v1H2zm0 3.5h12v1H2z" />
          </svg>
        </button>

        <Link href={ROUTES.home} className="flex items-center gap-2 no-underline md:hidden">
          <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-[#0d0d0d] bg-[#e2b857] flex-shrink-0">
            H
          </div>
          <span className="text-[12px] font-semibold tracking-wide text-[#e0e0e0]">
            HEADSTART
          </span>
        </Link>

        <NYSEClock />
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Search — hidden on small mobile */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 border border-[#2d2d2d] rounded-md text-[#707070] text-[11px] cursor-pointer hover:border-[#e2b857] hover:text-[#e2b857] transition-all duration-200">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M6.5 1a5.5 5.5 0 014.383 8.823l3.147 3.147a.75.75 0 01-1.06 1.06l-3.147-3.147A5.5 5.5 0 116.5 1zm0 1.5a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
          <span>Search</span>
          <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2d2d2d] rounded text-[9px] text-[#707070]">⌘K</kbd>
        </div>

        {/* Sync status — hidden on small mobile */}
        <div className="hidden sm:flex items-center gap-2 text-[10px]">
          <span className="text-[#707070] tracking-wide">SYNC</span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" style={{ boxShadow: "0 0 6px rgba(74,222,128,0.6)" }} />
          <span className="text-[#4ade80] tracking-wide font-medium">LIVE</span>
        </div>
      </div>
    </nav>
  );
});