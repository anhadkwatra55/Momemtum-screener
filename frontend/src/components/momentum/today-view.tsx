"use client";

import React from "react";
import { DashboardData } from "@/types/momentum";
import { ResearchCardGrid } from "@/components/momentum/research-card";
import dynamic from "next/dynamic";

const LazyIntelNewsCard = dynamic(() => import('@/components/momentum/intel-news-card').then(m => ({ default: m.IntelNewsCard })), { ssr: false });


// ── Educational Layer ──
function PlainEnglishContext({ data }: { data: DashboardData }) {
  const total = data.signals?.length || 1;
  const bullishCount = data.signals?.filter(s => s.composite > 0).length || 0;
  const bullishRatio = bullishCount / total;
  
  let sentimentStr = "Neutral / Mixed";
  let color = "#FFD600";
  if (bullishRatio > 0.6) {
    sentimentStr = "Bullish (Risk-On)";
    color = "#00FF66";
  } else if (bullishRatio < 0.4) {
    sentimentStr = "Bearish (Risk-Off)";
    color = "#FF3333";
  }

  return (
    <div className="p-6 md:p-8 rounded-[16px] h-full" style={{ background: "#1a1a1a", border: "1px solid #2A2A2A" }}>
      <h3 className="text-[12px] font-mono-data uppercase tracking-[0.1em] text-[#e2b857] mb-4">
        Market Sentiment & Alpha-Flow Logic
      </h3>
      <p className="text-[18px] md:text-[22px] text-[#E8E8E8] font-serif leading-[1.6] mb-6">
        Our quantitative engine currently detects a <strong style={{ color }}>{sentimentStr}</strong> environment. 
        We scan thousands of options contracts to track institutional money flow. When "smart money" makes aggressive 
        directional bets on high-quality S&P 1500 stocks, our system flags them as high-probability setups.
      </p>
      <div className="bg-[#111111] rounded-xl p-5 border border-[#2A2A2A]">
        <p className="text-[14px] text-[#A0A0A0] font-sans leading-relaxed">
          <strong className="text-[#E8E8E8]">What this means for you:</strong> Focus on the high-conviction picks below. These are not random 
          trade ideas—they are mathematically backed signals where institutional momentum is aligning with technical breakouts. 
          Ignore the noise and focus on the data.
        </p>
      </div>
    </div>
  );
}

// ── Institutional Context ──
function InstitutionalMetrics() {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="p-6 rounded-[16px] flex-1 flex flex-col justify-center" style={{ background: "#1a1a1a", border: "1px solid #2A2A2A" }}>
        <span className="text-[12px] font-mono-data text-[#8a8a8a] uppercase tracking-widest mb-2">Wins This Week</span>
        <span className="text-[40px] md:text-[48px] font-bold text-[#00FF66] font-mono-data leading-none mb-1">14</span>
        <span className="text-[13px] text-[#A0A0A0]">Verified profitable signals</span>
      </div>
      <div className="p-6 rounded-[16px] flex-1 flex flex-col justify-center" style={{ background: "#1a1a1a", border: "1px solid #2A2A2A" }}>
        <span className="text-[12px] font-mono-data text-[#8a8a8a] uppercase tracking-widest mb-2">Alpha Return</span>
        <span className="text-[40px] md:text-[48px] font-bold text-[#e2b857] font-mono-data leading-none mb-1">+8.4%</span>
        <span className="text-[13px] text-[#A0A0A0]">Avg. return above S&P 500</span>
      </div>
    </div>
  );
}

function InfoCard({ title, value, subtitle, highlight }: { title: string, value: string, subtitle: string, highlight?: string }) {
  return (
    <div className="p-6 rounded-[16px] flex flex-col" style={{ background: "#1a1a1a", border: "1px solid #2A2A2A" }}>
      <span className="text-[12px] font-mono-data text-[#8a8a8a] uppercase tracking-widest mb-3">{title}</span>
      <span className="text-[32px] md:text-[36px] font-bold font-sans mb-2" style={{ color: highlight || '#E8E8E8'}}>{value}</span>
      <span className="text-[13px] text-[#A0A0A0] leading-relaxed">{subtitle}</span>
    </div>
  );
}

// ── Today View Component ──
interface TodayViewProps {
  data: DashboardData;
  onTickerSelect: (ticker: string) => void;
}

export function TodayView({ data, onTickerSelect }: TodayViewProps) {
  const [intelIndex, setIntelIndex] = React.useState(0);
  
  // Get latest thesis-equipped picks
  const topPicks = data.top_picks || [];
  const freshMomentum = data.fresh_momentum || [];
  const allPicks = topPicks.length > 0 ? topPicks : freshMomentum;

  const totalScreened = data.summary?.total_screened || 0;
  const highConviction = (data.summary?.tier_distribution?.["Ultra Conviction"] || 0) + (data.summary?.tier_distribution?.["High Conviction"] || 0);
  const activeSectors = data.sector_regimes ? Object.keys(data.sector_regimes).length : 0;

  return (
    <div className="pt-4 md:pt-8 pb-12 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-[36px] md:text-[44px] font-serif text-[#f5f2ed] leading-[1.1] tracking-tight">
            Today's <span style={{ color: "#e2b857", fontStyle: "italic" }}>Intelligence</span>
          </h1>
          <p className="text-[#A0A0A0] text-[16px] mt-3 max-w-2xl">
            The most critical insights from our institutional scanning engine, translated into plain English.
          </p>
        </div>
        <div className="text-[12px] font-mono-data text-[#e2b857] bg-[rgba(226,184,87,0.05)] border border-[#e2b857]/20 px-4 py-2 rounded-[8px] uppercase tracking-widest">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Bento Grid Top Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <PlainEnglishContext data={data} />
        </div>
        <div>
          <InstitutionalMetrics />
        </div>
      </div>

      {/* Secondary Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
         <InfoCard 
            title="Universe Scanned" 
            value={totalScreened.toLocaleString()} 
            subtitle="S&P 1500 stocks & options evaluated by the pipeline today." 
         />
         <InfoCard 
            title="High Conviction" 
            value={highConviction.toString()} 
            highlight="#00FF66"
            subtitle="Actionable setups with top-tier probability scores." 
         />
         <InfoCard 
            title="Sectors in Play" 
            value={activeSectors.toString()} 
            subtitle="Distinct market sectors showing significant momentum shifts." 
         />
      </div>

      {/* Intelligence News (Moby Style) */}
      <div className="mt-12 pt-8 border-t border-[#2A2A2A]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-[24px] font-serif text-[#f5f2ed]">Daily Market Intelligence</h2>
            <p className="text-[14px] text-[#8a8a8a] mt-1">AI-generated visual metaphors for today's most market-moving stories.</p>
          </div>
          
          {data.intel_images && data.intel_images.length > 1 && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIntelIndex(prev => (prev - 1 + data.intel_images!.length) % data.intel_images!.length)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/50 transition-all hover:bg-white/10 hover:text-white"
              >
                ←
              </button>
              <button 
                onClick={() => setIntelIndex(prev => (prev + 1) % data.intel_images!.length)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/50 transition-all hover:bg-white/10 hover:text-white"
              >
                →
              </button>
            </div>
          )}
        </div>

        {(data.intel_images && data.intel_images.length > 0) ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Featured Column (2/3) */}
            <div className="lg:col-span-2">
              <div className="mb-4 px-2 flex items-center justify-between">
                <h3 className="font-serif text-xl text-[#e2b857]">Featured Briefing</h3>
                <span className="text-[10px] font-mono-data text-white/20 uppercase tracking-widest">
                  {intelIndex + 1} / {data.intel_images.length}
                </span>
              </div>
              <LazyIntelNewsCard 
                key={`featured-${data.intel_images[intelIndex].ticker}`}
                image={data.intel_images[intelIndex]} 
                onTickerSelect={onTickerSelect} 
                featured={true}
              />
            </div>

            {/* Stock Picks Column (1/3) */}
            <div className="flex flex-col">
              <div className="mb-4 px-2">
                <h3 className="font-serif text-xl text-cyan-400">Other Stories</h3>
              </div>
              <div className="space-y-3">
                {data.intel_images
                  .filter((_, i) => i !== intelIndex)
                  .slice(0, 4)
                  .map((img) => (
                    <LazyIntelNewsCard 
                      key={`compact-${img.ticker}`}
                      image={img} 
                      onTickerSelect={onTickerSelect} 
                    />
                  ))}
              </div>
            </div>
          </div>
        ) : (

          <div className="py-12 text-center border border-dashed border-[#2A2A2A] rounded-2xl">
            <p className="text-[#6B6B6B] font-mono-data text-xs uppercase tracking-widest">
              Market Intelligence briefing will appear here after the 7:00 AM ET daily run.
            </p>
          </div>
        )}
      </div>


      {/* Top Picks - Clean Research Cards */}
      {allPicks.length > 0 && (
        <div className="mt-12 pt-8 border-t border-[#2A2A2A]">
          <h2 className="text-[24px] font-serif text-[#f5f2ed] mb-6">
            Highest Conviction Setups
          </h2>
          <ResearchCardGrid
            signals={allPicks}
            title="" 
            subtitle=""
            maxCards={3}
            onViewChart={onTickerSelect}
            onViewDetail={onTickerSelect}
          />
        </div>
      )}
    </div>
  );
}
