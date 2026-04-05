"use client";

import React, { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";

/* ── Types ── */
interface AlphaCall {
  ticker: string; stock_price: number; strike: number; expiration: string;
  dte: number; bid: number; ask: number; mid_price: number; delta: number;
  pop: number; vol_edge: number; breakeven_pct: number; open_interest: number;
  volume: number; implied_volatility: number; spread_pct: number;
  quant_score: number; moneyness: string;
}

interface AlphaContractModalProps {
  call: AlphaCall | null;
  onClose: () => void;
  onViewTicker?: (ticker: string) => void;
}

/* ── Tokens ── */
const T = {
  bg: "#0d0d0d", card: "#141414", surface: "#1a1a1a",
  border: "#2d2d2d", borderLight: "#363636",
  text: "#e8e8e8", textSec: "#a8a8a8", textMuted: "#707070", textDim: "#505050",
  gold: "#e2b857", goldDim: "rgba(226,184,87,0.10)",
  purple: "#9f7aea", purpleDim: "rgba(159,122,234,0.08)",
  green: "#4ade80", greenDim: "rgba(74,222,128,0.08)",
  red: "#e05252", redDim: "rgba(224,82,82,0.08)",
  cyan: "#22d3ee", cyanDim: "rgba(34,211,238,0.08)",
};

/* ── Score breakdown bar ── */
function ScoreBar({ label, value, maxValue, color }: { label: string; value: number; maxValue: number; color: string }) {
  const pct = Math.max(2, Math.min(100, (value / maxValue) * 100));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
        <span style={{ color: T.textMuted }}>{label}</span>
        <span className="font-mono" style={{ color, fontWeight: 600 }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 4, background: T.surface, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.6s ease-out" }} />
      </div>
    </div>
  );
}

/* ── Stat cell ── */
function Stat({ label, value, color = T.textSec, mono = true }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: T.textMuted }}>{label}</span>
      <span className={mono ? "font-mono" : ""} style={{ fontSize: 12, color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/* ── Donut ── */
function Donut({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 6) / 2, circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, score) / 100) * circ;
  const color = score >= 50 ? T.green : score >= 30 ? T.gold : T.red;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.surface} strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color }}>{score}</span>
    </div>
  );
}

/* ── Mobile detect ── */
function useIsMobile(bp = 640) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const c = () => setM(window.innerWidth < bp);
    c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c);
  }, [bp]);
  return m;
}

/* ════════════════════════════════════════════════════════════════ */
export function AlphaContractModal({ call, onClose, onViewTicker }: AlphaContractModalProps) {
  const isMobile = useIsMobile();

  // Scroll lock
  useEffect(() => {
    if (!call) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = orig; };
  }, [call]);

  // ESC to close
  const handleKey = useCallback((e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }, [onClose]);
  useEffect(() => {
    if (!call) return;
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [call, handleKey]);

  if (!call) return null;

  const c = call;

  // Quant score decomposition (reverse-engineer the formula: pop*40 + max(0,edge)*400 + min(10,oi/1000)*2)
  const popContrib = c.pop * 40;
  const edgeContrib = Math.max(0, c.vol_edge) * 100 * 4;
  const oiContrib = Math.min(10, c.open_interest / 1000) * 2;
  const maxCapital = c.mid_price * 100;
  const maxLoss = maxCapital;
  const riskRewardPop = c.pop > 0 ? ((1 - c.pop) / c.pop).toFixed(2) : "—";

  // AI Thesis — dynamic text
  const conviction = c.quant_score >= 50 ? "high" : c.quant_score >= 30 ? "moderate" : "low";
  const deltaQuality = c.delta >= 0.50 ? "aggressive" : c.delta >= 0.45 ? "balanced" : "conservative";
  const edgeNote = c.vol_edge > 0
    ? `Positive vol edge of ${c.vol_edge} indicates implied volatility is overstated vs realized — a tailwind for this trade.`
    : c.vol_edge < -0.02
      ? `Negative vol edge of ${c.vol_edge} means IV is understated — the premium may be too cheap, but also means higher risk.`
      : "Volatility edge is neutral — no significant discrepancy between implied and realized vol.";

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, display: "flex",
        alignItems: isMobile ? "flex-end" : "center", justifyContent: "center",
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
        zIndex: 9999,
        animation: "fadeIn 150ms ease-out",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Contract detail for ${c.ticker} $${c.strike}`}
        style={{
          background: T.card,
          width: isMobile ? "100%" : 560,
          maxWidth: isMobile ? "100%" : "92vw",
          maxHeight: "90vh",
          borderRadius: isMobile ? "16px 16px 0 0" : 16,
          display: "flex", flexDirection: "column",
          boxShadow: "0 32px 64px rgba(0,0,0,0.6)",
          border: `1px solid ${T.borderLight}`,
          animation: isMobile ? "slideUp 200ms ease-out" : "scaleIn 200ms ease-out",
        }}
      >
        {/* ── Header ── */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Donut score={c.quant_score} size={48} />
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: T.text }}>{c.ticker}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: c.moneyness === "ATM" ? T.gold : T.cyan, background: c.moneyness === "ATM" ? T.goldDim : T.cyanDim, padding: "2px 8px", borderRadius: 4, border: `1px solid ${c.moneyness === "ATM" ? T.gold : T.cyan}20` }}>{c.moneyness}</span>
              </div>
              <div className="font-mono" style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                ${c.strike} Call · {c.expiration} · {c.dte}d
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: T.surface, color: T.textMuted, fontSize: 14, cursor: "pointer", transition: "all 150ms" }}
            onMouseEnter={e => { e.currentTarget.style.background = T.borderLight; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.color = T.textMuted; }}
          >✕</button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>

          {/* Price strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 24 }}>
            {[
              { label: "Stock Price", value: `$${c.stock_price}`, color: T.text },
              { label: "Premium", value: `$${c.mid_price}`, color: T.gold },
              { label: "Capital Req", value: `$${maxCapital.toLocaleString()}`, color: T.textSec },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center", padding: "12px 8px", background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <div className="font-mono" style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Quant Score Breakdown */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Quant Score Breakdown</div>
            <ScoreBar label="POP Contribution" value={popContrib} maxValue={40} color={T.green} />
            <ScoreBar label="Vol Edge Contribution" value={edgeContrib} maxValue={60} color={T.cyan} />
            <ScoreBar label="Open Interest Contribution" value={oiContrib} maxValue={20} color={T.gold} />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4, fontSize: 11 }}>
              <span style={{ color: T.textDim }}>Total: </span>
              <span className="font-mono" style={{ color: c.quant_score >= 50 ? T.green : c.quant_score >= 30 ? T.gold : T.red, fontWeight: 700, marginLeft: 4 }}>{c.quant_score}/100</span>
            </div>
          </div>

          {/* Greeks & Pricing */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Greeks</div>
              <Stat label="Delta" value={String(c.delta)} color={c.delta >= 0.45 ? T.green : T.textSec} />
              <Stat label="POP" value={`${(c.pop * 100).toFixed(0)}%`} color={c.pop >= 0.40 ? T.green : c.pop >= 0.30 ? T.gold : T.red} />
              <Stat label="Vol Edge" value={`${c.vol_edge > 0 ? "+" : ""}${c.vol_edge}`} color={c.vol_edge > 0 ? T.green : T.red} />
              <Stat label="IV" value={`${c.implied_volatility}%`} color={T.textSec} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Pricing</div>
              <Stat label="Bid" value={`$${c.bid}`} />
              <Stat label="Ask" value={`$${c.ask}`} />
              <Stat label="Spread" value={`${c.spread_pct}%`} color={c.spread_pct <= 5 ? T.green : c.spread_pct <= 10 ? T.gold : T.red} />
              <Stat label="Open Interest" value={c.open_interest.toLocaleString()} />
            </div>
          </div>

          {/* Risk Metrics */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Risk Metrics</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { label: "Max Loss", value: `$${maxLoss.toLocaleString()}`, color: T.red },
                { label: "Breakeven", value: `+${c.breakeven_pct}%`, color: c.breakeven_pct <= 8 ? T.green : T.gold },
                { label: "Risk/Reward", value: riskRewardPop, color: T.textSec },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center", padding: "10px 8px", background: T.redDim, borderRadius: 8, border: `1px solid ${T.red}15` }}>
                  <div className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Thesis */}
          <div style={{ padding: "14px 16px", background: T.purpleDim, borderRadius: 10, border: `1px solid ${T.purple}18` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.purple, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>AI Thesis</div>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: T.textSec, margin: 0 }}>
              <strong style={{ color: T.text }}>{c.ticker} ${c.strike} Call ({c.expiration})</strong> presents a{" "}
              <span style={{ color: conviction === "high" ? T.green : conviction === "moderate" ? T.gold : T.red, fontWeight: 600 }}>{conviction}-conviction</span>{" "}
              opportunity with {deltaQuality} delta positioning at {c.delta}.{" "}
              {c.pop >= 0.40
                ? `With ${(c.pop * 100).toFixed(0)}% probability of profit, this contract has favorable risk/reward characteristics. `
                : `POP of ${(c.pop * 100).toFixed(0)}% suggests moderate odds — size appropriately. `
              }
              {edgeNote}{" "}
              At ${c.mid_price} premium, max capital commitment is ${maxCapital.toLocaleString()} per contract with breakeven at +{c.breakeven_pct}% above current price.
              {c.open_interest > 5000 ? ` Excellent liquidity with ${c.open_interest.toLocaleString()} open interest.` : c.open_interest > 1000 ? ` Good liquidity with ${c.open_interest.toLocaleString()} OI.` : ` Thin liquidity — watch for slippage.`}
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ fontSize: 12, fontWeight: 500, padding: "8px 16px", borderRadius: 8, cursor: "pointer", border: `1px solid ${T.border}`, background: T.surface, color: T.textMuted, transition: "all 150ms" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderLight; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}
          >Close</button>
          {onViewTicker && (
            <button
              onClick={() => { onClose(); onViewTicker(c.ticker); }}
              style={{ fontSize: 12, fontWeight: 600, padding: "8px 20px", borderRadius: 8, cursor: "pointer", border: `1px solid ${T.gold}40`, background: `linear-gradient(135deg, ${T.goldDim}, ${T.goldDim})`, color: T.gold, transition: "all 150ms" }}
              onMouseEnter={e => { e.currentTarget.style.background = T.goldDim; e.currentTarget.style.borderColor = T.gold; }}
              onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${T.goldDim}, ${T.goldDim})`; e.currentTarget.style.borderColor = `${T.gold}40`; }}
            >View Ticker Detail →</button>
          )}
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes scaleIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.body);
}
