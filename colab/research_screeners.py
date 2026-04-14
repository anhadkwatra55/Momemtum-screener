"""
research_screeners.py — Validate Options Screening Criteria
==============================================================
Research script (NOT production code). Run this to test what each
category's gates produce on real market data via yfinance.

Outputs a summary of how many contracts pass each gate layer,
so we can tune the criteria before building.

Usage:
    python research_screeners.py --category swing
    python research_screeners.py --category leaps
    python research_screeners.py --category cheap_calls
    python research_screeners.py --category all
    python research_screeners.py --category all --tickers AAPL,NVDA,TSLA,META,AMD
"""

from __future__ import annotations
import argparse
import math
import time
import sys
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import numpy as np

try:
    import yfinance as yf
except ImportError:
    print("ERROR: pip install yfinance")
    sys.exit(1)

try:
    import pandas as pd
except ImportError:
    print("ERROR: pip install pandas")
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════
#  SCREENING PROFILES
# ═══════════════════════════════════════════════════════════════

@dataclass
class ScreeningProfile:
    name: str
    # Underlying filters
    price_min: float
    avg_volume_min: int          # Average daily shares traded
    # Option contract filters
    dte_min: int
    dte_max: int
    premium_min: float
    premium_max: float
    premium_pct_max: float       # Premium as % of stock price (cap)
    delta_min: float
    delta_max: float
    oi_min: int
    spread_pct_max: float
    # Moneyness
    moneyness: str               # "ATM_OTM", "ITM_ONLY", "OTM_ONLY"
    moneyness_threshold: float   # e.g., 0.98 means strike >= 98% of price for ATM_OTM
    # Additional gates
    iv_rank_max: Optional[float] = None        # Max IV rank percentile (0-100)
    vol_oi_min: Optional[float] = None         # Min Vol/OI ratio
    volume_min: Optional[int] = None           # Min option volume today
    extrinsic_pct_max: Optional[float] = None  # Max extrinsic value as % of premium


PROFILES = {
    "swing": ScreeningProfile(
        name="Swing Trades (21-90d)",
        price_min=20.0,
        avg_volume_min=500_000,
        dte_min=21,
        dte_max=90,
        premium_min=0.50,
        premium_max=8.00,
        premium_pct_max=6.0,
        delta_min=0.35,
        delta_max=0.60,
        oi_min=200,
        spread_pct_max=8.0,
        moneyness="ATM_OTM",
        moneyness_threshold=0.98,  # strike >= 98% of price
        iv_rank_max=60.0,
    ),
    "leaps": ScreeningProfile(
        name="LEAPS (180-730d)",
        price_min=30.0,
        avg_volume_min=300_000,
        dte_min=180,
        dte_max=730,
        premium_min=3.00,
        premium_max=999.00,       # No hard dollar cap — rely on premium_pct_max
        premium_pct_max=40.0,
        delta_min=0.70,
        delta_max=0.90,
        oi_min=50,
        spread_pct_max=12.0,
        moneyness="ITM_ONLY",
        moneyness_threshold=1.00,  # strike <= 100% of price
        extrinsic_pct_max=30.0,
    ),
    "cheap_calls": ScreeningProfile(
        name="Cheap Calls (7-60d)",
        price_min=15.0,
        avg_volume_min=1_000_000,
        dte_min=7,
        dte_max=60,
        premium_min=0.05,
        premium_max=2.00,
        premium_pct_max=5.0,
        delta_min=0.05,
        delta_max=0.30,
        oi_min=300,
        spread_pct_max=40.0,
        moneyness="OTM_ONLY",
        moneyness_threshold=1.03,  # strike >= 103% of price
        vol_oi_min=1.5,
        volume_min=100,
    ),
}


# ═══════════════════════════════════════════════════════════════
#  IV RANK COMPUTATION (self-built, no external API)
# ═══════════════════════════════════════════════════════════════

def compute_iv_rank(ticker_obj, current_iv: float) -> float:
    """
    IV Rank = (Current IV - 52w Low HV) / (52w High HV - 52w Low HV) × 100
    Uses HV as proxy for IV (correlation ~0.85).
    """
    try:
        hist = ticker_obj.history(period="1y")["Close"]
        if len(hist) < 60:
            return 50.0  # Not enough data, assume neutral

        log_returns = np.log(hist / hist.shift(1)).dropna()
        rolling_hv = log_returns.rolling(20).std() * np.sqrt(252)
        rolling_hv = rolling_hv.dropna()

        if len(rolling_hv) < 20:
            return 50.0

        hv_min = float(rolling_hv.min())
        hv_max = float(rolling_hv.max())

        if hv_max <= hv_min or hv_max == 0:
            return 50.0

        iv_rank = (current_iv - hv_min) / (hv_max - hv_min) * 100
        return max(0.0, min(100.0, round(iv_rank, 1)))
    except Exception:
        return 50.0


# ═══════════════════════════════════════════════════════════════
#  DELTA APPROXIMATION (Black-Scholes lite)
# ═══════════════════════════════════════════════════════════════

def approx_delta(S: float, K: float, T: float, iv: float) -> float:
    """Quick delta approximation. Falls back to moneyness ratio if scipy unavailable."""
    if T <= 0 or iv <= 0:
        return 0.0
    try:
        from scipy.stats import norm
        d1 = (np.log(S / K) + (0.04 + 0.5 * iv**2) * T) / (iv * np.sqrt(T))
        return round(float(norm.cdf(d1)), 3)
    except ImportError:
        # Fallback: linear approximation
        ratio = S / K
        return round(max(0.0, min(1.0, 0.5 + (ratio - 1.0) * 2.5)), 3)


# ═══════════════════════════════════════════════════════════════
#  GATE TRACKING — Track how many contracts fail each gate
# ═══════════════════════════════════════════════════════════════

@dataclass
class GateStats:
    """Track pass/fail counts for each gate to identify bottlenecks."""
    total_contracts: int = 0
    # Per-gate fail counts
    gate_fails: dict = field(default_factory=lambda: {
        "dte": 0,
        "premium_range": 0,
        "premium_pct": 0,
        "delta_range": 0,
        "moneyness": 0,
        "oi": 0,
        "spread": 0,
        "iv_rank": 0,
        "vol_oi": 0,
        "volume": 0,
        "extrinsic_pct": 0,
        "no_price": 0,
    })
    passed: int = 0

    def report(self) -> str:
        lines = [f"  Total contracts evaluated: {self.total_contracts}"]
        lines.append(f"  ✓ PASSED all gates: {self.passed}")
        lines.append(f"  Gate failure breakdown:")
        for gate, count in sorted(self.gate_fails.items(), key=lambda x: -x[1]):
            if count > 0:
                pct = count / max(1, self.total_contracts) * 100
                lines.append(f"    ✗ {gate:20s}: {count:5d} failed ({pct:.1f}%)")
        return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════
#  MAIN SCANNER
# ═══════════════════════════════════════════════════════════════

def scan_ticker(symbol: str, profile: ScreeningProfile, verbose: bool = False) -> tuple[list[dict], GateStats]:
    """
    Scan a single ticker against a screening profile.
    Returns (qualifying_contracts, gate_stats).
    """
    stats = GateStats()
    results = []

    try:
        t = yf.Ticker(symbol.replace(".", "-"))

        # ── Underlying gates ──
        try:
            price = t.fast_info["lastPrice"]
        except Exception:
            try:
                info = t.info or {}
                price = info.get("regularMarketPrice") or info.get("currentPrice") or info.get("previousClose", 0)
            except Exception:
                price = 0

        if not price or price < profile.price_min:
            if verbose:
                print(f"  {symbol}: SKIP — price ${price:.2f} < ${profile.price_min}")
            return [], stats

        # Check average volume
        try:
            hist = t.history(period="30d")
            if hist.empty or len(hist) < 10:
                if verbose:
                    print(f"  {symbol}: SKIP — insufficient price history")
                return [], stats
            avg_vol = int(hist["Volume"].mean())
        except Exception:
            avg_vol = 0

        if avg_vol < profile.avg_volume_min:
            if verbose:
                print(f"  {symbol}: SKIP — avg volume {avg_vol:,} < {profile.avg_volume_min:,}")
            return [], stats

        # ── Get option expirations ──
        try:
            expirations = t.options
        except Exception:
            return [], stats

        if not expirations:
            return [], stats

        today = datetime.now()

        # ── Filter expirations by DTE range ──
        valid_expiries = []
        for e in expirations:
            dte = (datetime.strptime(e, "%Y-%m-%d") - today).days
            if profile.dte_min <= dte <= profile.dte_max:
                valid_expiries.append((e, dte))

        if not valid_expiries:
            if verbose:
                print(f"  {symbol}: SKIP — no expirations in DTE {profile.dte_min}-{profile.dte_max}")
            return [], stats

        # ── Pre-compute IV Rank (once per ticker) ──
        _iv_rank_cache: float | None = None
        _hv_cache: float | None = None

        def _get_hv() -> float:
            nonlocal _hv_cache
            if _hv_cache is None:
                try:
                    closes = hist["Close"]
                    if len(closes) >= 20:
                        _hv_cache = float(np.log(closes / closes.shift(1)).dropna().std() * np.sqrt(252))
                    else:
                        _hv_cache = 0.0
                except Exception:
                    _hv_cache = 0.0
                if math.isnan(_hv_cache) or math.isinf(_hv_cache):
                    _hv_cache = 0.0
            return _hv_cache

        # ── Scan each valid expiration ──
        for exp_str, dte_days in valid_expiries:
            try:
                chain = t.option_chain(exp_str).calls
                if chain is None or chain.empty:
                    continue
            except Exception:
                continue

            dte_years = dte_days / 365.0
            chain = chain.copy()

            # Ensure numeric columns
            for col in ["bid", "ask", "lastPrice", "openInterest", "impliedVolatility", "volume", "strike"]:
                if col in chain.columns:
                    chain[col] = pd.to_numeric(chain[col], errors="coerce").fillna(0)

            for _, opt in chain.iterrows():
                stats.total_contracts += 1

                bid = float(opt.get("bid", 0) or 0)
                ask = float(opt.get("ask", 0) or 0)
                strike = float(opt.get("strike", 0))
                oi = int(opt.get("openInterest", 0) or 0)
                volume = int(opt.get("volume", 0) or 0)
                iv = float(opt.get("impliedVolatility", 0) or 0)

                # Mid price
                if bid > 0 and ask > 0:
                    mid = (bid + ask) / 2
                    spread_pct = ((ask - bid) / mid) * 100
                    after_hours = False
                else:
                    mid = float(opt.get("lastPrice", 0) or 0)
                    spread_pct = 0
                    after_hours = True

                # ── Gate: must have some price ──
                if mid <= 0:
                    stats.gate_fails["no_price"] += 1
                    continue

                # ── Gate: DTE (already filtered by expiration, but double-check) ──
                # (passed by construction)

                # ── Gate: Premium range ──
                if mid < profile.premium_min or mid > profile.premium_max:
                    stats.gate_fails["premium_range"] += 1
                    continue

                # ── Gate: Premium as % of stock price ──
                premium_pct = (mid / price) * 100
                if premium_pct > profile.premium_pct_max:
                    stats.gate_fails["premium_pct"] += 1
                    continue

                # ── Gate: Moneyness ──
                if profile.moneyness == "ATM_OTM":
                    # strike >= threshold% of price
                    if strike < price * profile.moneyness_threshold:
                        stats.gate_fails["moneyness"] += 1
                        continue
                elif profile.moneyness == "ITM_ONLY":
                    # strike <= price (in the money)
                    if strike > price * profile.moneyness_threshold:
                        stats.gate_fails["moneyness"] += 1
                        continue
                elif profile.moneyness == "OTM_ONLY":
                    # strike >= threshold% of price (out of the money)
                    if strike < price * profile.moneyness_threshold:
                        stats.gate_fails["moneyness"] += 1
                        continue

                # ── Gate: OI ──
                if not after_hours and oi < profile.oi_min:
                    stats.gate_fails["oi"] += 1
                    continue

                # ── Gate: Spread ──
                if not after_hours and spread_pct > profile.spread_pct_max:
                    stats.gate_fails["spread"] += 1
                    continue

                # ── Gate: Delta ──
                if iv > 0.05:
                    delta = approx_delta(price, strike, dte_years, iv)
                else:
                    ratio = price / strike
                    delta = round(max(0.0, min(1.0, 0.5 + (ratio - 1.0) * 2.5)), 3)

                if delta < profile.delta_min or delta > profile.delta_max:
                    stats.gate_fails["delta_range"] += 1
                    continue

                # ── Gate: IV Rank (swing only) ──
                if profile.iv_rank_max is not None:
                    if _iv_rank_cache is None:
                        _iv_rank_cache = compute_iv_rank(t, iv)
                    if _iv_rank_cache > profile.iv_rank_max:
                        stats.gate_fails["iv_rank"] += 1
                        continue

                # ── Gate: Vol/OI (cheap calls) ──
                if profile.vol_oi_min is not None:
                    if oi > 0:
                        vol_oi = volume / oi
                    else:
                        vol_oi = 0
                    if vol_oi < profile.vol_oi_min:
                        stats.gate_fails["vol_oi"] += 1
                        continue

                # ── Gate: Option volume (cheap calls) ──
                if profile.volume_min is not None:
                    if volume < profile.volume_min:
                        stats.gate_fails["volume"] += 1
                        continue

                # ── Gate: Extrinsic % (LEAPS) ──
                extrinsic_pct = 0.0
                if profile.extrinsic_pct_max is not None:
                    intrinsic = max(0, price - strike)  # For calls
                    extrinsic = mid - intrinsic
                    extrinsic_pct = (extrinsic / mid * 100) if mid > 0 else 100
                    if extrinsic_pct > profile.extrinsic_pct_max:
                        stats.gate_fails["extrinsic_pct"] += 1
                        continue

                # ═══ PASSED ALL GATES ═══
                stats.passed += 1

                hv = _get_hv()
                vol_edge = round(hv - iv, 3) if hv > 0 else 0

                be_pct = ((strike + mid) / price - 1) * 100

                results.append({
                    "ticker": symbol,
                    "stock_price": round(price, 2),
                    "avg_daily_volume": avg_vol,
                    "strike": strike,
                    "expiration": exp_str,
                    "dte": dte_days,
                    "bid": round(bid, 2),
                    "ask": round(ask, 2),
                    "mid": round(mid, 2),
                    "premium_pct": round(premium_pct, 2),
                    "delta": delta,
                    "iv": round(iv * 100, 1),
                    "iv_rank": round(_iv_rank_cache, 1) if _iv_rank_cache is not None else None,
                    "vol_edge": vol_edge,
                    "oi": oi,
                    "volume": volume,
                    "vol_oi": round(volume / oi, 2) if oi > 0 else 0,
                    "spread_pct": round(spread_pct, 1),
                    "breakeven_pct": round(be_pct, 2),
                    "extrinsic_pct": round(extrinsic_pct, 1) if extrinsic_pct else None,
                    "moneyness": "ITM" if strike < price else ("ATM" if abs(strike - price) / price < 0.03 else "OTM"),
                })

    except Exception as e:
        if verbose:
            print(f"  {symbol}: ERROR — {e}")

    return results, stats


# ═══════════════════════════════════════════════════════════════
#  TEST UNIVERSE
# ═══════════════════════════════════════════════════════════════

DEFAULT_TICKERS = [
    # Mega-cap tech (high volume, liquid chains)
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO",
    # Mid-cap / high-momentum
    "AMD", "CRM", "NFLX", "ADBE", "ORCL", "QCOM",
    # Financials
    "JPM", "GS", "V", "MA",
    # Healthcare
    "UNH", "LLY", "JNJ", "ABBV",
    # Consumer / Industrials
    "HD", "MCD", "NKE", "CAT", "BA",
    # Energy
    "XOM", "CVX",
    # ETFs
    "SPY", "QQQ", "IWM",
]


# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════

def run_research(category: str, tickers: list[str], verbose: bool = False):
    profile = PROFILES[category]

    print("=" * 72)
    print(f"  RESEARCH: {profile.name}")
    print(f"  Tickers: {len(tickers)} | Gates: price≥${profile.price_min}, vol≥{profile.avg_volume_min:,}")
    print(f"  DTE: {profile.dte_min}–{profile.dte_max}d | Delta: {profile.delta_min}–{profile.delta_max}")
    print(f"  Premium: ${profile.premium_min}–${profile.premium_max} (≤{profile.premium_pct_max}% of stock)")
    print(f"  Moneyness: {profile.moneyness} | OI≥{profile.oi_min} | Spread≤{profile.spread_pct_max}%")
    if profile.iv_rank_max:
        print(f"  IV Rank: ≤{profile.iv_rank_max}th percentile")
    if profile.vol_oi_min:
        print(f"  Vol/OI: ≥{profile.vol_oi_min} | Volume: ≥{profile.volume_min}")
    if profile.extrinsic_pct_max:
        print(f"  Extrinsic Value: ≤{profile.extrinsic_pct_max}% of premium")
    print("=" * 72)

    all_results = []
    total_stats = GateStats()

    for i, ticker in enumerate(tickers):
        print(f"\n[{i+1}/{len(tickers)}] Scanning {ticker}...", end=" ", flush=True)
        t0 = time.time()

        results, stats = scan_ticker(ticker, profile, verbose=verbose)

        elapsed = time.time() - t0
        print(f"{len(results)} contracts passed ({stats.total_contracts} evaluated) [{elapsed:.1f}s]")

        all_results.extend(results)

        # Merge stats
        total_stats.total_contracts += stats.total_contracts
        total_stats.passed += stats.passed
        for k, v in stats.gate_fails.items():
            total_stats.gate_fails[k] += v

        # Anti-ban delay
        time.sleep(0.3)

    # ── RESULTS ──
    print("\n" + "=" * 72)
    print(f"  RESULTS: {profile.name}")
    print("=" * 72)
    print(f"\n{total_stats.report()}")

    if all_results:
        # Sort by appropriate metric
        if category == "cheap_calls":
            all_results.sort(key=lambda x: x.get("vol_oi", 0), reverse=True)
        elif category == "leaps":
            all_results.sort(key=lambda x: x.get("delta", 0), reverse=True)
        else:
            all_results.sort(key=lambda x: x.get("vol_edge", 0), reverse=True)

        print(f"\n  Top 15 Contracts:\n")

        if category == "swing":
            print(f"  {'Ticker':<7} {'Strike':>8} {'Exp':>12} {'DTE':>5} {'Mid':>7} {'Δ':>6} {'IV%':>6} {'IVR':>5} {'Edge':>7} {'OI':>7} {'Spread':>7} {'B/E%':>6}")
            print(f"  {'─'*7} {'─'*8} {'─'*12} {'─'*5} {'─'*7} {'─'*6} {'─'*6} {'─'*5} {'─'*7} {'─'*7} {'─'*7} {'─'*6}")
            for r in all_results[:15]:
                print(f"  {r['ticker']:<7} ${r['strike']:>6.0f} {r['expiration']:>12} {r['dte']:>4}d ${r['mid']:>5.2f} {r['delta']:>5.2f} {r['iv']:>5.1f} {r.get('iv_rank', '—'):>5} {r['vol_edge']:>+6.3f} {r['oi']:>6,} {r['spread_pct']:>5.1f}% {r['breakeven_pct']:>+5.1f}%")

        elif category == "leaps":
            print(f"  {'Ticker':<7} {'Strike':>8} {'Exp':>12} {'DTE':>5} {'Mid':>8} {'Δ':>6} {'Ext%':>6} {'Edge':>7} {'OI':>6} {'B/E%':>6} {'Prem%':>6}")
            print(f"  {'─'*7} {'─'*8} {'─'*12} {'─'*5} {'─'*8} {'─'*6} {'─'*6} {'─'*7} {'─'*6} {'─'*6} {'─'*6}")
            for r in all_results[:15]:
                ext = r.get('extrinsic_pct', '—')
                ext_str = f"{ext:>5.1f}" if isinstance(ext, (int, float)) else f"{'—':>5}"
                print(f"  {r['ticker']:<7} ${r['strike']:>6.0f} {r['expiration']:>12} {r['dte']:>4}d ${r['mid']:>6.2f} {r['delta']:>5.2f} {ext_str}% {r['vol_edge']:>+6.3f} {r['oi']:>5,} {r['breakeven_pct']:>+5.1f}% {r['premium_pct']:>4.1f}%")

        elif category == "cheap_calls":
            print(f"  {'Ticker':<7} {'Strike':>8} {'Exp':>12} {'DTE':>5} {'Mid':>6} {'Δ':>6} {'V/OI':>6} {'Vol':>7} {'OI':>7} {'IV%':>6} {'Edge':>7}")
            print(f"  {'─'*7} {'─'*8} {'─'*12} {'─'*5} {'─'*6} {'─'*6} {'─'*6} {'─'*7} {'─'*7} {'─'*6} {'─'*7}")
            for r in all_results[:15]:
                print(f"  {r['ticker']:<7} ${r['strike']:>6.0f} {r['expiration']:>12} {r['dte']:>4}d ${r['mid']:>4.2f} {r['delta']:>5.2f} {r['vol_oi']:>5.1f} {r['volume']:>6,} {r['oi']:>6,} {r['iv']:>5.1f} {r['vol_edge']:>+6.3f}")

        # Summary stats
        tickers_with_results = len(set(r["ticker"] for r in all_results))
        print(f"\n  Summary: {len(all_results)} contracts from {tickers_with_results}/{len(tickers)} tickers")

        if category == "swing":
            deltas = [r["delta"] for r in all_results]
            edges = [r["vol_edge"] for r in all_results]
            print(f"  Delta range: {min(deltas):.2f} – {max(deltas):.2f} (mean {np.mean(deltas):.2f})")
            print(f"  Vol edge range: {min(edges):+.3f} – {max(edges):+.3f} (mean {np.mean(edges):+.3f})")
            ivrs = [r["iv_rank"] for r in all_results if r.get("iv_rank") is not None]
            if ivrs:
                print(f"  IV Rank range: {min(ivrs):.0f} – {max(ivrs):.0f} (mean {np.mean(ivrs):.0f})")

        elif category == "leaps":
            exts = [r["extrinsic_pct"] for r in all_results if r.get("extrinsic_pct") is not None]
            if exts:
                print(f"  Extrinsic % range: {min(exts):.1f}% – {max(exts):.1f}% (mean {np.mean(exts):.1f}%)")
            prems = [r["premium_pct"] for r in all_results]
            print(f"  Premium/Stock % range: {min(prems):.1f}% – {max(prems):.1f}% (mean {np.mean(prems):.1f}%)")

        elif category == "cheap_calls":
            vois = [r["vol_oi"] for r in all_results]
            print(f"  Vol/OI range: {min(vois):.1f} – {max(vois):.1f} (mean {np.mean(vois):.1f})")
            vols = [r["volume"] for r in all_results]
            print(f"  Volume range: {min(vols):,} – {max(vols):,} (mean {int(np.mean(vols)):,})")
    else:
        print("\n  ⚠ NO CONTRACTS PASSED ALL GATES")
        print("  Review gate failure breakdown above to loosen criteria.")

    return all_results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Research Options Screener Categories")
    parser.add_argument("--category", choices=["swing", "leaps", "cheap_calls", "all"], default="all")
    parser.add_argument("--tickers", type=str, default=None, help="Comma-separated tickers (e.g., AAPL,NVDA,TSLA)")
    parser.add_argument("--verbose", action="store_true", help="Show per-ticker skip reasons")
    args = parser.parse_args()

    tickers = args.tickers.split(",") if args.tickers else DEFAULT_TICKERS

    categories = ["swing", "leaps", "cheap_calls"] if args.category == "all" else [args.category]

    for cat in categories:
        run_research(cat, tickers, verbose=args.verbose)
        print("\n")
