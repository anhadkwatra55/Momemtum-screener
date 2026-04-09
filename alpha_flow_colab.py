"""
Alpha-Flow Options Intelligence — Google Colab Scanner
========================================================
Production-grade options scanner matching the backend pipeline exactly.

7 Institutional Gates:
  Gate 1: Stock Price ≥ $25 (no penny stocks)
  Gate 2: DTE 90–150 days (sweet spot for theta decay)
  Gate 3: Premium $1–$8 (institutional range)
  Gate 4: ATM/OTM only (strike ≥ stock price)
  Gate 5: Bid-Ask Spread ≤ 10% (liquidity filter)
  Gate 6: Open Interest > 100 (institutional demand)
  Gate 7: Delta ≥ 0.35 (real directional exposure)

Quant Metrics:
  - Black-Scholes Delta & Probability of Profit (POP)
  - Volatility Edge = HV(30d) − IV (positive = IV underpriced)
  - Composite Score = (POP × 40) + (Edge × 400) + (OI_bonus × 2)

Usage (Colab):
  !pip install yfinance pandas numpy scipy
  # Then paste this entire script and run
"""

import yfinance as yf
import pandas as pd
import numpy as np
from scipy.stats import norm
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import math
import time
import random
import warnings
warnings.filterwarnings("ignore")


# ═══════════════════════════════════════════════════════════════
# 1. BLACK-SCHOLES GREEKS
# ═══════════════════════════════════════════════════════════════

def calculate_greeks(S, K, T, r, sigma):
    """Black-Scholes Delta and Probability of Profit (POP)."""
    if T <= 0 or sigma <= 0:
        return 0.0, 0.0
    try:
        d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
        d2 = d1 - sigma * np.sqrt(T)
        delta = float(norm.cdf(d1))
        pop = float(norm.cdf(d2))
        if math.isnan(delta) or math.isinf(delta): delta = 0.0
        if math.isnan(pop) or math.isinf(pop): pop = 0.0
        return round(delta, 2), round(pop, 2)
    except Exception:
        return 0.0, 0.0


# ═══════════════════════════════════════════════════════════════
# 2. UNIVERSE FETCH
# ═══════════════════════════════════════════════════════════════

def get_sp500():
    """Fetch S&P 500 tickers from Wikipedia."""
    print("🌐 Fetching S&P 500 universe...")
    try:
        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        tables = pd.read_html(url, storage_options={"User-Agent": "Mozilla/5.0"})
        tickers = tables[0]["Symbol"].tolist()
        tickers = [t.replace(".", "-") for t in tickers]
        print(f"   ✓ {len(tickers)} tickers loaded")
        return tickers
    except Exception as e:
        print(f"   ⚠ Wikipedia fetch failed: {e}")
        return [
            "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "META", "TSLA", "BRK-B",
            "UNH", "JNJ", "V", "XOM", "JPM", "PG", "MA", "HD", "CVX", "MRK",
            "ABBV", "LLY", "PEP", "KO", "COST", "AVGO", "WMT", "MCD", "CSCO",
            "TMO", "ACN", "ABT", "DHR", "NEE", "LIN", "CRM", "AMD", "TXN",
            "PM", "UNP", "QCOM", "HON", "MS", "GS", "BA", "CAT", "RTX",
            "INTC", "AMGN", "IBM", "GE",
        ]


# ═══════════════════════════════════════════════════════════════
# 3. SINGLE-TICKER SCANNER (7 INSTITUTIONAL GATES)
# ═══════════════════════════════════════════════════════════════

def scan_ticker(symbol):
    """
    Scan one ticker through all 7 institutional gates.
    Returns list of qualifying contracts (dicts).
    """
    results = []

    # Anti-ban jitter
    time.sleep(random.uniform(0.05, 0.3))

    try:
        t = yf.Ticker(symbol)
        price = t.fast_info["lastPrice"]

        # ── Gate 1: Price Floor ($25) ──
        if price < 25:
            return []

        expirations = t.options
        if not expirations:
            return []

        today = datetime.now()

        # ── Gate 2: DTE 90–150 days ──
        valid_expiries = [
            e for e in expirations
            if 90 <= (datetime.strptime(e, "%Y-%m-%d") - today).days <= 150
        ]
        if not valid_expiries:
            return []

        # ── Pre-compute Historical Volatility ONCE (fixes N+1 bug) ──
        _hv = None

        def get_vol_edge(iv):
            nonlocal _hv
            if _hv is None:
                try:
                    hist = t.history(period="30d")["Close"]
                    if len(hist) >= 20:
                        _hv = float(np.log(hist / hist.shift(1)).dropna().std() * np.sqrt(252))
                    else:
                        _hv = 0.0
                except Exception:
                    _hv = 0.0
                if math.isnan(_hv) or math.isinf(_hv):
                    _hv = 0.0
            if _hv == 0.0:
                return 0.0
            return round(_hv - iv, 3)

        for exp in valid_expiries:
            try:
                chain = t.option_chain(exp).calls
                if chain is None or chain.empty:
                    continue

                dte_days = (datetime.strptime(exp, "%Y-%m-%d") - today).days
                dte_years = dte_days / 365.0

                # ══════════════════════════════════════════════════
                # VECTORIZED GATES 3–6 (Pandas bulk filtering)
                # ══════════════════════════════════════════════════

                chain = chain.copy()
                for col in ["bid", "ask", "lastPrice", "openInterest", "impliedVolatility", "volume"]:
                    if col in chain.columns:
                        chain[col] = pd.to_numeric(chain[col], errors="coerce").fillna(0)

                # Mid price (bid/ask average, fallback to lastPrice)
                has_quotes = (chain["bid"] > 0) & (chain["ask"] > 0)
                chain["mid"] = 0.0
                chain.loc[has_quotes, "mid"] = (chain.loc[has_quotes, "bid"] + chain.loc[has_quotes, "ask"]) / 2
                chain.loc[~has_quotes, "mid"] = chain.loc[~has_quotes, "lastPrice"]
                chain["after_hours"] = ~has_quotes

                # Spread %
                chain["spread_pct"] = 0.0
                chain.loc[has_quotes, "spread_pct"] = (
                    (chain.loc[has_quotes, "ask"] - chain.loc[has_quotes, "bid"]) / chain.loc[has_quotes, "mid"] * 100
                )

                has_price = chain["mid"] > 0

                # Gate 3: Premium $1–$8
                gate3 = (chain["mid"] >= 1.0) & (chain["mid"] <= 8.0)

                # Gate 4: ATM/OTM only
                gate4 = chain["strike"] >= price

                # Gate 5: Spread ≤ 10% (skip if after-hours)
                gate5 = chain["after_hours"] | (chain["spread_pct"] <= 10)

                # Gate 6: Open Interest > 100 (skip if after-hours)
                gate6 = chain["after_hours"] | (chain["openInterest"].astype(int) > 100)

                # Combined mask
                survivors = chain[has_price & gate3 & gate4 & gate5 & gate6]
                if survivors.empty:
                    continue

                # ══════════════════════════════════════════════════
                # ITERATE SURVIVORS — compute Greeks + Quant Score
                # ══════════════════════════════════════════════════

                for _, opt in survivors.iterrows():
                    bid = float(opt["bid"])
                    ask = float(opt["ask"])
                    mid = float(opt["mid"])
                    after_hours = bool(opt["after_hours"])
                    oi = int(opt["openInterest"])
                    iv = float(opt["impliedVolatility"])

                    # Black-Scholes or fallback
                    if after_hours or iv < 0.10:
                        ratio = price / float(opt["strike"])
                        delta = round(max(0, min(1.0, 0.5 + (ratio - 1.0) * 2.5)), 2)
                        pop = round(max(0, min(1.0, delta * 0.85)), 2)
                        edge = 0.0
                    else:
                        delta, pop = calculate_greeks(price, opt["strike"], dte_years, 0.04, iv)
                        edge = get_vol_edge(iv)

                    # ── Gate 7: Delta ≥ 0.35 ──
                    if delta < 0.35:
                        continue

                    # Breakeven %
                    be_pct = (((opt["strike"] + mid) / price) - 1) * 100

                    # COMPOSITE QUANT SCORE (0–100)
                    quant_score = (pop * 40) + (max(0, edge) * 100 * 4) + (min(10, oi / 1000) * 2)

                    results.append({
                        "Ticker": symbol,
                        "Price": round(price, 2),
                        "Strike": float(opt["strike"]),
                        "Exp": exp,
                        "DTE": dte_days,
                        "Bid": round(bid, 2),
                        "Ask": round(ask, 2),
                        "Mid": round(mid, 2),
                        "Delta": delta,
                        "POP": pop,
                        "Edge": edge,
                        "BE%": round(be_pct, 2),
                        "OI": oi,
                        "IV%": round(iv * 100, 1),
                        "Spread%": round(float(opt["spread_pct"]), 1),
                        "Score": round(quant_score, 2),
                        "Type": "ATM" if abs(opt["strike"] - price) / price < 0.03 else "OTM",
                    })

            except Exception:
                continue

    except Exception:
        pass

    return results


# ═══════════════════════════════════════════════════════════════
# 4. PARALLEL ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════

def run_alpha_scan(tickers=None, max_tickers=500, workers=4):
    """
    Run the full Alpha-Flow scan.

    Args:
        tickers:     List of tickers (None = fetch S&P 500)
        max_tickers: Max tickers to scan (default 500)
        workers:     Thread pool size (default 4)

    Returns:
        pd.DataFrame of qualifying contracts sorted by Score
    """
    if tickers is None:
        tickers = get_sp500()

    scan_list = tickers[:max_tickers]
    print(f"\n🚀 Alpha-Flow Scan: {len(scan_list)} tickers | {workers} workers | Gates: 7")
    print(f"   Filters: Price≥$25 | DTE 90–150d | Premium $1–8 | Spread≤10%")
    print(f"            OI>100 | Delta≥0.35 | ATM/OTM only\n")

    all_calls = []
    errors = 0
    t0 = time.monotonic()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(scan_ticker, sym): sym for sym in scan_list}
        done = 0
        for future in as_completed(futures):
            done += 1
            if done % 25 == 0 or done == len(scan_list):
                elapsed = time.monotonic() - t0
                print(f"   ⏳ {done}/{len(scan_list)} scanned ({elapsed:.0f}s)")
            try:
                res = future.result(timeout=30)
                all_calls.extend(res)
            except Exception:
                errors += 1

    elapsed = round(time.monotonic() - t0, 1)
    tickers_hit = len(set(c["Ticker"] for c in all_calls))

    print(f"\n✅ Done in {elapsed}s — {len(all_calls)} contracts from {tickers_hit} tickers ({errors} errors)")

    if not all_calls:
        print("No contracts survived all 7 gates.")
        return pd.DataFrame()

    df = pd.DataFrame(all_calls).sort_values("Score", ascending=False).reset_index(drop=True)
    return df


# ═══════════════════════════════════════════════════════════════
# 5. EXECUTION — Run in Colab
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # Fetch S&P 500 and scan
    universe = get_sp500()
    results = run_alpha_scan(tickers=universe, max_tickers=500, workers=4)

    print("\n" + "═" * 80)
    print("🔥 ALPHA-FLOW OPTIONS INTELLIGENCE — TOP CONTRACTS")
    print("═" * 80)

    if not results.empty:
        # Show top 30
        display_cols = ["Ticker", "Price", "Strike", "Exp", "DTE", "Mid",
                        "Delta", "POP", "Edge", "IV%", "OI", "Score", "Type"]
        top = results[display_cols].head(30)

        try:
            from IPython.display import display
            display(top)
        except ImportError:
            print(top.to_string(index=False))

        print(f"\nTotal: {len(results)} contracts | Showing top 30 by Quant Score")
        print(f"\nScore = (POP × 40) + (Vol Edge × 400) + (OI bonus × 2)")
        print(f"Edge = HV(30d) − IV  (positive = IV is underpriced → cheap option)")
    else:
        print("No contracts survived all 7 institutional gates.")
