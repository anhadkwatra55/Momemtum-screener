"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AlphaContractModal } from "./alpha-contract-modal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8060";
import { getAuthHeaders } from "@/services/api";

interface AlphaCall {
  ticker: string; stock_price: number; strike: number; expiration: string;
  dte: number; bid: number; ask: number; mid_price: number; delta: number;
  pop: number; vol_edge: number; breakeven_pct: number; open_interest: number;
  volume: number; implied_volatility: number; spread_pct: number;
  quant_score: number; moneyness: string;
}

interface AlphaCallsData {
  calls: AlphaCall[];
  meta: { universe_source: string; universe_size: number; tickers_scanned: number; contracts_found: number; tickers_with_calls: number; errors: number; partial?: boolean; scan_time_seconds?: number; warming_up?: boolean; message?: string; filters: Record<string, string>; };
  timestamp: string;
  refresh_started?: boolean;
}

/* ── Tokens ── */
const T = {
  bg: "#0d0d0d", card: "#1a1a1a", cardHover: "#222222", surface: "#222222",
  border: "#2d2d2d", borderLight: "#363636",
  text: "#e0e0e0", textSec: "#a0a0a0", textMuted: "#707070", textDim: "#505050",
  gold: "#e2b857", goldDim: "rgba(226,184,87,0.12)",
  purple: "#9f7aea", purpleDim: "rgba(159,122,234,0.10)",
  green: "#4ade80", greenDim: "rgba(74,222,128,0.10)",
  red: "#e05252", redDim: "rgba(224,82,82,0.10)",
  cyan: "#22d3ee", cyanDim: "rgba(34,211,238,0.08)",
};

/* ── Confidence Donut ── */
function Donut({ score, size = 36 }: { score: number; size?: number }) {
  const r = (size - 5) / 2, circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, score) / 100) * circ;
  const color = score >= 50 ? T.green : score >= 30 ? T.gold : T.red;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.surface} strokeWidth="2.5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="2.5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color }}>{score}</span>
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
}

type OptionsCategory = "" | "swing" | "leaps" | "cheap_calls";

const CATEGORY_META: Record<string, { label: string; tag: string; desc: string; params: string }> = {
  "": { label: "All", tag: "ALL", desc: "All screened options across categories", params: "Δ ≥ 0.05 · DTE: 7–730d · All moneyness" },
  swing: { label: "Swing", tag: "SWING", desc: "High-conviction momentum plays (21-90d), ATM/OTM", params: "Δ 0.35–0.60 · DTE: 21–90d · Prem: $0.50–$8" },
  leaps: { label: "LEAPS", tag: "LEAPS", desc: "Long-term deep ITM quality holds (180-730d)", params: "Δ 0.70–0.90 · DTE: 180–730d · ITM only" },
  cheap_calls: { label: "Cheap Calls", tag: "CHEAP", desc: "High-volume OTM lottery tickets (7-60d)", params: "Δ 0.05–0.30 · DTE: 7–60d · Prem: $0.05–$2" },
};

export function AlphaCallsBlotter({ onTickerSelect }: Props) {
  const [data, setData] = useState<AlphaCallsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanLimit, setScanLimit] = useState(75);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [selected, setSelected] = useState<AlphaCall | null>(null);
  const [modalCall, setModalCall] = useState<AlphaCall | null>(null);
  const [universe, setUniverse] = useState<"sp500" | "nasdaq100" | "both">("sp500");
  const [refreshing, setRefreshing] = useState(false);
  const [scanElapsed, setScanElapsed] = useState<number | null>(null);
  const [category, setCategory] = useState<OptionsCategory>("");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fetch data ── */
  const fetchData = useCallback(async (refresh = false, retryCount = 0) => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
    if (!refresh) { setLoading(true); }
    setError(null);
    const controller = new AbortController();
    const timeoutMs = scanLimit >= 500 ? 180_000 : 120_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const params = new URLSearchParams({ limit: String(scanLimit), sort_by: "quant_score", universe, ...(category && { category }), ...(refresh && { refresh: "true" }) });
      const res = await fetch(`${API_URL}/api/screener/alpha-calls?${params}`, { signal: controller.signal, headers: getAuthHeaders() });
      clearTimeout(timer);
      const result = await res.json();

      // 202 = warming up
      if (res.status === 202 || result.meta?.warming_up) {
        pollRef.current = setTimeout(() => fetchData(false, 0), 10_000);
        return;
      }
      if (!res.ok) throw new Error(`Server error (HTTP ${res.status})`);
      if (result.error) throw new Error(result.error);

      setData(result);
      setError(null);
      setLoading(false);

      // If a refresh was kicked off, start polling for completion
      if (result.refresh_started) {
        setRefreshing(true);
        startRefreshPoll();
      }
    } catch (e: any) {
      clearTimeout(timer);
      if (e.name === "AbortError") {
        if (retryCount < 1) return fetchData(refresh, retryCount + 1);
        setError(`Scan timed out — try scanning fewer tickers (current: ${scanLimit})`);
      } else {
        if (!data?.calls?.length) {
          setError(e.message || "Failed to fetch options data");
        }
      }
      setLoading(false);
    }
  }, [scanLimit, universe, category, data?.calls?.length]);

  /* ── Poll for refresh completion ── */
  const startRefreshPoll = useCallback(() => {
    if (refreshPollRef.current) clearInterval(refreshPollRef.current);
    refreshPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/screener/alpha-calls/status?universe=${universe}`, { headers: getAuthHeaders() });
        const status = await res.json();
        setScanElapsed(status.elapsed_seconds);
        if (!status.scanning) {
          // Scan finished — re-fetch data
          if (refreshPollRef.current) clearInterval(refreshPollRef.current);
          refreshPollRef.current = null;
          setRefreshing(false);
          setScanElapsed(null);
          fetchData(false);
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);
  }, [universe]);

  useEffect(() => {
    fetchData();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      if (refreshPollRef.current) clearInterval(refreshPollRef.current);
    };
  }, [universe, scanLimit, category]);

  /* ── Group by Ticker → Expiry → Strikes ── */
  const grouped: TickerGroup[] = useMemo(() => {
    if (!data?.calls?.length) return [];
    const map: Record<string, { calls: AlphaCall[]; best: AlphaCall }> = {};
    for (const c of data.calls) {
      if (!map[c.ticker]) map[c.ticker] = { calls: [], best: c };
      map[c.ticker].calls.push(c);
      if (c.quant_score > map[c.ticker].best.quant_score) map[c.ticker].best = c;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b.best.quant_score - a.best.quant_score)
      .map(([ticker, { calls, best }]) => {
        const byExp: Record<string, AlphaCall[]> = {};
        for (const c of calls) { (byExp[c.expiration] ??= []).push(c); }
        const expiries = Object.entries(byExp)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([exp, cs]) => ({ exp, dte: cs[0].dte, contracts: cs.sort((a, b) => a.strike - b.strike) }));
        return { ticker, price: best.stock_price, best, total: calls.length, expiries };
      });
  }, [data?.calls]);

  const toggleTicker = (t: string) => setExpandedTicker(prev => prev === t ? null : t);

  /* ── Filter params from meta ── */
  const filterParams = data?.meta?.filters;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: T.text }}>
      <div className="flex flex-col lg:grid" style={{ gridTemplateColumns: "1fr 300px", gap: 0, minHeight: "calc(100vh - 80px)" }}>

        {/* ── CENTER PANE ── */}
        <div className="px-3 py-4 md:px-6 md:py-5 lg:border-r overflow-x-hidden" style={{ borderColor: T.border }}>

          {/* Breadcrumb + Scan Timestamp */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: T.textDim }}>
              Dashboard <span style={{ color: T.textDim }}>/</span> <span style={{ color: T.text, fontWeight: 500 }}>Alpha Options</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Scan timestamp */}
              {data?.timestamp && (
                <div style={{ fontSize: 10, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: T.textMuted, opacity: 0.5 }} />
                  Scanned {timeAgo(data.timestamp)}
                </div>
              )}
              {/* Refreshing indicator */}
              {refreshing && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: T.gold, padding: "3px 10px", borderRadius: 6, background: T.goldDim, border: `1px solid ${T.gold}20` }}>
                  <div style={{ width: 10, height: 10, border: `2px solid ${T.gold}40`, borderTopColor: T.gold, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  Scanning{scanElapsed ? ` (${Math.round(scanElapsed)}s)` : "…"}
                </div>
              )}
            </div>
          </div>

          {/* Header */}
          <h1 className="text-xl md:text-2xl" style={{ fontWeight: 600, color: T.text, marginBottom: 6 }}>Alpha-Flow Options</h1>
          <p className="text-xs md:text-[13px]" style={{ color: T.textMuted, lineHeight: 1.6, maxWidth: 560, marginBottom: 12 }}>
            {CATEGORY_META[category].desc}
          </p>

          {/* ── Category Tabs ── */}
          <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}`, width: "fit-content" }}>
            {(["" , "swing", "leaps", "cheap_calls"] as OptionsCategory[]).map((cat) => {
              const meta = CATEGORY_META[cat];
              const isActive = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => { setCategory(cat); setExpandedTicker(null); setSelected(null); }}
                  style={{
                    fontSize: 12, fontWeight: isActive ? 600 : 400, padding: "8px 18px", cursor: "pointer",
                    border: "none", borderRight: cat !== "cheap_calls" ? `1px solid ${T.border}` : "none",
                    background: isActive ? T.goldDim : "transparent",
                    color: isActive ? T.gold : T.textMuted,
                    transition: "all 200ms ease-out",
                    letterSpacing: "0.02em",
                  }}
                >{meta.label}</button>
              );
            })}
          </div>

          {/* Badges */}
          {data?.meta && (
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[{ t: `${data.meta.contracts_found} signals`, c: T.green }, { t: `${data.meta.tickers_with_calls} tickers`, c: T.gold }, { t: `${data.meta.tickers_scanned} scanned`, c: T.textMuted }].map(b => (
                <span key={b.t} style={{ fontSize: 10, fontWeight: 500, color: b.c, border: `1px solid ${b.c}30`, borderRadius: 6, padding: "3px 10px" }}>{b.t}</span>
              ))}
            </div>
          )}

          {/* Control Bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 16px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 24, flexWrap: "wrap" }}>
            {/* Universe Toggle */}
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: `1px solid ${T.border}` }}>
              {([["sp500", "S&P 500"], ["nasdaq100", "NASDAQ 100"], ["both", "Both"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => { setUniverse(val as any); setExpandedTicker(null); setSelected(null); setModalCall(null); }}
                  style={{
                    fontSize: 11, fontWeight: universe === val ? 600 : 400, padding: "5px 12px", cursor: "pointer",
                    border: "none", borderRight: val !== "both" ? `1px solid ${T.border}` : "none",
                    background: universe === val ? T.goldDim : "transparent",
                    color: universe === val ? T.gold : T.textMuted,
                    transition: "all 200ms ease-out",
                  }}>{label}</button>
              ))}
            </div>
            <span style={{ width: 1, height: 16, background: T.border }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ color: T.textMuted }}>Scan:</span>
              <select value={scanLimit} onChange={e => setScanLimit(parseInt(e.target.value))}
                style={{ fontSize: 12, fontFamily: "inherit", fontWeight: 500, background: "transparent", border: "none", color: T.text, cursor: "pointer", outline: "none", borderBottom: `1px dashed ${T.textDim}`, padding: "2px 4px" }}>
                {[50, 75, 100, 200, 500].map(n => <option key={n} value={n} style={{ background: T.card }}>{n === 500 ? "All" : `${n}`} tickers</option>)}
              </select>
            </div>
            <span style={{ width: 1, height: 16, background: T.border }} />
<<<<<<< Updated upstream
            {/* Filter params - show real values from meta if available */}
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.textDim }}>
              <span>Δ ≥ {filterParams?.delta_floor || "0.35"}</span>
              <span>DTE: {filterParams?.dte_range || "90–150d"}</span>
              <span>Prem: {filterParams?.premium_range || "$1–$8"}</span>
=======
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.textDim, alignItems: "center" }}>
              <span>Filters:</span>
              <span style={{ color: T.textSec, fontFamily: "var(--font-mono, monospace)", fontSize: 10 }}>{CATEGORY_META[category].params}</span>
>>>>>>> Stashed changes
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={() => fetchData(true)} disabled={loading || refreshing}
              style={{ fontSize: 12, fontWeight: 600, padding: "7px 20px", borderRadius: 6, cursor: loading || refreshing ? "not-allowed" : "pointer", border: `1px solid ${loading || refreshing ? T.border : T.gold}`, background: loading || refreshing ? T.surface : T.goldDim, color: loading || refreshing ? T.textMuted : T.gold, transition: "all 200ms ease-out" }}>
              {refreshing ? "Scanning…" : loading && !data ? "Loading…" : "Run Scan →"}
            </button>
          </div>

          {/* Loading / Error / Partial / Empty */}
          {loading && !data && (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <div style={{ width: 36, height: 36, border: `2px solid ${T.border}`, borderTopColor: T.gold, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
              <p style={{ fontSize: 13, color: T.textMuted }}>Scanning {scanLimit === 500 ? "all" : scanLimit} tickers — this may take a few minutes…</p>
            </div>
          )}
          {error && (
            <div style={{ padding: 16, borderRadius: 8, border: `1px solid ${T.red}30`, background: T.redDim, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 13, color: T.red, margin: 0 }}>{error}</p>
              <button onClick={() => fetchData(false)} style={{ fontSize: 11, fontWeight: 600, padding: "5px 14px", borderRadius: 6, cursor: "pointer", border: `1px solid ${T.red}40`, background: "transparent", color: T.red, flexShrink: 0, marginLeft: 12 }}>
                Retry
              </button>
            </div>
          )}
          {data?.meta?.partial && !loading && (
            <div style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.gold}30`, background: T.goldDim, marginBottom: 16, fontSize: 12, color: T.gold }}>
              ⚡ Partial results — scan timed out after {data.meta.tickers_scanned} of {data.meta.universe_size} tickers. Showing {data.meta.contracts_found} contracts found so far.
            </div>
          )}
          {data && !grouped.length && !loading && (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: T.textMuted }}>No qualifying contracts</p>
            </div>
          )}

          {/* Refreshing overlay */}
          {refreshing && data && grouped.length > 0 && (
            <div style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.gold}30`, background: T.goldDim, marginBottom: 16, fontSize: 12, color: T.gold, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 12, height: 12, border: `2px solid ${T.gold}40`, borderTopColor: T.gold, borderRadius: "50%", animation: "spin 1s linear infinite", flexShrink: 0 }} />
              Re-scanning {scanLimit === 500 ? "all" : scanLimit} tickers{scanElapsed ? ` — ${Math.round(scanElapsed)}s elapsed` : "…"} · Results will auto-refresh when complete.
            </div>
          )}

          {/* ═══ TICKER LIST ═══ */}
          {grouped.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {grouped.map((g, idx) => {
                const isOpen = expandedTicker === g.ticker;
                const isTop = idx < 3;
                return (
                  <div key={g.ticker} style={{ background: T.card, border: `1px solid ${isOpen ? T.borderLight : T.border}`, borderRadius: 8, overflow: "hidden", transition: "all 200ms ease-out" }}>

                    {/* ── Ticker Header Row (click to expand contracts) ── */}
                    <div
                      onClick={() => toggleTicker(g.ticker)}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", cursor: "pointer", transition: "background 200ms ease-out" }}
                      onMouseEnter={e => (e.currentTarget.style.background = T.cardHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Rank */}
                      <span style={{
                        width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%",
                        fontSize: 10, fontWeight: 600, background: isTop ? T.goldDim : T.surface, color: isTop ? T.gold : T.textDim,
                        border: `1px solid ${isTop ? `${T.gold}40` : T.border}`,
                      }}>{idx + 1}</span>

                      {/* Ticker + Price */}
                      <div>
                        <span className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: "0.02em" }}>{g.ticker}</span>
                        <span className="font-mono" style={{ fontSize: 11, color: T.textDim, marginLeft: 8 }}>${g.price}</span>
                      </div>

                      {/* Score donut */}
                      <Donut score={g.best.quant_score} size={28} />

                      {/* Edge + POP */}
                      <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
                        <span>
                          <span style={{ color: T.textDim, fontSize: 9, marginRight: 4 }}>EDGE</span>
                          <span className="font-mono" style={{ color: g.best.vol_edge > 0 ? T.green : T.red, fontWeight: 600 }}>{g.best.vol_edge > 0 ? "+" : ""}{g.best.vol_edge}</span>
                        </span>
                        <span>
                          <span style={{ color: T.textDim, fontSize: 9, marginRight: 4 }}>POP</span>
                          <span className="font-mono" style={{ color: g.best.pop >= 0.40 ? T.green : T.textSec }}>{(g.best.pop * 100).toFixed(0)}%</span>
                        </span>
                      </div>

                      <span style={{ fontSize: 11, color: T.textDim }}>{g.total} contract{g.total > 1 ? "s" : ""}</span>

                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 12, color: T.textDim, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms ease-out" }}>▾</span>
                    </div>

                    {/* ── Expanded: Contracts by Expiry → Strike ── */}
                    <div style={{ maxHeight: isOpen ? 800 : 0, opacity: isOpen ? 1 : 0, overflow: "hidden", transition: "max-height 250ms ease-out, opacity 200ms ease-out" }}>
                      {isOpen && g.expiries.map(({ exp, dte, contracts }) => (
                        <div key={exp}>
                          {/* Expiry header */}
                          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 18px", background: T.bg, borderTop: `1px solid ${T.border}` }}>
                            <span className="font-mono" style={{ fontSize: 11, color: T.gold, fontWeight: 500 }}>{exp}</span>
                            <span style={{ fontSize: 10, color: T.textDim }}>{dte}d to expiry</span>
                            <span style={{ fontSize: 10, color: T.textDim }}>·</span>
                            <span style={{ fontSize: 10, color: T.textDim }}>{contracts.length} strike{contracts.length > 1 ? "s" : ""}</span>
                          </div>

                          {/* Strike table */}
                          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", minWidth: 580 }}>
                            <thead>
                              <tr style={{ background: T.surface }}>
                                {["Strike", "Premium", "Score", "Delta", "POP", "Edge", "B/E", "OI"].map(h => (
                                  <th key={h} style={{ padding: "6px 14px", textAlign: h === "OI" ? "right" : "left", fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {contracts.map((c, ci) => {
                                const isBest = c.quant_score === g.best.quant_score;
                                const isSelected = selected === c;
                                return (
                                  <tr key={ci}
                                    onClick={() => { setSelected(c); setModalCall(c); }}
                                    style={{
                                      cursor: "pointer", borderBottom: `1px solid ${T.border}`,
                                      background: isSelected ? `${T.gold}10` : isBest ? T.greenDim : "transparent",
                                      transition: "background 200ms ease-out",
                                    }}
                                    onMouseEnter={e => { if (!isSelected && !isBest) e.currentTarget.style.background = T.cardHover; }}
                                    onMouseLeave={e => { if (!isSelected && !isBest) e.currentTarget.style.background = isSelected ? `${T.gold}10` : isBest ? T.greenDim : "transparent"; }}
                                  >
                                    <td className="font-mono" style={{ padding: "9px 14px", fontWeight: 600, color: T.text }}>
                                      {isBest && <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: T.green, marginRight: 6, boxShadow: `0 0 4px ${T.green}60` }} />}
                                      ${c.strike}
                                    </td>
                                    <td className="font-mono" style={{ padding: "9px 14px", color: T.gold, fontWeight: 600 }}>${c.mid_price}</td>
                                    <td style={{ padding: "9px 14px" }}><Donut score={c.quant_score} size={24} /></td>
                                    <td className="font-mono" style={{ padding: "9px 14px", color: c.delta >= 0.45 ? T.green : T.textSec }}>{c.delta}</td>
                                    <td className="font-mono" style={{ padding: "9px 14px", color: c.pop >= 0.40 ? T.green : c.pop >= 0.30 ? T.gold : T.red }}>{(c.pop * 100).toFixed(0)}%</td>
                                    <td className="font-mono" style={{ padding: "9px 14px", color: c.vol_edge > 0 ? T.green : T.red }}>{c.vol_edge > 0 ? "+" : ""}{c.vol_edge}</td>
                                    <td className="font-mono" style={{ padding: "9px 14px", color: c.breakeven_pct <= 8 ? T.green : T.gold }}>+{c.breakeven_pct}%</td>
                                    <td className="font-mono" style={{ padding: "9px 14px", textAlign: "right", color: T.textSec }}>{c.open_interest.toLocaleString()}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div style={{ padding: "8px 16px", fontSize: 11, color: T.textDim, display: "flex", justifyContent: "space-between" }}>
                <span>{data?.calls.length} contracts · {grouped.length} tickers · click any contract for deep analysis</span>
                <span>{data?.meta.universe_source}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANE (desktop sidebar) ── */}
        <div className="hidden lg:block" style={{ background: T.card, overflow: "auto", position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ padding: "16px 16px 8px", borderBottom: `1px solid ${T.border}`, fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Deep Dive
          </div>
          {!selected ? (
            <div style={{ padding: 32, textAlign: "center", color: T.textDim, fontSize: 13 }}>
              <p>Select a contract</p><p style={{ fontSize: 11, marginTop: 4 }}>Click any strike in the table</p>
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: T.text }}>{selected.ticker}</div>
                <div className="font-mono" style={{ fontSize: 13, color: T.textSec }}>${selected.stock_price}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "12px 14px", background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <Donut score={selected.quant_score} size={48} />
                <div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>Quant Score</div>
                  <div className="font-mono" style={{ fontSize: 16, fontWeight: 700, color: selected.quant_score >= 50 ? T.green : selected.quant_score >= 30 ? T.gold : T.red }}>{selected.quant_score}/100</div>
                </div>
              </div>
              <div style={{ fontSize: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, color: T.text, marginBottom: 8 }}>Contract</div>
                {[["Strike", `$${selected.strike}`], ["Premium", `$${selected.mid_price}`], ["Expiry", selected.expiration], ["DTE", `${selected.dte}d`]].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ color: T.textMuted }}>{l}</span>
                    <span className="font-mono" style={{ color: T.text, fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, color: T.text, marginBottom: 8 }}>Greeks</div>
                {[
                  ["Delta", String(selected.delta), selected.delta >= 0.45 ? T.green : T.textSec],
                  ["POP", `${(selected.pop * 100).toFixed(0)}%`, selected.pop >= 0.40 ? T.green : T.gold],
                  ["Vol Edge", `${selected.vol_edge > 0 ? "+" : ""}${selected.vol_edge}`, selected.vol_edge > 0 ? T.green : T.red],
                  ["Breakeven", `+${selected.breakeven_pct}%`, selected.breakeven_pct <= 8 ? T.green : T.gold],
                  ["OI", selected.open_interest.toLocaleString(), T.textSec],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ color: T.textMuted }}>{l}</span>
                    <span className="font-mono" style={{ color: c as string, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "12px 14px", background: T.purpleDim, borderRadius: 8, border: `1px solid ${T.purple}20` }}>
                <div style={{ fontSize: 10, color: T.purple, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>AI Thesis</div>
                <p style={{ fontSize: 12, lineHeight: 1.6, color: T.textSec }}>
                  {selected.ticker} presents a {selected.quant_score >= 40 ? "high" : "moderate"}-conviction opportunity
                  with {selected.delta >= 0.45 ? "strong" : "balanced"} delta{selected.vol_edge > 0 ? " and positive vol edge" : ""}.
                  {selected.pop >= 0.40 ? ` ${(selected.pop * 100).toFixed(0)}% POP suggests favorable risk/reward.` : ""}
                </p>
              </div>
              {/* View Full Detail button */}
              {onTickerSelect && (
                <button
                  onClick={() => onTickerSelect(selected.ticker)}
                  style={{ width: "100%", marginTop: 16, fontSize: 12, fontWeight: 600, padding: "10px 16px", borderRadius: 8, cursor: "pointer", border: `1px solid ${T.gold}40`, background: T.goldDim, color: T.gold, transition: "all 150ms" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = `${T.gold}40`; }}
                >View Ticker Detail →</button>
              )}
            </div>
          )}
        </div>

        {/* Mobile: show context panel inline when a contract is selected */}
        {selected && (
          <div className="lg:hidden" style={{ background: T.card, borderTop: `1px solid ${T.border}`, margin: "0 -12px", padding: "0 12px" }}>
            <div style={{ padding: "12px 0 6px", fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
              Deep Dive — {selected.ticker} ${selected.strike}
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "12px 14px", background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <Donut score={selected.quant_score} size={48} />
                <div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>Quant Score</div>
                  <div className="font-mono" style={{ fontSize: 16, fontWeight: 700, color: selected.quant_score >= 50 ? T.green : selected.quant_score >= 30 ? T.gold : T.red }}>{selected.quant_score}/100</div>
                </div>
              </div>
              <div style={{ padding: "12px 14px", background: T.purpleDim, borderRadius: 8, border: `1px solid ${T.purple}20` }}>
                <div style={{ fontSize: 10, color: T.purple, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>AI Thesis</div>
                <p style={{ fontSize: 12, lineHeight: 1.6, color: T.textSec }}>
                  {selected.ticker} presents a {selected.quant_score >= 40 ? "high" : "moderate"}-conviction opportunity
                  with {selected.delta >= 0.45 ? "strong" : "balanced"} delta{selected.vol_edge > 0 ? " and positive vol edge" : ""}.
                  {selected.pop >= 0.40 ? ` ${(selected.pop * 100).toFixed(0)}% POP suggests favorable risk/reward.` : ""}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Contract Detail Modal ── */}
      <AlphaContractModal
        call={modalCall}
        onClose={() => setModalCall(null)}
        onViewTicker={onTickerSelect}
      />

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
