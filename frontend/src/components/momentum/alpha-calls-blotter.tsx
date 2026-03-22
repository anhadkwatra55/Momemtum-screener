"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConvictionBadge, ActionBadge } from "@/components/momentum/conviction-badge";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8060";

interface AlphaCall {
  ticker: string;
  company_name: string;
  sector: string;
  stock_price: number;
  strike: number;
  expiration: string;
  dte: number;
  bid: number;
  ask: number;
  mid_price: number;
  volume: number;
  open_interest: number;
  implied_volatility: number;
  spread_pct: number;
  approx_delta: number;
  breakeven: number;
  breakeven_pct: number;
  expected_value: number;
  ensemble_score: number;
  momentum_probability: number;
  conviction_tier: string;
  action_category: string;
  regime: string;
  momentum_phase: string;
  thesis: string;
  price_target: number | null;
  iv_percentile: number | null;
  crowding_index: number;
  is_crowded: boolean;
  iv_warning: boolean;
  risk_flag: string;
}

interface AlphaCallsData {
  calls: AlphaCall[];
  meta: {
    universe_size: number;
    candidates_screened: number;
    contracts_found: number;
    tickers_with_calls: number;
    errors: number;
  };
  timestamp: string;
}

type SortKey = "ticker" | "strike" | "dte" | "approx_delta" | "breakeven_pct" | "expected_value" | "implied_volatility" | "ensemble_score" | "spread_pct";

interface AlphaCallsBlotterProps {
  onTickerSelect?: (ticker: string) => void;
}

export function AlphaCallsBlotter({ onTickerSelect }: AlphaCallsBlotterProps) {
  const [data, setData] = useState<AlphaCallsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("expected_value");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/screener/alpha-calls${refresh ? "?refresh=true" : ""}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortedCalls = useMemo(() => {
    if (!data?.calls) return [];
    return [...data.calls].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "string") return sortAsc ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [data?.calls, sortKey, sortAsc]);

  const selectedCalls = useMemo(
    () => sortedCalls.filter((c) => c.ticker === selectedTicker),
    [sortedCalls, selectedTicker]
  );

  return (
    <div className="pt-4 md:pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-[20px] font-bold md:text-[24px] font-mono-data tracking-[0.06em] text-[#E8E8E8] flex items-center gap-2">
            <span className="text-[#FFD600]">◆</span> ALPHA CALL OPTIONS
          </h1>
          <p className="text-[11px] text-[#6B6B6B] mt-1 font-mono-data">
            Zacks criteria + HEADSTART Momentum overlay · Price≥$50 · Δ≥0.40 · DTE 90-150d · Spread≤10% · Ensemble&gt;1.5
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          className="text-[10px] font-mono-data uppercase tracking-[0.08em] px-3 py-1.5 bg-[#111111] border border-[#2A2A2A] rounded-[2px] text-[#C0C0C0] hover:text-[#00FF66] hover:border-[#00FF66] transition-all duration-[50ms]"
          disabled={loading}
        >
          {loading ? "SCANNING..." : "REFRESH SCAN"}
        </button>
      </div>

      {/* Stats Bar */}
      {data?.meta && (
        <div className="flex items-center gap-4 p-2.5 px-4 mb-4 rounded-[4px] overflow-x-auto" style={{ background: "#111111", border: "1px solid #2A2A2A" }}>
          <span className="text-[10px] font-mono-data uppercase tracking-[0.1em] text-[#6B6B6B] whitespace-nowrap">SCAN</span>
          <div className="w-px h-4 bg-[#2A2A2A]" />
          {[
            { l: "Universe", v: data.meta.universe_size, c: "#C0C0C0" },
            { l: "Candidates", v: data.meta.candidates_screened, c: "#FFD600" },
            { l: "Contracts", v: data.meta.contracts_found, c: "#00FF66" },
            { l: "Tickers", v: data.meta.tickers_with_calls, c: "#00FF66" },
          ].map((s) => (
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
          <p className="text-[12px] font-mono-data text-[#6B6B6B]">Scanning option chains... This may take 30-60s.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-[4px] border border-[#FF3333] bg-[#FF333310] mb-4">
          <p className="text-[12px] font-mono-data text-[#FF3333]">{error}</p>
          <button onClick={() => fetchData(true)} className="mt-2 text-[10px] font-mono-data px-3 py-1 border border-[#FF3333] rounded-[2px] text-[#FF3333] hover:bg-[#FF333320]">RETRY</button>
        </div>
      )}

      {/* Empty */}
      {data && data.calls.length === 0 && !loading && (
        <div className="p-8 rounded-[4px] border border-[#2A2A2A] bg-[#111111] text-center">
          <p className="text-[14px] font-mono-data text-[#6B6B6B] mb-2">No qualifying Alpha Calls found</p>
          <p className="text-[11px] font-mono-data text-[#6B6B6B]">
            Filters: Price≥$50 · Ensemble≥1.5 · Trending · Δ≥0.40 · DTE 90-150d · Spread≤10%
          </p>
        </div>
      )}

      {/* Table + Detail */}
      {data && data.calls.length > 0 && (
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Blotter Table */}
          <div className="flex-1 min-w-0">
            <div className="rounded-[4px] overflow-hidden" style={{ background: "#111111", border: "1px solid #2A2A2A" }}>
              <div className="px-3 py-2 border-b border-[#2A2A2A]">
                <h2 className="text-[12px] font-mono-data uppercase tracking-[0.08em] text-[#6B6B6B]">
                  Options Blotter — {sortedCalls.length} Contracts
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono-data">
                  <thead>
                    <tr className="border-b border-[#2A2A2A]">
                      {[
                        { key: "ticker", label: "TICKER" },
                        { key: "strike", label: "STRIKE" },
                        { key: "dte", label: "DTE" },
                        { key: "approx_delta", label: "DELTA" },
                        { key: "spread_pct", label: "SPREAD" },
                        { key: "implied_volatility", label: "IV" },
                        { key: "breakeven_pct", label: "B/E %" },
                        { key: "expected_value", label: "EV" },
                        { key: "ensemble_score", label: "ENS" },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className="px-2 py-2 text-left text-[10px] text-[#6B6B6B] uppercase tracking-[0.08em] cursor-pointer hover:text-[#00FF66] transition-colors duration-[50ms] select-none whitespace-nowrap"
                          onClick={() => handleSort(col.key as SortKey)}
                        >
                          {col.label}
                          {sortKey === col.key && <span className="ml-1 text-[#00FF66]">{sortAsc ? "↑" : "↓"}</span>}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-left text-[10px] text-[#6B6B6B]">RISK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCalls.map((c, i) => (
                      <motion.tr
                        key={`${c.ticker}-${c.strike}-${c.expiration}`}
                        className={`border-b border-[#1C1C1C] cursor-pointer transition-colors duration-[50ms] ${selectedTicker === c.ticker ? "bg-[#1C1C1C]" : "hover:bg-[#0A0A0A]"}`}
                        onClick={() => setSelectedTicker(c.ticker === selectedTicker ? null : c.ticker)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.01, 0.3) }}
                      >
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#E8E8E8]">{c.ticker}</span>
                            <span className="text-[9px] text-[#6B6B6B]">${c.stock_price}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-[#C0C0C0]">${c.strike}</td>
                        <td className="px-2 py-2 text-[#C0C0C0]">{c.dte}d</td>
                        <td className="px-2 py-2" style={{ color: c.approx_delta >= 0.5 ? "#00FF66" : "#FFD600" }}>{c.approx_delta.toFixed(2)}</td>
                        <td className="px-2 py-2" style={{ color: c.spread_pct <= 5 ? "#00FF66" : "#FFD600" }}>{c.spread_pct}%</td>
                        <td className="px-2 py-2" style={{ color: c.iv_warning ? "#FF3333" : "#C0C0C0" }}>{c.implied_volatility}%</td>
                        <td className="px-2 py-2" style={{ color: c.breakeven_pct <= 5 ? "#00FF66" : c.breakeven_pct <= 10 ? "#FFD600" : "#FF3333" }}>+{c.breakeven_pct}%</td>
                        <td className="px-2 py-2 font-bold" style={{ color: c.expected_value > 0 ? "#00FF66" : "#FF3333" }}>${c.expected_value.toFixed(2)}</td>
                        <td className="px-2 py-2" style={{ color: "#00FF66" }}>{c.ensemble_score.toFixed(2)}</td>
                        <td className="px-2 py-2">
                          <span
                            className="text-[9px] uppercase px-1.5 py-0.5 rounded-[2px]"
                            style={{
                              color: c.risk_flag === "CLEAR" ? "#00FF66" : c.risk_flag === "HIGH RISK" ? "#FF3333" : "#FFD600",
                              background: c.risk_flag === "CLEAR" ? "rgba(0,255,102,0.08)" : c.risk_flag === "HIGH RISK" ? "rgba(255,51,51,0.08)" : "rgba(255,214,0,0.08)",
                              border: `1px solid ${c.risk_flag === "CLEAR" ? "#00FF6640" : c.risk_flag === "HIGH RISK" ? "#FF333340" : "#FFD60040"}`,
                            }}
                          >
                            {c.risk_flag}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detail Panel */}
          <AnimatePresence>
            {selectedTicker && selectedCalls.length > 0 && (
              <motion.div
                className="xl:w-[340px] shrink-0"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
              >
                <div className="p-4 rounded-[4px] sticky top-16" style={{ background: "#111111", border: "1px solid #2A2A2A" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-[16px] font-bold text-[#E8E8E8] font-mono-data">{selectedTicker}</h3>
                      <p className="text-[10px] text-[#6B6B6B] font-mono-data">{selectedCalls[0]?.company_name} · {selectedCalls[0]?.sector}</p>
                    </div>
                    <button onClick={() => setSelectedTicker(null)} className="text-[10px] text-[#6B6B6B] hover:text-[#FF3333]">✕</button>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <ConvictionBadge tier={selectedCalls[0]?.conviction_tier as any} />
                    <ActionBadge action={selectedCalls[0]?.action_category as any} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { l: "Stock Price", v: `$${selectedCalls[0]?.stock_price}`, c: "#E8E8E8" },
                      { l: "Ensemble", v: selectedCalls[0]?.ensemble_score.toFixed(2), c: "#00FF66" },
                      { l: "Probability", v: `${selectedCalls[0]?.momentum_probability}%`, c: "#00FF66" },
                      { l: "Price Target", v: selectedCalls[0]?.price_target ? `$${selectedCalls[0].price_target}` : "N/A", c: "#FFD600" },
                      { l: "IV Percentile", v: selectedCalls[0]?.iv_percentile != null ? `${selectedCalls[0].iv_percentile}%` : "N/A", c: selectedCalls[0]?.iv_warning ? "#FF3333" : "#C0C0C0" },
                      { l: "Crowding", v: `${selectedCalls[0]?.crowding_index}`, c: selectedCalls[0]?.is_crowded ? "#FF3333" : "#00FF66" },
                    ].map((m) => (
                      <div key={m.l} className="py-1">
                        <div className="text-[9px] text-[#6B6B6B] uppercase">{m.l}</div>
                        <div className="text-[13px] font-bold font-mono-data" style={{ color: m.c }}>{m.v}</div>
                      </div>
                    ))}
                  </div>

                  {selectedCalls[0]?.thesis && (
                    <div className="px-2.5 py-2 rounded-[2px] mb-3" style={{ background: "#0A0A0A", borderLeft: "2px solid #FFD600" }}>
                      <p className="text-[11px] text-[#C0C0C0] leading-[1.5] italic">&ldquo;{selectedCalls[0].thesis}&rdquo;</p>
                    </div>
                  )}

                  <div className="text-[10px] text-[#6B6B6B] uppercase tracking-[0.08em] mb-2">{selectedCalls.length} Strike{selectedCalls.length > 1 ? "s" : ""}</div>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {selectedCalls.map((c) => (
                      <div key={`${c.strike}-${c.expiration}`} className="flex items-center justify-between py-1.5 px-2 rounded-[2px] bg-[#0A0A0A]">
                        <div className="flex items-center gap-2">
                          <span className="text-[#E8E8E8] font-bold">${c.strike}</span>
                          <span className="text-[#6B6B6B]">{c.expiration}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#6B6B6B]">Δ{c.approx_delta.toFixed(2)}</span>
                          <span style={{ color: c.expected_value > 0 ? "#00FF66" : "#FF3333" }}>EV ${c.expected_value.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
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
