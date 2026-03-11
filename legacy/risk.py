"""
risk.py — The Gatekeeper: Risk & Execution Constraints
========================================================
1. Liquidity Gate          (ADV₂₀ × Price ≥ $10 M)
2. Micro-Cap Filter        (Market Cap ≥ $300 M)
3. Fat-Tail / Kurtosis     (Excess Kurtosis ≤ 10)
4. Information Ratio       (annualised excess-return / tracking-error)
5. Correlation Pruning     (keep highest-IR ticker per sector)
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import kurtosis as sp_kurtosis

import config as cfg


# ═══════════════════════════════════════════════
#  LIQUIDITY GATE
# ═══════════════════════════════════════════════

def passes_liquidity_gate(
    price: float,
    avg_volume_20d: float,
    floor: float = cfg.LIQUIDITY_FLOOR,
) -> bool:
    """Return True if notional turnover ≥ floor."""
    return (price * avg_volume_20d) >= floor


# ═══════════════════════════════════════════════
#  MICRO-CAP FILTER
# ═══════════════════════════════════════════════

def passes_market_cap_filter(
    market_cap: float,
    floor: float = cfg.MARKET_CAP_FLOOR,
) -> bool:
    """Exclude micro-caps that may be susceptible to pump-and-dump."""
    return market_cap >= floor


# ═══════════════════════════════════════════════
#  FAT-TAIL / KURTOSIS CHECK
# ═══════════════════════════════════════════════

def excess_kurtosis(
    returns: pd.Series,
    window: int = cfg.WINDOW_KURTOSIS,
) -> float:
    """
    Compute the excess kurtosis of the most recent *window* returns.

    If kurtosis > KURTOSIS_CEILING, the distribution is fat-tailed
    (likely news-driven / Black Swan), and the "mean" around which we
    expect reversion may no longer exist.
    """
    tail = returns.dropna().iloc[-window:]
    if len(tail) < 20:
        return np.nan
    return float(sp_kurtosis(tail, fisher=True))   # fisher=True → excess kurtosis


def passes_kurtosis_check(
    returns: pd.Series,
    ceiling: float = cfg.KURTOSIS_CEILING,
    window: int = cfg.WINDOW_KURTOSIS,
) -> bool:
    """Return True if excess kurtosis is within acceptable bounds."""
    ek = excess_kurtosis(returns, window)
    if np.isnan(ek):
        return False        # conservative: reject if data is insufficient
    return ek <= ceiling


# ═══════════════════════════════════════════════
#  INFORMATION RATIO
# ═══════════════════════════════════════════════

def information_ratio(
    returns: pd.Series,
    benchmark_returns: pd.Series,
    annualise: bool = True,
) -> float:
    """
    Information Ratio = mean(excess returns) / std(excess returns)

    Mathematical Significance vs Simple "Return"
    ---------------------------------------------
    • A simple return metric tells you *how much* money was made.
    • The Information Ratio (IR) tells you *how consistently* the manager
      (or signal) generated alpha **per unit of active risk** (tracking
      error).  It is the Sharpe Ratio's cousin, but measured relative to
      a benchmark instead of the risk-free rate.

    Why it matters:
        IR = α / ω
    where α = annualised excess return and ω = annualised tracking error.

    A strategy with 20 % return and 40 % tracking error (IR = 0.5) is
    *inferior* to one with 10 % return and 5 % tracking error (IR = 2.0)
    because the latter achieves its return with far more *skill* and far
    less *luck*.

    Renaissance reportedly targets IR > 2.0 on individual signals before
    capital allocation.
    """
    excess = returns - benchmark_returns
    excess = excess.dropna()
    if len(excess) < 20 or excess.std() == 0:
        return 0.0

    ir = excess.mean() / excess.std()

    if annualise:
        ir *= np.sqrt(cfg.TRADING_DAYS_PER_YEAR)

    return float(ir)


# ═══════════════════════════════════════════════
#  CORRELATION PRUNING
# ═══════════════════════════════════════════════

def correlation_prune(
    residual_returns: pd.DataFrame,
    ir_scores: pd.Series,
    sector_labels: pd.Series,
    corr_threshold: float = 0.70,
) -> pd.Index:
    """
    Within each sector, compute pairwise correlation of **residual**
    returns.  When two tickers are correlated above *corr_threshold*,
    keep only the one with the higher Information Ratio.

    This prevents "doubling down" on a single hidden factor (e.g., two
    auto-part stocks that look like separate signals but are driven by
    the same steel-price factor).

    Parameters
    ----------
    residual_returns : pd.DataFrame
        Columns = tickers, rows = dates, values = residual log-returns.
    ir_scores  : pd.Series  (index = tickers)
        Pre-computed Information Ratios.
    sector_labels  : pd.Series  (index = tickers)
        GICS sector (or equivalent) for each ticker.
    corr_threshold : float
        Maximum allowed pairwise correlation.

    Returns
    -------
    pd.Index — tickers that survive the pruning.
    """
    survivors: list[str] = []

    for sector in sector_labels.unique():
        members = sector_labels[sector_labels == sector].index
        members = [m for m in members if m in residual_returns.columns]

        if len(members) <= 1:
            survivors.extend(members)
            continue

        corr = residual_returns[members].corr()
        # Sort members by IR descending → greedily keep best
        sorted_members = ir_scores.loc[members].sort_values(ascending=False).index.tolist()

        keep = set()
        drop = set()
        for ticker in sorted_members:
            if ticker in drop:
                continue
            keep.add(ticker)
            # Drop everything highly correlated with this ticker
            for other in sorted_members:
                if other == ticker or other in keep or other in drop:
                    continue
                if abs(corr.loc[ticker, other]) > corr_threshold:
                    drop.add(other)

        survivors.extend(keep)

    return pd.Index(survivors)
