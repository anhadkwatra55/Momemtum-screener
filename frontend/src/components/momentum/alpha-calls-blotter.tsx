"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8060";

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

/* ── Context Panel (right sidebar) ── */
function ContextPanel({ call }: { call: AlphaCall | null }) {
  if (!call) return (
    <div style={{ padding: 32, textAlign: "center", color: T.textDim, fontSize: 13 }}>
      <p>Select a contract</p><p style={{ fontSize: 11, marginTop: 4 }}>Click any strike in the table</p>
    </div>
  );
  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: T.text }}>{call.ticker}</div>
        <div className="font-mono" style={{ fontSize: 13, color: T.textSec }}>${call.stock_price}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "12px 14px", background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
        <Donut score={call.quant_score} size={48} />
        <div>
          <div style={{ fontSize: 11, color: T.textMuted }}>Quant Score</div>
          <div className="font-mono" style={{ fontSize: 16, fontWeight: 700, color: call.quant_score >= 50 ? T.green : call.quant_score >= 30 ? T.gold : T.red }}>{call.quant_score}/100</div>
        </div>
      </div>
      <div style={{ fontSize: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, color: T.text, marginBottom: 8 }}>Contract</div>
        {[["Strike", `$${call.strike}`], ["Premium", `$${call.mid_price}`], ["Expiry", call.expiration], ["DTE", `${call.dte}d`]].map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ color: T.textMuted }}>{l}</span>
            <span className="font-mono" style={{ color: T.text, fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, color: T.text, marginBottom: 8 }}>Greeks</div>
        {[
          ["Delta", String(call.delta), call.delta >= 0.45 ? T.green : T.textSec],
          ["POP", `${(call.pop * 100).toFixed(0)}%`, call.pop >= 0.40 ? T.green : T.gold],
          ["Vol Edge", `${call.vol_edge > 0 ? "+" : ""}${call.vol_edge}`, call.vol_edge > 0 ? T.green : T.red],
          ["Breakeven", `+${call.breakeven_pct}%`, call.breakeven_pct <= 8 ? T.green : T.gold],
          ["OI", call.open_interest.toLocaleString(), T.textSec],
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
          {call.ticker} presents a {call.quant_score >= 40 ? "high" : "moderate"}-conviction opportunity
          with {call.delta >= 0.45 ? "strong" : "balanced"} delta{call.vol_edge > 0 ? " and positive vol edge" : ""}.
          {call.pop >= 0.40 ? ` ${(call.pop * 100).toFixed(0)}% POP suggests favorable risk/reward.` : ""}
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════ */
interface Props { onTickerSelect?: (ticker: string) => void; }

interface TickerGroup {
  ticker: string; price: number; best: AlphaCall; total: number;
  expiries: { exp: string; dte: number; contracts: AlphaCall[] }[];
}

export function AlphaCallsBlotter({ onTickerSelect }: Props) {
  const [data, setData] = useState<AlphaCallsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanLimit, setScanLimit] = useState(75);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [selected, setSelected] = useState<AlphaCall | null>(null);
  const [universe, setUniverse] = useState<"sp500" | "nasdaq100" | "both">("sp500");

  const fetchData = useCallback(async (refresh = false, retryCount = 0) => {
    setLoading(true); setError(null);
    const controller = new AbortController();
    const timeoutMs = scanLimit >= 500 ? 180_000 : 120_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const params = new URLSearchParams({ limit: String(scanLimit), sort_by: "quant_score", universe, ...(refresh && { refresh: "true" }) });
      const res = await fetch(`${API_URL}/api/screener/alpha-calls?${params}`, { signal: controller.signal });
      clearTimeout(timer);
      const result = await res.json();

      // 202 = warming up, auto-poll until data arrives
      if (res.status === 202 || result.meta?.warming_up) {
        setLoading(true);
        setTimeout(() => fetchData(false, 0), 10_000); // poll every 10s
        return;
      }
      if (!res.ok) throw new Error(`Server error (HTTP ${res.status})`);
      if (result.error) throw new Error(result.error);
      setData(result);
    } catch (e: any) {
      clearTimeout(timer);
      if (e.name === "AbortError") {
        if (retryCount < 1) return fetchData(refresh, retryCount + 1);
        setError(`Scan timed out — try scanning fewer tickers (current: ${scanLimit})`);
      } else {
        setError(e.message || "Failed to fetch options data");
      }
    }
    finally { setLoading(false); }
  }, [scanLimit, universe]);

  useEffect(() => { fetchData(); }, [universe, scanLimit]);

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

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: T.text }}>
      <div className="flex flex-col lg:grid" style={{ gridTemplateColumns: "1fr 300px", gap: 0, minHeight: "calc(100vh - 80px)" }}>

        {/* ── CENTER PANE ── */}
        <div className="px-3 py-4 md:px-6 md:py-5 lg:border-r overflow-x-hidden" style={{ borderColor: T.border }}>

          {/* Breadcrumb */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: T.textDim }}>
              Dashboard <span style={{ color: T.textDim }}>/</span> <span style={{ color: T.text, fontWeight: 500 }}>Alpha Options</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: T.green, padding: "3px 10px", borderRadius: 6, background: T.greenDim, border: `1px solid ${T.green}20` }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, boxShadow: `0 0 6px ${T.green}60` }} />
              Live Sync
            </div>
          </div>

          {/* Header */}
          <h1 className="text-xl md:text-2xl" style={{ fontWeight: 600, color: T.text, marginBottom: 6 }}>Alpha-Flow Options</h1>
          <p className="text-xs md:text-[13px]" style={{ color: T.textMuted, lineHeight: 1.6, maxWidth: 560, marginBottom: 20 }}>
            Scans call options for high-conviction swing trades — ranked by composite quant score.
          </p>

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
                <button key={val} onClick={() => { setUniverse(val as any); setExpandedTicker(null); setSelected(null); }}
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
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.textDim }}>
              <span>Δ ≥ 0.35</span><span>DTE: 90–150d</span><span>Prem: $1–$8</span>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={() => fetchData(true)} disabled={loading}
              style={{ fontSize: 12, fontWeight: 600, padding: "7px 20px", borderRadius: 6, cursor: "pointer", border: `1px solid ${loading ? T.border : T.gold}`, background: loading ? T.surface : T.goldDim, color: loading ? T.textMuted : T.gold, transition: "all 200ms ease-out" }}>
              {loading ? "Scanning…" : "Run Scan →"}
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
                                    onClick={() => { setSelected(c); onTickerSelect?.(c.ticker); }}
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
                <span>{data?.calls.length} contracts · {grouped.length} tickers · click ticker to expand contracts</span>
                <span>{data?.meta.universe_source}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANE (below on mobile) ── */}
        <div className="hidden lg:block" style={{ background: T.card, overflow: "auto", position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ padding: "16px 16px 8px", borderBottom: `1px solid ${T.border}`, fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Deep Dive
          </div>
          <ContextPanel call={selected} />
        </div>

        {/* Mobile: show context panel inline when a contract is selected */}
        {selected && (
          <div className="lg:hidden" style={{ background: T.card, borderTop: `1px solid ${T.border}`, margin: "0 -12px", padding: "0 12px" }}>
            <div style={{ padding: "12px 0 6px", fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>
              Deep Dive — {selected.ticker} ${selected.strike}
            </div>
            <ContextPanel call={selected} />
          </div>
        )}
      </div>
    </div>
  );
}
