"use client";

import { useState, useEffect, useCallback } from "react";

export interface TradeCardData {
  ticker: string;
  sector: string;
  price: number;
  grade: string;
  summary: string;
  entry_low: number;
  entry_high: number;
  stop_loss: number;
  target: number;
  risk_reward: number;
  hold_min: number;
  hold_max: number;
  confidence: number;
  momentum_phase: string;
  conviction_tier: string;
  action_category: string;
  options_strategy: string;
  options_cost: string;
  etf_play: string;
  options_plays: {
    swing: any[];
    leaps: any[];
  };
}

export type WatchlistStatus = "on_track" | "target_1" | "stopped" | "flat";

export interface WatchlistEntry {
  ticker: string;
  addedAt: string; // ISO date
  entryPrice: number; // Price when added
  stopLoss: number;
  target: number;
  currentPrice?: number;
  status: WatchlistStatus;
}

export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("headstart_watchlist");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save to local storage whenever entries change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("headstart_watchlist", JSON.stringify(entries));
    }
  }, [entries]);

  const addTrade = useCallback((card: TradeCardData) => {
    setEntries((prev) => {
      // Don't add duplicates
      if (prev.some((e) => e.ticker === card.ticker)) {
        return prev;
      }
      const newEntry: WatchlistEntry = {
        ticker: card.ticker,
        addedAt: new Date().toISOString(),
        entryPrice: card.price,
        stopLoss: card.stop_loss,
        target: card.target,
        currentPrice: card.price,
        status: "flat",
      };
      return [...prev, newEntry];
    });
  }, []);

  const removeTrade = useCallback((ticker: string) => {
    setEntries((prev) => prev.filter((e) => e.ticker !== ticker));
  }, []);

  const clearWatchlist = useCallback(() => {
    setEntries([]);
  }, []);

  // Compute status based on current price, entry, target, and stop
  const computeStatus = (
    currentPrice: number,
    entryPrice: number,
    target: number,
    stopLoss: number
  ): WatchlistStatus => {
    if (currentPrice <= stopLoss) return "stopped";

    // Target 1 is defined as 50% of the expected target move
    const targetMove = target - entryPrice;
    const currentMove = currentPrice - entryPrice;
    const target1 = entryPrice + targetMove * 0.5;

    if (currentPrice >= target1) return "target_1";
    if (currentPrice > entryPrice * 1.01) return "on_track";
    
    return "flat";
  };

  const updatePrices = useCallback((priceMap: Record<string, number>) => {
    setEntries((prev) =>
      prev.map((entry) => {
        const currentPrice = priceMap[entry.ticker];
        if (currentPrice !== undefined) {
          return {
            ...entry,
            currentPrice,
            status: computeStatus(
              currentPrice,
              entry.entryPrice,
              entry.target,
              entry.stopLoss
            ),
          };
        }
        return entry;
      })
    );
  }, []);

  const getStatusMessage = (status: WatchlistStatus) => {
    switch (status) {
      case "on_track":
        return "Momentum extending";
      case "target_1":
        return "Target 1 Hit: Move stop to breakeven";
      case "stopped":
        return "Stop hit — position invalidated";
      case "flat":
        return "Consolidating — hold for now";
      default:
        return "";
    }
  };

  const getStatusColor = (status: WatchlistStatus) => {
    switch (status) {
      case "on_track":
        return "text-emerald-400";
      case "target_1":
        return "text-amber-400";
      case "stopped":
        return "text-rose-400";
      case "flat":
        return "text-slate-400";
      default:
        return "text-white";
    }
  };


  return {
    entries,
    addTrade,
    removeTrade,
    clearWatchlist,
    updatePrices,
    getStatusMessage,
    getStatusColor
  };
}
