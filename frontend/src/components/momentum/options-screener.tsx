"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { getAuthHeaders } from "@/services/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8060";

/* ── Contract type from Hidden Alpha Engine ── */
interface Contract {
  ticker: string; spot: number; strike: number; expiry: string;
  dte: number; option_type: string; bid: number; ask: number;
  mid_price: number; volume: number; open_interest: number;
  iv: number; delta: number; skew_adj_delta: number;
  gamma: number; theta: number; vega: number;
  total_premium: number; moneyness: number;
  bad_vrp: number; good_vrp: number; total_net_gex: number; hv: number;
}

/* Spread type for bull/bear spreads */
interface SpreadContract {
  ticker: string; expiry: string; dte: number;
  short_strike: number; long_strike: number; width: number;
  credit: number; margin: number; ptm_ratio: number;
  net_delta: number; short_iv: number; hv: number; spot: number;
}

interface TabData {
  data: (Contract | SpreadContract)[];
  count: number; label: string; description: string;
  emoji: string; color: string;
}

interface HiddenAlphaData {
  tabs: Record<string, TabData>;
  structural: {
    gamma_squeeze: { data: any[]; count: number; label: string };
    vrp_asymmetry: { data: any[]; count: number; label: string };
  };
  gex_summary: { short_gamma: number; long_gamma: number; total_tickers: number };
  meta: { universe_size: number; total_contracts: number; scan_timestamp: string; scan_time_seconds?: number; tickers_scanned?: number };
  scanning?: boolean;
  status?: { state: string; progress: number; total: number; message: string };
  message?: string;
}

/* ── Tokens (matches dashboard dark theme) ── */
const T = {
  bg: "#0d0d0d", card: "#1a1a1a", cardHover: "#222222", surface: "#222222",
  border: "#2d2d2d", borderLight: "#363636",
  text: "#e0e0e0", textSec: "#a0a0a0", textMuted: "#707070", textDim: "#505050",
  gold: "#e2b857", goldDim: "rgba(226,184,87,0.12)",
  purple: "#9f7aea", purpleDim: "rgba(159,122,234,0.10)",
  green: "#4ade80", greenDim: "rgba(74,222,128,0.10)",
  red: "#e05252", redDim: "rgba(224,82,82,0.10)",
  cyan: "#22d3ee", cyanDim: "rgba(34,211,238,0.08)",
  amber: "#fbbf24", amberDim: "rgba(251,191,36,0.10)",
  rose: "#fb7185", roseDim: "rgba(251,113,133,0.10)",
  orange: "#fb923c", orangeDim: "rgba(251,146,60,0.10)",
  blue: "#60a5fa", blueDim: "rgba(96,165,250,0.10)",
  violet: "#a78bfa", violetDim: "rgba(167,139,250,0.10)",
};

/* Tab display config */
const TAB_ORDER = [
  { id: "bullish", tooltip: "Stocks where traders are buying way more calls than usual — a sign big players expect the price to go up. Based on UOA (Unusual Options Activity).", colorKey: "green" },
  { id: "bearish", tooltip: "Puts with extreme volume relative to open interest, in a high bad-VRP environment. Smart money is hedging or betting on downside.", colorKey: "red" },
  { id: "conviction_calls", tooltip: "The biggest, most expensive call option bets in the market — top 5% premium, only placed by very confident institutional investors.", colorKey: "cyan" },
  { id: "conviction_puts", tooltip: "Massive put premium bets in negative gamma environments — institutions expect a significant move down.", colorKey: "violet" },
  { id: "leaps", tooltip: "Long-dated options (4+ months) where implied volatility is cheaper than historical volatility — you're getting a discount on time.", colorKey: "blue" },
  { id: "put_sells", tooltip: "High-probability put selling opportunities where IV > HV — ideal for income strategies. Ranked by annualized return on capital.", colorKey: "amber" },
  { id: "gamma_lottos", tooltip: "Ultra-cheap calls (<$1) near the stock price that expire within 14 days — small bets that can multiply 5-10× on a gamma squeeze.", colorKey: "orange" },
  { id: "bull_spreads", tooltip: "Bull put credit spreads with optimal premium-to-margin ratios. Short IV > HV ensures you're selling overpriced volatility.", colorKey: "green" },
  { id: "bear_spreads", tooltip: "Bear call credit spreads for bearish positioning with defined risk. High P/M ratio means maximum income per dollar of risk.", colorKey: "rose" },
];

const TAB_COLORS: Record<string, { color: string; dim: string }> = {
  green: { color: T.green, dim: T.greenDim },
  red: { color: T.red, dim: T.redDim },
  cyan: { color: T.cyan, dim: T.cyanDim },
  violet: { color: T.violet, dim: T.violetDim },
  blue: { color: T.blue, dim: T.blueDim },
  amber: { color: T.amber, dim: T.amberDim },
  orange: { color: T.orange, dim: T.orangeDim },
  rose: { color: T.rose, dim: T.roseDim },
  emerald: { color: T.green, dim: T.greenDim },
};

const isSpread = (tabId: string) => tabId === "bull_spreads" || tabId === "bear_spreads";

/* ── Time Ago ── */
function timeAgo(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60000) return "just now";
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch { return ""; }
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
interface Props { onTickerSelect?: (ticker: string) => void; }

export function OptionsScreener({ onTickerSelect }: Props) {
  const [data, setData] = useState<HiddenAlphaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("bullish");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fetch from Hidden Alpha engine ── */
  const fetchData = useCallback(async () => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/options/screener`, { headers: getAuthHeaders() });
      const result = await res.json();

      if (res.status === 202 || result.scanning) {
        // Pipeline is scanning — show progress and poll
        setScanning(true);
        setScanMessage(result.status?.message || result.message || "Scanning options chains…");
        setLoading(false);
        pollRef.current = setTimeout(fetchData, 5_000);
        return;
      }
      if (!res.ok) throw new Error(`Server error (HTTP ${res.status})`);

      setData(result);
      setScanning(false);
      setLoading(false);

      // Poll every 2 min for updates
      pollRef.current = setTimeout(fetchData, 120_000);
    } catch (e: any) {
      if (!data?.tabs) setError(e.message || "Failed to fetch options data");
      setLoading(false);
      pollRef.current = setTimeout(fetchData, 10_000);
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  /* ── Active tab data ── */
  const activeTabData = data?.tabs?.[activeTab];
  const contracts = activeTabData?.data || [];
  const tabLabel = activeTabData?.label || activeTab;
  const tabDescription = activeTabData?.description || "";
  const tabEmoji = activeTabData?.emoji || "";
  const tabConfig = TAB_ORDER.find(t => t.id === activeTab) || TAB_ORDER[0];
  const tabColor = TAB_COLORS[tabConfig.colorKey] || TAB_COLORS.green;

  /* ── Total signals ── */
  const totalContracts = useMemo(() => {
    if (!data?.tabs) return 0;
    return Object.values(data.tabs).reduce((sum, tab) => sum + (tab.count || 0), 0);
  }, [data]);

  const totalTickers = data?.meta?.universe_size || data?.meta?.tickers_scanned || 0;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: T.text }}>

      {/* ── Breadcrumb ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: T.textDim }}>
          Dashboard <span style={{ color: T.textDim }}>/</span>{" "}
          <span style={{ color: T.text, fontWeight: 500 }}>Options Screener</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {scanning && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: T.gold, padding: "3px 10px", borderRadius: 6, background: T.goldDim, border: `1px solid ${T.gold}20` }}>
              <div style={{ width: 10, height: 10, border: `2px solid ${T.gold}40`, borderTopColor: T.gold, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              {scanMessage || "Pipeline scanning…"}
            </div>
          )}
          {data?.meta?.scan_timestamp && (
            <div style={{ fontSize: 10, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: T.green, boxShadow: `0 0 4px ${T.green}60` }} />
              Live · {timeAgo(data.meta.scan_timestamp)}
            </div>
          )}
        </div>
      </div>

      {/* ── Header ── */}
      <h1 className="text-xl md:text-2xl" style={{ fontWeight: 600, color: T.text, marginBottom: 4 }}>
        Hidden Alpha — Options Screener
      </h1>
      <p className="text-xs md:text-[13px]" style={{ color: T.textMuted, lineHeight: 1.6, maxWidth: 700, marginBottom: 20 }}>
        Quant-powered 9-tab screener with Black-Scholes Greeks, GEX profiles, VRP asymmetry, and skew-adjusted delta.
        Matches the Colab prototype — fully automated, no manual scanning required.
      </p>

      {/* ── Stats Row ── */}
      {data?.meta && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { t: `${totalContracts} signals`, c: T.green },
            { t: `${totalTickers} tickers`, c: T.gold },
            { t: `${(data.meta.total_contracts || 0).toLocaleString()} contracts`, c: T.cyan },
            ...(data.gex_summary ? [
              { t: `${data.gex_summary.short_gamma} short γ`, c: T.red },
              { t: `${data.gex_summary.long_gamma} long γ`, c: T.green },
            ] : []),
            ...(data.meta.scan_time_seconds ? [{ t: `${data.meta.scan_time_seconds.toFixed(0)}s scan`, c: T.textDim }] : []),
          ].map(b => (
            <span key={b.t} style={{ fontSize: 10, fontWeight: 500, color: b.c, border: `1px solid ${b.c}30`, borderRadius: 6, padding: "3px 10px" }}>{b.t}</span>
          ))}
        </div>
      )}

      {/* ── 9-Tab Navigation ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
        {TAB_ORDER.map(tab => {
          const isActive = activeTab === tab.id;
          const tabData = data?.tabs?.[tab.id];
          const count = tabData?.count || 0;
          const emoji = tabData?.emoji || "";
          const label = tabData?.label || tab.id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          const { color, dim } = TAB_COLORS[tab.colorKey] || TAB_COLORS.green;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                fontSize: 11, fontWeight: isActive ? 600 : 400,
                border: `1px solid ${isActive ? `${color}50` : T.border}`,
                background: isActive ? dim : "transparent",
                color: isActive ? T.text : T.textMuted,
                transition: "all 150ms ease",
              }}
            >
              <span>{emoji}</span>
              <span>{label}</span>
              <span style={{
                fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 4,
                background: isActive ? `${color}25` : T.surface,
                color: isActive ? color : T.textDim,
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Tooltip ── */}
      <div style={{ padding: "10px 0 16px", fontSize: 12, color: T.textSec, lineHeight: 1.5 }}>
        <strong style={{ color: T.text }}>What this means:</strong> {tabConfig.tooltip}
        {tabDescription && (
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
            Filter: {tabDescription}
          </div>
        )}
      </div>

      {/* ── Loading State ── */}
      {loading && !data && !scanning && (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ width: 36, height: 36, border: `2px solid ${T.border}`, borderTopColor: T.gold, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ fontSize: 13, color: T.textMuted }}>Connecting to Hidden Alpha engine…</p>
        </div>
      )}

      {/* ── Scanning State ── */}
      {scanning && !data && (
        <div style={{ textAlign: "center", padding: "60px 0", background: T.card, borderRadius: 8, border: `1px solid ${T.border}` }}>
          <div style={{ width: 36, height: 36, border: `2px solid ${T.border}`, borderTopColor: T.gold, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ fontSize: 14, color: T.gold, fontWeight: 500 }}>🔬 Hidden Alpha Pipeline Scanning</p>
          <p style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{scanMessage}</p>
          <p style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>First scan takes ~3-5 minutes. Results will appear automatically.</p>
        </div>
      )}

      {/* ── Error State ── */}
      {error && (
        <div style={{ padding: 16, borderRadius: 8, border: `1px solid ${T.red}30`, background: T.redDim, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 13, color: T.red, margin: 0 }}>{error}</p>
          <button onClick={fetchData} style={{ fontSize: 11, fontWeight: 600, padding: "5px 14px", borderRadius: 6, cursor: "pointer", border: `1px solid ${T.red}40`, background: "transparent", color: T.red }}>Retry</button>
        </div>
      )}

      {/* ── Empty State ── */}
      {data && contracts.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "60px 0", background: T.card, borderRadius: 8, border: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 24, marginBottom: 8 }}>{tabEmoji || "📊"}</p>
          <p style={{ fontSize: 14, color: T.textSec, fontWeight: 500 }}>No contracts match the {tabLabel} filter</p>
          <p style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>
            Strict quant filters mean fewer but higher quality results. Try a different tab.
          </p>
        </div>
      )}

      {/* ── CONTRACTS TABLE (Standard contracts) ── */}
      {contracts.length > 0 && !isSpread(activeTab) && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: T.surface }}>
                  {["#", "Ticker", "Type", "Spot", "Strike", "Exp", "DTE", "Δ", "Premium", "Vol", "OI", "IV%", "HV%", "θ", "γ", "VRP"].map(h => (
                    <th key={h} style={{
                      padding: "8px 10px", textAlign: h === "#" ? "center" : "left",
                      fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em",
                      fontWeight: 500, borderBottom: `1px solid ${T.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(contracts as Contract[]).slice(0, 100).map((c, i) => (
                  <tr
                    key={`${c.ticker}-${c.strike}-${c.expiry}-${i}`}
                    onClick={() => onTickerSelect?.(c.ticker)}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      cursor: onTickerSelect ? "pointer" : "default",
                      borderBottom: `1px solid ${T.border}`,
                      background: hoveredRow === i ? T.cardHover : i < 3 ? `${tabColor.color}06` : "transparent",
                      transition: "background 150ms ease",
                    }}
                  >
                    <td style={{ padding: "7px 10px", textAlign: "center" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 20, height: 20, borderRadius: "50%", fontSize: 9, fontWeight: 600,
                        background: i < 3 ? T.goldDim : T.surface,
                        color: i < 3 ? T.gold : T.textDim,
                        border: `1px solid ${i < 3 ? `${T.gold}40` : T.border}`,
                      }}>{i + 1}</span>
                    </td>
                    <td className="font-mono" style={{ padding: "7px 10px", fontWeight: 700, color: T.text, letterSpacing: "0.02em" }}>{c.ticker}</td>
                    <td style={{ padding: "7px 10px" }}>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: c.option_type === "call" ? T.greenDim : T.redDim, color: c.option_type === "call" ? T.green : T.red }}>
                        {c.option_type?.toUpperCase()}
                      </span>
                    </td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.textSec }}>${c.spot}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", fontWeight: 600, color: T.text }}>${c.strike}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.textDim, fontSize: 10 }}>{c.expiry}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: c.dte <= 14 ? T.orange : c.dte <= 45 ? T.gold : T.textSec }}>{c.dte}d</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: Math.abs(c.delta) >= 0.40 ? T.green : T.textSec, fontWeight: 600 }}>{c.delta?.toFixed(2)}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.gold, fontWeight: 600 }}>${c.mid_price}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: c.volume > 500 ? T.cyan : T.textSec }}>{c.volume?.toLocaleString()}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.textSec }}>{c.open_interest?.toLocaleString()}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: c.iv > 50 ? T.orange : T.textSec }}>{c.iv?.toFixed(1)}%</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.textSec }}>{c.hv?.toFixed(1)}%</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.red }}>{c.theta?.toFixed(2)}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.purple }}>{c.gamma?.toFixed(4)}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: c.bad_vrp > 0 ? T.red : c.good_vrp > 0 ? T.green : T.textDim }}>
                      {c.bad_vrp > 0.001 ? `B:${c.bad_vrp.toFixed(3)}` : c.good_vrp > 0.001 ? `G:${c.good_vrp.toFixed(3)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Footer ── */}
          <div style={{ padding: "8px 14px", fontSize: 10, color: T.textDim, display: "flex", justifyContent: "space-between", borderTop: `1px solid ${T.border}` }}>
            <span>Showing {Math.min(100, contracts.length)} of {contracts.length} · {tabLabel} filter · Click any row for ticker detail</span>
            <span>Hidden Alpha Engine · Powered by GEX + VRP</span>
          </div>
        </div>
      )}

      {/* ── SPREADS TABLE ── */}
      {contracts.length > 0 && isSpread(activeTab) && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", minWidth: 800 }}>
              <thead>
                <tr style={{ background: T.surface }}>
                  {["#", "Ticker", "Spot", "Short K", "Long K", "Width", "Credit", "Margin", "P/M Ratio", "Net Δ", "Short IV%", "HV%", "DTE"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: h === "#" ? "center" : "left", fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(contracts as SpreadContract[]).slice(0, 50).map((c, i) => (
                  <tr
                    key={`${c.ticker}-${c.short_strike}-${c.long_strike}-${i}`}
                    onClick={() => onTickerSelect?.(c.ticker)}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      cursor: onTickerSelect ? "pointer" : "default",
                      borderBottom: `1px solid ${T.border}`,
                      background: hoveredRow === i ? T.cardHover : "transparent",
                      transition: "background 150ms ease",
                    }}
                  >
                    <td style={{ padding: "7px 10px", textAlign: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", fontSize: 9, fontWeight: 600, background: i < 3 ? T.goldDim : T.surface, color: i < 3 ? T.gold : T.textDim, border: `1px solid ${i < 3 ? `${T.gold}40` : T.border}` }}>{i + 1}</span>
                    </td>
                    <td className="font-mono" style={{ padding: "7px 10px", fontWeight: 700, color: T.text }}>{c.ticker}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.textSec }}>${c.spot}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.text, fontWeight: 600 }}>${c.short_strike}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.textSec }}>${c.long_strike}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.textSec }}>${c.width}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.green, fontWeight: 600 }}>${c.credit}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.textSec }}>${c.margin}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: c.ptm_ratio > 0.3 ? T.gold : T.textSec, fontWeight: 600 }}>{(c.ptm_ratio * 100).toFixed(1)}%</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.textSec }}>{c.net_delta?.toFixed(3)}</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: c.short_iv > c.hv ? T.green : T.red }}>{c.short_iv}%</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: T.textSec }}>{c.hv}%</td>
                    <td className="font-mono" style={{ padding: "7px 10px", color: c.dte <= 14 ? T.orange : T.textSec }}>{c.dte}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "8px 14px", fontSize: 10, color: T.textDim, display: "flex", justifyContent: "space-between", borderTop: `1px solid ${T.border}` }}>
            <span>Showing {Math.min(50, contracts.length)} of {contracts.length} · {tabLabel}</span>
            <span>Ranked by Premium/Margin ratio</span>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
