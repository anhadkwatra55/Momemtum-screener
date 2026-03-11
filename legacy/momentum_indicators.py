"""
momentum_indicators.py — Four Technical Indicator Systems
==========================================================
All indicators implemented from scratch (no TA-Lib dependency).

System 1: ADX + TRIX + Full Stochastics
System 2: Elder Impulse System (Daily)
System 3: Renko Chart + Full Stochastics
System 4: Heikin-Ashi Chart + Hull Moving Average
"""

from __future__ import annotations

import math
import warnings

import numpy as np
import pandas as pd

import momentum_config as cfg

warnings.filterwarnings("ignore")


# ═══════════════════════════════════════════════════════════
#  HELPER: Weighted Moving Average
# ═══════════════════════════════════════════════════════════

def _wma(series: pd.Series, period: int) -> pd.Series:
    """Weighted Moving Average — linearly weighted."""
    weights = np.arange(1, period + 1, dtype=float)
    return series.rolling(period).apply(
        lambda x: np.dot(x, weights) / weights.sum(), raw=True
    )


def _ema(series: pd.Series, period: int) -> pd.Series:
    """Exponential Moving Average."""
    return series.ewm(span=period, adjust=False).mean()


def _rma(series: pd.Series, period: int) -> pd.Series:
    """Wilder's smoothed moving average (RMA / SMMA)."""
    return series.ewm(alpha=1.0 / period, adjust=False).mean()


def _true_range(high: pd.Series, low: pd.Series, close: pd.Series) -> pd.Series:
    """True Range = max(H-L, |H-prevC|, |L-prevC|)."""
    prev_c = close.shift(1)
    return pd.concat([
        high - low,
        (high - prev_c).abs(),
        (low - prev_c).abs(),
    ], axis=1).max(axis=1)


def _atr(high: pd.Series, low: pd.Series, close: pd.Series,
         period: int = 14) -> pd.Series:
    """Average True Range using Wilder smoothing."""
    tr = _true_range(high, low, close)
    return _rma(tr, period)


# ═══════════════════════════════════════════════════════════
#  SYSTEM 1 — ADX + TRIX + Full Stochastics
# ═══════════════════════════════════════════════════════════

def compute_adx(
    df: pd.DataFrame,
    period: int = cfg.ADX_PERIOD,
) -> pd.DataFrame:
    """
    Average Directional Index (Welles Wilder).

    Returns DataFrame with: ADX, Plus_DI, Minus_DI
    """
    high, low, close = df["High"], df["Low"], df["Close"]

    up_move = high - high.shift(1)
    down_move = low.shift(1) - low

    plus_dm = pd.Series(np.where((up_move > down_move) & (up_move > 0), up_move, 0.0),
                        index=df.index)
    minus_dm = pd.Series(np.where((down_move > up_move) & (down_move > 0), down_move, 0.0),
                         index=df.index)

    atr = _rma(_true_range(high, low, close), period)
    plus_di = 100 * _rma(plus_dm, period) / atr.replace(0, np.nan)
    minus_di = 100 * _rma(minus_dm, period) / atr.replace(0, np.nan)

    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    adx = _rma(dx, period)

    return pd.DataFrame({
        "ADX": adx,
        "Plus_DI": plus_di,
        "Minus_DI": minus_di,
    }, index=df.index)


def compute_trix(
    close: pd.Series,
    period: int = cfg.TRIX_PERIOD,
    signal_period: int = cfg.TRIX_SIGNAL,
) -> pd.DataFrame:
    """
    TRIX — Triple Exponential Average rate-of-change.

    Returns DataFrame with: TRIX, TRIX_Signal
    """
    ema1 = _ema(close, period)
    ema2 = _ema(ema1, period)
    ema3 = _ema(ema2, period)
    trix = 10000 * (ema3 - ema3.shift(1)) / ema3.shift(1).replace(0, np.nan)
    signal = _ema(trix, signal_period)

    return pd.DataFrame({
        "TRIX": trix,
        "TRIX_Signal": signal,
    }, index=close.index)


def compute_full_stochastics(
    df: pd.DataFrame,
    k_period: int = cfg.STOCH_K,
    d_period: int = cfg.STOCH_D,
    smooth: int = cfg.STOCH_SMOOTH,
) -> pd.DataFrame:
    """
    Full Stochastic Oscillator (%K smoothed, %D).

    Full Stoch differs from Fast/Slow by applying an extra smoothing
    to the raw %K before computing %D.

    Returns DataFrame with: Stoch_K, Stoch_D
    """
    low_min = df["Low"].rolling(k_period).min()
    high_max = df["High"].rolling(k_period).max()

    raw_k = 100 * (df["Close"] - low_min) / (high_max - low_min).replace(0, np.nan)
    k = raw_k.rolling(smooth).mean()       # smoothed %K (Full Stochastic)
    d = k.rolling(d_period).mean()          # %D = SMA of smoothed %K

    return pd.DataFrame({
        "Stoch_K": k,
        "Stoch_D": d,
    }, index=df.index)


def score_system1(df: pd.DataFrame) -> dict:
    """
    Score System 1 (ADX + TRIX + Stochastics) → −2 to +2.

    Logic:
        ADX tells IF there's a trend.
        TRIX tells direction & momentum.
        Stochastics tells if timing is favorable.
    """
    adx_df = compute_adx(df)
    trix_df = compute_trix(df["Close"])
    stoch_df = compute_full_stochastics(df)

    last = len(df) - 1
    adx = adx_df["ADX"].iloc[last]
    plus_di = adx_df["Plus_DI"].iloc[last]
    minus_di = adx_df["Minus_DI"].iloc[last]
    trix = trix_df["TRIX"].iloc[last]
    trix_sig = trix_df["TRIX_Signal"].iloc[last]
    trix_prev = trix_df["TRIX"].iloc[last - 1] if last > 0 else trix
    stoch_k = stoch_df["Stoch_K"].iloc[last]
    stoch_d = stoch_df["Stoch_D"].iloc[last]

    score = 0.0

    # ADX component: is there a trend?
    has_trend = adx > cfg.ADX_WEAK_TREND if not np.isnan(adx) else False
    strong_trend = adx > cfg.ADX_STRONG_TREND if not np.isnan(adx) else False

    # TRIX direction
    trix_bullish = (not np.isnan(trix)) and trix > 0 and trix > trix_prev
    trix_bearish = (not np.isnan(trix)) and trix < 0 and trix < trix_prev
    trix_cross_up = (not np.isnan(trix)) and trix > trix_sig and trix_prev <= trix_sig if not np.isnan(trix_sig) else False
    trix_cross_dn = (not np.isnan(trix)) and trix < trix_sig and trix_prev >= trix_sig if not np.isnan(trix_sig) else False

    # DI direction
    di_bullish = (not np.isnan(plus_di)) and plus_di > minus_di
    di_bearish = (not np.isnan(minus_di)) and minus_di > plus_di

    # Stochastic
    stoch_oversold = (not np.isnan(stoch_k)) and stoch_k < cfg.STOCH_OS
    stoch_overbought = (not np.isnan(stoch_k)) and stoch_k > cfg.STOCH_OB

    # Scoring logic
    if has_trend and di_bullish and trix_bullish:
        score = 1.5 if strong_trend else 1.0
        if stoch_oversold:
            score = 2.0  # trend + momentum + oversold = strong buy
        elif stoch_overbought:
            score *= 0.6  # trend exhaustion risk
    elif has_trend and di_bearish and trix_bearish:
        score = -1.5 if strong_trend else -1.0
        if stoch_overbought:
            score = -2.0  # trend + momentum + overbought = strong sell
        elif stoch_oversold:
            score *= 0.6
    elif trix_cross_up:
        score = 0.8
    elif trix_cross_dn:
        score = -0.8
    elif trix_bullish:
        score = 0.3
    elif trix_bearish:
        score = -0.3

    return {
        "score": round(float(np.clip(score, -2, 2)), 2),
        "adx": round(float(adx), 1) if not np.isnan(adx) else None,
        "plus_di": round(float(plus_di), 1) if not np.isnan(plus_di) else None,
        "minus_di": round(float(minus_di), 1) if not np.isnan(minus_di) else None,
        "trix": round(float(trix), 2) if not np.isnan(trix) else None,
        "trix_signal": round(float(trix_sig), 2) if not np.isnan(trix_sig) else None,
        "stoch_k": round(float(stoch_k), 1) if not np.isnan(stoch_k) else None,
        "stoch_d": round(float(stoch_d), 1) if not np.isnan(stoch_d) else None,
    }


# ═══════════════════════════════════════════════════════════
#  SYSTEM 2 — Elder Impulse System
# ═══════════════════════════════════════════════════════════

def compute_elder_impulse(
    df: pd.DataFrame,
    ema_period: int = cfg.ELDER_EMA,
    macd_fast: int = cfg.MACD_FAST,
    macd_slow: int = cfg.MACD_SLOW,
    macd_signal: int = cfg.MACD_SIGNAL,
) -> pd.DataFrame:
    """
    Elder Impulse System — color-coded bars.

    Green = EMA rising AND MACD-Histogram rising  → Bullish impulse
    Red   = EMA falling AND MACD-Histogram falling → Bearish impulse
    Blue  = mixed                                  → Neutral
    """
    close = df["Close"]
    ema = _ema(close, ema_period)
    macd_line = _ema(close, macd_fast) - _ema(close, macd_slow)
    signal_line = _ema(macd_line, macd_signal)
    histogram = macd_line - signal_line

    ema_rising = ema > ema.shift(1)
    hist_rising = histogram > histogram.shift(1)

    color = pd.Series("Blue", index=df.index)
    color[(ema_rising) & (hist_rising)] = "Green"
    color[(~ema_rising) & (~hist_rising)] = "Red"

    return pd.DataFrame({
        "Elder_Color": color,
        "EMA": ema,
        "MACD": macd_line,
        "MACD_Signal": signal_line,
        "MACD_Hist": histogram,
    }, index=df.index)


def score_system2(df: pd.DataFrame) -> dict:
    """
    Score Elder Impulse → −2 to +2.

    Uses consecutive green/red bars and MACD momentum.
    """
    elder = compute_elder_impulse(df)
    colors = elder["Elder_Color"]
    hist = elder["MACD_Hist"]
    last_color = colors.iloc[-1]

    # Count consecutive bars of same color
    consecutive = 1
    for i in range(len(colors) - 2, max(len(colors) - 20, -1), -1):
        if colors.iloc[i] == last_color:
            consecutive += 1
        else:
            break

    # MACD histogram magnitude (normalised)
    hist_val = hist.iloc[-1] if not np.isnan(hist.iloc[-1]) else 0
    hist_std = hist.dropna().std()
    hist_z = hist_val / hist_std if hist_std > 0 else 0

    if last_color == "Green":
        base = 1.0
        if consecutive >= 5:
            base = 1.5
        if consecutive >= 10:
            base = 2.0
        score = min(base + 0.2 * min(hist_z, 2), 2.0)
    elif last_color == "Red":
        base = -1.0
        if consecutive >= 5:
            base = -1.5
        if consecutive >= 10:
            base = -2.0
        score = max(base + 0.2 * max(hist_z, -2), -2.0)
    else:
        score = 0.1 * hist_z  # mild directional lean

    # Recent color distribution (last 10 bars)
    recent = colors.iloc[-10:]
    green_pct = (recent == "Green").sum() / len(recent)
    red_pct = (recent == "Red").sum() / len(recent)

    return {
        "score": round(float(np.clip(score, -2, 2)), 2),
        "last_color": last_color,
        "consecutive": consecutive,
        "macd_hist": round(float(hist_val), 4),
        "green_pct_10d": round(float(green_pct), 2),
        "red_pct_10d": round(float(red_pct), 2),
    }


# ═══════════════════════════════════════════════════════════
#  SYSTEM 3 — Renko + Full Stochastics
# ═══════════════════════════════════════════════════════════

def compute_renko(
    df: pd.DataFrame,
    brick_size: float | None = None,
    atr_period: int = cfg.RENKO_ATR_PERIOD,
) -> dict:
    """
    Compute ATR-based Renko bricks from OHLCV data.

    Returns dict with:
        bricks: list of {direction: 1/-1, open, close, index}
        brick_size: the ATR-based brick size used
        renko_close: pd.Series aligned to original index (last brick close repeated)
    """
    close = df["Close"].values
    if brick_size is None:
        atr_val = _atr(df["High"], df["Low"], df["Close"], atr_period).dropna()
        brick_size = float(atr_val.iloc[-1]) if len(atr_val) > 0 else float(close.std())
        brick_size = max(brick_size, 0.01)

    bricks = []
    current_price = close[0]
    # Round to nearest brick
    brick_open = round(current_price / brick_size) * brick_size

    renko_values = np.full(len(close), np.nan)

    for i in range(1, len(close)):
        diff = close[i] - brick_open

        while diff >= brick_size:
            brick_close = brick_open + brick_size
            bricks.append({
                "direction": 1,
                "open": round(float(brick_open), 2),
                "close": round(float(brick_close), 2),
                "idx": i,
            })
            brick_open = brick_close
            diff = close[i] - brick_open

        while diff <= -brick_size:
            brick_close = brick_open - brick_size
            bricks.append({
                "direction": -1,
                "open": round(float(brick_open), 2),
                "close": round(float(brick_close), 2),
                "idx": i,
            })
            brick_open = brick_close
            diff = close[i] - brick_open

        renko_values[i] = brick_open

    renko_close = pd.Series(renko_values, index=df.index).ffill()

    return {
        "bricks": bricks,
        "brick_size": round(float(brick_size), 2),
        "renko_close": renko_close,
    }


def score_system3(df: pd.DataFrame) -> dict:
    """
    Score Renko + Stochastics → −2 to +2.

    Renko trend direction + Stochastic timing.
    """
    renko = compute_renko(df)
    stoch_df = compute_full_stochastics(df)
    bricks = renko["bricks"]

    if not bricks:
        return {
            "score": 0.0, "renko_direction": 0, "consecutive_bricks": 0,
            "brick_size": renko["brick_size"],
            "stoch_k": None, "stoch_d": None,
        }

    last_dir = bricks[-1]["direction"]

    # Count consecutive bricks in same direction
    consecutive = 1
    for i in range(len(bricks) - 2, max(len(bricks) - 20, -1), -1):
        if bricks[i]["direction"] == last_dir:
            consecutive += 1
        else:
            break

    # Recent brick velocity (bricks in last 20 price bars)
    recent_bricks = [b for b in bricks if b["idx"] >= len(df) - 20]
    recent_up = sum(1 for b in recent_bricks if b["direction"] == 1)
    recent_dn = sum(1 for b in recent_bricks if b["direction"] == -1)

    stoch_k = stoch_df["Stoch_K"].iloc[-1]
    stoch_d = stoch_df["Stoch_D"].iloc[-1]

    stoch_oversold = (not np.isnan(stoch_k)) and stoch_k < cfg.STOCH_OS
    stoch_overbought = (not np.isnan(stoch_k)) and stoch_k > cfg.STOCH_OB

    if last_dir == 1:
        base = min(0.5 + 0.3 * consecutive, 1.5)
        if stoch_oversold:
            base = min(base + 0.5, 2.0)  # up bricks + Stoch reversing from oversold
        elif stoch_overbought:
            base *= 0.5  # exhaustion
        score = base
    elif last_dir == -1:
        base = max(-0.5 - 0.3 * consecutive, -1.5)
        if stoch_overbought:
            base = max(base - 0.5, -2.0)
        elif stoch_oversold:
            base *= 0.5
        score = base
    else:
        score = 0.0

    return {
        "score": round(float(np.clip(score, -2, 2)), 2),
        "renko_direction": last_dir,
        "consecutive_bricks": consecutive,
        "brick_size": renko["brick_size"],
        "recent_up": recent_up,
        "recent_dn": recent_dn,
        "stoch_k": round(float(stoch_k), 1) if not np.isnan(stoch_k) else None,
        "stoch_d": round(float(stoch_d), 1) if not np.isnan(stoch_d) else None,
    }


# ═══════════════════════════════════════════════════════════
#  SYSTEM 4 — Heikin-Ashi + Hull Moving Average
# ═══════════════════════════════════════════════════════════

def compute_heikin_ashi(df: pd.DataFrame) -> pd.DataFrame:
    """
    Heikin-Ashi candles.
        HA_Close = (O + H + L + C) / 4
        HA_Open  = (prev_HA_Open + prev_HA_Close) / 2
        HA_High  = max(H, HA_Open, HA_Close)
        HA_Low   = min(L, HA_Open, HA_Close)
    """
    ha = pd.DataFrame(index=df.index)
    ha["HA_Close"] = (df["Open"] + df["High"] + df["Low"] + df["Close"]) / 4

    ha_open = np.zeros(len(df))
    ha_open[0] = (df["Open"].iloc[0] + df["Close"].iloc[0]) / 2
    ha_close = ha["HA_Close"].values

    for i in range(1, len(df)):
        ha_open[i] = (ha_open[i - 1] + ha_close[i - 1]) / 2

    ha["HA_Open"] = ha_open
    ha["HA_High"] = pd.concat([df["High"], ha["HA_Open"], ha["HA_Close"]], axis=1).max(axis=1)
    ha["HA_Low"] = pd.concat([df["Low"], ha["HA_Open"], ha["HA_Close"]], axis=1).min(axis=1)

    # Body direction
    ha["HA_Bullish"] = ha["HA_Close"] > ha["HA_Open"]

    # Wick analysis
    ha["Upper_Wick"] = ha["HA_High"] - ha[["HA_Open", "HA_Close"]].max(axis=1)
    ha["Lower_Wick"] = ha[["HA_Open", "HA_Close"]].min(axis=1) - ha["HA_Low"]

    return ha


def compute_hull_ma(
    close: pd.Series,
    period: int = cfg.HMA_PERIOD,
) -> pd.Series:
    """
    Hull Moving Average — reduces lag while maintaining smoothness.
        HMA = WMA( 2·WMA(n/2) − WMA(n),  √n )
    """
    half = max(period // 2, 1)
    sqrt_n = max(int(math.sqrt(period)), 1)

    wma_half = _wma(close, half)
    wma_full = _wma(close, period)
    diff = 2 * wma_half - wma_full
    hma = _wma(diff, sqrt_n)
    hma.name = "HMA"
    return hma


def score_system4(df: pd.DataFrame) -> dict:
    """
    Score Heikin-Ashi + HMA → −2 to +2.

    HA trend + HA candle quality + HMA direction agreement.
    """
    ha = compute_heikin_ashi(df)
    hma = compute_hull_ma(df["Close"])

    last = len(df) - 1
    bull = ha["HA_Bullish"].iloc[last]
    upper_wick = ha["Upper_Wick"].iloc[last]
    lower_wick = ha["Lower_Wick"].iloc[last]
    body = abs(ha["HA_Close"].iloc[last] - ha["HA_Open"].iloc[last])

    # HMA direction
    hma_val = hma.iloc[last] if not np.isnan(hma.iloc[last]) else None
    hma_prev = hma.iloc[last - 1] if last > 0 and not np.isnan(hma.iloc[last - 1]) else hma_val
    hma_rising = hma_val > hma_prev if hma_val is not None and hma_prev is not None else None

    # Consecutive HA candles of same color
    consecutive = 1
    for i in range(last - 1, max(last - 20, -1), -1):
        if ha["HA_Bullish"].iloc[i] == bull:
            consecutive += 1
        else:
            break

    # Candle quality: strong trend = no wick on opposite side
    if bull:
        # Bullish: strong = no lower wick
        wick_quality = 1.0 if lower_wick < body * 0.1 else 0.6 if lower_wick < body * 0.3 else 0.3
    else:
        # Bearish: strong = no upper wick
        wick_quality = 1.0 if upper_wick < body * 0.1 else 0.6 if upper_wick < body * 0.3 else 0.3

    if bull:
        base = min(0.5 + 0.2 * consecutive, 1.5)
        score = base * wick_quality
        # HMA confirms
        if hma_rising:
            score = min(score + 0.5, 2.0)
        elif hma_rising is False:
            score *= 0.4  # divergence
    else:
        base = max(-0.5 - 0.2 * consecutive, -1.5)
        score = base * wick_quality
        if hma_rising is False:
            score = max(score - 0.5, -2.0)
        elif hma_rising:
            score *= 0.4

    # Recent HA distribution
    recent_ha = ha["HA_Bullish"].iloc[-10:]
    bull_pct = recent_ha.sum() / len(recent_ha)

    return {
        "score": round(float(np.clip(score, -2, 2)), 2),
        "ha_bullish": bool(bull),
        "consecutive_candles": consecutive,
        "wick_quality": round(float(wick_quality), 2),
        "hma_value": round(float(hma_val), 2) if hma_val is not None else None,
        "hma_rising": hma_rising,
        "bull_pct_10d": round(float(bull_pct), 2),
    }


# ═══════════════════════════════════════════════════════════
#  TIMESERIES EXTRACTION  (for dashboard charts)
# ═══════════════════════════════════════════════════════════

def extract_chart_data(df: pd.DataFrame, n_points: int = 120) -> dict:
    """
    Extract subsampled time-series for all indicators, suitable for Chart.js.
    """
    step = max(1, len(df) // n_points)
    sub = df.iloc[::step].copy()
    dates = sub.index.strftime("%Y-%m-%d").tolist()

    # ADX
    adx_df = compute_adx(df).iloc[::step]
    # TRIX
    trix_df = compute_trix(df["Close"]).iloc[::step]
    # Stochastics
    stoch_df = compute_full_stochastics(df).iloc[::step]
    # Elder
    elder_df = compute_elder_impulse(df).iloc[::step]
    # Heikin-Ashi
    ha_df = compute_heikin_ashi(df).iloc[::step]
    # HMA
    hma = compute_hull_ma(df["Close"]).iloc[::step]

    def _c(s):
        """Convert series to JSON-safe list."""
        return [round(float(v), 3) if not np.isnan(v) else None for v in s]

    return {
        "dates": dates,
        "close": _c(sub["Close"]),
        "volume": [int(v) if not np.isnan(v) else 0 for v in sub["Volume"]],
        "adx": _c(adx_df["ADX"]),
        "plus_di": _c(adx_df["Plus_DI"]),
        "minus_di": _c(adx_df["Minus_DI"]),
        "trix": _c(trix_df["TRIX"]),
        "trix_signal": _c(trix_df["TRIX_Signal"]),
        "stoch_k": _c(stoch_df["Stoch_K"]),
        "stoch_d": _c(stoch_df["Stoch_D"]),
        "elder_colors": elder_df["Elder_Color"].tolist(),
        "macd_hist": _c(elder_df["MACD_Hist"]),
        "ha_open": _c(ha_df["HA_Open"]),
        "ha_close": _c(ha_df["HA_Close"]),
        "ha_high": _c(ha_df["HA_High"]),
        "ha_low": _c(ha_df["HA_Low"]),
        "hma": _c(hma),
    }
