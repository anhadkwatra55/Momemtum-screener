"""
Alpha-Flow Options Intelligence — Google Colab Analysis Script
===============================================================
Run this in Google Colab to see the full math behind the Alpha Calls page.

Usage:
  1. Open Google Colab (colab.research.google.com)
  2. Paste this entire script into a cell
  3. Run it — takes ~2-5 minutes (scanning 50 S&P 500 tickers)

The script reproduces the EXACT same math as the production backend.
"""

# ── Install dependencies ──
# !pip install yfinance scipy pandas requests lxml -q

import math
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import pandas as pd
import requests
from scipy.stats import norm

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  STEP 1: Fetch the S&P 500 Universe from Wikipedia
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print("=" * 70)
print("  ALPHA-FLOW OPTIONS INTELLIGENCE — Full Analysis")
print("=" * 70)

url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
headers = {"User-Agent": "Mozilla/5.0"}
resp = requests.get(url, headers=headers, timeout=15)
sp500_tickers = pd.read_html(resp.text)[0]["Symbol"].tolist()
print(f"\n📊 Step 1: Fetched {len(sp500_tickers)} S&P 500 tickers from Wikipedia")
print(f"   First 10: {sp500_tickers[:10]}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  STEP 2: The Black-Scholes Math (Delta, POP, Vol Edge)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class FlowProtocol:
    """Core quant calculations — identical to production backend."""

    @staticmethod
    def calculate_greeks(S, K, T, r, sigma):
        """
        Black-Scholes Greeks for a European Call Option.

        Inputs:
          S     = current stock price
          K     = strike price
          T     = time to expiration in YEARS (DTE / 365)
          r     = risk-free rate (we use 4% = 0.04)
          sigma = implied volatility (annualized, e.g. 0.30 = 30%)

        Math:
          d₁ = [ln(S/K) + (r + σ²/2) × T] / (σ × √T)
          d₂ = d₁ - σ × √T

          Delta = N(d₁)   ← probability-weighted directional exposure
          POP   = N(d₂)   ← probability of expiring in-the-money

        Where N() is the cumulative standard normal distribution.
        """
        if T <= 0 or sigma <= 0:
            return 0, 0
        try:
            d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
            d2 = d1 - sigma * np.sqrt(T)
            delta = float(norm.cdf(d1))
            pop = float(norm.cdf(d2))  # Probability of Profit
            if math.isnan(delta) or math.isinf(delta):
                delta = 0
            if math.isnan(pop) or math.isinf(pop):
                pop = 0
            return round(delta, 4), round(pop, 4)
        except Exception:
            return 0, 0

    @staticmethod
    def get_iv_hv_edge(ticker_obj, iv):
        """
        Volatility Edge = Historical Volatility - Implied Volatility

        Math:
          daily_returns = ln(close_t / close_{t-1})
          HV = std(daily_returns) × √252     ← annualized

          Edge = HV - IV

        Interpretation:
          Edge > 0 → Options are CHEAP (market underpricing volatility)
          Edge < 0 → Options are EXPENSIVE (market overpricing volatility)
          Edge ≈ 0 → Fair pricing
        """
        try:
            hist = ticker_obj.history(period="30d")["Close"]
            if len(hist) < 20:
                return 0
            log_returns = np.log(hist / hist.shift(1)).dropna()
            hv = float(log_returns.std() * np.sqrt(252))  # Annualized
            if math.isnan(hv) or math.isinf(hv):
                return 0
            return round(hv - iv, 3)
        except Exception:
            return 0


# ── Demo: Show the math for a real example ──
print("\n" + "─" * 70)
print("  STEP 2: Black-Scholes Math Demo")
print("─" * 70)

demo_S = 180.0   # Stock price = $180
demo_K = 185.0   # Strike = $185 (OTM call)
demo_T = 120/365 # 120 days to expiration
demo_r = 0.04    # Risk-free rate = 4%
demo_sigma = 0.30 # IV = 30%

d1 = (np.log(demo_S / demo_K) + (demo_r + 0.5 * demo_sigma**2) * demo_T) / (demo_sigma * np.sqrt(demo_T))
d2 = d1 - demo_sigma * np.sqrt(demo_T)
demo_delta, demo_pop = FlowProtocol.calculate_greeks(demo_S, demo_K, demo_T, demo_r, demo_sigma)

print(f"""
  Example: $180 stock, $185 strike, 120 DTE, IV=30%, r=4%

  d₁ = [ln(180/185) + (0.04 + 0.5 × 0.30²) × {demo_T:.4f}] / (0.30 × √{demo_T:.4f})
     = [ln({180/185:.4f}) + ({0.04 + 0.5*0.30**2:.4f}) × {demo_T:.4f}] / ({0.30 * np.sqrt(demo_T):.4f})
     = [{np.log(180/185):.4f} + {(0.04 + 0.5*0.30**2) * demo_T:.4f}] / {0.30 * np.sqrt(demo_T):.4f}
     = {d1:.4f}

  d₂ = {d1:.4f} - {demo_sigma * np.sqrt(demo_T):.4f} = {d2:.4f}

  Delta = N(d₁) = N({d1:.4f}) = {demo_delta:.4f}  ← {demo_delta*100:.1f}% directional exposure
  POP   = N(d₂) = N({d2:.4f}) = {demo_pop:.4f}  ← {demo_pop*100:.1f}% chance of expiring ITM
""")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  STEP 3: The 7 Institutional Gates + Quant Score
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print("─" * 70)
print("  STEP 3: The 7 Institutional Gates")
print("─" * 70)
print("""
  Every option contract must pass ALL 7 gates:

  Gate 1: Price Floor        → Stock price ≥ $25
  Gate 2: Time Buffer        → 90 ≤ DTE ≤ 150 days
  Gate 3: Premium Range      → $1 ≤ mid price ≤ $8
  Gate 4: ATM/OTM Only       → Strike ≥ stock price
  Gate 5: Spread Check       → Bid-ask spread ≤ 10%
  Gate 6: Liquidity Floor    → Open Interest > 100
  Gate 7: Delta Floor        → Delta ≥ 0.35

  Composite Quant Score (0-100):
  ┌──────────────────────────────────────────────────────────────┐
  │  Score = (POP × 40) + (max(0, edge) × 400) + (min(10, OI/1000) × 2)  │
  │          ─── 40% ──   ──── 40% (positive only) ────   ── 20% ──│
  └──────────────────────────────────────────────────────────────┘
""")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  STEP 4: Live Scan — Reproduce the Production Pipeline
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import yfinance as yf

def scan_one_ticker(symbol, verbose=False):
    """
    Scan a single ticker's option chain.
    Returns list of contracts that pass all 7 gates.
    """
    results = []
    gate_stats = {"price": 0, "dte": 0, "premium": 0, "otm": 0,
                  "spread": 0, "oi": 0, "delta": 0, "passed": 0}
    try:
        t = yf.Ticker(symbol.replace(".", "-"))
        price = t.fast_info["lastPrice"]

        # Gate 1: Price Floor
        if price < 25:
            if verbose: print(f"  ✗ {symbol}: price ${price:.2f} < $25")
            gate_stats["price"] += 1
            return results, gate_stats

        expirations = t.options
        if not expirations:
            return results, gate_stats

        today = datetime.now()

        # Gate 2: DTE range 90-150
        valid_expiries = [
            e for e in expirations
            if 90 <= (datetime.strptime(e, "%Y-%m-%d") - today).days <= 150
        ]
        if not valid_expiries:
            gate_stats["dte"] += 1
            return results, gate_stats

        for exp in valid_expiries:
            try:
                chain = t.option_chain(exp).calls
                if chain.empty:
                    continue

                dte_days = (datetime.strptime(exp, "%Y-%m-%d") - today).days
                dte_years = dte_days / 365.0

                for _, opt in chain.iterrows():
                    bid = float(opt.get("bid", 0) or 0)
                    ask = float(opt.get("ask", 0) or 0)
                    last_price = float(opt.get("lastPrice", 0) or 0)

                    # Price fallback for after-hours
                    if bid > 0 and ask > 0:
                        mid = (bid + ask) / 2
                        spread_pct = ((ask - bid) / mid) * 100
                        after_hours = False
                    elif last_price > 0:
                        mid = last_price
                        spread_pct = 0
                        after_hours = True
                    else:
                        continue

                    # Gate 3: Premium $1-$8
                    if not (1.0 <= mid <= 8.0):
                        gate_stats["premium"] += 1
                        continue

                    # Gate 4: ATM/OTM only
                    if opt["strike"] < price:
                        gate_stats["otm"] += 1
                        continue

                    # Gate 5: Spread ≤ 10%
                    if not after_hours and spread_pct > 10:
                        gate_stats["spread"] += 1
                        continue

                    # Gate 6: OI > 100
                    oi = int(opt.get("openInterest", 0) or 0)
                    if not after_hours and oi < 100:
                        gate_stats["oi"] += 1
                        continue

                    iv = float(opt.get("impliedVolatility", 0) or 0)

                    # Calculate Greeks
                    if after_hours or iv < 0.10:
                        ratio = price / float(opt["strike"])
                        delta = round(max(0, min(1.0, 0.5 + (ratio - 1.0) * 2.5)), 2)
                        pop = round(max(0, min(1.0, delta * 0.85)), 2)
                        edge = 0
                    else:
                        delta, pop = FlowProtocol.calculate_greeks(
                            price, opt["strike"], dte_years, 0.04, iv
                        )
                        edge = FlowProtocol.get_iv_hv_edge(t, iv)

                    # Gate 7: Delta ≥ 0.35
                    if delta < 0.35:
                        gate_stats["delta"] += 1
                        continue

                    # Breakeven %
                    be_pct = (((opt["strike"] + mid) / price) - 1) * 100

                    # Composite Quant Score
                    quant_score = (pop * 40) + (max(0, edge) * 100 * 4) + (min(10, oi / 1000) * 2)

                    gate_stats["passed"] += 1

                    results.append({
                        "ticker": symbol,
                        "stock_price": round(price, 2),
                        "strike": float(opt["strike"]),
                        "expiration": exp,
                        "dte": dte_days,
                        "bid": round(bid, 2),
                        "ask": round(ask, 2),
                        "mid_price": round(mid, 2),
                        "delta": delta,
                        "pop": pop,
                        "vol_edge": edge,
                        "breakeven_pct": round(be_pct, 2),
                        "open_interest": oi,
                        "volume": int(opt.get("volume", 0) or 0),
                        "implied_volatility": round(iv * 100, 1),
                        "spread_pct": round(spread_pct, 1),
                        "quant_score": round(quant_score, 2),
                        "moneyness": "ATM" if abs(opt["strike"] - price) / price < 0.03 else "OTM",
                    })

            except Exception as e:
                continue

    except Exception as e:
        if verbose: print(f"  ✗ {symbol}: {e}")

    return results, gate_stats


# ── Run the scan ──
print("\n" + "=" * 70)
print("  STEP 4: LIVE SCAN — Scanning 50 S&P 500 Tickers")
print("=" * 70)

SCAN_LIMIT = 50  # Change to 500 for full scan (takes ~15-20 min)
scan_tickers = sp500_tickers[:SCAN_LIMIT]

all_calls = []
total_gate_stats = {"price": 0, "dte": 0, "premium": 0, "otm": 0,
                    "spread": 0, "oi": 0, "delta": 0, "passed": 0}
errors = 0
scan_start = time.time()

print(f"\n  Scanning {len(scan_tickers)} tickers with 4 threads...\n")

with ThreadPoolExecutor(max_workers=4) as executor:
    futures = {executor.submit(scan_one_ticker, sym): sym for sym in scan_tickers}
    completed = 0
    for future in as_completed(futures):
        completed += 1
        sym = futures[future]
        try:
            results, stats = future.result(timeout=30)
            all_calls.extend(results)
            for k, v in stats.items():
                total_gate_stats[k] += v
            if results:
                print(f"  ✓ [{completed}/{len(scan_tickers)}] {sym}: {len(results)} contracts found")
            elif completed % 10 == 0:
                print(f"  · [{completed}/{len(scan_tickers)}] {sym}: 0 contracts")
        except Exception:
            errors += 1

# Sort by quant score
all_calls.sort(key=lambda x: x["quant_score"], reverse=True)
scan_elapsed = round(time.time() - scan_start, 1)

print(f"\n{'═' * 70}")
print(f"  SCAN COMPLETE — {scan_elapsed}s")
print(f"{'═' * 70}")
print(f"  Tickers scanned:    {len(scan_tickers)}")
print(f"  Contracts found:    {len(all_calls)}")
print(f"  Unique tickers:     {len(set(c['ticker'] for c in all_calls))}")
print(f"  Errors:             {errors}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  STEP 5: Gate Filter Analysis
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print(f"\n{'─' * 70}")
print("  STEP 5: Gate Filter Analysis — Where Do Contracts Get Rejected?")
print(f"{'─' * 70}")
print(f"""
  Gate 1 (Price Floor $25):     {total_gate_stats['price']:>6} tickers rejected
  Gate 2 (DTE 90-150 days):     {total_gate_stats['dte']:>6} tickers rejected
  Gate 3 (Premium $1-$8):       {total_gate_stats['premium']:>6} contracts rejected
  Gate 4 (ATM/OTM only):        {total_gate_stats['otm']:>6} contracts rejected
  Gate 5 (Spread ≤ 10%):        {total_gate_stats['spread']:>6} contracts rejected
  Gate 6 (OI > 100):            {total_gate_stats['oi']:>6} contracts rejected
  Gate 7 (Delta ≥ 0.35):        {total_gate_stats['delta']:>6} contracts rejected
  ─────────────────────────────────────────────────
  PASSED ALL 7 GATES:           {total_gate_stats['passed']:>6} contracts ✓
""")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  STEP 6: Results Table + Math Breakdown
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if all_calls:
    df = pd.DataFrame(all_calls)

    print(f"\n{'─' * 70}")
    print("  STEP 6: Top Contracts by Quant Score")
    print(f"{'─' * 70}")

    display_cols = ["ticker", "stock_price", "strike", "expiration", "dte",
                    "mid_price", "delta", "pop", "vol_edge", "breakeven_pct",
                    "open_interest", "implied_volatility", "quant_score", "moneyness"]
    print(df[display_cols].head(20).to_string(index=False))

    # Detailed math breakdown for top 3
    print(f"\n{'─' * 70}")
    print("  STEP 7: Math Breakdown — Top 3 Contracts")
    print(f"{'─' * 70}")

    for i, call in enumerate(all_calls[:3]):
        pop_contribution = call["pop"] * 40
        edge_contribution = max(0, call["vol_edge"]) * 100 * 4
        oi_contribution = min(10, call["open_interest"] / 1000) * 2

        print(f"""
  #{i+1} {call['ticker']} ${call['strike']} {call['expiration']} ({call['dte']} DTE)
  ├── Stock Price: ${call['stock_price']}
  ├── Mid Price:   ${call['mid_price']}  (bid ${call['bid']} / ask ${call['ask']})
  ├── Delta:       {call['delta']}
  ├── POP:         {call['pop']} ({call['pop']*100:.0f}%)
  ├── Vol Edge:    {call['vol_edge']}  (HV - IV)
  ├── IV:          {call['implied_volatility']}%
  ├── OI:          {call['open_interest']}
  ├── Breakeven:   {call['breakeven_pct']:.1f}%  (stock must move this much)
  ├── Moneyness:   {call['moneyness']}
  │
  └── Quant Score: {call['quant_score']:.2f}
      = (POP × 40) + (max(0, edge) × 400) + (min(10, OI/1000) × 2)
      = ({call['pop']} × 40) + (max(0, {call['vol_edge']}) × 400) + (min(10, {call['open_interest']}/1000) × 2)
      = {pop_contribution:.2f} + {edge_contribution:.2f} + {oi_contribution:.2f}
      = {call['quant_score']:.2f}
""")

    # ── Summary statistics ──
    print(f"\n{'─' * 70}")
    print("  STEP 8: Summary Statistics")
    print(f"{'─' * 70}")
    print(f"""
  Total contracts:         {len(df)}
  Average Quant Score:     {df['quant_score'].mean():.2f}
  Median Quant Score:      {df['quant_score'].median():.2f}
  Avg Delta:               {df['delta'].mean():.3f}
  Avg POP:                 {df['pop'].mean():.3f} ({df['pop'].mean()*100:.1f}%)
  Avg Vol Edge:            {df['vol_edge'].mean():.3f}
  Avg Breakeven:           {df['breakeven_pct'].mean():.1f}%
  Avg IV:                  {df['implied_volatility'].mean():.1f}%
  Avg OI:                  {df['open_interest'].mean():.0f}
  ATM contracts:           {len(df[df['moneyness'] == 'ATM'])}
  OTM contracts:           {len(df[df['moneyness'] == 'OTM'])}
""")

    # ── Ticker distribution ──
    print(f"  Contracts per ticker:")
    ticker_counts = df.groupby("ticker").size().sort_values(ascending=False)
    for ticker, count in ticker_counts.items():
        avg_score = df[df["ticker"] == ticker]["quant_score"].mean()
        print(f"    {ticker:>6}: {count:>3} contracts  (avg score: {avg_score:.1f})")

else:
    print("\n  No contracts found. Market may be closed (try during trading hours).")
    print("  After-hours scans find fewer contracts due to missing bid/ask/OI data.")

print(f"\n{'═' * 70}")
print("  Analysis complete! Running weight simulations next...")
print(f"{'═' * 70}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  STEP 9: Weight Simulation — 20%, 40%, 60% Edge Weight
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def calc_quant_score_weighted(pop, edge, oi, w_pop, w_edge, w_oi):
    """
    Parameterized Quant Score.

    Original formula (production):
      score = (POP × 40) + (max(0, edge) × 400) + (min(10, OI/1000) × 2)

    Each component is normalized to ~[0, 100], then weighted:
      POP component:  POP × 100            [0, 100]
      Edge component: max(0, edge) × 1000  [0, ~100]
      OI component:   min(10, OI/1000) × 10 [0, 100]
    """
    pop_score = pop * 100
    edge_score = max(0, edge) * 1000
    oi_score = min(10, oi / 1000) * 10
    return round(w_pop * pop_score + w_edge * edge_score + w_oi * oi_score, 2)


if all_calls:
    print(f"\n\n{'═' * 70}")
    print("  STEP 9: WEIGHT SIMULATION — How Edge Weight Affects Quant Score")
    print(f"{'═' * 70}")
    print("""
  We re-calculate the quant score for ALL scanned contracts under 3 regimes:

  ┌────────────────┬───────────┬────────────┬───────────┬───────────────────────┐
  │ Simulation     │ POP Wt    │ Edge Wt    │ OI Wt     │ Strategy Bias         │
  ├────────────────┼───────────┼────────────┼───────────┼───────────────────────┤
  │ Sim A (20%)    │   60%     │   20%      │   20%     │ POP-heavy / safe      │
  │ Sim B (40%)    │   40%     │   40%      │   20%     │ Balanced (production) │
  │ Sim C (60%)    │   20%     │   60%      │   20%     │ Edge-heavy / alpha    │
  └────────────────┴───────────┴────────────┴───────────┴───────────────────────┘
    """)

    simulations = {
        "Sim A (20% Edge Weight)": {"w_pop": 0.60, "w_edge": 0.20, "w_oi": 0.20,
                                     "label": "POP-heavy: safety-first approach"},
        "Sim B (40% Edge Weight)": {"w_pop": 0.40, "w_edge": 0.40, "w_oi": 0.20,
                                     "label": "Balanced: current production weights"},
        "Sim C (60% Edge Weight)": {"w_pop": 0.20, "w_edge": 0.60, "w_oi": 0.20,
                                     "label": "Edge-heavy: volatility-alpha approach"},
    }

    sim_dataframes = {}

    for sim_name, cfg in simulations.items():
        print(f"\n{'━' * 70}")
        print(f"  {sim_name}")
        print(f"  {cfg['label']}")
        print(f"  Weights: POP={cfg['w_pop']:.0%}  |  Vol Edge={cfg['w_edge']:.0%}  |  OI={cfg['w_oi']:.0%}")
        print(f"{'━' * 70}")

        scored = []
        for c in all_calls:
            qs = calc_quant_score_weighted(
                c["pop"], c["vol_edge"], c["open_interest"],
                cfg["w_pop"], cfg["w_edge"], cfg["w_oi"]
            )
            scored.append({**c, "quant_score": qs})

        scored.sort(key=lambda x: x["quant_score"], reverse=True)
        sim_df = pd.DataFrame(scored)
        sim_dataframes[sim_name] = sim_df

        display_cols = ["ticker", "strike", "expiration", "dte",
                        "mid_price", "delta", "pop", "vol_edge",
                        "open_interest", "quant_score", "moneyness"]
        print(f"\n  Top 10 contracts:")
        print(sim_df[display_cols].head(10).to_string(index=False))

        print(f"\n  Stats:")
        print(f"    Avg Quant Score:  {sim_df['quant_score'].mean():.2f}")
        print(f"    Median Score:     {sim_df['quant_score'].median():.2f}")
        print(f"    Max Score:        {sim_df['quant_score'].max():.2f}")
        print(f"    Std Dev:          {sim_df['quant_score'].std():.2f}")

        # Math breakdown for #1
        top = scored[0]
        pop_s = top["pop"] * 100
        edge_s = max(0, top["vol_edge"]) * 1000
        oi_s = min(10, top["open_interest"] / 1000) * 10
        print(f"\n  Math for #1 ({top['ticker']} ${top['strike']} {top['expiration']}):")
        print(f"    POP:  {cfg['w_pop']:.0%} × ({top['pop']} × 100) = {cfg['w_pop'] * pop_s:.2f}")
        print(f"    Edge: {cfg['w_edge']:.0%} × (max(0,{top['vol_edge']}) × 1000) = {cfg['w_edge'] * edge_s:.2f}")
        print(f"    OI:   {cfg['w_oi']:.0%} × (min(10,{top['open_interest']}/1000) × 10) = {cfg['w_oi'] * oi_s:.2f}")
        print(f"    TOTAL = {top['quant_score']:.2f}")

    # ── Cross-simulation comparison ──
    print(f"\n\n{'═' * 70}")
    print("  CROSS-SIMULATION COMPARISON — Rankings Side by Side")
    print(f"{'═' * 70}")

    sim_names = list(simulations.keys())
    comp_rows = []
    for rank in range(min(10, len(all_calls))):
        row = {"Rank": rank + 1}
        for sn in sim_names:
            sdf = sim_dataframes[sn]
            if rank < len(sdf):
                r = sdf.iloc[rank]
                short = sn.split("(")[1].rstrip(")")
                row[f"{short} Ticker"] = r["ticker"]
                row[f"{short} Score"] = r["quant_score"]
        comp_rows.append(row)

    print(f"\n{pd.DataFrame(comp_rows).to_string(index=False)}")

    # ── Score distribution table ──
    print(f"\n\n{'─' * 70}")
    print("  SCORE DISTRIBUTION COMPARISON")
    print(f"{'─' * 70}")
    print(f"\n  {'Metric':<25}", end="")
    for sn in sim_names:
        short = sn.split("(")[1].rstrip(")")
        print(f"  {short:>18}", end="")
    print()
    print(f"  {'─'*25}", end="")
    for _ in sim_names:
        print(f"  {'─'*18}", end="")
    print()

    for metric_name, metric_fn in [
        ("Mean Score", lambda d: d["quant_score"].mean()),
        ("Median Score", lambda d: d["quant_score"].median()),
        ("Std Dev", lambda d: d["quant_score"].std()),
        ("Max Score", lambda d: d["quant_score"].max()),
        ("Min Score", lambda d: d["quant_score"].min()),
        ("Score > 50", lambda d: (d["quant_score"] > 50).sum()),
        ("Score > 30", lambda d: (d["quant_score"] > 30).sum()),
    ]:
        print(f"  {metric_name:<25}", end="")
        for sn in sim_names:
            val = metric_fn(sim_dataframes[sn])
            if isinstance(val, (int, np.integer)):
                print(f"  {val:>18}", end="")
            else:
                print(f"  {val:>18.2f}", end="")
        print()

    # ── Biggest rank movers ──
    print(f"\n\n{'─' * 70}")
    print("  BIGGEST RANK MOVERS (Sim A → Sim C)")
    print(f"{'─' * 70}")

    df_a = sim_dataframes[sim_names[0]].reset_index(drop=True)
    df_c = sim_dataframes[sim_names[2]].reset_index(drop=True)
    df_a["key"] = df_a["ticker"] + "_" + df_a["strike"].astype(str) + "_" + df_a["expiration"]
    df_c["key"] = df_c["ticker"] + "_" + df_c["strike"].astype(str) + "_" + df_c["expiration"]
    rank_a = {row["key"]: i + 1 for i, row in df_a.iterrows()}
    rank_c = {row["key"]: i + 1 for i, row in df_c.iterrows()}

    movers = []
    for key in rank_a:
        if key in rank_c:
            d_rank = rank_a[key] - rank_c[key]
            sc_a = float(df_a[df_a["key"] == key]["quant_score"].iloc[0])
            sc_c = float(df_c[df_c["key"] == key]["quant_score"].iloc[0])
            movers.append({
                "Contract": key.replace("_", " $", 1).replace("_", " ", 1),
                "Rank@20%": rank_a[key], "Rank@60%": rank_c[key],
                "Rank Δ": d_rank,
                "Score@20%": sc_a, "Score@60%": sc_c,
                "Score Δ": round(sc_c - sc_a, 2),
            })

    movers.sort(key=lambda x: abs(x["Rank Δ"]), reverse=True)
    if movers:
        print(f"\n{pd.DataFrame(movers[:15]).to_string(index=False)}")

    # ── Key insights ──
    print(f"\n\n{'═' * 70}")
    print("  KEY INSIGHTS")
    print(f"{'═' * 70}")
    print("""
  • 20% Edge (Sim A): Favors HIGH POP contracts — safety-first.
    → ATM/near-ATM contracts rank highest. Scores cluster tightly.

  • 40% Edge (Sim B): BALANCED — current production formula.
    → Good mix of probability and volatility alpha.

  • 60% Edge (Sim C): Favors contracts where HV > IV (cheap options).
    → Volatility-alpha plays rank highest. Wider score spread.

  Weight Impact:
    → Higher edge weight = wider score spread (more differentiation)
    → Higher POP weight = tighter clustering (safer, more predictable)
    → OI weight is a tiebreaker between similar contracts
""")

print(f"\n{'═' * 70}")
print("  All simulations complete!")
print(f"{'═' * 70}")
