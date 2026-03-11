"""
universe.py — S&P 500 + NASDAQ 100 Combined Universe Builder
==============================================================
Provides a deduplicated, sector-mapped universe for the momentum screener.
The lists are static snapshots (as of March 2026) to avoid runtime scraping.
Call `get_universe()` to get the merged dict and `get_all_tickers()` for the
flat sorted list.
"""

from __future__ import annotations

# ── S&P 500 Constituents (by GICS sector) ──
# Sourced from Wikipedia / IEX — snapshot March 2026

SP500_UNIVERSE = {
    "Technology": [
        "AAPL", "ACN", "ADBE", "ADI", "ADSK", "AKAM", "AMAT", "AMD",
        "ANET", "APH", "AVGO", "CDNS", "CRM", "CRWD", "CSCO", "CTSH",
        "DELL", "EPAM", "FFIV", "FICO", "FSLR", "FTNT", "GDDY", "GEN",
        "GLW", "GOOGL", "HPE", "HPQ", "IBM", "INTC", "INTU", "IT",
        "JBL", "KEYS", "KLAC", "LRCX", "MCHP", "META", "MPWR", "MRVL",
        "MSFT", "MSI", "MU", "NOW", "NTAP", "NVDA", "NXPI", "ON",
        "ORCL", "PANW", "PLTR", "PTC", "QCOM", "ROP", "SNPS", "STX",
        "SWKS", "TDY", "TEL", "TER", "TRMB", "TXN", "TYL", "VRSN",
        "WDC", "WDAY", "ZBRA", "ZS",
    ],
    "Healthcare": [
        "A", "ABBV", "ABT", "ALGN", "ALNY", "AMGN", "BAX", "BDX",
        "BIIB", "BMY", "BSX", "CAH", "CI", "CNC", "COO", "COR",
        "CRL", "CVS", "DXCM", "DVA", "ELV", "EW", "GEHC", "GILD",
        "HCA", "HOLX", "HSIC", "HUM", "IDXX", "INCY", "INSM", "IQV",
        "ISRG", "JNJ", "LH", "LLY", "MCK", "MDT", "MOH", "MRK",
        "MRNA", "MTD", "PFE", "PODD", "REGN", "RMD", "RVTY", "SOLV",
        "STE", "SYK", "TMO", "UHS", "UNH", "VRTX", "VTRS", "WAT",
        "WST", "ZBH", "ZTS",
    ],
    "Financials": [
        "ACGL", "AFL", "AIG", "AIZ", "AJG", "ALL", "AMP", "AON",
        "APO", "AXP", "BAC", "BEN", "BK", "BLK", "BRK-B", "BRO",
        "BX", "C", "CB", "CBOE", "CFG", "CINF", "CME", "COF",
        "CPAY", "ERIE", "FDS", "FIS", "FISV", "FITB", "GL", "GPN",
        "GS", "HBAN", "HIG", "ICE", "IVZ", "JKHY", "JPM", "KEY",
        "KKR", "L", "MA", "MCO", "MET", "MS", "MSCI", "MTB",
        "NDAQ", "NTRS", "PFG", "PGR", "PNC", "PRU", "PYPL", "RF",
        "RJF", "SCHW", "SPGI", "STT", "SYF", "TFC", "TROW", "TRV",
        "USB", "V", "WFC", "WRB", "WTW",
    ],
    "Energy": [
        "APA", "BKR", "COP", "CTRA", "CVX", "DVN", "EOG", "EQT",
        "FANG", "HAL", "KMI", "MPC", "OKE", "OXY", "PSX", "SLB",
        "TRGP", "VLO", "WMB", "XOM",
    ],
    "Consumer Discretionary": [
        "ABNB", "AMZN", "APTV", "AZO", "BBY", "BKNG", "CCL", "CMG",
        "CVNA", "DECK", "DHI", "DPZ", "DRI", "EBAY", "EXPE", "F",
        "GM", "GPC", "GRMN", "HAS", "HD", "HLT", "LEN", "LOW",
        "LULU", "LVS", "MAR", "MCD", "MGM", "NCLH", "NKE", "NVR",
        "ORLY", "PHM", "POOL", "RCL", "RL", "ROST", "SBUX", "TJX",
        "TPR", "TSCO", "TSLA", "ULTA", "WSM", "WYNN", "YUM",
    ],
    "Industrials": [
        "ADP", "ALLE", "AME", "AOS", "AXON", "BA", "BLDR", "BR",
        "CARR", "CAT", "CHRW", "CMI", "CPRT", "CSX", "CTAS", "DAL",
        "DE", "DOV", "EFX", "EMR", "ETN", "EXPD", "FAST", "FDX",
        "FTV", "GD", "GE", "GEV", "GNRC", "GWW", "HON", "HUBB",
        "HWM", "IEX", "IR", "ITW", "J", "JBHT", "JCI", "LDOS",
        "LHX", "LMT", "LUV", "MAS", "MMM", "NDSN", "NOC", "NSC",
        "ODFL", "OTIS", "PAYC", "PAYX", "PCAR", "PH", "PNR", "PWR",
        "ROK", "ROL", "RSG", "RTX", "SNA", "SWK", "TDG", "TT",
        "TXT", "UAL", "UBER", "UNP", "UPS", "URI", "VLTO", "VRSK",
        "WAB", "WM", "XYL",
    ],
    "Materials": [
        "ALB", "AMCR", "APD", "AVY", "BALL", "CF", "CRH", "CTVA",
        "DD", "DOW", "ECL", "FCX", "IFF", "IP", "LIN", "LYB",
        "MLM", "MOS", "NEM", "NUE", "PKG", "PPG", "SHW", "STLD",
        "VMC",
    ],
    "Communication Services": [
        "CHTR", "CMCSA", "DIS", "EA", "FOX", "FOXA", "GOOG", "LYV",
        "MTCH", "NFLX", "NWS", "NWSA", "OMC", "T", "TMUS", "TTD",
        "TTWO", "VZ", "WBD",
    ],
    "Consumer Staples": [
        "ADM", "BG", "CAG", "CHD", "CL", "CLX", "COST", "CPB",
        "DG", "DLTR", "EL", "GIS", "HRL", "HSY", "KDP", "KHC",
        "KMB", "KO", "KR", "KVUE", "MDLZ", "MKC", "MNST", "MO",
        "PEP", "PG", "PM", "SJM", "STZ", "SYY", "TAP", "TGT",
        "TSN", "WMT",
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

# ── NASDAQ 100 Constituents ──
# Tickers that are in NASDAQ 100 but NOT in S&P 500 (or appear in different sectors)

NASDAQ100_EXTRA = {
    "Technology": [
        "APP", "ARM", "ASML", "COIN", "DASH", "DDOG", "HOOD",
        "MELI", "MSTR", "PDD", "SHOP", "SMCI", "TEAM", "ZS",
    ],
    "Consumer Discretionary": [
        "DASH",
    ],
    "Communication Services": [
        "TKO",
    ],
    "Consumer Staples": [
        "BF-B", "LW",
    ],
    "Energy": [
        "EXE", "TPL",
    ],
    "Financials": [
        "ARES", "COIN", "EG", "HOOD", "IBKR", "MRSH", "XYZ",
    ],
    "Industrials": [
        "EME", "FIX", "HII", "LII",
    ],
    "Materials": [
        "SW",
    ],
    "Communication Services": [
        "PSKY", "TKO",
    ],
}


def merge_universes(*universes: dict[str, list[str]]) -> dict[str, list[str]]:
    """
    Merge multiple sector→tickers dicts, deduplicating tickers within each sector
    and across sectors (a ticker only appears in its first-encountered sector).
    """
    merged: dict[str, list[str]] = {}
    seen: set[str] = set()

    for universe in universes:
        for sector, tickers in universe.items():
            if sector not in merged:
                merged[sector] = []
            for t in tickers:
                if t not in seen:
                    merged[sector].append(t)
                    seen.add(t)

    # Sort within each sector
    for sector in merged:
        merged[sector] = sorted(merged[sector])

    return merged


def get_universe() -> dict[str, list[str]]:
    """Return the merged S&P 500 + NASDAQ 100 universe (deduplicated)."""
    return merge_universes(SP500_UNIVERSE, NASDAQ100_EXTRA)


def get_all_tickers() -> list[str]:
    """Return a flat, sorted, deduplicated list of all tickers."""
    universe = get_universe()
    return sorted({t for tickers in universe.values() for t in tickers})


def get_ticker_sector_map() -> dict[str, str]:
    """Return ticker → sector lookup dict."""
    universe = get_universe()
    mapping = {}
    for sector, tickers in universe.items():
        for t in tickers:
            mapping[t] = sector
    return mapping


# ── Self-test when run directly ──
if __name__ == "__main__":
    universe = get_universe()
    all_tickers = get_all_tickers()
    print(f"Sectors:  {len(universe)}")
    print(f"Total tickers: {len(all_tickers)}")
    for sector, tickers in sorted(universe.items()):
        print(f"  {sector:30s} → {len(tickers):3d} tickers")

    # Verify no duplicates
    flat = [t for tickers in universe.values() for t in tickers]
    assert len(flat) == len(set(flat)), "Duplicate tickers found!"
    print("\n✓ No duplicates detected.")
