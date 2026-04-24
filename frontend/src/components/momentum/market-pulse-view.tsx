"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { DashboardData, Signal } from "@/types/momentum";
import { KPIStrip } from "@/components/momentum/kpi-strip";
import { QuoteRotator } from "@/components/momentum/quote-rotator";
import { DataReveal, CardReveal } from "@/components/ui/data-reveal";
import { SFIcon } from "@/components/ui/sf-icon";
import { Card } from "@/components/ui/card";
import { AppleButton } from "@/components/ui/apple-button";
import { ResearchCardGrid } from "@/components/momentum/research-card";
import { DailyMovers } from "@/components/momentum/daily-movers";
import {
  SPRING_TRANSITION_PROPS,
  LIST_ITEM_HOVER_MOTION_PROPS,
  TRACKING_HEADING_CLASS,
} from "@/lib/constants";
import { cn, type PaletteColorKey } from "@/lib/utils";

// ── Lazy-loaded heavy components ──
const LazyLeaderboard = dynamic(() => import('@/components/momentum/leaderboard').then(m => ({ default: m.Leaderboard })), { ssr: false });
const LazyTopSignals = dynamic(() => import('@/components/momentum/top-signals').then(m => ({ default: m.TopSignals })), { ssr: false });
const LazyMiniSignalList = dynamic(() => import('@/components/momentum/mini-signal-list').then(m => ({ default: m.MiniSignalList })), { ssr: false });
const LazyTickerSearch = dynamic(() => import('@/components/momentum/ticker-search').then(m => ({ default: m.TickerSearch })), { ssr: false });
const LazySectorHeatmap = dynamic(() => import('@/components/momentum/sector-heatmap').then(m => ({ default: m.SectorHeatmap })), { ssr: false });
const LazyAgentBriefing = dynamic(() => import('@/components/momentum/agent-briefing').then(m => ({ default: m.AgentBriefing })), { ssr: false });
const LazyNewsletterSignup = dynamic(() => import('@/components/momentum/newsletter-signup').then(m => ({ default: m.NewsletterSignup })), { ssr: false });
const LazyWeeklyMomentumPanel = dynamic(() => import('@/components/momentum/weekly-momentum-panel').then(m => ({ default: m.WeeklyMomentumPanel })), { ssr: false });

// ── Skeleton placeholders ──
function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl bg-card animate-pulse" />
      ))}
    </div>
  );
}

function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-white/[0.02] animate-pulse" />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ── Educational Context Components ──
// ═══════════════════════════════════════════════════

function SectionHeader({
  icon,
  iconColor,
  title,
  description,
}: {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-[18px] md:text-[22px] font-serif text-[#f5f2ed] flex items-center gap-2.5 mb-1.5">
        <span style={{ color: iconColor }}>{icon}</span> {title}
      </h2>
      <p className="text-[13px] text-[#8a8a8a] leading-relaxed max-w-2xl">
        {description}
      </p>
    </div>
  );
}

function PulseContext({ data }: { data: DashboardData }) {
  const total = data.signals?.length || 1;
  const bullishCount = data.signals?.filter(s => s.composite > 0).length || 0;
  const bearishCount = total - bullishCount;
  const bullishRatio = bullishCount / total;

  let sentimentStr = "Neutral / Mixed";
  let color = "#FFD600";
  let description = "The market is showing mixed signals — no clear directional bias. Stick to high-conviction setups and avoid overcommitting.";
  if (bullishRatio > 0.65) {
    sentimentStr = "Bullish";
    color = "#00FF66";
    description = "Broad bullish participation is detected. The majority of scanned stocks are showing positive momentum, favoring long-biased strategies.";
  } else if (bullishRatio > 0.5) {
    sentimentStr = "Leaning Bullish";
    color = "#00FF66";
    description = "A slight bullish edge is forming. More stocks are gaining momentum than losing it, but conviction isn't uniform across sectors.";
  } else if (bullishRatio < 0.35) {
    sentimentStr = "Bearish";
    color = "#FF3333";
    description = "The majority of stocks show weakening momentum. Defensive positioning and short-biased or hedged strategies are worth considering.";
  }

  const freshCount = data.fresh_momentum?.length || 0;
  const exhaustingCount = data.exhausting_momentum?.length || 0;

  return (
    <div className="p-6 md:p-7 rounded-[16px] h-full flex flex-col" style={{ background: "#1a1a1a", border: "1px solid #2A2A2A" }}>
      <h3 className="text-[12px] font-mono-data uppercase tracking-[0.1em] text-[#e2b857] mb-4">
        Market Breadth Summary
      </h3>
      <p className="text-[16px] md:text-[18px] text-[#E8E8E8] font-serif leading-[1.65] mb-5 flex-1">
        Across <strong className="text-[#f5f2ed]">{total}</strong> scanned stocks, the current bias is{" "}
        <strong style={{ color }}>{sentimentStr}</strong> with{" "}
        <strong className="text-[#f5f2ed]">{bullishCount}</strong> bullish vs{" "}
        <strong className="text-[#f5f2ed]">{bearishCount}</strong> bearish.{" "}
        {description}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#111111] rounded-xl p-4 border border-[#2A2A2A]">
          <span className="text-[10px] font-mono-data text-[#8a8a8a] uppercase tracking-widest">Fresh Momentum</span>
          <div className="text-[28px] font-bold text-[#00FF66] font-mono-data leading-none mt-1">{freshCount}</div>
          <span className="text-[11px] text-[#6B6B6B]">New breakouts forming</span>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-[#2A2A2A]">
          <span className="text-[10px] font-mono-data text-[#8a8a8a] uppercase tracking-widest">Exhausting</span>
          <div className="text-[28px] font-bold text-[#FF3333] font-mono-data leading-none mt-1">{exhaustingCount}</div>
          <span className="text-[11px] text-[#6B6B6B]">Trends losing steam</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ── Main MarketPulseView Component ──
// ═══════════════════════════════════════════════════

interface MarketPulseViewProps {
  data: DashboardData;
  tierLoading: { summary: boolean; signals: boolean };
  pipelineConnected: boolean;
  onTickerSelect: (ticker: string) => void;
  onNavigate: (page: string) => void;
  onDataRefresh: () => void;
}

export function MarketPulseView({
  data,
  tierLoading,
  pipelineConnected,
  onTickerSelect,
  onNavigate,
  onDataRefresh,
}: MarketPulseViewProps) {
  // KPI strip items
  const kpiStripItems = useMemo(() => {
    if (!data?.summary) return [];
    let tierDist = data.summary.tier_distribution;

    if (!tierDist || Object.values(tierDist).every(v => !v)) {
      if (data.signals?.length) {
        const computed: Record<string, number> = {};
        for (const s of data.signals) {
          const tier = (s as any).conviction_tier;
          if (tier) computed[tier] = (computed[tier] || 0) + 1;
        }
        if (Object.keys(computed).length > 0) {
          tierDist = computed as any;
        }
      }
    }

    const td = tierDist ?? {};
    return [
      { label: "Universe", value: data.summary.total_screened, colorKey: "cyan" as PaletteColorKey },
      { label: "Ultra Conviction", value: td["Ultra Conviction"] ?? 0, colorKey: "amber" as PaletteColorKey },
      { label: "High Conviction", value: td["High Conviction"] ?? 0, colorKey: "emerald" as PaletteColorKey },
      { label: "Moderate", value: td["Moderate Conviction"] ?? 0, colorKey: "cyan" as PaletteColorKey },
      { label: "Low Conviction", value: td["Low Conviction"] ?? 0, colorKey: "slate" as PaletteColorKey },
      { label: "Contrarian", value: td["Contrarian"] ?? 0, colorKey: "rose" as PaletteColorKey },
    ];
  }, [data?.summary, data?.signals]);

  return (
    <div className="pt-4 md:pt-8 pb-12 max-w-7xl mx-auto space-y-6 font-sans">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[36px] md:text-[44px] font-serif text-[#f5f2ed] leading-[1.1] tracking-tight">
            Market <span style={{ color: "#00FF66", fontStyle: "italic" }}>Pulse</span>
          </h1>
          <p className="text-[#A0A0A0] text-[15px] mt-2 max-w-2xl">
            Deep quantitative scans, momentum lifecycle tracking, and sector regime analysis — the full picture behind every signal.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LazyTickerSearch
            onSelectTicker={onTickerSelect}
            onDataRefresh={onDataRefresh}
          />
          <div className="flex items-center gap-2 bg-[#111111] border border-[#2A2A2A] rounded-[6px] px-3 py-1.5 text-[10px] font-mono-data tracking-[0.1em] uppercase"
            style={{ color: pipelineConnected ? "#00FF66" : "#FF3333" }}
          >
            <div className="w-1.5 h-1.5 rounded-full ct-pulse" style={{ background: pipelineConnected ? "#00FF66" : "#FF3333" }} />
            {pipelineConnected ? "LIVE" : "OFFLINE"}
          </div>
        </div>
      </div>

      {/* ── Bento Grid: Context + Quote ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <PulseContext data={data} />
        </div>
        <div className="flex flex-col gap-4">
          {data.all_quotes?.length > 0 && (
            <Card className="flex-1 p-0 flex flex-col justify-center overflow-hidden border-[#2A2A2A] bg-[#111111]">
              <QuoteRotator quotes={data.all_quotes} compact={true} />
            </Card>
          )}
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <DataReveal
        loading={tierLoading.summary && kpiStripItems.length === 0}
        skeleton={<KPISkeleton />}
      >
        <KPIStrip className="" items={kpiStripItems} />
      </DataReveal>

      {/* ── Agent Briefing ── */}
      <div>
        <LazyAgentBriefing />
      </div>

      {/* ── Recent Wins ── */}
      <div className="pt-4 border-t border-[#2A2A2A]">
        <SectionHeader
          icon="◆"
          iconColor="#00FF66"
          title="Recent Wins"
          description="Highlighted successful alpha options calls from the past week."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-5 flex justify-between items-center transition-colors hover:border-[#00FF66]/40 cursor-default">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono-data text-2xl text-[#00FF66] font-bold tracking-tight">MXL</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00FF66]/10 text-[#00FF66] tracking-wider uppercase border border-[#00FF66]/20">WIN</span>
              </div>
              <div className="text-sm text-[#A0A0A0] leading-relaxed max-w-[220px]">4-system alignment (4/4 bullish). Momentum fading — tighten stops. Volume 2.3× above average.</div>
            </div>
            <div className="text-right flex flex-col justify-center h-full">
              <div className="font-mono-data text-[#00FF66] text-2xl font-bold tracking-tight">+84.8%</div>
              <div className="text-[10px] text-[#6B6B6B] uppercase tracking-[0.1em] mt-1 font-semibold">Peak Conf</div>
            </div>
          </div>
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-5 flex justify-between items-center transition-colors hover:border-[#00FF66]/40 cursor-default">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono-data text-2xl text-[#00FF66] font-bold tracking-tight">AMZN</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00FF66]/10 text-[#00FF66] tracking-wider uppercase border border-[#00FF66]/20">WIN</span>
              </div>
              <div className="text-sm text-[#A0A0A0] leading-relaxed max-w-[220px]">Strong alpha divergence compared to QQQ. Volatility contraction setup.</div>
            </div>
            <div className="text-right flex flex-col justify-center h-full">
              <div className="font-mono-data text-[#00FF66] text-2xl font-bold tracking-tight">+62.4%</div>
              <div className="text-[10px] text-[#6B6B6B] uppercase tracking-[0.1em] mt-1 font-semibold">Peak Conf</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Research Cards ── */}
      {(data.top_picks?.length > 0) && (
        <div className="pt-4 border-t border-[#2A2A2A]">
          <SectionHeader
            icon="◆"
            iconColor="#e2b857"
            title="Headstart Research"
            description="Highest conviction signals where multiple quantitative systems agree — trending regime, fresh momentum, and high probability all confirmed."
          />
          <ResearchCardGrid
            signals={data.top_picks || []}
            title=""
            subtitle=""
            maxCards={6}
            onViewChart={onTickerSelect}
            onViewDetail={onTickerSelect}
          />
        </div>
      )}

      {/* ── Daily Movers ── */}
      {data.signals?.length > 0 && (
        <div className="pt-4 border-t border-[#2A2A2A]">
          <SectionHeader
            icon="◆"
            iconColor="#FFD600"
            title="Daily Movers"
            description="Stocks with the largest single-day price moves. Big daily swings can indicate new trends forming or institutional accumulation/distribution in progress."
          />
          <DailyMovers signals={data.signals} maxItems={5} />
        </div>
      )}

      {/* ── Two-column layout: main content + weekly panel ── */}
      <div className="flex flex-col xl:flex-row gap-6 pt-4 border-t border-[#2A2A2A]">
        {/* Left: main Market Pulse content */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Leaderboard + Top Signals */}
          <div>
            <SectionHeader
              icon="◆"
              iconColor="#00FF66"
              title="Signal Leaderboard"
              description="Stocks ranked by their composite momentum score — a weighted blend of 4 independent quantitative systems. Higher scores = stronger multi-system agreement."
            />
            <DataReveal
              loading={tierLoading.signals && !data.signals?.length}
              skeleton={<div className="grid grid-cols-1 lg:grid-cols-2 gap-3"><SectionSkeleton rows={5} /><SectionSkeleton rows={5} /></div>}
              delay={100}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <LazyLeaderboard signals={data.signals} onSelectTicker={onTickerSelect} />
                <LazyTopSignals signals={data.signals} onSelectTicker={onTickerSelect} />
              </div>
            </DataReveal>
          </div>

          {/* Fresh Momentum + Exhausting Signals */}
          <div>
            <SectionHeader
              icon="◆"
              iconColor="#9f7aea"
              title="Momentum Lifecycle"
              description="Momentum has phases. 'Fresh' stocks are just beginning to trend — the ideal entry window. 'Exhausting' stocks are showing signs of trend fatigue — time to tighten stops or take profits."
            />
            <DataReveal
              loading={tierLoading.signals && !data.signals?.length}
              skeleton={<div className="grid grid-cols-1 lg:grid-cols-2 gap-3"><SectionSkeleton rows={3} /><SectionSkeleton rows={3} /></div>}
              delay={200}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <LazyMiniSignalList title="Fresh Momentum" icon="leaf.fill" signals={data.fresh_momentum || []} onSelectTicker={onTickerSelect} />
                <LazyMiniSignalList title="Exhausting Signals" icon="flame.fill" signals={data.exhausting_momentum || []} onSelectTicker={onTickerSelect} />
              </div>
            </DataReveal>
          </div>

          {/* Hidden Gems */}
          {(data.hidden_gems || []).length > 0 && (
            <div>
              <SectionHeader
                icon="◆"
                iconColor="#22d3ee"
                title="Hidden Gems — Underrated Picks"
                description="These stocks have strong quantitative scores AND high probability, but their price hasn't moved yet. The market hasn't priced in the momentum shift — this is where alpha hides."
              />
              <CardReveal loading={false} delay={300}>
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] text-[#8a8a8a]">
                      Composite + Probability strong, daily change minimal
                    </p>
                    <AppleButton variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300" onClick={() => onNavigate("hidden-alpha")} glowColor="cyan">
                      View All <span className="ml-1 text-sm font-semibold">→</span>
                    </AppleButton>
                  </div>
                  <div className="space-y-1">
                    {(data.hidden_gems || []).slice(0, 5).map((s: Signal, i: number) => (
                      <motion.div
                        key={s.ticker}
                        className="flex items-center justify-between py-3 cursor-pointer rounded-xl px-2 -mx-2 hover:bg-white/5"
                        onClick={() => onTickerSelect(s.ticker)}
                        whileHover={LIST_ITEM_HOVER_MOTION_PROPS}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING_TRANSITION_PROPS, delay: i * 0.06 }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-cyan-400 font-mono-data text-base w-14">{s.ticker}</span>
                          <span className="text-xs text-muted-foreground/80 max-w-[120px] truncate">{s.sector}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono-data text-sm font-semibold">{s.composite.toFixed(2)}</span>
                          <span className={cn("font-mono-data text-xs font-semibold", s.probability > 60 ? "text-emerald-400" : "text-amber-400")}>{s.probability}%</span>
                          <span className={cn("font-mono-data text-xs font-semibold", s.daily_change > 0 ? "text-emerald-400" : s.daily_change < 0 ? "text-rose-400" : "text-slate-400")}>{s.daily_change > 0 ? '+' : ''}{s.daily_change}%</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </CardReveal>
            </div>
          )}

          {/* Sector Regime Heatmap */}
          <div>
            <SectionHeader
              icon="◆"
              iconColor="#e2b857"
              title="Sector Regime Heatmap"
              description="Each sector is classified into a regime — 'Trending' (ride the wave), 'Mean-Reverting' (fade the extremes), or 'Choppy' (stay away). This helps you pick the right strategy for the right environment."
            />
            <CardReveal loading={!data.sector_regimes} delay={400}>
              <Card className="p-4">
                <LazySectorHeatmap sectors={data.sector_regimes} sentiment={data.sector_sentiment} />
              </Card>
            </CardReveal>
          </div>
        </div>

        {/* Right: Weekly Top Momentum Panel (sticky on desktop) */}
        <div className="xl:w-[320px] xl:shrink-0">
          <div className="xl:sticky xl:top-[90px] space-y-4">
            <LazyNewsletterSignup />
            <LazyWeeklyMomentumPanel onSelectTicker={onTickerSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}
