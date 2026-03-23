"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";

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
  breakeven: number;
  breakeven_pct: number;
  moneyness: string;
  intrinsic_value: number;
}

interface AlphaCallsData {
  calls: AlphaCall[];
  meta: {
    universe_source: string;
    universe_size: number;
    tickers_scanned: number;
    contracts_found: number;
    tickers_with_calls: number;
    errors: number;
    mode: string;
    mode_label: string;
    filters: Record<string, any>;
  };
  timestamp: string;
}

type SortKey = "ticker" | "stock_price" | "strike" | "dte" | "delta" | "volume" | "open_interest" | "breakeven_pct" | "implied_volatility" | "spread_pct" | "mid_price";

// ── Main Component ──
interface AlphaCallsBlotterProps {
  onTickerSelect?: (ticker: string) => void;
}

export function AlphaCallsBlotter({ onTickerSelect }: AlphaCallsBlotterProps) {
  const [data, setData] = useState<AlphaCallsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters matching Zacks screener
  const [mode, setMode] = useState<"itm_atm" | "atm_otm">("atm_otm");
  const [minPrice, setMinPrice] = useState(25);
  const [minDelta, setMinDelta] = useState(0.35);
  const [dteMin, setDteMin] = useState(90);
  const [dteMax, setDteMax] = useState(150);
  const [premiumMin, setPremiumMin] = useState(1);
  const [premiumMax, setPremiumMax] = useState(5);
  const [maxSpread, setMaxSpread] = useState(13);
  const [scanLimit, setScanLimit] = useState(100);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("breakeven_pct");
  const [sortAsc, setSortAsc] = useState(true);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        mode,
        min_price: String(minPrice),
        min_delta: String(minDelta),
        dte_min: String(dteMin),
        dte_max: String(dteMax),
        premium_min: String(premiumMin),
        premium_max: String(premiumMax),
        max_spread_pct: String(maxSpread),
        sort_by: sortKey,
        limit: String(scanLimit),
        ...(refresh && { refresh: "true" }),
      });
      const res = await fetch(`${API_URL}/api/screener/alpha-calls?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [mode, minPrice, minDelta, dteMin, dteMax, premiumMin, premiumMax, maxSpread, sortKey, scanLimit]);

  useEffect(() => { fetchData(); }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "breakeven_pct" || key === "spread_pct"); }
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

  const columns: { key: SortKey; label: string }[] = [
    { key: "ticker", label: "TICKER" },
    { key: "stock_price", label: "PRICE" },
    { key: "strike", label: "STRIKE" },
    { key: "mid_price", label: "PREMIUM" },
    { key: "delta", label: "DELTA" },
    { key: "breakeven_pct", label: "B/E %" },
    { key: "dte", label: "DTE" },
    { key: "open_interest", label: "OI" },
    { key: "volume", label: "VOL" },
    { key: "implied_volatility", label: "IV%" },
    { key: "spread_pct", label: "SPR%" },
  ];

  return (
    <div className="pt-4 md:pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-[20px] font-bold md:text-[24px] font-mono-data tracking-[0.06em] text-[#E8E8E8] flex items-center gap-2">
            <span className="text-[#FFD600]">◆</span> ALPHA CALL OPTIONS
          </h1>
          <p className="text-[11px] text-[#6B6B6B] mt-1 font-mono-data">
            S&P 500 Universe · Black-Scholes Δ · Zacks Institutional Filters
          </p>
        </div>
        {data?.meta && (
          <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded-[2px] bg-[#00FF6610] text-[#00FF66] border border-[#00FF6640]">
            {data.meta.universe_source} · {data.meta.tickers_scanned} scanned
          </span>
        )}
      </div>

      {/* ── Filter Bar ── */}
      <div className="p-3 px-4 mb-4 rounded-[4px] space-y-2" style={{ background: "#111111", border: "1px solid #2A2A2A" }}>
        {/* Row 1: Mode toggle + core filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Moneyness Toggle */}
          <div className="flex items-center gap-0">
            <button onClick={() => setMode("itm_atm")} className="text-[10px] font-mono-data uppercase tracking-[0.06em] px-3 py-1.5 transition-all duration-[50ms]" style={{ background: mode === "itm_atm" ? "#00FF66" : "transparent", color: mode === "itm_atm" ? "#000" : "#6B6B6B", border: `1px solid ${mode === "itm_atm" ? "#00FF66" : "#2A2A2A"}`, borderRadius: "2px 0 0 2px", fontWeight: mode === "itm_atm" ? 700 : 400 }}>ITM / ATM</button>
            <button onClick={() => setMode("atm_otm")} className="text-[10px] font-mono-data uppercase tracking-[0.06em] px-3 py-1.5 transition-all duration-[50ms]" style={{ background: mode === "atm_otm" ? "#00FF66" : "transparent", color: mode === "atm_otm" ? "#000" : "#6B6B6B", border: `1px solid ${mode === "atm_otm" ? "#00FF66" : "#2A2A2A"}`, borderRadius: "0 2px 2px 0", fontWeight: mode === "atm_otm" ? 700 : 400 }}>ATM / OTM</button>
          </div>

          <div className="w-px h-6 bg-[#2A2A2A]" />

          {/* Price Floor */}
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] font-mono-data text-[#6B6B6B] uppercase">Price≥</label>
            <input type="number" value={minPrice} onChange={e => setMinPrice(Math.max(0, parseFloat(e.target.value) || 0))} className="w-14 text-[11px] font-mono-data bg-[#0A0A0A] border border-[#2A2A2A] text-[#E8E8E8] rounded-[2px] px-1.5 py-1 focus:outline-none focus:border-[#00FF66]" />
          </div>

          {/* Delta Floor */}
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] font-mono-data text-[#6B6B6B] uppercase">Δ≥</label>
            <input type="number" step="0.05" value={minDelta} onChange={e => setMinDelta(Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)))} className="w-14 text-[11px] font-mono-data bg-[#0A0A0A] border border-[#2A2A2A] text-[#E8E8E8] rounded-[2px] px-1.5 py-1 focus:outline-none focus:border-[#00FF66]" />
          </div>

          {/* Spread Cap */}
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] font-mono-data text-[#6B6B6B] uppercase">Spr≤</label>
            <input type="number" value={maxSpread} onChange={e => setMaxSpread(Math.max(0, parseFloat(e.target.value) || 0))} className="w-14 text-[11px] font-mono-data bg-[#0A0A0A] border border-[#2A2A2A] text-[#E8E8E8] rounded-[2px] px-1.5 py-1 focus:outline-none focus:border-[#00FF66]" />
          </div>

          <div className="w-px h-6 bg-[#2A2A2A]" />

          {/* Premium Range */}
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] font-mono-data text-[#6B6B6B] uppercase">Prem$</label>
            <input type="number" step="0.5" value={premiumMin} onChange={e => setPremiumMin(Math.max(0, parseFloat(e.target.value) || 0))} className="w-12 text-[11px] font-mono-data bg-[#0A0A0A] border border-[#2A2A2A] text-[#E8E8E8] rounded-[2px] px-1.5 py-1 focus:outline-none focus:border-[#00FF66]" />
            <span className="text-[9px] text-[#6B6B6B]">–</span>
            <input type="number" step="0.5" value={premiumMax} onChange={e => setPremiumMax(Math.max(0, parseFloat(e.target.value) || 0))} className="w-12 text-[11px] font-mono-data bg-[#0A0A0A] border border-[#2A2A2A] text-[#E8E8E8] rounded-[2px] px-1.5 py-1 focus:outline-none focus:border-[#00FF66]" />
          </div>

          <div className="w-px h-6 bg-[#2A2A2A]" />

          {/* DTE Range */}
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] font-mono-data text-[#6B6B6B] uppercase">DTE</label>
            <input type="number" value={dteMin} onChange={e => setDteMin(Math.max(0, parseInt(e.target.value) || 0))} className="w-12 text-[11px] font-mono-data bg-[#0A0A0A] border border-[#2A2A2A] text-[#E8E8E8] rounded-[2px] px-1.5 py-1 focus:outline-none focus:border-[#00FF66]" />
            <span className="text-[9px] text-[#6B6B6B]">–</span>
            <input type="number" value={dteMax} onChange={e => setDteMax(Math.max(0, parseInt(e.target.value) || 0))} className="w-12 text-[11px] font-mono-data bg-[#0A0A0A] border border-[#2A2A2A] text-[#E8E8E8] rounded-[2px] px-1.5 py-1 focus:outline-none focus:border-[#00FF66]" />
          </div>

          <div className="w-px h-6 bg-[#2A2A2A]" />

          {/* Scan Limit */}
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] font-mono-data text-[#6B6B6B] uppercase">Scan</label>
            <select value={scanLimit} onChange={e => setScanLimit(parseInt(e.target.value))} className="text-[11px] font-mono-data bg-[#0A0A0A] border border-[#2A2A2A] text-[#E8E8E8] rounded-[2px] px-1.5 py-1 focus:outline-none focus:border-[#00FF66]">
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>

          <div className="flex-1" />

          {/* Run Button */}
          <button onClick={() => fetchData(true)} disabled={loading} className="text-[10px] font-mono-data uppercase tracking-[0.08em] px-4 py-1.5 rounded-[2px] transition-all duration-[50ms] disabled:opacity-40 font-bold" style={{ background: "#00FF66", color: "#000", border: "1px solid #00FF66" }}>
            {loading ? "SCANNING..." : "→ RUN"}
          </button>
        </div>
      </div>

      {/* Stats */}
      {data?.meta && (
        <div className="flex items-center gap-4 px-4 py-2 mb-3 text-[10px] font-mono-data text-[#6B6B6B]">
          <span>Contracts: <b className="text-[#00FF66]">{data.meta.contracts_found}</b></span>
          <span>Tickers: <b className="text-[#00FF66]">{data.meta.tickers_with_calls}</b></span>
          {data.meta.errors > 0 && <span>Errors: <b className="text-[#FF3333]">{data.meta.errors}</b></span>}
          <span className="text-[#FFD600]">{data.meta.mode_label}</span>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-[3px] border-[#2A2A2A] border-t-[#FFD600] rounded-full animate-spin mb-4" />
          <p className="text-[12px] font-mono-data text-[#6B6B6B]">Scanning S&P 500 option chains... ~30-60s</p>
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
          <p className="text-[11px] font-mono-data text-[#6B6B6B]">Try: increase premium max to $8, widen DTE range, or lower delta threshold</p>
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
                    <th key={col.key} className="px-2.5 py-2.5 text-left text-[10px] text-[#6B6B6B] uppercase tracking-[0.06em] cursor-pointer hover:text-[#00FF66] transition-colors duration-[50ms] select-none whitespace-nowrap" onClick={() => handleSort(col.key)}>
                      {col.label}{sortKey === col.key && <span className="ml-1 text-[#00FF66]">{sortAsc ? "↑" : "↓"}</span>}
                    </th>
                  ))}
                  <th className="px-2.5 py-2.5 text-left text-[10px] text-[#6B6B6B]">EXP</th>
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
                    transition={{ delay: Math.min(i * 0.005, 0.15) }}
                  >
                    <td className="px-2.5 py-2"><span className="font-bold text-[#E8E8E8]">{c.ticker}</span></td>
                    <td className="px-2.5 py-2 text-[#C0C0C0]">${c.stock_price.toFixed(2)}</td>
                    <td className="px-2.5 py-2 text-[#E8E8E8] font-bold">${c.strike.toFixed(0)}</td>
                    <td className="px-2.5 py-2 text-[#FFD600] font-bold">${c.mid_price.toFixed(2)}</td>
                    <td className="px-2.5 py-2" style={{ color: c.delta >= 0.50 ? "#00FF66" : c.delta >= 0.40 ? "#FFD600" : "#C0C0C0" }}>{c.delta.toFixed(2)}</td>
                    <td className="px-2.5 py-2" style={{ color: c.breakeven_pct <= 3 ? "#00FF66" : c.breakeven_pct <= 6 ? "#FFD600" : "#FF3333" }}>{c.breakeven_pct > 0 ? "+" : ""}{c.breakeven_pct.toFixed(2)}%</td>
                    <td className="px-2.5 py-2" style={{ color: c.dte <= 60 ? "#FF3333" : c.dte <= 120 ? "#FFD600" : "#C0C0C0" }}>{c.dte}d</td>
                    <td className="px-2.5 py-2" style={{ color: c.open_interest > 5000 ? "#00FF66" : c.open_interest > 500 ? "#C0C0C0" : "#6B6B6B" }}>{c.open_interest.toLocaleString()}</td>
                    <td className="px-2.5 py-2" style={{ color: c.volume > 500 ? "#00FF66" : c.volume > 50 ? "#C0C0C0" : "#6B6B6B" }}>{c.volume.toLocaleString()}</td>
                    <td className="px-2.5 py-2" style={{ color: c.implied_volatility > 60 ? "#FF3333" : c.implied_volatility > 40 ? "#FFD600" : "#C0C0C0" }}>{c.implied_volatility.toFixed(1)}%</td>
                    <td className="px-2.5 py-2" style={{ color: c.spread_pct <= 5 ? "#00FF66" : c.spread_pct <= 10 ? "#FFD600" : "#FF3333" }}>{c.spread_pct.toFixed(1)}%</td>
                    <td className="px-2.5 py-2 text-[#6B6B6B] text-[10px]">{c.expiration}</td>
                    <td className="px-2.5 py-2">
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-[2px]" style={{ color: c.moneyness === "ITM" ? "#00FF66" : c.moneyness === "ATM" ? "#FFD600" : "#C0C0C0", background: c.moneyness === "ITM" ? "rgba(0,255,102,0.08)" : c.moneyness === "ATM" ? "rgba(255,214,0,0.08)" : "rgba(192,192,192,0.05)", border: `1px solid ${c.moneyness === "ITM" ? "#00FF6630" : c.moneyness === "ATM" ? "#FFD60030" : "#2A2A2A"}` }}>{c.moneyness}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div className="px-4 py-2 border-t border-[#2A2A2A] text-[10px] font-mono-data text-[#6B6B6B]">
            {sortedCalls.length} contracts · sorted by {sortKey.replace("_", " ")} · {data?.meta.universe_source}
          </div>
        </div>
      )}
    </div>
  );
}
