"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlphaContractModal } from "./alpha-contract-modal";
import { 
  COLORS, 
  SPRING_TRANSITION_PROPS, 
  MOTION_VARIANTS, 
  TRACKING_HEADING_CLASS,
  INTERACTIVE_CARD_SHADOW_GLOW
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SFIcon } from "@/components/ui/sf-icon";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8060";
import { getAuthHeaders } from "@/services/api";

interface AlphaCall {
  ticker: string; stock_price: number; strike: number; expiration: string;
  dte: number; bid: number; ask: number; mid_price: number; delta: number;
  pop: number; vol_edge: number; breakeven_pct: number; open_interest: number;
  volume: number; implied_volatility: number; spread_pct: number;
  quant_score: number; moneyness: string; strategy_category?: string;
  option_type?: 'call' | 'put';
}

interface AlphaCallsData {
  calls: AlphaCall[];
  meta: { 
    universe_source: string; universe_size: number; tickers_scanned: number; 
    contracts_found: number; tickers_with_calls: number; errors: number; 
    partial?: boolean; scan_time_seconds?: number; warming_up?: boolean; 
    message?: string; filters: Record<string, string>; 
  };
  timestamp: string;
  refresh_started?: boolean;
}

/* ── Tokens ── */
const T = {
  bg: "#0d0d0d", card: "#1a1a1a", cardHover: "#222222", surface: "#222222",
  border: "#2d2d2d", borderLight: "#363636",
  text: "#e0e0e0", textSec: "#a0a0a0", textMuted: "#707070", textDim: "#505050",
  gold: COLORS.gold, goldDim: "rgba(226,184,87,0.12)",
  purple: COLORS.purple, purpleDim: "rgba(159,122,234,0.10)",
  green: COLORS.green, greenDim: "rgba(74,222,128,0.10)",
  red: COLORS.red, redDim: "rgba(224,82,82,0.10)",
  cyan: COLORS.cyan, cyanDim: "rgba(34,211,238,0.08)",
};

/* ── Confidence Donut ── */
function Donut({ score, size = 36 }: { score: number; size?: number }) {
  const r = (size - 5) / 2, circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, score) / 100) * circ;
  const color = score >= 75 ? T.green : score >= 50 ? T.gold : score >= 30 ? T.gold : T.red;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.surface} strokeWidth="2.5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="2.5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color }}>{Math.round(score)}</span>
    </div>
  );
}

/* ── Human-readable time ago ── */
function timeAgo(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) return "just now";
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

/* ════════════════════════════════════ */
interface Props { onTickerSelect?: (ticker: string) => void; }

interface TickerGroup {
  ticker: string; price: number; best: AlphaCall; total: number;
  expiries: { exp: string; dte: number; contracts: AlphaCall[] }[];
  calls: AlphaCall[];
}

const STRATEGY_LABELS: Record<string, { label: string; tag: string; color: string }> = {
  "": { label: "All Intelligence", tag: "ALL", color: T.textMuted },
  unusually_bullish: { label: "Unusually Bullish", tag: "BULL", color: T.green },
  unusually_bearish: { label: "Unusually Bearish", tag: "BEAR", color: T.red },
  conviction_calls: { label: "Conviction Calls", tag: "CONV", color: T.gold },
  conviction_puts: { label: "Conviction Puts", tag: "CONV", color: T.purple },
  leaps: { label: "LEAPS", tag: "LEAPS", color: T.cyan },
  put_sells: { label: "Put Sells", tag: "INCOME", color: T.green },
  cheap_calls: { label: "Cheap Calls", tag: "CHEAP", color: T.gold },
  swing: { label: "Swing", tag: "SWING", color: T.gold },
};

export function AlphaCallsBlotter({ onTickerSelect }: Props) {
  const [data, setData] = useState<AlphaCallsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [selected, setSelected] = useState<AlphaCall | null>(null);
  const [modalCall, setModalCall] = useState<AlphaCall | null>(null);
  const [universe, setUniverse] = useState<"sp500" | "nasdaq100" | "both">("sp500");
  const [refreshing, setRefreshing] = useState(false);
  const [scanElapsed, setScanElapsed] = useState<number | null>(null);
  
  // ── New Filters ──
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [moneynessFilter, setMoneynessFilter] = useState<string>("All"); // ITM, ATM, OTM
  const [dteFilter, setDteFilter] = useState<string>("All"); // Weeklies, Swing, Long, LEAPS
  const [highConvictionOnly, setHighConvictionOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"quant_score" | "open_interest">("quant_score");

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fetch data ── */
  const fetchData = useCallback(async (refresh = false, retryCount = 0) => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
    if (!refresh) { setLoading(true); }
    setError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    try {
      const params = new URLSearchParams({ 
        limit: "500", // Always scan full range for institutional feel
        sort_by: "quant_score", 
        universe, 
        ...(refresh && { refresh: "true" }) 
      });
      const res = await fetch(`${API_URL}/api/screener/alpha-calls?${params}`, { signal: controller.signal, headers: getAuthHeaders() });
      clearTimeout(timer);
      const result = await res.json();

      if (res.status === 202 || result.meta?.warming_up) {
        pollRef.current = setTimeout(() => fetchData(false, 0), 10_000);
        return;
      }
      if (!res.ok) throw new Error(`Server error (HTTP ${res.status})`);
      if (result.error) throw new Error(result.error);

      setData(result);
      setError(null);
      setLoading(false);

      if (result.refresh_started) {
        setRefreshing(true);
        startRefreshPoll();
      }
    } catch (e: any) {
      clearTimeout(timer);
      if (e.name === "AbortError") {
        if (retryCount < 1) return fetchData(refresh, retryCount + 1);
        setError(`Scan timed out — try again in a few moments`);
      } else {
        if (!data?.calls?.length) {
          setError(e.message || "Failed to fetch options data");
        }
      }
      setLoading(false);
    }
  }, [universe, data?.calls?.length]);

  const startRefreshPoll = useCallback(() => {
    if (refreshPollRef.current) clearInterval(refreshPollRef.current);
    refreshPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/screener/alpha-calls/status?universe=${universe}`, { headers: getAuthHeaders() });
        const status = await res.json();
        setScanElapsed(status.elapsed_seconds);
        if (!status.scanning) {
          if (refreshPollRef.current) clearInterval(refreshPollRef.current);
          refreshPollRef.current = null;
          setRefreshing(false);
          setScanElapsed(null);
          fetchData(false);
        }
      } catch { /* ignore */ }
    }, 3000);
  }, [universe]);

  useEffect(() => {
    fetchData();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      if (refreshPollRef.current) clearInterval(refreshPollRef.current);
    };
  }, [universe]);

  // ── Unique Categories ──
  const dynamicCategories = useMemo(() => {
    if (!data?.calls?.length) return [];
    const cats = new Set<string>();
    data.calls.forEach(c => {
      if (c.strategy_category) cats.add(c.strategy_category);
    });
    return Array.from(cats).sort();
  }, [data?.calls]);

  // ── Filtered & Sorted Calls ──
  const filteredCalls = useMemo(() => {
    if (!data?.calls?.length) return [];
    
    let result = data.calls.filter(c => {
      // Category
      if (activeCategory && c.strategy_category !== activeCategory) return false;
      
      // Moneyness
      if (moneynessFilter !== "All") {
        const isCall = c.option_type === 'call' || (!c.option_type && c.delta > 0);
        const ratio = c.strike / c.stock_price;
        const atm = Math.abs(ratio - 1) < 0.03;
        const itm = isCall ? ratio < 0.97 : ratio > 1.03;
        const otm = isCall ? ratio > 1.03 : ratio < 0.97;
        
        if (moneynessFilter === "ITM" && !itm) return false;
        if (moneynessFilter === "ATM" && !atm) return false;
        if (moneynessFilter === "OTM" && !otm) return false;
      }
      
      // DTE Range
      if (dteFilter !== "All") {
        if (dteFilter === "Weeklies" && c.dte >= 14) return false;
        if (dteFilter === "Swing" && (c.dte < 14 || c.dte > 60)) return false;
        if (dteFilter === "Long" && (c.dte < 60 || c.dte > 180)) return false;
        if (dteFilter === "LEAPS" && c.dte <= 180) return false;
      }
      
      // Conviction
      if (highConvictionOnly && c.quant_score < 75 && c.vol_edge <= 0) return false;
      
      return true;
    });

    // Sort
    result.sort((a, b) => b[sortBy] - a[sortBy]);
    
    return result;
  }, [data?.calls, activeCategory, moneynessFilter, dteFilter, highConvictionOnly, sortBy]);

  /* ── Group by Ticker → Expiry → Strikes ── */
  const grouped: TickerGroup[] = useMemo(() => {
    const map: Record<string, { calls: AlphaCall[]; best: AlphaCall }> = {};
    for (const c of filteredCalls) {
      if (!map[c.ticker]) map[c.ticker] = { calls: [], best: c };
      map[c.ticker].calls.push(c);
      if (c.quant_score > map[c.ticker].best.quant_score) map[c.ticker].best = c;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b.best[sortBy] - a.best[sortBy])
      .map(([ticker, { calls, best }]) => {
        const byExp: Record<string, AlphaCall[]> = {};
        for (const c of calls) { (byExp[c.expiration] ??= []).push(c); }
        const expiries = Object.entries(byExp)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([exp, cs]) => ({ exp, dte: cs[0].dte, contracts: cs.sort((a, b) => a.strike - b.strike) }));
        return { ticker, price: best.stock_price, best, total: calls.length, expiries, calls };
      });
  }, [filteredCalls, sortBy]);

  const toggleTicker = (t: string) => setExpandedTicker(prev => prev === t ? null : t);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: T.text }}>
      <div className="flex flex-col lg:grid" style={{ gridTemplateColumns: "1fr 320px", gap: 0, minHeight: "calc(100vh - 80px)" }}>

        {/* ── CENTER PANE ── */}
        <div className="px-3 py-4 md:px-6 md:py-6 lg:border-r overflow-x-hidden" style={{ borderColor: T.border, background: "rgba(13,13,13,0.5)" }}>

          {/* Breadcrumb + Status */}
          <div className="flex justify-between items-center mb-6">
            <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Intelligence <span style={{ color: T.textDim }}>/</span> <span style={{ color: COLORS.cyan, fontWeight: 700 }}>Alpha Calls</span>
            </div>
            <div className="flex items-center gap-3">
              {data?.timestamp && (
                <div style={{ fontSize: 10, color: T.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Synced {timeAgo(data.timestamp)}
                </div>
              )}
              <button 
                onClick={() => fetchData(true)} 
                disabled={loading || refreshing}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-800 hover:border-emerald-500/50 bg-zinc-900/50 transition-all active:scale-95"
              >
                <SFIcon name="arrow.clockwise" size="text-[10px]" className={cn(refreshing && "animate-spin", "text-zinc-400 group-hover:text-emerald-400")} />
                <span className="text-[10px] font-bold text-zinc-400 group-hover:text-emerald-400 uppercase tracking-wider">
                  {refreshing ? "Scanning..." : "Sync"}
                </span>
              </button>
            </div>
          </div>

          {/* Header Section */}
          <div className="mb-8">
            <h1 className={cn("text-3xl md:text-4xl mb-2", TRACKING_HEADING_CLASS)} style={{ fontWeight: 800 }}>
              Alpha-Flow <span className="text-emerald-400 italic">Options</span>
            </h1>
            <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
              Institutional-grade options intelligence. We scan the entire S&P 1500 universe for structural volatility edges, unusual volume profiles, and multi-system conviction.
            </p>
          </div>

          {/* ── DYNAMIC CATEGORY TABS ── */}
          <div className="mb-6">
             <div className="flex items-center gap-1 p-1 bg-zinc-900/80 border border-zinc-800 rounded-lg w-fit overflow-x-auto no-scrollbar">
                {["", ...dynamicCategories].map((cat) => {
                  const meta = STRATEGY_LABELS[cat] || { label: cat.replace(/_/g, ' '), tag: "ALT", color: T.textSec };
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => { setActiveCategory(cat); setExpandedTicker(null); setSelected(null); }}
                      className={cn(
                        "relative px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                        isActive ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {isActive && (
                        <motion.div 
                          layoutId="activeTab"
                          className="absolute inset-0 bg-emerald-500/10 border border-emerald-500/20 rounded-md"
                          transition={SPRING_TRANSITION_PROPS}
                        />
                      )}
                      <span className="relative z-10">{meta.label}</span>
                    </button>
                  );
                })}
             </div>
          </div>

          {/* ── ADVANCED FILTER BAR ── */}
          <div className="flex flex-wrap items-center gap-4 p-4 bg-zinc-900/40 border border-zinc-800/50 rounded-xl mb-8">
            
            {/* Universe */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Universe</span>
              <div className="flex bg-zinc-950 rounded-md border border-zinc-800 p-0.5">
                {(["sp500", "nasdaq100", "both"] as const).map((u) => (
                  <button 
                    key={u} 
                    onClick={() => setUniverse(u)}
                    className={cn(
                      "px-3 py-1 rounded-sm text-[10px] font-bold uppercase transition-all",
                      universe === u ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {u === "both" ? "All" : u === "sp500" ? "S&P" : "NDX"}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-px h-4 bg-zinc-800" />

            {/* Moneyness */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Moneyness</span>
              <div className="flex bg-zinc-950 rounded-md border border-zinc-800 p-0.5">
                {["All", "ITM", "ATM", "OTM"].map((m) => (
                  <button 
                    key={m} 
                    onClick={() => setMoneynessFilter(m)}
                    className={cn(
                      "px-3 py-1 rounded-sm text-[10px] font-bold uppercase transition-all",
                      moneynessFilter === m ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-px h-4 bg-zinc-800" />

            {/* DTE */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Horizon</span>
              <div className="flex bg-zinc-950 rounded-md border border-zinc-800 p-0.5">
                {["All", "Weeklies", "Swing", "Long", "LEAPS"].map((d) => (
                  <button 
                    key={d} 
                    onClick={() => setDteFilter(d)}
                    className={cn(
                      "px-3 py-1 rounded-sm text-[10px] font-bold uppercase transition-all",
                      dteFilter === d ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-px h-4 bg-zinc-800" />

            {/* Conviction Toggle */}
            <button 
              onClick={() => setHighConvictionOnly(!highConvictionOnly)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all",
                highConvictionOnly 
                  ? "bg-amber-500/10 border-amber-500/50 text-amber-500 shadow-[0_0_10px_rgba(226,184,87,0.15)]" 
                  : "bg-zinc-950 border-zinc-800 text-zinc-500 grayscale opacity-60"
              )}
            >
              <SFIcon name="crown.fill" size="text-[10px]" />
              <span className="text-[10px] font-black uppercase tracking-widest">High Conviction</span>
            </button>

            <div className="flex-1" />

            {/* Sort */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Sort</span>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-b border-dashed border-zinc-700 text-[11px] font-bold text-zinc-300 outline-none cursor-pointer hover:border-zinc-500"
              >
                <option value="quant_score">Quant Score</option>
                <option value="open_interest">Open Interest</option>
              </select>
            </div>
          </div>

          {/* Results Summary Badges */}
          {data?.meta && (
            <div className="flex gap-2 mb-6">
              {[
                { label: `${filteredCalls.length} Contracts`, color: "emerald" },
                { label: `${grouped.length} Tickers`, color: "amber" },
                { label: activeCategory ? STRATEGY_LABELS[activeCategory]?.label || activeCategory : "All Categories", color: "cyan" }
              ].map(b => (
                <div key={b.label} className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border", 
                  b.color === "emerald" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                  b.color === "amber" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                  "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                )}>
                  {b.label}
                </div>
              ))}
            </div>
          )}

          {/* ═══ TICKER LIST ═══ */}
          <AnimatePresence mode="popLayout">
            {loading && !data ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-40">
                <div className="w-10 h-10 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Scanning Universe Intelligence...</p>
              </div>
            ) : grouped.length > 0 ? (
              <motion.div 
                className="flex flex-col gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {grouped.map((g, idx) => {
                  const isOpen = expandedTicker === g.ticker;
                  const isTop = idx < 3;
                  return (
                    <motion.div 
                      layout
                      key={g.ticker} 
                      className={cn(
                        "group bg-zinc-900/50 border rounded-xl overflow-hidden transition-all duration-300",
                        isOpen ? "border-zinc-700 ring-1 ring-zinc-700/50" : "border-zinc-800/60 hover:border-zinc-700"
                      )}
                    >
                      {/* Ticker Row */}
                      <div
                        onClick={() => toggleTicker(g.ticker)}
                        className="flex items-center gap-5 p-4 cursor-pointer relative"
                      >
                        {/* Status bar */}
                        <div className={cn(
                          "absolute left-0 top-0 bottom-0 w-1 transition-all",
                          g.best.quant_score >= 75 ? "bg-emerald-500" : g.best.quant_score >= 50 ? "bg-amber-500" : "bg-transparent"
                        )} />

                        {/* Rank */}
                        <div className={cn(
                          "w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-black border",
                          isTop ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-zinc-950 border-zinc-800 text-zinc-600"
                        )}>
                          {idx + 1}
                        </div>

                        {/* Ticker Identity */}
                        <div className="flex flex-col">
                          <span className="text-base font-black text-white tracking-tight">{g.ticker}</span>
                          <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-tighter">${g.price}</span>
                        </div>

                        {/* Best Score */}
                        <Donut score={g.best.quant_score} size={34} />

                        {/* Key Metrics */}
                        <div className="hidden md:flex items-center gap-6">
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-0.5">Edge</span>
                              <span className={cn("text-xs font-mono font-bold", g.best.vol_edge > 0 ? "text-emerald-400" : "text-rose-400")}>
                                {g.best.vol_edge > 0 ? "+" : ""}{g.best.vol_edge.toFixed(1)}%
                              </span>
                           </div>
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-0.5">OI Flow</span>
                              <span className="text-xs font-mono font-bold text-zinc-300">
                                {g.best.open_interest.toLocaleString()}
                              </span>
                           </div>
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-0.5">Contracts</span>
                              <span className="text-xs font-bold text-zinc-400">
                                {g.total}
                              </span>
                           </div>
                        </div>

                        {/* Category Tags */}
                        <div className="hidden lg:flex gap-1.5 ml-auto">
                          {Array.from(new Set(g.calls.map(c => c.strategy_category))).slice(0, 2).map(cat => {
                            const meta = STRATEGY_LABELS[cat as string] || { tag: "ALT" };
                            return (
                              <span key={cat as string} className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[8px] font-black uppercase text-zinc-500 tracking-tighter">
                                {meta.tag}
                              </span>
                            );
                          })}
                        </div>

                        <div className={cn("ml-auto lg:ml-0 p-2 rounded-full transition-transform duration-300 text-zinc-600", isOpen && "rotate-180 text-zinc-300")}>
                           <SFIcon name="chevron.down" size="text-xs" />
                        </div>
                      </div>

                      {/* Expanded Section */}
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-zinc-950/40 border-t border-zinc-800/80"
                          >
                            {g.expiries.map(({ exp, dte, contracts }) => (
                              <div key={exp} className="border-b border-zinc-800/40 last:border-0">
                                <div className="flex items-center gap-3 px-6 py-2.5 bg-zinc-900/30">
                                  <SFIcon name="calendar" size="text-[10px]" className="text-amber-500" />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{exp}</span>
                                  <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">{dte}D To Expiry</span>
                                </div>
                                
                                <div className="overflow-x-auto">
                                  <table className="w-full text-[11px] border-collapse min-w-[600px]">
                                    <thead>
                                      <tr className="bg-zinc-900/10">
                                        {["Strike", "Premium", "Score", "Delta", "POP", "Edge", "Volume", "OI"].map(h => (
                                          <th key={h} className="px-6 py-2 text-left text-[9px] font-black text-zinc-600 uppercase tracking-widest border-b border-zinc-800/50">
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {contracts.map((c, ci) => (
                                        <tr 
                                          key={ci}
                                          onClick={() => { setSelected(c); setModalCall(c); }}
                                          className={cn(
                                            "cursor-pointer transition-colors border-b border-zinc-900/30 last:border-0",
                                            selected === c ? "bg-emerald-500/5" : "hover:bg-zinc-800/40"
                                          )}
                                        >
                                          <td className="px-6 py-3 font-bold text-zinc-100 flex items-center gap-2">
                                            {c.quant_score >= 75 && <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]" />}
                                            ${c.strike}
                                          </td>
                                          <td className="px-6 py-3 font-black text-emerald-400">${c.mid_price.toFixed(2)}</td>
                                          <td className="px-6 py-3"><Donut score={c.quant_score} size={24} /></td>
                                          <td className="px-6 py-3 font-mono text-zinc-400">{c.delta.toFixed(2)}</td>
                                          <td className={cn("px-6 py-3 font-bold", c.pop > 0.4 ? "text-emerald-400" : "text-zinc-500")}>
                                            {(c.pop * 100).toFixed(0)}%
                                          </td>
                                          <td className={cn("px-6 py-3 font-mono font-bold", c.vol_edge > 0 ? "text-emerald-400" : "text-zinc-600")}>
                                            {c.vol_edge > 0 ? "+" : ""}{c.vol_edge.toFixed(1)}%
                                          </td>
                                          <td className="px-6 py-3 font-mono text-zinc-500">{c.volume.toLocaleString()}</td>
                                          <td className="px-6 py-3 font-mono text-zinc-500">{c.open_interest.toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
                <SFIcon name="magnifyingglass" size="text-3xl" className="text-zinc-700 mb-4" />
                <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">No Intelligence Matching Current Criteria</p>
                <button 
                  onClick={() => { setActiveCategory(""); setMoneynessFilter("All"); setDteFilter("All"); setHighConvictionOnly(false); }}
                  className="mt-4 text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:text-emerald-400"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIGHT PANE (Institutional Sidebar) ── */}
        <div className="hidden lg:block bg-zinc-950 border-l border-zinc-900 sticky top-0 h-screen overflow-y-auto no-scrollbar">
           {selected ? (
             <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="p-6"
             >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-zinc-600 uppercase tracking-widest mb-1">Contract Focus</span>
                    <h2 className="text-2xl font-black text-white">{selected.ticker} <span className="text-emerald-400 font-mono">${selected.strike}</span></h2>
                  </div>
                  <Donut score={selected.quant_score} size={50} />
                </div>

                {/* Score Breakdown Card */}
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl mb-6 relative overflow-hidden">
                   <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />
                   <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Quant Score Analysis</span>
                      <span className={cn("text-xs font-black px-2 py-0.5 rounded", 
                        selected.quant_score >= 75 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                      )}>
                        {selected.quant_score >= 75 ? "ELITE" : "STRONG"}
                      </span>
                   </div>
                   <div className="flex flex-col gap-3">
                      {[
                        { label: "Vol Edge", value: `${selected.vol_edge.toFixed(1)}%`, active: selected.vol_edge > 0 },
                        { label: "Pop Probability", value: `${(selected.pop * 100).toFixed(0)}%`, active: selected.pop > 0.4 },
                        { label: "OI Conviction", value: selected.open_interest > 1000 ? "High" : "Mid", active: true },
                        { label: "Moneyness", value: selected.moneyness || "ATM", active: true }
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between">
                           <span className="text-[10px] font-bold text-zinc-600 uppercase">{item.label}</span>
                           <span className={cn("text-[11px] font-mono font-bold", item.active ? "text-emerald-400" : "text-zinc-400")}>{item.value}</span>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Detailed Greeks Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                   {[
                     { label: "Delta", val: selected.delta.toFixed(2), c: "text-zinc-100" },
                     { label: "IV", val: `${selected.implied_volatility}%`, c: "text-amber-400" },
                     { label: "B/E", val: `+${selected.breakeven_pct}%`, c: "text-emerald-400" },
                     { label: "Spread", val: `${selected.spread_pct}%`, c: "text-zinc-400" }
                   ].map(g => (
                     <div key={g.label} className="p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-lg">
                        <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">{g.label}</div>
                        <div className={cn("text-sm font-black font-mono", g.c)}>{g.val}</div>
                     </div>
                   ))}
                </div>

                {/* Strategy Context */}
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl mb-8">
                   <div className="flex items-center gap-2 mb-2 text-emerald-400">
                      <SFIcon name="info.circle.fill" size="text-[10px]" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Institutional Context</span>
                   </div>
                   <p className="text-xs text-zinc-400 leading-relaxed italic">
                      {selected.ticker} exhibits {selected.vol_edge > 2 ? "significant" : "moderate"} volatility compression. 
                      The {selected.strategy_category?.replace(/_/g, ' ')} classification suggests 
                      {selected.open_interest > selected.volume ? " deep institutional accumulation" : " aggressive short-term positioning"}.
                   </p>
                </div>

                <button 
                  onClick={() => onTickerSelect?.(selected.ticker)}
                  className="w-full py-4 rounded-xl bg-zinc-100 text-zinc-950 text-xs font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl hover:shadow-emerald-500/10"
                >
                  View Full Ticker Analysis
                </button>
             </motion.div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-30">
                <SFIcon name="target" size="text-5xl" className="text-zinc-800 mb-6" />
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Deep Intelligence</h3>
                <p className="text-[10px] text-zinc-600 font-bold uppercase leading-relaxed">Select a contract from the flow blotter to unlock institutional analysis and greeks.</p>
             </div>
           )}
        </div>
      </div>

      <AlphaContractModal
        call={modalCall}
        onClose={() => setModalCall(null)}
        onViewTicker={onTickerSelect}
      />
    </div>
  );
}
