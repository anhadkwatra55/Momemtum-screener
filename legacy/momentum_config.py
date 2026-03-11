"""
momentum_config.py — Central Configuration for the Momentum Screener
=====================================================================
~120 liquid US equities across 11 GICS sectors, leveraged ETF mappings,
indicator parameters, and a curated collection of quant/finance quotes.
"""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  STOCK UNIVERSE  (~120 tickers, 11 sectors)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UNIVERSE = {
    "Technology": [
        "A", "AAPL", "ACN", "ADBE", "ADI", "ADSK", "AKAM", "ALGN",
        "ALNY", "AMAT", "AMD", "ANET", "APH", "APP", "ARM", "ASML",
        "AVGO", "BAX", "BDX", "BIIB", "BSX", "CAH", "CCEP", "CDNS",
        "CDW", "CI", "CIEN", "CNC", "COO", "COR", "CRL", "CRM",
        "CRWD", "CSCO", "CTSH", "CVS", "DDOG", "DELL", "DGX", "DHR",
        "DVA", "DXCM", "ELV", "EPAM", "EW", "FER", "FFIV", "FICO",
        "FSLR", "FTNT", "GDDY", "GEHC", "GEN", "GLW", "GOOGL", "HCA",
        "HOLX", "HPE", "HPQ", "HSIC", "HUM", "IBM", "IDXX", "INCY",
        "INSM", "INTC", "INTU", "IQV", "IT", "JBL", "KEYS", "KLAC",
        "LH", "LRCX", "MCHP", "MCK", "MELI", "META", "MOH", "MPWR",
        "MRNA", "MRVL", "MSFT", "MSI", "MSTR", "MTD", "MU", "NOW",
        "NTAP", "NVDA", "NXPI", "ON", "ORCL", "PANW", "PDD", "PLTR",
        "PODD", "PTC", "Q", "QCOM", "RMD", "ROP", "RVTY", "SHOP",
        "SMCI", "SNDK", "SNPS", "SOLV", "STE", "STX", "SWKS", "SYK",
        "TDY", "TEAM", "TECH", "TEL", "TER", "TRI", "TRMB", "TXN",
        "TYL", "UHS", "VRSN", "VTRS", "WAT", "WDAY", "WDC", "WST",
        "ZBH", "ZBRA", "ZS", "ZTS",
    ],
    "Healthcare": [
        "ABBV", "ABT", "AMGN", "BMY", "GILD", "ISRG", "JNJ", "LLY",
        "MDT", "MRK", "PFE", "REGN", "TMO", "UNH", "VRTX",
    ],
    "Financials": [
        "ACGL", "AFL", "AIG", "AIZ", "AJG", "ALL", "AMP", "AON",
        "APO", "ARES", "AXP", "BAC", "BEN", "BK", "BLK", "BRK-B",
        "BRO", "BX", "C", "CB", "CBOE", "CFG", "CINF", "CME",
        "COF", "COIN", "CPAY", "EG", "ERIE", "FDS", "FIS", "FISV",
        "FITB", "GL", "GPN", "GS", "HBAN", "HIG", "HOOD", "IBKR",
        "ICE", "IVZ", "JKHY", "JPM", "KEY", "KKR", "L", "MA",
        "MCO", "MET", "MRSH", "MS", "MSCI", "MTB", "NDAQ", "NTRS",
        "PFG", "PGR", "PNC", "PRU", "PYPL", "RF", "RJF", "SCHW",
        "SPGI", "STT", "SYF", "TFC", "TROW", "TRV", "USB", "V",
        "WFC", "WRB", "WTW", "XYZ",
    ],
    "Energy": [
        "APA", "BKR", "COP", "CTRA", "CVX", "DVN", "EOG", "EQT",
        "EXE", "FANG", "HAL", "KMI", "MPC", "OKE", "OXY", "PSX",
        "SLB", "TPL", "TRGP", "VLO", "WMB", "XOM",
    ],
    "Consumer Discretionary": [
        "ABNB", "AMZN", "APTV", "AZO", "BBY", "BKNG", "CCL", "CMG",
        "CVNA", "DASH", "DECK", "DHI", "DPZ", "DRI", "EBAY", "EXPE",
        "F", "GM", "GPC", "GRMN", "HAS", "HD", "HLT", "LEN",
        "LOW", "LULU", "LVS", "MAR", "MCD", "MGM", "NCLH", "NKE",
        "NVR", "ORLY", "PHM", "POOL", "RCL", "RL", "ROST", "SBUX",
        "TJX", "TPR", "TSCO", "TSLA", "ULTA", "WSM", "WYNN", "YUM",
    ],
    "Industrials": [
        "ADP", "ALLE", "AME", "AOS", "AXON", "BA", "BLDR", "BR",
        "CARR", "CAT", "CHRW", "CMI", "CPRT", "CSX", "CTAS", "DAL",
        "DE", "DOV", "EFX", "EME", "EMR", "ETN", "EXPD", "FAST",
        "FDX", "FIX", "FTV", "GD", "GE", "GEV", "GNRC", "GWW",
        "HII", "HON", "HUBB", "HWM", "IEX", "IR", "ITW", "J",
        "JBHT", "JCI", "LDOS", "LHX", "LII", "LMT", "LUV", "MAS",
        "MMM", "NDSN", "NOC", "NSC", "ODFL", "OTIS", "PAYC", "PAYX",
        "PCAR", "PH", "PNR", "PWR", "ROK", "ROL", "RSG", "RTX",
        "SNA", "SWK", "TDG", "TT", "TXT", "UAL", "UBER", "UNP",
        "UPS", "URI", "VLTO", "VRSK", "WAB", "WM", "XYL",
    ],
    "Materials": [
        "ALB", "AMCR", "APD", "AVY", "BALL", "CF", "CRH", "CTVA",
        "DD", "DOW", "ECL", "FCX", "IFF", "IP", "LIN", "LYB",
        "MLM", "MOS", "NEM", "NUE", "PKG", "PPG", "SHW", "STLD",
        "SW", "VMC",
    ],
    "Communication Services": [
        "CHTR", "CMCSA", "DIS", "EA", "FOX", "FOXA", "GOOG", "LYV",
        "MTCH", "NFLX", "NWS", "NWSA", "OMC", "PSKY", "T", "TKO",
        "TMUS", "TTD", "TTWO", "VZ", "WBD",
    ],
    "Consumer Staples": [
        "ADM", "BF-B", "BG", "CAG", "CHD", "CL", "CLX", "COST",
        "CPB", "DG", "DLTR", "EL", "GIS", "HRL", "HSY", "KDP",
        "KHC", "KMB", "KO", "KR", "KVUE", "LW", "MDLZ", "MKC",
        "MNST", "MO", "PEP", "PG", "PM", "SJM", "STZ", "SYY",
        "TAP", "TGT", "TSN", "WMT",
    ],
    "Real Estate": [
        "AMT", "ARE", "AVB", "BXP", "CBRE", "CCI", "CPT", "CSGP",
        "DLR", "DOC", "EQIX", "EQR", "ESS", "EXR", "FRT", "HST",
        "INVH", "IRM", "KIM", "MAA", "O", "PLD", "PSA", "REG",
        "SBAC", "SPG", "UDR", "VICI", "VTR", "WELL", "WY",
    ],
    "Utilities": [
        "AEE", "AEP", "AES", "ATO", "AWK", "CEG", "CMS", "CNP",
        "D", "DTE", "DUK", "ED", "EIX", "ES", "ETR", "EVRG",
        "EXC", "FE", "LNT", "NEE", "NI", "NRG", "PCG", "PEG",
        "PNW", "PPL", "SO", "SRE", "VST", "WEC", "XEL",
    ],
}

# Flat list for convenience
ALL_TICKERS = sorted({t for tickers in UNIVERSE.values() for t in tickers})

# Reverse lookup: ticker → sector
TICKER_SECTOR = {}
for sector, tickers in UNIVERSE.items():
    for t in tickers:
        TICKER_SECTOR[t] = sector

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  LEVERAGED ETF MAPPING  (sector → {bull, bear, leverage})
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEVERAGED_ETFS = {
    "Technology":              {"bull": "TQQQ", "bear": "SQQQ", "lev": 3, "sector_etf": "XLK"},
    "Healthcare":              {"bull": "LABU", "bear": "LABD", "lev": 3, "sector_etf": "XLV"},
    "Financials":              {"bull": "FAS",  "bear": "FAZ",  "lev": 3, "sector_etf": "XLF"},
    "Energy":                  {"bull": "ERX",  "bear": "ERY",  "lev": 2, "sector_etf": "XLE"},
    "Consumer Discretionary":  {"bull": "WANT", "bear": "PASS", "lev": 3, "sector_etf": "XLY"},
    "Industrials":             {"bull": "DUSL", "bear": "DUSQ", "lev": 3, "sector_etf": "XLI"},
    "Materials":               {"bull": "MATL", "bear": "SMN",  "lev": 2, "sector_etf": "XLB"},
    "Communication Services":  {"bull": "TQQQ", "bear": "SQQQ", "lev": 3, "sector_etf": "XLC"},
    "Consumer Staples":        {"bull": "SPXL", "bear": "SPXS", "lev": 3, "sector_etf": "XLP"},
    "Real Estate":             {"bull": "DRN",  "bear": "DRV",  "lev": 3, "sector_etf": "XLRE"},
    "Utilities":               {"bull": "UTSL", "bear": "SDP",  "lev": 3, "sector_etf": "XLU"},
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  INDICATOR PARAMETERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ADX
ADX_PERIOD = 14
ADX_STRONG_TREND = 25
ADX_WEAK_TREND = 20

# TRIX
TRIX_PERIOD = 14
TRIX_SIGNAL = 9

# Full Stochastics
STOCH_K = 14
STOCH_D = 3
STOCH_SMOOTH = 3
STOCH_OB = 80      # overbought
STOCH_OS = 20      # oversold

# Elder Impulse
ELDER_EMA = 13
MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9

# Renko
RENKO_ATR_PERIOD = 14

# Hull Moving Average
HMA_PERIOD = 20

# Data
DATA_PERIOD = "1y"
DATA_INTERVAL = "1d"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  SENTIMENT & SCORING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCORE_STRONG_BULL = 1.5
SCORE_BULL = 0.5
SCORE_BEAR = -0.5
SCORE_STRONG_BEAR = -1.5

ANNUALIZED_TRADING_DAYS = 252

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  FAMOUS QUOTES  (shown at dashboard top)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUOTES = [
    {"text": "The best way to predict the future is to study the past, or prognosticate.",
     "author": "Robert Kiyosaki"},
    {"text": "Risk comes from not knowing what you're doing.",
     "author": "Warren Buffett"},
    {"text": "The four most dangerous words in investing are: 'This time it's different.'",
     "author": "Sir John Templeton"},
    {"text": "We look for patterns. We look for ways to reduce risk. We don't predict markets. We just look for slightly wrong prices.",
     "author": "Jim Simons"},
    {"text": "In this business if you're good, you're right six times out of ten. You're never going to be right nine times out of ten.",
     "author": "Peter Lynch"},
    {"text": "The stock market is a device for transferring money from the impatient to the patient.",
     "author": "Warren Buffett"},
    {"text": "Markets can remain irrational longer than you can remain solvent.",
     "author": "John Maynard Keynes"},
    {"text": "It is not the strongest of the species that survives, nor the most intelligent; it is the one most adaptable to change.",
     "author": "Charles Darwin"},
    {"text": "An investment in knowledge pays the best interest.",
     "author": "Benjamin Franklin"},
    {"text": "Information is the resolution of uncertainty.",
     "author": "Claude Shannon"},
    {"text": "The only way to win is to work, work, work, and hope to have a few insights.",
     "author": "Charlie Munger"},
    {"text": "I did the best I could with the information available to me — and a lot of computing power.",
     "author": "Jim Simons"},
    {"text": "Not everything that can be counted counts, and not everything that counts can be counted.",
     "author": "Albert Einstein"},
    {"text": "The goal of science is to make the wonderful ordinary, and the ordinary wonderful.",
     "author": "Ed Thorp"},
    {"text": "Beware of geeks bearing formulas.",
     "author": "Warren Buffett"},
    {"text": "The key to making money in stocks is not to get scared out of them.",
     "author": "Peter Lynch"},
    {"text": "The financial markets generally are unpredictable. So one has to have different scenarios.",
     "author": "George Soros"},
    {"text": "History doesn't repeat itself, but it often rhymes.",
     "author": "Mark Twain"},
    {"text": "In mathematics you don't understand things. You just get used to them.",
     "author": "John von Neumann"},
    {"text": "Past results are not necessarily indicative of future results — but they're the best guide we have.",
     "author": "Ed Thorp"},
    {"text": "The market is a pendulum that forever swings between unsustainable optimism and unjustified pessimism.",
     "author": "Benjamin Graham"},
    {"text": "There are no facts about the future.",
     "author": "Nassim Taleb"},
    {"text": "The most important quality for an investor is temperament, not intellect.",
     "author": "Warren Buffett"},
    {"text": "Simplicity is the ultimate sophistication.",
     "author": "Leonardo da Vinci"},
    {"text": "Statistical thinking will one day be as necessary for efficient citizenship as the ability to read and write.",
     "author": "H.G. Wells"},
    {"text": "The race is not always to the swift, nor the battle to the strong, but that's the way to bet.",
     "author": "Damon Runyon"},
    {"text": "It is difficult to make predictions, especially about the future.",
     "author": "Niels Bohr"},
    {"text": "Bottoms in the investment world don't end with four-year lows; they end with 10- or 15-year lows.",
     "author": "Jim Rogers"},
    {"text": "The essence of mathematics lies in its freedom.",
     "author": "Georg Cantor"},
    {"text": "A random walk down Wall Street is, in fact, not entirely random.",
     "author": "Benoit Mandelbrot"},
]
