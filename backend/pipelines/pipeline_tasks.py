"""
pipeline_tasks.py — Celery Tasks for Parallel Screening
=========================================================
Defines the distributed units of work for the momentum engine.
Allows horizontal scaling across multiple Celery workers.

Uses the synchronous SQLite db module (no async needed in workers).
"""

import logging
import pandas as pd
from typing import List, Dict, Any

from celery_app import celery_app as app
import db
from momentum_screener import screen_ticker

logger = logging.getLogger(__name__)


@app.task(name="pipelines.screen_chunk")
def screen_chunk_task(tickers: List[str], start: str = None, end: str = None) -> List[Dict[str, Any]]:
    """
    Worker task: fetches data from DB for a chunk of tickers and screens them.
    Returns a list of result dictionaries.
    """
    logger.info(f"Screening chunk of {len(tickers)} tickers: {tickers[:3]}...")
    
    # 1. Load OHLCV from SQLite (synchronous)
    try:
        ohlcv_data = db.load_all_ohlcv(tickers, start, end)
    except Exception as e:
        logger.error(f"Failed to load OHLCV for chunk: {e}")
        return []

    # 2. Screen each ticker
    results = []
    for ticker in tickers:
        df = ohlcv_data.get(ticker)
        if df is not None and not df.empty:
            try:
                res = screen_ticker(ticker, df)
                if res:
                    results.append(res)
            except Exception as e:
                logger.error(f"Failed to screen {ticker}: {e}")
    
    return results


@app.task(name="pipelines.fetch_yield_chunk")
def fetch_yield_chunk_task(tickers: List[str], screened_results: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Worker task: fetches yield data for a chunk of tickers.
    """
    from engine import _fetch_single_yield
    
    results = []
    for ticker in tickers:
        try:
            res = _fetch_single_yield(ticker, screened_results)
            if res:
                results.append(res)
        except Exception as e:
            logger.error(f"Failed to fetch yield for {ticker}: {e}")
            
    return results
