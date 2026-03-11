"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import React, { useMemo, useCallback } from "react";

import { TopNav } from "@/components/layout/topnav";
import { KPIStrip } from "@/components/momentum/kpi-strip";
import { SectorHeatmap } from "@/components/momentum/sector-heatmap";
import { QuoteRotator } from "@/components/momentum/quote-rotator";
import { SentimentBadge } from "@/components/momentum/sentiment-badge";
import { AppleCard } from "@/components/ui/apple-card";
import { AppleButton } from "@/components/ui/apple-button";
import { SFIcon } from "@/components/ui/SFIcon"; // Using the centralized SFIcon component
import { useSignals } from "@/hooks/use-signals";
import {
  COLORS,
  ROUTES,
  SIDEBAR_NAV,
  TOP_SIGNALS_LIMIT,
  HIGH_CONFIDENCE_THRESHOLD,
  PAGE_TRANSITION_DURATION,
  SPRING_TRANSITION,
  STAGGER_CHILDREN_DELAY,
  INITIAL_STAGGER_DELAY,
  HOVER_Y_LIFT,
  Z_INDEX_STICKY_HEADER,
  SHADOW_STICKY_HEADER,
  TEXT_SHADOW_CYAN_GRADIENT,
  SHADOW_GLOW_CYAN,
} from "@/lib/constants";
import { Signal } from "@/types/momentum";
import { cn, getBackgroundColorClass, getTextColorClass, type PaletteColorKey } from "@/lib/utils";

// ── Framer Motion Animations ──
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: STAGGER_CHILDREN_DELAY,
      delayChildren: INITIAL_STAGGER_DELAY,
    },
  },
};

const fadeInTranslateY = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: SPRING_TRANSITION,
  },
};

const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: PAGE_TRANSITION_DURATION, ease: [0.33, 1, 0.68, 1] } },
  exit: { opacity: 0, y: -20, transition: { duration: PAGE_TRANSITION_DURATION, ease: [0.33, 1, 0.68, 1] } },
};

// ── Memoized Table Header ──
const tableHeaders = [
  "Ticker", "Sentiment", "Composite", "Confidence", "Δ Day", "20D", "Price", "Sector"
];

// Define column widths for consistency and desktop table layout
const columnWidths = [
  "w-[16%]", // Ticker
  "w-[12%]", // Sentiment
  "w-[10%]", // Composite
  "w-[10%]", // Confidence
  "w-[10%]", // Δ Day
  "w-[10%]", // 20D
  "w-[12%]", // Price
  "w-[20%]", // Sector
];

// ── Local Momentum Phase Badge Component (for "Fresh") ──
interface MomentumPhaseBadgeProps {
  phase: string;
  icon: string; // Now expects SF Symbol name
  className?: string;
}

const MomentumPhaseBadge = React.memo(({ phase, icon, className }: MomentumPhaseBadgeProps) => {
  const bgColor = getBackgroundColorClass("emerald", "500", "12");
  const textColor = getTextColorClass("emerald", "400");

  return (
    <span className={cn(
      "text-xs px-3 py-1.5 rounded-2xl font-bold tracking-[0.1em] font-inter",
      bgColor,
      textColor,
      className
    )}>
      <SFIcon icon={icon} size={14} className="mr-1" />
      {phase.toUpperCase()}
    </span>
  );
});
MomentumPhaseBadge.displayName = "MomentumPhaseBadge";

// ── Live Signal Table Row Component ──
interface SignalTableRowProps {
  signal: Signal;
  onClick: (ticker: string) => void;
  index: number; // For staggered animation
}

const SignalTableRow = React.memo(({ signal, onClick, index }: SignalTableRowProps) => {
  const textColorClass = useCallback((value: number, threshold?: number) => {
    if (threshold !== undefined) {
      return value > threshold ? getTextColorClass("emerald", "400") : getTextColorClass("amber", "400");
    }
    return value > 0 ? getTextColorClass("emerald", "400") : getTextColorClass("rose", "400");
  }, []);

  return (
    <motion.tr
      key={signal.ticker}
      className="relative z-10 cursor-pointer group"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }} // Animates out with opacity and y-transform
      whileHover={{
        y: HOVER_Y_LIFT,
        boxShadow: SHADOW_GLOW_CYAN,
        transition: SPRING_TRANSITION,
      }}
      transition={{
        ...SPRING_TRANSITION,
        delay: index * STAGGER_CHILDREN_DELAY * 0.8,
      }}
      onClick={() => onClick(signal.ticker)}
      aria-label={`View details for ${signal.ticker}`}
    >
      <td className="bg-card/60 p-4 rounded-l-xl">
        <div className="font-mono-data font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors">
          {signal.ticker}
        </div>
      </td>
      <td className="bg-card/60 p-4">
        <SentimentBadge sentiment={signal.sentiment} />
      </td>
      <td className="bg-card/60 p-4">
        <div className={cn("font-mono-data font-bold", textColorClass(signal.composite))}>
          {signal.composite.toFixed(2)}
        </div>
      </td>
      <td className="bg-card/60 p-4">
        <div className={cn("font-mono-data", textColorClass(signal.probability, HIGH_CONFIDENCE_THRESHOLD))}>
          {signal.probability}%
        </div>
      </td>
      <td className="bg-card/60 p-4">
        <div className={cn("font-mono-data", textColorClass(signal.daily_change))}>
          {signal.daily_change > 0 ? "+" : ""}{signal.daily_change.toFixed(2)}%
        </div>
      </td>
      <td className="bg-card/60 p-4">
        <div className={cn("font-mono-data", textColorClass(signal.return_20d))}>
          {signal.return_20d > 0 ? "+" : ""}{signal.return_20d.toFixed(2)}%
        </div>
      </td>
      <td className="bg-card/60 p-4">
        <div className="font-mono-data">${signal.price.toFixed(2)}</div>
      </td>
      <td className="bg-card/60 p-4 rounded-r-xl">
        <div className="text-muted-foreground/60 text-sm">{signal.sector}</div>
      </td>
    </motion.tr>
  );
});
SignalTableRow.displayName = "SignalTableRow";

// ── Skeleton Loader Component ──
const CommandCenterSkeleton = React.memo(() => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5 }}
    className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 md:p-6 lg:p-8"
  >
    <div className="relative">
      <div className="w-12 h-12 border-[2.5px] border-white/[0.05] border-t-cyan-400/80 rounded-full animate-spin" />
      <div className="absolute inset-0 w-12 h-12 border-[2.5px] border-transparent border-b-violet-400/30 rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
    </div>
    <p className="text-muted-foreground/60 text-sm font-medium tracking-wide font-inter">Loading Command Center…</p>

    {/* Custom Skeleton Preview */}
    <div className="w-full max-w-[1440px] mt-10 px-4 sm:px-6">
      <div className="h-6 w-1/3 mx-auto skeleton rounded-2xl mb-4" />
      <div className="h-4 w-1/4 mx-auto skeleton rounded-2xl mb-10" />

      {/* KPI Strip Skeleton */}
      <div className="bento-grid mb-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="apple-card skeleton h-16 sm:h-20 flex flex-col items-center justify-center rounded-2xl" />
        ))}
      </div>

      {/* Bento Grid Skeleton */}
      <div className="bento-grid">
        {/* Main Character / Quote Rotator */}
        <div className="skeleton apple-card h-[180px] sm:h-[200px] lg:col-span-2 rounded-2xl" />
        <div className="skeleton apple-card h-[180px] sm:h-[200px] lg:col-span-2 rounded-2xl" />

        {/* Platform Modules (4 cards) */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton apple-card h-[140px] rounded-2xl" />
        ))}

        {/* Market Heat (full width) */}
        <div className="skeleton apple-card h-[280px] col-span-full rounded-2xl" />

        {/* Live Signal Feed (full width table) */}
        <div className="skeleton apple-card col-span-full pt-5 pb-3 rounded-2xl">
          <div className="h-5 w-1/4 mb-4 mx-6 skeleton rounded-2xl" />
          <div className="horizontal-scroll-on-mobile">
            <div className="h-10 w-full bg-slate-800/20 mb-1 rounded-2xl" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 w-full mb-2 bg-slate-800/10 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  </motion.div>
));
CommandCenterSkeleton.displayName = "CommandCenterSkeleton";

// Define a type for platform module items for improved type safety
interface PlatformModuleItem {
  name: string;
  tag: string;
  color: PaletteColorKey;
  href: string;
  pageId: string;
  icon: string;
  desc: string;
  ariaLabel: string;
}

export default function CommandCenterPage() {
  const { data, loading, error } = useSignals();
  const router = useRouter();

  // ── Handlers ──
  const navigateToDashboard = useCallback(() => {
    router.push(ROUTES.dashboard);
  }, [router]);

  const navigateToReceipts = useCallback(() => {
    router.push(ROUTES.receipts);
  }, [router]);

  const navigateToDashboardWithTicker = useCallback((ticker: string) => {
    router.push(`${ROUTES.dashboard}?ticker=${ticker}`);
  }, [router]);

  const navigateToPlatformModule = useCallback((pageId: string, href: string) => {
    if (href === ROUTES.dashboard) {
      router.push(`${ROUTES.dashboard}?view=${pageId}`);
    } else {
      router.push(href);
    }
  }, [router]);

  // ── Memoized Data (MUST be before any conditional returns per React Rules of Hooks) ──
  const mainChar = useMemo(() => data?.signals?.[0], [data?.signals]);
  const freshCount = useMemo(() => data?.fresh_momentum?.length || 0, [data?.fresh_momentum]);
  const sectorCount = useMemo(() => data?.sector_regimes ? Object.keys(data.sector_regimes).length : 0, [data?.sector_regimes]);
  const topSignals = useMemo(() => data?.signals?.slice(0, TOP_SIGNALS_LIMIT) || [], [data?.signals]);

  const kpiStripItems = useMemo(() => {
    if (!data?.summary) return [];
    return [
      { label: "Universe", value: data.summary.total_screened, color: getTextColorClass("cyan", "400") },
      { label: "Bullish", value: data.summary.bullish, color: getTextColorClass("emerald", "400") },
      { label: "Bearish", value: data.summary.bearish, color: getTextColorClass("rose", "400") },
      { label: "Avg Confidence", value: `${data.summary.avg_probability}%`, color: getTextColorClass("amber", "400") },
      { label: "Top Bull", value: data.summary.top_bull, color: getTextColorClass("emerald", "400") },
      { label: "Top Bear", value: data.summary.top_bear, color: getTextColorClass("rose", "400") },
    ];
  }, [data?.summary]);

  const mainCharMetrics = useMemo(() => {
    if (!mainChar) return [];
    return [
      { l: "Composite", v: mainChar.composite.toFixed(2), c: mainChar.composite > 0 ? getTextColorClass("emerald", "400") : getTextColorClass("rose", "400") },
      { l: "Confidence", v: `${mainChar.probability}%`, c: mainChar.probability > HIGH_CONFIDENCE_THRESHOLD ? getTextColorClass("emerald", "400") : getTextColorClass("amber", "400") },
      { l: "Δ Day", v: `${mainChar.daily_change > 0 ? "+" : ""}${mainChar.daily_change.toFixed(2)}%`, c: mainChar.daily_change > 0 ? getTextColorClass("emerald", "400") : getTextColorClass("rose", "400") },
      { l: "20D", v: `${mainChar.return_20d > 0 ? "+" : ""}${mainChar.return_20d.toFixed(2)}%`, c: mainChar.return_20d > 0 ? getTextColorClass("emerald", "400") : getTextColorClass("rose", "400") },
    ];
  }, [mainChar]);

  const platformModules: PlatformModuleItem[] = useMemo(() => {
    if (!data?.summary) return [];
    const findIcon = (pageId: string) => SIDEBAR_NAV.find(item => item.pageId === pageId)?.icon || "diamond.fill";

    return [
      { name: "Intelligence", tag: "Core", color: "cyan", href: ROUTES.dashboard, pageId: "intelligence", icon: findIcon("intelligence"), desc: `${data.summary.bullish} Bullish · ${data.summary.bearish} Bearish`, ariaLabel: "Open Intelligence Dashboard" },
      { name: "Fresh Momentum", tag: "Screener", color: "cyan", href: ROUTES.dashboard, pageId: "fresh", icon: findIcon("fresh"), desc: `${freshCount} Fresh Signals`, ariaLabel: "View Fresh Momentum Signals" },
      { name: "Sector Intel", tag: "Intel", color: "cyan", href: ROUTES.dashboard, pageId: "sector-intel", icon: findIcon("sector-intel"), desc: `${sectorCount} Sectors Tracked`, ariaLabel: "Explore Sector Intelligence" },
      { name: "Receipts", tag: "History", color: "violet", href: ROUTES.receipts, pageId: "receipts", icon: findIcon("receipts"), desc: "Performance Tracking", ariaLabel: "View Receipts Ledger" },
    ];
  }, [data?.summary, freshCount, sectorCount]);

  // ── Loading States (after all hooks) ──
  if (loading) {
    return <CommandCenterSkeleton />;
  }

  // ── Premium Error State UI (after all hooks) ──
  if (error || !data) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="error-state-page"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageTransition}
          className="min-h-screen flex items-center justify-center p-4 md:p-6 lg:p-8"
        >
          <AppleCard className="max-w-md w-full p-8 text-center flex flex-col items-center">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, ...SPRING_TRANSITION }}>
              <SFIcon icon="exclamationmark.triangle.fill" size={48} className="text-rose-500 mb-4 animate-pulse" />
            </motion.div>
            <h2 className="text-3xl font-bold text-rose-400 mb-3 tracking-tight font-inter">
              System Offline
            </h2>
            <p className="text-muted-foreground/70 mb-6 max-w-sm text-base leading-relaxed font-inter">
              We couldn&apos;t load the Command Center data. {typeof error === 'string' ? error : error?.message || "No data available."}
            </p>
            <p className="text-muted-foreground/50 text-sm mb-8 font-light font-inter">
              Please ensure the backend server is running and accessible (port 8060).
            </p>
            <AppleButton variant="primary" size="lg" onClick={() => window.location.reload()} className="w-full sm:w-auto">
              <SFIcon icon="arrow.clockwise" size={18} className="mr-2" /> Retry Connection
            </AppleButton>
          </AppleCard>
        </motion.div>
      </AnimatePresence>
    );
  }


  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="command-center-page"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageTransition}
        className="min-h-screen"
      >
        <TopNav title="COMMAND CENTER" icon="bolt.fill" />

        <div className="pt-[72px] pb-14 px-4 sm:px-6 max-w-[1440px] mx-auto relative z-[1]">

          {/* ── Hero ── */}
          <motion.section
            className="text-center mb-12 pt-4 font-inter"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_TRANSITION, delay: 0.05 }}
          >
            <div className="text-[0.75rem] uppercase tracking-[0.1em] text-muted-foreground/60 font-semibold mb-4">
              4-System Momentum · SQLite-Backed · Strategy Backtesting
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent mb-5 leading-tight shadow-text-cyan-gradient">
              Your Alpha Edge Starts Here
            </h1>
            <p className="text-muted-foreground/70 max-w-xl mx-auto text-base sm:text-lg leading-relaxed mb-8 font-light">
              Real-time momentum screening across <span className="font-mono-data font-bold text-cyan-400">{data.summary.total_screened}+</span> tickers with actionable trade strategies.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <AppleButton variant="primary" size="lg" onClick={navigateToDashboard}>
                Open Intelligence Dashboard
                <SFIcon icon="arrow.right" size={18} className="ml-2 inline-block transition-transform group-hover:translate-x-1 duration-200 ease-out" />
              </AppleButton>
              <AppleButton variant="secondary" size="lg" onClick={navigateToReceipts}>
                Receipts Ledger
              </AppleButton>
            </div>
          </motion.section>

          {/* ── KPI Strip ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_TRANSITION, delay: 0.15 }}
          >
            <KPIStrip className="mb-10" items={kpiStripItems} />
          </motion.div>

          {/* ═══ BENTO GRID ═══ */}
          <motion.div
            className="bento-grid mb-10"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {/* Main Character — 2 col */}
            {mainChar && (
              <motion.div variants={fadeInTranslateY} className="lg:col-span-2">
                <AppleCard interactive={true} glowColor={COLORS.cyan} className="h-full cursor-pointer flex flex-col justify-between" onClick={() => navigateToDashboardWithTicker(mainChar.ticker)} aria-label={`View details for ${mainChar.ticker}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-2 font-inter">
                      <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground/60 font-bold"><SFIcon icon="chess.piece.queen.fill" size={14} className="mr-1 inline-block" /> Main Character</span>
                      <SentimentBadge sentiment={mainChar.sentiment} />
                      {mainChar.momentum_phase === "Fresh" && (
                        <MomentumPhaseBadge phase="Fresh" icon="leaf.fill" />
                      )}
                    </div>
                    <div className="flex flex-wrap items-baseline gap-4 mt-2 mb-4">
                      <div className="font-mono-data text-4xl font-extrabold text-cyan-400 tracking-tight shadow-text-cyan-gradient">
                        {mainChar.ticker}
                      </div>
                      <div className="font-mono-data text-2xl font-medium text-foreground/90">${mainChar.price.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="flex gap-4 sm:gap-6 font-inter text-sm flex-wrap pt-4 mt-4">
                    {mainCharMetrics.map((m) => (
                      <div key={m.l}>
                        <div className="text-xs text-muted-foreground/50 uppercase tracking-[0.1em] font-medium mb-1">{m.l}</div>
                        <div className={cn("font-mono-data font-bold text-base sm:text-lg", m.c)}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </AppleCard>
              </motion.div>
            )}

            {/* Quote Rotator — 2 col (mobile, tablet), stacked on lg */}
            {data.all_quotes?.length > 0 && (
              <motion.div variants={fadeInTranslateY} className="lg:col-span-2">
                <AppleCard interactive={false} padded={false} className="h-full flex items-center justify-center overflow-hidden">
                  <div className="w-full h-full">
                    <QuoteRotator quotes={data.all_quotes} />
                  </div>
                </AppleCard>
              </motion.div>
            )}

            {/* Platform Modules — 4 cards */}
            {platformModules.map((mod: PlatformModuleItem) => (
              <motion.div key={mod.name} variants={fadeInTranslateY}>
                <Link href={mod.href === ROUTES.dashboard ? `${mod.href}?view=${mod.pageId}` : mod.href} className="block h-full" aria-label={mod.ariaLabel}>
                  <AppleCard glowColor={mod.color === "cyan" ? COLORS.cyan : COLORS.violet} className="h-full group flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <SFIcon icon={mod.icon} size={24} />
                        <span
                          className={cn(
                            "text-xs uppercase font-bold px-3 py-1.5 rounded-2xl tracking-[0.1em] font-inter",
                            getBackgroundColorClass(mod.color, "500", "12"),
                            getTextColorClass(mod.color, "400")
                          )}
                        >
                          {mod.tag}
                        </span>
                      </div>
                      <h3 className="font-semibold text-base text-foreground/90 mb-1 group-hover:text-foreground transition-colors tracking-tight font-inter">{mod.name}</h3>
                      <p className="text-sm text-muted-foreground/60 font-light font-inter">{mod.desc}</p>
                    </div>
                    {/* Subtle arrow on hover */}
                    <div className="mt-4 text-muted-foreground/40 text-lg group-hover:text-foreground/60 transition-colors duration-200">
                      <SFIcon icon="arrow.right" size={18} className="inline-block transition-transform group-hover:translate-x-1 duration-200 ease-out" />
                    </div>
                  </AppleCard>
                </Link>
              </motion.div>
            ))}

            {/* Market Heat — full width (4 col) */}
            <motion.div variants={fadeInTranslateY} className="col-span-full">
              <AppleCard interactive={false} className="overflow-hidden">
                <div className="flex items-center justify-between mb-5 px-0 font-inter">
                  <h2 className="text-xl font-bold tracking-[-0.01em] flex items-center gap-2">
                    <SFIcon icon="map.fill" size={20} /> Market Heat
                  </h2>
                  <span className="text-xs text-muted-foreground/50 uppercase tracking-[0.1em] font-medium">{sectorCount} sectors</span>
                </div>
                <SectorHeatmap
                  sectors={data.sector_regimes}
                  sentiment={data.sector_sentiment}
                />
              </AppleCard>
            </motion.div>

            {/* Live Signal Feed — full width (4 col) */}
            <motion.div variants={fadeInTranslateY} className="col-span-full">
              <AppleCard interactive={false} padded={false}>
                <div className="px-6 pt-5 pb-4 flex items-center justify-between font-inter">
                  <h2 className="text-xl font-bold tracking-[-0.01em] flex items-center gap-2">
                    <SFIcon icon="antenna.radiowaves.left.and.right" size={20} /> Live Signal Feed
                  </h2>
                  <span className="text-xs text-muted-foreground/50 uppercase tracking-[0.1em] font-medium">Top {topSignals.length}</span>
                </div>
                <div className="horizontal-scroll-on-mobile custom-scrollbar px-6 pb-6">
                  <table className="w-full text-left border-separate border-spacing-y-2 lg:border-spacing-y-0.5 min-w-[768px] lg:min-w-0">
                    <thead className={cn(
                      "sticky top-0 z-[Z_INDEX_STICKY_HEADER] bg-card/80 backdrop-blur-sm",
                      SHADOW_STICKY_HEADER // Applies subtle shadow for elevation
                    )}>
                      <tr className="rounded-xl overflow-hidden">
                        {tableHeaders.map((h, i) => (
                          <th
                            key={h}
                            className={cn(
                              "py-3.5 px-4 text-xs uppercase tracking-[0.1em] font-semibold text-muted-foreground/50 whitespace-nowrap bg-card",
                              i === 0 && "rounded-tl-xl",
                              i === tableHeaders.length - 1 && "rounded-tr-xl",
                              columnWidths[i]
                            )}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="mt-2">
                      <AnimatePresence initial={false}>
                        {topSignals.map((s, index) => (
                          <SignalTableRow
                            key={s.ticker}
                            signal={s}
                            onClick={navigateToDashboardWithTicker}
                            index={index}
                          />
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </AppleCard>
            </motion.div>
          </motion.div>

          {/* Footer tagline */}
          <div className="text-center py-6 font-inter">
            <p className="text-xs text-muted-foreground/30 uppercase tracking-[0.1em] font-medium">
              MOMENTUM · Built for Speed
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}