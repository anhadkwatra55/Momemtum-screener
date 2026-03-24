"use client";

import React from "react";
import { Signal } from "@/types/momentum";
import { motion } from "framer-motion";

interface DailyMoversProps {
  signals: Signal[];
  maxItems?: number;
}

export const DailyMovers = React.memo(function DailyMovers({
  signals,
  maxItems = 5,
}: DailyMoversProps) {
  // Sort by daily_change descending for gainers, ascending for losers
  const sorted = [...signals].sort(
    (a, b) => (b.daily_change as number) - (a.daily_change as number)
  );

  const gainers = sorted.filter((s) => (s.daily_change as number) > 0).slice(0, maxItems);
  const losers = sorted.filter((s) => (s.daily_change as number) < 0).slice(-maxItems).reverse();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Gainers */}
      <div
        className="p-3 rounded-[4px]"
        style={{ background: "#111111", border: "1px solid #2A2A2A" }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00FF66]" />
          <h3 className="text-[11px] font-mono-data uppercase tracking-[0.1em] text-[#6B6B6B]">
            Top Gainers
          </h3>
        </div>
        <div className="space-y-1">
          {gainers.length === 0 && (
            <p className="text-[11px] text-[#6B6B6B] font-mono-data italic">No gainers today</p>
          )}
          {gainers.map((signal, i) => (
            <motion.div
              key={signal.ticker}
              className="flex items-center justify-between py-1.5 px-2 rounded-[2px] hover:bg-[#1C1C1C] transition-colors duration-[50ms]"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.1 }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#6B6B6B] font-mono-data w-4">{i + 1}</span>
                <span className="text-[12px] font-bold text-[#E8E8E8] font-mono-data">
                  {signal.ticker}
                </span>
                <span className="text-[10px] text-[#6B6B6B] font-mono-data">
                  {signal.sector}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#6B6B6B] font-mono-data">
                  ${(signal.price as number)?.toFixed(2)}
                </span>
                <span className="text-[12px] font-bold text-[#00FF66] font-mono-data min-w-[60px] text-right">
                  +{(signal.daily_change as number)?.toFixed(2)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Losers */}
      <div
        className="p-3 rounded-[4px]"
        style={{ background: "#111111", border: "1px solid #2A2A2A" }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF3333]" />
          <h3 className="text-[11px] font-mono-data uppercase tracking-[0.1em] text-[#6B6B6B]">
            Top Losers
          </h3>
        </div>
        <div className="space-y-1">
          {losers.length === 0 && (
            <p className="text-[11px] text-[#6B6B6B] font-mono-data italic">No losers today</p>
          )}
          {losers.map((signal, i) => (
            <motion.div
              key={signal.ticker}
              className="flex items-center justify-between py-1.5 px-2 rounded-[2px] hover:bg-[#1C1C1C] transition-colors duration-[50ms]"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.1 }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#6B6B6B] font-mono-data w-4">{i + 1}</span>
                <span className="text-[12px] font-bold text-[#E8E8E8] font-mono-data">
                  {signal.ticker}
                </span>
                <span className="text-[10px] text-[#6B6B6B] font-mono-data">
                  {signal.sector}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#6B6B6B] font-mono-data">
                  ${(signal.price as number)?.toFixed(2)}
                </span>
                <span className="text-[12px] font-bold text-[#FF3333] font-mono-data min-w-[60px] text-right">
                  {(signal.daily_change as number)?.toFixed(2)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
});
