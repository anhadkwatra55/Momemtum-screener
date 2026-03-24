"""
momentum_screener.py — Signal Combination, Regime & Sentiment Engine
=====================================================================
Combines scores from all four indicator systems into a unified composite,
classifies market regime per-ticker & per-sector, and assigns probability.
"""

from __future__ import annotations

import warnings
from typing import Dict

import numpy as np
import pandas as pd

import momentum_config as cfg
from momentum_indicators import (
    compute_adx,
    compute_full_stochastics,
    extract_chart_data,
    score_system1,
    score_system2,
    score_system3,
    score_system4,
)

warnings.filterwarnings("ignore")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  REGIME CLASSIFICATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def classify_regime(df: pd.DataFrame) -> str:
    """
    Classify market regime based on ADX + stochastic range.

    Trending:       ADX > 25
    Mean-Reverting: ADX < 20 and Stochastics oscillating inside 30–70
    Choppy:         ADX < 15 (no clear trend or reversion)
    """
    adx_df = compute_adx(df)
    stoch_df = compute_full_stochastics(df)

    adx_val = adx_df["ADX"].iloc[-1]
    stoch_k = stoch_df["Stoch_K"].iloc[-1]

    if np.isnan(adx_val):
        return "Unknown"

    if adx_val >= cfg.ADX_STRONG_TREND:
        return "Trending"
    elif adx_val >= cfg.ADX_WEAK_TREND:
        # Moderate: check stochastics for range behaviour
        if not np.isnan(stoch_k) and 30 < stoch_k < 70:
            return "Mean-Reverting"
        return "Trending"
    elif adx_val >= 15:
        return "Mean-Reverting"
    else:
        return "Choppy"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  SENTIMENT LABEL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def composite_sentiment(composite_score: float) -> str:
    if composite_score >= cfg.SCORE_STRONG_BULL:
        return "Strong Bullish"
    elif composite_score >= cfg.SCORE_BULL:
        return "Bullish"
    elif composite_score <= cfg.SCORE_STRONG_BEAR:
        return "Strong Bearish"
    elif composite_score <= cfg.SCORE_BEAR:
        return "Bearish"
    else:
        return "Neutral"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  QUANT RESEARCH CLASSIFICATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Conviction Tiers — ordered by strength
CONVICTION_TIERS = ["Ultra Conviction", "High Conviction", "Moderate Conviction", "Low Conviction", "Contrarian"]

# Action Categories — ordered by bullishness
ACTION_CATEGORIES = ["Top Pick", "Accumulate", "Hold & Monitor", "Caution", "Reduce Exposure", "Avoid"]


def classify_conviction_tier(
    composite: float,
    probability: float,
    regime: str,
) -> str:
    """
    Assign a conviction tier based on composite score, probability,
    and market regime. Pure quant logic — no sentiment heuristics.
    """
    if probability >= 80 and composite >= 1.5 and regime == "Trending":
        return "Ultra Conviction"
    elif probability >= 65 and composite >= 0.8:
        return "High Conviction"
    elif probability >= 50 and composite >= 0.3:
        return "Moderate Conviction"
    elif probability >= 35 and composite > 0:
        return "Low Conviction"
    else:
        return "Contrarian"


def classify_action_category(
    conviction_tier: str,
    momentum_phase: str,
    regime: str,
    smart_money_trigger: bool,
    composite: float,
) -> str:
    """
    Assign an action category by combining conviction tier with
    momentum lifecycle phase and regime context.
    """
    # Top Pick: highest conviction + fresh trend confirmed
    if conviction_tier in ("Ultra Conviction", "High Conviction") and momentum_phase == "Fresh" and regime == "Trending":
        return "Top Pick"

    # Accumulate: strong conviction + institutional accumulation signal
    if conviction_tier in ("High Conviction", "Moderate Conviction") and smart_money_trigger:
        return "Accumulate"

    # Caution: any bullish conviction but momentum exhausting
    if momentum_phase == "Exhausting" and composite > 0:
        return "Caution"

    # Reduce Exposure: weak conviction + declining
    if conviction_tier == "Low Conviction" and momentum_phase == "Declining":
        return "Reduce Exposure"

    # Avoid: contrarian + broken trend
    if conviction_tier == "Contrarian" and regime in ("Choppy", "Unknown") and momentum_phase == "Declining":
        return "Avoid"

    if conviction_tier == "Contrarian":
        return "Reduce Exposure"

    # Hold & Monitor: moderate conviction, mean-reverting, or neutral phase
    return "Hold & Monitor"


def classify_signal(
    composite: float,
    probability: float,
    regime: str,
    momentum_phase: str,
    smart_money_trigger: bool,
) -> tuple[str, str]:
    """
    Full classification pipeline. Returns (conviction_tier, action_category).
    """
    tier = classify_conviction_tier(composite, probability, regime)
    action = classify_action_category(tier, momentum_phase, regime, smart_money_trigger, composite)
    return tier, action


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  AUTO-GENERATED RESEARCH THESIS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def generate_thesis(signal: dict) -> str:
    """
    Generate a 2-3 sentence research thesis explaining why this stock
    is classified the way it is. Uses indicator data to produce
    Moby.invest-style readable explanations.
    """
    parts = []
    ticker = signal.get("ticker", "")
    composite = signal.get("composite", 0)
    probability = signal.get("probability", 0)
    regime = signal.get("regime", "Unknown")
    phase = signal.get("momentum_phase", "Neutral")
    tier = signal.get("conviction_tier", "Contrarian")
    action = signal.get("action_category", "Hold & Monitor")
    sector = signal.get("sector", "Unknown")
    daily_change = signal.get("daily_change", 0)
    vol_spike = signal.get("vol_spike", 1.0)
    sm = signal.get("smart_money", {})
    shock = signal.get("momentum_shock", {})

    # Opening — conviction context
    if tier == "Ultra Conviction":
        parts.append(f"{ticker} shows rare 4-system alignment with {probability}% confidence in a strong trending regime")
    elif tier == "High Conviction":
        parts.append(f"{ticker} is showing strong momentum with {probability}% confidence across multiple indicator systems")
    elif tier == "Moderate Conviction":
        parts.append(f"{ticker} has moderate momentum signals with {probability}% confidence")
    elif tier == "Low Conviction":
        parts.append(f"{ticker} has weak directional signals with only {probability}% confidence")
    else:
        parts.append(f"{ticker} is showing contrarian signals at {probability}% confidence — momentum is against the trend")

    # Regime context
    if regime == "Trending":
        parts.append(f"The {sector} sector is in a trending regime, which historically favors momentum strategies")
    elif regime == "Mean-Reverting":
        parts.append(f"The {sector} sector is mean-reverting — oscillator-based strategies may outperform here")
    elif regime == "Choppy":
        parts.append(f"The {sector} sector is choppy — consider reduced position sizing and wider stops")

    # Phase-specific insights
    if phase == "Fresh":
        parts.append("This is early-stage momentum — maximum upside potential before the crowd catches on")
    elif phase == "Exhausting":
        parts.append("Momentum is exhausting — consider taking partial profits or tightening stops")

    # Smart money / volume signals
    if sm.get("trigger"):
        parts.append("Institutional volume accumulation detected — smart money is moving in")
    elif vol_spike and vol_spike > 1.5:
        parts.append(f"Volume is {vol_spike:.1f}x above average, signaling heightened institutional interest")

    # Momentum shock
    if shock.get("trigger"):
        strength = shock.get("shock_strength", 0)
        direction = "upside" if strength > 0 else "downside"
        parts.append(f"Price has broken {abs(strength):.1f}σ to the {direction} — a momentum shock event")

    return ". ".join(parts) + "."


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PRICE TARGET & STOP LOSS (ATR-based)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def compute_price_target(
    df: pd.DataFrame,
    composite: float,
    sentiment: str,
) -> dict:
    """
    Compute ATR-based price target and stop loss.
    
    Bullish: target = price + 2.5×ATR, stop = price - 1.5×ATR
    Bearish: target = price - 2.5×ATR, stop = price + 1.5×ATR
    
    Returns dict with price_target, stop_loss, upside_pct, risk_reward.
    """
    if len(df) < 21:
        return {"price_target": None, "stop_loss": None, "upside_pct": None, "risk_reward": None}

    try:
        # Compute 14-period ATR
        high = df["High"].iloc[-14:]
        low = df["Low"].iloc[-14:]
        close = df["Close"].iloc[-15:-1]
        
        tr = pd.concat([
            high - low,
            (high - close).abs(),
            (low - close).abs()
        ], axis=1).max(axis=1)
        
        atr = float(tr.mean())
        last_close = float(df["Close"].iloc[-1])
        
        if "Bull" in sentiment or composite > 0:
            price_target = round(last_close + 2.5 * atr, 2)
            stop_loss = round(last_close - 1.5 * atr, 2)
        else:
            price_target = round(last_close - 2.5 * atr, 2)
            stop_loss = round(last_close + 1.5 * atr, 2)
        
        upside_pct = round((price_target - last_close) / last_close * 100, 1)
        risk = abs(last_close - stop_loss)
        reward = abs(price_target - last_close)
        risk_reward = round(reward / risk, 2) if risk > 0 else 0
        
        return {
            "price_target": price_target,
            "stop_loss": stop_loss,
            "upside_pct": upside_pct,
            "risk_reward": risk_reward,
        }
    except Exception:
        return {"price_target": None, "stop_loss": None, "upside_pct": None, "risk_reward": None}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PROBABILITY CALCULATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def compute_probability(scores: list[float]) -> float:
    """
    Probability = directional agreement × average magnitude.

    If 4/4 systems agree on direction → high confidence.
    If 2 agree, 2 oppose → low confidence.
    Scaled to 0–100%.
    """
    if not scores:
        return 0.0

    signs = [1 if s > 0.1 else (-1 if s < -0.1 else 0) for s in scores]
    n_bull = sum(1 for s in signs if s > 0)
    n_bear = sum(1 for s in signs if s < 0)
    n_total = len(signs)

    # Agreement ratio: what fraction agrees with the majority?
    dominant = max(n_bull, n_bear)
    agreement = dominant / n_total

    # Average magnitude (normalised to 0–1 from the ±2 scale)
    avg_mag = np.mean([abs(s) for s in scores]) / 2.0

    # Probability = agreement × magnitude, scaled to 0–100
    prob = agreement * avg_mag * 100

    # Bonus for unanimous agreement
    if dominant == n_total and n_total >= 3:
        prob = min(prob * 1.2, 98.0)

    return round(float(np.clip(prob, 1.0, 98.0)), 1)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  FULL SCREENING PIPELINE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def screen_ticker(ticker: str, df: pd.DataFrame) -> dict | None:
    """
    Run all four indicator systems on a single ticker.

    Returns a dict with system scores, composite, regime, sentiment, probability,
    and chart data — or None if the data is insufficient.
    """
    if len(df) < 100:
        return None

    try:
        # Score each system
        s1 = score_system1(df)
        s2 = score_system2(df)
        s3 = score_system3(df)
        s4 = score_system4(df)

        scores = [s1["score"], s2["score"], s3["score"], s4["score"]]
        composite = round(float(np.mean(scores)), 2)

        # Regime
        regime = classify_regime(df)

        # Sentiment
        sentiment = composite_sentiment(composite)

        # Probability
        probability = compute_probability(scores)

        # Price info
        last_close = float(df["Close"].iloc[-1])
        prev_close = float(df["Close"].iloc[-2]) if len(df) > 1 else last_close
        daily_change = round((last_close - prev_close) / prev_close * 100, 2)

        # 20-day return
        if len(df) >= 21:
            ret_20d = round((last_close / float(df["Close"].iloc[-21]) - 1) * 100, 2)
        else:
            ret_20d = 0.0

        # Volatility (20-day annualised)
        log_ret = np.log(df["Close"] / df["Close"].shift(1)).dropna()
        vol_20d = float(log_ret.iloc[-20:].std() * np.sqrt(252) * 100) if len(log_ret) >= 20 else None
        vol_20d = round(vol_20d, 1) if vol_20d else None

        # Volume Spike
        try:
            vol_20d_avg = df["Volume"].iloc[-21:-1].mean()
            last_vol = df["Volume"].iloc[-1]
            vol_spike = round(float(last_vol / vol_20d_avg), 2) if vol_20d_avg > 0 else 1.0
        except Exception:
            vol_spike = 1.0

        # Sector & company name
        sector = cfg.TICKER_SECTOR.get(ticker, "Unknown")
        company_name = getattr(cfg, 'COMPANY_NAMES', {}).get(ticker, ticker)

        # TA branch from system1
        ta_branch = s1.get("ta_branch", "MIXED")

        # Momentum Phase (based on stochastic crossover)
        stoch_k = s1.get("stoch_k", 50) or 50
        stoch_d = s1.get("stoch_d", 50) or 50
        if composite > 0 and stoch_k > stoch_d and stoch_k < 70:
            momentum_phase = "Fresh"
        elif composite > 0 and stoch_k > 80:
            momentum_phase = "Exhausting"
        elif composite < 0 and stoch_k < stoch_d:
            momentum_phase = "Declining"
        else:
            momentum_phase = "Neutral"

        # Momentum Shock (price > 2 std dev from 20-day mean)
        shock_trigger = False
        shock_strength = 0.0
        if len(df) >= 21:
            close_20 = df["Close"].iloc[-21:-1]
            mean_20 = float(close_20.mean())
            std_20 = float(close_20.std())
            if std_20 > 0:
                z_score = (last_close - mean_20) / std_20
                shock_trigger = abs(z_score) > 2.0
                shock_strength = round(float(z_score), 2)

        # Smart Money Accumulation (high volume + price moving up with low volatility)
        sm_trigger = False
        sm_score = 0.0
        if len(df) >= 21:
            avg_vol_20 = float(df["Volume"].iloc[-21:-1].mean())
            recent_vol = float(df["Volume"].iloc[-5:].mean())
            price_up = daily_change > 0 and ret_20d > 0
            vol_accumulation = recent_vol > avg_vol_20 * 1.3
            sm_trigger = price_up and vol_accumulation
            if sm_trigger:
                sm_score = round((recent_vol / avg_vol_20) * (ret_20d / 10), 2)

        # Momentum Continuation
        cont_prob = 0.0
        if composite > 0 and probability > 50:
            cont_prob = round(probability * (1 + composite / 5), 1)
            cont_prob = min(cont_prob, 98.0)

        # Chart data
        charts = extract_chart_data(df)

        # Quant research classification
        conviction_tier, action_category = classify_signal(
            composite, probability, regime, momentum_phase, sm_trigger
        )

        # Price target & stop loss (ATR-based)
        pt_data = compute_price_target(df, composite, sentiment)

        result = {
            "ticker": ticker,
            "company_name": company_name,
            "sector": sector,
            "ta_branch": ta_branch,
            "momentum_phase": momentum_phase,
            "price": round(last_close, 2),
            "daily_change": daily_change,
            "return_20d": ret_20d,
            "volatility_20d": vol_20d,
            "vol_spike": vol_spike,

            # System scores
            "sys1_score": s1["score"],
            "sys2_score": s2["score"],
            "sys3_score": s3["score"],
            "sys4_score": s4["score"],
            "composite": composite,

            # Advanced Signals
            "momentum_shock": {"trigger": shock_trigger, "shock_strength": shock_strength},
            "smart_money": {"trigger": sm_trigger, "score": sm_score},
            "continuation": {"probability": cont_prob},

            # Quant Research Classification
            "conviction_tier": conviction_tier,
            "action_category": action_category,

            # Price Targets (Moby.invest-style)
            "price_target": pt_data["price_target"],
            "stop_loss": pt_data["stop_loss"],
            "upside_pct": pt_data["upside_pct"],
            "risk_reward": pt_data["risk_reward"],

            # System details
            "sys1": s1,
            "sys2": s2,
            "sys3": s3,
            "sys4": s4,

            # Meta
            "regime": regime,
            "sentiment": sentiment,
            "probability": probability,

            # Charts
            "charts": charts,
        }

        # Auto-generated research thesis (Moby.invest-style)
        result["thesis"] = generate_thesis(result)

        return result

    except Exception as e:
        return None


def screen_universe(
    ohlcv: Dict[str, pd.DataFrame],
    progress: bool = True,
) -> list[dict]:
    """
    Screen the full universe and return a list of analysis dicts,
    sorted by absolute composite score descending.
    """
    results = []
    tickers = sorted(ohlcv.keys())

    for i, ticker in enumerate(tickers):
        if progress and (i + 1) % 10 == 0:
            print(f"    Processed {i + 1}/{len(tickers)} tickers …")

        result = screen_ticker(ticker, ohlcv[ticker])
        if result is not None:
            results.append(result)

    # Sort by |composite| descending
    results.sort(key=lambda x: abs(x["composite"]), reverse=True)

    if progress:
        print(f"    ✓ Screened {len(results)} tickers successfully.")

    return results


def sector_regimes(results: list[dict]) -> dict:
    """
    Compute majority regime for each sector.
    Returns {sector: {regime, bullish_pct, bearish_pct, count, avg_composite}}.
    """
    sector_data: dict[str, list] = {}
    for r in results:
        sec = r["sector"]
        if sec not in sector_data:
            sector_data[sec] = []
        sector_data[sec].append(r)

    output = {}
    for sec, items in sector_data.items():
        regimes = [i["regime"] for i in items]
        # Majority vote
        from collections import Counter
        regime_counts = Counter(regimes)
        majority_regime = regime_counts.most_common(1)[0][0]

        sentiments = [i["sentiment"] for i in items]
        bull = sum(1 for s in sentiments if "Bull" in s)
        bear = sum(1 for s in sentiments if "Bear" in s)
        total = len(items)

        avg_comp = round(float(np.mean([i["composite"] for i in items])), 2)
        avg_prob = round(float(np.mean([i["probability"] for i in items])), 1)

        output[sec] = {
            "regime": majority_regime,
            "bullish_pct": round(bull / total * 100, 0) if total else 0,
            "bearish_pct": round(bear / total * 100, 0) if total else 0,
            "neutral_pct": round((total - bull - bear) / total * 100, 0) if total else 0,
            "count": total,
            "avg_composite": avg_comp,
            "avg_probability": avg_prob,
        }

    return output
