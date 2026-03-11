import pandas as pd
import json

def get_sp500():
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    table = pd.read_html(url)[0]
    # 'Symbol' corresponds to the ticker; map 'GICS Sector' to sector
    tickers = table['Symbol'].str.replace('.', '-').tolist()
    sectors = table['GICS Sector'].tolist()
    return dict(zip(tickers, sectors))

def get_nasdaq100():
    url = "https://en.wikipedia.org/wiki/Nasdaq-100"
    # Find table with tickers
    tables = pd.read_html(url)
    for t in tables:
        if 'Ticker' in t.columns:
            tickers = t['Ticker'].str.replace('.', '-').tolist()
            sectors = t.get('GICS Sector', t.get('Sector', pd.Series(["Technology"] * len(tickers)))).tolist()
            return dict(zip(tickers, sectors))
    return {}

sp500 = get_sp500()
nasdaq100 = get_nasdaq100()

# Combine all new tickers mapping to their sectors
combined = {**sp500, **nasdaq100}

with open("new_tickers.json", "w") as f:
    json.dump(combined, f)
print(f"Dumped {len(combined)} tickers to new_tickers.json")
