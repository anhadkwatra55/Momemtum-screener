"""
Alpha-Flow Weight Simulation — Quant Score Sensitivity Analysis
================================================================
Runs the alpha calls pipeline ONCE, then re-calculates quant scores
under 3 different weight regimes to show how shifting component
weights affects rankings and scores.

Simulations:
  Sim A (20%): POP-heavy   → w_pop=60%, w_edge=20%, w_oi=20%
  Sim B (40%): Balanced     → w_pop=40%, w_edge=40%, w_oi=20%  (current default)
  Sim C (60%): Edge-heavy   → w_pop=20%, w_edge=60%, w_oi=20%

The "weight" parameter (20/40/60) controls how much vol-edge
contributes vs POP in the composite quant score.
"""

import math
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import pandas as pd
import requests
from scipy.stats import norm

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Reuse: FlowProtocol + scan_one_ticker from alpha_calls_colab.py
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class FlowProtocol:
    @staticmethod
    def calculate_greeks(S, K, T, r, sigma):
        if T <= 0 or sigma <= 0:
            return 0, 0
        try:
            d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
            d2 = d1 - sigma * np.sqrt(T)
            delta = float(norm.cdf(d1))
            pop = float(norm.cdf(d2))
            if math.isnan(delta) or math.isinf(delta):
                delta = 0
            if math.isnan(pop) or math.isinf(pop):
                pop = 0
            return round(delta, 4), round(pop, 4)
        except Exception:
            return 0, 0

    @staticmethod
    def get_iv_hv_edge(ticker_obj, iv):
        try:
            hist = ticker_obj.history(period="30d")["Close"]
            if len(hist) < 20:
                return 0
            log_returns = np.log(hist / hist.shift(1)).dropna()
            hv = float(log_returns.std() * np.sqrt(252))
            if math.isnan(hv) or math.isinf(hv):
                return 0
            return round(hv - iv, 3)
        except Exception:
            return 0


import yfinance as yf

def scan_one_ticker(symbol, verbose=False):
    """Scan a single ticker — returns raw data (no quant score yet)."""
    results = []
    try:
        t = yf.Ticker(symbol.replace(".", "-"))
        price = t.fast_info["lastPrice"]
        if price < 25:
            return results
        expirations = t.options
        if not expirations:
            return results
        today = datetime.now()
        valid_expiries = [
            e for e in expirations
            if 90 <= (datetime.strptime(e, "%Y-%m-%d") - today).days <= 150
        ]
        if not valid_expiries:
            return results

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

                    if not (1.0 <= mid <= 8.0):
                        continue
                    if opt["strike"] < price:
                        continue
                    if not after_hours and spread_pct > 10:
                        continue
                    oi = int(opt.get("openInterest", 0) or 0)
                    if not after_hours and oi < 100:
                        continue
                    iv = float(opt.get("impliedVolatility", 0) or 0)

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

                    if delta < 0.35:
                        continue

                    be_pct = (((opt["strike"] + mid) / price) - 1) * 100

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
                        "moneyness": "ATM" if abs(opt["strike"] - price) / price < 0.03 else "OTM",
                    })
            except Exception:
                continue
    except Exception:
        pass
    return results


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Weight Simulation Engine
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def calc_quant_score(pop, edge, oi, w_pop, w_edge, w_oi):
    """
    Parameterized Quant Score.

    The original formula:
      score = (POP × 40) + (max(0, edge) × 400) + (min(10, OI/1000) × 2)

    Each component produces a raw sub-score:
      - POP component:  POP × 40        → range [0, 40]
      - Edge component: max(0,edge)×400  → range [0, ~40] (edge rarely > 0.10)
      - OI component:   min(10,OI/1000)×2 → range [0, 20]

    We normalize each to [0, 100], then apply weights:
      score = w_pop × (POP × 100) + w_edge × (max(0,edge) × 1000) + w_oi × (min(10,OI/1000) × 10)
    """
    # Normalize each sub-score to roughly [0, 100]
    pop_score = pop * 100                    # POP ∈ [0,1] → [0,100]
    edge_score = max(0, edge) * 1000         # edge ∈ [0,0.1] → [0,100]
    oi_score = min(10, oi / 1000) * 10       # OI capped → [0,100]

    return round(w_pop * pop_score + w_edge * edge_score + w_oi * oi_score, 2)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MAIN: Scan once, simulate 3 weight configs
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == "__main__":
    print("=" * 70)
    print("  ALPHA-FLOW WEIGHT SIMULATION — Quant Score Sensitivity")
    print("=" * 70)

    # ── 1. Fetch tickers ──
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=headers, timeout=15)
    sp500_tickers = pd.read_html(resp.text)[0]["Symbol"].tolist()

    SCAN_LIMIT = 50
    scan_tickers = sp500_tickers[:SCAN_LIMIT]

    # ── 2. Scan all tickers (single pass) ──
    print(f"\n  Scanning {SCAN_LIMIT} tickers (single pass, reused for all 3 simulations)...\n")
    all_calls = []
    scan_start = time.time()

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(scan_one_ticker, sym): sym for sym in scan_tickers}
        completed = 0
        for future in as_completed(futures):
            completed += 1
            sym = futures[future]
            try:
                results = future.result(timeout=30)
                all_calls.extend(results)
                if results:
                    print(f"  ✓ [{completed}/{SCAN_LIMIT}] {sym}: {len(results)} contracts")
                elif completed % 10 == 0:
                    print(f"  · [{completed}/{SCAN_LIMIT}] {sym}: 0 contracts")
            except Exception:
                pass

    scan_elapsed = round(time.time() - scan_start, 1)
    print(f"\n  Scan complete in {scan_elapsed}s — {len(all_calls)} contracts found\n")

    if not all_calls:
        print("  No contracts found. Market may be closed.")
        exit()

    # ── 3. Define the 3 simulation weight configs ──
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

        # Re-calculate quant scores with these weights
        scored = []
        for c in all_calls:
            qs = calc_quant_score(
                c["pop"], c["vol_edge"], c["open_interest"],
                cfg["w_pop"], cfg["w_edge"], cfg["w_oi"]
            )
            scored.append({**c, "quant_score": qs})

        scored.sort(key=lambda x: x["quant_score"], reverse=True)
        df = pd.DataFrame(scored)
        sim_dataframes[sim_name] = df

        # Show top 10
        display_cols = ["ticker", "strike", "expiration", "dte",
                        "mid_price", "delta", "pop", "vol_edge",
                        "open_interest", "quant_score", "moneyness"]
        print(f"\n  Top 10 contracts:")
        print(df[display_cols].head(10).to_string(index=False))

        # Stats
        print(f"\n  Summary:")
        print(f"    Avg Quant Score:  {df['quant_score'].mean():.2f}")
        print(f"    Median Score:     {df['quant_score'].median():.2f}")
        print(f"    Max Score:        {df['quant_score'].max():.2f}")
        print(f"    Min Score:        {df['quant_score'].min():.2f}")
        print(f"    Std Dev:          {df['quant_score'].std():.2f}")

        # Math breakdown for #1
        top = scored[0]
        pop_s = top["pop"] * 100
        edge_s = max(0, top["vol_edge"]) * 1000
        oi_s = min(10, top["open_interest"] / 1000) * 10
        print(f"\n  Math for #{1} ({top['ticker']} ${top['strike']} {top['expiration']}):")
        print(f"    POP component:  {cfg['w_pop']:.0%} × ({top['pop']} × 100) = {cfg['w_pop'] * pop_s:.2f}")
        print(f"    Edge component: {cfg['w_edge']:.0%} × (max(0,{top['vol_edge']}) × 1000) = {cfg['w_edge'] * edge_s:.2f}")
        print(f"    OI component:   {cfg['w_oi']:.0%} × (min(10,{top['open_interest']}/1000) × 10) = {cfg['w_oi'] * oi_s:.2f}")
        print(f"    TOTAL:          {top['quant_score']:.2f}")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    #  COMPARISON: How rankings change across simulations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    print(f"\n\n{'═' * 70}")
    print("  CROSS-SIMULATION COMPARISON")
    print(f"{'═' * 70}")

    # Build comparison table — top 10 from each sim side by side
    comp_rows = []
    sim_names = list(simulations.keys())
    for rank in range(min(10, len(all_calls))):
        row = {"Rank": rank + 1}
        for sn in sim_names:
            df = sim_dataframes[sn]
            if rank < len(df):
                r = df.iloc[rank]
                short_name = sn.split("(")[1].rstrip(")")
                row[f"{short_name} Ticker"] = r["ticker"]
                row[f"{short_name} Score"] = r["quant_score"]
        comp_rows.append(row)

    comp_df = pd.DataFrame(comp_rows)
    print(f"\n  Top 10 Rankings Side-by-Side:\n")
    print(comp_df.to_string(index=False))

    # Score distribution comparison
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
        ("Mean Score", lambda df: df["quant_score"].mean()),
        ("Median Score", lambda df: df["quant_score"].median()),
        ("Std Dev", lambda df: df["quant_score"].std()),
        ("Max Score", lambda df: df["quant_score"].max()),
        ("Min Score", lambda df: df["quant_score"].min()),
        ("Score > 50", lambda df: (df["quant_score"] > 50).sum()),
        ("Score > 30", lambda df: (df["quant_score"] > 30).sum()),
    ]:
        print(f"  {metric_name:<25}", end="")
        for sn in sim_names:
            val = metric_fn(sim_dataframes[sn])
            if isinstance(val, (int, np.integer)):
                print(f"  {val:>18}", end="")
            else:
                print(f"  {val:>18.2f}", end="")
        print()

    # Rank movers — contracts that move the most between sims
    print(f"\n\n{'─' * 70}")
    print("  BIGGEST RANK MOVERS (between Sim A and Sim C)")
    print(f"{'─' * 70}")

    df_a = sim_dataframes[sim_names[0]].reset_index(drop=True)
    df_c = sim_dataframes[sim_names[2]].reset_index(drop=True)

    # Create a key for matching
    df_a["key"] = df_a["ticker"] + "_" + df_a["strike"].astype(str) + "_" + df_a["expiration"]
    df_c["key"] = df_c["ticker"] + "_" + df_c["strike"].astype(str) + "_" + df_c["expiration"]

    rank_a = {row["key"]: i + 1 for i, row in df_a.iterrows()}
    rank_c = {row["key"]: i + 1 for i, row in df_c.iterrows()}

    movers = []
    for key in rank_a:
        if key in rank_c:
            delta_rank = rank_a[key] - rank_c[key]
            score_a = float(df_a[df_a["key"] == key]["quant_score"].iloc[0])
            score_c = float(df_c[df_c["key"] == key]["quant_score"].iloc[0])
            movers.append({
                "Contract": key.replace("_", " $", 1).replace("_", " ", 1),
                "Rank (20%)": rank_a[key],
                "Rank (60%)": rank_c[key],
                "Rank Δ": delta_rank,
                "Score (20%)": score_a,
                "Score (60%)": score_c,
                "Score Δ": round(score_c - score_a, 2),
            })

    movers.sort(key=lambda x: abs(x["Rank Δ"]), reverse=True)
    movers_df = pd.DataFrame(movers[:15])
    if not movers_df.empty:
        print(f"\n  Contracts with biggest rank changes when shifting from POP-heavy to Edge-heavy:\n")
        print(movers_df.to_string(index=False))

    # Key insight
    print(f"\n\n{'═' * 70}")
    print("  KEY INSIGHTS")
    print(f"{'═' * 70}")
    print(f"""
  • Sim A (20% Edge): Favors contracts with HIGH POP (probability of profit).
    Best for: Conservative strategies, income-focused traders.
    Tends to rank ATM/near-ATM contracts higher.

  • Sim B (40% Edge): BALANCED — current production formula.
    Best for: General-purpose scoring across all strategy types.

  • Sim C (60% Edge): Favors contracts where HV > IV (cheap options).
    Best for: Volatility-alpha strategies, mean-reversion plays.
    Tends to rank contracts with positive vol-edge much higher.

  Weight Impact:
    - Increasing edge weight SPREADS scores wider (higher std dev)
    - POP-heavy weights COMPRESS scores (lower std dev, more clustered)
    - OI weight acts as a tiebreaker between otherwise similar contracts
""")

    print(f"{'═' * 70}")
    print("  Simulation complete!")
    print(f"{'═' * 70}")
