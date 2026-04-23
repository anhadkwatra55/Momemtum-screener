"""
options_alpha.py — Alpha-Flow Options Intelligence Pipeline (v3.1 — Optimized)
================================================================================
Incorporates GEX, VRP, Vectorized Greeks, Skew-Adjusted Delta, and 9 Strategy Tabs.

v3.1 Optimizations:
  - TTL-based memory cache for price history (avoids redundant yfinance downloads)
  - Pre-filter expirations by DTE range before downloading chains
  - Batch-build chain DataFrames with list-of-dicts instead of repeated pd.concat
  - Graceful per-ticker error handling with retry + exponential backoff
  - Reduced temporary DataFrame allocations in fetch_single_ticker
"""
from __future__ import annotations
import logging
import math
import random
import time as _time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
import numpy as np
import pandas as pd
from scipy.stats import norm
import yfinance as yf

logger = logging.getLogger("options_alpha")

try:
    import momentum_config as cfg
except ImportError:
    from pipelines import momentum_config as cfg

CONTRACT_SIZE = 100
FC = {
    'BULLISH_VOL_OI_RATIO': 2.5, 'BULLISH_MIN_VOL': 500, 'BULLISH_MAX_DTE': 45, 'BULLISH_VRP_PCTL': 0.75,
    'BEARISH_VOL_OI_RATIO': 2.5, 'BEARISH_MIN_VOL': 500, 'BEARISH_MAX_DTE': 45, 'BEARISH_VRP_PCTL': 0.75,
    'CONVICTION_CALL_MIN_PREM_ABS': 25000, 'CONVICTION_CALL_MIN_DELTA': 0.30, 'CONVICTION_CALL_ZG_PROX': 0.05,
    'CONVICTION_PUT_MIN_PREM_ABS': 25000,
    'LEAPS_MIN_DTE': 365, 'LEAPS_FALLBACK_DTE': 180, 'LEAPS_MIN_OI': 50, 'LEAPS_MONEYNESS_LOW': 0.80, 'LEAPS_MONEYNESS_HIGH': 1.20,
    'PUT_SELL_DELTA_LOW': -0.30, 'PUT_SELL_DELTA_HIGH': -0.15, 'PUT_SELL_MIN_DTE': 15, 'PUT_SELL_MAX_DTE': 60, 'PUT_SELL_MIN_VOL': 50,
    'CHEAP_MAX_PRICE': 1.00, 'CHEAP_MIN_PRICE': 0.01, 'CHEAP_MAX_DTE': 14, 'CHEAP_MIN_VOL': 50, 'CHEAP_WALL_PROX': 0.015,
}

# ── TTL Memory Cache ─────────────────────────────────────────────────────────
# Thread-safe cache for price history to avoid redundant yfinance downloads
# when the scanner runs multiple times within the TTL window.

_cache_lock = threading.Lock()
_price_cache: dict[str, tuple[float, pd.DataFrame]] = {}  # sym -> (timestamp, hist_df)
_CACHE_TTL_SECONDS = 300  # 5 minutes

def _get_cached_history(sym: str) -> pd.DataFrame | None:
    with _cache_lock:
        entry = _price_cache.get(sym)
        if entry is None:
            return None
        ts, hist = entry
        if _time.monotonic() - ts > _CACHE_TTL_SECONDS:
            del _price_cache[sym]
            return None
        return hist

def _set_cached_history(sym: str, hist: pd.DataFrame):
    with _cache_lock:
        _price_cache[sym] = (_time.monotonic(), hist)

def clear_price_cache():
    """Manually flush the price history cache."""
    with _cache_lock:
        _price_cache.clear()


# 1. CORE MATH
def compute_vectorized_greeks(df, r=0.043):
    S = df['spot'].values.astype(np.float64)
    K = df['strike'].values.astype(np.float64)
    T = np.maximum(df['T'].values.astype(np.float64), 1e-8)
    sigma = np.maximum(df['impliedVolatility'].values.astype(np.float64), 1e-8)
    is_call = (df['option_type'] == 'call').values
    sqT = np.sqrt(T)
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * sqT)
    d2 = d1 - sigma * sqT
    Nd1 = norm.cdf(d1)
    Nd2 = norm.cdf(d2)
    nd1 = norm.pdf(d1)
    eRT = np.exp(-r * T)
    delta = np.where(is_call, Nd1, Nd1 - 1.0)
    gamma = nd1 / (S * sigma * sqT)
    vega = S * nd1 * sqT / 100.0
    theta = np.where(
        is_call,
        (-(S * nd1 * sigma) / (2.0 * sqT) - r * K * eRT * Nd2) / 365.0,
        (-(S * nd1 * sigma) / (2.0 * sqT) + r * K * eRT * norm.cdf(-d2)) / 365.0,
    )
    dollar_gamma = gamma * S**2 / 100.0
    out = df.copy()
    out['delta'] = delta
    out['gamma'] = gamma
    out['theta'] = theta
    out['vega'] = vega
    out['dollar_gamma'] = dollar_gamma
    return out

def compute_skew_adjusted_delta(df):
    df = df.sort_values(['ticker', 'expiry', 'option_type', 'strike']).reset_index(drop=True)
    dIV_dK = np.zeros(len(df))
    for _, idx in df.groupby(['ticker', 'expiry', 'option_type']).groups.items():
        idx_arr = np.array(idx)
        if len(idx_arr) < 3: continue
        sub = df.loc[idx_arr]
        dIV_dK[idx_arr] = np.gradient(sub['impliedVolatility'].values, sub['strike'].values)
    df['dIV_dK'] = dIV_dK
    df['dIV_dSpot'] = -df['dIV_dK']
    df['skew_adj_delta'] = df['delta'] + (df['vega'] * 100.0) * df['dIV_dSpot']
    df['total_premium'] = df['mid_price'] * CONTRACT_SIZE
    return df

def compute_gex_profile(df):
    df = df.copy()
    df['contract_gex'] = np.where(
        df['option_type'] == 'call',
        df['openInterest'] * df['dollar_gamma'] * CONTRACT_SIZE,
       -df['openInterest'] * df['dollar_gamma'] * CONTRACT_SIZE,
    )
    return df

def gex_by_strike(df, ticker):
    t = df[df['ticker'] == ticker]
    cg = t[t['option_type'] == 'call'].groupby('strike')['contract_gex'].sum()
    pg = t[t['option_type'] == 'put'].groupby('strike')['contract_gex'].sum()
    g = pd.DataFrame({'call_gex': cg, 'put_gex': pg}).fillna(0)
    g['net_gex'] = g['call_gex'] + g['put_gex']
    g['cum_gex'] = g['net_gex'].cumsum()
    return g.sort_index().reset_index()

def find_zero_gamma(gex_df):
    cum = gex_df['cum_gex'].values
    strikes = gex_df['strike'].values
    flips = np.where(np.diff(np.sign(cum)))[0]
    if len(flips) == 0: return strikes[np.argmin(np.abs(cum))]
    i = flips[0]
    s1, s2 = strikes[i], strikes[i+1]
    g1, g2 = cum[i], cum[i+1]
    return s1 + (s2 - s1) * (-g1) / (g2 - g1) if g2 != g1 else (s1+s2)/2

def compute_discrete_iv2(df, ticker, r=0.043):
    t = df[df['ticker'] == ticker]
    if t.empty:
        return 0, 0, 0, 0, None
    spot = t['spot'].iloc[0]
    exp_dte = t.groupby('expiry')['dte'].first()
    best_exp = exp_dte.iloc[(exp_dte - 30).abs().argsort()[:1]].index[0]
    edf = t[t['expiry'] == best_exp]
    T = edf['T'].iloc[0]
    dte = int(edf['dte'].iloc[0])
    F = spot * np.exp(r * T)

    calls = edf[edf['option_type'] == 'call'].sort_values('strike')
    puts  = edf[edf['option_type'] == 'put'].sort_values('strike')
    all_k = np.sort(edf['strike'].unique())
    if len(all_k) == 0: return 0, 0, 0, dte, best_exp
    K0 = all_k[all_k <= F][-1] if (all_k <= F).any() else all_k[0]

    rows = []
    for _, r_ in puts[puts['strike'] < K0].iterrows(): rows.append((r_['strike'], r_['mid_price'], 'bad'))
    k0p = puts[puts['strike'] == K0]
    k0c = calls[calls['strike'] == K0]
    if not k0p.empty and not k0c.empty: rows.append((K0, (k0p['mid_price'].iloc[0]+k0c['mid_price'].iloc[0])/2, 'both'))
    elif not k0p.empty: rows.append((K0, k0p['mid_price'].iloc[0], 'bad'))
    elif not k0c.empty: rows.append((K0, k0c['mid_price'].iloc[0], 'good'))
    for _, r_ in calls[calls['strike'] > K0].iterrows(): rows.append((r_['strike'], r_['mid_price'], 'good'))

    if len(rows) < 2: return 0, 0, 0, dte, best_exp
    strip = pd.DataFrame(rows, columns=['K', 'Q', 'comp']).sort_values('K').reset_index(drop=True)
    Kv = strip['K'].values
    dK = np.empty(len(Kv))
    dK[0] = Kv[1] - Kv[0]
    dK[-1] = Kv[-1] - Kv[-2]
    dK[1:-1] = (Kv[2:] - Kv[:-2]) / 2.0
    contrib = (dK / Kv**2) * np.exp(r * T) * strip['Q'].values
    strip['c'] = contrib

    total_iv2 = (2.0/T) * contrib.sum() - (1.0/T)*((F/K0)-1)**2
    bad_iv2   = (2.0/T) * strip.loc[strip['comp'].isin(['bad','both']), 'c'].sum()
    good_iv2  = (2.0/T) * strip.loc[strip['comp'].isin(['good','both']), 'c'].sum()
    return total_iv2, bad_iv2, good_iv2, dte, best_exp


# 2. FETCHING — Optimized
def fetch_single_ticker(sym, min_dte=7, max_dte=180, _retries=2):
    """Fetch option chains for a single ticker with retry logic and DTE pre-filtering.

    Optimizations vs v3:
      - Uses TTL cache for 21-day price history
      - Pre-filters expiration dates by DTE range BEFORE downloading chains
      - Builds rows as list-of-dicts, single pd.concat at the end
      - Retry with exponential backoff on transient failures
    """
    last_err = None
    for attempt in range(_retries + 1):
        try:
            return _fetch_single_ticker_inner(sym, min_dte, max_dte)
        except Exception as e:
            last_err = str(e)[:80]
            if attempt < _retries:
                backoff = (0.5 * (2 ** attempt)) + random.uniform(0, 0.3)
                logger.debug(f"[{sym}] Attempt {attempt+1} failed, retrying in {backoff:.1f}s: {last_err}")
                _time.sleep(backoff)
    logger.warning(f"[{sym}] All {_retries+1} attempts failed: {last_err}")
    return sym, None, None, 0, last_err


def _fetch_single_ticker_inner(sym, min_dte, max_dte):
    """Core fetch logic — no retry wrapper."""
    tkr = yf.Ticker(sym)

    # ── Cached price history ──
    hist = _get_cached_history(sym)
    if hist is None:
        hist = tkr.history(period='21d')
        if hist is not None and not hist.empty:
            _set_cached_history(sym, hist)

    if hist is None or hist.empty:
        return sym, None, None, 0, "no price data"

    spot = float(hist['Close'].iloc[-1])
    if spot < 1.0:
        return sym, None, None, 0, "penny stock"

    lr = np.log(hist['Close'] / hist['Close'].shift(1)).dropna().values
    rv2 = np.sum(lr**2) * (252.0 / 21.0)

    # ── Pre-filter expirations by DTE ──
    try:
        expiries = tkr.options
    except Exception:
        return sym, spot, None, rv2, "no options available"

    if not expiries:
        return sym, spot, None, rv2, "no expirations"

    today = datetime.now().date()
    valid_expiries = []
    for exp_str in expiries:
        exp_date = datetime.strptime(exp_str, '%Y-%m-%d').date()
        dte = (exp_date - today).days
        if min_dte <= dte <= max_dte:
            valid_expiries.append((exp_str, dte))

    if not valid_expiries:
        return sym, spot, None, rv2, "no valid expirations in DTE range"

    # ── Fetch only relevant chains, build rows efficiently ──
    chain_frames = []
    for exp_str, dte in valid_expiries:
        try:
            chain = tkr.option_chain(exp_str)
        except Exception as e:
            logger.debug(f"[{sym}] Skipping {exp_str}: {e}")
            continue

        T_val = max(dte / 365.0, 1e-5)

        for opt_type, frame in [('call', chain.calls), ('put', chain.puts)]:
            if frame.empty:
                continue
            tmp = frame.copy()
            tmp['ticker'] = sym
            tmp['spot'] = spot
            tmp['expiry'] = exp_str
            tmp['dte'] = dte
            tmp['T'] = T_val
            tmp['option_type'] = opt_type
            tmp['mid_price'] = (tmp['bid'] + tmp['ask']) / 2.0
            chain_frames.append(tmp)

    if not chain_frames:
        return sym, spot, None, rv2, "no valid chains"

    df = pd.concat(chain_frames, ignore_index=True)
    return sym, spot, df, rv2, None


def get_alpha_calls(limit=75, max_workers=4, sort_by="quant_score", universe="sp500", **kwargs):
    try:
        import db as _db
    except ImportError:
        from pipelines import db as _db

    validated = _db.get_validated_tickers(min_price=25.0)
    if validated and len(validated) >= 20:
        if universe == "nasdaq100":
            tech_set = set(cfg.UNIVERSE.get("Technology", []))
            tickers = [t for t in validated if t in tech_set]
            src = f"Technology ({len(tickers)} validated)"
        else:
            tickers = validated
            src = f"Validated Universe ({len(tickers)} tickers)"
    else:
        if universe == "nasdaq100":
            tickers = cfg.UNIVERSE.get("Technology", [])
            src = "Technology (config)"
        else:
            tickers = cfg.STOCK_TICKERS
            src = "S&P 1500 (config)"

    scan_tickers = tickers[:limit]
    
    all_chains = []
    spot_prices = {}
    rv2_cache = {}
    errors = 0
    t0 = _time.monotonic()

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(fetch_single_ticker, t): t for t in scan_tickers}
        for f in as_completed(futures):
            sym, spot, df, rv2, err = f.result()
            if err: errors += 1
            else:
                spot_prices[sym] = spot
                rv2_cache[sym] = rv2
                if df is not None: all_chains.append(df)
                
    if not all_chains:
        return {"calls": [], "meta": {"error": "No data", "universe_size": len(tickers)}, "timestamp": datetime.now().isoformat()}

    df = pd.concat(all_chains, ignore_index=True)
    df = df.dropna(subset=['strike', 'volume', 'openInterest', 'impliedVolatility'])
    df['impliedVolatility'] = np.maximum(df['impliedVolatility'], 0.001)
    df = df[(df['volume'] > 0) & (df['openInterest'] > 0)]
    df['moneyness_ratio'] = df['strike'] / df['spot']
    
    df = compute_vectorized_greeks(df)
    df = compute_skew_adjusted_delta(df)
    df = compute_gex_profile(df)
    
    # Structural features
    df['bad_vrp'] = 0.0
    df['good_vrp'] = 0.0
    df['total_net_gex'] = 0.0
    df['zero_gamma_level'] = 0.0
    df['gamma_wall_strike'] = 0.0
    df['hv'] = 0.0
    
    for tkr in spot_prices.keys():
        mask = df['ticker'] == tkr
        g = gex_by_strike(df, tkr)
        if not g.empty:
            df.loc[mask, 'total_net_gex'] = g['net_gex'].sum()
            df.loc[mask, 'zero_gamma_level'] = find_zero_gamma(g)
            wall_idx = g['net_gex'].abs().idxmax()
            df.loc[mask, 'gamma_wall_strike'] = g.loc[wall_idx, 'strike']
            
        tiv, biv, giv, _, _ = compute_discrete_iv2(df, tkr)
        trv = rv2_cache.get(tkr, 0)
        df.loc[mask, 'hv'] = np.sqrt(max(0, trv))
        df.loc[mask, 'bad_vrp'] = max(0, biv - trv) if biv else 0
        df.loc[mask, 'good_vrp'] = max(0, giv - trv) if giv else 0

    df['strategy_category'] = ""
    calls = df[df['option_type'] == 'call'].copy()
    puts = df[df['option_type'] == 'put'].copy()

    good_vrp_75 = calls['good_vrp'].quantile(FC['BULLISH_VRP_PCTL']) if not calls.empty else 0
    bad_vrp_75 = puts['bad_vrp'].quantile(FC['BEARISH_VRP_PCTL']) if not puts.empty else 0
    
    # 1. Bullish
    mask_bull = (calls['volume'] > calls['openInterest'] * FC['BULLISH_VOL_OI_RATIO']) & (calls['volume'] > FC['BULLISH_MIN_VOL']) & (calls['dte'] < FC['BULLISH_MAX_DTE']) & (calls['good_vrp'] >= good_vrp_75)
    df.loc[calls[mask_bull].index, 'strategy_category'] += "unusually_bullish,"

    # 2. Bearish
    mask_bear = (puts['volume'] > puts['openInterest'] * FC['BEARISH_VOL_OI_RATIO']) & (puts['volume'] > FC['BEARISH_MIN_VOL']) & (puts['dte'] < FC['BEARISH_MAX_DTE']) & (puts['bad_vrp'] >= bad_vrp_75)
    df.loc[puts[mask_bear].index, 'strategy_category'] += "unusually_bearish,"

    # 3. Conviction Calls
    call_prem = max(calls['total_premium'].quantile(0.95), FC['CONVICTION_CALL_MIN_PREM_ABS']) if not calls.empty else 25000
    mask_cc = (calls['total_premium'] > call_prem) & (calls['skew_adj_delta'] > FC['CONVICTION_CALL_MIN_DELTA']) & (((calls['spot'] - calls['zero_gamma_level']).abs() / calls['spot']) < FC['CONVICTION_CALL_ZG_PROX'])
    df.loc[calls[mask_cc].index, 'strategy_category'] += "conviction_calls,"

    # 4. Conviction Puts
    put_prem = max(puts['total_premium'].quantile(0.95), FC['CONVICTION_PUT_MIN_PREM_ABS']) if not puts.empty else 25000
    mask_cp = (puts['total_premium'] > put_prem) & (puts['total_net_gex'] < 0)
    df.loc[puts[mask_cp].index, 'strategy_category'] += "conviction_puts,"

    # 5. LEAPS
    mask_leaps = (calls['dte'] > FC['LEAPS_FALLBACK_DTE']) & (calls['impliedVolatility'] < calls['hv']) & (calls['openInterest'] >= FC['LEAPS_MIN_OI']) & (calls['moneyness_ratio'] >= FC['LEAPS_MONEYNESS_LOW']) & (calls['moneyness_ratio'] <= FC['LEAPS_MONEYNESS_HIGH'])
    df.loc[calls[mask_leaps].index, 'strategy_category'] += "leaps,"

    # 6. Put Sells
    mask_ps = (puts['strike'] < puts['spot']) & (puts['delta'].between(FC['PUT_SELL_DELTA_LOW'], FC['PUT_SELL_DELTA_HIGH'])) & (puts['dte'] > FC['PUT_SELL_MIN_DTE']) & (puts['dte'] < FC['PUT_SELL_MAX_DTE']) & (puts['impliedVolatility'] > puts['hv']) & (puts['volume'] > FC['PUT_SELL_MIN_VOL'])
    df.loc[puts[mask_ps].index, 'strategy_category'] += "put_sells,"

    # 7. Cheap Calls
    mask_cheap = (calls['mid_price'] < FC['CHEAP_MAX_PRICE']) & (calls['strike'] > calls['spot']) & (calls['dte'] < FC['CHEAP_MAX_DTE']) & (calls['volume'] > FC['CHEAP_MIN_VOL']) & (((calls['spot'] - calls['gamma_wall_strike']).abs() / calls['spot']) < FC['CHEAP_WALL_PROX'])
    df.loc[calls[mask_cheap].index, 'strategy_category'] += "cheap_calls,"
    
    # Base masks for backward compatibility
    mask_swing = (calls['dte'].between(21, 90)) & (calls['delta'].between(0.35, 0.60)) & (calls['mid_price'].between(0.5, 8.0))
    df.loc[calls[mask_swing].index, 'strategy_category'] += "swing,"
    
    # Fallback to keep everything that passed any rule
    final_df = df[df['strategy_category'] != ""]
    
    # Calculate score
    final_df['quant_score'] = 50 + (np.clip(final_df['good_vrp'], 0, 1) * 30) + (np.clip(final_df['openInterest']/1000, 0, 5) * 4)

    all_calls = []
    for _, r in final_df.iterrows():
        categories = [c for c in r['strategy_category'].split(",") if c]
        for cat in categories:
            all_calls.append({
                "ticker": r['ticker'],
                "stock_price": round(r['spot'], 2),
                "strike": float(r['strike']),
                "expiration": r['expiry'],
                "dte": int(r['dte']),
                "bid": round(r['bid'], 2),
                "ask": round(r['ask'], 2),
                "mid_price": round(r['mid_price'], 2),
                "delta": float(r['delta']),
                "pop": float(max(0, min(1, r['delta'] * 0.85)) if r['option_type']=='call' else max(0, min(1, -r['delta']))),
                "vol_edge": float(max(0, r['hv'] - r['impliedVolatility'])),
                "breakeven_pct": round(r['total_premium']/r['spot']*100, 2),
                "open_interest": int(r['openInterest']),
                "volume": int(r['volume']),
                "implied_volatility": round(r['impliedVolatility'] * 100, 1),
                "spread_pct": round((r['ask'] - r['bid']) / r['mid_price'] * 100, 1) if r['mid_price'] > 0 else 0,
                "quant_score": round(r['quant_score'], 2),
                "moneyness": "ATM" if abs(r['moneyness_ratio'] - 1) < 0.03 else "OTM",
                "strategy_category": cat,
                "skew_adj_delta": float(r['skew_adj_delta']),
                "dollar_gamma": float(r['dollar_gamma']),
                "contract_gex": float(r['contract_gex']),
                "bad_vrp": float(r['bad_vrp']),
                "good_vrp": float(r['good_vrp'])
            })

    # Sort
    all_calls.sort(key=lambda x: x.get(sort_by, 0), reverse=True)

    scan_elapsed = round(_time.monotonic() - t0, 1)
    tickers_with_calls = len(set(c["ticker"] for c in all_calls))
    
    return {
        "calls": all_calls,
        "meta": {
            "universe_source": src, "universe_size": len(tickers),
            "tickers_scanned": len(scan_tickers), "contracts_found": len(all_calls),
            "tickers_with_calls": tickers_with_calls, "errors": errors, "partial": False,
            "scan_time_seconds": scan_elapsed,
        },
        "timestamp": datetime.now().isoformat(),
    }

def run_alpha_pipeline(universe="sp500", max_workers=4, limit=500):
    try: import db
    except ImportError: from pipelines import db
    result = get_alpha_calls(limit=limit, max_workers=max_workers, universe=universe)
    db.upsert_alpha_calls_bulk(result.get("calls", []), universe, result.get("meta", {}))
    return result.get("meta", {})
