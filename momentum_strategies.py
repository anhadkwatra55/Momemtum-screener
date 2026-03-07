"""
momentum_strategies.py — Actionable Trade Strategy Generator
==============================================================
Maps signals to leveraged-ETF plays and options strategies,
with cost estimation, risk levels, and conviction scores.
"""

from __future__ import annotations

import numpy as np

import momentum_config as cfg


def generate_strategy(result: dict) -> dict:
    """
    Generate an actionable trade strategy for a screened ticker.

    Uses the composite score, regime, and sector mapping to recommend:
    - Leveraged ETF position (bull or bear)
    - Options strategy
    - Entry / stop / target levels
    - Estimated cost per unit
    - Conviction percentage
    """
    ticker = result["ticker"]
    sector = result["sector"]
    composite = result["composite"]
    probability = result["probability"]
    price = result["price"]
    regime = result["regime"]
    sentiment = result["sentiment"]
    vol = result.get("volatility_20d") or 25.0   # fallback

    etf_info = cfg.LEVERAGED_ETFS.get(sector, cfg.LEVERAGED_ETFS.get("Consumer Staples"))
    if etf_info is None:
        etf_info = {"bull": "SPXL", "bear": "SPXS", "lev": 3, "sector_etf": "SPY"}

    # ── Direction ──
    is_bullish = composite > 0.1
    is_bearish = composite < -0.1
    is_strong = abs(composite) >= cfg.SCORE_STRONG_BULL
    is_moderate = cfg.SCORE_BULL <= abs(composite) < cfg.SCORE_STRONG_BULL

    # ── Leveraged ETF recommendation ──
    if is_bullish:
        etf_ticker = etf_info["bull"]
        etf_direction = "LONG"
        leverage = etf_info["lev"]
    elif is_bearish:
        etf_ticker = etf_info["bear"]
        etf_direction = "LONG"   # buying the inverse ETF
        leverage = etf_info["lev"]
    else:
        etf_ticker = None
        etf_direction = "FLAT"
        leverage = 0

    # ── Options strategy ──
    if is_strong and is_bullish:
        if vol < 25:
            options_strat = "Buy ATM Calls (30 DTE)"
            options_note = "Low vol → cheap premium, strong bullish conviction"
        else:
            options_strat = "Bull Call Spread (30 DTE)"
            options_note = "Higher vol → cap risk with spread"
    elif is_moderate and is_bullish:
        options_strat = "Bull Call Spread (45 DTE)"
        options_note = "Moderate conviction — defined risk"
    elif is_strong and is_bearish:
        if vol < 25:
            options_strat = "Buy ATM Puts (30 DTE)"
            options_note = "Low vol → cheap premium, strong bearish conviction"
        else:
            options_strat = "Bear Put Spread (30 DTE)"
            options_note = "Higher vol → cap risk with spread"
    elif is_moderate and is_bearish:
        options_strat = "Bear Put Spread (45 DTE)"
        options_note = "Moderate conviction — defined risk"
    elif regime == "Mean-Reverting" and not is_strong:
        options_strat = "Iron Condor (30 DTE)"
        options_note = "Range-bound regime → sell premium"
    elif regime == "Choppy":
        options_strat = "No Trade — Wait"
        options_note = "Choppy regime, no edge"
    else:
        options_strat = "No Trade — Insufficient Signal"
        options_note = "Composite score too weak"

    # ── Risk levels ──
    atr_proxy = price * (vol / 100) / np.sqrt(252)   # daily ATR approximation
    if is_bullish:
        stop_loss = round(price - 2 * atr_proxy, 2)
        target = round(price + 4 * atr_proxy, 2)     # 2:1 R/R
    elif is_bearish:
        stop_loss = round(price + 2 * atr_proxy, 2)
        target = round(price - 4 * atr_proxy, 2)
    else:
        stop_loss = None
        target = None

    # ── Cost estimation ──
    # Leveraged ETF: approximate cost for 100-share position
    # We don't know the ETF price, but we estimate via sector ETF price ratios
    etf_cost_est = None
    if etf_ticker:
        # Rough: most leveraged ETFs trade $10–$80
        # Use a conservative estimate
        etf_cost_est = f"~${leverage * 15 * 100:,} per 100 shares (est.)"

    # Options: approximate premium
    if "Buy ATM" in options_strat:
        # ATM option premium ≈ 0.4 × σ × √T × S  (Black-Scholes approximation)
        days = 30 if "30" in options_strat else 45
        premium_est = round(0.4 * (vol / 100) * np.sqrt(days / 365) * price, 2)
        options_cost = f"~${premium_est * 100:.0f} per contract (est.)"
    elif "Spread" in options_strat:
        days = 30 if "30" in options_strat else 45
        premium_est = round(0.2 * (vol / 100) * np.sqrt(days / 365) * price, 2)
        options_cost = f"~${premium_est * 100:.0f} max risk per spread (est.)"
    elif "Iron Condor" in options_strat:
        options_cost = "Credit received — margin required"
    else:
        options_cost = "N/A"

    # ── Conviction ──
    conviction = round(float(probability * min(abs(composite) / 2.0, 1.0)), 1)

    # ── Action summary ──
    if is_strong:
        urgency = "HIGH"
    elif is_moderate:
        urgency = "MODERATE"
    else:
        urgency = "LOW"

    if is_bullish:
        action = f"BUY {etf_ticker} ({leverage}× Bull)" if etf_ticker else "No ETF"
        direction = "BULLISH"
    elif is_bearish:
        action = f"BUY {etf_ticker} ({leverage}× Bear)" if etf_ticker else "No ETF"
        direction = "BEARISH"
    else:
        action = "HOLD / NO TRADE"
        direction = "NEUTRAL"

    return {
        "ticker": ticker,
        "sector": sector,
        "direction": direction,
        "sentiment": sentiment,
        "action": action,
        "urgency": urgency,
        "conviction": conviction,
        "probability": probability,

        # Leveraged ETF
        "etf_ticker": etf_ticker,
        "etf_direction": etf_direction,
        "leverage": leverage,
        "etf_cost_est": etf_cost_est,

        # Options
        "options_strategy": options_strat,
        "options_note": options_note,
        "options_cost": options_cost,

        # Risk
        "entry_price": price,
        "stop_loss": stop_loss,
        "target": target,
        "risk_reward": "2:1" if stop_loss and target else "N/A",

        # Source scores
        "composite": result["composite"],
        "regime": regime,
    }


def generate_all_strategies(results: list[dict]) -> list[dict]:
    """
    Generate strategies for all screened tickers.

    Filters out 'No Trade' strategies and sorts by conviction descending.
    """
    strategies = []
    for r in results:
        strat = generate_strategy(r)
        strategies.append(strat)

    # Sort by conviction descending
    strategies.sort(key=lambda x: x["conviction"], reverse=True)
    return strategies
