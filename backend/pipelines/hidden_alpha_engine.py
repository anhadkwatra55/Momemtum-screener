"""
hidden_alpha_engine.py — Hidden Alpha Options Screener Engine
==============================================================
Ported from Colab prototype. Production-ready for FastAPI.

Architecture:
  1. Uses CACHED momentum universe (from momentum_config.py) — zero cold-start delay
  2. Fetches options chains in batched chunks (25 tickers/batch, 3s cooldown)
  3. Stores ALL results in SQLite for instant frontend reads
  4. Background pipeline — no user-triggered requests

Quant Engine (5 modules):
  M1: Pre-filter universe (momentum × volatility × liquidity)
  M2: Vectorized Black-Scholes Greeks + Skew-Adjusted Delta
  M3: Net GEX Profile + GTBR (SqueezeMetrics proxy)
  M4: Asymmetric Discrete VRP (Bad/Good decomposition)
  M5: 9-Tab Screener + 2 Structural Filters
"""

from __future__ import annotations

import logging
import math
import time as _time
import warnings
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Any

import numpy as np

logger = logging.getLogger("hidden_alpha")
if not logger.handlers:
    logger.setLevel(logging.INFO)
    _sh = logging.StreamHandler()
    _sh.setFormatter(logging.Formatter("  %(message)s"))
    logger.addHandler(_sh)
warnings.filterwarnings("ignore")

try:
    import pandas as pd
    HAS_PD = True
except ImportError:
    HAS_PD = False

try:
    from scipy.stats import norm
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

try:
    import yfinance as yf
    HAS_YF = True
except ImportError:
    HAS_YF = False

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════

RISK_FREE_RATE = 0.043
CONTRACT_SIZE = 100
MIN_DTE = 1
MAX_DTE = 730
FETCH_WORKERS = 6
FETCH_BATCH_SIZE = 25
BATCH_COOLDOWN_SECONDS = 2.0

FILTER_CONFIG = {
    'BULLISH_VOL_OI_RATIO': 2.5, 'BULLISH_MIN_VOL': 500,
    'BULLISH_MAX_DTE': 45, 'BULLISH_VRP_PCTL': 0.75,
    'BEARISH_VOL_OI_RATIO': 2.5, 'BEARISH_MIN_VOL': 500,
    'BEARISH_MAX_DTE': 45, 'BEARISH_VRP_PCTL': 0.75,
    'CONVICTION_CALL_PREM_PCTL': 0.95, 'CONVICTION_CALL_MIN_PREM_ABS': 25_000,
    'CONVICTION_CALL_MIN_DELTA': 0.30, 'CONVICTION_CALL_ZG_PROX': 0.05,
    'CONVICTION_PUT_PREM_PCTL': 0.95, 'CONVICTION_PUT_MIN_PREM_ABS': 25_000,
    'LEAPS_MIN_DTE': 365, 'LEAPS_FALLBACK_DTE': 180,
    'LEAPS_MIN_OI': 50, 'LEAPS_MONEYNESS_LOW': 0.80, 'LEAPS_MONEYNESS_HIGH': 1.20,
    'PUT_SELL_DELTA_LOW': -0.30, 'PUT_SELL_DELTA_HIGH': -0.15,
    'PUT_SELL_MIN_DTE': 15, 'PUT_SELL_MAX_DTE': 60, 'PUT_SELL_MIN_VOL': 50,
    'CHEAP_MAX_PRICE': 1.00, 'CHEAP_MIN_PRICE': 0.01,
    'CHEAP_MAX_DTE': 14, 'CHEAP_MIN_VOL': 50, 'CHEAP_WALL_PROX': 0.015,
    'SPREAD_MIN_DTE': 7, 'SPREAD_MAX_DTE': 60, 'SPREAD_MIN_PRICE': 0.10,
    'SPREAD_MIN_MARGIN': 0.20, 'SPREAD_MAX_PTM': 10.0, 'SPREAD_TOP_N': 15,
    'RELAXED_PREM': 25_000,
}
FC = FILTER_CONFIG


# ═══════════════════════════════════════════════════════════════
# MODULE 0: UNIVERSE — Use cached momentum tickers (instant)
# ═══════════════════════════════════════════════════════════════

def get_universe_tickers(max_tickers: int = 200) -> list[str]:
    """Get tickers from the cached momentum universe. Zero API calls."""
    try:
        try:
            import momentum_config as cfg
        except ImportError:
            from pipelines import momentum_config as cfg
        tickers = list(cfg.STOCK_TICKERS[:max_tickers])
    except Exception:
        tickers = ['SPY', 'NVDA', 'AAPL', 'TSLA', 'AMD', 'META', 'MSFT',
                    'AMZN', 'GOOGL', 'NFLX', 'GOOG', 'JPM', 'V', 'MA']
    if 'SPY' not in tickers:
        tickers.insert(0, 'SPY')
    return tickers


# ═══════════════════════════════════════════════════════════════
# MODULE 1: PARALLEL DATA INGESTION
# ═══════════════════════════════════════════════════════════════

def _fetch_single_ticker(sym: str) -> tuple:
    """Fetch one ticker's options chain. Thread-safe."""
    if not HAS_YF:
        return sym, None, None, "yfinance not installed"
    try:
        tkr = yf.Ticker(sym.replace(".", "-"))
        hist = tkr.history(period='5d')
        if hist.empty:
            return sym, None, None, "no price data"
        spot = float(hist['Close'].iloc[-1])
        if spot < 1.0:
            return sym, None, None, "penny stock"
        try:
            expiries = tkr.options
        except Exception:
            return sym, None, None, "no options"

        today = datetime.now().date()
        rows = []
        for exp_str in expiries:
            exp_date = datetime.strptime(exp_str, '%Y-%m-%d').date()
            dte = (exp_date - today).days
            if dte < MIN_DTE or dte > MAX_DTE:
                continue
            try:
                chain = tkr.option_chain(exp_str)
            except Exception:
                continue
            for opt_type, frame in [('call', chain.calls), ('put', chain.puts)]:
                if frame.empty:
                    continue
                tmp = frame.copy()
                tmp['ticker'] = sym
                tmp['spot'] = spot
                tmp['expiry'] = exp_str
                tmp['dte'] = dte
                tmp['T'] = dte / 365.0
                tmp['option_type'] = opt_type
                tmp['mid_price'] = (tmp['bid'] + tmp['ask']) / 2.0
                rows.append(tmp)

        if not rows:
            return sym, spot, None, "no valid expirations"
        df = pd.concat(rows, ignore_index=True)
        return sym, spot, df, None
    except Exception as e:
        return sym, None, None, str(e)[:80]


def fetch_options_universe(
    tickers: list[str],
    workers: int = FETCH_WORKERS,
    batch_size: int = FETCH_BATCH_SIZE,
    on_progress: Any = None,
) -> tuple:
    """Parallel fetch with batching and rate limit protection."""
    all_chains = []
    spot_prices = {}
    errors = []
    batches = [tickers[i:i + batch_size] for i in range(0, len(tickers), batch_size)]
    total = len(tickers)
    done = 0

    logger.info(f"Hidden Alpha: Fetching {total} tickers in {len(batches)} batches ({workers} workers)")
    t0 = _time.time()

    for batch_idx, batch in enumerate(batches):
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(_fetch_single_ticker, t): t for t in batch}
            for f in as_completed(futures):
                sym, spot, df, err = f.result()
                done += 1
                if err:
                    errors.append(f"{sym}: {err}")
                else:
                    spot_prices[sym] = spot
                    if df is not None:
                        all_chains.append(df)

        pct = done / total * 100
        logger.info(f"  Batch {batch_idx + 1}/{len(batches)}: {done}/{total} ({pct:.0f}%) "
                     f"[{len(spot_prices)} OK, {len(errors)} err]")
        if on_progress:
            on_progress(done, total, len(spot_prices))

        # Rate limit cooldown between batches
        if batch_idx < len(batches) - 1:
            _time.sleep(BATCH_COOLDOWN_SECONDS)

    elapsed = _time.time() - t0
    logger.info(f"  Fetch complete: {elapsed:.1f}s, {len(spot_prices)} tickers, {len(errors)} errors")

    if not all_chains:
        return pd.DataFrame(), spot_prices

    df = pd.concat(all_chains, ignore_index=True)
    # Cleaning
    crit = ['strike', 'volume', 'openInterest', 'impliedVolatility', 'bid', 'ask']
    df = df.dropna(subset=crit)
    df = df[(df['volume'] > 0) & (df['openInterest'] > 0)]
    df = df[df['impliedVolatility'] > 0.001]
    df = df[(df['dte'] >= MIN_DTE) & (df['dte'] <= MAX_DTE)]
    df = df[df['T'] > 0]
    df['moneyness'] = df['strike'] / df['spot']
    df = df.reset_index(drop=True)

    logger.info(f"  Universe: {len(df):,} clean contracts from {len(spot_prices)} tickers")
    return df, spot_prices


# ═══════════════════════════════════════════════════════════════
# MODULE 2: VECTORIZED GREEKS & SKEW ADJUSTMENT
# ═══════════════════════════════════════════════════════════════

def compute_vectorized_greeks(df: pd.DataFrame, r: float = RISK_FREE_RATE) -> pd.DataFrame:
    """Compute BS Greeks in pure vectorized numpy."""
    if df.empty:
        return df
    S = df['spot'].values.astype(np.float64)
    K = df['strike'].values.astype(np.float64)
    T = np.maximum(df['T'].values.astype(np.float64), 1e-8)
    sigma = np.maximum(df['impliedVolatility'].values.astype(np.float64), 1e-8)
    is_call = (df['option_type'] == 'call').values

    sqT = np.sqrt(T)
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqT)
    d2 = d1 - sigma * sqT
    Nd1 = norm.cdf(d1)
    Nd2 = norm.cdf(d2)
    nd1 = norm.pdf(d1)
    eRT = np.exp(-r * T)

    out = df.copy()
    out['delta'] = np.where(is_call, Nd1, Nd1 - 1.0)
    out['gamma'] = nd1 / (S * sigma * sqT)
    out['vega'] = S * nd1 * sqT / 100.0
    out['theta'] = np.where(
        is_call,
        (-(S * nd1 * sigma) / (2.0 * sqT) - r * K * eRT * Nd2) / 365.0,
        (-(S * nd1 * sigma) / (2.0 * sqT) + r * K * eRT * norm.cdf(-d2)) / 365.0,
    )
    out['dollar_gamma'] = out['gamma'] * S ** 2 / 100.0
    return out


def compute_skew_adjusted_delta(df: pd.DataFrame) -> pd.DataFrame:
    """Skew-Adjusted Delta = Δ_std + Vega_abs × (dIV/dSpot)."""
    if df.empty:
        return df
    df = df.sort_values(['ticker', 'expiry', 'option_type', 'strike']).reset_index(drop=True)
    dIV_dK = np.zeros(len(df))
    for _, idx in df.groupby(['ticker', 'expiry', 'option_type']).groups.items():
        idx_arr = np.array(idx)
        if len(idx_arr) < 3:
            continue
        sub = df.loc[idx_arr]
        dIV_dK[idx_arr] = np.gradient(sub['impliedVolatility'].values, sub['strike'].values)

    df['dIV_dK'] = dIV_dK
    df['dIV_dSpot'] = -df['dIV_dK']
    df['skew_adj_delta'] = df['delta'] + (df['vega'] * 100.0) * df['dIV_dSpot']
    df['total_premium'] = df['mid_price'] * CONTRACT_SIZE
    return df


# ═══════════════════════════════════════════════════════════════
# MODULE 3: NET GEX PROFILE & GTBR
# ═══════════════════════════════════════════════════════════════

def compute_gex_profile(df: pd.DataFrame) -> pd.DataFrame:
    """Tag every contract with its GEX contribution."""
    if df.empty:
        return df
    df = df.copy()
    df['contract_gex'] = np.where(
        df['option_type'] == 'call',
        df['openInterest'] * df['dollar_gamma'] * CONTRACT_SIZE,
        -df['openInterest'] * df['dollar_gamma'] * CONTRACT_SIZE,
    )
    return df


def _gex_by_strike(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    t = df[df['ticker'] == ticker]
    cg = t[t['option_type'] == 'call'].groupby('strike')['contract_gex'].sum()
    pg = t[t['option_type'] == 'put'].groupby('strike')['contract_gex'].sum()
    g = pd.DataFrame({'call_gex': cg, 'put_gex': pg}).fillna(0)
    g['net_gex'] = g['call_gex'] + g['put_gex']
    g['cum_gex'] = g['net_gex'].cumsum()
    return g.sort_index().reset_index()


def _find_zero_gamma(gex_df: pd.DataFrame) -> float:
    cum = gex_df['cum_gex'].values
    strikes = gex_df['strike'].values
    flips = np.where(np.diff(np.sign(cum)))[0]
    if len(flips) == 0:
        return float(strikes[np.argmin(np.abs(cum))])
    i = flips[0]
    s1, s2 = strikes[i], strikes[i + 1]
    g1, g2 = cum[i], cum[i + 1]
    return float(s1 + (s2 - s1) * (-g1) / (g2 - g1) if g2 != g1 else (s1 + s2) / 2)


def compute_all_gex(df: pd.DataFrame, spot_prices: dict) -> dict:
    """Compute GEX profiles for all tickers."""
    results = {}
    for ticker in df['ticker'].unique():
        if ticker not in spot_prices:
            continue
        spot = spot_prices[ticker]
        gp = _gex_by_strike(df, ticker)
        if gp.empty:
            continue
        zg = _find_zero_gamma(gp)
        wall_idx = gp['net_gex'].abs().idxmax()
        wall_k = float(gp.loc[wall_idx, 'strike'])
        wall_v = float(gp.loc[wall_idx, 'net_gex'])
        net = float(gp['net_gex'].sum())
        regime = "Long Gamma" if net > 0 else "Short Gamma"

        results[ticker] = dict(
            spot=spot, zero_gamma=zg, gamma_wall=wall_k,
            gamma_wall_gex=wall_v, total_net_gex=net, regime=regime,
        )
    return results


# ═══════════════════════════════════════════════════════════════
# MODULE 4: ASYMMETRIC DISCRETE VRP
# ═══════════════════════════════════════════════════════════════

def compute_discrete_iv2(df: pd.DataFrame, ticker: str, r: float = RISK_FREE_RATE):
    """VIX-style discrete implied variance for nearest-to-30d expiry."""
    t = df[df['ticker'] == ticker]
    if t.empty:
        return None, None, None, 0, ""
    spot = t['spot'].iloc[0]
    exp_dte = t.groupby('expiry')['dte'].first()
    if exp_dte.empty:
        return None, None, None, 0, ""
    best_exp = exp_dte.iloc[(exp_dte - 30).abs().argsort()[:1]].index[0]
    edf = t[t['expiry'] == best_exp]
    T = edf['T'].iloc[0]
    dte = int(edf['dte'].iloc[0])
    F = spot * np.exp(r * T)

    calls = edf[edf['option_type'] == 'call'].sort_values('strike')
    puts = edf[edf['option_type'] == 'put'].sort_values('strike')
    all_k = np.sort(edf['strike'].unique())
    K0 = float(all_k[all_k <= F][-1]) if (all_k <= F).any() else float(all_k[0])

    rows = []
    for _, r_ in puts[puts['strike'] < K0].iterrows():
        rows.append((r_['strike'], r_['mid_price'], 'bad'))
    k0p = puts[puts['strike'] == K0]
    k0c = calls[calls['strike'] == K0]
    if not k0p.empty and not k0c.empty:
        rows.append((K0, (k0p['mid_price'].iloc[0] + k0c['mid_price'].iloc[0]) / 2, 'both'))
    elif not k0p.empty:
        rows.append((K0, k0p['mid_price'].iloc[0], 'bad'))
    elif not k0c.empty:
        rows.append((K0, k0c['mid_price'].iloc[0], 'good'))
    for _, r_ in calls[calls['strike'] > K0].iterrows():
        rows.append((r_['strike'], r_['mid_price'], 'good'))

    if len(rows) < 2:
        return None, None, None, dte, best_exp

    strip = pd.DataFrame(rows, columns=['K', 'Q', 'comp']).sort_values('K').reset_index(drop=True)
    Kv = strip['K'].values
    n = len(Kv)
    dK = np.empty(n)
    dK[0] = Kv[1] - Kv[0]
    dK[-1] = Kv[-1] - Kv[-2]
    if n > 2:
        dK[1:-1] = (Kv[2:] - Kv[:-2]) / 2.0

    eRT = np.exp(r * T)
    contrib = (dK / Kv ** 2) * eRT * strip['Q'].values
    strip['c'] = contrib

    total_iv2 = (2.0 / T) * contrib.sum() - (1.0 / T) * ((F / K0) - 1) ** 2
    bad_iv2 = (2.0 / T) * strip.loc[strip['comp'].isin(['bad', 'both']), 'c'].sum()
    good_iv2 = (2.0 / T) * strip.loc[strip['comp'].isin(['good', 'both']), 'c'].sum()
    return total_iv2, bad_iv2, good_iv2, dte, best_exp


def compute_realized_variance(ticker: str, price_cache=None, lookback: int = 21):
    """21-day realized variance. Uses cached price data when available."""
    try:
        close = None
        if price_cache is not None:
            try:
                close = price_cache[ticker]['Close'].dropna()
            except (KeyError, TypeError):
                pass
        if close is None or len(close) < lookback + 1:
            # Fallback: quick fetch
            try:
                h = yf.Ticker(ticker.replace(".", "-")).history(period='3mo')
                close = h['Close']
            except Exception:
                return None, None, None
        if len(close) < lookback + 1:
            return None, None, None
        lr = np.log(close / close.shift(1)).dropna().values[-lookback:]
        ann = 252.0 / lookback
        total = float(np.sum(lr ** 2) * ann)
        bad = float(np.sum(lr[lr < 0] ** 2) * ann) if (lr < 0).any() else 0.0
        good = float(np.sum(lr[lr >= 0] ** 2) * ann) if (lr >= 0).any() else 0.0
        return total, bad, good
    except Exception:
        return None, None, None


def compute_all_vrp(df: pd.DataFrame, spot_prices: dict, price_cache=None) -> dict:
    """Compute VRP for all tickers with options data."""
    results = {}
    for ticker in df['ticker'].unique():
        if ticker not in spot_prices:
            continue
        tiv, biv, giv, dte_, exp_ = compute_discrete_iv2(df, ticker)
        trv, brv, grv = compute_realized_variance(ticker, price_cache)
        if tiv is None or trv is None:
            continue
        results[ticker] = dict(
            total_iv2=tiv, bad_iv2=biv, good_iv2=giv,
            total_rv2=trv, bad_rv2=brv, good_rv2=grv,
            total_vrp=tiv - trv, bad_vrp=biv - brv, good_vrp=giv - grv,
            iv_vol=float(np.sqrt(max(tiv, 0)) * 100),
            rv_vol=float(np.sqrt(trv) * 100),
            exp_used=exp_, dte_used=dte_,
        )
    return results


# ═══════════════════════════════════════════════════════════════
# MODULE 5: 9-TAB SCREENER + 2 STRUCTURAL
# ═══════════════════════════════════════════════════════════════

def _merge_structural(df: pd.DataFrame, gex_results: dict, vrp_results: dict) -> pd.DataFrame:
    """Merge GEX/VRP data into every contract row."""
    df = df.copy()
    df['bad_vrp'] = 0.0
    df['good_vrp'] = 0.0
    df['total_vrp'] = 0.0
    df['hv'] = 0.0
    df['total_net_gex'] = 0.0
    df['zero_gamma_level'] = 0.0
    df['gamma_wall_strike'] = 0.0

    for ticker in df['ticker'].unique():
        mask = df['ticker'] == ticker
        if ticker in vrp_results:
            v = vrp_results[ticker]
            df.loc[mask, 'bad_vrp'] = v['bad_vrp']
            df.loc[mask, 'good_vrp'] = v['good_vrp']
            df.loc[mask, 'total_vrp'] = v['total_vrp']
            df.loc[mask, 'hv'] = np.sqrt(max(v['total_rv2'], 0))
        if ticker in gex_results:
            g = gex_results[ticker]
            df.loc[mask, 'total_net_gex'] = g['total_net_gex']
            df.loc[mask, 'zero_gamma_level'] = g['zero_gamma']
            df.loc[mask, 'gamma_wall_strike'] = g['gamma_wall']
    return df


def _find_credit_spreads(df, vrp_data, spots, spread_type='bull_put', top_n=15):
    """Find optimal credit spreads ranked by premium-to-margin ratio."""
    rows = []
    for ticker in df['ticker'].unique():
        if ticker not in spots or ticker not in vrp_data:
            continue
        spot = spots[ticker]
        hv = np.sqrt(max(vrp_data[ticker]['total_rv2'], 0))
        if spread_type == 'bull_put':
            legs = df[
                (df['ticker'] == ticker) & (df['option_type'] == 'put') &
                (df['strike'] < spot) &
                (df['dte'] >= FC['SPREAD_MIN_DTE']) & (df['dte'] <= FC['SPREAD_MAX_DTE']) &
                (df['mid_price'] > FC['SPREAD_MIN_PRICE']) &
                (df['impliedVolatility'] > hv)
            ]
        else:
            legs = df[
                (df['ticker'] == ticker) & (df['option_type'] == 'call') &
                (df['strike'] > spot) &
                (df['dte'] >= FC['SPREAD_MIN_DTE']) & (df['dte'] <= FC['SPREAD_MAX_DTE']) &
                (df['mid_price'] > FC['SPREAD_MIN_PRICE']) &
                (df['impliedVolatility'] > hv)
            ]
        for exp, eg in legs.groupby('expiry'):
            es = eg.sort_values('strike', ascending=(spread_type != 'bull_put')).reset_index(drop=True)
            if len(es) < 2:
                continue
            for i in range(min(len(es) - 1, 5)):  # Cap iterations
                short_leg = es.iloc[i]
                long_leg = es.iloc[i + 1]
                if spread_type == 'bull_put':
                    credit = short_leg['mid_price'] - long_leg['mid_price']
                    width = short_leg['strike'] - long_leg['strike']
                    net_d = (-short_leg['delta']) + long_leg['delta']
                else:
                    credit = short_leg['mid_price'] - long_leg['mid_price']
                    width = long_leg['strike'] - short_leg['strike']
                    net_d = (-short_leg['delta']) + long_leg['delta']
                if credit <= 0 or width <= 0:
                    continue
                margin = width - credit
                if margin < FC['SPREAD_MIN_MARGIN']:
                    continue
                if spread_type == 'bull_put' and net_d <= 0:
                    continue
                if spread_type == 'bear_call' and net_d >= 0:
                    continue
                ptm = credit / margin
                if ptm > FC['SPREAD_MAX_PTM']:
                    continue
                rows.append({
                    'ticker': ticker, 'expiry': exp, 'dte': int(short_leg['dte']),
                    'short_strike': float(short_leg['strike']),
                    'long_strike': float(long_leg['strike']),
                    'width': float(width), 'credit': round(float(credit), 2),
                    'margin': round(float(margin), 2), 'ptm_ratio': round(float(ptm), 3),
                    'net_delta': round(float(net_d), 4),
                    'short_iv': round(float(short_leg['impliedVolatility']) * 100, 1),
                    'hv': round(float(hv) * 100, 1),
                    'spot': float(spot),
                })
    if not rows:
        return []
    sorted_rows = sorted(rows, key=lambda x: x['ptm_ratio'], reverse=True)
    return sorted_rows[:top_n]


def _contract_to_dict(row) -> dict:
    """Convert a DataFrame row to a JSON-serializable dict for frontend."""
    return {
        'ticker': str(row.get('ticker', '')),
        'spot': round(float(row.get('spot', 0)), 2),
        'strike': round(float(row.get('strike', 0)), 2),
        'expiry': str(row.get('expiry', '')),
        'dte': int(row.get('dte', 0)),
        'option_type': str(row.get('option_type', '')),
        'bid': round(float(row.get('bid', 0)), 2),
        'ask': round(float(row.get('ask', 0)), 2),
        'mid_price': round(float(row.get('mid_price', 0)), 2),
        'volume': int(row.get('volume', 0)),
        'open_interest': int(row.get('openInterest', 0)),
        'iv': round(float(row.get('impliedVolatility', 0)) * 100, 1),
        'delta': round(float(row.get('delta', 0)), 4),
        'skew_adj_delta': round(float(row.get('skew_adj_delta', 0)), 4),
        'gamma': round(float(row.get('gamma', 0)), 6),
        'theta': round(float(row.get('theta', 0)), 4),
        'vega': round(float(row.get('vega', 0)), 4),
        'total_premium': round(float(row.get('total_premium', 0)), 0),
        'moneyness': round(float(row.get('moneyness', 0)), 4),
        'bad_vrp': round(float(row.get('bad_vrp', 0)), 6),
        'good_vrp': round(float(row.get('good_vrp', 0)), 6),
        'total_net_gex': round(float(row.get('total_net_gex', 0)), 0),
        'hv': round(float(row.get('hv', 0)) * 100, 1),
    }


def run_9_tab_screener(
    universe: pd.DataFrame,
    gex_results: dict,
    vrp_results: dict,
    spot_prices: dict,
) -> dict:
    """Run all 9 tabs + 2 structural filters. Returns JSON-ready dict."""
    if universe.empty:
        return _empty_result()

    # Merge structural data
    uni = _merge_structural(universe, gex_results, vrp_results)
    calls = uni[uni['option_type'] == 'call']
    puts = uni[uni['option_type'] == 'put']

    # ── Tab 1: Unusually Bullish ──
    good_vrp_75 = calls['good_vrp'].quantile(FC['BULLISH_VRP_PCTL']) if not calls.empty else 0
    t1 = calls[
        (calls['volume'] > calls['openInterest'] * FC['BULLISH_VOL_OI_RATIO']) &
        (calls['volume'] > FC['BULLISH_MIN_VOL']) &
        (calls['dte'] < FC['BULLISH_MAX_DTE']) &
        (calls['good_vrp'] >= good_vrp_75)
    ].sort_values('total_premium', ascending=False)

    # ── Tab 2: Unusually Bearish ──
    bad_vrp_75 = puts['bad_vrp'].quantile(FC['BEARISH_VRP_PCTL']) if not puts.empty else 0
    t2 = puts[
        (puts['volume'] > puts['openInterest'] * FC['BEARISH_VOL_OI_RATIO']) &
        (puts['volume'] > FC['BEARISH_MIN_VOL']) &
        (puts['dte'] < FC['BEARISH_MAX_DTE']) &
        (puts['bad_vrp'] >= bad_vrp_75)
    ].sort_values('total_premium', ascending=False)

    # ── Tab 3: Deep Conviction Calls ──
    call_prem_thresh = max(
        calls['total_premium'].quantile(FC['CONVICTION_CALL_PREM_PCTL']),
        FC['CONVICTION_CALL_MIN_PREM_ABS']
    ) if not calls.empty else FC['CONVICTION_CALL_MIN_PREM_ABS']
    t3 = calls[
        (calls['total_premium'] > call_prem_thresh) &
        (calls['skew_adj_delta'] > FC['CONVICTION_CALL_MIN_DELTA']) &
        (calls['volume'] > 10)
    ].sort_values('total_premium', ascending=False)

    # ── Tab 4: Deep Conviction Puts ──
    put_prem_thresh = max(
        puts['total_premium'].quantile(FC['CONVICTION_PUT_PREM_PCTL']),
        FC['CONVICTION_PUT_MIN_PREM_ABS']
    ) if not puts.empty else FC['CONVICTION_PUT_MIN_PREM_ABS']
    t4 = puts[
        (puts['total_premium'] > put_prem_thresh) &
        (puts['total_net_gex'] < 0) &
        (puts['volume'] > 10)
    ].sort_values('total_premium', ascending=False)

    # ── Tab 5: LEAPS ──
    leaps_dte = FC['LEAPS_MIN_DTE'] if (calls['dte'] > FC['LEAPS_MIN_DTE']).any() else FC['LEAPS_FALLBACK_DTE']
    t5 = calls[
        (calls['dte'] > leaps_dte) &
        (calls['impliedVolatility'] < calls['hv']) &
        (calls['openInterest'] >= FC['LEAPS_MIN_OI']) &
        (calls['moneyness'] >= FC['LEAPS_MONEYNESS_LOW']) &
        (calls['moneyness'] <= FC['LEAPS_MONEYNESS_HIGH'])
    ].sort_values(['dte', 'total_premium'], ascending=[False, False])

    # ── Tab 6: Put Sells ──
    t6 = puts[
        (puts['strike'] < puts['spot']) &
        (puts['delta'].between(FC['PUT_SELL_DELTA_LOW'], FC['PUT_SELL_DELTA_HIGH'])) &
        (puts['dte'] > FC['PUT_SELL_MIN_DTE']) & (puts['dte'] < FC['PUT_SELL_MAX_DTE']) &
        (puts['impliedVolatility'] > puts['hv']) &
        (puts['volume'] > FC['PUT_SELL_MIN_VOL'])
    ].copy()
    if not t6.empty:
        t6['ann_roc'] = (t6['mid_price'] / t6['strike']) * (365.0 / t6['dte'])
        t6 = t6.sort_values('ann_roc', ascending=False)

    # ── Tab 7: Cheap Calls (Gamma Lottos) ──
    t7 = calls[
        (calls['mid_price'] < FC['CHEAP_MAX_PRICE']) &
        (calls['mid_price'] > FC['CHEAP_MIN_PRICE']) &
        (calls['strike'] > calls['spot']) &
        (calls['dte'] < FC['CHEAP_MAX_DTE']) &
        (calls['volume'] > FC['CHEAP_MIN_VOL'])
    ].sort_values('mid_price')

    # ── Tabs 8-9: Credit Spreads ──
    t8 = _find_credit_spreads(uni, vrp_results, spot_prices, 'bull_put')
    t9 = _find_credit_spreads(uni, vrp_results, spot_prices, 'bear_call')

    # ── Structural S1: Gamma Squeeze Vulnerability ──
    squeeze = []
    for ticker, gd in gex_results.items():
        net = gd['total_net_gex']
        if net >= 0:
            continue
        dist = abs(gd['spot'] - gd['gamma_wall']) / gd['spot'] if gd['spot'] > 0 else 1
        squeeze.append({
            'ticker': ticker, 'spot': round(gd['spot'], 2),
            'net_gex': round(net, 0), 'gamma_wall': round(gd['gamma_wall'], 2),
            'zero_gamma': round(gd['zero_gamma'], 2),
            'wall_dist_pct': round(dist * 100, 1),
            'severity': 'critical' if dist < 0.02 else 'elevated',
        })
    squeeze.sort(key=lambda x: x['wall_dist_pct'])

    # ── Structural S2: VRP Asymmetry ──
    vrp_asym = []
    if vrp_results:
        bads = [v['bad_vrp'] for v in vrp_results.values()]
        goods = [v['good_vrp'] for v in vrp_results.values()]
        p90b = np.percentile(bads, 90) if len(bads) > 1 else (bads[0] if bads else 0)
        p10g = np.percentile(goods, 10) if len(goods) > 1 else 0
        for t, d in vrp_results.items():
            asym = d['bad_vrp'] / d['good_vrp'] if d['good_vrp'] != 0 else float('inf')
            is_ext = d['bad_vrp'] >= p90b and d['good_vrp'] <= p10g
            signal = 'deep_conviction_buy' if is_ext else ('elevated_panic' if d['bad_vrp'] >= p90b else 'neutral')
            vrp_asym.append({
                'ticker': t, 'iv_vol': round(d['iv_vol'], 1),
                'rv_vol': round(d['rv_vol'], 1),
                'bad_vrp': round(d['bad_vrp'], 6), 'good_vrp': round(d['good_vrp'], 6),
                'asymmetry': round(asym, 2) if not math.isinf(asym) else 999,
                'signal': signal,
            })
        vrp_asym.sort(key=lambda x: x['bad_vrp'], reverse=True)

    def _to_list(df_or_list, max_rows=30):
        if isinstance(df_or_list, list):
            return df_or_list[:max_rows]
        if df_or_list is None or (isinstance(df_or_list, pd.DataFrame) and df_or_list.empty):
            return []
        return [_contract_to_dict(row) for _, row in df_or_list.head(max_rows).iterrows()]

    # ── GEX Summary ──
    short_gamma_count = sum(1 for g in gex_results.values() if g['total_net_gex'] < 0)
    long_gamma_count = sum(1 for g in gex_results.values() if g['total_net_gex'] >= 0)

    return {
        'tabs': {
            'bullish': {'data': _to_list(t1), 'count': len(t1), 'label': 'Unusually Bullish',
                        'description': 'Calls with Vol>OI×2.5, DTE<45, Good VRP ≥ 75th pctl',
                        'emoji': '🟢', 'color': 'emerald'},
            'bearish': {'data': _to_list(t2), 'count': len(t2), 'label': 'Unusually Bearish',
                        'description': 'Puts with Vol>OI×2.5, DTE<45, Bad VRP ≥ 75th pctl',
                        'emoji': '🔴', 'color': 'rose'},
            'conviction_calls': {'data': _to_list(t3), 'count': len(t3), 'label': 'Deep Conviction Calls',
                                 'description': f'Top 5% premium (>${call_prem_thresh / 1000:.0f}k), Skew-Adj Δ>0.30',
                                 'emoji': '💎', 'color': 'cyan'},
            'conviction_puts': {'data': _to_list(t4), 'count': len(t4), 'label': 'Deep Conviction Puts',
                                'description': f'Top 5% premium (>${put_prem_thresh / 1000:.0f}k), Net GEX<0',
                                'emoji': '💎', 'color': 'violet'},
            'leaps': {'data': _to_list(t5), 'count': len(t5), 'label': 'LEAPS',
                      'description': f'DTE>{leaps_dte}, IV<HV, OI>{FC["LEAPS_MIN_OI"]}',
                      'emoji': '📅', 'color': 'blue'},
            'put_sells': {'data': _to_list(t6), 'count': len(t6), 'label': 'Put Sells',
                          'description': 'OTM Puts, Δ∈[-0.30,-0.15], IV>HV, ranked by ann. ROC',
                          'emoji': '💰', 'color': 'amber'},
            'gamma_lottos': {'data': _to_list(t7), 'count': len(t7), 'label': 'Gamma Lottos',
                             'description': 'OTM Calls <$1, DTE<14, near Gamma Wall',
                             'emoji': '🎰', 'color': 'orange'},
            'bull_spreads': {'data': t8[:20], 'count': len(t8), 'label': 'Bull Put Spreads',
                             'description': 'OTM puts, Short IV>HV, net Δ>0, max P/M ratio',
                             'emoji': '📈', 'color': 'emerald'},
            'bear_spreads': {'data': t9[:20], 'count': len(t9), 'label': 'Bear Call Spreads',
                             'description': 'OTM calls, Short IV>HV, net Δ<0, max P/M ratio',
                             'emoji': '📉', 'color': 'rose'},
        },
        'structural': {
            'gamma_squeeze': {'data': squeeze[:20], 'count': len(squeeze),
                              'label': 'Gamma Squeeze Vulnerability'},
            'vrp_asymmetry': {'data': vrp_asym[:20], 'count': len(vrp_asym),
                              'label': 'VRP Asymmetry Play'},
        },
        'gex_summary': {
            'short_gamma': short_gamma_count,
            'long_gamma': long_gamma_count,
            'total_tickers': len(gex_results),
        },
        'meta': {
            'universe_size': len(spot_prices),
            'total_contracts': len(universe),
            'scan_timestamp': datetime.now().isoformat(),
        },
    }


def _empty_result():
    tabs = {}
    for key in ['bullish', 'bearish', 'conviction_calls', 'conviction_puts',
                'leaps', 'put_sells', 'gamma_lottos', 'bull_spreads', 'bear_spreads']:
        tabs[key] = {'data': [], 'count': 0, 'label': key.replace('_', ' ').title(),
                     'description': '', 'emoji': '', 'color': 'slate'}
    return {
        'tabs': tabs,
        'structural': {
            'gamma_squeeze': {'data': [], 'count': 0, 'label': 'Gamma Squeeze'},
            'vrp_asymmetry': {'data': [], 'count': 0, 'label': 'VRP Asymmetry'},
        },
        'gex_summary': {'short_gamma': 0, 'long_gamma': 0, 'total_tickers': 0},
        'meta': {'universe_size': 0, 'total_contracts': 0,
                 'scan_timestamp': datetime.now().isoformat()},
    }


# ═══════════════════════════════════════════════════════════════
# MASTER PIPELINE — Run everything end-to-end
# ═══════════════════════════════════════════════════════════════

def run_hidden_alpha_pipeline(
    max_tickers: int = 150,
    workers: int = FETCH_WORKERS,
    on_progress: Any = None,
) -> dict:
    """
    Master pipeline: fetch → Greeks → GEX → VRP → 9-tab screener.
    Stores results in memory and returns JSON-ready dict.
    Called by the background pipeline scheduler.
    """
    t0 = _time.time()
    logger.info(f"Hidden Alpha Pipeline: Starting (max {max_tickers} tickers, {workers} workers)")

    # 1. Get universe
    tickers = get_universe_tickers(max_tickers)
    logger.info(f"  Universe: {len(tickers)} tickers")

    # 2. Fetch options chains (batched, rate-limited)
    universe, spot_prices = fetch_options_universe(tickers, workers=workers, on_progress=on_progress)
    if universe.empty:
        logger.warning("  No options data retrieved — returning empty result")
        return _empty_result()

    # 3. Compute Greeks
    logger.info("  Computing vectorized BS Greeks...")
    universe = compute_vectorized_greeks(universe)
    universe = compute_skew_adjusted_delta(universe)
    logger.info(f"  Greeks done: {len(universe):,} contracts")

    # 4. Compute GEX
    logger.info("  Computing GEX profiles...")
    universe = compute_gex_profile(universe)
    gex_results = compute_all_gex(universe, spot_prices)
    logger.info(f"  GEX done: {len(gex_results)} tickers")

    # 5. Compute VRP
    logger.info("  Computing VRP (from price data)...")
    vrp_results = compute_all_vrp(universe, spot_prices)
    logger.info(f"  VRP done: {len(vrp_results)} tickers")

    # 6. Run 9-tab screener
    logger.info("  Running 9-tab screener...")
    result = run_9_tab_screener(universe, gex_results, vrp_results, spot_prices)

    elapsed = round(_time.time() - t0, 1)
    result['meta']['scan_time_seconds'] = elapsed
    result['meta']['tickers_scanned'] = len(spot_prices)

    # Log summary
    tab_counts = {k: v['count'] for k, v in result['tabs'].items()}
    logger.info(f"  Pipeline complete in {elapsed}s — {sum(tab_counts.values())} total signals")
    for tab, count in tab_counts.items():
        if count > 0:
            logger.info(f"    {tab}: {count}")

    return result
