"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8060";

interface AlphaCall {
  ticker: string;
  stock_price: number;
  strike: number;
  expiration: string;
  dte: number;
  bid: number;
  ask: number;
  mid_price: number;
  last_price: number;
  volume: number;
  open_interest: number;
  implied_volatility: number;
  spread_pct: number;
  delta: number;
  theta: number;
  gamma: number;
  vega: number;
  breakeven: number;
  breakeven_pct: number;
  moneyness: string;
  intrinsic_value: number;
}

interface AlphaCallsData {
  calls: AlphaCall[];
  meta: {
    universe_size: number;
    contracts_found: number;
    tickers_with_calls: number;
    errors: number;
    mode: string;
    mode_label: string;
    filters: Record<string, any>;
  };
  timestamp: string;
}

type SortKey = "ticker" | "stock_price" | "strike" | "dte" | "delta" | "theta" | "volume" | "open_interest" | "breakeven_pct" | "implied_volatility" | "spread_pct" | "mid_price";

// ── Filter Bar Component ──
interface FilterBarProps {
  mode: "itm_atm" | "atm_otm";
  setMode: (m: "itm_atm" | "atm_otm") => void;
  minVolume: number;
  setMinVolume: (v: number) => void;
  minOI: number;
  setMinOI: (v: number) => void;
  maxDTE: number;
  setMaxDTE: (v: number) => void;
  onRefresh: () => void;
  loading: boolean;
}

function FilterBar({ mode, setMode, minVolume, setMinVolume, minOI, setMinOI, maxDTE, setMaxDTE, onRefresh, loading }: FilterBarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 p-3 px-4 mb-4 rounded-[4px]"
      style={{ background: "#111111", border: "1px solid #2A2A2A" }}
    >
      {/* Moneyness Toggle */}
      <div className="flex items-center gap-0">
        <button
          onClick={() => setMode("itm_atm")}
          className="text-[10px] font-mono-data uppercase tracking-[0.06em] px-3 py-1.5 transition-all duration-[50ms]"
          style={{
            background: mode === "itm_atm" ? "#00FF66" : "transparent",
            color: mode === "itm_atm" ? "#000000" : "#6B6B6B",
            border: `1px solid ${mode === "itm_atm" ? "#00FF66" : "#2A2A2A"}`,
            borderRadius: "2px 0 0 2px",
            fontWeight: mode === "itm_atm" ? 700 : 400,
          }}
        >
          ITM / ATM
        </button>
        <button
          onClick={() => setMode("atm_otm")}
          className="text-[10px] font-mono-data uppercase tracking-[0.06em] px-3 py-1.5 transition-all duration-[50ms]"
          style={{
            background: mode === "atm_otm" ? "#00FF66" : "transparent",
            color: mode === "atm_otm" ? "#000000" : "#6B6B6B",
            border: `1px solid ${mode === "atm_otm" ? "#00FF66" : "#2A2A2A"}`,
            borderRadius: "0 2px 2px 0",
            fontWeight: mode === "atm_otm" ? 700 : 400,
          }}
        >
          ATM / OTM
        </button>
      </div>

      <div className="w-px h-6 bg-[#2A2A2A]" />

      {/* Volume */}
      <div className="flex items-center gap-1.5">
        <label className="text-[9px] font-mono-data text-[#6B6B6B] uppercase">Vol≥</label>
        <input
          type="number"
          value={minVolume}
          onChange={e => setMinVolume(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-16 text-[11px] font-mono-data bg-[#0A0A0A] border border-[#2A2A2A] text-[#E8E8E8] rounded-[2px] px-1.5 py-1 focus:outline-none focus:border-[#00FF66] transition-colors"
        />
      </div>

      {/* OI */}
      <div className="flex items-center gap-1.5">
        <label className="text-[9px] font-mono-data text-[#6B6B6B] uppercase">OI≥</label>
        <input
          type="number"
          value={minOI}
          onChange={e => setMinOI(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-16 text-[11px] font-mono-data bg-[#0A0A0A] border border-[#2A2A2A] text-[#E8E8E8] rounded-[2px] px-1.5 py-1 focus:outline-none focus:border-[#00FF66] transition-colors"
        />
      </div>

      <div className="w-px h-6 bg-[#2A2A2A]" />

      {/* DTE Slider */}
      <div className="flex items-center gap-2">
        <label className="text-[9px] font-mono-data text-[#6B6B6B] uppercase">DTE≤</label>
        <input
          type="range"
          min={7}
          max={180}
          value={maxDTE}
          onChange={e => setMaxDTE(parseInt(e.target.value))}
          className="w-24 h-1 appearance-none rounded-full cursor-pointer"
          style={{
            background: `linear-gradient(to right, #00FF66 ${((maxDTE - 7) / 173) * 100}%, #2A2A2A ${((maxDTE - 7) / 173) * 100}%)`,
          }}
        />
        <span className="text-[11px] font-mono-data text-[#E8E8E8] w-8 text-right">{maxDTE}d</span>
      </div>

      <div className="flex-1" />

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="text-[10px] font-mono-data uppercase tracking-[0.08em] px-3 py-1.5 bg-transparent border border-[#2A2A2A] rounded-[2px] text-[#C0C0C0] hover:text-[#00FF66] hover:border-[#00FF66] transition-all duration-[50ms] disabled:opacity-40"
      >
        {loading ? "SCANNING..." : "SCAN"}
      </button>
    </div>
  );
}

// ── Main Component ──
interface AlphaCallsBlotterProps {
  onTickerSelect?: (ticker: string) => void;
}

export function AlphaCallsBlotter({ onTickerSelect }: AlphaCallsBlotterProps) {
  const [data, setData] = useState<AlphaCallsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [mode, setMode] = useState<"itm_atm" | "atm_otm">("atm_otm");
  const [minVolume, setMinVolume] = useState(50);
  const [minOI, setMinOI] = useState(100);
  const [maxDTE, setMaxDTE] = useState(180);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("open_interest");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        mode,
        min_volume: String(minVolume),
        min_oi: String(minOI),
        sort_by: sortKey,
        ...(refresh && { refresh: "true" }),
      });
      const res = await fetch(`${API_URL}/api/screener/alpha-calls?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [mode, minVolume, minOI, sortKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "spread_pct" || key === "breakeven_pct"); }
  };

  // Client-side sort + DTE filter
  const sortedCalls = useMemo(() => {
    if (!data?.calls) return [];
    let filtered = data.calls.filter(c => c.dte <= maxDTE);
    return filtered.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "string") return sortAsc ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [data?.calls, sortKey, sortAsc, maxDTE]);

  const columns: { key: SortKey; label: string; width?: string }[] = [
    { key: "ticker", label: "TICKER" },
    { key: "stock_price", label: "PRICE" },
    { key: "strike", label: "STRIKE" },
    { key: "mid_price", label: "BID/ASK" },
    { key: "volume", label: "VOL" },
    { key: "open_interest", label: "OI" },
    { key: "dte", label: "DTE" },
    { key: "delta", label: "Δ" },
    { key: "theta", label: "Θ" },
    { key: "implied_volatility", label: "IV%" },
    { key: "breakeven_pct", label: "B/E%" },
    { key: "spread_pct", label: "SPR%" },
  ];

  return (
    <div className="pt-4 md:pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[20px] font-bold md:text-[24px] font-mono-data tracking-[0.06em] text-[#E8E8E8] flex items-center gap-2">
            <span className="text-[#FFD600]">◆</span> ALPHA CALL OPTIONS
          </h1>
          <p className="text-[11px] text-[#6B6B6B] mt-1 font-mono-data">
            Pure Greeks · Liquidity · Price Action — No Ensemble / No Sentiment
          </p>
        </div>
        {data?.meta && (
          <div className="text-[10px] font-mono-data text-[#6B6B6B] flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded-[2px] bg-[#00FF6610] text-[#00FF66] border border-[#00FF6640]">
              {data.meta.mode_label}
            </span>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <FilterBar
        mode={mode}
        setMode={setMode}
        minVolume={minVolume}
        setMinVolume={setMinVolume}
        minOI={minOI}
        setMinOI={setMinOI}
        maxDTE={maxDTE}
        setMaxDTE={setMaxDTE}
        onRefresh={() => fetchData(true)}
        loading={loading}
      />

      {/* Stats */}
      {data?.meta && (
        <div className="flex items-center gap-4 px-4 py-2 mb-3 text-[10px] font-mono-data text-[#6B6B6B]">
          <span>Universe: <b className="text-[#C0C0C0]">{data.meta.universe_size}</b></span>
          <span>Contracts: <b className="text-[#00FF66]">{sortedCalls.length}</b></span>
          <span>Tickers: <b className="text-[#00FF66]">{new Set(sortedCalls.map(c => c.ticker)).size}</b></span>
          {data.meta.errors > 0 && <span>Errors: <b className="text-[#FF3333]">{data.meta.errors}</b></span>}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-[3px] border-[#2A2A2A] border-t-[#FFD600] rounded-full animate-spin mb-4" />
          <p className="text-[12px] font-mono-data text-[#6B6B6B]">Scanning option chains across universe... ~30-60s</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-[4px] border border-[#FF3333] bg-[#FF333308] mb-4">
          <p className="text-[12px] font-mono-data text-[#FF3333]">{error}</p>
          <button onClick={() => fetchData(true)} className="mt-2 text-[10px] font-mono-data px-3 py-1 border border-[#FF3333] rounded-[2px] text-[#FF3333] hover:bg-[#FF333320]">RETRY</button>
        </div>
      )}

      {/* Empty */}
      {data && sortedCalls.length === 0 && !loading && (
        <div className="p-8 rounded-[4px] border border-[#2A2A2A] bg-[#111111] text-center">
          <p className="text-[14px] font-mono-data text-[#6B6B6B] mb-2">No qualifying contracts</p>
          <p className="text-[11px] font-mono-data text-[#6B6B6B]">Try adjusting filters — lower Volume/OI floors or switch moneyness mode</p>
        </div>
      )}

      {/* Data Table */}
      {sortedCalls.length > 0 && (
        <div className="rounded-[4px] overflow-hidden" style={{ background: "#111111", border: "1px solid #2A2A2A" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono-data">
              <thead>
                <tr className="border-b border-[#2A2A2A]">
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className="px-2.5 py-2.5 text-left text-[10px] text-[#6B6B6B] uppercase tracking-[0.06em] cursor-pointer hover:text-[#00FF66] transition-colors duration-[50ms] select-none whitespace-nowrap"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      {sortKey === col.key && <span className="ml-1 text-[#00FF66]">{sortAsc ? "↑" : "↓"}</span>}
                    </th>
                  ))}
                  <th className="px-2.5 py-2.5 text-left text-[10px] text-[#6B6B6B]">TYPE</th>
                </tr>
              </thead>
              <tbody>
                {sortedCalls.map((c, i) => (
                  <motion.tr
                    key={`${c.ticker}-${c.strike}-${c.expiration}-${i}`}
                    className="border-b border-[#1C1C1C] cursor-pointer hover:bg-[#0A0A0A] transition-colors duration-[75ms]"
                    onClick={() => onTickerSelect?.(c.ticker)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.008, 0.25) }}
                  >
                    {/* Ticker */}
                    <td className="px-2.5 py-2">
                      <span className="font-bold text-[#E8E8E8]">{c.ticker}</span>
                    </td>
                    {/* Stock Price */}
                    <td className="px-2.5 py-2 text-[#C0C0C0]">${c.stock_price.toFixed(2)}</td>
                    {/* Strike */}
                    <td className="px-2.5 py-2 text-[#E8E8E8] font-bold">${c.strike.toFixed(2)}</td>
                    {/* Bid/Ask + Midpoint */}
                    <td className="px-2.5 py-2">
                      <span className="text-[#6B6B6B]">{c.bid.toFixed(2)}</span>
                      <span className="text-[#2A2A2A] mx-0.5">/</span>
                      <span className="text-[#6B6B6B]">{c.ask.toFixed(2)}</span>
                      <span className="text-[#FFD600] ml-1 text-[10px]">({c.mid_price.toFixed(2)})</span>
                    </td>
                    {/* Volume */}
                    <td className="px-2.5 py-2" style={{ color: c.volume > 500 ? "#00FF66" : c.volume > 100 ? "#C0C0C0" : "#6B6B6B" }}>
                      {c.volume.toLocaleString()}
                    </td>
                    {/* Open Interest */}
                    <td className="px-2.5 py-2" style={{ color: c.open_interest > 5000 ? "#00FF66" : c.open_interest > 500 ? "#C0C0C0" : "#6B6B6B" }}>
                      {c.open_interest.toLocaleString()}
                    </td>
                    {/* DTE */}
                    <td className="px-2.5 py-2" style={{ color: c.dte <= 30 ? "#FF3333" : c.dte <= 60 ? "#FFD600" : "#C0C0C0" }}>
                      {c.dte}d
                    </td>
                    {/* Delta */}
                    <td className="px-2.5 py-2" style={{ color: c.delta >= 0.6 ? "#00FF66" : c.delta >= 0.45 ? "#FFD600" : "#C0C0C0" }}>
                      {c.delta.toFixed(3)}
                    </td>
                    {/* Theta */}
                    <td className="px-2.5 py-2 text-[#FF3333]">
                      {c.theta !== 0 ? c.theta.toFixed(4) : "—"}
                    </td>
                    {/* IV% */}
                    <td className="px-2.5 py-2" style={{ color: c.implied_volatility > 80 ? "#FF3333" : c.implied_volatility > 50 ? "#FFD600" : "#C0C0C0" }}>
                      {c.implied_volatility.toFixed(1)}%
                    </td>
                    {/* Breakeven % */}
                    <td className="px-2.5 py-2" style={{ color: c.breakeven_pct <= 3 ? "#00FF66" : c.breakeven_pct <= 8 ? "#FFD600" : "#FF3333" }}>
                      {c.breakeven_pct > 0 ? "+" : ""}{c.breakeven_pct.toFixed(2)}%
                    </td>
                    {/* Spread % */}
                    <td className="px-2.5 py-2" style={{ color: c.spread_pct <= 3 ? "#00FF66" : c.spread_pct <= 7 ? "#FFD600" : "#FF3333" }}>
                      {c.spread_pct.toFixed(1)}%
                    </td>
                    {/* Moneyness */}
                    <td className="px-2.5 py-2">
                      <span
                        className="text-[9px] uppercase px-1.5 py-0.5 rounded-[2px]"
                        style={{
                          color: c.moneyness === "ITM" ? "#00FF66" : c.moneyness === "ATM" ? "#FFD600" : "#C0C0C0",
                          background: c.moneyness === "ITM" ? "rgba(0,255,102,0.08)" : c.moneyness === "ATM" ? "rgba(255,214,0,0.08)" : "rgba(192,192,192,0.05)",
                          border: `1px solid ${c.moneyness === "ITM" ? "#00FF6630" : c.moneyness === "ATM" ? "#FFD60030" : "#2A2A2A"}`,
                        }}
                      >
                        {c.moneyness}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
