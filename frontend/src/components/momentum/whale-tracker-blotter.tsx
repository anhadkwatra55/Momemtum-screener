"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8060";

interface WhaleSignal {
  ticker: string;
  stock_price: number;
  insider_name: string;
  insider_title: string;
  insider_shares: number;
  insider_value: number;
  insider_date: string;
  option_strike: number;
  option_expiry: string;
  option_dte: number;
  option_bid: number;
  option_ask: number;
  option_mid: number;
  option_volume: number;
  option_oi: number;
  option_iv: number;
  option_delta: number;
  option_spread_pct: number;
  vol_oi_ratio: number;
  whale_value_usd: number;
  breakeven: number;
  breakeven_pct: number;
  risk_tier: string;
  guardrail_liquid: boolean;
  guardrail_low_vol: boolean;
  guardrail_stable_time: boolean;
  guardrail_is_whale: boolean;
  days_apart: number;
}

interface WhaleData {
  signals: WhaleSignal[];
  meta: {
    universe_size: number;
    signals_found: number;
    s_tier_count: number;
    tickers_flagged: number;
    errors: number;
    guardrails: Record<string, string | number>;
  };
  audit_history: any[];
  timestamp: string;
}

type SortKey = "ticker" | "whale_value_usd" | "vol_oi_ratio" | "insider_value" | "option_dte" | "option_delta" | "breakeven_pct" | "risk_tier";

const TIER_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  "S-TIER SYNC": { text: "#00FF66", bg: "rgba(0,255,102,0.08)", border: "#00FF6640" },
  "HIGH-IV RISK": { text: "#FFD600", bg: "rgba(255,214,0,0.08)", border: "#FFD60040" },
  "LOW LIQUIDITY": { text: "#FF3333", bg: "rgba(255,51,51,0.08)", border: "#FF333340" },
  "SUB-INSTITUTIONAL": { text: "#6B6B6B", bg: "rgba(107,107,107,0.05)", border: "#2A2A2A" },
  "SHORT-TERM LOTTO": { text: "#FF3333", bg: "rgba(255,51,51,0.05)", border: "#FF333340" },
  "UNVERIFIED": { text: "#6B6B6B", bg: "rgba(107,107,107,0.05)", border: "#2A2A2A" },
};

function GuardrailBadge({ label, pass: pass_ }: { label: string; pass: boolean }) {
  return (
    <span
      className="text-[8px] font-mono-data uppercase px-1 py-0.5 rounded-[2px]"
      style={{
        color: pass_ ? "#00FF66" : "#FF3333",
        background: pass_ ? "rgba(0,255,102,0.06)" : "rgba(255,51,51,0.06)",
        border: `1px solid ${pass_ ? "#00FF6620" : "#FF333320"}`,
      }}
    >
      {label} {pass_ ? "✓" : "✗"}
    </span>
  );
}

interface WhaleTrackerBlotterProps {
  onTickerSelect?: (ticker: string) => void;
}

export function WhaleTrackerBlotter({ onTickerSelect }: WhaleTrackerBlotterProps) {
  const [data, setData] = useState<WhaleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("whale_value_usd");
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState<WhaleSignal | null>(null);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/screener/whale-tracker${refresh ? "?refresh=true" : ""}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = useMemo(() => {
    if (!data?.signals) return [];
    return [...data.signals].sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [data?.signals, sortKey, sortAsc]);

  return (
    <div className="pt-4 md:pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-[20px] font-bold md:text-[24px] font-mono-data tracking-[0.06em] text-[#E8E8E8] flex items-center gap-2">
            <span className="text-[#FFD600]">⚠</span> WHALE FLOW INTELLIGENCE
          </h1>
          <p className="text-[11px] text-[#6B6B6B] mt-1 font-mono-data">
            SEC Form 4 Insider Buys + Unusual Options Activity · 7-Day Sync Window · FlowProtocol Verified
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={loading}
          className="text-[10px] font-mono-data uppercase tracking-[0.08em] px-3 py-1.5 bg-transparent border border-[#2A2A2A] rounded-[2px] text-[#C0C0C0] hover:text-[#FFD600] hover:border-[#FFD600] transition-all duration-[50ms] disabled:opacity-40"
        >
          {loading ? "SCANNING..." : "SCAN FLOW"}
        </button>
      </div>

      {/* Stats Bar */}
      {data?.meta && (
        <div className="flex items-center gap-4 p-2.5 px-4 mb-4 rounded-[4px] overflow-x-auto" style={{ background: "#111111", border: "1px solid #2A2A2A" }}>
          <span className="text-[10px] font-mono-data uppercase tracking-[0.1em] text-[#6B6B6B] whitespace-nowrap">FLOW INTEL</span>
          <div className="w-px h-4 bg-[#2A2A2A]" />
          {[
            { l: "Universe", v: data.meta.universe_size, c: "#C0C0C0" },
            { l: "Signals", v: data.meta.signals_found, c: "#FFD600" },
            { l: "S-Tier", v: data.meta.s_tier_count, c: "#00FF66" },
            { l: "Tickers", v: data.meta.tickers_flagged, c: "#00FF66" },
          ].map(s => (
            <div key={s.l} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-[10px] font-mono-data text-[#6B6B6B]">{s.l}</span>
              <span className="text-[12px] font-mono-data font-bold" style={{ color: s.c }}>{s.v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-[3px] border-[#2A2A2A] border-t-[#FFD600] rounded-full animate-spin mb-4" />
          <p className="text-[12px] font-mono-data text-[#6B6B6B]">Scanning insider buys + unusual options activity... ~60s</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-[4px] border border-[#FF3333] bg-[#FF333308] mb-4">
          <p className="text-[12px] font-mono-data text-[#FF3333]">{error}</p>
          <button onClick={() => fetchData(true)} className="mt-2 text-[10px] font-mono-data px-3 py-1 border border-[#FF3333] rounded-[2px] text-[#FF3333]">RETRY</button>
        </div>
      )}

      {/* Empty */}
      {data && data.signals.length === 0 && !loading && (
        <div className="p-8 rounded-[4px] border border-[#2A2A2A] bg-[#111111] text-center">
          <p className="text-[14px] font-mono-data text-[#6B6B6B] mb-2">No whale flow signals detected</p>
          <p className="text-[11px] font-mono-data text-[#6B6B6B]">No insider purchases synced with unusual options activity within the 7-day window</p>
        </div>
      )}

      {/* Table + Detail */}
      {sorted.length > 0 && (
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Whale Blotter */}
          <div className="flex-1 min-w-0">
            <div className="rounded-[4px] overflow-hidden" style={{ background: "#111111", border: "1px solid #2A2A2A" }}>
              <div className="px-3 py-2 border-b border-[#2A2A2A]">
                <h2 className="text-[12px] font-mono-data uppercase tracking-[0.08em] text-[#6B6B6B]">
                  Whale Blotter — {sorted.length} Signals
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono-data">
                  <thead>
                    <tr className="border-b border-[#2A2A2A]">
                      {([
                        ["ticker", "TICKER"],
                        ["insider_value", "INSIDER $"],
                        ["whale_value_usd", "WHALE $"],
                        ["vol_oi_ratio", "VOL/OI"],
                        ["option_delta", "DELTA"],
                        ["option_dte", "DTE"],
                        ["breakeven_pct", "B/E%"],
                      ] as [SortKey, string][]).map(([key, label]) => (
                        <th
                          key={key}
                          className="px-2.5 py-2.5 text-left text-[10px] text-[#6B6B6B] uppercase tracking-[0.06em] cursor-pointer hover:text-[#FFD600] transition-colors duration-[50ms] select-none whitespace-nowrap"
                          onClick={() => handleSort(key)}
                        >
                          {label}
                          {sortKey === key && <span className="ml-1 text-[#FFD600]">{sortAsc ? "↑" : "↓"}</span>}
                        </th>
                      ))}
                      <th className="px-2.5 py-2.5 text-left text-[10px] text-[#6B6B6B]">RISK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s, i) => {
                      const tier = TIER_COLORS[s.risk_tier] || TIER_COLORS["UNVERIFIED"];
                      return (
                        <motion.tr
                          key={`${s.ticker}-${s.option_strike}-${s.option_expiry}-${i}`}
                          className={`border-b border-[#1C1C1C] cursor-pointer transition-colors duration-[75ms] ${selected?.ticker === s.ticker && selected?.option_strike === s.option_strike ? "bg-[#1C1C1C]" : "hover:bg-[#0A0A0A]"}`}
                          onClick={() => setSelected(s)}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.015, 0.3) }}
                        >
                          <td className="px-2.5 py-2.5">
                            <div className="flex flex-col">
                              <span className="font-bold text-[#E8E8E8]">{s.ticker}</span>
                              <span className="text-[9px] text-[#6B6B6B]">${s.stock_price}</span>
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5">
                            <div className="flex flex-col">
                              <span className="text-[#FFD600] font-bold">${(s.insider_value / 1000).toFixed(0)}k</span>
                              <span className="text-[9px] text-[#6B6B6B] truncate max-w-[80px]">{s.insider_name.split(" ").slice(0, 2).join(" ")}</span>
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5 font-bold" style={{ color: s.whale_value_usd >= 500000 ? "#00FF66" : s.whale_value_usd >= 100000 ? "#FFD600" : "#C0C0C0" }}>
                            ${(s.whale_value_usd / 1000).toFixed(0)}k
                          </td>
                          <td className="px-2.5 py-2.5 font-bold" style={{ color: s.vol_oi_ratio >= 5 ? "#00FF66" : s.vol_oi_ratio >= 2.5 ? "#FFD600" : "#C0C0C0" }}>
                            {s.vol_oi_ratio.toFixed(1)}x
                          </td>
                          <td className="px-2.5 py-2.5" style={{ color: s.option_delta >= 0.6 ? "#00FF66" : "#C0C0C0" }}>
                            {s.option_delta.toFixed(3)}
                          </td>
                          <td className="px-2.5 py-2.5" style={{ color: s.option_dte <= 30 ? "#FF3333" : "#C0C0C0" }}>
                            {s.option_dte}d
                          </td>
                          <td className="px-2.5 py-2.5" style={{ color: s.breakeven_pct <= 5 ? "#00FF66" : s.breakeven_pct <= 10 ? "#FFD600" : "#FF3333" }}>
                            {s.breakeven_pct > 0 ? "+" : ""}{s.breakeven_pct.toFixed(1)}%
                          </td>
                          <td className="px-2.5 py-2.5">
                            <span
                              className="text-[9px] uppercase px-1.5 py-0.5 rounded-[2px] whitespace-nowrap"
                              style={{ color: tier.text, background: tier.bg, border: `1px solid ${tier.border}` }}
                            >
                              {s.risk_tier}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detail Panel */}
          <AnimatePresence>
            {selected && (
              <motion.div
                className="xl:w-[360px] shrink-0"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
              >
                <div className="p-4 rounded-[4px] sticky top-16" style={{ background: "#111111", border: "1px solid #2A2A2A" }}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[16px] font-bold text-[#E8E8E8] font-mono-data">{selected.ticker}</h3>
                    <button onClick={() => setSelected(null)} className="text-[10px] text-[#6B6B6B] hover:text-[#FF3333]">✕</button>
                  </div>

                  {/* Risk Tier Badge */}
                  <div className="mb-3">
                    <span
                      className="text-[11px] uppercase px-2 py-1 rounded-[2px] font-bold"
                      style={{
                        color: (TIER_COLORS[selected.risk_tier] || TIER_COLORS["UNVERIFIED"]).text,
                        background: (TIER_COLORS[selected.risk_tier] || TIER_COLORS["UNVERIFIED"]).bg,
                        border: `1px solid ${(TIER_COLORS[selected.risk_tier] || TIER_COLORS["UNVERIFIED"]).border}`,
                      }}
                    >
                      {selected.risk_tier}
                    </span>
                  </div>

                  {/* Guardrails */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    <GuardrailBadge label="LIQUID" pass={selected.guardrail_liquid} />
                    <GuardrailBadge label="IV" pass={selected.guardrail_low_vol} />
                    <GuardrailBadge label="TIME" pass={selected.guardrail_stable_time} />
                    <GuardrailBadge label="WHALE" pass={selected.guardrail_is_whale} />
                  </div>

                  {/* Insider Data */}
                  <div className="p-2.5 rounded-[2px] mb-3" style={{ background: "#0A0A0A", borderLeft: "2px solid #FFD600" }}>
                    <div className="text-[9px] text-[#6B6B6B] uppercase mb-1">INSIDER PURCHASE</div>
                    <div className="text-[12px] text-[#E8E8E8] font-bold">{selected.insider_name}</div>
                    <div className="text-[10px] text-[#6B6B6B]">{selected.insider_title}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[12px] text-[#FFD600] font-bold">${selected.insider_value.toLocaleString()}</span>
                      <span className="text-[10px] text-[#6B6B6B]">{selected.insider_shares.toLocaleString()} shares</span>
                      <span className="text-[10px] text-[#6B6B6B]">{selected.insider_date}</span>
                    </div>
                  </div>

                  {/* Option Data */}
                  <div className="p-2.5 rounded-[2px] mb-3" style={{ background: "#0A0A0A", borderLeft: "2px solid #00FF66" }}>
                    <div className="text-[9px] text-[#6B6B6B] uppercase mb-1">WHALE OPTION ACTIVITY</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { l: "Strike", v: `$${selected.option_strike}` },
                        { l: "Expiry", v: selected.option_expiry },
                        { l: "DTE", v: `${selected.option_dte}d` },
                        { l: "Delta", v: selected.option_delta.toFixed(3) },
                        { l: "Vol/OI", v: `${selected.vol_oi_ratio}x` },
                        { l: "Volume", v: selected.option_volume.toLocaleString() },
                        { l: "OI", v: selected.option_oi.toLocaleString() },
                        { l: "IV", v: `${selected.option_iv}%` },
                        { l: "Bid/Ask", v: `${selected.option_bid}/${selected.option_ask}` },
                        { l: "Spread", v: `${selected.option_spread_pct}%` },
                        { l: "Whale $", v: `$${(selected.whale_value_usd / 1000).toFixed(0)}k` },
                        { l: "B/E %", v: `${selected.breakeven_pct > 0 ? "+" : ""}${selected.breakeven_pct}%` },
                      ].map(m => (
                        <div key={m.l} className="py-0.5">
                          <div className="text-[8px] text-[#6B6B6B] uppercase">{m.l}</div>
                          <div className="text-[11px] text-[#E8E8E8] font-mono-data">{m.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sync Window */}
                  <div className="text-[10px] text-[#6B6B6B] font-mono-data text-center">
                    Insider → Whale sync: <b className="text-[#FFD600]">{selected.days_apart} days apart</b>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
