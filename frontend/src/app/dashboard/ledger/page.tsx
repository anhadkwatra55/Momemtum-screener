"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopNav } from "@/components/layout/topnav";
import { KPIStrip } from "@/components/momentum/kpi-strip";
import {
  COLORS,
  SPRING_PHYSICS_DEFAULT,
  FLASH_ANIMATION_PROPS,
  TYPOGRAPHY_LETTER_SPACING_UPPERCASE,
  TYPOGRAPHY_LETTER_SPACING_HEADING,
  Z_INDICES,
  CARD_BORDER_RADIUS,
} from "@/lib/constants";
import { cn, getTextColorClass, getBackgroundColorClass, getBorderColorClass } from "@/lib/utils";
import { AppleCard } from "@/components/ui/apple-card";
import SFIcon from "@/components/ui/SFIcon";
import { getAuthHeaders } from "@/services/api";

const SPRING_TRANSITION_PROPS = { type: "spring", ...SPRING_PHYSICS_DEFAULT };

const pageTransitionVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: SPRING_TRANSITION_PROPS,
};

const tableRowHoverVariants = {
  initial: { translateY: 0, scale: 1 },
  hover: { translateY: -2, scale: 1.005 },
  transition: SPRING_TRANSITION_PROPS,
};

const CARD_X_PADDING = "px-6";
const RECEIPT_TABLE_GRID_COLS = "grid-cols-[60px_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(100px,1fr)]";

interface LedgerEntry {
  date: string;
  week: string;
  ticker: string;
  entry_price: number;
  current_price: number;
  return_pct: number;
  hit: boolean;
}

interface LedgerStats {
  total_picks: number;
  win_rate: number;
  avg_return: number;
  wins: number;
  losses: number;
}

const LedgerCardRow = memo(({ entry, index }: { entry: LedgerEntry, index: number }) => {
  const retColorClass = useMemo(() => {
    if (entry.return_pct > 0) return getTextColorClass("emerald", "400");
    if (entry.return_pct < 0) return getTextColorClass("rose", "400");
    return getTextColorClass("slate", "400");
  }, [entry.return_pct]);

  const resultBadgeClasses = useMemo(() => {
    const icon = entry.hit ? "arrow.up.circle.fill" : "arrow.down.circle.fill";
    const text = entry.hit ? "WIN" : "LOSS";
    const bg = entry.hit ? getBackgroundColorClass("emerald", "500", "15") : getBackgroundColorClass("rose", "500", "15");
    const color = entry.hit ? getTextColorClass("emerald", "400") : getTextColorClass("rose", "400");
    const border = entry.hit ? getBorderColorClass("emerald", "500", "25") : getBorderColorClass("rose", "500", "25");

    return { icon, text, classes: cn("text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1", bg, color, border) };
  }, [entry.hit]);

  return (
    <motion.div
      className={cn(
        "relative group mb-2 last:mb-0",
        RECEIPT_TABLE_GRID_COLS,
        "items-center py-3.5",
        "shadow-card",
        CARD_BORDER_RADIUS,
      )}
      initial="initial"
      variants={tableRowHoverVariants}
      animate="initial"
      whileHover="hover"
      transition={SPRING_TRANSITION_PROPS}
    >
      <motion.div
        className={cn("absolute inset-0 -z-[1]", CARD_BORDER_RADIUS)}
        variants={{
          initial: { boxShadow: "var(--shadow-card)", background: COLORS.card, border: "1px solid transparent" },
          hover: { boxShadow: "var(--shadow-glow-cyan)", background: getBackgroundColorClass("slate", "800", "50"), border: `1px solid ${COLORS.cyan}` }
        }}
        transition={SPRING_TRANSITION_PROPS}
      />

      <div className="px-4 text-slate-400 font-mono-data text-sm">{index + 1}</div>
      <div className="px-4 text-slate-400 font-mono-data text-sm">{entry.week}</div>
      <div className="px-4 text-slate-400 text-sm whitespace-nowrap">{entry.date}</div>
      <div className={cn(
        "px-4 font-bold font-mono-data text-base whitespace-nowrap",
        "sticky left-0 z-[Z_INDICES.stickyColumn]",
        "bg-card/90 backdrop-blur-sm group-hover:bg-slate-800/60"
      )}>
        <span className={getTextColorClass("cyan", "400")}>{entry.ticker}</span>
      </div>
      
      <div className="px-4 font-mono-data text-sm">${entry.entry_price.toFixed(2)}</div>
      <div className="px-4 font-mono-data text-sm">${entry.current_price.toFixed(2)}</div>
      
      <div className={cn("px-4 font-mono-data font-bold text-lg whitespace-nowrap", retColorClass)}>
        {entry.return_pct > 0 ? "+" : ""}{entry.return_pct.toFixed(2)}%
      </div>
      <div className="px-4">
        <span className={resultBadgeClasses.classes}>
          <SFIcon name={resultBadgeClasses.icon} className="text-current text-sm" />
          {resultBadgeClasses.text}
        </span>
      </div>
    </motion.div>
  );
});

LedgerCardRow.displayName = "LedgerCardRow";

export default function HistoricalLedgerPage() {
  const [data, setData] = useState<{stats: LedgerStats, ledger: LedgerEntry[]} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_API_URL + "/api/ledger/performance", { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const kpiItems = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Win Rate", value: `${data.stats.win_rate}%`, color: getTextColorClass("emerald", "400") },
      { label: "Avg Return", value: `${data.stats.avg_return > 0 ? "+" : ""}${data.stats.avg_return.toFixed(1)}%`, color: data.stats.avg_return > 0 ? getTextColorClass("emerald", "400") : getTextColorClass("rose", "400") },
      { label: "Total Picks", value: data.stats.total_picks, color: getTextColorClass("cyan", "400") },
      { label: "Hits", value: data.stats.wins, color: getTextColorClass("emerald", "400") },
      { label: "Misses", value: data.stats.losses, color: getTextColorClass("rose", "400") },
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopNav title="HISTORICAL LEDGER" icon="list.bullet.clipboard.fill" />
        <div className="pt-[72px] pb-12 px-safe-area mx-auto max-w-[1400px] w-full mt-12 animate-pulse">Loading Ledger...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopNav title="HISTORICAL LEDGER" icon="list.bullet.clipboard.fill" />

      <motion.div
        initial="initial"
        animate="animate"
        variants={pageTransitionVariants}
        className="pt-[72px] pb-12 px-safe-area mx-auto max-w-[1400px] w-full relative z-[1]"
      >
        <div className="mb-8 pt-6">
          <h1 className={cn("text-4xl font-extrabold flex items-center gap-3 mb-2 text-foreground", `tracking-[${TYPOGRAPHY_LETTER_SPACING_HEADING}]`)}>
            <SFIcon name="list.bullet.clipboard.fill" className="text-cyan-400" /> Historical Performance Ledger
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
            The honest, unvarnished track record of HEADSTART's #1 weekly top picks. Transparent accountability for every signal generated by the quant engine.
          </p>
        </div>

        {kpiItems.length > 0 && <KPIStrip className="mb-8" items={kpiItems} />}

        <AppleCard className={cn("overflow-hidden p-0", CARD_BORDER_RADIUS)}>
          <div className={cn("py-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4", CARD_X_PADDING)}>
            <h3 className={cn("text-base font-bold uppercase text-muted-foreground", `tracking-[${TYPOGRAPHY_LETTER_SPACING_UPPERCASE}]`)}>
              Track Record <span className="font-normal text-slate-500">— {data?.ledger.length || 0} picks</span>
            </h3>
          </div>

          <div className="horizontal-scroll-on-mobile max-h-[800px] overflow-y-auto custom-scrollbar relative z-[1]">
            <div className={cn(
                "grid items-center sticky top-0 z-[Z_INDICES.stickyHeader] bg-card/80 glass-subtle backdrop-blur-md py-4 border-b border-white/10",
                RECEIPT_TABLE_GRID_COLS,
                CARD_X_PADDING
            )}>
              {["#", "Week", "Date Picked", "Top Pick", "Entry Price", "Current Price", "Return", "Result"].map((h, idx) => (
                  <div
                    key={h}
                    className={cn(
                      "text-left font-semibold text-sm uppercase text-muted-foreground whitespace-nowrap",
                      `tracking-[${TYPOGRAPHY_LETTER_SPACING_UPPERCASE}]`
                    )}
                  >
                    {h}
                  </div>
              ))}
            </div>

            <div className={cn("py-2", CARD_X_PADDING)}>
              <AnimatePresence>
                {data?.ledger.map((entry, i) => (
                  <LedgerCardRow key={`${entry.date}-${entry.ticker}`} entry={entry} index={i} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </AppleCard>
      </motion.div>
    </div>
  );
}
