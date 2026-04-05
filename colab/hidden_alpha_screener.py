# %% [markdown]
# # 🔬 Hidden Alpha Options Screener — Colab Prototype
# **Mathematical Validation Notebook**
#
# Validates GEX, VRP, GTBR & Credit Spread engines before porting to Next.js/FastAPI.
#
# **Proxies Applied (Street Quants)**:
# - GEX: SqueezeMetrics (MM short all calls, long all puts)
# - Greeks: Vectorized Black-Scholes (pseudo-European) + Skew-Adjusted Delta
# - UOA: Volume > OI×2.5, DTE < 21, Premium > $100k
# - VRP: Discrete VIX-style summation → Bad/Good decomposition

# %%
# ═══════════════════════════════════════════════════════════════
# MODULE 0: ENVIRONMENT SETUP
# ═══════════════════════════════════════════════════════════════
# Uncomment the line below when running in Google Colab:
# !pip install yfinance pandas numpy scipy lxml requests -q

import numpy as np
import pandas as pd
from scipy.stats import norm
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import yfinance as yf
import requests
import io
import time
import warnings
warnings.filterwarnings('ignore')

pd.set_option('display.max_columns', 30)
pd.set_option('display.width', 200)
pd.set_option('display.float_format', '{:.4f}'.format)

# ══════════════════════════════════════════════════════════════
# 🎛️  MASTER CONFIGURATION — ADJUST THESE KNOBS
# ══════════════════════════════════════════════════════════════

# ── Universe & Fetch ──
USE_SP500        = True          # True = S&P 500 pre-filter, False = manual TICKERS list
MANUAL_TICKERS   = ['SPY', 'NVDA', 'AAPL', 'TSLA', 'AMD', 'META', 'MSFT', 'AMZN', 'GOOGL', 'NFLX']
MAX_TICKERS      = 200           # Cap after pre-filter (None = no cap)
FETCH_WORKERS    = 10            # Parallel threads for yfinance
FETCH_BATCH_SIZE = 25            # Tickers per batch (rate limit safety)
RISK_FREE_RATE   = 0.043         # ~4.3% Fed Funds / 10Y
MIN_DTE          = 1
MAX_DTE          = 730           # Extended for LEAPS
CONTRACT_SIZE    = 100

# ── Pre-Filter Thresholds (S&P 500 → ~100-200 names) ──
PREFILTER = {
    'MIN_MARKET_CAP':   10_000_000_000,  # $10B+ only (large caps)
    'MIN_AVG_VOLUME':   2_000_000,       # 2M+ shares/day liquidity
    'MIN_MOMENTUM_20D': 0.0,             # 20-day return > 0% (positive momentum)
    'MIN_VOLATILITY':   0.15,            # 15% annualized vol floor (we want movement)
    'MAX_VOLATILITY':   2.00,            # 200% cap (avoid broken tickers)
    'MIN_OPTION_VOLUME': True,           # Must have listed options
}

# ── Filter Settings for 9 Tabs ──
FILTER_CONFIG = {
    # Tab 1: Unusually Bullish
    'BULLISH_VOL_OI_RATIO':  2.5,   # Volume / OI threshold
    'BULLISH_MIN_VOL':       500,   # Volume floor
    'BULLISH_MAX_DTE':       45,    # DTE ceiling
    'BULLISH_VRP_PCTL':      0.75,  # Good VRP percentile

    # Tab 2: Unusually Bearish
    'BEARISH_VOL_OI_RATIO':  2.5,
    'BEARISH_MIN_VOL':       500,
    'BEARISH_MAX_DTE':       45,
    'BEARISH_VRP_PCTL':      0.75,  # Bad VRP percentile

    # Tab 3: Deep Conviction Calls (percentile-based premium)
    'CONVICTION_CALL_PREM_PCTL':    0.95,     # Top 5% by premium
    'CONVICTION_CALL_MIN_PREM_ABS': 25_000,   # $25k floor (still meaningful)
    'CONVICTION_CALL_MIN_DELTA':    0.30,     # Skew-adj delta (relaxed from 0.50)
    'CONVICTION_CALL_ZG_PROX':      0.05,     # 5% from Zero Gamma (relaxed from 2%)

    # Tab 4: Deep Conviction Puts (percentile-based premium)
    'CONVICTION_PUT_PREM_PCTL':     0.95,
    'CONVICTION_PUT_MIN_PREM_ABS':  25_000,

    # Tab 5: LEAPS
    'LEAPS_MIN_DTE':         365,
    'LEAPS_FALLBACK_DTE':    180,
    'LEAPS_MIN_OI':          50,      # Min open interest (kill 1-lot garbage)
    'LEAPS_MONEYNESS_LOW':   0.80,    # 80% of spot (no deep ITM junk)
    'LEAPS_MONEYNESS_HIGH':  1.20,    # 120% of spot (no far OTM lottos)

    # Tab 6: Put Sells
    'PUT_SELL_DELTA_LOW':    -0.30,
    'PUT_SELL_DELTA_HIGH':   -0.15,
    'PUT_SELL_MIN_DTE':      15,
    'PUT_SELL_MAX_DTE':      60,
    'PUT_SELL_MIN_VOL':      50,

    # Tab 7: Cheap Calls (Gamma Lottos)
    'CHEAP_MAX_PRICE':       1.00,
    'CHEAP_MIN_PRICE':       0.01,
    'CHEAP_MAX_DTE':         14,
    'CHEAP_MIN_VOL':         50,
    'CHEAP_WALL_PROX':       0.015,  # 1.5% from Gamma Wall

    # Tabs 8-9: Credit Spreads
    'SPREAD_MIN_DTE':        7,
    'SPREAD_MAX_DTE':        60,
    'SPREAD_MIN_PRICE':      0.10,
    'SPREAD_MIN_MARGIN':     0.20,    # Min $0.20 margin (prevents PTM blow-up)
    'SPREAD_MAX_PTM':        10.0,    # Cap PTM ratio (>10x = bad data)
    'SPREAD_TOP_N':          15,

    # Fallback relaxation
    'RELAXED_PREM':          25_000,  # Reduced from $50k
}

FC = FILTER_CONFIG  # shorthand alias

print("✅ Environment loaded")
print(f"   Universe: {'S&P 500 pre-filter' if USE_SP500 else 'Manual list'}")
print(f"   Max tickers: {MAX_TICKERS or 'unlimited'}")
print(f"   Risk-Free Rate: {RISK_FREE_RATE:.1%}")
print(f"   DTE Range: [{MIN_DTE}, {MAX_DTE}]")
print(f"   Fetch workers: {FETCH_WORKERS}")

# %%
# ═══════════════════════════════════════════════════════════════
# MODULE 0.5: S&P 500 PRE-FILTER (Momentum × Volatility × Liquidity)
# ═══════════════════════════════════════════════════════════════
#
#   Pass 1 — FAST: Download 60 days of daily prices for all S&P 500
#            stocks in a single yf.download() call (~5 seconds).
#   Pass 2 — SCORE: Rank by momentum × volatility × liquidity
#   Pass 3 — CUT: Keep top N for expensive options chain fetching
#
#   This turns 503 tickers → ~100-200 "hot" names in seconds.

def get_sp500_tickers():
    """Fetch S&P 500 constituents from Wikipedia with proper headers."""
    url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                      'AppleWebKit/537.36 (KHTML, like Gecko) '
                      'Chrome/120.0.0.0 Safari/537.36'
    }
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        tables = pd.read_html(io.StringIO(resp.text))
        tickers = tables[0]['Symbol'].str.replace('.', '-', regex=False).tolist()
        print(f"   📋 {len(tickers)} S&P 500 tickers loaded from Wikipedia")
        return tickers
    except Exception as e:
        print(f"   ⚠️ Wikipedia scrape failed: {e}")
        print(f"   Falling back to manual list")
        return MANUAL_TICKERS


def prefilter_universe(tickers, config=PREFILTER):
    """
    Fast pre-filter: single bulk download → compute momentum, volatility,
    liquidity scores → return ranked subset.
    """
    print(f"\n{'='*60}")
    print(f"⚡ PRE-FILTER: Screening {len(tickers)} tickers...")
    print(f"   Downloading 60-day price history (bulk)...")

    # Single bulk download — extremely fast
    t0 = time.time()
    data = yf.download(tickers, period='60d', group_by='ticker',
                       auto_adjust=True, progress=False, threads=True)
    elapsed = time.time() - t0
    print(f"   ✅ Bulk download complete in {elapsed:.1f}s")

    results = []
    for sym in tickers:
        try:
            if len(tickers) > 1:
                close = data[sym]['Close'].dropna()
                volume = data[sym]['Volume'].dropna()
            else:
                close = data['Close'].dropna()
                volume = data['Volume'].dropna()

            if len(close) < 20:
                continue

            # Metrics
            avg_vol = float(volume.tail(20).mean())
            returns = close.pct_change().dropna()
            mom_20d = float((close.iloc[-1] / close.iloc[-20]) - 1)
            ann_vol = float(returns.tail(20).std() * np.sqrt(252))
            last_price = float(close.iloc[-1])

            # Quick market cap proxy (price × avg volume as liquidity score)
            liquidity_score = last_price * avg_vol

            results.append({
                'ticker': sym,
                'price': last_price,
                'avg_volume': avg_vol,
                'momentum_20d': mom_20d,
                'ann_volatility': ann_vol,
                'liquidity_score': liquidity_score,
            })
        except Exception:
            continue

    df = pd.DataFrame(results)
    print(f"   📊 {len(df)} tickers with valid price data")

    # ── Apply filters ──
    pre = len(df)
    df = df[df['avg_volume'] >= config['MIN_AVG_VOLUME']]
    print(f"   Filter: Volume ≥ {config['MIN_AVG_VOLUME']/1e6:.0f}M → {len(df)} remain")

    df = df[df['ann_volatility'] >= config['MIN_VOLATILITY']]
    df = df[df['ann_volatility'] <= config['MAX_VOLATILITY']]
    print(f"   Filter: Vol ∈ [{config['MIN_VOLATILITY']:.0%}, {config['MAX_VOLATILITY']:.0%}] → {len(df)} remain")

    # We don't force positive momentum — but we score it
    # df = df[df['momentum_20d'] >= config['MIN_MOMENTUM_20D']]

    # ── Composite score: momentum × volatility × liquidity ──
    # Normalize each factor to [0,1] then combine
    for col in ['momentum_20d', 'ann_volatility', 'liquidity_score']:
        mn, mx = df[col].min(), df[col].max()
        if mx > mn:
            df[f'{col}_norm'] = (df[col] - mn) / (mx - mn)
        else:
            df[f'{col}_norm'] = 0.5

    df['alpha_score'] = (
        0.35 * df['momentum_20d_norm'] +      # Momentum matters most
        0.35 * df['ann_volatility_norm'] +     # Want high vol = more premium
        0.30 * df['liquidity_score_norm']      # Need liquidity
    )
    df = df.sort_values('alpha_score', ascending=False)

    print(f"\n   🏆 Top 10 by Alpha Score:")
    show = df.head(10)[['ticker','price','momentum_20d','ann_volatility','alpha_score']]
    show_fmt = show.copy()
    show_fmt['momentum_20d'] = show_fmt['momentum_20d'].map('{:+.1%}'.format)
    show_fmt['ann_volatility'] = show_fmt['ann_volatility'].map('{:.1%}'.format)
    show_fmt['alpha_score'] = show_fmt['alpha_score'].map('{:.3f}'.format)
    print(show_fmt.to_string(index=False))

    filtered = df['ticker'].tolist()
    print(f"\n   ✅ Pre-filter: {pre} → {len(filtered)} tickers passed")
    return filtered, data  # Return raw price data for reuse


# ── Execute pre-filter ──
PRICE_CACHE = None  # Global cache for 60d price data
if USE_SP500:
    raw_tickers = get_sp500_tickers()
    filtered_tickers, PRICE_CACHE = prefilter_universe(raw_tickers)
else:
    filtered_tickers = MANUAL_TICKERS
    print(f"\n   Using manual ticker list: {filtered_tickers}")
    # Bulk download for manual list too
    print("   Downloading price history for manual list...")
    PRICE_CACHE = yf.download(filtered_tickers, period='60d', group_by='ticker',
                              auto_adjust=True, progress=False, threads=True)

# Apply cap
if MAX_TICKERS and len(filtered_tickers) > MAX_TICKERS:
    filtered_tickers = filtered_tickers[:MAX_TICKERS]
    print(f"   📉 Capped to top {MAX_TICKERS} tickers")

# Always include SPY for GEX reference
if 'SPY' not in filtered_tickers:
    filtered_tickers.insert(0, 'SPY')

TICKERS = filtered_tickers
print(f"\n   🎯 Final universe: {len(TICKERS)} tickers")
print(f"   {TICKERS[:20]}{'...' if len(TICKERS) > 20 else ''}")

# %%
# ═══════════════════════════════════════════════════════════════
# MODULE 1: PARALLEL DATA INGESTION & SURFACE PREP
# ═══════════════════════════════════════════════════════════════
#
#   ThreadPoolExecutor fetches options chains in parallel.
#   Batched to avoid yfinance rate limits.

def fetch_single_ticker(sym, min_dte=MIN_DTE, max_dte=MAX_DTE):
    """Fetch one ticker's options chain. Thread-safe."""
    try:
        tkr = yf.Ticker(sym)
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
            if dte < min_dte or dte > max_dte:
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


def fetch_options_universe(tickers, workers=FETCH_WORKERS,
                           batch_size=FETCH_BATCH_SIZE):
    """Parallel fetch with batching and progress tracking."""
    all_chains = []
    spot_prices = {}
    errors = []

    batches = [tickers[i:i+batch_size] for i in range(0, len(tickers), batch_size)]
    total = len(tickers)
    done = 0

    print(f"\n{'='*60}")
    print(f"📡 FETCHING OPTIONS CHAINS ({total} tickers, {len(batches)} batches)")
    print(f"   Workers: {workers} | Batch size: {batch_size}")
    t0 = time.time()

    for batch_idx, batch in enumerate(batches):
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(fetch_single_ticker, t): t for t in batch}
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
        print(f"   Batch {batch_idx+1}/{len(batches)} done "
              f"({done}/{total} = {pct:.0f}%) "
              f"[{len(spot_prices)} OK, {len(errors)} failed]")

        # Rate limit cooldown between batches
        if batch_idx < len(batches) - 1:
            time.sleep(1.5)

    elapsed = time.time() - t0
    print(f"\n   ⏱️  Fetch complete in {elapsed:.1f}s ({elapsed/max(len(spot_prices),1):.1f}s per ticker)")

    if errors:
        print(f"   ⚠️  {len(errors)} failures (showing first 5):")
        for e in errors[:5]:
            print(f"      {e}")

    if not all_chains:
        raise ValueError("No options data retrieved!")

    df = pd.concat(all_chains, ignore_index=True)
    raw = len(df)

    # ── Cleaning ──
    crit = ['strike', 'volume', 'openInterest', 'impliedVolatility', 'bid', 'ask']
    df = df.dropna(subset=crit)
    df = df[(df['volume'] > 0) & (df['openInterest'] > 0)]
    df = df[df['impliedVolatility'] > 0.001]
    df = df[(df['dte'] >= MIN_DTE) & (df['dte'] <= MAX_DTE)]
    df = df[df['T'] > 0]
    df['moneyness'] = df['strike'] / df['spot']
    df = df.reset_index(drop=True)

    print(f"\n{'='*60}")
    print(f"📊 UNIVERSE: {raw:,} raw → {len(df):,} clean ({len(df)/raw:.0%})")
    print(f"   Tickers: {len(spot_prices)} | Calls: {(df['option_type']=='call').sum():,} | "
          f"Puts: {(df['option_type']=='put').sum():,}")
    return df, spot_prices


universe, spot_prices = fetch_options_universe(TICKERS)


# %%
# ═══════════════════════════════════════════════════════════════
# MODULE 2: VECTORIZED GREEKS & SKEW ADJUSTMENT
# ═══════════════════════════════════════════════════════════════
#
# Black-Scholes Greeks — FULLY VECTORIZED (zero loops).
#
#   d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T)
#   d2 = d1 − σ√T
#
#   Delta_call = N(d1)         Delta_put = N(d1) − 1
#   Gamma      = φ(d1) / (S σ √T)
#   Vega       = S φ(d1) √T / 100          (per 1% IV move)
#   Theta_call = −[S φ(d1) σ/(2√T)] − rKe^{-rT}N(d2)    / 365
#   Theta_put  = −[S φ(d1) σ/(2√T)] + rKe^{-rT}N(−d2)   / 365
#
#   Dollar Gamma = Γ × S² / 100
#
# Skew-Adjusted Delta (accounts for volatility smile):
#   Δ_adj = Δ_std + Vega_abs × (dIV/dSpot)
#   Under sticky-strike: dIV/dSpot ≈ −dIV/dK   (central finite diff)

def compute_vectorized_greeks(df, r=RISK_FREE_RATE):
    """Compute BS Greeks in pure vectorized numpy. Zero loops."""
    S     = df['spot'].values.astype(np.float64)
    K     = df['strike'].values.astype(np.float64)
    T     = np.maximum(df['T'].values.astype(np.float64), 1e-8)
    sigma = np.maximum(df['impliedVolatility'].values.astype(np.float64), 1e-8)
    is_call = (df['option_type'] == 'call').values

    sqT = np.sqrt(T)
    d1  = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * sqT)
    d2  = d1 - sigma * sqT

    Nd1  = norm.cdf(d1)
    Nd2  = norm.cdf(d2)
    nd1  = norm.pdf(d1)                         # φ(d1)
    eRT  = np.exp(-r * T)

    delta = np.where(is_call, Nd1, Nd1 - 1.0)
    gamma = nd1 / (S * sigma * sqT)
    vega  = S * nd1 * sqT / 100.0                # per 1% IV
    theta = np.where(
        is_call,
        (-(S * nd1 * sigma) / (2.0 * sqT) - r * K * eRT * Nd2) / 365.0,
        (-(S * nd1 * sigma) / (2.0 * sqT) + r * K * eRT * norm.cdf(-d2)) / 365.0,
    )
    dollar_gamma = gamma * S**2 / 100.0

    out = df.copy()
    out['delta']        = delta
    out['gamma']        = gamma
    out['theta']        = theta
    out['vega']         = vega
    out['dollar_gamma'] = dollar_gamma
    return out


def compute_skew_adjusted_delta(df):
    """
    Skew-Adjusted Delta = Δ_std + Vega_abs × (dIV/dSpot)
    Sticky-strike model: dIV/dSpot ≈ −dIV/dK
    dIV/dK estimated via np.gradient (central finite differences).
    """
    df = df.sort_values(['ticker', 'expiry', 'option_type', 'strike']).reset_index(drop=True)

    # Save groupby key columns before they get dropped by apply()
    saved_ticker = df['ticker'].values.copy()
    saved_expiry = df['expiry'].values.copy()
    saved_otype  = df['option_type'].values.copy()

    # Compute dIV/dK within each (ticker, expiry, type) group
    dIV_dK = np.zeros(len(df))
    for _, idx in df.groupby(['ticker', 'expiry', 'option_type']).groups.items():
        idx_arr = np.array(idx)
        if len(idx_arr) < 3:
            continue
        sub = df.loc[idx_arr]
        dIV_dK[idx_arr] = np.gradient(sub['impliedVolatility'].values,
                                       sub['strike'].values)

    df['dIV_dK'] = dIV_dK

    # Restore columns if groupby consumed them
    if 'ticker' not in df.columns:
        df['ticker'] = saved_ticker
    if 'expiry' not in df.columns:
        df['expiry'] = saved_expiry
    if 'option_type' not in df.columns:
        df['option_type'] = saved_otype

    # dIV/dSpot ≈ −dIV/dK  (sticky-strike model)
    df['dIV_dSpot'] = -df['dIV_dK']

    # vega is per-1%-IV; dIV_dSpot is absolute IV per $1 spot →
    # multiply vega by 100 to get absolute-IV sensitivity
    df['skew_adj_delta'] = df['delta'] + (df['vega'] * 100.0) * df['dIV_dSpot']
    df['total_premium']  = df['mid_price'] * CONTRACT_SIZE
    return df


print("⚙️  Computing vectorized Black-Scholes Greeks...")
universe = compute_vectorized_greeks(universe)
print("⚙️  Computing Skew-Adjusted Delta...")
universe = compute_skew_adjusted_delta(universe)

print(f"\n✅ Greeks computed for {len(universe):,} contracts")
print(f"   Delta range       : [{universe['delta'].min():.4f}, {universe['delta'].max():.4f}]")
print(f"   Skew-Adj Δ range  : [{universe['skew_adj_delta'].min():.4f}, {universe['skew_adj_delta'].max():.4f}]")
print(f"   Dollar Γ range    : [{universe['dollar_gamma'].min():.2f}, {universe['dollar_gamma'].max():.2f}]")

print(universe[['ticker','strike','option_type','dte','impliedVolatility',
               'delta','skew_adj_delta','gamma','theta','vega','dollar_gamma']].head(10).to_string())

# %%
# ═══════════════════════════════════════════════════════════════
# MODULE 3: NET GEX PROFILE & GTBR
# ═══════════════════════════════════════════════════════════════
#
# GEX (SqueezeMetrics Proxy):
#   Call GEX = +OI × DollarΓ × 100   (MM short calls → positive for mkt)
#   Put  GEX = −OI × DollarΓ × 100   (MM long puts  → negative for mkt)
#   Net  GEX = Call GEX + Put GEX
#
# Zero Gamma Level: strike where cumulative Net GEX flips sign.
#
# GTBR = ±√( −Θ_daily / (50 × $Γ) )
# Approx GTBR ≈ ±( σ_ATM / √365 )

def compute_gex_profile(df):
    """Tag every contract with its GEX contribution."""
    df = df.copy()
    df['contract_gex'] = np.where(
        df['option_type'] == 'call',
        df['openInterest'] * df['dollar_gamma'] * CONTRACT_SIZE,
       -df['openInterest'] * df['dollar_gamma'] * CONTRACT_SIZE,
    )
    return df


def gex_by_strike(df, ticker):
    """Aggregate call/put/net GEX by strike for one ticker."""
    t = df[df['ticker'] == ticker]
    cg = t[t['option_type'] == 'call'].groupby('strike')['contract_gex'].sum()
    pg = t[t['option_type'] == 'put'].groupby('strike')['contract_gex'].sum()
    g = pd.DataFrame({'call_gex': cg, 'put_gex': pg}).fillna(0)
    g['net_gex'] = g['call_gex'] + g['put_gex']
    g['cum_gex'] = g['net_gex'].cumsum()
    return g.sort_index().reset_index()


def find_zero_gamma(gex_df):
    """Linear-interpolate the strike where cum GEX crosses zero."""
    cum = gex_df['cum_gex'].values
    strikes = gex_df['strike'].values
    flips = np.where(np.diff(np.sign(cum)))[0]
    if len(flips) == 0:
        return strikes[np.argmin(np.abs(cum))]
    i = flips[0]
    s1, s2 = strikes[i], strikes[i+1]
    g1, g2 = cum[i], cum[i+1]
    return s1 + (s2 - s1) * (-g1) / (g2 - g1) if g2 != g1 else (s1+s2)/2


def compute_gtbr(df, ticker, spot):
    """
    GTBR from near-ATM, near-term options.
    Exact:  ±√(−Θ_daily / (50×$Γ))
    Approx: ±(σ_ATM / √365)
    """
    t = df[(df['ticker'] == ticker) &
           (df['moneyness'] >= 0.97) & (df['moneyness'] <= 1.03) &
           (df['dte'] >= 1) & (df['dte'] <= 45)]
    if t.empty:
        t = df[(df['ticker'] == ticker) &
               (df['moneyness'] >= 0.90) & (df['moneyness'] <= 1.10)]
    if t.empty:
        return None, None

    w = t['openInterest'].values.astype(float)
    w_sum = w.sum()
    if w_sum == 0:
        return None, None
    avg_theta = np.average(t['theta'].values, weights=w)
    avg_dg    = np.average(t['dollar_gamma'].values, weights=w)
    avg_iv    = np.average(t['impliedVolatility'].values, weights=w)

    gtbr_exact = (np.sqrt(-avg_theta / (50.0 * avg_dg))
                  if avg_dg > 0 and avg_theta < 0 else None)
    gtbr_approx = avg_iv / np.sqrt(365.0)
    return gtbr_exact, gtbr_approx


# ── Execute Module 3 ──
print("⚙️  Computing GEX profiles...")
universe = compute_gex_profile(universe)

gex_results = {}
for ticker in TICKERS:
    if ticker not in spot_prices:
        continue
    spot = spot_prices[ticker]
    gp = gex_by_strike(universe, ticker)
    zg = find_zero_gamma(gp)
    gtbr_e, gtbr_a = compute_gtbr(universe, ticker, spot)

    wall_idx = gp['net_gex'].abs().idxmax()
    wall_k   = gp.loc[wall_idx, 'strike']
    wall_v   = gp.loc[wall_idx, 'net_gex']
    net      = gp['net_gex'].sum()
    regime   = "🟢 LONG Γ (Mean-Revert)" if net > 0 else "🔴 SHORT Γ (Momentum)"

    gex_results[ticker] = dict(
        spot=spot, zero_gamma=zg, gamma_wall=wall_k,
        gamma_wall_gex=wall_v, total_net_gex=net, regime=regime,
        gtbr_exact=gtbr_e, gtbr_approx=gtbr_a, profile=gp)

# Compact GEX summary
short_gamma = {t: g for t, g in gex_results.items() if g['total_net_gex'] < 0}
long_gamma  = {t: g for t, g in gex_results.items() if g['total_net_gex'] >= 0}
print(f"   ✅ GEX computed for {len(gex_results)} tickers")
print(f"   🔴 SHORT Γ: {len(short_gamma)} tickers | 🟢 LONG Γ: {len(long_gamma)} tickers")

if short_gamma:
    print(f"\n   ⚠️  Short Gamma Tickers (momentum amplification risk):")
    sg_rows = []
    for t, g in sorted(short_gamma.items(), key=lambda x: x[1]['total_net_gex']):
        sg_rows.append({
            'ticker': t, 'spot': f"${g['spot']:.2f}",
            'net_gex': f"${g['total_net_gex']:,.0f}",
            'gamma_wall': f"${g['gamma_wall']:.0f}",
            'zero_gamma': f"${g['zero_gamma']:.0f}",
            'wall_dist': f"{abs(g['spot']-g['gamma_wall'])/g['spot']:.1%}",
        })
    print(pd.DataFrame(sg_rows).to_string(index=False))


# %%
# ═══════════════════════════════════════════════════════════════
# MODULE 4: ASYMMETRIC DISCRETE VRP (The Alpha Engine)
# ═══════════════════════════════════════════════════════════════
#
# Discrete Model-Free Implied Variance (VIX white-paper):
#   σ² = (2/T) Σ [ΔK_i/K_i² × e^(rT) × Q(K_i)] − (1/T)[(F/K₀)−1]²
#
# Bad VRP  → OTM puts only    (downside panic premium)
# Good VRP → OTM calls only   (upside lottery premium)
#
# Realized Variance (21-day close-to-close):
#   RV² = (252/21) Σ[ln(S_j/S_{j-1})²]
#
# VRP = IV² − RV²

def compute_discrete_iv2(df, ticker, r=RISK_FREE_RATE):
    """VIX-style discrete implied variance for nearest-to-30d expiry."""
    t = df[df['ticker'] == ticker]
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
    K0 = all_k[all_k <= F][-1] if (all_k <= F).any() else all_k[0]

    # Build OTM strip: puts K<K₀  |  avg at K₀  |  calls K>K₀
    rows = []
    for _, r_ in puts[puts['strike'] < K0].iterrows():
        rows.append((r_['strike'], r_['mid_price'], 'bad'))
    # K₀ contrib
    k0p = puts[puts['strike'] == K0]
    k0c = calls[calls['strike'] == K0]
    if not k0p.empty and not k0c.empty:
        rows.append((K0, (k0p['mid_price'].iloc[0]+k0c['mid_price'].iloc[0])/2, 'both'))
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
    dK[0]    = Kv[1] - Kv[0]
    dK[-1]   = Kv[-1] - Kv[-2]
    dK[1:-1] = (Kv[2:] - Kv[:-2]) / 2.0

    eRT = np.exp(r * T)
    contrib = (dK / Kv**2) * eRT * strip['Q'].values
    strip['c'] = contrib

    total_iv2 = (2.0/T) * contrib.sum() - (1.0/T)*((F/K0)-1)**2
    bad_iv2   = (2.0/T) * strip.loc[strip['comp'].isin(['bad','both']), 'c'].sum()
    good_iv2  = (2.0/T) * strip.loc[strip['comp'].isin(['good','both']), 'c'].sum()
    return total_iv2, bad_iv2, good_iv2, dte, best_exp


def compute_realized_variance(ticker, price_cache=None, lookback=21):
    """21-day realized variance from CACHED price data. Zero API calls."""
    try:
        if price_cache is not None:
            # Use cached bulk download data
            try:
                close = price_cache[ticker]['Close'].dropna()
            except (KeyError, TypeError):
                close = price_cache['Close'].dropna()  # single ticker
        else:
            # Fallback: fetch (should never happen with proper caching)
            h = yf.Ticker(ticker).history(period='3mo')
            close = h['Close']

        if len(close) < lookback + 1:
            return None, None, None
        lr = np.log(close / close.shift(1)).dropna().values[-lookback:]
        ann = 252.0 / lookback
        total = np.sum(lr**2) * ann
        bad   = np.sum(lr[lr < 0]**2) * ann if (lr < 0).any() else 0.0
        good  = np.sum(lr[lr >= 0]**2) * ann if (lr >= 0).any() else 0.0
        return total, bad, good
    except Exception:
        return None, None, None


print("⚙️  Computing Variance Risk Premium (from cached data — zero API calls)...")
vrp_results = {}
vrp_errors = 0
for ticker in TICKERS:
    if ticker not in spot_prices:
        continue
    tiv, biv, giv, dte_, exp_ = compute_discrete_iv2(universe, ticker)
    trv, brv, grv = compute_realized_variance(ticker, price_cache=PRICE_CACHE)
    if tiv is None or trv is None:
        vrp_errors += 1
        continue
    vrp_results[ticker] = dict(
        total_iv2=tiv, bad_iv2=biv, good_iv2=giv,
        total_rv2=trv, bad_rv2=brv, good_rv2=grv,
        total_vrp=tiv-trv, bad_vrp=biv-brv, good_vrp=giv-grv,
        iv_vol=np.sqrt(max(tiv,0))*100, rv_vol=np.sqrt(trv)*100,
        exp_used=exp_, dte_used=dte_)

print(f"   ✅ VRP computed for {len(vrp_results)} tickers ({vrp_errors} skipped)")

# Print VRP summary table (compact)
if vrp_results:
    vrp_rows = []
    for t, d in sorted(vrp_results.items(), key=lambda x: x[1]['bad_vrp'], reverse=True):
        asym = d['bad_vrp']/d['good_vrp'] if d['good_vrp'] != 0 else float('inf')
        vrp_rows.append({
            'ticker': t, 'iv': f"{d['iv_vol']:.1f}%", 'rv': f"{d['rv_vol']:.1f}%",
            'total_vrp': f"{d['total_vrp']:.4f}",
            'bad_vrp': f"{d['bad_vrp']:.4f}",
            'good_vrp': f"{d['good_vrp']:.4f}",
            'asym': f"{asym:.1f}x",
            'signal': 'RICH' if d['total_vrp'] > 0 else 'CHEAP'
        })
    print(f"\n   Top 15 by Bad VRP (downside panic premium):")
    print(pd.DataFrame(vrp_rows[:15]).to_string(index=False))

# %%
# ═══════════════════════════════════════════════════════════════
# MODULE 5: 3D HIDDEN ALPHA SCREENER — 9-TAB + 2 STRUCTURAL
# ═══════════════════════════════════════════════════════════════
#
# 3-Dimensional Logic: Tape Reading × VRP × GEX/Microstructure
#
# Tabs (matching Unusual Whales UI, but 1000% better):
#   1. Unusually Bullish       6. Put Sells (Cash-Secured)
#   2. Unusually Bearish       7. Cheap Calls (Gamma Lottos)
#   3. Deep Conviction Calls   8. Bullish Credit Trades
#   4. Deep Conviction Puts    9. Bearish Credit Trades
#   5. Long-Term Calls (LEAPS)
#
# PLUS structural filters:
#   S1. Gamma Squeeze Vulnerability
#   S2. VRP Asymmetry Play

print("\n" + "="*80)
print("🔬 HIDDEN ALPHA SCREENER — 3D QUANT-POWERED FILTERS")
print("    Tape Reading × VRP × GEX Microstructure")
print("="*80)

# ── Merge structural data into every contract ──
universe['bad_vrp']       = 0.0
universe['good_vrp']      = 0.0
universe['total_vrp']     = 0.0
universe['hv']            = 0.0
universe['total_net_gex'] = 0.0
universe['zero_gamma_level'] = 0.0
universe['gamma_wall_strike'] = 0.0

for ticker in TICKERS:
    mask = universe['ticker'] == ticker
    if ticker in vrp_results:
        v = vrp_results[ticker]
        universe.loc[mask, 'bad_vrp']   = v['bad_vrp']
        universe.loc[mask, 'good_vrp']  = v['good_vrp']
        universe.loc[mask, 'total_vrp'] = v['total_vrp']
        universe.loc[mask, 'hv']        = np.sqrt(v['total_rv2'])
    if ticker in gex_results:
        g = gex_results[ticker]
        universe.loc[mask, 'total_net_gex']    = g['total_net_gex']
        universe.loc[mask, 'zero_gamma_level'] = g['zero_gamma']
        universe.loc[mask, 'gamma_wall_strike'] = g['gamma_wall']

# Convenience splits
calls = universe[universe['option_type'] == 'call'].copy()
puts  = universe[universe['option_type'] == 'put'].copy()

# ── Helper: print filter results ──
def print_filter(name, num, rule, df, cols, max_rows=20):
    print(f"\n{'─'*70}")
    print(f"📡 TAB {num}: {name}")
    print(f"   Rule: {rule}")
    print(f"{'─'*70}")
    if df is not None and not df.empty:
        show = df.head(max_rows)
        print(f"\n🚨 {len(df)} contracts flagged (showing top {len(show)}):")
        print(show[cols].to_string(index=False))
    else:
        print("   No contracts match criteria.")
    return len(df) if df is not None and not df.empty else 0

# Standard display columns
STD_COLS = ['ticker','strike','expiry','dte','volume','openInterest',
            'impliedVolatility','delta','skew_adj_delta','total_premium']

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAB 1: UNUSUALLY BULLISH
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   UW Base:  Call Vol > OI
#   Our 3D:   Vol > OI*2.5, Vol > 500, DTE < 45
#             + Good VRP ≥ 75th pctl (institutions buying upside convexity)

good_vrp_75 = calls['good_vrp'].quantile(FC['BULLISH_VRP_PCTL']) if not calls.empty else 0

df_unusually_bullish = calls[
    (calls['volume'] > calls['openInterest'] * FC['BULLISH_VOL_OI_RATIO']) &
    (calls['volume'] > FC['BULLISH_MIN_VOL']) &
    (calls['dte'] < FC['BULLISH_MAX_DTE']) &
    (calls['good_vrp'] >= good_vrp_75)
].sort_values('total_premium', ascending=False)

n1 = print_filter("Unusually Bullish 🟢", 1,
    "Calls, Vol>OI×2.5, Vol>500, DTE<45, Good VRP ≥ 75th pctl",
    df_unusually_bullish, STD_COLS + ['good_vrp'])

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAB 2: UNUSUALLY BEARISH
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   UW Base:  Put Vol > OI
#   Our 3D:   Vol > OI*2.5, Vol > 500, DTE < 45
#             + Bad VRP ≥ 75th pctl (extreme panic premium)

bad_vrp_75 = puts['bad_vrp'].quantile(FC['BEARISH_VRP_PCTL']) if not puts.empty else 0

df_unusually_bearish = puts[
    (puts['volume'] > puts['openInterest'] * FC['BEARISH_VOL_OI_RATIO']) &
    (puts['volume'] > FC['BEARISH_MIN_VOL']) &
    (puts['dte'] < FC['BEARISH_MAX_DTE']) &
    (puts['bad_vrp'] >= bad_vrp_75)
].sort_values('total_premium', ascending=False)

n2 = print_filter("Unusually Bearish 🔴", 2,
    "Puts, Vol>OI×2.5, Vol>500, DTE<45, Bad VRP ≥ 75th pctl",
    df_unusually_bearish, STD_COLS + ['bad_vrp'])

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAB 3: DEEP CONVICTION CALLS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   Percentile-based premium: top 5% by notional within universe
#   + Skew-Adj Δ > 0.30 (real directional exposure)
#   + Spot within 5% of Zero Gamma (hedging flip zone)

call_prem_threshold = max(
    calls['total_premium'].quantile(FC['CONVICTION_CALL_PREM_PCTL']),
    FC['CONVICTION_CALL_MIN_PREM_ABS']
) if not calls.empty else FC['CONVICTION_CALL_MIN_PREM_ABS']

df_conviction_calls = calls[
    (calls['total_premium'] > call_prem_threshold) &
    (calls['skew_adj_delta'] > FC['CONVICTION_CALL_MIN_DELTA']) &
    (calls['volume'] > 10) &
    (((calls['spot'] - calls['zero_gamma_level']).abs() / calls['spot']) < FC['CONVICTION_CALL_ZG_PROX'])
].sort_values('total_premium', ascending=False)

n3 = print_filter(f"Deep Conviction Calls 💎🟢 (Prem>{call_prem_threshold/1000:.0f}k)", 3,
    f"Calls, Prem>95th pctl (${call_prem_threshold:,.0f}), Skew-Adj Δ>0.30, within 5% of ZG",
    df_conviction_calls, STD_COLS + ['zero_gamma_level'])

# Fallback: relax ZG proximity
if df_conviction_calls.empty:
    relaxed = calls[
        (calls['total_premium'] > FC['RELAXED_PREM']) &
        (calls['skew_adj_delta'] > FC['CONVICTION_CALL_MIN_DELTA']) &
        (calls['volume'] > 10)
    ].sort_values('total_premium', ascending=False)
    if not relaxed.empty:
        print(f"   Relaxed (Prem>${FC['RELAXED_PREM']/1000:.0f}k, no ZG proximity): {len(relaxed)} found")
        print(relaxed[STD_COLS].head(10).to_string(index=False))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAB 4: DEEP CONVICTION PUTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   Percentile-based premium: top 5% by notional
#   + Net GEX < 0 (dealers short gamma → put amplifies downside)

put_prem_threshold = max(
    puts['total_premium'].quantile(FC['CONVICTION_PUT_PREM_PCTL']),
    FC['CONVICTION_PUT_MIN_PREM_ABS']
) if not puts.empty else FC['CONVICTION_PUT_MIN_PREM_ABS']

df_conviction_puts = puts[
    (puts['total_premium'] > put_prem_threshold) &
    (puts['total_net_gex'] < 0) &
    (puts['volume'] > 10)
].sort_values('total_premium', ascending=False)

n4 = print_filter(f"Deep Conviction Puts 💎🔴 (Prem>{put_prem_threshold/1000:.0f}k)", 4,
    f"Puts, Prem>95th pctl (${put_prem_threshold:,.0f}), Net GEX<0",
    df_conviction_puts, STD_COLS + ['total_net_gex'])

if df_conviction_puts.empty:
    relaxed = puts[
        (puts['total_premium'] > FC['RELAXED_PREM']) &
        (puts['total_net_gex'] < 0) &
        (puts['volume'] > 10)
    ].sort_values('total_premium', ascending=False)
    if not relaxed.empty:
        print(f"   Relaxed (Prem>${FC['RELAXED_PREM']/1000:.0f}k): {len(relaxed)} found")
        print(relaxed[STD_COLS].head(10).to_string(index=False))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAB 5: LONG-TERM CALLS (LEAPS)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   UW Base:  DTE > 365
#   Our 3D:   + IV < HV (buy ONLY when long-term vega is cheap)

leaps_dte_threshold = FC['LEAPS_MIN_DTE'] if (calls['dte'] > FC['LEAPS_MIN_DTE']).any() else FC['LEAPS_FALLBACK_DTE']

df_leaps = calls[
    (calls['dte'] > leaps_dte_threshold) &
    (calls['impliedVolatility'] < calls['hv']) &
    (calls['openInterest'] >= FC['LEAPS_MIN_OI']) &
    (calls['moneyness'] >= FC['LEAPS_MONEYNESS_LOW']) &
    (calls['moneyness'] <= FC['LEAPS_MONEYNESS_HIGH'])
].sort_values(['dte', 'total_premium'], ascending=[False, False])

n5 = print_filter(f"Long-Term Calls (LEAPS, DTE>{leaps_dte_threshold}) 📅", 5,
    f"Calls, DTE>{leaps_dte_threshold}, IV<HV, OI>{FC['LEAPS_MIN_OI']}, Moneyness 0.8-1.2",
    df_leaps, STD_COLS + ['hv', 'moneyness'])

if df_leaps.empty:
    long_calls = calls[calls['dte'] > leaps_dte_threshold]
    if not long_calls.empty:
        print(f"   {len(long_calls)} long-dated calls exist but didn't pass quality filters")
    else:
        print(f"   No LEAPS available. Max DTE: {int(calls['dte'].max()) if not calls.empty else 0}d")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAB 6: PUT SELLS (Cash-Secured Puts)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   UW Base:  Sell high IV puts
#   Our 3D:   OTM, Δ ∈ [-0.30, -0.15], 15 < DTE < 60
#             + IV > HV (harvest the variance risk premium)

df_put_sells = puts[
    (puts['strike'] < puts['spot']) &
    (puts['delta'].between(FC['PUT_SELL_DELTA_LOW'], FC['PUT_SELL_DELTA_HIGH'])) &
    (puts['dte'] > FC['PUT_SELL_MIN_DTE']) & (puts['dte'] < FC['PUT_SELL_MAX_DTE']) &
    (puts['impliedVolatility'] > puts['hv']) &
    (puts['volume'] > FC['PUT_SELL_MIN_VOL'])
].copy()

if not df_put_sells.empty:
    df_put_sells['ann_roc'] = (
        (df_put_sells['mid_price'] / df_put_sells['strike']) *
        (365.0 / df_put_sells['dte'])
    ).round(4)
    df_put_sells['iv_premium'] = (
        df_put_sells['impliedVolatility'] - df_put_sells['hv']
    ).round(4)
    df_put_sells = df_put_sells.sort_values('ann_roc', ascending=False)

n6 = print_filter("Put Sells (Cash-Secured) 💰", 6,
    "OTM Puts, Δ∈[-0.30,-0.15], 15<DTE<60, IV>HV",
    df_put_sells,
    ['ticker','strike','expiry','dte','delta','impliedVolatility',
     'hv','iv_premium','mid_price','ann_roc','volume'])

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAB 7: CHEAP CALLS (Gamma Lotto Tickets)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   UW Base:  Premium < $1.00
#   Our 3D:   OTM, DTE < 14, price < $1
#             + Spot within 1.5% of GAMMA WALL (max GEX strike)
#             (dealer hedging might push stock into your money)

df_cheap_calls = calls[
    (calls['mid_price'] < FC['CHEAP_MAX_PRICE']) &
    (calls['mid_price'] > FC['CHEAP_MIN_PRICE']) &
    (calls['strike'] > calls['spot']) &
    (calls['dte'] < FC['CHEAP_MAX_DTE']) &
    (calls['volume'] > FC['CHEAP_MIN_VOL']) &
    (((calls['spot'] - calls['gamma_wall_strike']).abs() / calls['spot']) < FC['CHEAP_WALL_PROX'])
].sort_values('mid_price')

n7 = print_filter("Cheap Calls (Gamma Lottos) 🎰", 7,
    "OTM Calls, Price<$1, DTE<14, Spot within 1.5% of Gamma Wall",
    df_cheap_calls,
    ['ticker','strike','expiry','dte','mid_price','volume',
     'openInterest','delta','dollar_gamma','gamma_wall_strike'])

if df_cheap_calls.empty:
    relaxed = calls[
        (calls['mid_price'] < FC['CHEAP_MAX_PRICE']) & (calls['mid_price'] > FC['CHEAP_MIN_PRICE']) &
        (calls['strike'] > calls['spot']) &
        (calls['dte'] < FC['CHEAP_MAX_DTE']) & (calls['volume'] > FC['CHEAP_MIN_VOL'])
    ].sort_values('mid_price')
    if not relaxed.empty:
        print(f"   Relaxed (no gamma wall proximity): {len(relaxed)} cheap calls")
        print(relaxed[['ticker','strike','expiry','dte','mid_price',
                       'volume','delta']].head(10).to_string(index=False))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAB 8: BULLISH CREDIT TRADES (Bull Put Spreads)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   Our 3D:   OTM puts, Short IV > RV, net Δ > 0, max Premium/Margin

def find_credit_spreads(df, vrp_data, spots, spread_type='bull_put',
                        top_n=FC['SPREAD_TOP_N']):
    """Find optimal credit spreads ranked by premium-to-margin ratio."""
    rows = []
    for ticker in df['ticker'].unique():
        if ticker not in spots or ticker not in vrp_data:
            continue
        spot = spots[ticker]
        hv = np.sqrt(vrp_data[ticker]['total_rv2'])

        if spread_type == 'bull_put':
            legs = df[
                (df['ticker'] == ticker) & (df['option_type'] == 'put') &
                (df['strike'] < spot) &
                (df['dte'] >= FC['SPREAD_MIN_DTE']) & (df['dte'] <= FC['SPREAD_MAX_DTE']) &
                (df['mid_price'] > FC['SPREAD_MIN_PRICE']) &
                (df['impliedVolatility'] > hv)
            ].copy()
        else:  # bear_call
            legs = df[
                (df['ticker'] == ticker) & (df['option_type'] == 'call') &
                (df['strike'] > spot) &
                (df['dte'] >= FC['SPREAD_MIN_DTE']) & (df['dte'] <= FC['SPREAD_MAX_DTE']) &
                (df['mid_price'] > FC['SPREAD_MIN_PRICE']) &
                (df['impliedVolatility'] > hv)
            ].copy()

        for exp, eg in legs.groupby('expiry'):
            if spread_type == 'bull_put':
                es = eg.sort_values('strike', ascending=False).reset_index(drop=True)
            else:
                es = eg.sort_values('strike', ascending=True).reset_index(drop=True)

            if len(es) < 2:
                continue
            for i in range(len(es) - 1):
                short_leg = es.iloc[i]
                long_leg  = es.iloc[i+1]

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
                    continue  # Skip outliers (bad data)
                rows.append({
                    'ticker': ticker, 'expiry': exp,
                    'dte': int(short_leg['dte']),
                    'short_K': short_leg['strike'],
                    'long_K': long_leg['strike'],
                    'width': width,
                    'credit': f"${credit:.2f}",
                    'margin': f"${margin:.2f}",
                    'ptm_ratio': round(ptm, 3),
                    'net_delta': round(net_d, 4),
                    'short_iv': f"{short_leg['impliedVolatility']:.1%}",
                    'hv': f"{hv:.1%}",
                })
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows).sort_values('ptm_ratio', ascending=False).head(top_n)

print(f"\n{'─'*70}")
print("📡 TAB 8: Bullish Credit Trades (Bull Put Spreads) 📈")
print("   Rule: OTM puts, Short IV>HV, net Δ>0, max Premium/Margin")
print(f"{'─'*70}")

df_bull_credit = find_credit_spreads(universe, vrp_results, spot_prices,
                                      spread_type='bull_put')
if not df_bull_credit.empty:
    print(f"\n🚨 Top {len(df_bull_credit)} Bull Put Spreads:")
    print(df_bull_credit.to_string(index=False))
    n8 = len(df_bull_credit)
else:
    print("   No qualifying bull put spreads found.")
    n8 = 0

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAB 9: BEARISH CREDIT TRADES (Bear Call Spreads)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   Our 3D:   OTM calls, Short IV > RV, net Δ < 0, max Premium/Margin

print(f"\n{'─'*70}")
print("📡 TAB 9: Bearish Credit Trades (Bear Call Spreads) 📉")
print("   Rule: OTM calls, Short IV>HV, net Δ<0, max Premium/Margin")
print(f"{'─'*70}")

df_bear_credit = find_credit_spreads(universe, vrp_results, spot_prices,
                                      spread_type='bear_call')
if not df_bear_credit.empty:
    print(f"\n🚨 Top {len(df_bear_credit)} Bear Call Spreads:")
    print(df_bear_credit.to_string(index=False))
    n9 = len(df_bear_credit)
else:
    print("   No qualifying bear call spreads found.")
    n9 = 0

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STRUCTURAL S1: GAMMA SQUEEZE VULNERABILITY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print(f"\n{'─'*70}")
print("🌪️  STRUCTURAL: Gamma Squeeze Vulnerability")
print("   Rule: Net GEX < 0  AND  Spot within 5% of Gamma Wall")
print(f"{'─'*70}")

squeeze_rows = []
for ticker, gd in gex_results.items():
    net = gd['total_net_gex']
    if net >= 0:
        continue
    dist = abs(gd['spot'] - gd['gamma_wall']) / gd['spot']
    squeeze_rows.append({
        'ticker': ticker,
        'spot': f"${gd['spot']:.2f}",
        'net_gex': f"${net:,.0f}",
        'gamma_wall': f"${gd['gamma_wall']:.2f}",
        'zero_gamma': f"${gd['zero_gamma']:.2f}",
        'wall_dist': f"{dist:.1%}",
        'severity': "🔴 CRITICAL" if dist < 0.02 else "🟡 ELEVATED",
    })

if squeeze_rows:
    print(f"\n🚨 {len(squeeze_rows)} tickers in SHORT GAMMA:")
    print(pd.DataFrame(squeeze_rows).to_string(index=False))
else:
    print("   No short-gamma regimes detected.")
    for t, gd in gex_results.items():
        print(f"   {t}: {gd['regime']}")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STRUCTURAL S2: VRP ASYMMETRY PLAY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print(f"\n{'─'*70}")
print("💰 STRUCTURAL: VRP Asymmetry Play (The Alpha Engine)")
print("   Rule: Bad VRP ≥ 90th pctl AND Good VRP ≤ 10th pctl")
print(f"{'─'*70}")

if vrp_results:
    bads  = [v['bad_vrp'] for v in vrp_results.values()]
    goods = [v['good_vrp'] for v in vrp_results.values()]
    p90b  = np.percentile(bads, 90) if len(bads) > 1 else bads[0]
    p10g  = np.percentile(goods, 10) if len(goods) > 1 else 0

    vrp_rows = []
    for t, d in vrp_results.items():
        asym = d['bad_vrp']/d['good_vrp'] if d['good_vrp'] != 0 else float('inf')
        is_ext = d['bad_vrp'] >= p90b and d['good_vrp'] <= p10g
        sig = ("🟢 DEEP CONVICTION BUY" if is_ext else
               "🟡 ELEVATED PANIC" if d['bad_vrp'] >= p90b else "⚪ NEUTRAL")
        vrp_rows.append({
            'ticker': t, 'iv_vol': f"{d['iv_vol']:.1f}%",
            'rv_vol': f"{d['rv_vol']:.1f}%",
            'bad_vrp': f"{d['bad_vrp']:.6f}",
            'good_vrp': f"{d['good_vrp']:.6f}",
            'asymmetry': f"{asym:.2f}x", 'signal': sig})
    print(pd.DataFrame(vrp_rows).to_string(index=False))

# %%
# ═══════════════════════════════════════════════════════════════
# SUMMARY DASHBOARD
# ═══════════════════════════════════════════════════════════════

print("\n" + "="*80)
print("📋 EXECUTION SUMMARY — 3D HIDDEN ALPHA SCREENER")
print("="*80)
print(f"   Universe          : {len(universe):,} contracts across {list(spot_prices.keys())}")
print(f"   ─────────────────────────────────────────────")
print(f"   1. Unusually Bullish    : {n1}")
print(f"   2. Unusually Bearish    : {n2}")
print(f"   3. Deep Conviction Calls: {n3}")
print(f"   4. Deep Conviction Puts : {n4}")
print(f"   5. Long-Term Calls      : {n5}")
print(f"   6. Put Sells            : {n6}")
print(f"   7. Cheap Calls (Lottos) : {n7}")
print(f"   8. Bull Put Spreads     : {n8}")
print(f"   9. Bear Call Spreads    : {n9}")
print(f"   ─────────────────────────────────────────────")
print(f"   S1. Gamma Squeeze       : {len(squeeze_rows)} tickers")
print(f"   S2. VRP Asymmetry       : {sum(1 for v in vrp_results.values() if v['bad_vrp'] > 0)} tickers")
print("="*80)
print("✅ Prototype complete. 9 tabs + 2 structural filters. Ready for FastAPI port.")

