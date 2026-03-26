"""
momentum_config.py — Central Configuration for the Momentum Screener
=====================================================================
S&P 1500 (S&P 500 + MidCap 400 + SmallCap 600) across 11 GICS sectors,
high-yield ETFs, dividend stocks, AI stocks, leveraged ETF mappings,
indicator parameters, and a curated collection of quant/finance quotes.
"""

import os

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  STOCK UNIVERSE  (S&P 1500 — ~1500 tickers, 11 GICS sectors)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UNIVERSE = {
    "Communication Services": [
        "ANGI", "CABO", "CARG", "CARS", "CCOI", "CHTR", "CMCSA", "CNK",
        "DIS", "DV", "EA", "FOX", "FOXA", "GOGO", "GOOG", "GOOGL",
        "GTM", "IAC", "IRDM", "LUMN", "LYV", "META", "MSGS", "MTCH",
        "NFLX", "NWS", "NWSA", "NXST", "NYT", "OMC", "PINS", "PSKY",
        "QNST", "SATS", "SHEN", "SSTK", "T", "TDS", "TGNA", "TKO",
        "TMUS", "TRIP", "TTD", "TTWO", "UNIT", "VSNT", "VZ", "WBD",
        "WLY", "WMG", "YELP", "ZD",
    ],
    "Consumer Discretionary": [
        "AAP", "ABG", "ABNB", "ADNT", "ADT", "AEO", "ALV", "AMZN",
        "AN", "ANF", "APTV", "ARMK", "ASO", "ATGE", "AXL", "AZO",
        "BBWI", "BBY", "BC", "BJRI", "BKE", "BKNG", "BLD", "BLMN",
        "BOOT", "BROS", "BURL", "BWA", "BYD", "CAKE", "CAVA", "CBRL",
        "CCL", "CCS", "CHDN", "CHH", "CHWY", "CMG", "COLM", "CPRI",
        "CRI", "CROX", "CVCO", "CVNA", "CZR", "DAN", "DASH", "DECK",
        "DFH", "DHI", "DKS", "DORM", "DPZ", "DRI", "DUOL", "EAT",
        "EBAY", "ETD", "ETSY", "EXPE", "EYE", "F", "FIVE", "FND",
        "FOXF", "FTDR", "FUN", "GAP", "GDEN", "GHC", "GIII", "GM",
        "GME", "GNTX", "GOLF", "GPC", "GPI", "GRBK", "GRMN", "GT",
        "H", "HAS", "HD", "HGV", "HLT", "HOG", "HRB", "HZO",
        "IBP", "KBH", "KMX", "KSS", "KTB", "LAD", "LCII", "LEA",
        "LEG", "LEN", "LGIH", "LKQ", "LOPE", "LOW", "LRN", "LULU",
        "LVS", "LZB", "M", "MAR", "MAT", "MATW", "MCD", "MCRI",
        "MCW", "MGM", "MHK", "MHO", "MNRO", "MODG", "MTH", "MTN",
        "MUSA", "NCLH", "NKE", "NVR", "NWL", "OLLI", "ORLY", "OSW",
        "OXM", "PAG", "PATK", "PENN", "PHIN", "PHM", "PII", "PLAY",
        "PLNT", "POOL", "PRDO", "PRKS", "PRSU", "PVH", "PZZA", "RCL",
        "RH", "RL", "ROST", "RRR", "SABR", "SAH", "SBH", "SBUX",
        "SCHL", "SCI", "SGI", "SHAK", "SHOO", "SIG", "SKY", "SMP",
        "SONO", "STRA", "THO", "THRM", "TJX", "TMHC", "TNL", "TOL",
        "TPH", "TPR", "TSCO", "TSLA", "TXRH", "UA", "UAA", "ULTA",
        "UPBD", "URBN", "VAC", "VC", "VFC", "VSCO", "VVV", "WEN",
        "WGO", "WH", "WHR", "WINA", "WING", "WSM", "WWW", "WYNN",
        "XPEL", "YETI", "YUM",
    ],
    "Consumer Staples": [
        "ACI", "ADM", "ANDE", "BF-B", "BG", "BJ", "BRBR", "CAG",
        "CALM", "CART", "CASY", "CELH", "CENT", "CENTA", "CHD", "CHEF",
        "CL", "CLX", "COKE", "COST", "COTY", "CPB", "DAR", "DG",
        "DLTR", "EL", "ELF", "ENR", "EPC", "FDP", "FIZZ", "FLO",
        "FRPT", "GIS", "GO", "HRL", "HSY", "INGR", "IPAR", "JBSS",
        "JJSF", "KDP", "KHC", "KMB", "KO", "KR", "KVUE", "LW",
        "MDLZ", "MKC", "MNST", "MO", "MZTI", "PEP", "PFGC", "PG",
        "PM", "POST", "PPC", "PSMT", "REYN", "SAM", "SFM", "SJM",
        "SMPL", "STZ", "SYY", "TAP", "TGT", "TR", "TSN", "UNFI",
        "USFD", "UVV", "VITL", "WDFC", "WMT",
    ],
    "Energy": [
        "AESI", "AM", "APA", "AR", "AROC", "BKR", "BTU", "CHRD",
        "CLB", "CNR", "CNX", "COP", "CRC", "CRGY", "CRK", "CTRA",
        "CVI", "CVX", "DINO", "DTM", "DVN", "EOG", "EQT", "EXE",
        "FANG", "FTI", "HAL", "HLX", "HP", "INSW", "INVX", "KGS",
        "KMI", "KNTK", "LBRT", "LPG", "MGY", "MPC", "MTDR", "MUR",
        "NE", "NOG", "NOV", "OII", "OKE", "OVV", "OXY", "PARR",
        "PBF", "PR", "PSX", "PTEN", "RES", "REX", "RRC", "SLB",
        "SM", "TALO", "TDW", "TPL", "TRGP", "VAL", "VLO", "VNOM",
        "VTOL", "WFRD", "WHD", "WKC", "WMB", "XOM",
    ],
    "Financials": [
        "AAMI", "ABCB", "ABR", "ACGL", "ACT", "AFG", "AFL", "AGO",
        "AIG", "AIZ", "AJG", "ALL", "ALLY", "ALRM", "AMG", "AMP",
        "AMSF", "AON", "APAM", "APO", "ARES", "ASB", "AUB", "AX",
        "AXP", "BAC", "BANC", "BANF", "BANR", "BBT", "BEN", "BFH",
        "BGC", "BHF", "BK", "BKU", "BLK", "BOH", "BRK-B", "BRO",
        "BX", "BXMT", "C", "CASH", "CATY", "CB", "CBOE", "CBSH",
        "CBU", "CFFN", "CFG", "CFR", "CG", "CHCO", "CINF", "CME",
        "CNO", "CNS", "COF", "COIN", "COLB", "CPAY", "CPF", "CRBG",
        "CUBI", "CVBF", "DCOM", "DFIN", "ECPG", "EEFT", "EFC", "EG",
        "EGBN", "EIG", "ENVA", "EQH", "ERIE", "ESNT", "EVR", "EVTC",
        "EWBC", "EZPW", "FAF", "FBK", "FBNC", "FBP", "FCF", "FCFS",
        "FDS", "FFBC", "FFIN", "FHB", "FHI", "FHN", "FIBK", "FIS",
        "FISV", "FITB", "FLG", "FNB", "FNF", "FOUR", "FULT", "GBCI",
        "GL", "GNW", "GPN", "GS", "GSHD", "HAFC", "HASI", "HBAN",
        "HCI", "HIG", "HLI", "HLNE", "HMN", "HOMB", "HOOD", "HOPE",
        "HTH", "HWC", "IBKR", "IBOC", "ICE", "INDB", "IVZ", "JEF",
        "JHG", "JKHY", "JPM", "JXN", "KEY", "KKR", "KMPR", "KNSL",
        "KREF", "L", "LKFN", "LNC", "MA", "MBIN", "MC", "MCO",
        "MCY", "MET", "MKTX", "MORN", "MRSH", "MS", "MSCI", "MTB",
        "MTG", "NATL", "NAVI", "NBHC", "NBTB", "NDAQ", "NLY", "NMIH",
        "NTRS", "NWBI", "OFG", "ONB", "ORI", "OZK", "PAYO", "PB",
        "PFBC", "PFG", "PFS", "PGR", "PIPR", "PJT", "PLMR", "PNC",
        "PNFP", "PRA", "PRAA", "PRG", "PRI", "PRK", "PRU", "PYPL",
        "RDN", "RF", "RGA", "RJF", "RLI", "RNR", "RNST", "RYAN",
        "SAFT", "SBCF", "SBSI", "SCHW", "SEIC", "SEZL", "SF", "SFBS",
        "SFNC", "SIGI", "SLM", "SNEX", "SPGI", "SPNT", "SSB", "STBA",
        "STC", "STEL", "STEP", "STT", "STWD", "SYF", "TBBK", "TCBI",
        "TFC", "TFIN", "THG", "TMP", "TRMK", "TROW", "TRST", "TRUP",
        "TRV", "TWO", "UBSI", "UCB", "UFCS", "UMBF", "UNM", "USB",
        "V", "VCTR", "VIRT", "VLY", "VOYA", "VRTS", "WABC", "WAFD",
        "WAL", "WBS", "WD", "WEX", "WFC", "WRB", "WRLD", "WSFS",
        "WT", "WTFC", "WTW", "WU", "XYZ", "ZION",
    ],
    "Health Care": [
        "A", "ABBV", "ABT", "ACAD", "ACHC", "ADMA", "ADUS", "AHCO",
        "ALGN", "ALKS", "AMGN", "AMN", "AMPH", "AMRX", "ANIP", "AORT",
        "APLS", "ARWR", "ASTH", "AVNS", "AVTR", "AZTA", "BAX", "BDX",
        "BIIB", "BIO", "BLFS", "BMRN", "BMY", "BRKR", "BSX", "BTSG",
        "CAH", "CERT", "CHE", "CI", "CNC", "CNMD", "COLL", "CON",
        "COO", "COR", "CORT", "CPRX", "CRL", "CRVL", "CTKB", "CVS",
        "CYTK", "DGX", "DHR", "DOCS", "DVA", "DXCM", "EHC", "ELAN",
        "ELV", "EMBC", "ENOV", "ENSG", "EW", "EXEL", "FTRE", "GEHC",
        "GILD", "GKOS", "GMED", "HAE", "HALO", "HCA", "HFWA", "HIMS",
        "HOLX", "HQY", "HRMY", "HSIC", "HSTM", "HUM", "IART", "ICUI",
        "IDXX", "ILMN", "INCY", "INDV", "INSP", "INVA", "IQV", "ISRG",
        "ITGR", "JAZZ", "JNJ", "KRYS", "LGND", "LH", "LIVN", "LLY",
        "LMAT", "LNTH", "MASI", "MCK", "MD", "MDT", "MEDP", "MMSI",
        "MOH", "MRK", "MRNA", "MTD", "MYGN", "NBIX", "NEO", "NEOG",
        "NHC", "NVST", "OGN", "OMCL", "OPCH", "PAHC", "PBH", "PCRX",
        "PEN", "PFE", "PGNY", "PODD", "PRGO", "PRVA", "PTCT", "PTGX",
        "QDEL", "RCUS", "RDNT", "REGN", "RGEN", "RMD", "ROIV", "RVTY",
        "SDGR", "SEM", "SHC", "SOLV", "SRPT", "STAA", "STE", "SUPN",
        "SYK", "TECH", "TFX", "TGTX", "THC", "TMDX", "TMO", "TNDM",
        "UFPT", "UHS", "UNH", "USPH", "UTHR", "VCEL", "VCYT", "VIR",
        "VRTX", "VTRS", "WAT", "WAY", "WST", "XNCR", "XRAY", "ZBH",
        "ZTS",
    ],
    "Industrials": [
        "AAL", "AAON", "ABM", "ACA", "ACM", "ADP", "AGCO", "AIN",
        "AIR", "AIT", "AL", "ALG", "ALGT", "ALK", "ALLE", "AME",
        "AMTM", "AMWD", "AOS", "APG", "APOG", "ARCB", "ASTE", "ATI",
        "AVAV", "AWI", "AXON", "AYI", "AZZ", "BA", "BAH", "BCC",
        "BCO", "BLDR", "BR", "BRC", "BWXT", "CACI", "CAR", "CARR",
        "CAT", "CHRW", "CLH", "CMI", "CNH", "CNM", "CNXC", "CPRT",
        "CR", "CRS", "CSGS", "CSL", "CSW", "CSX", "CTAS", "CW",
        "CWST", "CXW", "DAL", "DCI", "DE", "DLX", "DNOW", "DOV",
        "DXPE", "DY", "ECG", "EFX", "EME", "EMR", "ENS", "EPAC",
        "ESAB", "ESE", "ETN", "EXLS", "EXPD", "EXPO", "FAST", "FBIN",
        "FCN", "FDX", "FELE", "FIX", "FLR", "FLS", "FSS", "FTV",
        "FWRD", "G", "GATX", "GBX", "GD", "GE", "GEO", "GEV",
        "GFF", "GGG", "GNRC", "GTES", "GTLS", "GVA", "GWW", "GXO",
        "HAYW", "HCSG", "HII", "HNI", "HON", "HTLD", "HTZ", "HUBB",
        "HUBG", "HWM", "HXL", "IEX", "IIIN", "IR", "ITT", "ITW",
        "J", "JBHT", "JBLU", "JBTM", "JCI", "KAI", "KBR", "KEX",
        "KFY", "KMT", "KNX", "KTOS", "LDOS", "LECO", "LHX", "LII",
        "LMT", "LQDT", "LSTR", "LUV", "LZ", "MAN", "MAS", "MATX",
        "MBC", "MIDD", "MLI", "MLKN", "MMM", "MMS", "MOG-A", "MRCY",
        "MRTN", "MSA", "MSM", "MTZ", "MWA", "MYRG", "NDSN", "NOC",
        "NPK", "NPO", "NSC", "NSIT", "NSP", "NVRI", "NVT", "NX",
        "NXT", "OC", "ODFL", "OPLN", "OSK", "OTIS", "PAYC", "PAYX",
        "PBI", "PCAR", "PCTY", "PH", "PNR", "POWL", "PRIM", "PRLB",
        "PSN", "PWR", "R", "RBA", "RBC", "REZI", "RHI", "ROCK",
        "ROK", "ROL", "RRX", "RSG", "RTX", "RUN", "RUSHA", "RXO",
        "SAIA", "SAIC", "SARO", "SKYW", "SNA", "SNCY", "SNDR", "SPXC",
        "SSD", "ST", "STRL", "SWK", "SXI", "TDG", "TEX", "TILE",
        "TKR", "TNC", "TREX", "TRN", "TRU", "TT", "TTC", "TTEK",
        "TXT", "UAL", "UBER", "UFPI", "ULS", "UNF", "UNP", "UPS",
        "UPWK", "URI", "VICR", "VLTO", "VMI", "VRRM", "VRSK", "VSTS",
        "WAB", "WCC", "WERN", "WM", "WMS", "WOR", "WSC", "WSO",
        "WTS", "WWD", "XPO", "XYL", "ZWS",
    ],
    "Technology": [
        "AAPL", "ACIW", "ACLS", "ACMR", "ACN", "ADBE", "ADEA", "ADI",
        "ADSK", "AEIS", "AGYS", "AKAM", "ALGM", "AMAT", "AMD", "AMKR",
        "ANET", "AOSL", "APH", "APP", "APPF", "ARLO", "ARW", "ASGN",
        "ATEN", "AVGO", "AVT", "BDC", "BHE", "BILL", "BL", "BLKB",
        "BMI", "BOX", "BSY", "CALX", "CDNS", "CDW", "CGNX", "CIEN",
        "CLSK", "CNXN", "COHR", "COHU", "CRM", "CRSR", "CRUS", "CRWD",
        "CSCO", "CTS", "CTSH", "CVLT", "CXM", "CXT", "DBX", "DDOG",
        "DELL", "DGII", "DIOD", "DLB", "DOCN", "DOCU", "DT", "DXC",
        "ENPH", "ENTG", "EPAM", "EXTR", "FFIV", "FICO", "FLEX", "FN",
        "FORM", "FSLR", "FTNT", "GDDY", "GDYN", "GEN", "GLW", "GWRE",
        "HLIT", "HPE", "HPQ", "IBM", "ICHR", "IDCC", "INTC", "INTU",
        "IPGP", "IT", "ITRI", "JBL", "KD", "KEYS", "KLAC", "KLIC",
        "KN", "LFUS", "LITE", "LRCX", "LSCC", "MANH", "MARA", "MCHP",
        "MIR", "MKSI", "MPWR", "MSFT", "MSI", "MTSI", "MU", "MXL",
        "NABL", "NOVT", "NOW", "NTAP", "NTCT", "NTNX", "NVDA", "NXPI",
        "OKTA", "OLED", "ON", "ONTO", "ORCL", "OSIS", "PANW", "PATH",
        "PDFS", "PEGA", "PENG", "PI", "PLAB", "PLTR", "PLUS", "PLXS",
        "POWI", "PRGS", "PSTG", "PTC", "Q", "QCOM", "QLYS", "QRVO",
        "QTWO", "RAL", "RAMP", "RMBS", "RNG", "ROG", "ROP", "SANM",
        "SCSC", "SEDG", "SITM", "SLAB", "SMCI", "SMTC", "SNDK", "SNPS",
        "SNX", "SPSC", "STX", "SWKS", "SYNA", "TDC", "TDY", "TEL",
        "TER", "TRMB", "TTMI", "TWLO", "TXN", "TYL", "UCTT", "VECO",
        "VIAV", "VNT", "VRSN", "VSAT", "VSH", "VYX", "WDAY", "WDC",
        "YOU", "ZBRA",
    ],
    "Materials": [
        "AA", "ALB", "AMCR", "AMR", "APD", "ASH", "ATR", "AVNT",
        "AVY", "AXTA", "BALL", "BCPC", "CBT", "CC", "CCK", "CE",
        "CENX", "CF", "CLF", "CMC", "CRH", "CTVA", "DD", "DOW",
        "ECL", "EMN", "ESI", "EXP", "FCX", "FMC", "FUL", "GEF",
        "GPK", "HCC", "HL", "HWKN", "IFF", "IOSP", "IP", "KALU",
        "KNF", "KOP", "KWR", "LIN", "LNN", "LPX", "LYB", "MLM",
        "MOS", "MP", "MTRN", "MTUS", "MTX", "NEM", "NEU", "NGVT",
        "NUE", "OI", "OLN", "PKG", "PPG", "RGLD", "RPM", "RS",
        "SCL", "SEE", "SHW", "SLGN", "SLVM", "SMG", "SOLS", "SON",
        "STLD", "SW", "SXC", "SXT", "TWI", "VMC", "WLK", "WS",
    ],
    "Real Estate": [
        "AAT", "ADAM", "ADC", "AHH", "AHR", "AKR", "ALEX", "AMH",
        "AMT", "APLE", "ARE", "ARI", "ARR", "AVB", "BFS", "BRX",
        "BXP", "CBRE", "CCI", "CDP", "CPT", "CSGP", "CSR", "CTRE",
        "CUBE", "CURB", "CUZ", "CWK", "DEA", "DEI", "DLR", "DOC",
        "DRH", "EGP", "ELS", "EPR", "EPRT", "EQIX", "EQR", "ESS",
        "EXPI", "EXR", "FBRT", "FCPT", "FR", "FRT", "GLPI", "GNL",
        "GTY", "HIW", "HR", "HST", "IIPR", "INN", "INVH", "IRM",
        "IRT", "JBGS", "JLL", "JOE", "KIM", "KRC", "KRG", "KW",
        "LAMR", "LTC", "LXP", "MAA", "MAC", "MMI", "MPT", "MRP",
        "NNN", "NSA", "NXRT", "O", "OHI", "OUT", "PEB", "PECO",
        "PK", "PLD", "PMT", "PSA", "REG", "REXR", "RHP", "RWT",
        "RYN", "SAFE", "SBAC", "SBRA", "SHO", "SKT", "SLG", "SPG",
        "STAG", "TRNO", "UDR", "UE", "UHT", "VICI", "VNO", "VRE",
        "VTR", "WELL", "WPC", "WSR", "WY", "XHR",
    ],
    "Utilities": [
        "AEE", "AEP", "AES", "ATO", "AVA", "AWK", "AWR", "BKH",
        "CEG", "CMS", "CNP", "CPK", "CWEN", "CWEN-A", "CWT", "D",
        "DTE", "DUK", "ED", "EIX", "ES", "ETR", "EVRG", "EXC",
        "FE", "HE", "HTO", "IDA", "LNT", "MDU", "MGEE", "MSEX",
        "NEE", "NFG", "NI", "NJR", "NRG", "NWE", "NWN", "OGE",
        "OGS", "ORA", "OTTR", "PCG", "PEG", "PNW", "POR", "PPL",
        "SO", "SR", "SRE", "SWX", "TLN", "TXNM", "UGI", "UTL",
        "VST", "WEC", "WTRG", "XEL",
    ],
}

#  HIGH-YIELD ETFs  (Bond, Dividend, REIT, Preferred, Covered Call)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HIGH_YIELD_ETFS = [
    # Bond / Fixed Income
    "HYG",   # iShares iBoxx High Yield Corporate Bond
    "JNK",   # SPDR Bloomberg High Yield Bond
    "BKLN",  # Invesco Senior Loan ETF
    "VCIT",  # Vanguard Intermediate-Term Corp Bond
    "VCSH",  # Vanguard Short-Term Corp Bond
    "LQD",   # iShares iBoxx Investment Grade Corp Bond
    "TLT",   # iShares 20+ Year Treasury Bond
    "BND",   # Vanguard Total Bond Market
    "AGG",   # iShares Core U.S. Aggregate Bond
    "EMB",   # iShares J.P. Morgan USD Emerging Markets Bond
    # Dividend / Equity Income
    "VYM",   # Vanguard High Dividend Yield
    "SCHD",  # Schwab U.S. Dividend Equity
    "HDV",   # iShares Core High Dividend
    "DVY",   # iShares Select Dividend
    "SDY",   # SPDR S&P Dividend
    "NOBL",  # ProShares S&P 500 Dividend Aristocrats
    "SPYD",  # SPDR Portfolio S&P 500 High Dividend
    "DGRO",  # iShares Core Dividend Growth
    # REIT
    "VNQ",   # Vanguard Real Estate
    "XLRE",  # Real Estate Select Sector SPDR
    "REM",   # iShares Mortgage Real Estate
    # Preferred Stock
    "PFF",   # iShares Preferred & Income Securities
    "PGX",   # Invesco Preferred
    # Covered Call / Income Strategy
    "JEPI",  # JPMorgan Equity Premium Income
    "JEPQ",  # JPMorgan Nasdaq Equity Premium Income
    "QYLD",  # Global X NASDAQ 100 Covered Call
    "XYLD",  # Global X S&P 500 Covered Call
    "DIVO",  # Amplify CWP Enhanced Dividend Income
    # Multi-Asset Income
    "IYLD",  # iShares Morningstar Multi-Asset Income
    "PCEF",  # Invesco CEF Income Composite
]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HIGH DIVIDEND STOCKS  (Aristocrats, Kings, Champions)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HIGH_DIVIDEND_STOCKS = [
    # Dividend Kings (25+ years of increases)
    "KO",    # Coca-Cola
    "PG",    # Procter & Gamble
    "JNJ",   # Johnson & Johnson
    "MMM",   # 3M
    "PEP",   # PepsiCo
    "CL",    # Colgate-Palmolive
    "ED",    # Consolidated Edison
    "GPC",   # Genuine Parts
    "EMR",   # Emerson Electric
    "SWK",   # Stanley Black & Decker
    # High Yield Blue Chips
    "T",     # AT&T
    "VZ",    # Verizon
    "MO",    # Altria Group
    "PM",    # Philip Morris
    "IBM",   # IBM
    "XOM",   # Exxon Mobil
    "CVX",   # Chevron
    "ABBV",  # AbbVie
    "PFE",   # Pfizer
    "BMY",   # Bristol-Myers Squibb
    # REITs (high dividend)
    "O",     # Realty Income
    "VICI",  # VICI Properties
    "SPG",   # Simon Property Group
    "DLR",   # Digital Realty Trust
    "AMT",   # American Tower
    # Utilities (steady dividend)
    "DUK",   # Duke Energy
    "SO",    # Southern Company
    "NEE",   # NextEra Energy
    "D",     # Dominion Energy
    "AEP",   # American Electric Power
]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  AI / ML / SEMICONDUCTOR STOCKS  (Thematic Dashboard)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI_STOCKS = [
    # Core AI / Cloud
    "NVDA",   # NVIDIA
    "AMD",    # AMD
    "GOOGL",  # Alphabet
    "MSFT",   # Microsoft
    "META",   # Meta Platforms
    "AMZN",   # Amazon
    "AAPL",   # Apple
    "PLTR",   # Palantir
    "CRM",    # Salesforce
    "NOW",    # ServiceNow
    "SNOW",   # Snowflake
    "ARM",    # Arm Holdings
    # Semiconductors & Infra
    "SMCI",   # Super Micro Computer
    "MRVL",   # Marvell Technology
    "AVGO",   # Broadcom
    "INTC",   # Intel
    "MU",     # Micron
    "DELL",   # Dell Technologies
    "HPE",    # Hewlett Packard Enterprise
    "TSM",    # TSMC (ADR)
    # Cybersecurity AI
    "CRWD",   # CrowdStrike
    "PANW",   # Palo Alto Networks
    "ZS",     # Zscaler
    "FTNT",   # Fortinet
    # Data / Analytics AI
    "DDOG",   # Datadog
    "TEAM",   # Atlassian
    "WDAY",   # Workday
    "ADBE",   # Adobe
    "ORCL",   # Oracle
    "IBM",    # IBM
]

# Flat list for convenience (stocks + ETFs + dividend stocks)
_stock_tickers = {t for tickers in UNIVERSE.values() for t in tickers}
STOCK_TICKERS = sorted(_stock_tickers)  # Stocks only (no ETFs)
ETF_TICKERS = sorted(HIGH_YIELD_ETFS)   # ETFs only

# Cloud deployment: limit universe size to avoid resource exhaustion
# Set DEPLOY_TICKER_LIMIT=200 (or any number) on Railway/Render
# Auto-detect Railway and default to 200 tickers if not explicitly set
_full_tickers = sorted(_stock_tickers | set(HIGH_YIELD_ETFS) | set(HIGH_DIVIDEND_STOCKS))
_is_railway = bool(os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("RAILWAY_SERVICE_NAME"))
_default_limit = "200" if _is_railway else "0"
_ticker_limit = int(os.environ.get("DEPLOY_TICKER_LIMIT", _default_limit))
if _ticker_limit > 0:
    # Prioritize S&P 500 stocks + all ETFs + dividend stocks
    _sp500_sectors = ["Technology", "Healthcare", "Financials", "Consumer Discretionary",
                      "Industrials", "Communication Services", "Consumer Staples", "Energy"]
    _priority_tickers = []
    for sec in _sp500_sectors:
        _priority_tickers.extend(UNIVERSE.get(sec, [])[:_ticker_limit // len(_sp500_sectors)])
    _priority_tickers.extend(HIGH_YIELD_ETFS[:10])
    _priority_tickers.extend(HIGH_DIVIDEND_STOCKS[:10])
    ALL_TICKERS = sorted(set(_priority_tickers))[:_ticker_limit]
    print(f"  ☁ Cloud mode: limited to {len(ALL_TICKERS)} tickers (DEPLOY_TICKER_LIMIT={_ticker_limit})")
else:
    ALL_TICKERS = _full_tickers

# Reverse lookup: ticker → sector
TICKER_SECTOR = {}
for sector, tickers in UNIVERSE.items():
    for t in tickers:
        TICKER_SECTOR[t] = sector
# Label ETFs and dividend stocks
for t in HIGH_YIELD_ETFS:
    if t not in TICKER_SECTOR:
        TICKER_SECTOR[t] = "ETF — Income"
for t in HIGH_DIVIDEND_STOCKS:
    if t not in TICKER_SECTOR:
        pass  # already has sector from UNIVERSE

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
