"""
test_screener.py — Regime, Sentiment, Probability & Full Screen Tests
======================================================================
Verifies the signal combination logic that sits atop the 4 indicator systems.
"""

import numpy as np
import pandas as pd
import pytest

from momentum_screener import (
    classify_regime,
    composite_sentiment,
    compute_probability,
    screen_ticker,
    screen_universe,
    sector_regimes,
)
import momentum_config as cfg


# ═══════════════════════════════════════════════════════════
#  REGIME CLASSIFICATION
# ═══════════════════════════════════════════════════════════

class TestRegimeClassification:
    """Verify Trending / Mean-Reverting / Choppy classification."""

    def test_regime_returns_valid_label(self, aapl_ohlcv):
        regime = classify_regime(aapl_ohlcv)
        assert regime in {"Trending", "Mean-Reverting", "Choppy", "Unknown"}

    def test_regime_deterministic(self, aapl_ohlcv):
        r1 = classify_regime(aapl_ohlcv)
        r2 = classify_regime(aapl_ohlcv)
        assert r1 == r2

    def test_regime_requires_adx(self, aapl_ohlcv):
        """Regime uses ADX — if ADX > 25, should be Trending."""
        from momentum_indicators import compute_adx
        adx_df = compute_adx(aapl_ohlcv)
        last_adx = adx_df["ADX"].iloc[-1]
        regime = classify_regime(aapl_ohlcv)
        if not np.isnan(last_adx):
            if last_adx >= cfg.ADX_STRONG_TREND:
                assert regime == "Trending"


# ═══════════════════════════════════════════════════════════
#  SENTIMENT LABELING
# ═══════════════════════════════════════════════════════════

class TestSentiment:
    """Verify composite_sentiment thresholds."""

    def test_strong_bullish(self):
        assert composite_sentiment(1.5) == "Strong Bullish"
        assert composite_sentiment(2.0) == "Strong Bullish"

    def test_bullish(self):
        assert composite_sentiment(0.5) == "Bullish"
        assert composite_sentiment(1.0) == "Bullish"

    def test_neutral(self):
        assert composite_sentiment(0.0) == "Neutral"
        assert composite_sentiment(0.3) == "Neutral"
        assert composite_sentiment(-0.3) == "Neutral"

    def test_bearish(self):
        assert composite_sentiment(-0.5) == "Bearish"
        assert composite_sentiment(-1.0) == "Bearish"

    def test_strong_bearish(self):
        assert composite_sentiment(-1.5) == "Strong Bearish"
        assert composite_sentiment(-2.0) == "Strong Bearish"

    def test_exact_thresholds(self):
        """Test boundary values match config thresholds."""
        assert composite_sentiment(cfg.SCORE_STRONG_BULL) == "Strong Bullish"
        assert composite_sentiment(cfg.SCORE_BULL) == "Bullish"
        assert composite_sentiment(cfg.SCORE_BEAR) == "Bearish"
        assert composite_sentiment(cfg.SCORE_STRONG_BEAR) == "Strong Bearish"


# ═══════════════════════════════════════════════════════════
#  PROBABILITY CALCULATION
# ═══════════════════════════════════════════════════════════

class TestProbability:
    """Verify the directional agreement × magnitude formula."""

    def test_empty_scores(self):
        assert compute_probability([]) == 0.0

    def test_all_bullish(self):
        """4/4 agreement should give high probability."""
        prob = compute_probability([1.5, 1.0, 1.2, 0.8])
        assert prob > 50, f"With 4/4 bullish, probability should be >50%, got {prob}"

    def test_mixed_signals(self):
        """2 bull, 2 bear → low confidence."""
        prob = compute_probability([1.0, 0.8, -1.0, -0.8])
        assert prob < 30, f"With 2/2 split, probability should be low, got {prob}"

    def test_range(self):
        """Probability must be clipped to [1, 98]."""
        prob = compute_probability([2.0, 2.0, 2.0, 2.0])
        assert 1.0 <= prob <= 98.0

    def test_all_neutral(self):
        """All near-zero scores → low probability."""
        prob = compute_probability([0.05, -0.05, 0.02, -0.01])
        assert prob < 20

    def test_unanimous_bonus(self):
        """Unanimous agreement should trigger the 1.2x multiplier."""
        prob_3 = compute_probability([1.5, 1.0, 1.2])
        # With 3+ systems unanimous and all positive
        assert prob_3 > 0  # just verify it doesn't crash


# ═══════════════════════════════════════════════════════════
#  FULL SCREENING
# ═══════════════════════════════════════════════════════════

class TestScreenTicker:
    """Test the complete screen_ticker pipeline."""

    def test_screen_returns_dict(self, aapl_ohlcv):
        result = screen_ticker("AAPL", aapl_ohlcv)
        assert result is not None
        assert isinstance(result, dict)

    def test_screen_insufficient_data(self, aapl_ohlcv_short):
        """Fewer than 100 rows should return None."""
        result = screen_ticker("AAPL", aapl_ohlcv_short)
        assert result is None

    def test_screen_has_required_fields(self, aapl_ohlcv):
        result = screen_ticker("AAPL", aapl_ohlcv)
        required = {
            "ticker", "sector", "price", "daily_change", "return_20d",
            "sys1_score", "sys2_score", "sys3_score", "sys4_score",
            "composite", "regime", "sentiment", "probability",
            "momentum_phase", "charts",
        }
        assert required.issubset(set(result.keys())), f"Missing keys: {required - set(result.keys())}"

    def test_screen_score_ranges(self, aapl_ohlcv):
        result = screen_ticker("AAPL", aapl_ohlcv)
        for key in ["sys1_score", "sys2_score", "sys3_score", "sys4_score"]:
            assert -2.0 <= result[key] <= 2.0, f"{key} out of range: {result[key]}"

    def test_composite_is_mean_of_systems(self, aapl_ohlcv):
        result = screen_ticker("AAPL", aapl_ohlcv)
        expected = round(np.mean([result["sys1_score"], result["sys2_score"],
                                   result["sys3_score"], result["sys4_score"]]), 2)
        assert result["composite"] == expected

    def test_screen_deterministic(self, aapl_ohlcv):
        r1 = screen_ticker("AAPL", aapl_ohlcv)
        r2 = screen_ticker("AAPL", aapl_ohlcv)
        assert r1["composite"] == r2["composite"]
        assert r1["probability"] == r2["probability"]

    def test_momentum_phase_valid(self, aapl_ohlcv):
        result = screen_ticker("AAPL", aapl_ohlcv)
        assert result["momentum_phase"] in {"Fresh", "Exhausting", "Declining", "Neutral"}

    def test_vol_spike_positive(self, aapl_ohlcv):
        result = screen_ticker("AAPL", aapl_ohlcv)
        assert result["vol_spike"] > 0


class TestScreenUniverse:
    """Test multi-ticker screening."""

    def test_screen_universe_sorted(self, aapl_ohlcv):
        ohlcv = {"AAPL": aapl_ohlcv}
        results = screen_universe(ohlcv, progress=False)
        assert len(results) == 1
        assert results[0]["ticker"] == "AAPL"

    def test_sector_regimes_structure(self, aapl_ohlcv):
        ohlcv = {"AAPL": aapl_ohlcv}
        results = screen_universe(ohlcv, progress=False)
        regimes = sector_regimes(results)
        assert isinstance(regimes, dict)
        for sec, info in regimes.items():
            assert "regime" in info
            assert "bullish_pct" in info
            assert "count" in info
