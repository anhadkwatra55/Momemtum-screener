"use client";

import React, { useState, useEffect, memo } from "react";
import { motion } from "framer-motion";
import { SFIcon } from "@/components/ui/sf-icon";
import { API_BASE } from "@/lib/constants";

interface InsiderBuy {
  ticker: string;
  company_name: string;
  sector: string;
  price: number;
  insider_score: number;
  total_value: number;
  total_shares: number;
  unique_insiders: number;
  transaction_count: number;
  avg_seniority: number;
  avg_recency: number;
  most_recent_date: string;
  most_recent_insider: string;
  most_recent_position: string;
}

interface InsiderBuyingProps {
  onSelectTicker: (ticker: string) => void;
}

export const InsiderBuying = memo(({ onSelectTicker }: InsiderBuyingProps) => {
  const [insiderData, setInsiderData] = useState<{ insider_buys?: InsiderBuy[] } | null>(null);
  const [insiderLoading, setInsiderLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInsiderLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/insider-buys?limit=20&lookback_days=180`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        setInsiderData(d);
        setInsiderLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load insider data");
        setInsiderLoading(false);
      });
  }, []);

  const buys = insiderData?.insider_buys || [];

  return (
    <>
      {/* Info banner */}
      <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500/[0.04] to-cyan-500/[0.04] border border-white/[0.04] px-4 py-3">
        <SFIcon icon="info.circle.fill" size={14} className="text-emerald-400/60 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground/60 leading-relaxed">
          <span className="text-foreground/70 font-medium">Insider Buying Signals</span> — Tracks SEC Form 4 filings where corporate insiders (CEO, CFO, Directors, 10%+ owners) purchase shares with their own money. Insider buying is one of the strongest alpha signals — insiders have asymmetric information about their company&apos;s future. Scored by: number of unique insiders buying, total $ value, seniority (CEO &gt; Director &gt; VP), and recency.
        </p>
      </div>

      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold tracking-[-0.01em] flex items-center gap-2">
          <SFIcon icon="person.badge.key.fill" size={20} /> Insider Buying Activity
        </h2>
        <span className="text-xs text-muted-foreground/50 uppercase tracking-[0.1em] font-medium">
          Last 180 days · {buys.length} stocks
        </span>
      </div>

      {insiderLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 text-muted-foreground/40">
          <SFIcon icon="exclamationmark.triangle.fill" size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Failed to load insider data: {error}</p>
          <p className="text-xs mt-1">Please try refreshing the page.</p>
        </div>
      ) : buys.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground/40">
          <SFIcon icon="person.badge.key.fill" size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Scanning insider transactions… This may take a minute on first load.</p>
          <p className="text-xs mt-1">The scanner checks 300 tickers against SEC Form 4 filings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {buys.map((buy, idx) => (
            <motion.div
              key={buy.ticker}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              className="rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-emerald-500/20 transition-all cursor-pointer p-4"
              onClick={() => onSelectTicker(buy.ticker)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-bold">
                    #{idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold">{buy.ticker}</span>
                      <span className="text-xs text-muted-foreground/50">{buy.company_name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-muted-foreground/50">{buy.sector}</span>
                      <span className="text-xs text-muted-foreground/40">${buy.price?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40">Score</span>
                    <span className={`text-lg font-bold ${buy.insider_score >= 70 ? 'text-emerald-400' : buy.insider_score >= 40 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {buy.insider_score?.toFixed(0)}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/40 mt-0.5">
                    {buy.unique_insiders} insider{buy.unique_insiders > 1 ? 's' : ''} · {buy.transaction_count} txn{buy.transaction_count > 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="rounded-lg bg-white/[0.02] px-2.5 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/30 mb-0.5">Total Value</div>
                  <div className="text-sm font-semibold text-emerald-400">
                    ${buy.total_value >= 1_000_000 ? `${(buy.total_value / 1_000_000).toFixed(1)}M` : buy.total_value >= 1000 ? `${(buy.total_value / 1000).toFixed(0)}K` : buy.total_value?.toFixed(0)}
                  </div>
                </div>
                <div className="rounded-lg bg-white/[0.02] px-2.5 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/30 mb-0.5">Shares</div>
                  <div className="text-sm font-semibold">{buy.total_shares?.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-white/[0.02] px-2.5 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/30 mb-0.5">Seniority</div>
                  <div className="text-sm font-semibold text-violet-400">{buy.avg_seniority?.toFixed(1)}x</div>
                </div>
                <div className="rounded-lg bg-white/[0.02] px-2.5 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/30 mb-0.5">Most Recent</div>
                  <div className="text-sm font-semibold text-cyan-400">{buy.most_recent_date}</div>
                </div>
              </div>

              {/* Latest insider */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                <SFIcon icon="person.badge.key.fill" size={11} className="text-emerald-400/40" />
                <span className="font-medium text-foreground/60">{buy.most_recent_insider}</span>
                <span className="text-muted-foreground/30">·</span>
                <span>{buy.most_recent_position}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
});

InsiderBuying.displayName = "InsiderBuying";
