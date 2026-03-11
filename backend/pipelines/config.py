"""
config.py — Central Parameter Store
====================================
North American Quantitative Screener
All tunable hyper-parameters and universe constraints live here.
"""

# ──────────────────────────────────────────────
#  Universe Constraints
# ──────────────────────────────────────────────
PRICE_MIN = 5.0          # Minimum closing price ($)
PRICE_MAX = 50.0         # Maximum closing price ($)
EXCHANGES = ["NYSE", "NASDAQ", "TSX"]

# ──────────────────────────────────────────────
#  Benchmark Mapping  (exchange → ETF ticker)
# ──────────────────────────────────────────────
BENCHMARK_MAP = {
    "NYSE":   "SPY",
    "NASDAQ": "SPY",
    "TSX":    "XIU",
}

# ──────────────────────────────────────────────
#  Fractional Differentiation
# ──────────────────────────────────────────────
FRACDIFF_D_MIN = 0.05          # lower bound for d* search
FRACDIFF_D_MAX = 0.95          # upper bound for d* search
FRACDIFF_D_STEP = 0.05         # step size for grid search
FRACDIFF_WEIGHT_THRESH = 1e-5  # drop weights smaller than this
FRACDIFF_ADF_PVALUE = 0.05     # target ADF p-value for stationarity

# ──────────────────────────────────────────────
#  Rolling Windows
# ──────────────────────────────────────────────
WINDOW_ZSCORE = 20       # Rolling window for Z-Score (trading days)
WINDOW_VOL = 20          # Rolling window for Garman-Klass vol
WINDOW_BETA = 60         # Rolling window for OLS beta
WINDOW_HURST = 126       # Sliding window for Hurst exponent
WINDOW_ADV = 20          # Average daily volume lookback
WINDOW_HMM = 252         # Lookback for HMM training (1 year)
WINDOW_KURTOSIS = 60     # Rolling window for excess kurtosis

# ──────────────────────────────────────────────
#  Signal Thresholds
# ──────────────────────────────────────────────
ZSCORE_THRESHOLD = 2.5   # |Z| must exceed this
HURST_MEAN_REV = 0.40    # H < this → mean-reverting
HURST_TRENDING = 0.60    # H > this → trending / persistent
HMM_N_STATES = 3         # Number of hidden states
HMM_N_ITER = 200         # Max EM iterations for HMM fitting
HMM_COVARIANCE_TYPE = "full"  # Covariance type for Gaussian HMM

# ──────────────────────────────────────────────
#  Risk & Execution Gates
# ──────────────────────────────────────────────
LIQUIDITY_FLOOR = 10_000_000   # ADV₂₀ × Price ≥ $10 M
MARKET_CAP_FLOOR = 300_000_000 # Minimum market cap ($300 M)
KURTOSIS_CEILING = 10.0        # Excess kurtosis above this → discard

# ──────────────────────────────────────────────
#  Information Ratio
# ──────────────────────────────────────────────
TRADING_DAYS_PER_YEAR = 252    # Annualisation factor
