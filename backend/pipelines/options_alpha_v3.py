"""
options_alpha_v3.py — Alpha-Flow Options Intelligence Pipeline (v3 — Multi-Category)
======================================================================================
REPLACES options_alpha.py — Drop-in replacement with same public API.

New in v3:
  1. Three screening categories: SWING (21-90d), LEAPS (180-730d), CHEAP_CALLS (7-60d)
  2. ScreeningProfile dataclass — gates are config-driven, not hardcoded
  3. Per-category quant scoring (0-100) with distinct formulas
  4. IV Rank self-computation (HV proxy, no external API)
  5. Multi-dimensional liquidity gates (price + volume + OI + spread)
  6. Cross-reference bonuses from momentum pipeline signals
  7. Sequential category scanning with gc.collect() for Railway memory safety

INTEGRATION STEPS FOR DEVELOPER:
  1. Rename this file to options_alpha.py (backup the old one)
  2. Run db.init_db() to apply schema migration (adds new columns)
  3. Update main.py endpoint to pass `category` param
  4. Update frontend to pass ?category= query param

The old get_alpha_calls() and run_alpha_pipeline() signatures are preserved
for backward compatibility. New `categories` param is additive.
"""

from __future__ import annotations

import gc
import logging
import math
import random
import time as _time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import numpy as np

logger = logging.getLogger("options_alpha")

try:
    import yfinance as yf
    HAS_YF = True
except ImportError:
    HAS_YF = False

try:
    from scipy.stats import norm
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

try:
    import pandas as pd
    HAS_PD = True
except ImportError:
    HAS_PD = False

try:
    import requests as _requests
    HAS_REQ = True
except ImportError:
    HAS_REQ = False


# ═══════════════════════════════════════════════════════════════
# 0. CORE QUANT PROTOCOL (THE MATH) — Unchanged from v2
# ═══════════════════════════════════════════════════════════════

class FlowProtocol:
    @staticmethod
    def calculate_greeks(S, K, T, r, sigma):
        """Calculates Delta and Probability of Profit (POP)"""
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
            return round(delta, 2), round(pop, 2)
        except Exception:
            return 0, 0


# ═══════════════════════════════════════════════════════════════
# 1. SCREENING PROFILES — Config-driven gates per category
# ═══════════════════════════════════════════════════════════════

@dataclass
class ScreeningProfile:
    """All gate thresholds for a screening category."""
    name: str
    category: str                # "swing", "leaps", "cheap_calls"
    # Underlying filters
    price_min: float
    avg_volume_min: int
    # Option contract filters
    dte_min: int
    dte_max: int
    premium_min: float
    premium_max: float
    premium_pct_max: float       # Premium as % of stock price
    delta_min: float
    delta_max: float
    oi_min: int
    spread_pct_max: float
    # Moneyness
    moneyness: str               # "ATM_OTM", "ITM_ONLY", "OTM_ONLY"
    moneyness_threshold: float   # Strike ratio vs stock price
    # Additional gates (None = not applied)
    iv_rank_max: Optional[float] = None
    vol_oi_min: Optional[float] = None
    volume_min: Optional[int] = None
    extrinsic_pct_max: Optional[float] = None


PROFILES = {
    "swing": ScreeningProfile(
        name="Swing Trades (21-90d)",
        category="swing",
        price_min=20.0,
        avg_volume_min=500_000,
        dte_min=21, dte_max=90,
        premium_min=0.50, premium_max=8.00,
        premium_pct_max=6.0,
        delta_min=0.35, delta_max=0.60,
        oi_min=200, spread_pct_max=8.0,
        moneyness="ATM_OTM",
        moneyness_threshold=0.98,
        iv_rank_max=60.0,
    ),
    "leaps": ScreeningProfile(
        name="LEAPS (180-730d)",
        category="leaps",
        price_min=30.0,
        avg_volume_min=300_000,
        dte_min=180, dte_max=730,
        premium_min=3.00, premium_max=999.0,  # No hard $ cap — use premium_pct_max
        premium_pct_max=40.0,
        delta_min=0.70, delta_max=0.90,
        oi_min=50, spread_pct_max=12.0,
        moneyness="ITM_ONLY",
        moneyness_threshold=1.00,
        extrinsic_pct_max=30.0,
    ),
    "cheap_calls": ScreeningProfile(
        name="Cheap Calls (7-60d)",
        category="cheap_calls",
        price_min=15.0,
        avg_volume_min=1_000_000,
        dte_min=7, dte_max=60,
        premium_min=0.05, premium_max=2.00,
        premium_pct_max=5.0,
        delta_min=0.05, delta_max=0.30,
        oi_min=300, spread_pct_max=40.0,
        moneyness="OTM_ONLY",
        moneyness_threshold=1.03,
        vol_oi_min=1.5,
        volume_min=100,
    ),
}


# ═══════════════════════════════════════════════════════════════
# 2. IV RANK — Self-computed from HV proxy (no external API)
# ═══════════════════════════════════════════════════════════════

def compute_iv_rank(hist_closes: "pd.Series", current_iv: float) -> float:
    """
    IV Rank = (Current IV - 52w Low HV) / (52w High HV - 52w Low HV) × 100
    Uses 20-day rolling HV as proxy for IV. Correlation ~0.85.

    Args:
        hist_closes: 1-year daily close prices
        current_iv: current implied volatility of the option

    Returns:
        IV Rank (0-100), or 50.0 if insufficient data
    """
    try:
        if len(hist_closes) < 60:
            return 50.0

        log_returns = np.log(hist_closes / hist_closes.shift(1)).dropna()
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
# 3. QUANT SCORING — Three distinct formulas (0-100)
# ═══════════════════════════════════════════════════════════════

def _swing_score(
    pop: float,
    vol_edge: float,
    delta: float,
    oi: int,
    iv_rank: float,
    spread_pct: float,
    momentum_bonus: float = 0,
) -> float:
    """
    Swing trade quant score (0-100).
    Prioritizes: vol edge > POP > momentum confirmation > liquidity.
    """
    base = 0.0

    # POP — probability of profit (0-25 pts)
    base += pop * 25

    # Vol Edge — HV > IV means options are cheap (0-40 pts)
    base += max(0, vol_edge) * 100 * 4

    # Delta sweet spot bonus (0-10 pts)
    if 0.40 <= delta <= 0.55:
        base += 10
    else:
        base += 5

    # Liquidity — OI depth (0-15 pts)
    base += min(10, oi / 500) * 1.5

    # Momentum cross-reference (0-10 pts, passed in from pipeline)
    base += momentum_bonus

    # ── Penalties ──
    if iv_rank > 50:
        base -= (iv_rank - 50) * 0.2  # -0 to -10 pts

    if spread_pct > 5:
        base -= (spread_pct - 5) * 1.0  # -0 to -3 pts

    return round(max(0, min(100, base)), 2)


def _leaps_score(
    delta: float,
    vol_edge: float,
    extrinsic_pct: float,
    fundamental_quality: float,
    iv_rank: float,
    regime_bonus: float = 0,
) -> float:
    """
    LEAPS quant score (0-100).
    Prioritizes: delta quality > low extrinsic > fundamental grade > regime.
    """
    base = 0.0

    # Delta quality — higher = more stock-like (0-27 pts)
    base += delta * 30

    # Low extrinsic value = better value (0-25 pts)
    base += (1.0 - extrinsic_pct / 100) * 25

    # Fundamental quality score 0.0-1.0 (0-20 pts)
    base += fundamental_quality * 20

    # Vol edge (0-20 pts)
    base += max(0, vol_edge) * 100 * 2

    # Regime bonus — trending is best for LEAPS (0-8 pts)
    base += regime_bonus

    # ── Penalties ──
    if iv_rank > 70:
        base -= (iv_rank - 70) * 0.3  # Severe IV penalty for LEAPS

    if extrinsic_pct > 25:
        base -= (extrinsic_pct - 25) * 0.5

    return round(max(0, min(100, base)), 2)


def _cheap_score(
    vol_oi_ratio: float,
    vol_edge: float,
    volume: int,
    delta: float,
    catalyst_bonus: float = 0,
    spread_pct: float = 0,
    oi: int = 0,
) -> float:
    """
    Cheap calls quant score (0-100).
    Prioritizes: unusual activity (Vol/OI) > vol edge > raw volume > catalyst.
    """
    base = 0.0

    # Vol/OI ratio — THE signal (0-30 pts)
    base += min(vol_oi_ratio, 5.0) / 5.0 * 30

    # Vol edge — cheap IV is good (0-50 pts)
    base += max(0, vol_edge) * 100 * 5

    # Raw volume — more activity = more conviction (0-10 pts)
    base += min(volume, 5000) / 5000 * 10

    # Catalyst bonus from pipeline (0-10 pts)
    base += catalyst_bonus

    # ── Penalties ──
    if spread_pct > 30:
        base -= (spread_pct - 30) * 0.5

    if oi < 200:
        base -= 5

    return round(max(0, min(100, base)), 2)


def _get_risk_tag(delta: float) -> str:
    """Risk classification for cheap calls."""
    if delta < 0.08:
        return "LOTTO"
    elif delta < 0.15:
        return "HIGH_RISK"
    elif delta < 0.25:
        return "SPECULATIVE"
    else:
        return "MODERATE_SPEC"


# ═══════════════════════════════════════════════════════════════
# 4. TICKER UNIVERSE FETCH — Unchanged from v2 (24h cache)
# ═══════════════════════════════════════════════════════════════

_TICKER_CACHE: dict[str, tuple[list[str], float]] = {}
_TICKER_CACHE_TTL = 86400

_SP500_FALLBACK = [
    "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "META", "TSLA", "BRK-B",
    "UNH", "JNJ", "V", "XOM", "JPM", "PG", "MA", "HD", "CVX", "MRK",
    "ABBV", "LLY", "PEP", "KO", "COST", "AVGO", "WMT", "MCD", "CSCO",
    "TMO", "ACN", "ABT", "DHR", "NEE", "LIN", "CRM", "AMD", "TXN",
    "PM", "UNP", "QCOM", "HON", "MS", "GS", "BA", "CAT", "RTX",
    "INTC", "AMGN", "IBM", "GE",
]


def get_sp500() -> list[str]:
    """Fetch S&P 500 tickers from Wikipedia with 24h cache."""
    if not HAS_PD or not HAS_REQ:
        return _SP500_FALLBACK

    cached = _TICKER_CACHE.get("sp500")
    if cached and (_time.monotonic() - cached[1]) < _TICKER_CACHE_TTL:
        return cached[0]

    for attempt in range(3):
        try:
            url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
            headers = {"User-Agent": "Mozilla/5.0"}
            resp = _requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()
            tickers = pd.read_html(resp.text)[0]["Symbol"].tolist()
            _TICKER_CACHE["sp500"] = (tickers, _time.monotonic())
            logger.info(f"Fetched {len(tickers)} S&P 500 tickers")
            return tickers
        except Exception as e:
            logger.warning(f"S&P 500 fetch attempt {attempt + 1}/3 failed: {e}")
            if attempt < 2:
                _time.sleep(2 ** attempt)

    return _SP500_FALLBACK


def get_nasdaq100() -> list[str]:
    """Fetch NASDAQ 100 tickers from Wikipedia with 24h cache."""
    if not HAS_PD or not HAS_REQ:
        return []

    cached = _TICKER_CACHE.get("nasdaq100")
    if cached and (_time.monotonic() - cached[1]) < _TICKER_CACHE_TTL:
        return cached[0]

    for attempt in range(3):
        try:
            url = "https://en.wikipedia.org/wiki/Nasdaq-100"
            headers = {"User-Agent": "Mozilla/5.0"}
            resp = _requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()
            tables = pd.read_html(resp.text)
            for t in tables:
                for col in ['Ticker', 'Symbol', 'ticker', 'symbol']:
                    if col in t.columns:
                        tickers = t[col].tolist()
                        _TICKER_CACHE["nasdaq100"] = (tickers, _time.monotonic())
                        return tickers
            return []
        except Exception as e:
            logger.warning(f"NASDAQ 100 fetch attempt {attempt + 1}/3 failed: {e}")
            if attempt < 2:
                _time.sleep(2 ** attempt)
    return []


# ═══════════════════════════════════════════════════════════════
# 5. yfinance RETRY HELPER — Unchanged from v2
# ═══════════════════════════════════════════════════════════════

def _yf_retry(fn, retries=2, base_delay=1.0):
    """Retry a yfinance call with exponential backoff."""
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as e:
            if attempt == retries:
                raise
            delay = base_delay * (2 ** attempt) + random.uniform(0, 0.5)
            logger.debug(f"yfinance retry {attempt + 1}/{retries}: {e}")
            _time.sleep(delay)


# ═══════════════════════════════════════════════════════════════
# 6. SINGLE-TICKER SCAN — Profile-driven gates
# ═══════════════════════════════════════════════════════════════

def _load_momentum_signals() -> dict:
    """
    Load momentum pipeline signals for cross-reference bonuses.
    Returns {ticker: signal_dict} or empty dict if unavailable.
    """
    try:
        import json
        from pathlib import Path
        p = Path(__file__).parent / "momentum_data.json"
        if p.exists():
            with open(p) as f:
                data = json.load(f)
            return {s["ticker"]: s for s in data.get("signals", [])}
    except Exception:
        pass
    return {}


# Module-level momentum cache (refreshed per pipeline run)
_MOMENTUM_SIGNALS: dict = {}


def _get_momentum_bonus(ticker: str, category: str) -> float:
    """
    Cross-reference ticker with momentum pipeline signals.
    Returns bonus points to add to quant score.
    """
    sig = _MOMENTUM_SIGNALS.get(ticker)
    if not sig:
        return 0.0

    bonus = 0.0
    sentiment = sig.get("sentiment", "")
    regime = sig.get("regime", "")
    phase = sig.get("momentum_phase", "")
    composite = sig.get("composite", 0)

    if category == "swing":
        # Swing: momentum confirmation is valuable
        if sentiment in ("Bullish", "Strong Bullish"):
            bonus += 5
        if phase == "Fresh":
            bonus += 5
        elif phase == "Accelerating":
            bonus += 3
        if regime == "Trending":
            bonus += 3
        # Penalty for exhausting momentum
        if phase == "Exhausting":
            bonus -= 5

    elif category == "leaps":
        # LEAPS: regime and trend matter more
        if regime == "Trending":
            bonus += 8
        elif regime == "Choppy":
            bonus += 4
        if sentiment in ("Bullish", "Strong Bullish"):
            bonus += 3
        # Strong penalty for fading names
        if phase == "Exhausting":
            bonus -= 10
        if composite < -0.5:
            bonus -= 5

    elif category == "cheap_calls":
        # Cheap calls: catalysts and momentum shocks
        shock = sig.get("momentum_shock", {})
        if shock.get("trigger"):
            bonus += 10
        if sig.get("daily_change", 0) > 2.0:
            bonus += 3
        sm = sig.get("smart_money", {})
        if sm.get("trigger"):
            bonus += 5

    return bonus


def _scan_one_ticker(symbol: str, profile: ScreeningProfile) -> list[dict]:
    """
    Scan a single ticker against a screening profile.
    Returns list of qualifying contracts with quant scores.
    """
    if not HAS_YF:
        return []

    results = []

    # Anti-ban jitter
    _time.sleep(random.uniform(0.05, 0.3))

    try:
        t = yf.Ticker(symbol.replace(".", "-"))

        # ── Gate: Stock price ──
        try:
            price = _yf_retry(lambda: t.fast_info["lastPrice"])
        except Exception:
            return []

        if not price or price < profile.price_min:
            return []

        # ── Gate: Average daily volume ──
        try:
            hist = t.history(period="30d")
            if hist.empty or len(hist) < 10:
                return []
            avg_vol = int(hist["Close"].count() and hist["Volume"].mean() or 0)
        except Exception:
            avg_vol = 0

        if avg_vol < profile.avg_volume_min:
            return []

        # ── Get 1-year history for IV Rank (cached in closure) ──
        _hist_1y: "pd.Series | None" = None

        def _get_hist_1y() -> "pd.Series":
            nonlocal _hist_1y
            if _hist_1y is None:
                try:
                    _hist_1y = t.history(period="1y")["Close"]
                except Exception:
                    _hist_1y = pd.Series(dtype=float)
            return _hist_1y

        # ── Pre-compute HV ONCE per ticker ──
        _hv: float | None = None

        def _get_edge(iv: float) -> float:
            nonlocal _hv
            if _hv is None:
                try:
                    closes = hist["Close"]
                    if len(closes) >= 20:
                        _hv = float(np.log(closes / closes.shift(1)).dropna().std() * np.sqrt(252))
                    else:
                        _hv = 0.0
                except Exception:
                    _hv = 0.0
                if math.isnan(_hv) or math.isinf(_hv):
                    _hv = 0.0
            return round(_hv - iv, 3) if _hv > 0 else 0

        # ── IV Rank cache (once per ticker) ──
        _iv_rank: float | None = None

        def _get_iv_rank(iv: float) -> float:
            nonlocal _iv_rank
            if _iv_rank is None:
                _iv_rank = compute_iv_rank(_get_hist_1y(), iv)
            return _iv_rank

        # ── Fundamental quality (LEAPS only, cached externally) ──
        _fund_quality: dict | None = None

        def _get_fundamentals() -> dict:
            nonlocal _fund_quality
            if _fund_quality is None:
                try:
                    from fundamentals_screen import get_quality
                    _fund_quality = get_quality(symbol)
                except ImportError:
                    try:
                        from pipelines.fundamentals_screen import get_quality
                        _fund_quality = get_quality(symbol)
                    except Exception:
                        _fund_quality = {"quality_score": 0.3, "quality_tier": "LOW"}
            return _fund_quality

        # ── Get option expirations ──
        expirations = _yf_retry(lambda: t.options)
        if not expirations:
            return []

        today = datetime.now()

        # ── Filter expirations by DTE range ──
        valid_expiries = []
        for e in expirations:
            dte = (datetime.strptime(e, "%Y-%m-%d") - today).days
            if profile.dte_min <= dte <= profile.dte_max:
                valid_expiries.append((e, dte))

        if not valid_expiries:
            return []

        # ── Momentum bonus (computed once per ticker) ──
        momentum_bonus = _get_momentum_bonus(symbol, profile.category)

        # ── Scan each valid expiration ──
        for exp_str, dte_days in valid_expiries:
            try:
                chain = _yf_retry(lambda e=exp_str: t.option_chain(e).calls)
                if chain is None or chain.empty:
                    continue
            except Exception:
                continue

            try:
                dte_years = dte_days / 365.0
                chain = chain.copy()

                # Ensure numeric columns
                for col in ["bid", "ask", "lastPrice", "openInterest", "impliedVolatility", "volume", "strike"]:
                    if col in chain.columns:
                        chain[col] = pd.to_numeric(chain[col], errors="coerce").fillna(0)

                # ══════════════════════════════════════════════════
                # VECTORIZED GATES — filter DataFrame in bulk
                # ══════════════════════════════════════════════════

                has_quotes = (chain["bid"] > 0) & (chain["ask"] > 0)
                chain["mid"] = 0.0
                chain.loc[has_quotes, "mid"] = (chain.loc[has_quotes, "bid"] + chain.loc[has_quotes, "ask"]) / 2
                chain.loc[~has_quotes, "mid"] = chain.loc[~has_quotes, "lastPrice"]
                chain["after_hours"] = ~has_quotes

                chain["spread_pct"] = 0.0
                chain.loc[has_quotes, "spread_pct"] = (
                    (chain.loc[has_quotes, "ask"] - chain.loc[has_quotes, "bid"]) / chain.loc[has_quotes, "mid"] * 100
                )

                # Must have SOME price
                has_price = chain["mid"] > 0

                # Gate: Premium range
                gate_prem = (chain["mid"] >= profile.premium_min) & (chain["mid"] <= profile.premium_max)

                # Gate: Premium as % of stock price
                chain["premium_pct"] = (chain["mid"] / price) * 100
                gate_prem_pct = chain["premium_pct"] <= profile.premium_pct_max

                # Gate: Moneyness
                if profile.moneyness == "ATM_OTM":
                    gate_money = chain["strike"] >= price * profile.moneyness_threshold
                elif profile.moneyness == "ITM_ONLY":
                    gate_money = chain["strike"] <= price * profile.moneyness_threshold
                elif profile.moneyness == "OTM_ONLY":
                    gate_money = chain["strike"] >= price * profile.moneyness_threshold
                else:
                    gate_money = pd.Series(True, index=chain.index)

                # Gate: Spread (skip for after-hours)
                gate_spread = chain["after_hours"] | (chain["spread_pct"] <= profile.spread_pct_max)

                # Gate: OI (skip for after-hours)
                oi_col = chain["openInterest"].astype(int)
                gate_oi = chain["after_hours"] | (oi_col >= profile.oi_min)

                # Combined vectorized mask
                mask = has_price & gate_prem & gate_prem_pct & gate_money & gate_spread & gate_oi
                survivors = chain[mask]

                if survivors.empty:
                    continue

                # ══════════════════════════════════════════════════
                # ITERATE survivors — compute Greeks + category scoring
                # ══════════════════════════════════════════════════

                for _, opt in survivors.iterrows():
                    bid = float(opt["bid"])
                    ask = float(opt["ask"])
                    mid = float(opt["mid"])
                    after_hours = bool(opt["after_hours"])
                    oi = int(opt["openInterest"])
                    iv = float(opt["impliedVolatility"])
                    spread_pct_val = float(opt["spread_pct"])
                    volume = int(opt.get("volume", 0) or 0)
                    strike = float(opt["strike"])
                    prem_pct = float(opt["premium_pct"])

                    # Calculate Greeks
                    if after_hours or iv < 0.10:
                        ratio = price / strike
                        delta = round(max(0, min(1.0, 0.5 + (ratio - 1.0) * 2.5)), 2)
                        pop = round(max(0, min(1.0, delta * 0.85)), 2)
                        edge = 0
                    else:
                        delta, pop = FlowProtocol.calculate_greeks(
                            price, strike, dte_years, 0.04, iv
                        )
                        edge = _get_edge(iv)

                    # ── Gate: Delta range ──
                    if delta < profile.delta_min or delta > profile.delta_max:
                        continue

                    # ── Gate: IV Rank (swing only) ──
                    iv_rank = _get_iv_rank(iv) if profile.iv_rank_max is not None else 50.0
                    if profile.iv_rank_max is not None and iv_rank > profile.iv_rank_max:
                        continue

                    # ── Gate: Vol/OI (cheap calls) ──
                    vol_oi = round(volume / oi, 2) if oi > 0 else 0.0
                    if profile.vol_oi_min is not None and vol_oi < profile.vol_oi_min:
                        continue

                    # ── Gate: Option volume (cheap calls) ──
                    if profile.volume_min is not None and volume < profile.volume_min:
                        continue

                    # ── Gate: Extrinsic % (LEAPS) ──
                    intrinsic = max(0, price - strike)
                    extrinsic = max(0, mid - intrinsic)
                    extrinsic_pct = round((extrinsic / mid * 100) if mid > 0 else 100, 1)
                    if profile.extrinsic_pct_max is not None and extrinsic_pct > profile.extrinsic_pct_max:
                        continue

                    # ══════════════════════════════════════════════════
                    # QUANT SCORE — Category-specific formula
                    # ══════════════════════════════════════════════════

                    if profile.category == "swing":
                        quant_score = _swing_score(
                            pop=pop, vol_edge=edge, delta=delta, oi=oi,
                            iv_rank=iv_rank, spread_pct=spread_pct_val,
                            momentum_bonus=momentum_bonus,
                        )
                    elif profile.category == "leaps":
                        fund = _get_fundamentals()
                        regime_bonus = momentum_bonus  # reuse
                        quant_score = _leaps_score(
                            delta=delta, vol_edge=edge, extrinsic_pct=extrinsic_pct,
                            fundamental_quality=fund.get("quality_score", 0.3),
                            iv_rank=iv_rank, regime_bonus=regime_bonus,
                        )
                    elif profile.category == "cheap_calls":
                        quant_score = _cheap_score(
                            vol_oi_ratio=vol_oi, vol_edge=edge, volume=volume,
                            delta=delta, catalyst_bonus=momentum_bonus,
                            spread_pct=spread_pct_val, oi=oi,
                        )
                    else:
                        quant_score = pop * 40 + max(0, edge) * 100 * 4  # Legacy

                    # Breakeven %
                    be_pct = round(((strike + mid) / price - 1) * 100, 2)

                    # Moneyness label
                    if strike < price * 0.97:
                        mness = "ITM"
                    elif abs(strike - price) / price < 0.03:
                        mness = "ATM"
                    else:
                        mness = "OTM"

                    # Risk tag (cheap calls only)
                    risk_tag = _get_risk_tag(delta) if profile.category == "cheap_calls" else None

                    # Fundamental quality (LEAPS only)
                    fund_quality = None
                    if profile.category == "leaps":
                        fund = _get_fundamentals()
                        fund_quality = fund.get("quality_tier", "LOW")

                    results.append({
                        "ticker": symbol,
                        "stock_price": round(price, 2),
                        "strike": strike,
                        "expiration": exp_str,
                        "dte": dte_days,
                        "bid": round(bid, 2),
                        "ask": round(ask, 2),
                        "mid_price": round(mid, 2),
                        "delta": delta,
                        "pop": pop,
                        "vol_edge": edge,
                        "breakeven_pct": be_pct,
                        "open_interest": oi,
                        "volume": volume,
                        "implied_volatility": round(iv * 100, 1),
                        "spread_pct": round(spread_pct_val, 1),
                        "quant_score": quant_score,
                        "moneyness": mness,
                        # ── New v3 fields ──
                        "strategy_category": profile.category,
                        "iv_rank": round(iv_rank, 1),
                        "vol_oi_ratio": vol_oi,
                        "extrinsic_pct": extrinsic_pct,
                        "premium_pct": round(prem_pct, 2),
                        "risk_tag": risk_tag,
                        "fundamental_quality": fund_quality,
                        "avg_daily_volume": avg_vol,
                    })

            except Exception as e:
                logger.debug(f"Chain error {symbol}/{exp_str}: {e}")
                continue

    except Exception as e:
        logger.debug(f"Ticker scan failed {symbol}: {e}")

    return results


# ═══════════════════════════════════════════════════════════════
# 7. PUBLIC API — Backward-compatible + new category support
# ═══════════════════════════════════════════════════════════════

def get_alpha_calls(
    limit: int = 75,
    max_workers: int = 4,
    sort_by: str = "quant_score",
    universe: str = "sp500",
    categories: list[str] | None = None,
    **kwargs,
) -> dict:
    """
    Run the Alpha-Flow scan. v3 supports multiple categories.

    Args:
        limit: Max tickers to scan per category
        max_workers: ThreadPool worker count
        sort_by: Sort key for results
        universe: "sp500", "nasdaq100", or "both"
        categories: List of categories to scan. Default: all three.
                    Options: ["swing"], ["leaps"], ["cheap_calls"], or any combo.

    Returns same dict format as v2, with added 'strategy_category' on each call.
    """
    global _MOMENTUM_SIGNALS

    if categories is None:
        categories = ["swing", "leaps", "cheap_calls"]

    # Load momentum signals for cross-reference
    _MOMENTUM_SIGNALS = _load_momentum_signals()

    # Fetch universe
    if universe == "nasdaq100":
        tickers = get_nasdaq100()
        src = "NASDAQ 100"
    elif universe == "both":
        sp = get_sp500()
        nq = get_nasdaq100()
        seen = set()
        tickers = []
        for t_sym in sp + nq:
            if t_sym not in seen:
                seen.add(t_sym)
                tickers.append(t_sym)
        src = "S&P 500 + NASDAQ 100"
    else:
        tickers = get_sp500()
        src = "S&P 500"

    if not tickers:
        try:
            import json
            from pathlib import Path
            p = Path(__file__).parent / "momentum_data.json"
            if p.exists():
                with open(p) as f:
                    data = json.load(f)
                tickers = [s["ticker"] for s in data.get("signals", []) if s.get("price", 0) >= 10]
                src = "Momentum"
        except Exception:
            pass

    if not tickers:
        return {
            "calls": [],
            "meta": {"error": "No universe available", "universe_size": 0},
            "timestamp": datetime.now().isoformat(),
        }

    scan_tickers = tickers[:limit]
    all_calls: list[dict] = []
    total_errors = 0
    total_scanned = 0

    scan_start = _time.monotonic()
    SCAN_TIMEOUT = 240

    # ── Scan each category SEQUENTIALLY (memory safe) ──
    for cat_name in categories:
        profile = PROFILES.get(cat_name)
        if not profile:
            logger.warning(f"Unknown category: {cat_name}")
            continue

        logger.info(f"Alpha-Flow v3: Scanning {cat_name} — {len(scan_tickers)} tickers")
        cat_calls: list[dict] = []
        cat_errors = 0

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(_scan_one_ticker, sym, profile): sym
                for sym in scan_tickers
            }
            for future in as_completed(futures):
                elapsed = _time.monotonic() - scan_start
                if elapsed > SCAN_TIMEOUT:
                    logger.warning(f"Alpha-Flow: Timeout after {elapsed:.0f}s")
                    for f in futures:
                        f.cancel()
                    break
                try:
                    results = future.result(timeout=30)
                    cat_calls.extend(results)
                except Exception:
                    cat_errors += 1

        # Sort by quant_score descending, take top 10
        cat_calls.sort(key=lambda x: x.get("quant_score", 0), reverse=True)
        top_calls = cat_calls[:10]

        logger.info(
            f"  {cat_name}: {len(cat_calls)} total → top {len(top_calls)} selected"
        )

        all_calls.extend(top_calls)
        total_errors += cat_errors
        total_scanned += len(scan_tickers)

        # Free memory between categories
        del cat_calls
        gc.collect()

    scan_elapsed = round(_time.monotonic() - scan_start, 1)
    tickers_with_calls = len(set(c["ticker"] for c in all_calls))

    logger.info(
        f"Alpha-Flow v3: Done in {scan_elapsed}s — "
        f"{len(all_calls)} contracts from {tickers_with_calls} tickers "
        f"across {len(categories)} categories"
    )

    # Build filters metadata per category
    filters_meta = {}
    for cat_name in categories:
        p = PROFILES.get(cat_name)
        if p:
            filters_meta[cat_name] = {
                "price_floor": f"${p.price_min:.0f}",
                "dte_range": f"{p.dte_min}-{p.dte_max}d",
                "premium_range": f"${p.premium_min}-${p.premium_max}",
                "delta_range": f"{p.delta_min}-{p.delta_max}",
                "moneyness": p.moneyness,
                "oi_floor": str(p.oi_min),
                "spread_max": f"{p.spread_pct_max}%",
            }

    return {
        "calls": all_calls,
        "meta": {
            "universe_source": src,
            "universe_size": len(tickers),
            "tickers_scanned": total_scanned,
            "contracts_found": len(all_calls),
            "tickers_with_calls": tickers_with_calls,
            "errors": total_errors,
            "partial": False,
            "scan_time_seconds": scan_elapsed,
            "categories": categories,
            "filters": filters_meta,
        },
        "timestamp": datetime.now().isoformat(),
    }


# ═══════════════════════════════════════════════════════════════
# 8. DB-BACKED PIPELINE — Scan + persist to SQLite
# ═══════════════════════════════════════════════════════════════

def run_alpha_pipeline(
    universe: str = "sp500",
    max_workers: int = 4,
    categories: list[str] | None = None,
) -> dict:
    """
    Run a full alpha scan and persist results to the alpha_calls DB table.
    Called on startup and by the daily scheduler.

    Returns scan metadata dict.
    """
    try:
        import db
    except ImportError:
        from pipelines import db

    result = get_alpha_calls(
        limit=500,
        max_workers=max_workers,
        sort_by="quant_score",
        universe=universe,
        categories=categories,
    )

    calls = result.get("calls", [])
    meta = result.get("meta", {})

    # Persist to SQLite
    n = db.upsert_alpha_calls_bulk(calls, universe, meta)
    logger.info(f"Alpha pipeline v3: persisted {n} contracts for {universe}")

    return meta
