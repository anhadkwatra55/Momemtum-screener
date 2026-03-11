"""
backtester.py — Vectorized Backtesting Engine
================================================
Tests the 4 indicator systems (individually or ensemble) on historical data.
Computes equity curves, trade logs, performance metrics, and projections.

Design:
    - Pure NumPy/Pandas vectorized ops (no row-by-row loops for signals)
    - Configurable holding period, date range, entry thresholds
    - Ensemble mode: enter when K-of-N systems agree
    - Forward projection via historical performance extrapolation
"""

from __future__ import annotations

import json
import threading
import time
import warnings
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

import db
import momentum_config as cfg
from momentum_indicators import score_system1, score_system2, score_system3, score_system4

warnings.filterwarnings("ignore")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  SIGNAL GENERATION (vectorized over time)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _generate_rolling_signals(
    df: pd.DataFrame,
    systems: list[int],
    lookback: int = 100,
    step: int = 1,
) -> pd.DataFrame:
    """
    Generate daily signals by rolling each system scorer over the DataFrame.
    Returns a DataFrame indexed by date with columns: sys1..sys4, composite.
    """
    n = len(df)
    dates = df.index[lookback:]

    # Pre-allocate
    sys_scores = {s: [] for s in systems}
    composite_scores = []

    for i in range(lookback, n, step):
        window = df.iloc[max(0, i - lookback):i + 1]
        day_scores = []

        for s in systems:
            try:
                if s == 1:
                    result = score_system1(window)
                elif s == 2:
                    result = score_system2(window)
                elif s == 3:
                    result = score_system3(window)
                elif s == 4:
                    result = score_system4(window)
                else:
                    result = {"score": 0.0}
                sc = result["score"]
            except Exception:
                sc = 0.0
            sys_scores[s].append(sc)
            day_scores.append(sc)

        composite_scores.append(float(np.mean(day_scores)))

    idx = df.index[lookback::step][:len(composite_scores)]
    result_df = pd.DataFrame(index=idx)
    for s in systems:
        result_df[f"sys{s}"] = sys_scores[s][:len(idx)]
    result_df["composite"] = composite_scores[:len(idx)]

    return result_df


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  BACKTESTING CORE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def run_backtest(
    ticker: str,
    ohlcv: pd.DataFrame,
    systems: list[int] = [1, 2, 3, 4],
    holding_period: int = 5,
    entry_threshold: float = 0.5,
    ensemble_k: int | None = None,
    initial_capital: float = 100000.0,
    position_pct: float = 0.1,
    step: int = 1,
    cancel_event: threading.Event | None = None,
) -> dict:
    """
    Run a backtest for a single ticker.

    Parameters
    ----------
    ticker          : stock symbol
    ohlcv           : OHLCV DataFrame
    systems         : which systems to use [1,2,3,4]
    holding_period  : days to hold each trade
    entry_threshold : composite score threshold to enter
    ensemble_k      : if set, require K-of-N systems to agree for entry
    initial_capital : starting capital
    position_pct    : fraction of capital per trade
    step            : signal evaluation frequency (1=daily)

    Returns dict with trades, equity_curve, and summary metrics.
    """
    if len(ohlcv) < 120:
        return _empty_result(ticker)

    t0 = time.time()

    # Generate signals
    signals = _generate_rolling_signals(ohlcv, systems, lookback=100, step=step)

    if signals.empty:
        return _empty_result(ticker)

    close = ohlcv["Close"].reindex(signals.index).ffill()

    # Determine entry signals
    if ensemble_k and len(systems) > 1:
        # Ensemble: require K systems to agree on direction
        bull_agree = sum((signals[f"sys{s}"] > entry_threshold).astype(int) for s in systems)
        bear_agree = sum((signals[f"sys{s}"] < -entry_threshold).astype(int) for s in systems)
        entry_long = bull_agree >= ensemble_k
        entry_short = bear_agree >= ensemble_k
    else:
        entry_long = signals["composite"] > entry_threshold
        entry_short = signals["composite"] < -entry_threshold

    # Simulate trades
    trades = []
    equity = initial_capital
    equity_curve = []
    in_trade = False
    trade_end_idx = -1

    dates = signals.index
    for i in range(len(dates)):
        # Check for cancellation
        if cancel_event and cancel_event.is_set():
            break

        if in_trade and i >= trade_end_idx:
            # Exit trade
            exit_price = float(close.iloc[i])
            if current_direction == "LONG":
                pnl = (exit_price - entry_price) * shares
            else:
                pnl = (entry_price - exit_price) * shares
            equity += pnl
            trades.append({
                "entry_date": entry_date.strftime("%Y-%m-%d"),
                "exit_date": dates[i].strftime("%Y-%m-%d"),
                "direction": current_direction,
                "entry_price": round(float(entry_price), 2),
                "exit_price": round(float(exit_price), 2),
                "shares": shares,
                "pnl": round(float(pnl), 2),
                "return_pct": round(float(pnl / (entry_price * shares) * 100), 2),
                "composite_at_entry": round(float(composite_at_entry), 2),
            })
            in_trade = False

        if not in_trade:
            if entry_long.iloc[i]:
                in_trade = True
                current_direction = "LONG"
                entry_price = float(close.iloc[i])
                shares = max(1, int(equity * position_pct / entry_price))
                entry_date = dates[i]
                composite_at_entry = signals["composite"].iloc[i]
                trade_end_idx = min(i + holding_period, len(dates) - 1)
            elif entry_short.iloc[i]:
                in_trade = True
                current_direction = "SHORT"
                entry_price = float(close.iloc[i])
                shares = max(1, int(equity * position_pct / entry_price))
                entry_date = dates[i]
                composite_at_entry = signals["composite"].iloc[i]
                trade_end_idx = min(i + holding_period, len(dates) - 1)

        equity_curve.append({
            "date": dates[i].strftime("%Y-%m-%d"),
            "equity": round(float(equity), 2),
        })

    # Close any open trade at the end
    if in_trade and len(close) > 0:
        exit_price = float(close.iloc[-1])
        if current_direction == "LONG":
            pnl = (exit_price - entry_price) * shares
        else:
            pnl = (entry_price - exit_price) * shares
        equity += pnl
        trades.append({
            "entry_date": entry_date.strftime("%Y-%m-%d"),
            "exit_date": dates[-1].strftime("%Y-%m-%d"),
            "direction": current_direction,
            "entry_price": round(float(entry_price), 2),
            "exit_price": round(float(exit_price), 2),
            "shares": shares,
            "pnl": round(float(pnl), 2),
            "return_pct": round(float(pnl / (entry_price * shares) * 100), 2) if entry_price > 0 else 0,
            "composite_at_entry": round(float(composite_at_entry), 2),
        })
        equity_curve[-1]["equity"] = round(float(equity), 2)

    # Compute summary metrics
    summary = _compute_metrics(trades, equity_curve, initial_capital, holding_period)
    summary["ticker"] = ticker
    summary["systems"] = systems
    summary["holding_period"] = holding_period
    summary["entry_threshold"] = entry_threshold
    summary["ensemble_k"] = ensemble_k
    summary["initial_capital"] = initial_capital
    summary["final_equity"] = round(float(equity), 2)
    summary["elapsed_ms"] = round((time.time() - t0) * 1000, 1)

    # Subsample equity curve for charting (max 200 points)
    eq_step = max(1, len(equity_curve) // 200)
    equity_sub = equity_curve[::eq_step]
    if equity_curve and equity_sub[-1] != equity_curve[-1]:
        equity_sub.append(equity_curve[-1])

    return {
        "ticker": ticker,
        "trades": trades,
        "equity_curve": equity_sub,
        "summary": summary,
    }


def _compute_metrics(
    trades: list[dict],
    equity_curve: list[dict],
    initial_capital: float,
    holding_period: int,
) -> dict:
    """Compute comprehensive backtest metrics."""
    if not trades:
        return {
            "total_return": 0, "total_return_pct": 0, "annualised_return": 0,
            "max_drawdown": 0, "max_drawdown_pct": 0, "max_peak_profit": 0,
            "sharpe_ratio": 0, "sortino_ratio": 0,
            "win_rate": 0, "avg_win": 0, "avg_loss": 0, "profit_factor": 0,
            "total_trades": 0, "avg_holding_days": holding_period,
            "best_trade": 0, "worst_trade": 0,
        }

    pnls = [t["pnl"] for t in trades]
    returns = [t["return_pct"] / 100 for t in trades]

    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]

    # Equity series
    equities = [e["equity"] for e in equity_curve]
    eq = np.array(equities)
    peak = np.maximum.accumulate(eq)
    drawdown = eq - peak
    max_dd = float(drawdown.min())
    max_dd_pct = float((drawdown / np.where(peak > 0, peak, 1)).min() * 100)

    max_peak = float(eq.max()) - initial_capital

    total_return = float(eq[-1] - initial_capital) if len(eq) > 0 else 0
    total_return_pct = round(total_return / initial_capital * 100, 2)

    # Annualised
    n_days = len(equity_curve)
    if n_days > 1 and total_return_pct > -100:
        ann_return = ((1 + total_return_pct / 100) ** (252 / n_days) - 1) * 100
    else:
        ann_return = 0

    # Sharpe (daily returns)
    if len(equities) > 1:
        daily_ret = np.diff(equities) / equities[:-1]
        daily_ret = daily_ret[np.isfinite(daily_ret)]
        if len(daily_ret) > 1 and np.std(daily_ret) > 0:
            sharpe = float(np.mean(daily_ret) / np.std(daily_ret) * np.sqrt(252))
        else:
            sharpe = 0.0

        # Sortino (downside deviation)
        downside = daily_ret[daily_ret < 0]
        if len(downside) > 0 and np.std(downside) > 0:
            sortino = float(np.mean(daily_ret) / np.std(downside) * np.sqrt(252))
        else:
            sortino = sharpe
    else:
        sharpe = sortino = 0.0

    # Win rate & profit factor
    win_rate = len(wins) / len(pnls) * 100 if pnls else 0
    gross_profit = sum(wins) if wins else 0
    gross_loss = abs(sum(losses)) if losses else 0
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf') if gross_profit > 0 else 0

    return {
        "total_return": round(total_return, 2),
        "total_return_pct": total_return_pct,
        "annualised_return": round(ann_return, 2),
        "max_drawdown": round(max_dd, 2),
        "max_drawdown_pct": round(max_dd_pct, 2),
        "max_peak_profit": round(max_peak, 2),
        "sharpe_ratio": round(sharpe, 2),
        "sortino_ratio": round(sortino, 2),
        "win_rate": round(win_rate, 1),
        "avg_win": round(np.mean(wins), 2) if wins else 0,
        "avg_loss": round(np.mean(losses), 2) if losses else 0,
        "profit_factor": round(profit_factor, 2) if profit_factor != float('inf') else 99.99,
        "total_trades": len(trades),
        "avg_holding_days": holding_period,
        "best_trade": round(max(pnls), 2) if pnls else 0,
        "worst_trade": round(min(pnls), 2) if pnls else 0,
    }


def _empty_result(ticker: str) -> dict:
    return {
        "ticker": ticker,
        "trades": [],
        "equity_curve": [],
        "summary": {
            "total_return": 0, "total_return_pct": 0, "annualised_return": 0,
            "max_drawdown": 0, "max_drawdown_pct": 0, "max_peak_profit": 0,
            "sharpe_ratio": 0, "sortino_ratio": 0,
            "win_rate": 0, "avg_win": 0, "avg_loss": 0, "profit_factor": 0,
            "total_trades": 0, "avg_holding_days": 0,
            "best_trade": 0, "worst_trade": 0,
            "ticker": ticker, "systems": [], "holding_period": 0,
            "entry_threshold": 0, "ensemble_k": None, "elapsed_ms": 0,
        },
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MULTI-TICKER BACKTEST
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def backtest_universe(
    ohlcv: Dict[str, pd.DataFrame],
    systems: list[int] = [1, 2, 3, 4],
    holding_period: int = 5,
    entry_threshold: float = 0.5,
    ensemble_k: int | None = None,
    top_n: int = 20,
    progress: bool = True,
    initial_capital: float = 100000.0,
    cancel_event: threading.Event | None = None,
) -> dict:
    """
    Run backtest across the universe, aggregate results.
    Returns top_n tickers by total return.
    """
    all_results = []
    tickers = sorted(ohlcv.keys())

    for i, ticker in enumerate(tickers):
        # Check for cancellation
        if cancel_event and cancel_event.is_set():
            if progress:
                print(f"    ⏹ Backtest cancelled at {i}/{len(tickers)}")
            break

        if progress and (i + 1) % 10 == 0:
            print(f"    Backtested {i + 1}/{len(tickers)} …")

        result = run_backtest(
            ticker, ohlcv[ticker],
            systems=systems,
            holding_period=holding_period,
            entry_threshold=entry_threshold,
            ensemble_k=ensemble_k,
            initial_capital=initial_capital,
            step=1,
            cancel_event=cancel_event,
        )
        if result["summary"]["total_trades"] > 0:
            all_results.append(result)

    # Sort by total return descending
    all_results.sort(key=lambda x: x["summary"]["total_return_pct"], reverse=True)

    # Aggregate metrics
    if all_results:
        returns = [r["summary"]["total_return_pct"] for r in all_results]
        sharpes = [r["summary"]["sharpe_ratio"] for r in all_results]
        win_rates = [r["summary"]["win_rate"] for r in all_results]
        total_trades = sum(r["summary"]["total_trades"] for r in all_results)
    else:
        returns = sharpes = win_rates = [0]
        total_trades = 0

    aggregate = {
        "tickers_tested": len(tickers),
        "tickers_with_trades": len(all_results),
        "avg_return_pct": round(float(np.mean(returns)), 2),
        "median_return_pct": round(float(np.median(returns)), 2),
        "best_return_pct": round(float(max(returns)), 2) if returns else 0,
        "worst_return_pct": round(float(min(returns)), 2) if returns else 0,
        "avg_sharpe": round(float(np.mean(sharpes)), 2),
        "avg_win_rate": round(float(np.mean(win_rates)), 1),
        "total_trades": total_trades,
        "systems": systems,
        "holding_period": holding_period,
        "entry_threshold": entry_threshold,
        "ensemble_k": ensemble_k,
    }

    # Projection: estimate forward P&L based on historical avg
    projection = _project_forward(all_results, holding_period)

    return {
        "results": all_results[:top_n],
        "aggregate": aggregate,
        "projection": projection,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  FORWARD PROJECTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _project_forward(
    results: list[dict],
    holding_period: int,
    forward_days: int = 60,
    capital: float = 100000.0,
) -> dict:
    """
    Project estimated P&L forward based on historical backtest performance.
    Uses bootstrap sampling of historical trade returns.
    """
    if not results:
        return {"projected_equity": [], "expected_return": 0, "confidence_interval": [0, 0]}

    # Collect all trade return percentages
    all_returns = []
    for r in results:
        for t in r["trades"]:
            all_returns.append(t["return_pct"] / 100)

    if not all_returns:
        return {"projected_equity": [], "expected_return": 0, "confidence_interval": [0, 0]}

    rng = np.random.default_rng(42)
    n_sims = 500
    trades_per_period = max(1, forward_days // max(holding_period, 1))

    final_equities = []
    sample_paths = []

    for sim in range(n_sims):
        equity = capital
        path = [equity]
        for _ in range(trades_per_period):
            ret = rng.choice(all_returns)
            equity *= (1 + ret * 0.1)  # 10% position size
            path.append(round(float(equity), 2))
        final_equities.append(equity)
        if sim < 5:
            sample_paths.append(path)

    final_arr = np.array(final_equities)
    expected = float(np.median(final_arr))
    ci_5 = float(np.percentile(final_arr, 5))
    ci_95 = float(np.percentile(final_arr, 95))

    # Build average projected equity curve
    max_len = max(len(p) for p in sample_paths) if sample_paths else 0
    avg_path = []
    for i in range(max_len):
        vals = [p[i] for p in sample_paths if i < len(p)]
        avg_path.append(round(float(np.mean(vals)), 2))

    return {
        "projected_equity": avg_path,
        "expected_return": round((expected - capital) / capital * 100, 2),
        "confidence_interval": [
            round((ci_5 - capital) / capital * 100, 2),
            round((ci_95 - capital) / capital * 100, 2),
        ],
        "forward_days": forward_days,
        "n_simulations": n_sims,
        "expected_final_equity": round(expected, 2),
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  COMPARE SYSTEMS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def compare_systems(
    ticker: str,
    ohlcv: pd.DataFrame,
    holding_period: int = 5,
    entry_threshold: float = 0.5,
) -> dict:
    """
    Run each system individually + ensemble, return comparison.
    """
    comparisons = {}

    # Individual systems
    for s in [1, 2, 3, 4]:
        result = run_backtest(
            ticker, ohlcv,
            systems=[s],
            holding_period=holding_period,
            entry_threshold=entry_threshold,
        )
        comparisons[f"S{s}"] = result["summary"]

    # All systems (composite)
    result_all = run_backtest(
        ticker, ohlcv,
        systems=[1, 2, 3, 4],
        holding_period=holding_period,
        entry_threshold=entry_threshold,
    )
    comparisons["Composite"] = result_all["summary"]

    # Ensemble (3-of-4 agree)
    result_ens = run_backtest(
        ticker, ohlcv,
        systems=[1, 2, 3, 4],
        holding_period=holding_period,
        entry_threshold=entry_threshold,
        ensemble_k=3,
    )
    comparisons["Ensemble 3/4"] = result_ens["summary"]

    return {
        "ticker": ticker,
        "comparisons": comparisons,
        "equity_curves": {
            "Composite": result_all.get("equity_curve", []),
            "Ensemble 3/4": result_ens.get("equity_curve", []),
        },
    }
