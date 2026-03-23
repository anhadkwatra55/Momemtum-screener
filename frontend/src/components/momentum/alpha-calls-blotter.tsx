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
  delta: number;
  pop: number;
  vol_edge: number;
  breakeven_pct: number;
  open_interest: number;
  volume: number;
  implied_volatility: number;
  spread_pct: number;
  quant_score: number;
  moneyness: string;
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
    filters: Record<string, string>;
  };
  timestamp: string;
}

type SortKey = keyof AlphaCall;

// ── Component ──
interface Props { onTickerSelect?: (ticker: string) => void; }

export function AlphaCallsBlotter({ onTickerSelect }: Props) {
  const [data, setData] = useState<AlphaCallsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanLimit, setScanLimit] = useState(75);
  const [sortKey, setSortKey] = useState<SortKey>("quant_score");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(scanLimit),
        sort_by: String(sortKey),
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
  }, [scanLimit, sortKey]);

  useEffect(() => { fetchData(); }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "breakeven_pct" || key === "spread_pct");
    }
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

  type Col = { key: SortKey; label: string; fmt: (c: AlphaCall) => React.ReactNode };

  const columns: Col[] = [
    {
      key: "quant_score", label: "SCORE",
      fmt: c => <span className="font-bold px-1.5 py-0.5 rounded-[2px] text-[10px]" style={{ color: c.quant_score >= 50 ? "#00FF66" : c.quant_score >= 30 ? "#FFD600" : "#FF3333", background: c.quant_score >= 50 ? "rgba(0,255,102,0.1)" : c.quant_score >= 30 ? "rgba(255,214,0,0.08)" : "rgba(255,51,51,0.08)" }}>{c.quant_score}</span>,
    },
    { key: "ticker", label: "TICKER", fmt: c => <span className="font-bold text-[#E8E8E8]">{c.ticker}</span> },
    { key: "stock_price", label: "PRICE", fmt: c => <span className="text-[#C0C0C0]">${c.stock_price}</span> },
    { key: "strike", label: "STRIKE", fmt: c => <span className="text-[#E8E8E8] font-bold">{c.strike}</span> },
    { key: "mid_price", label: "PREMIUM", fmt: c => <span className="text-[#FFD600] font-bold">${c.mid_price}</span> },
    { key: "delta", label: "DELTA", fmt: c => <span style={{ color: c.delta >= 0.50 ? "#00FF66" : c.delta >= 0.40 ? "#FFD600" : "#C0C0C0" }}>{c.delta}</span> },
    { key: "pop", label: "POP", fmt: c => <span style={{ color: c.pop >= 0.50 ? "#00FF66" : c.pop >= 0.30 ? "#FFD600" : "#FF3333" }}>{c.pop}</span> },
    { key: "vol_edge", label: "EDGE", fmt: c => <span style={{ color: c.vol_edge > 0 ? "#00FF66" : c.vol_edge > -0.05 ? "#FFD600" : "#FF3333" }}>{c.vol_edge > 0 ? "+" : ""}{c.vol_edge}</span> },
    { key: "breakeven_pct", label: "B/E %", fmt: c => <span style={{ color: c.breakeven_pct <= 5 ? "#00FF66" : c.breakeven_pct <= 12 ? "#FFD600" : "#FF3333" }}>+{c.breakeven_pct}%</span> },
    { key: "open_interest", label: "OI", fmt: c => <span style={{ color: c.open_interest > 5000 ? "#00FF66" : c.open_interest > 500 ? "#C0C0C0" : "#6B6B6B" }}>{c.open_interest.toLocaleString()}</span> },
    { key: "expiration", label: "EXPIRY", fmt: c => <span className="text-[#6B6B6B]">{c.expiration}</span> },
  ];

  return (
    <div className="pt-4 md:pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-[20px] font-bold md:text-[24px] font-mono-data tracking-[0.06em] text-[#E8E8E8] flex items-center gap-2">
            <span className="text-[#FFD600]">◆</span> ALPHA-FLOW OPTIONS
          </h1>
          <p className="text-[11px] text-[#6B6B6B] mt-1 font-mono-data">
            S&P 500 · Black-Scholes Δ+POP · IV-HV Edge · Quant Score
          </p>
        </div>
        {data?.meta && (
          <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded-[2px] bg-[#00FF6610] text-[#00FF66] border border-[#00FF6640]">
            {data.meta.universe_source} · {data.meta.tickers_scanned} scanned · {data.meta.contracts_found} found
          </span>
        )}
      </div>

      {/* Control Bar */}
      <div className="p-3 px-4 mb-4 rounded-[4px] flex items-center gap-4 flex-wrap" style={{ background: "#111111", border: "1px solid #2A2A2A" }}>
        {/* Scan Limit */}
        <div className="flex items-center gap-1.5">
          <label className="text-[9px] font-mono-data text-[#6B6B6B] uppercase">Tickers</label>
          <select value={scanLimit} onChange={e => setScanLimit(parseInt(e.target.value))} className="text-[11px] font-mono-data bg-[#0A0A0A] border border-[#2A2A2A] text-[#E8E8E8] rounded-[2px] px-2 py-1 focus:outline-none focus:border-[#00FF66]">
            <option value={50}>50</option>
            <option value={75}>75</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </div>

        <div className="w-px h-6 bg-[#2A2A2A]" />

        {/* Filters summary */}
        <div className="flex items-center gap-2 text-[9px] font-mono-data text-[#6B6B6B] uppercase">
          <span>Price≥$25</span>
          <span>·</span>
          <span>DTE 90-150</span>
          <span>·</span>
          <span>Prem $1-$8</span>
          <span>·</span>
          <span>Spr≤10%</span>
          <span>·</span>
          <span>OI≥100</span>
          <span>·</span>
          <span>Δ≥0.35</span>
        </div>

        <div className="flex-1" />

        {/* Run Button */}
        <button
          onClick={() => fetchData(true)}
          disabled={loading}
          className="text-[10px] font-mono-data uppercase tracking-[0.08em] px-5 py-1.5 rounded-[2px] transition-all duration-[50ms] disabled:opacity-40 font-bold"
          style={{ background: "#00FF66", color: "#000", border: "1px solid #00FF66" }}
        >
          {loading ? "SCANNING..." : "→ RUN SCAN"}
        </button>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-[3px] border-[#2A2A2A] border-t-[#FFD600] rounded-full animate-spin mb-4" />
          <p className="text-[12px] font-mono-data text-[#6B6B6B]">Scanning S&P 500 option chains... ~60-120s</p>
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
          <p className="text-[11px] font-mono-data text-[#6B6B6B]">Try scanning more tickers (increase limit to 200+)</p>
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
                      key={String(col.key)}
                      className="px-2.5 py-2.5 text-left text-[10px] text-[#6B6B6B] uppercase tracking-[0.06em] cursor-pointer hover:text-[#00FF66] transition-colors duration-[50ms] select-none whitespace-nowrap"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      {sortKey === col.key && <span className="ml-1 text-[#00FF66]">{sortAsc ? "↑" : "↓"}</span>}
                    </th>
                  ))}
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
                    {columns.map(col => (
                      <td key={String(col.key)} className="px-2.5 py-2">{col.fmt(c)}</td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-[#2A2A2A] flex items-center justify-between text-[10px] font-mono-data text-[#6B6B6B]">
            <span>{sortedCalls.length} contracts · {data?.meta.tickers_with_calls} tickers · sorted by {String(sortKey).replace("_", " ")}</span>
            <span>{data?.meta.universe_source}</span>
          </div>
        </div>
      )}
    </div>
  );
}
