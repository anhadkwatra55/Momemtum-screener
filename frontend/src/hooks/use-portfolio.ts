"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { apiFetch } from "@/services/api";

// ── Types ──

export interface Holding {
  ticker: string;
  shares: number;
  avg_cost: number;
}

export interface HoldingAnalysis extends Holding {
  current_price: number;
  pnl: number;
  pnl_pct: number;
  composite: number | null;
  sentiment: string;
  regime: string;
  momentum_phase: string;
  sector: string;
  weight_pct: number;
  alert: string | null;
  alert_type: string | null;
  action: string | null;
  in_universe: boolean;
}

export interface SectorExposure {
  weight_pct: number;
  regime: string;
  avg_composite: number;
  count: number;
}

export interface MissingSector {
  sector: string;
  regime: string;
  avg_composite: number;
  top_pick: string | null;
  top_pick_composite: number | null;
  top_pick_sentiment: string | null;
  priority: "high" | "medium" | "low";
}

export interface AlphaAlert {
  ticker: string;
  alert_type: string;
  message: string;
  composite: number | null;
  sentiment: string;
  action: string;
}

export interface RotationSuggestion {
  sell_ticker: string;
  sell_composite: number | null;
  sell_sentiment: string;
  buy_ticker: string;
  buy_composite: number;
  buy_sentiment: string;
  buy_sector: string;
  rationale: string;
}

export interface PortfolioAnalysis {
  aura_score: number;
  aura_label: string;
  total_value: number;
  total_cost: number;
  total_pnl: number;
  total_pnl_pct: number;
  holdings_count: number;
  holdings_analysis: HoldingAnalysis[];
  sector_exposure: Record<string, SectorExposure>;
  missing_sectors: MissingSector[];
  alpha_alerts: AlphaAlert[];
  rotation_suggestions: RotationSuggestion[];
}

const STORAGE_KEY = "momentum_portfolio_holdings";

function loadHoldingsFromStorage(): Holding[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHoldingsToStorage(holdings: Holding[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  } catch {
    // Storage full or unavailable
  }
}

export interface UsePortfolioReturn {
  holdings: Holding[];
  addHolding: (ticker: string, shares: number, avgCost: number) => void;
  removeHolding: (ticker: string) => void;
  updateHolding: (ticker: string, shares: number, avgCost: number) => void;
  clearHoldings: () => void;
  analysis: PortfolioAnalysis | null;
  analyzing: boolean;
  analyzeError: string | null;
  analyze: () => Promise<void>;
  hasHoldings: boolean;
}

/**
 * Portfolio management hook with localStorage persistence and backend analysis.
 */
export function usePortfolio(): UsePortfolioReturn {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (!initialized.current) {
      setHoldings(loadHoldingsFromStorage());
      initialized.current = true;
    }
  }, []);

  // Persist to localStorage whenever holdings change
  useEffect(() => {
    if (initialized.current) {
      saveHoldingsToStorage(holdings);
    }
  }, [holdings]);

  const addHolding = useCallback((ticker: string, shares: number, avgCost: number) => {
    const upper = ticker.toUpperCase().trim();
    if (!upper || shares <= 0 || avgCost <= 0) return;
    setHoldings((prev) => {
      // If ticker already exists, update it
      const exists = prev.find((h) => h.ticker === upper);
      if (exists) {
        return prev.map((h) =>
          h.ticker === upper ? { ...h, shares, avg_cost: avgCost } : h
        );
      }
      return [...prev, { ticker: upper, shares, avg_cost: avgCost }];
    });
  }, []);

  const removeHolding = useCallback((ticker: string) => {
    setHoldings((prev) => prev.filter((h) => h.ticker !== ticker.toUpperCase()));
  }, []);

  const updateHolding = useCallback((ticker: string, shares: number, avgCost: number) => {
    setHoldings((prev) =>
      prev.map((h) =>
        h.ticker === ticker.toUpperCase() ? { ...h, shares, avg_cost: avgCost } : h
      )
    );
  }, []);

  const clearHoldings = useCallback(() => {
    setHoldings([]);
    setAnalysis(null);
  }, []);

  const analyze = useCallback(async () => {
    if (holdings.length === 0) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await apiFetch<PortfolioAnalysis>("/api/portfolio/analyze", {
        method: "POST",
        body: JSON.stringify({ holdings }),
      });
      setAnalysis(result);
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [holdings]);

  // Auto-analyze when holdings change (debounced)
  useEffect(() => {
    if (!initialized.current || holdings.length === 0) return;
    const timeout = setTimeout(() => {
      analyze();
    }, 500); // 500ms debounce
    return () => clearTimeout(timeout);
  }, [holdings, analyze]);

  return {
    holdings,
    addHolding,
    removeHolding,
    updateHolding,
    clearHoldings,
    analysis,
    analyzing,
    analyzeError,
    analyze,
    hasHoldings: holdings.length > 0,
  };
}
