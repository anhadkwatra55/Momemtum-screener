"""
strategy_engine.py — Indicator Library + Strategy Execution Engine
===================================================================
15 built-in technical indicators (TradingView-style) plus a strategy
execution engine supporting visual rules and custom Python code.
"""

from __future__ import annotations

import math
import threading
import time
import traceback
import warnings
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")


# ═══════════════════════════════════════════════════════════════
#  HELPER MOVING AVERAGES
# ═══════════════════════════════════════════════════════════════

def _ema(s: pd.Series, period: int) -> pd.Series:
    return s.ewm(span=period, adjust=False).mean()

def _sma(s: pd.Series, period: int) -> pd.Series:
    return s.rolling(period).mean()

def _rma(s: pd.Series, period: int) -> pd.Series:
    """Wilder's smoothed MA (RMA)."""
    return s.ewm(alpha=1.0 / period, adjust=False).mean()

def _wma(s: pd.Series, period: int) -> pd.Series:
    w = np.arange(1, period + 1, dtype=float)
    return s.rolling(period).apply(lambda x: np.dot(x, w) / w.sum(), raw=True)

def _true_range(h: pd.Series, l: pd.Series, c: pd.Series) -> pd.Series:
    pc = c.shift(1)
    return pd.concat([h - l, (h - pc).abs(), (l - pc).abs()], axis=1).max(axis=1)


# ═══════════════════════════════════════════════════════════════
#  INDICATOR REGISTRY
# ═══════════════════════════════════════════════════════════════
# Each indicator is a dict with:
#   name, category, description, params (list of {name, default, desc}),
#   outputs (list of column names), fn (callable)

INDICATORS: Dict[str, dict] = {}

def _register(name, category, description, params, outputs, fn):
    INDICATORS[name] = {
        "name": name,
        "category": category,
        "description": description,
        "params": params,
        "outputs": outputs,
        "fn": fn,
    }


# ── 1. RSI ──
def _calc_rsi(df, period=14):
    delta = df["Close"].diff()
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)
    avg_gain = _rma(gain, period)
    avg_loss = _rma(loss, period)
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - 100 / (1 + rs)
    return pd.DataFrame({"rsi": rsi}, index=df.index)

_register("RSI", "Momentum",
    "Relative Strength Index — measures overbought/oversold conditions",
    [{"name": "period", "default": 14, "type": "int", "desc": "Lookback period"}],
    ["rsi"], _calc_rsi)


# ── 2. MACD ──
def _calc_macd(df, fast=12, slow=26, signal=9):
    c = df["Close"]
    macd_line = _ema(c, fast) - _ema(c, slow)
    signal_line = _ema(macd_line, signal)
    histogram = macd_line - signal_line
    return pd.DataFrame({"macd": macd_line, "macd_signal": signal_line, "macd_hist": histogram}, index=df.index)

_register("MACD", "Momentum",
    "Moving Average Convergence Divergence — trend-following momentum",
    [{"name": "fast", "default": 12, "type": "int", "desc": "Fast EMA period"},
     {"name": "slow", "default": 26, "type": "int", "desc": "Slow EMA period"},
     {"name": "signal", "default": 9, "type": "int", "desc": "Signal EMA period"}],
    ["macd", "macd_signal", "macd_hist"], _calc_macd)


# ── 3. Bollinger Bands ──
def _calc_bbands(df, period=20, std=2.0):
    c = df["Close"]
    mid = _sma(c, period)
    sd = c.rolling(period).std()
    return pd.DataFrame({
        "bb_upper": mid + std * sd, "bb_mid": mid, "bb_lower": mid - std * sd,
        "bb_pct_b": (c - (mid - std * sd)) / (2 * std * sd).replace(0, np.nan),
    }, index=df.index)

_register("Bollinger Bands", "Volatility",
    "Bollinger Bands — volatility envelope around SMA",
    [{"name": "period", "default": 20, "type": "int", "desc": "MA period"},
     {"name": "std", "default": 2.0, "type": "float", "desc": "Standard deviation multiplier"}],
    ["bb_upper", "bb_mid", "bb_lower", "bb_pct_b"], _calc_bbands)


# ── 4. EMA ──
def _calc_ema_ind(df, period=20):
    return pd.DataFrame({"ema": _ema(df["Close"], period)}, index=df.index)

_register("EMA", "Trend",
    "Exponential Moving Average — weighted toward recent prices",
    [{"name": "period", "default": 20, "type": "int", "desc": "EMA period"}],
    ["ema"], _calc_ema_ind)


# ── 5. SMA ──
def _calc_sma_ind(df, period=20):
    return pd.DataFrame({"sma": _sma(df["Close"], period)}, index=df.index)

_register("SMA", "Trend",
    "Simple Moving Average — equal-weighted average of prices",
    [{"name": "period", "default": 20, "type": "int", "desc": "SMA period"}],
    ["sma"], _calc_sma_ind)


# ── 6. Stochastic ──
def _calc_stoch(df, k_period=14, d_period=3, smooth=3):
    low_min = df["Low"].rolling(k_period).min()
    high_max = df["High"].rolling(k_period).max()
    raw_k = 100 * (df["Close"] - low_min) / (high_max - low_min).replace(0, np.nan)
    k = raw_k.rolling(smooth).mean()
    d = k.rolling(d_period).mean()
    return pd.DataFrame({"stoch_k": k, "stoch_d": d}, index=df.index)

_register("Stochastic", "Momentum",
    "Stochastic Oscillator — momentum indicator comparing close to range",
    [{"name": "k_period", "default": 14, "type": "int", "desc": "%K period"},
     {"name": "d_period", "default": 3, "type": "int", "desc": "%D period"},
     {"name": "smooth", "default": 3, "type": "int", "desc": "Smoothing factor"}],
    ["stoch_k", "stoch_d"], _calc_stoch)


# ── 7. ATR ──
def _calc_atr(df, period=14):
    tr = _true_range(df["High"], df["Low"], df["Close"])
    atr = _rma(tr, period)
    return pd.DataFrame({"atr": atr}, index=df.index)

_register("ATR", "Volatility",
    "Average True Range — measures volatility magnitude",
    [{"name": "period", "default": 14, "type": "int", "desc": "ATR period"}],
    ["atr"], _calc_atr)


# ── 8. ADX ──
def _calc_adx(df, period=14):
    h, l, c = df["High"], df["Low"], df["Close"]
    up = h - h.shift(1)
    dn = l.shift(1) - l
    plus_dm = pd.Series(np.where((up > dn) & (up > 0), up, 0.0), index=df.index)
    minus_dm = pd.Series(np.where((dn > up) & (dn > 0), dn, 0.0), index=df.index)
    atr = _rma(_true_range(h, l, c), period)
    plus_di = 100 * _rma(plus_dm, period) / atr.replace(0, np.nan)
    minus_di = 100 * _rma(minus_dm, period) / atr.replace(0, np.nan)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    adx = _rma(dx, period)
    return pd.DataFrame({"adx": adx, "plus_di": plus_di, "minus_di": minus_di}, index=df.index)

_register("ADX", "Trend",
    "Average Directional Index — measures trend strength (not direction)",
    [{"name": "period", "default": 14, "type": "int", "desc": "ADX period"}],
    ["adx", "plus_di", "minus_di"], _calc_adx)


# ── 9. VWAP ──
def _calc_vwap(df):
    tp = (df["High"] + df["Low"] + df["Close"]) / 3
    cum_vol = df["Volume"].cumsum()
    cum_tp_vol = (tp * df["Volume"]).cumsum()
    vwap = cum_tp_vol / cum_vol.replace(0, np.nan)
    return pd.DataFrame({"vwap": vwap}, index=df.index)

_register("VWAP", "Volume",
    "Volume Weighted Average Price — institutional fair value benchmark",
    [], ["vwap"], _calc_vwap)


# ── 10. OBV ──
def _calc_obv(df):
    sign = np.sign(df["Close"].diff())
    obv = (sign * df["Volume"]).cumsum()
    return pd.DataFrame({"obv": obv}, index=df.index)

_register("OBV", "Volume",
    "On-Balance Volume — cumulative buying/selling pressure",
    [], ["obv"], _calc_obv)


# ── 11. CCI ──
def _calc_cci(df, period=20):
    tp = (df["High"] + df["Low"] + df["Close"]) / 3
    sma_tp = _sma(tp, period)
    mad = tp.rolling(period).apply(lambda x: np.mean(np.abs(x - np.mean(x))), raw=True)
    cci = (tp - sma_tp) / (0.015 * mad).replace(0, np.nan)
    return pd.DataFrame({"cci": cci}, index=df.index)

_register("CCI", "Momentum",
    "Commodity Channel Index — identifies cyclical turns",
    [{"name": "period", "default": 20, "type": "int", "desc": "CCI period"}],
    ["cci"], _calc_cci)


# ── 12. Williams %R ──
def _calc_willr(df, period=14):
    hh = df["High"].rolling(period).max()
    ll = df["Low"].rolling(period).min()
    willr = -100 * (hh - df["Close"]) / (hh - ll).replace(0, np.nan)
    return pd.DataFrame({"willr": willr}, index=df.index)

_register("Williams %R", "Momentum",
    "Williams %R — similar to Stochastic but inverted scale (-100 to 0)",
    [{"name": "period", "default": 14, "type": "int", "desc": "Lookback period"}],
    ["willr"], _calc_willr)


# ── 13. Ichimoku Cloud ──
def _calc_ichimoku(df, tenkan=9, kijun=26, senkou_b=52):
    h, l = df["High"], df["Low"]
    tenkan_sen = (h.rolling(tenkan).max() + l.rolling(tenkan).min()) / 2
    kijun_sen = (h.rolling(kijun).max() + l.rolling(kijun).min()) / 2
    senkou_a = ((tenkan_sen + kijun_sen) / 2).shift(kijun)
    senkou_b_val = ((h.rolling(senkou_b).max() + l.rolling(senkou_b).min()) / 2).shift(kijun)
    chikou = df["Close"].shift(-kijun)
    return pd.DataFrame({
        "ichi_tenkan": tenkan_sen, "ichi_kijun": kijun_sen,
        "ichi_senkou_a": senkou_a, "ichi_senkou_b": senkou_b_val,
        "ichi_chikou": chikou,
    }, index=df.index)

_register("Ichimoku", "Trend",
    "Ichimoku Cloud — comprehensive trend/support/resistance system",
    [{"name": "tenkan", "default": 9, "type": "int", "desc": "Tenkan-sen (conversion) period"},
     {"name": "kijun", "default": 26, "type": "int", "desc": "Kijun-sen (base) period"},
     {"name": "senkou_b", "default": 52, "type": "int", "desc": "Senkou Span B period"}],
    ["ichi_tenkan", "ichi_kijun", "ichi_senkou_a", "ichi_senkou_b", "ichi_chikou"], _calc_ichimoku)


# ── 14. Supertrend ──
def _calc_supertrend(df, period=10, multiplier=3.0):
    h, l, c = df["High"], df["Low"], df["Close"]
    atr = _rma(_true_range(h, l, c), period)
    hl2 = (h + l) / 2
    upper = hl2 + multiplier * atr
    lower = hl2 - multiplier * atr

    st = pd.Series(0.0, index=df.index)
    direction = pd.Series(1, index=df.index)  # 1=up, -1=down

    final_upper = upper.copy()
    final_lower = lower.copy()

    for i in range(1, len(df)):
        # Adjust bands
        if lower.iloc[i] > final_lower.iloc[i - 1] or c.iloc[i - 1] < final_lower.iloc[i - 1]:
            final_lower.iloc[i] = lower.iloc[i]
        else:
            final_lower.iloc[i] = final_lower.iloc[i - 1]

        if upper.iloc[i] < final_upper.iloc[i - 1] or c.iloc[i - 1] > final_upper.iloc[i - 1]:
            final_upper.iloc[i] = upper.iloc[i]
        else:
            final_upper.iloc[i] = final_upper.iloc[i - 1]

        if direction.iloc[i - 1] == -1 and c.iloc[i] > final_upper.iloc[i - 1]:
            direction.iloc[i] = 1
        elif direction.iloc[i - 1] == 1 and c.iloc[i] < final_lower.iloc[i - 1]:
            direction.iloc[i] = -1
        else:
            direction.iloc[i] = direction.iloc[i - 1]

        st.iloc[i] = final_lower.iloc[i] if direction.iloc[i] == 1 else final_upper.iloc[i]

    return pd.DataFrame({"supertrend": st, "supertrend_dir": direction}, index=df.index)

_register("Supertrend", "Trend",
    "Supertrend — ATR-based trailing stop that flips direction",
    [{"name": "period", "default": 10, "type": "int", "desc": "ATR period"},
     {"name": "multiplier", "default": 3.0, "type": "float", "desc": "ATR multiplier"}],
    ["supertrend", "supertrend_dir"], _calc_supertrend)


# ── 15. Parabolic SAR ──
def _calc_psar(df, af_start=0.02, af_max=0.2):
    h, l, c = df["High"].values, df["Low"].values, df["Close"].values
    n = len(df)
    psar = np.zeros(n)
    direction = np.ones(n)  # 1=long, -1=short
    af = af_start
    ep = l[0]
    psar[0] = h[0]

    for i in range(1, n):
        prev_psar = psar[i - 1]

        if direction[i - 1] == 1:
            psar[i] = prev_psar + af * (ep - prev_psar)
            psar[i] = min(psar[i], l[i - 1])
            if i >= 2:
                psar[i] = min(psar[i], l[i - 2])

            if l[i] < psar[i]:
                direction[i] = -1
                psar[i] = ep
                ep = l[i]
                af = af_start
            else:
                direction[i] = 1
                if h[i] > ep:
                    ep = h[i]
                    af = min(af + af_start, af_max)
        else:
            psar[i] = prev_psar + af * (ep - prev_psar)
            psar[i] = max(psar[i], h[i - 1])
            if i >= 2:
                psar[i] = max(psar[i], h[i - 2])

            if h[i] > psar[i]:
                direction[i] = 1
                psar[i] = ep
                ep = h[i]
                af = af_start
            else:
                direction[i] = -1
                if l[i] < ep:
                    ep = l[i]
                    af = min(af + af_start, af_max)

    return pd.DataFrame({
        "psar": psar, "psar_dir": direction,
    }, index=df.index)

_register("Parabolic SAR", "Trend",
    "Parabolic Stop and Reverse — trailing stop that accelerates with trend",
    [{"name": "af_start", "default": 0.02, "type": "float", "desc": "Acceleration factor start"},
     {"name": "af_max", "default": 0.2, "type": "float", "desc": "Max acceleration factor"}],
    ["psar", "psar_dir"], _calc_psar)


# ═══════════════════════════════════════════════════════════════
#  PUBLIC API: compute_indicator
# ═══════════════════════════════════════════════════════════════

def compute_indicator(df: pd.DataFrame, name: str, params: dict | None = None) -> pd.DataFrame:
    """Compute a named indicator on OHLCV data. Returns DataFrame of output columns."""
    if name not in INDICATORS:
        raise ValueError(f"Unknown indicator '{name}'. Available: {list(INDICATORS.keys())}")

    ind = INDICATORS[name]
    # Build kwargs from defaults + overrides
    kwargs = {}
    for p in ind["params"]:
        val = (params or {}).get(p["name"], p["default"])
        kwargs[p["name"]] = int(val) if p["type"] == "int" else float(val)

    return ind["fn"](df, **kwargs)


def get_indicator_catalog() -> list[dict]:
    """Return list of all indicators with metadata (for API response)."""
    return [
        {
            "name": v["name"],
            "category": v["category"],
            "description": v["description"],
            "params": v["params"],
            "outputs": v["outputs"],
        }
        for v in INDICATORS.values()
    ]


# ═══════════════════════════════════════════════════════════════
#  CONDITION EVALUATOR (for visual strategy builder)
# ═══════════════════════════════════════════════════════════════

# Supported operators
OPS = {
    ">":  lambda a, b: a > b,
    "<":  lambda a, b: a < b,
    ">=": lambda a, b: a >= b,
    "<=": lambda a, b: a <= b,
    "==": lambda a, b: a == b,
    "crosses_above": lambda a, b: (a > b) & (a.shift(1) <= b.shift(1)),
    "crosses_below": lambda a, b: (a < b) & (a.shift(1) >= b.shift(1)),
}


def _resolve_operand(df: pd.DataFrame, computed: dict, operand: dict) -> pd.Series:
    """
    Resolve an operand to a Series.
    operand formats:
        {"type": "indicator", "name": "RSI", "output": "rsi", "params": {"period": 14}}
        {"type": "price", "field": "Close"}
        {"type": "constant", "value": 30}
    """
    t = operand.get("type", "constant")

    if t == "indicator":
        ind_name = operand["name"]
        params = operand.get("params", {})
        key = f"{ind_name}|{str(sorted(params.items()))}"

        if key not in computed:
            computed[key] = compute_indicator(df, ind_name, params)

        return computed[key][operand.get("output", INDICATORS[ind_name]["outputs"][0])]

    elif t == "price":
        field = operand.get("field", "Close")
        return df[field]

    elif t == "constant":
        return pd.Series(float(operand["value"]), index=df.index)

    raise ValueError(f"Unknown operand type: {t}")


def evaluate_conditions(
    df: pd.DataFrame,
    conditions: list[dict],
    logic: str = "AND",
) -> pd.Series:
    """
    Evaluate a list of conditions against OHLCV + indicator data.

    Each condition: {
        "left": operand_dict,
        "op": ">", "<", ">=", "<=", "==", "crosses_above", "crosses_below",
        "right": operand_dict,
    }

    logic: "AND" (all must be true) or "OR" (any true)
    Returns pd.Series of bool.
    """
    if not conditions:
        return pd.Series(False, index=df.index)

    computed = {}  # memoize indicator computations
    results = []

    for cond in conditions:
        left = _resolve_operand(df, computed, cond["left"])
        right = _resolve_operand(df, computed, cond["right"])
        op_fn = OPS.get(cond.get("op", ">"))
        if op_fn is None:
            raise ValueError(f"Unknown operator: {cond.get('op')}")
        results.append(op_fn(left, right))

    if logic == "OR":
        combined = results[0]
        for r in results[1:]:
            combined = combined | r
    else:  # AND
        combined = results[0]
        for r in results[1:]:
            combined = combined & r

    return combined.fillna(False)


# ═══════════════════════════════════════════════════════════════
#  STRATEGY BACKTEST ENGINE
# ═══════════════════════════════════════════════════════════════

def run_strategy_backtest(
    df: pd.DataFrame,
    entry_conditions: list[dict],
    exit_conditions: list[dict],
    entry_logic: str = "AND",
    exit_logic: str = "OR",
    direction: str = "long",           # "long", "short", "both"
    initial_capital: float = 100000.0,
    position_size_pct: float = 10.0,   # % of equity per trade
    stop_loss_pct: float | None = None,
    take_profit_pct: float | None = None,
    max_holding_days: int | None = None,
    cancel_event: threading.Event | None = None,
) -> dict:
    """
    Run a full strategy backtest with entry/exit conditions.

    Returns dict with summary, trades, equity_curve, drawdown, monthly_returns.
    """
    t0 = time.time()

    entries = evaluate_conditions(df, entry_conditions, entry_logic)
    exits = evaluate_conditions(df, exit_conditions, exit_logic)

    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    dates = df.index

    equity = initial_capital
    trades = []
    equity_curve = []
    in_trade = False
    trade_entry = None

    for i in range(len(df)):
        if cancel_event and cancel_event.is_set():
            break

        equity_curve.append({"date": dates[i].strftime("%Y-%m-%d"), "equity": round(float(equity), 2)})

        if in_trade:
            # Check exit conditions
            pnl_pct = (close.iloc[i] - trade_entry["price"]) / trade_entry["price"]
            if trade_entry["dir"] == "short":
                pnl_pct = -pnl_pct

            should_exit = False
            exit_reason = ""

            # Stop loss
            if stop_loss_pct and pnl_pct <= -(stop_loss_pct / 100):
                should_exit = True
                exit_reason = "Stop Loss"
            # Take profit
            elif take_profit_pct and pnl_pct >= (take_profit_pct / 100):
                should_exit = True
                exit_reason = "Take Profit"
            # Max holding
            elif max_holding_days and (i - trade_entry["idx"]) >= max_holding_days:
                should_exit = True
                exit_reason = "Max Holding"
            # Signal exit
            elif exits.iloc[i]:
                should_exit = True
                exit_reason = "Signal"

            if should_exit:
                shares = trade_entry["shares"]
                pnl = shares * (close.iloc[i] - trade_entry["price"])
                if trade_entry["dir"] == "short":
                    pnl = -pnl
                equity += pnl

                trades.append({
                    "entry_date": trade_entry["date"],
                    "exit_date": dates[i].strftime("%Y-%m-%d"),
                    "direction": trade_entry["dir"].upper(),
                    "entry_price": round(float(trade_entry["price"]), 2),
                    "exit_price": round(float(close.iloc[i]), 2),
                    "shares": shares,
                    "pnl": round(float(pnl), 2),
                    "return_pct": round(float(pnl_pct * 100), 2),
                    "exit_reason": exit_reason,
                    "holding_days": i - trade_entry["idx"],
                })
                in_trade = False
                trade_entry = None

        elif entries.iloc[i]:
            # Enter trade
            pos_value = equity * (position_size_pct / 100)
            shares = int(pos_value / close.iloc[i]) if close.iloc[i] > 0 else 0

            if shares > 0:
                trade_dir = "long"
                if direction == "short":
                    trade_dir = "short"
                elif direction == "both":
                    # Simple heuristic: use indicator direction
                    trade_dir = "long"

                trade_entry = {
                    "price": float(close.iloc[i]),
                    "shares": shares,
                    "date": dates[i].strftime("%Y-%m-%d"),
                    "idx": i,
                    "dir": trade_dir,
                }
                in_trade = True

    # Close any open trade at end
    if in_trade and trade_entry:
        pnl_pct = (close.iloc[-1] - trade_entry["price"]) / trade_entry["price"]
        if trade_entry["dir"] == "short":
            pnl_pct = -pnl_pct
        pnl = trade_entry["shares"] * (close.iloc[-1] - trade_entry["price"])
        if trade_entry["dir"] == "short":
            pnl = -pnl
        equity += pnl
        trades.append({
            "entry_date": trade_entry["date"],
            "exit_date": dates[-1].strftime("%Y-%m-%d"),
            "direction": trade_entry["dir"].upper(),
            "entry_price": round(float(trade_entry["price"]), 2),
            "exit_price": round(float(close.iloc[-1]), 2),
            "shares": trade_entry["shares"],
            "pnl": round(float(pnl), 2),
            "return_pct": round(float(pnl_pct * 100), 2),
            "exit_reason": "End of Data",
            "holding_days": len(df) - 1 - trade_entry["idx"],
        })

    # Compute metrics
    summary = _compute_strategy_metrics(trades, equity_curve, initial_capital)
    summary["initial_capital"] = initial_capital
    summary["final_equity"] = round(float(equity), 2)
    summary["elapsed_ms"] = round((time.time() - t0) * 1000, 1)

    # Drawdown series
    eq_values = [e["equity"] for e in equity_curve]
    peak = np.maximum.accumulate(eq_values)
    dd = [(eq_values[i] - peak[i]) / peak[i] * 100 if peak[i] > 0 else 0 for i in range(len(eq_values))]
    drawdown_series = [{"date": equity_curve[i]["date"], "drawdown": round(dd[i], 2)} for i in range(0, len(dd), max(1, len(dd) // 200))]

    # Monthly returns
    monthly = _compute_monthly_returns(trades)

    return {
        "summary": summary,
        "trades": trades,
        "equity_curve": equity_curve[::max(1, len(equity_curve) // 200)],
        "drawdown": drawdown_series,
        "monthly_returns": monthly,
    }


def _compute_strategy_metrics(trades, equity_curve, initial_capital):
    """Compute TradingView-style strategy report metrics."""
    if not trades:
        return {
            "total_trades": 0, "win_rate": 0, "profit_factor": 0,
            "total_return_pct": 0, "annualised_return": 0,
            "sharpe_ratio": 0, "sortino_ratio": 0,
            "max_drawdown": 0, "max_drawdown_pct": 0, "max_peak_profit": 0,
            "avg_trade": 0, "best_trade": 0, "worst_trade": 0,
            "max_consec_wins": 0, "max_consec_losses": 0,
            "avg_holding_days": 0, "total_return": 0,
        }

    pnls = [t["pnl"] for t in trades]
    returns = [t["return_pct"] for t in trades]

    winners = [p for p in pnls if p > 0]
    losers = [p for p in pnls if p < 0]

    # Equity curve metrics
    eq = [e["equity"] for e in equity_curve]
    peak = np.maximum.accumulate(eq)
    drawdowns = [(eq[i] - peak[i]) for i in range(len(eq))]
    max_dd = min(drawdowns) if drawdowns else 0
    max_dd_pct = (max_dd / max(peak)) * 100 if max(peak) > 0 else 0
    max_peak_profit = max(eq) - initial_capital

    # Consecutive wins/losses
    max_consec_w, max_consec_l = 0, 0
    cur_w, cur_l = 0, 0
    for p in pnls:
        if p > 0:
            cur_w += 1; cur_l = 0
            max_consec_w = max(max_consec_w, cur_w)
        elif p < 0:
            cur_l += 1; cur_w = 0
            max_consec_l = max(max_consec_l, cur_l)
        else:
            cur_w = cur_l = 0

    # Sharpe / Sortino
    if len(returns) > 1:
        ret_arr = np.array(returns)
        sharpe = float(np.mean(ret_arr) / np.std(ret_arr)) if np.std(ret_arr) > 0 else 0
        downside = ret_arr[ret_arr < 0]
        sortino = float(np.mean(ret_arr) / np.std(downside)) if len(downside) > 0 and np.std(downside) > 0 else 0
    else:
        sharpe = sortino = 0

    # Days
    n_days = len(equity_curve)
    total_ret = (eq[-1] - initial_capital) / initial_capital * 100 if eq else 0
    ann_ret = total_ret * (252 / n_days) if n_days > 0 else 0

    return {
        "total_trades": len(trades),
        "win_rate": round(len(winners) / len(trades) * 100, 1) if trades else 0,
        "profit_factor": round(sum(winners) / abs(sum(losers)), 2) if losers and sum(losers) != 0 else (999.0 if winners else 0),
        "total_return": round(float(eq[-1] - initial_capital), 2) if eq else 0,
        "total_return_pct": round(float(total_ret), 2),
        "annualised_return": round(float(ann_ret), 2),
        "sharpe_ratio": round(float(sharpe), 2),
        "sortino_ratio": round(float(sortino), 2),
        "max_drawdown": round(float(max_dd), 2),
        "max_drawdown_pct": round(float(max_dd_pct), 2),
        "max_peak_profit": round(float(max_peak_profit), 2),
        "avg_trade": round(float(np.mean(pnls)), 2),
        "best_trade": round(float(max(pnls)), 2),
        "worst_trade": round(float(min(pnls)), 2),
        "max_consec_wins": max_consec_w,
        "max_consec_losses": max_consec_l,
        "avg_holding_days": round(float(np.mean([t["holding_days"] for t in trades])), 1),
    }


def _compute_monthly_returns(trades):
    """Compute monthly P&L aggregated by year-month."""
    monthly = {}
    for t in trades:
        d = t["exit_date"][:7]  # YYYY-MM
        monthly[d] = monthly.get(d, 0) + t["pnl"]
    return [{"month": k, "pnl": round(v, 2)} for k, v in sorted(monthly.items())]


# ═══════════════════════════════════════════════════════════════
#  CODE EXECUTION SANDBOX
# ═══════════════════════════════════════════════════════════════

class _IndicatorHelper:
    """Helper class exposed as `ind` in user code — shortcut for indicator calls."""

    def __init__(self, df):
        self._df = df

    def rsi(self, period=14): return compute_indicator(self._df, "RSI", {"period": period})["rsi"]
    def macd(self, fast=12, slow=26, signal=9): return compute_indicator(self._df, "MACD", {"fast": fast, "slow": slow, "signal": signal})
    def bbands(self, period=20, std=2): return compute_indicator(self._df, "Bollinger Bands", {"period": period, "std": std})
    def ema(self, period=20): return compute_indicator(self._df, "EMA", {"period": period})["ema"]
    def sma(self, period=20): return compute_indicator(self._df, "SMA", {"period": period})["sma"]
    def stoch(self, k=14, d=3, smooth=3): return compute_indicator(self._df, "Stochastic", {"k_period": k, "d_period": d, "smooth": smooth})
    def atr(self, period=14): return compute_indicator(self._df, "ATR", {"period": period})["atr"]
    def adx(self, period=14): return compute_indicator(self._df, "ADX", {"period": period})
    def vwap(self): return compute_indicator(self._df, "VWAP")["vwap"]
    def obv(self): return compute_indicator(self._df, "OBV")["obv"]
    def cci(self, period=20): return compute_indicator(self._df, "CCI", {"period": period})["cci"]
    def willr(self, period=14): return compute_indicator(self._df, "Williams %R", {"period": period})["willr"]
    def ichimoku(self, t=9, k=26, s=52): return compute_indicator(self._df, "Ichimoku", {"tenkan": t, "kijun": k, "senkou_b": s})
    def supertrend(self, period=10, mult=3): return compute_indicator(self._df, "Supertrend", {"period": period, "multiplier": mult})
    def psar(self, af=0.02, max_af=0.2): return compute_indicator(self._df, "Parabolic SAR", {"af_start": af, "af_max": max_af})


def run_code_strategy(
    df: pd.DataFrame,
    code: str,
    initial_capital: float = 100000.0,
    position_size_pct: float = 10.0,
    stop_loss_pct: float | None = None,
    take_profit_pct: float | None = None,
    max_holding_days: int | None = None,
    cancel_event: threading.Event | None = None,
) -> dict:
    """
    Execute user Python code to generate entry/exit signals, then run backtest.

    User code must set `entries` and `exits` (pd.Series of bool).
    Available in namespace: df, ind (IndicatorHelper), pd, np.
    """
    ind = _IndicatorHelper(df)

    # Sandboxed namespace
    ns = {
        "df": df,
        "ind": ind,
        "pd": pd,
        "np": np,
        "entries": pd.Series(False, index=df.index),
        "exits": pd.Series(False, index=df.index),
    }

    # Block dangerous builtins
    safe_builtins = {
        "abs": abs, "min": min, "max": max, "round": round,
        "len": len, "range": range, "int": int, "float": float,
        "bool": bool, "str": str, "list": list, "dict": dict,
        "True": True, "False": False, "None": None,
        "print": print, "sum": sum, "zip": zip, "enumerate": enumerate,
    }

    try:
        exec(compile(code, "<strategy>", "exec"), {"__builtins__": safe_builtins}, ns)
    except Exception as e:
        return {"error": f"Code error: {type(e).__name__}: {str(e)}", "traceback": traceback.format_exc()}

    entries = ns.get("entries", pd.Series(False, index=df.index))
    exits = ns.get("exits", pd.Series(False, index=df.index))

    if not isinstance(entries, pd.Series):
        entries = pd.Series(entries, index=df.index)
    if not isinstance(exits, pd.Series):
        exits = pd.Series(exits, index=df.index)

    # Run backtest using resolved signals
    t0 = time.time()
    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    dates = df.index

    equity_val = initial_capital
    trade_list = []
    eq_curve = []
    in_trade = False
    te = None

    for i in range(len(df)):
        if cancel_event and cancel_event.is_set():
            break

        eq_curve.append({"date": dates[i].strftime("%Y-%m-%d"), "equity": round(float(equity_val), 2)})

        if in_trade:
            pnl_pct = (close.iloc[i] - te["price"]) / te["price"]
            should_exit = False
            reason = ""

            if stop_loss_pct and pnl_pct <= -(stop_loss_pct / 100):
                should_exit, reason = True, "Stop Loss"
            elif take_profit_pct and pnl_pct >= (take_profit_pct / 100):
                should_exit, reason = True, "Take Profit"
            elif max_holding_days and (i - te["idx"]) >= max_holding_days:
                should_exit, reason = True, "Max Holding"
            elif bool(exits.iloc[i]):
                should_exit, reason = True, "Signal"

            if should_exit:
                pnl = te["shares"] * (close.iloc[i] - te["price"])
                equity_val += pnl
                trade_list.append({
                    "entry_date": te["date"], "exit_date": dates[i].strftime("%Y-%m-%d"),
                    "direction": "LONG", "entry_price": round(float(te["price"]), 2),
                    "exit_price": round(float(close.iloc[i]), 2), "shares": te["shares"],
                    "pnl": round(float(pnl), 2), "return_pct": round(float(pnl_pct * 100), 2),
                    "exit_reason": reason, "holding_days": i - te["idx"],
                })
                in_trade, te = False, None

        elif bool(entries.iloc[i]) if not pd.isna(entries.iloc[i]) else False:
            pv = equity_val * (position_size_pct / 100)
            sh = int(pv / close.iloc[i]) if close.iloc[i] > 0 else 0
            if sh > 0:
                te = {"price": float(close.iloc[i]), "shares": sh, "date": dates[i].strftime("%Y-%m-%d"), "idx": i}
                in_trade = True

    # Close open trade
    if in_trade and te:
        pnl = te["shares"] * (close.iloc[-1] - te["price"])
        equity_val += pnl
        trade_list.append({
            "entry_date": te["date"], "exit_date": dates[-1].strftime("%Y-%m-%d"),
            "direction": "LONG", "entry_price": round(float(te["price"]), 2),
            "exit_price": round(float(close.iloc[-1]), 2), "shares": te["shares"],
            "pnl": round(float(pnl), 2),
            "return_pct": round(float((close.iloc[-1] - te["price"]) / te["price"] * 100), 2),
            "exit_reason": "End of Data", "holding_days": len(df) - 1 - te["idx"],
        })

    summary = _compute_strategy_metrics(trade_list, eq_curve, initial_capital)
    summary["initial_capital"] = initial_capital
    summary["final_equity"] = round(float(equity_val), 2)
    summary["elapsed_ms"] = round((time.time() - t0) * 1000, 1)

    eq_vals = [e["equity"] for e in eq_curve]
    pk = np.maximum.accumulate(eq_vals)
    dd = [(eq_vals[i] - pk[i]) / pk[i] * 100 if pk[i] > 0 else 0 for i in range(len(eq_vals))]
    dd_series = [{"date": eq_curve[i]["date"], "drawdown": round(dd[i], 2)} for i in range(0, len(dd), max(1, len(dd) // 200))]

    return {
        "summary": summary,
        "trades": trade_list,
        "equity_curve": eq_curve[::max(1, len(eq_curve) // 200)],
        "drawdown": dd_series,
        "monthly_returns": _compute_monthly_returns(trade_list),
    }


# ═══════════════════════════════════════════════════════════════
#  STRATEGY COMPARISON
# ═══════════════════════════════════════════════════════════════

def compare_strategies(results: list[dict]) -> dict:
    """Compare multiple strategy results side-by-side."""
    comparison = []
    for r in results:
        s = r.get("summary", {})
        comparison.append({
            "name": r.get("name", "Strategy"),
            "total_return_pct": s.get("total_return_pct", 0),
            "annualised_return": s.get("annualised_return", 0),
            "sharpe_ratio": s.get("sharpe_ratio", 0),
            "sortino_ratio": s.get("sortino_ratio", 0),
            "max_drawdown_pct": s.get("max_drawdown_pct", 0),
            "win_rate": s.get("win_rate", 0),
            "profit_factor": s.get("profit_factor", 0),
            "total_trades": s.get("total_trades", 0),
            "max_consec_wins": s.get("max_consec_wins", 0),
            "max_consec_losses": s.get("max_consec_losses", 0),
        })
    return {"comparison": comparison}
