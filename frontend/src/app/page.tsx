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
import { SFIcon } from "@/components/ui/SFIcon";
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

// ── Animations ──
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: STAGGER_CHILDREN_DELAY, delayChildren: INITIAL_STAGGER_DELAY },
  },
};
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: SPRING_TRANSITION },
};
const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: PAGE_TRANSITION_DURATION, ease: [0.33, 1, 0.68, 1] as const } },
  exit: { opacity: 0, y: -20, transition: { duration: PAGE_TRANSITION_DURATION, ease: [0.33, 1, 0.68, 1] as const } },
};

// ── Skeleton ──
function CommandCenterSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 animate-pulse" />
        <div className="w-48 h-4 rounded-lg bg-muted/30 animate-pulse" />
        <div className="w-32 h-3 rounded-lg bg-muted/20 animate-pulse" />
      </div>
    </div>
  );
}

// ── Rating Badge ──
function RatingBadge({ sentiment }: { sentiment: string }) {
  const styles = {
    "Strong Bullish": "bg-emerald-500/15 text-emerald-400",
    "Bullish": "bg-lime-500/12 text-lime-400",
    "Neutral": "bg-slate-500/10 text-slate-400",
    "Bearish": "bg-orange-500/12 text-orange-400",
    "Strong Bearish": "bg-rose-500/15 text-rose-400",
  };
  return (
    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", styles[sentiment as keyof typeof styles] || styles.Neutral)}>
      {sentiment}
    </span>
  );
}

// ── Platform Feature Card ──
interface FeatureCardProps {
  icon: string;
  title: string;
  desc: string;
  tags: string[];
  href: string;
  color: PaletteColorKey;
  delay: number;
}

function FeatureCard({ icon, title, desc, tags, href, color, delay }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_TRANSITION, delay }}
    >
      <Link href={href} className="block h-full">
        <AppleCard glowColor={color} className="h-full group flex flex-col justify-between p-5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center">
                <SFIcon icon={icon} size={20} className="text-cyan-400" />
              </div>
              <SFIcon icon="arrow.right" size={16} className="text-muted-foreground/30 group-hover:text-foreground/60 transition-all group-hover:translate-x-1 duration-200" />
            </div>
            <h3 className="font-semibold text-base text-foreground/90 mb-1.5 group-hover:text-foreground transition-colors tracking-tight">{title}</h3>
            <p className="text-sm text-muted-foreground/60 font-light leading-relaxed mb-4">{desc}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(t => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-muted-foreground/50 font-medium uppercase tracking-wider">{t}</span>
            ))}
          </div>
        </AppleCard>
      </Link>
    </motion.div>
  );
}

// ── Main Page ──
export default function CommandCenter() {
  const router = useRouter();
  const { data, loading, error } = useSignals();

  const navigateToDashboard = useCallback(() => {
    router.push(`${ROUTES.dashboard}?view=intelligence`);
  }, [router]);
  const navigateToReceipts = useCallback(() => {
    router.push(ROUTES.receipts);
  }, [router]);
  const navigateToDashboardWithTicker = useCallback((ticker: string) => {
    router.push(`${ROUTES.dashboard}?view=ticker-detail&ticker=${ticker}`);
  }, [router]);
  const navigateToDashboardWithView = useCallback((view: string) => {
    router.push(`${ROUTES.dashboard}?view=${view}`);
  }, [router]);

  // ── Memoized data ──
  const bullishMomentum = useMemo(() => data?.bullish_momentum?.slice(0, 5) || [], [data?.bullish_momentum]);
  const topSignals = useMemo(() => data?.signals?.slice(0, 8) || [], [data?.signals]);
  const freshCount = useMemo(() => data?.fresh_momentum?.length || 0, [data?.fresh_momentum]);
  const sectorCount = useMemo(() => data?.sector_regimes ? Object.keys(data.sector_regimes).length : 0, [data?.sector_regimes]);
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

  if (loading) return <CommandCenterSkeleton />;

  if (error || !data) {
    return (
      <AnimatePresence mode="wait">
        <motion.div key="error" initial="initial" animate="animate" exit="exit" variants={pageTransition} className="min-h-screen flex items-center justify-center p-4">
          <AppleCard className="max-w-md w-full p-8 text-center flex flex-col items-center">
            <SFIcon icon="exclamationmark.triangle.fill" size={48} className="text-rose-500 mb-4 animate-pulse" />
            <h2 className="text-3xl font-bold text-rose-400 mb-3 tracking-tight">System Offline</h2>
            <p className="text-muted-foreground/70 mb-6 max-w-sm text-base leading-relaxed">
              {typeof error === 'string' ? error : error?.message || "No data available."}
            </p>
            <p className="text-muted-foreground/50 text-sm mb-8 font-light">Backend server must be running (port 8060).</p>
            <AppleButton variant="primary" size="lg" onClick={() => window.location.reload()}>
              <SFIcon icon="arrow.clockwise" size={18} className="mr-2" /> Retry Connection
            </AppleButton>
          </AppleCard>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div key="headstart-landing" initial="initial" animate="animate" exit="exit" variants={pageTransition} className="min-h-screen">
        <TopNav title="HEADSTART" icon="bolt.fill" />

        <div className="pt-[72px] pb-14 px-4 sm:px-6 max-w-[1440px] mx-auto relative z-[1]">

          {/* ═══ HERO ═══ */}
          <motion.section
            className="text-center mb-14 pt-8"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_TRANSITION, delay: 0.05 }}
          >
            <div className="text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground/50 font-semibold mb-5">
              4-System Momentum · Real-Time Screening · Strategy Backtesting
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.04em] mb-6 leading-[1.05]">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                HEADSTART
              </span>
              <span className="text-foreground/20 font-light ml-2 text-3xl sm:text-4xl lg:text-5xl align-middle">AI</span>
            </h1>
            <p className="text-muted-foreground/60 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed mb-8 font-light">
              Turns real-time market data into simple, actionable intelligence for stocks, ETFs, and AI-driven investments. Screening <span className="font-mono-data font-bold text-cyan-400">{data.summary.total_screened}+</span> tickers across momentum, fundamentals, and thematic strategies.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <AppleButton variant="primary" size="lg" onClick={navigateToDashboard}>
                Open Dashboard <SFIcon icon="arrow.right" size={18} className="ml-2 inline-block" />
              </AppleButton>
              <AppleButton variant="secondary" size="lg" onClick={navigateToReceipts}>
                View Track Record
              </AppleButton>
            </div>

            {/* Research Methodology Highlights */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
              {[
                { icon: "chart.line.uptrend.xyaxis", label: "4-System Ensemble", desc: "ADX/TRIX, Elder Impulse, Renko, and Heikin-Ashi/HMA scored independently then averaged" },
                { icon: "waveform.path.ecg", label: "Regime Classification", desc: "Every ticker classified as Trending, Mean-Reverting, or Choppy based on ADX + Stochastic analysis" },
                { icon: "percent", label: "Probability Engine", desc: "0–98% confidence from directional agreement across all 4 systems with 1.2x unanimity bonus" },
                { icon: "cylinder.fill", label: "Persisted Indicators", desc: "All data stored in 5 SQL tables — signals survive restarts, fast filtered queries" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-2.5 rounded-xl bg-white/[0.02] border border-white/[0.03] px-3.5 py-3">
                  <SFIcon icon={item.icon} size={14} className="text-cyan-400/50 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] font-semibold text-foreground/70 mb-0.5">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground/45 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* ═══ KPI STRIP ═══ */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_TRANSITION, delay: 0.15 }}>
            <KPIStrip className="mb-10" items={kpiStripItems} />
          </motion.div>

          {/* ═══ BULLISH MOMENTUM RIGHT NOW ═══ */}
          {bullishMomentum.length > 0 && (
            <motion.section
              className="mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_TRANSITION, delay: 0.2 }}
            >
              <AppleCard interactive={false} className="overflow-hidden">
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h2 className="text-lg font-bold tracking-tight">Stocks with Bullish Momentum Right Now</h2>
                  </div>
                  <AppleButton variant="ghost" size="sm" onClick={() => navigateToDashboardWithView("bullish-momentum")}>
                    View All <SFIcon icon="arrow.right" size={14} className="ml-1 inline-block" />
                  </AppleButton>
                </div>
                <p className="text-xs text-muted-foreground/50 mb-4 px-1">
                  Stocks with strong composite scores, positive daily action, trending regime, and high probability alignment.
                </p>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[600px]">
                    <thead>
                      <tr className="border-b border-white/5">
                        {["Ticker", "Sentiment", "Composite", "Probability", "Δ Day", "Price"].map(h => (
                          <th key={h} className="py-2.5 px-3 text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/40">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bullishMomentum.map((s: Signal, i: number) => (
                        <motion.tr
                          key={s.ticker}
                          className="border-b border-white/[0.02] hover:bg-white/[0.02] cursor-pointer transition-colors"
                          onClick={() => navigateToDashboardWithTicker(s.ticker)}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.25 + i * 0.05 }}
                        >
                          <td className="py-2.5 px-3 font-mono-data font-bold text-cyan-400 text-sm">{s.ticker}</td>
                          <td className="py-2.5 px-3"><RatingBadge sentiment={s.sentiment} /></td>
                          <td className={cn("py-2.5 px-3 font-mono-data text-sm font-semibold", s.composite > 0 ? "text-emerald-400" : "text-rose-400")}>{s.composite.toFixed(2)}</td>
                          <td className="py-2.5 px-3 font-mono-data text-sm text-amber-400">{s.probability}%</td>
                          <td className={cn("py-2.5 px-3 font-mono-data text-sm", s.daily_change > 0 ? "text-emerald-400" : "text-rose-400")}>{s.daily_change > 0 ? "+" : ""}{s.daily_change}%</td>
                          <td className="py-2.5 px-3 font-mono-data text-sm text-foreground/80">${s.price.toFixed(2)}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AppleCard>
            </motion.section>
          )}

          {/* ═══ PLATFORM FEATURES GRID ═══ */}
          <motion.section className="mb-10" variants={staggerContainer} initial="hidden" animate="show">
            <motion.div variants={fadeIn} className="text-center mb-6">
              <h2 className="text-2xl font-bold tracking-tight mb-2">Explore the Platform</h2>
              <p className="text-sm text-muted-foreground/50">Dedicated screeners for every edge</p>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureCard
                icon="chart.line.uptrend.xyaxis"
                title="Stock Screeners"
                desc={`${freshCount} fresh momentum signals across S&P 500 + NASDAQ 100 — stocks only, no ETFs.`}
                tags={["Momentum", "Stocks Only", "4-System"]}
                href={`${ROUTES.dashboard}?view=fresh`}
                color="cyan"
                delay={0.3}
              />
              <FeatureCard
                icon="chart.line.uptrend.rectangle.fill"
                title="ETF Screener"
                desc="Dedicated ETF screening — high-yield bonds, dividend equity, REITs, covered calls."
                tags={["ETFs Only", "Income", "Yield"]}
                href={`${ROUTES.dashboard}?view=etf-screener`}
                color="violet"
                delay={0.35}
              />
              <FeatureCard
                icon="brain.fill"
                title="AI Stocks"
                desc="Track NVDA, AMD, GOOGL, MSFT, META, PLTR and 25+ AI/ML/semiconductor plays."
                tags={["AI/ML", "Semiconductors", "Cloud"]}
                href={`${ROUTES.dashboard}?view=ai-stocks`}
                color="cyan"
                delay={0.4}
              />
              <FeatureCard
                icon="arrow.up.right.circle.fill"
                title="Bullish Momentum"
                desc="Stocks with comprehensive bullish technical alignment — MACD, RSI, Bollinger, volume."
                tags={["Momentum", "Bullish", "Volume"]}
                href={`${ROUTES.dashboard}?view=bullish-momentum`}
                color="emerald"
                delay={0.45}
              />
              <FeatureCard
                icon="chart.bar.doc.horizontal.fill"
                title="Volume Gappers"
                desc="High-volume movers with notable price gaps, above-average RVOL, and bullish action."
                tags={["Gaps", "Volume", "Breakouts"]}
                href={`${ROUTES.dashboard}?view=volume-gappers`}
                color="amber"
                delay={0.5}
              />
              <FeatureCard
                icon="briefcase.fill"
                title="Portfolio Intelligence"
                desc="Input your holdings. Get scored. Expose blind spots. Discover alpha rotations."
                tags={["Aura Score", "Alpha Alerts", "Rotation"]}
                href={`${ROUTES.dashboard}?view=portfolio-intel`}
                color="violet"
                delay={0.55}
              />
            </div>
          </motion.section>

          {/* ═══ MARKET HEAT ═══ */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_TRANSITION, delay: 0.6 }} className="mb-10">
            <AppleCard interactive={false} className="overflow-hidden">
              <div className="flex items-center justify-between mb-5 px-0">
                <h2 className="text-xl font-bold tracking-[-0.01em] flex items-center gap-2">
                  <SFIcon icon="map.fill" size={20} /> Market Heat
                </h2>
                <span className="text-xs text-muted-foreground/50 uppercase tracking-[0.1em] font-medium">{sectorCount} sectors</span>
              </div>
              <div className="flex items-start gap-2 mb-4 rounded-lg bg-white/[0.02] border border-white/[0.03] px-3.5 py-2.5">
                <SFIcon icon="info.circle.fill" size={12} className="text-violet-400/50 mt-0.5 shrink-0" />
                <p className="text-[10px] text-muted-foreground/45 leading-relaxed">
                  Each sector is classified into <span className="text-emerald-400/70 font-medium">Trending</span> (ADX ≥ 25, momentum strategies have edge), <span className="text-amber-400/70 font-medium">Mean-Reverting</span> (ADX 15–25, oscillator plays), or <span className="text-rose-400/70 font-medium">Choppy</span> (ADX &lt; 15, reduce exposure). Bull/Bear bars show sentiment distribution within each sector.
                </p>
              </div>
              <SectorHeatmap sectors={data.sector_regimes} sentiment={data.sector_sentiment} />
            </AppleCard>
          </motion.div>

          {/* ═══ LIVE SIGNAL FEED ═══ */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_TRANSITION, delay: 0.65 }} className="mb-10">
            <AppleCard interactive={false} padded={false}>
              <div className="px-6 pt-5 pb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-[-0.01em] flex items-center gap-2">
                  <SFIcon icon="antenna.radiowaves.left.and.right" size={20} /> Live Signal Feed
                </h2>
                <span className="text-xs text-muted-foreground/50 uppercase tracking-[0.1em] font-medium">Top {topSignals.length}</span>
              </div>
              <div className="px-6 pb-3">
                <div className="flex items-start gap-2 rounded-lg bg-white/[0.02] border border-white/[0.03] px-3.5 py-2.5">
                  <SFIcon icon="info.circle.fill" size={12} className="text-cyan-400/50 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-muted-foreground/45 leading-relaxed">
                    Ranked by composite score — the average of 4 independent indicator systems. <span className="text-foreground/40 font-medium">Confidence</span> reflects directional agreement: unanimous bullish/bearish alignment across all systems gets a 1.2x multiplier. Click any ticker for full analysis.
                  </p>
                </div>
              </div>
              <div className="horizontal-scroll-on-mobile custom-scrollbar px-6 pb-6">
                <table className="w-full text-left border-separate border-spacing-y-1 min-w-[700px]">
                  <thead>
                    <tr>
                      {["Ticker", "Sentiment", "Composite", "Confidence", "Δ Day", "Price", "Sector"].map(h => (
                        <th key={h} className="py-2.5 px-3 text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/40 bg-card">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topSignals.map((s: Signal, i: number) => (
                      <motion.tr
                        key={s.ticker}
                        className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                        onClick={() => navigateToDashboardWithTicker(s.ticker)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 + i * 0.04 }}
                      >
                        <td className="py-2 px-3 font-mono-data font-bold text-cyan-400 text-sm">{s.ticker}</td>
                        <td className="py-2 px-3"><SentimentBadge sentiment={s.sentiment} /></td>
                        <td className={cn("py-2 px-3 font-mono-data text-sm font-semibold", s.composite > 0 ? "text-emerald-400" : "text-rose-400")}>{s.composite.toFixed(2)}</td>
                        <td className={cn("py-2 px-3 font-mono-data text-sm", s.probability > HIGH_CONFIDENCE_THRESHOLD ? "text-emerald-400" : "text-amber-400")}>{s.probability}%</td>
                        <td className={cn("py-2 px-3 font-mono-data text-sm", s.daily_change > 0 ? "text-emerald-400" : "text-rose-400")}>{s.daily_change > 0 ? "+" : ""}{s.daily_change.toFixed(2)}%</td>
                        <td className="py-2 px-3 font-mono-data text-sm text-foreground/80">${s.price.toFixed(2)}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground/60">{s.sector}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AppleCard>
          </motion.div>

          {/* ═══ QUOTE ═══ */}
          {data.all_quotes?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_TRANSITION, delay: 0.75 }} className="mb-10">
              <AppleCard interactive={false} padded={false} className="overflow-hidden">
                <QuoteRotator quotes={data.all_quotes} />
              </AppleCard>
            </motion.div>
          )}

          {/* Footer */}
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground/25 uppercase tracking-[0.15em] font-medium">
              HEADSTART · headstart.ai · Built for Speed
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}