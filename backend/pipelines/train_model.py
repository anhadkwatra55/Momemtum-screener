#!/usr/bin/env python3
"""
train_model.py — XGBoost Training with Purged K-Fold Cross-Validation
========================================================================
Phase 3 of the predictive engine build.

Trains an XGBRegressor to predict forward 20-day normalized returns
(fwd_ret_20d_gauss) from stationary features engineered in Phase 2.

Critical innovation: PurgedKFold cross-validation that mathematically
prevents data leakage from overlapping 20-day label windows and serial
autocorrelation — standard sklearn CV would be catastrophically biased.

Input:   features_latest.parquet  (from features.py — Phase 2)
Output:  Per-fold OOS metrics, averaged metrics, feature importance

Dependencies: pandas, numpy, xgboost, scipy
Run:  python3 train_model.py
"""

from __future__ import annotations

import warnings
from pathlib import Path
from typing import Generator, List, Tuple

import numpy as np
import pandas as pd
from scipy.stats import pearsonr

warnings.filterwarnings("ignore")

# ── Preload libomp for XGBoost on macOS ──
import ctypes, os as _os
_libomp = _os.path.join(_os.path.dirname(__file__), "..", "libomp_tmp", "lib", "libomp.dylib")
if _os.path.exists(_libomp):
    try:
        ctypes.cdll.LoadLibrary(_libomp)
    except OSError:
        pass

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  CONSTANTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Path to the feature store (output from Phase 2)
FEATURES_PATH = Path(__file__).parent / "features_latest.parquet"

# Path to save the trained model artifact (loaded by worker.py for inference)
MODEL_PATH = Path(__file__).parent / "xgb_model.json"

# Feature columns (model inputs — safe, no leakage)
FEATURE_COLS = [
    "close_ffd",
    "close_zscore_21",
    "close_zscore_63",
    "volume_zscore_21",
    "volume_zscore_63",
    "score_gauss_rank",
]

# Target column (model output — forward 20-day Gaussian-rank return)
TARGET_COL = "fwd_ret_20d_gauss"

# Purged K-Fold parameters
N_SPLITS = 5
LABEL_SPAN = 20      # forward return horizon in trading days
EMBARGO_DAYS = 5     # serial correlation buffer in trading days

# XGBoost hyperparameters (conservative for Phase 3 baseline)
XGB_PARAMS = {
    "n_estimators": 200,
    "max_depth": 4,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.1,       # L1 regularisation
    "reg_lambda": 1.0,      # L2 regularisation
    "random_state": 42,
    "n_jobs": -1,
    "verbosity": 0,
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PURGED K-FOLD CROSS-VALIDATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class PurgedKFold:
    """
    Purged K-Fold Cross-Validator for time-series panel data.

    Standard sklearn KFold and TimeSeriesSplit do NOT account for
    overlapping label windows. When our target is a 20-day forward
    return, a test observation at time t has a label spanning
    [t, t+20]. If a training observation at time t' also spans
    [t', t'+20] and these windows overlap, the model can "see"
    part of the test label through the training data → severe leakage.

    This class enforces two mathematical safeguards:

    1. PURGING — Remove any training row whose label window overlaps
       with ANY test row's label window.

       The Three Overlap Conditions (from the research paper):
       ───────────────────────────────────────────────────────
       Given test label Y_j spanning [t_j0, t_j1] and training
       label Y_i spanning [t_i0, t_i1], PURGE Y_i if ANY of:

         Condition A:  t_j0 ≤ t_i0 ≤ t_j1
           → training label STARTS inside the test label window

         Condition B:  t_j0 ≤ t_i1 ≤ t_j1
           → training label ENDS inside the test label window

         Condition C:  t_i0 ≤ t_j0 ≤ t_j1 ≤ t_i1
           → training label fully CONTAINS the test label window

    2. EMBARGOING — Remove training rows immediately AFTER the test
       set to prevent the model from deducing test-set price action
       from autocorrelated features.

       The Embargo Condition:
       ──────────────────────
         PURGE Y_i if:  t_j1 ≤ t_i0 ≤ t_j1 + h

         where h = embargo period (5 trading days)

    Fold Construction:
    ──────────────────
       Folds are STRICTLY CHRONOLOGICAL sequential blocks of time.
       E.g. for 5 folds over 200 unique dates:
         Fold 1: dates 1–40   (first 20% of timeline)
         Fold 2: dates 41–80  (next 20%)
         Fold 3: dates 81–120
         Fold 4: dates 121–160
         Fold 5: dates 161–200 (last 20%)
       NO SHUFFLING is applied — the time-series structure is preserved.

    Parameters
    ----------
    n_splits : int
        Number of chronological folds (default: 5).
    label_span : int
        Number of business days the target label spans forward
        from the observation date (default: 20).
    embargo_days : int
        Number of business days to embargo after the test set
        to block serial correlation leakage (default: 5).
    """

    def __init__(
        self,
        n_splits: int = N_SPLITS,
        label_span: int = LABEL_SPAN,
        embargo_days: int = EMBARGO_DAYS,
    ):
        self.n_splits = n_splits
        self.label_span = label_span
        self.embargo_days = embargo_days

    def split(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        dates: pd.DatetimeIndex,
    ) -> Generator[Tuple[np.ndarray, np.ndarray], None, None]:
        """
        Generate purged train/test index pairs for each fold.

        Parameters
        ----------
        X : pd.DataFrame
            Feature matrix (used only for its index/shape).
        y : pd.Series
            Target variable (used only for its index/shape).
        dates : pd.DatetimeIndex
            The observation date for each row (t_0 of each label).
            This is the 'date' level of the MultiIndex.

        Yields
        ------
        (train_indices, test_indices) : tuple of np.ndarray
            Integer position indices into X/y for training and testing.
            Training indices have been purged and embargoed.
        """
        # ── Step 1: Get sorted unique dates for chronological splitting ──
        # We split on UNIQUE DATES (not rows) to ensure each fold
        # covers a contiguous time block, even with panel data
        # (multiple tickers per date).
        unique_dates = np.sort(dates.unique())
        n_dates = len(unique_dates)

        # ── Step 2: Divide unique dates into n_splits sequential blocks ──
        # np.array_split handles uneven division gracefully
        # (some folds may have 1 extra date).
        # CRITICAL: No shuffling — folds are strictly chronological.
        date_folds = np.array_split(unique_dates, self.n_splits)

        # ── Precompute t_i0 (observation date) and t_i1 (label end) ──
        # for ALL rows in the dataset. t_i1 = t_i0 + label_span BDays.
        #
        # t_i0: the date the observation was recorded
        # t_i1: the date the forward return label ENDS
        #       (20 business days after t_i0)
        all_t0 = dates.values                                   # shape: (N,)
        bday_offset = pd.tseries.offsets.BDay(self.label_span)
        all_t1 = pd.DatetimeIndex(all_t0) + bday_offset         # shape: (N,)
        all_t1 = all_t1.values

        embargo_offset = pd.tseries.offsets.BDay(self.embargo_days)

        for fold_idx, test_dates in enumerate(date_folds):
            # ── Step 3: Identify test and initial train rows ──
            # Test set = all rows whose date falls in this fold's date block.
            # Initial train set = everything else (before purging).
            test_date_set = set(test_dates)
            test_mask = np.array([d in test_date_set for d in dates.values])
            test_indices = np.where(test_mask)[0]
            train_mask_initial = ~test_mask

            # ── Step 4: Compute test set's date boundaries ──
            # t_j0_min: earliest observation date in the test set
            # t_j1_max: latest label-end date in the test set
            # These define the "danger zone" for purging + embargoing.
            test_t0 = all_t0[test_indices]
            test_t1 = all_t1[test_indices]

            # Convert to pandas Timestamps for BDay arithmetic,
            # then back to numpy datetime64 for vectorised comparisons
            t_j0_min = pd.Timestamp(test_t0.min())
            t_j1_max = pd.Timestamp(test_t1.max())

            # Pre-compute embargo boundary:
            # t_j1_max + h  (any training row starting between
            # t_j1_max and t_j1_max + h must be embargoed)
            embargo_end = t_j1_max + embargo_offset

            # Convert all boundaries to numpy datetime64 for vectorised ops
            t_j0_min_np = np.datetime64(t_j0_min)
            t_j1_max_np = np.datetime64(t_j1_max)
            embargo_end_np = np.datetime64(embargo_end)

            # ── Step 5: PURGING — Remove overlapping training rows ──
            #
            # For each candidate training row i, check if its label
            # window [t_i0, t_i1] overlaps with ANY test label window.
            #
            # Rather than checking every (train, test) pair — which is
            # O(N_train × N_test) — we use the conservative envelope:
            # the test set spans [t_j0_min, t_j1_max]. Any training
            # label that overlaps with this envelope is purged.
            #
            # This is slightly more aggressive than per-row checking
            # (may purge a few extra rows) but is mathematically safe
            # and computationally efficient: O(N_train).
            #
            # The three overlap conditions applied to the envelope:
            #
            #   Condition A: t_j0_min ≤ t_i0 ≤ t_j1_max
            #     Training label STARTS inside the test envelope.
            #     → purge_a[i] = (t_i0 >= t_j0_min) AND (t_i0 <= t_j1_max)
            #
            #   Condition B: t_j0_min ≤ t_i1 ≤ t_j1_max
            #     Training label ENDS inside the test envelope.
            #     → purge_b[i] = (t_i1 >= t_j0_min) AND (t_i1 <= t_j1_max)
            #
            #   Condition C: t_i0 ≤ t_j0_min AND t_j1_max ≤ t_i1
            #     Training label fully CONTAINS the test envelope.
            #     → purge_c[i] = (t_i0 <= t_j0_min) AND (t_i1 >= t_j1_max)

            purge_a = (all_t0 >= t_j0_min_np) & (all_t0 <= t_j1_max_np)
            purge_b = (all_t1 >= t_j0_min_np) & (all_t1 <= t_j1_max_np)
            purge_c = (all_t0 <= t_j0_min_np) & (all_t1 >= t_j1_max_np)

            purge_mask = purge_a | purge_b | purge_c

            # ── Step 6: EMBARGOING — Remove post-test serial correlation ──
            #
            # Embargo condition: t_j1_max ≤ t_i0 ≤ t_j1_max + h
            #
            # Training rows whose observation date falls in the embargo
            # window immediately AFTER the test set are removed.
            # This prevents the model from learning autocorrelated features
            # that encode the test set's recent price action.
            embargo_mask = (all_t0 >= t_j1_max_np) & (all_t0 <= embargo_end_np)

            # ── Step 7: Combine all exclusion masks ──
            # Final train set = initial train minus purged minus embargoed
            exclusion_mask = purge_mask | embargo_mask
            final_train_mask = train_mask_initial & ~exclusion_mask
            train_indices = np.where(final_train_mask)[0]

            # ── Diagnostics ──
            n_purged = int(train_mask_initial.sum() - final_train_mask.sum())
            print(f"    Fold {fold_idx + 1}/{self.n_splits}: "
                  f"test={len(test_indices):>4d}  "
                  f"train={len(train_indices):>4d}  "
                  f"purged={n_purged:>3d}  "
                  f"test_dates=[{pd.Timestamp(t_j0_min).strftime('%Y-%m-%d')} → "
                  f"{pd.Timestamp(t_j1_max).strftime('%Y-%m-%d')}]")

            yield train_indices, test_indices

    def get_n_splits(self) -> int:
        return self.n_splits


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  XGBOOST CROSS-VALIDATED TRAINING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def cross_validate_purged(
    X: pd.DataFrame,
    y: pd.Series,
    dates: pd.DatetimeIndex,
    cv: PurgedKFold,
    xgb_params: dict = XGB_PARAMS,
) -> Tuple[List[dict], pd.Series]:
    """
    Train XGBRegressor across purged K-fold splits.

    For each fold:
        1. Split data using PurgedKFold (train = purged, test = held-out)
        2. Fit XGBRegressor on training set
        3. Predict on test set
        4. Compute OOS metrics: RMSE, Pearson correlation

    Parameters
    ----------
    X : pd.DataFrame
        Feature matrix (N × F).
    y : pd.Series
        Target variable (N,).
    dates : pd.DatetimeIndex
        Observation dates for each row.
    cv : PurgedKFold
        Custom cross-validation splitter.
    xgb_params : dict
        XGBoost hyperparameters.

    Returns
    -------
    (fold_metrics, oos_predictions) : tuple
        fold_metrics: list of dicts with per-fold RMSE, Pearson r, p-value
        oos_predictions: pd.Series with out-of-sample predictions for all rows
    """
    import xgboost as xgb

    fold_metrics: List[dict] = []
    oos_preds = pd.Series(np.nan, index=y.index, dtype=float)

    print("\n  ── Purged K-Fold Cross-Validation ──")
    print(f"    Splits: {cv.n_splits} | Label span: {cv.label_span}d | "
          f"Embargo: {cv.embargo_days}d\n")

    for fold_idx, (train_idx, test_idx) in enumerate(cv.split(X, y, dates)):
        # ── Extract train/test sets ──
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

        # ── Train XGBRegressor ──
        model = xgb.XGBRegressor(**xgb_params)
        model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=False,
        )

        # ── Predict on test set ──
        y_pred = model.predict(X_test)
        oos_preds.iloc[test_idx] = y_pred

        # ── Compute OOS Metrics ──
        # RMSE: Root Mean Squared Error
        rmse = float(np.sqrt(np.mean((y_pred - y_test.values) ** 2)))

        # Pearson correlation: linear relationship between predicted and actual
        # High r → model captures return ranking; low r → noise.
        corr, p_value = pearsonr(y_pred, y_test.values)

        fold_metrics.append({
            "fold": fold_idx + 1,
            "train_size": len(train_idx),
            "test_size": len(test_idx),
            "rmse": round(rmse, 6),
            "pearson_r": round(corr, 4),
            "p_value": round(p_value, 6),
        })

    return fold_metrics, oos_preds


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  FEATURE IMPORTANCE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def train_final_model(
    X: pd.DataFrame,
    y: pd.Series,
    xgb_params: dict = XGB_PARAMS,
    save_path: Path = MODEL_PATH,
) -> Tuple[pd.DataFrame, Any]:
    """
    Train a final XGBRegressor on the FULL dataset, save the model
    artifact to disk, and extract feature importance.

    The saved model (xgb_model.json) is loaded by worker.py for
    fast inference — no retraining needed in the Celery worker.

    Parameters
    ----------
    X : pd.DataFrame
        Full feature matrix.
    y : pd.Series
        Full target variable.
    xgb_params : dict
        XGBoost hyperparameters.
    save_path : Path
        Where to save the model artifact.

    Returns
    -------
    (importance_df, model) : tuple
        importance_df: feature importance table sorted by importance desc
        model: the fitted XGBRegressor instance
    """
    import xgboost as xgb

    model = xgb.XGBRegressor(**xgb_params)
    model.fit(X, y, verbose=False)

    # ── Save model artifact to disk ──
    # XGBoost's native .save_model() produces a compact JSON file
    # that can be loaded instantly by the Celery worker.
    model.save_model(str(save_path))
    file_size = save_path.stat().st_size
    print(f"  ✓ Model saved: {save_path.name} ({file_size:,} bytes)")

    # ── Extract gain-based feature importance ──
    # 'gain' = average improvement in loss (MSE) that each feature
    # provides when it is used in a split. Higher = more predictive.
    importance = model.feature_importances_

    importance_df = pd.DataFrame({
        "feature": X.columns,
        "importance": importance,
        "importance_pct": (100.0 * importance / importance.sum()).round(2),
    }).sort_values("importance", ascending=False).reset_index(drop=True)

    return importance_df, model


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MAIN — Run the Training Pipeline
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == "__main__":
    print("=" * 70)
    print("  XGBOOST TRAINING — Purged K-Fold Cross-Validation")
    print("  Target: fwd_ret_20d_gauss (forward 20-day Gaussian return)")
    print("  CV: 5-fold chronological, purge + 5-day embargo")
    print("=" * 70)

    # ────────────────────────────────────────────
    #  Step 1: Load feature store
    # ────────────────────────────────────────────
    print("\n[1/4] Loading features …")
    if not FEATURES_PATH.exists():
        print(f"  ❌ {FEATURES_PATH.name} not found. Run features.py first.")
        raise SystemExit(1)

    df = pd.read_parquet(FEATURES_PATH)
    print(f"  ✓ Loaded {df.shape[0]:,} rows × {df.shape[1]} columns")
    print(f"  Index levels: {df.index.names}")
    print(f"  Date range: {df.index.get_level_values('date').min().strftime('%Y-%m-%d')} → "
          f"{df.index.get_level_values('date').max().strftime('%Y-%m-%d')}")
    print(f"  Tickers: {df.index.get_level_values('ticker').unique().tolist()}")

    # ── Separate features (X) and target (y) ──
    X = df[FEATURE_COLS]
    y = df[TARGET_COL]
    dates = df.index.get_level_values("date")

    print(f"\n  Features (X): {X.shape}")
    print(f"  Target   (y): {y.shape}")
    print(f"  Feature cols: {FEATURE_COLS}")

    # ────────────────────────────────────────────
    #  Step 2: Purged K-Fold Cross-Validation
    # ────────────────────────────────────────────
    print(f"\n[2/4] Running Purged K-Fold CV (n_splits={N_SPLITS}, "
          f"label_span={LABEL_SPAN}, embargo={EMBARGO_DAYS}) …")

    cv = PurgedKFold(
        n_splits=N_SPLITS,
        label_span=LABEL_SPAN,
        embargo_days=EMBARGO_DAYS,
    )

    fold_metrics, oos_preds = cross_validate_purged(X, y, dates, cv)

    # ────────────────────────────────────────────
    #  Step 3: Print Per-Fold and Averaged Metrics
    # ────────────────────────────────────────────
    print(f"\n[3/4] Cross-Validation Results …")
    print("\n" + "─" * 70)
    print("  PER-FOLD OUT-OF-SAMPLE METRICS")
    print("─" * 70)

    metrics_df = pd.DataFrame(fold_metrics)
    print(metrics_df.to_string(index=False))

    # ── Averaged metrics ──
    avg_rmse = metrics_df["rmse"].mean()
    avg_corr = metrics_df["pearson_r"].mean()
    std_rmse = metrics_df["rmse"].std()
    std_corr = metrics_df["pearson_r"].std()

    print("\n" + "─" * 70)
    print("  AVERAGED ACROSS FOLDS")
    print("─" * 70)
    print(f"  Mean OOS RMSE:       {avg_rmse:.6f}  (±{std_rmse:.6f})")
    print(f"  Mean Pearson r:      {avg_corr:.4f}  (±{std_corr:.4f})")

    # ── Interpretation guide ──
    print("\n  Interpretation:")
    if avg_corr > 0.10:
        print(f"    Pearson r = {avg_corr:.4f} → Moderate signal detected.")
    elif avg_corr > 0.03:
        print(f"    Pearson r = {avg_corr:.4f} → Weak signal (expected for mock data).")
    else:
        print(f"    Pearson r = {avg_corr:.4f} → No meaningful signal (expected for mock data).")
    print(f"    (On real data with genuine alpha, expect r ≈ 0.05–0.15)")

    # ────────────────────────────────────────────
    #  Step 4: Feature Importance (Full-data model)
    # ────────────────────────────────────────────
    print(f"\n[4/4] Training final model on full dataset for feature importance …")

    importance_df, final_model = train_final_model(X, y)

    print("\n" + "─" * 70)
    print("  FEATURE IMPORTANCE (gain-based)")
    print("─" * 70)
    print(importance_df.to_string(index=False))

    # ── Sanity checks ──
    print("\n" + "─" * 70)
    print("  SANITY CHECKS")
    print("─" * 70)

    # Check that purging actually removed rows
    total_train = sum(m["train_size"] for m in fold_metrics)
    total_possible = len(X) * (N_SPLITS - 1)  # max train rows if no purging
    purge_pct = 100.0 * (1 - total_train / total_possible)
    print(f"  Total training rows used:  {total_train:,}")
    print(f"  Max possible (no purge):   {total_possible:,}")
    print(f"  Purge + embargo reduction: {purge_pct:.1f}%")

    # Check OOS predictions coverage
    n_predicted = oos_preds.notna().sum()
    print(f"  OOS predictions:           {n_predicted}/{len(y)} rows covered")

    print(f"\n  ✓ All {N_SPLITS} folds completed successfully.")

    # Verify model artifact roundtrip
    import xgboost as xgb
    test_model = xgb.XGBRegressor()
    test_model.load_model(str(MODEL_PATH))
    test_pred = test_model.predict(X.iloc[:5])
    print(f"  ✓ Model roundtrip verified (5 predictions: {test_pred.round(4)})")

    print("\n" + "=" * 70)
    print("  ✓ XGBoost training pipeline complete.")
    print(f"  ✓ Model artifact: {MODEL_PATH.name}")
    print("=" * 70)
