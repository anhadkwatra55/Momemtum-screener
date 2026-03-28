#!/usr/bin/env python3
"""
worker.py — Celery Worker: ML Pipeline + Mathematical Triage Gate
===================================================================
Phase 4 Celery task that runs the XGBoost inference pipeline
asynchronously and applies the Triage Gate to filter anomalies.

Pipeline (per job):
    1. Fetch real OHLCV data for the full ticker universe
    2. Engineer stationary features (Phase 2 transforms)
    3. Load pre-trained XGBoost model → predict bullish probability
    4. Apply Triage Gate (cross-sectional rank → gating decision)
    5. Update Redis job state at each step

The Triage Gate Math:
    Conviction_{i,t}       = |p_{i,t} - 0.5|
    RankedConviction_{i,t} = Rank(Conviction) / N
    RankedVolume_{i,t}     = Rank(VolumeZScore21) / N
    TriageScore_{i,t}      = 0.6 × RankedConviction + 0.4 × RankedVolume

    Gate: TriageScore ≥ 0.95 → trigger LLM debate (Phase 5)
          TriageScore < 0.95 → return raw probability, close job

Dependencies: celery, redis, pandas, numpy, xgboost
Run worker:  celery -A celery_app worker --loglevel=info
"""

from __future__ import annotations

import json
import os
import time
import traceback
import warnings
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ── Paths ──
PIPELINES_DIR = Path(__file__).parent
MODEL_PATH = PIPELINES_DIR / "xgb_model.json"

# ── Feature columns (must match train_model.py) ──
FEATURE_COLS = [
    "close_ffd",
    "close_zscore_21",
    "close_zscore_63",
    "volume_zscore_21",
    "volume_zscore_63",
    "score_gauss_rank",
]

# ── Triage Gate weights ──
# 60% conviction (how extreme the XGBoost prediction is)
# 40% volume (unusual activity confirming the signal)
TRIAGE_W_CONVICTION = 0.6
TRIAGE_W_VOLUME = 0.4
TRIAGE_THRESHOLD = 0.95    # Top 5% of daily universe triggers LLM debate

# ── 5-Ticker Sandbox (lightning-fast testing) ──
ML_SANDBOX_TICKERS = ["WCP.TO", "BTE.TO", "PXT.TO", "CCO.TO", "IVN.TO"]

# ── Redis key prefix for ML jobs ──
JOB_KEY_PREFIX = "ml:job:"
JOB_TTL = 3600  # 1 hour expiry

# ── Kelly Criterion Position Sizing ──
KELLY_FRACTION = 0.5       # Half-Kelly (conservative)
KELLY_R_TARGET = 0.01      # 1% max daily portfolio risk
KELLY_ATR_WINDOW = 20      # 20-day ATR for volatility


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  REDIS JOB STATE HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _get_redis():
    """Get the Redis client from our existing cache singleton."""
    from redis_cache import get_cache
    cache = get_cache()
    if cache._redis_ok and cache._redis is not None:
        return cache._redis
    return None


def _update_job(job_id: str, data: dict) -> None:
    """
    Update the Redis state for a job.

    Key: ml:job:{job_id}
    Value: JSON dict with status, timestamps, results
    TTL: 1 hour (auto-cleanup)
    """
    r = _get_redis()
    key = f"{JOB_KEY_PREFIX}{job_id}"
    data["updated_at"] = time.time()
    if r:
        try:
            r.setex(key, JOB_TTL, json.dumps(data, default=str))
        except Exception:
            pass  # Non-critical — SSE will report "unknown" status


def get_job_status(job_id: str) -> Optional[dict]:
    """Read the current job state from Redis."""
    r = _get_redis()
    if r:
        try:
            raw = r.get(f"{JOB_KEY_PREFIX}{job_id}")
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    return None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  TRIAGE GATE — Cross-Sectional Ranking + Gating
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def apply_triage_gate(predictions_df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply the mathematical Triage Gate to XGBoost predictions.

    This function ranks both Conviction and Volume cross-sectionally
    across the FULL ticker universe on a given day, forcing each to
    a uniform distribution on [0, 1]. This isolates true anomalies
    from noise — only the top 5% (TriageScore ≥ 0.95) pass the gate.

    The Triage Gate Equations:
    ─────────────────────────

    Step 1 — Conviction (how extreme the XGBoost prediction is):
        Conviction_{i,t} = |p_{i,t} - 0.5|

        Where p_{i,t} is the XGBoost predicted probability (0 to 1).
        Neutral predictions (p ≈ 0.5) have ~0 conviction.
        Extreme predictions (p → 0 or p → 1) have high conviction.

    Step 2 — Ranked Conviction (cross-sectional uniform rank):
        RankedConviction_{i,t} = Rank(Conviction_{i,t}) / N

        Where N = number of tickers in the active universe.
        Rank uses average method for ties.
        Result: uniform distribution on [1/N, 1.0].
        This prevents any single day's volatility regime from
        inflating all conviction scores.

    Step 3 — Ranked Volume (cross-sectional volume rank):
        RankedVolume_{i,t} = Rank(VolumeZScore21_{i,t}) / N

        Volume Z-Score captures unusual trading activity.
        Cross-sectional ranking normalises across the universe.

    Step 4 — Triage Score (blended gate metric):
        TriageScore_{i,t} = (w1 × RankedConviction) + (w2 × RankedVolume)

        Where w1 = 0.6 (conviction weight) and w2 = 0.4 (volume weight).
        Both inputs are uniform [0, 1] so TriageScore ∈ [0, 1].

    Step 5 — Gating Decision:
        If TriageScore ≥ 0.95  → flag for LLM debate (top 5%)
        If TriageScore < 0.95  → return raw probability, close job.

    Parameters
    ----------
    predictions_df : pd.DataFrame
        Must contain columns: 'ticker', 'probability', 'volume_zscore_21'
        One row per ticker (the latest day's cross-section).

    Returns
    -------
    pd.DataFrame : with additional columns:
        conviction, ranked_conviction, ranked_volume,
        triage_score, trigger_llm
    """
    df = predictions_df.copy()
    n = len(df)

    if n == 0:
        return df

    # ── Step 1: Conviction = absolute deviation from neutral ──
    # p = 0.5 → conviction = 0 (no edge)
    # p = 0.0 or 1.0 → conviction = 0.5 (maximum edge)
    df["conviction"] = (df["probability"] - 0.5).abs()

    # ── Step 2: Rank conviction cross-sectionally ──
    # rank() with method='average' handles ties; divide by N
    # to map ranks to [1/N, 1.0] (approximately uniform)
    df["ranked_conviction"] = df["conviction"].rank(method="average") / n

    # ── Step 3: Rank volume Z-score cross-sectionally ──
    # High volume Z-score → unusual activity → higher rank
    df["ranked_volume"] = df["volume_zscore_21"].rank(method="average") / n

    # ── Step 4: Blend into Triage Score ──
    # TriageScore = 0.6 × RankedConviction + 0.4 × RankedVolume
    # Both inputs are uniform [0, 1], so output ∈ [0, 1].
    # The 60/40 weighting prioritises the model's conviction
    # while still requiring volume confirmation.
    df["triage_score"] = (
        TRIAGE_W_CONVICTION * df["ranked_conviction"]
        + TRIAGE_W_VOLUME * df["ranked_volume"]
    )

    # ── Step 5: Gating decision ──
    # Only the top 5% (TriageScore ≥ 0.95) trigger the heavy
    # multi-agent LLM debate. This conserves compute by filtering
    # out the ~95% of tickers that don't warrant deep analysis.
    df["trigger_llm"] = df["triage_score"] >= TRIAGE_THRESHOLD

    return df


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  KELLY CRITERION — Optimal Position Sizing
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def compute_kelly_weight(
    probability: float,
    ohlcv_df: Optional[pd.DataFrame] = None,
    f: float = KELLY_FRACTION,
    r_target: float = KELLY_R_TARGET,
    atr_window: int = KELLY_ATR_WINDOW,
) -> float:
    """
    Compute the Kelly Criterion suggested portfolio weight.

    The Math:
    ─────────
        Raw Edge:       K = 2p - 1        (if p ≤ 0.5, K = 0 → no position)
        Fractional:     f = 0.5            (Half-Kelly for safety)
        NATR_20:        ATR_20 / close     (normalised volatility)
        Final Weight:   w = (f × K) × (R_target / NATR_20)

    Where:
        p          = XGBoost bullish probability ∈ [0, 1]
        K          = raw edge; only positive when p > 0.5
        f          = Kelly fraction (0.5 = Half-Kelly, conservative)
        R_target   = 0.01 (1% max daily portfolio risk budget)
        NATR_20    = 20-day Average True Range / current close price
                     (normalises volatility across different price levels)

    Returns:
        w ∈ [0, 1] — suggested portfolio weight (0 means no position)
    """
    # ── Step 1: Raw edge K = 2p - 1 ──
    if probability <= 0.5:
        return 0.0     # No bullish edge → no position

    K = 2.0 * probability - 1.0

    # ── Step 2: Compute NATR_20 if OHLCV data is available ──
    natr = None
    if ohlcv_df is not None and len(ohlcv_df) >= atr_window + 1:
        try:
            high = ohlcv_df["High"] if "High" in ohlcv_df.columns else ohlcv_df["high"]
            low = ohlcv_df["Low"] if "Low" in ohlcv_df.columns else ohlcv_df["low"]
            close = ohlcv_df["Close"] if "Close" in ohlcv_df.columns else ohlcv_df["close"]

            # True Range = max(H-L, |H-prev_close|, |L-prev_close|)
            prev_close = close.shift(1)
            tr = pd.concat([
                (high - low),
                (high - prev_close).abs(),
                (low - prev_close).abs(),
            ], axis=1).max(axis=1)

            atr_20 = tr.rolling(window=atr_window).mean().iloc[-1]
            current_close = float(close.iloc[-1])

            if current_close > 0 and not np.isnan(atr_20):
                natr = atr_20 / current_close
        except Exception:
            pass

    # Fallback NATR if no OHLCV data (assume 2% daily volatility)
    if natr is None or natr <= 0 or np.isnan(natr):
        natr = 0.02

    # ── Step 3: Final weight = (f × K) × (R_target / NATR_20) ──
    w = (f * K) * (r_target / natr)

    # Clamp to [0, 1] (can't be >100% of portfolio)
    return float(np.clip(w, 0.0, 1.0))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  FEATURE ENGINEERING (lightweight wrapper for worker context)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _build_features_for_universe(ohlcv_data: dict) -> pd.DataFrame:
    """
    Build the stationary feature panel from raw OHLCV data.

    Uses the same transforms from Phase 2 (features.py):
        - Fractional Differencing of log(close)
        - Rolling Z-Scores (21d, 63d) on close and volume
        - Gaussian Rank Normalization of composite momentum score

    If MAC_MINI_SERVER_MODE=true: processes in chunks with gc.collect()
    to stay under the 1.5GB Celery container limit.
    Otherwise: runs the original single-pass logic.

    Parameters
    ----------
    ohlcv_data : dict
        Mapping of ticker → pd.DataFrame with columns:
        Close, Volume, composite_momentum_score

    Returns
    -------
    pd.DataFrame : feature panel with MultiIndex [date, ticker]
    """
    from features import (
        frac_diff_ffd, rolling_zscore,
        gaussian_rank_normalize, FRAC_DIFF_D,
    )

    _server_mode = os.environ.get("MAC_MINI_SERVER_MODE", "").lower() == "true"

    if _server_mode:
        # ── SERVER MODE: chunked feature engineering ──
        import gc

        FEATURE_CHUNK_SIZE = int(os.environ.get("FEATURE_CHUNK_SIZE", "25"))
        tickers = [t for t, df in ohlcv_data.items() if df is not None and len(df) >= 100]

        if not tickers:
            return pd.DataFrame()

        n_chunks = (len(tickers) + FEATURE_CHUNK_SIZE - 1) // FEATURE_CHUNK_SIZE
        print(f"    ⚡ [SERVER MODE] Feature engineering: {len(tickers)} tickers in "
              f"{n_chunks} chunks (chunk={FEATURE_CHUNK_SIZE})")

        all_chunk_frames = []

        for chunk_idx in range(n_chunks):
            chunk_start = chunk_idx * FEATURE_CHUNK_SIZE
            chunk_end = min(chunk_start + FEATURE_CHUNK_SIZE, len(tickers))
            chunk_tickers = tickers[chunk_start:chunk_end]

            frames = []
            for ticker in chunk_tickers:
                df = ohlcv_data[ticker]
                ticker_df = pd.DataFrame({
                    "close": df["Close"].values,
                    "volume": df["Volume"].values,
                    "composite_momentum_score": df.get(
                        "composite_momentum_score",
                        pd.Series(0.0, index=df.index)
                    ).values,
                }, index=df.index)
                ticker_df["ticker"] = ticker
                ticker_df.index.name = "date"
                frames.append(ticker_df)

            panel = pd.concat(frames).reset_index()
            del frames
            panel = panel.set_index(["date", "ticker"]).sort_index()

            panel["log_close"] = np.log(panel["close"])
            panel["close_ffd"] = panel.groupby(level="ticker", group_keys=False)[
                "log_close"
            ].apply(lambda s: frac_diff_ffd(s, d=FRAC_DIFF_D))

            for col_name, raw_col, window in [
                ("close_zscore_21", "close", 21),
                ("close_zscore_63", "close", 63),
                ("volume_zscore_21", "volume", 21),
                ("volume_zscore_63", "volume", 63),
            ]:
                panel[col_name] = panel.groupby(level="ticker", group_keys=False)[
                    raw_col
                ].apply(lambda s, w=window: rolling_zscore(s, w))

            all_chunk_frames.append(panel)
            del panel
            gc.collect()

            if (chunk_idx + 1) % 3 == 0:
                print(f"    Feature chunk {chunk_idx+1}/{n_chunks} done")

        full_panel = pd.concat(all_chunk_frames)
        del all_chunk_frames
        gc.collect()

        full_panel = gaussian_rank_normalize(
            full_panel, "composite_momentum_score", "score_gauss_rank"
        )
        return full_panel

    # ── STANDARD MODE: original single-pass logic ──
    frames = []
    for ticker, df in ohlcv_data.items():
        if df is None or len(df) < 100:
            continue

        ticker_df = pd.DataFrame({
            "close": df["Close"].values,
            "volume": df["Volume"].values,
            "composite_momentum_score": df.get(
                "composite_momentum_score",
                pd.Series(0.0, index=df.index)
            ).values,
        }, index=df.index)
        ticker_df["ticker"] = ticker
        ticker_df.index.name = "date"
        frames.append(ticker_df)

    if not frames:
        return pd.DataFrame()

    panel = pd.concat(frames).reset_index()
    panel = panel.set_index(["date", "ticker"]).sort_index()

    # ── Apply per-ticker time-series transforms ──
    panel["log_close"] = np.log(panel["close"])
    panel["close_ffd"] = panel.groupby(level="ticker", group_keys=False)[
        "log_close"
    ].apply(lambda s: frac_diff_ffd(s, d=FRAC_DIFF_D))

    for col_name, raw_col, window in [
        ("close_zscore_21", "close", 21),
        ("close_zscore_63", "close", 63),
        ("volume_zscore_21", "volume", 21),
        ("volume_zscore_63", "volume", 63),
    ]:
        panel[col_name] = panel.groupby(level="ticker", group_keys=False)[
            raw_col
        ].apply(lambda s, w=window: rolling_zscore(s, w))

    # ── Apply cross-sectional Gaussian rank ──
    panel = gaussian_rank_normalize(
        panel, "composite_momentum_score", "score_gauss_rank"
    )

    return panel


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  XGBOOST INFERENCE (loads pre-trained model)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ── Module-level model cache (load once per worker process) ──
_MODEL_CACHE = None


def _load_model():
    """
    Load the pre-trained XGBoost model from disk (xgb_model.json).

    The model is cached at module level so it's loaded ONCE per
    worker process, not once per task. This avoids the ~200ms
    deserialization overhead on every request.
    """
    global _MODEL_CACHE
    if _MODEL_CACHE is None:
        import xgboost as xgb
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Pre-trained model not found at {MODEL_PATH}. "
                f"Run train_model.py first to generate xgb_model.json."
            )
        _MODEL_CACHE = xgb.XGBRegressor()
        _MODEL_CACHE.load_model(str(MODEL_PATH))
    return _MODEL_CACHE


def _predict_probability(features_df: pd.DataFrame) -> pd.DataFrame:
    """
    Run XGBoost inference to produce a bullish probability p ∈ [0, 1].

    The model was trained on Gaussian-rank normalized returns, so
    its raw predictions are in the normalized space (roughly [-2, 2]).
    We apply a sigmoid transform to map these to probabilities:

        p = 1 / (1 + exp(-prediction))

    This gives p ∈ (0, 1) where:
        p > 0.5 → bullish prediction
        p < 0.5 → bearish prediction
        p ≈ 0.5 → neutral/no edge

    Parameters
    ----------
    features_df : pd.DataFrame
        Feature panel with MultiIndex [date, ticker].
        Must contain FEATURE_COLS.

    Returns
    -------
    pd.DataFrame : latest day's predictions with columns:
        ticker, probability, volume_zscore_21
    """
    model = _load_model()

    # ── Get valid feature rows (drop any NaN) ──
    valid = features_df[FEATURE_COLS].dropna()
    if len(valid) == 0:
        return pd.DataFrame(columns=["ticker", "probability", "volume_zscore_21"])

    # ── Run inference ──
    raw_pred = model.predict(valid)

    # ── Sigmoid transform: map raw → probability ──
    probability = 1.0 / (1.0 + np.exp(-raw_pred))

    # ── Extract the LATEST date's cross-section ──
    result = valid.copy()
    result["raw_prediction"] = raw_pred
    result["probability"] = probability

    # Get volume_zscore_21 from the full feature panel
    result["volume_zscore_21"] = features_df.loc[
        result.index, "volume_zscore_21"
    ]

    # Take only the latest date (most recent cross-section)
    latest_date = result.index.get_level_values("date").max()
    latest = result.loc[latest_date].reset_index()

    return latest[["ticker", "probability", "volume_zscore_21"]]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  CELERY TASK — run_ml_pipeline
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

from celery_app import celery_app


@celery_app.task(name="run_ml_pipeline", bind=True, max_retries=2)
def run_ml_pipeline(self, ticker: str, job_id: str) -> dict:
    """
    Celery task: full ML pipeline for a single ticker request.

    Sequence:
        1. Fetch OHLCV data for the FULL universe (for cross-sectional ranking)
        2. Engineer stationary features
        3. XGBoost inference → probability
        4. Triage Gate → gate decision
        5. Update Redis with result

    We process the FULL universe (not just the requested ticker)
    because the Triage Gate requires cross-sectional ranking.
    The gate score for one ticker depends on ALL other tickers.

    Parameters
    ----------
    ticker : str
        The ticker that triggered this pipeline run.
    job_id : str
        Unique job ID for Redis state tracking + SSE streaming.

    Returns
    -------
    dict : final job result with status, probability, triage_score
    """
    import sys
    import logging

    sys.path.insert(0, str(PIPELINES_DIR))
    logger = logging.getLogger("worker")

    start_time = time.time()

    try:
        # ── Step 1: Mark job as running ──
        _update_job(job_id, {
            "status": "running",
            "step": "fetching_data",
            "ticker": ticker,
            "started_at": time.time(),
        })

        # ── Step 2: Fetch OHLCV data for 50-ticker sandbox ──
        # Uses the sandbox list, NOT the full 1500+ ticker universe.
        # yfinance.download with threads=True parallelises I/O.
        from momentum_data import smart_fetch

        universe = ML_SANDBOX_TICKERS
        # Ensure the requested ticker is always in the universe
        if ticker not in universe and ticker + ".TO" not in universe:
            universe = list(universe) + [ticker]

        ohlcv_data = {}
        for t in universe:
            try:
                df = smart_fetch(t)
                if df is not None and len(df) > 0:
                    ohlcv_data[t] = df
            except Exception:
                continue

        if not ohlcv_data:
            result = {
                "status": "error",
                "error": "No OHLCV data available for any ticker",
                "ticker": ticker,
            }
            _update_job(job_id, result)
            return result

        logger.info(f"[ML] Fetched {len(ohlcv_data)}/{len(universe)} tickers for job {job_id[:8]}")

        _update_job(job_id, {
            "status": "running",
            "step": "engineering_features",
            "ticker": ticker,
            "tickers_fetched": len(ohlcv_data),
        })

        # ── Step 3: Engineer stationary features ──
        features_panel = _build_features_for_universe(ohlcv_data)

        if features_panel.empty:
            result = {
                "status": "error",
                "error": "Feature engineering produced empty panel",
                "ticker": ticker,
            }
            _update_job(job_id, result)
            return result

        _update_job(job_id, {
            "status": "running",
            "step": "xgboost_inference",
            "ticker": ticker,
            "feature_rows": len(features_panel),
        })

        # ── Step 4: XGBoost inference ──
        predictions = _predict_probability(features_panel)

        if predictions.empty:
            result = {
                "status": "error",
                "error": "XGBoost inference produced no predictions",
                "ticker": ticker,
            }
            _update_job(job_id, result)
            return result

        _update_job(job_id, {
            "status": "running",
            "step": "triage_gate",
            "ticker": ticker,
            "predictions_count": len(predictions),
        })

        # ── Step 5: Apply Triage Gate ──
        triaged = apply_triage_gate(predictions)

        # ── Step 6: Extract result for the SPECIFIC requested ticker ──
        # Handle .TO suffix mismatch: try ticker, ticker.TO, and bare ticker
        ticker_candidates = [ticker, ticker + ".TO", ticker.replace(".TO", "")]
        ticker_result = pd.DataFrame()
        matched_ticker = ticker
        for candidate in ticker_candidates:
            match = triaged[triaged["ticker"] == candidate]
            if not match.empty:
                ticker_result = match
                matched_ticker = candidate
                break

        elapsed = round(time.time() - start_time, 2)

        if ticker_result.empty:
            logger.warning(
                f"[ML] ticker={ticker} NOT FOUND in triaged universe "
                f"(available: {triaged['ticker'].tolist()[:10]}...)"
            )
            result = {
                "status": "complete",
                "ticker": ticker,
                "probability": None,
                "triage_score": None,
                "trigger_llm": False,
                "elapsed_seconds": elapsed,
                "note": f"Ticker {ticker} not found in prediction universe",
            }
        else:
            row = ticker_result.iloc[0]
            prob = round(float(row["probability"]), 4)
            triage_val = round(float(row["triage_score"]), 4)
            llm_trigger = bool(row["trigger_llm"])

            # ── Kelly Criterion Position Sizing ──
            ticker_ohlcv = ohlcv_data.get(matched_ticker)
            kelly_w = compute_kelly_weight(prob, ticker_ohlcv)

            # ── LOGGING: Print distinct per-ticker values ──
            logger.info(
                f"[ML] RESULT ticker={matched_ticker} "
                f"prob={prob:.4f} triage={triage_val:.4f} "
                f"conviction={float(row['conviction']):.4f} "
                f"rc={float(row['ranked_conviction']):.2f} "
                f"rv={float(row['ranked_volume']):.2f} "
                f"kelly_weight={kelly_w:.4f} "
                f"anomaly={llm_trigger} universe={len(triaged)}"
            )

            status = "trigger_llm_debate" if llm_trigger else "complete"
            result = {
                "status": status,
                "ticker": matched_ticker,
                "probability": prob,
                "triage_score": triage_val,
                "conviction": round(float(row["conviction"]), 4),
                "ranked_conviction": round(float(row["ranked_conviction"]), 4),
                "ranked_volume": round(float(row["ranked_volume"]), 4),
                "trigger_llm": llm_trigger,
                "suggested_weight": round(kelly_w, 4),
                "elapsed_seconds": elapsed,
                "universe_size": len(triaged),
            }

        _update_job(job_id, result)
        return result

    except Exception as e:
        logger.error(f"[ML] ERROR for ticker={ticker}: {e}")
        error_result = {
            "status": "error",
            "ticker": ticker,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "elapsed_seconds": round(time.time() - start_time, 2),
        }
        _update_job(job_id, error_result)
        return error_result
