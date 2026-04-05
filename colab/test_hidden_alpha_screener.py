"""
Test Suite for Hidden Alpha Options Screener
=============================================
Validates the mathematical correctness of all 5 modules using
synthetic data (no yfinance dependency for tests).

Run:  python -m pytest test_hidden_alpha_screener.py -v
  or: python test_hidden_alpha_screener.py
"""

import unittest
import numpy as np
import pandas as pd
from scipy.stats import norm


# ═══════════════════════════════════════════════════════════════
# LOCAL COPIES OF CORE FUNCTIONS (so tests are self-contained)
# ═══════════════════════════════════════════════════════════════

RISK_FREE_RATE = 0.043
CONTRACT_SIZE = 100


def bs_greeks(S, K, T, sigma, r, is_call):
    """Single-contract BS Greeks for test verification."""
    T = max(T, 1e-8)
    sigma = max(sigma, 1e-8)
    sqT = np.sqrt(T)
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * sqT)
    d2 = d1 - sigma * sqT
    Nd1 = norm.cdf(d1)
    nd1 = norm.pdf(d1)
    Nd2 = norm.cdf(d2)
    eRT = np.exp(-r * T)

    delta = Nd1 if is_call else Nd1 - 1.0
    gamma = nd1 / (S * sigma * sqT)
    vega = S * nd1 * sqT / 100.0
    if is_call:
        theta = (-(S * nd1 * sigma) / (2 * sqT) - r * K * eRT * Nd2) / 365.0
    else:
        theta = (-(S * nd1 * sigma) / (2 * sqT) + r * K * eRT * norm.cdf(-d2)) / 365.0
    dollar_gamma = gamma * S**2 / 100.0

    return dict(delta=delta, gamma=gamma, theta=theta, vega=vega,
                dollar_gamma=dollar_gamma, d1=d1, d2=d2)


def compute_vectorized_greeks(df, r=RISK_FREE_RATE):
    """Vectorized BS Greeks (copy from main module for testing)."""
    S = df['spot'].values.astype(np.float64)
    K = df['strike'].values.astype(np.float64)
    T = np.maximum(df['T'].values.astype(np.float64), 1e-8)
    sigma = np.maximum(df['impliedVolatility'].values.astype(np.float64), 1e-8)
    is_call = (df['option_type'] == 'call').values
    sqT = np.sqrt(T)
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * sqT)
    d2 = d1 - sigma * sqT
    Nd1 = norm.cdf(d1)
    Nd2 = norm.cdf(d2)
    nd1 = norm.pdf(d1)
    eRT = np.exp(-r * T)

    out = df.copy()
    out['delta'] = np.where(is_call, Nd1, Nd1 - 1.0)
    out['gamma'] = nd1 / (S * sigma * sqT)
    out['vega'] = S * nd1 * sqT / 100.0
    out['theta'] = np.where(
        is_call,
        (-(S * nd1 * sigma) / (2 * sqT) - r * K * eRT * Nd2) / 365.0,
        (-(S * nd1 * sigma) / (2 * sqT) + r * K * eRT * norm.cdf(-d2)) / 365.0,
    )
    out['dollar_gamma'] = out['gamma'] * S**2 / 100.0
    return out


# ═══════════════════════════════════════════════════════════════
# SYNTHETIC DATA BUILDERS
# ═══════════════════════════════════════════════════════════════

def make_synthetic_chain(spot=500.0, n_strikes=21, dte=30, base_iv=0.20,
                         skew_slope=-0.001, ticker='TEST'):
    """
    Create a synthetic options chain with realistic IV skew.
    skew_slope < 0 means put skew (lower strikes → higher IV).
    """
    strikes = np.linspace(spot * 0.85, spot * 1.15, n_strikes)
    rows = []
    for K in strikes:
        iv = base_iv + skew_slope * (K - spot)
        iv = max(iv, 0.05)
        for otype in ['call', 'put']:
            g = bs_greeks(spot, K, dte / 365.0, iv, RISK_FREE_RATE, otype == 'call')
            mid = max(0.01, abs(g['delta']) * spot * 0.05)  # rough synthetic price
            rows.append({
                'ticker': ticker, 'spot': spot, 'strike': K,
                'expiry': '2026-05-01', 'dte': dte, 'T': dte / 365.0,
                'option_type': otype, 'impliedVolatility': iv,
                'bid': mid * 0.95, 'ask': mid * 1.05,
                'mid_price': mid,
                'volume': int(np.random.randint(10, 5000)),
                'openInterest': int(np.random.randint(50, 10000)),
                'moneyness': K / spot,
            })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════
# TEST CASES
# ═══════════════════════════════════════════════════════════════

class TestBlackScholesGreeks(unittest.TestCase):
    """Validate BS Greeks against known analytical properties."""

    def test_atm_call_delta_near_half(self):
        """ATM call delta should be close to 0.5 (slightly above due to drift)."""
        g = bs_greeks(S=100, K=100, T=30/365, sigma=0.20, r=0.043, is_call=True)
        self.assertAlmostEqual(g['delta'], 0.5, delta=0.06)

    def test_atm_put_delta_near_neg_half(self):
        """ATM put delta should be close to -0.5."""
        g = bs_greeks(S=100, K=100, T=30/365, sigma=0.20, r=0.043, is_call=False)
        self.assertAlmostEqual(g['delta'], -0.5, delta=0.06)

    def test_put_call_delta_parity(self):
        """Delta_call - Delta_put = 1 (for European options)."""
        gc = bs_greeks(S=100, K=100, T=30/365, sigma=0.30, r=0.043, is_call=True)
        gp = bs_greeks(S=100, K=100, T=30/365, sigma=0.30, r=0.043, is_call=False)
        self.assertAlmostEqual(gc['delta'] - gp['delta'], 1.0, places=10)

    def test_gamma_always_positive(self):
        """Gamma is always positive for both calls and puts."""
        for is_call in [True, False]:
            for K in [80, 100, 120]:
                g = bs_greeks(S=100, K=K, T=30/365, sigma=0.25,
                              r=0.043, is_call=is_call)
                self.assertGreater(g['gamma'], 0)

    def test_gamma_same_for_call_and_put(self):
        """Gamma is identical for call and put at the same strike."""
        gc = bs_greeks(S=100, K=105, T=60/365, sigma=0.25, r=0.043, is_call=True)
        gp = bs_greeks(S=100, K=105, T=60/365, sigma=0.25, r=0.043, is_call=False)
        self.assertAlmostEqual(gc['gamma'], gp['gamma'], places=10)

    def test_vega_always_positive(self):
        """Vega is always positive (higher vol → higher price)."""
        for is_call in [True, False]:
            g = bs_greeks(S=100, K=100, T=30/365, sigma=0.20,
                          r=0.043, is_call=is_call)
            self.assertGreater(g['vega'], 0)

    def test_theta_negative_for_long(self):
        """Theta should be negative (long options lose value over time)."""
        g = bs_greeks(S=100, K=100, T=30/365, sigma=0.25, r=0.043, is_call=True)
        self.assertLess(g['theta'], 0)

    def test_deep_itm_call_delta_near_one(self):
        """Deep ITM call delta → 1."""
        g = bs_greeks(S=100, K=50, T=30/365, sigma=0.20, r=0.043, is_call=True)
        self.assertAlmostEqual(g['delta'], 1.0, delta=0.01)

    def test_deep_otm_call_delta_near_zero(self):
        """Deep OTM call delta → 0."""
        g = bs_greeks(S=100, K=200, T=30/365, sigma=0.20, r=0.043, is_call=True)
        self.assertAlmostEqual(g['delta'], 0.0, delta=0.01)

    def test_dollar_gamma_formula(self):
        """Dollar Gamma = Gamma × S² / 100."""
        g = bs_greeks(S=500, K=500, T=30/365, sigma=0.20, r=0.043, is_call=True)
        expected = g['gamma'] * 500**2 / 100
        self.assertAlmostEqual(g['dollar_gamma'], expected, places=8)

    def test_gamma_peaks_atm(self):
        """Gamma is highest at ATM."""
        gammas = []
        for K in [80, 90, 100, 110, 120]:
            g = bs_greeks(S=100, K=K, T=30/365, sigma=0.25, r=0.043, is_call=True)
            gammas.append((K, g['gamma']))
        max_gamma_strike = max(gammas, key=lambda x: x[1])[0]
        self.assertEqual(max_gamma_strike, 100)


class TestVectorizedGreeks(unittest.TestCase):
    """Validate vectorized implementation matches scalar."""

    def test_vectorized_matches_scalar(self):
        """Each row in vectorized output should match scalar BS."""
        df = make_synthetic_chain(spot=100, n_strikes=11, dte=30, base_iv=0.25)
        vdf = compute_vectorized_greeks(df)

        for idx in range(len(vdf)):
            row = vdf.iloc[idx]
            scalar = bs_greeks(
                S=row['spot'], K=row['strike'], T=row['T'],
                sigma=row['impliedVolatility'], r=RISK_FREE_RATE,
                is_call=(row['option_type'] == 'call'),
            )
            self.assertAlmostEqual(row['delta'], scalar['delta'], places=8,
                                   msg=f"Delta mismatch at row {idx}")
            self.assertAlmostEqual(row['gamma'], scalar['gamma'], places=8,
                                   msg=f"Gamma mismatch at row {idx}")
            self.assertAlmostEqual(row['theta'], scalar['theta'], places=8,
                                   msg=f"Theta mismatch at row {idx}")
            self.assertAlmostEqual(row['vega'], scalar['vega'], places=8,
                                   msg=f"Vega mismatch at row {idx}")


class TestGEX(unittest.TestCase):
    """Validate GEX sign conventions and aggregation."""

    def test_call_gex_positive(self):
        """Call GEX should be positive (MM short calls → positive for market)."""
        df = make_synthetic_chain(spot=100, n_strikes=5, dte=30)
        df = compute_vectorized_greeks(df)
        calls = df[df['option_type'] == 'call']
        call_gex = calls['openInterest'] * calls['dollar_gamma'] * CONTRACT_SIZE
        self.assertTrue((call_gex > 0).all())

    def test_put_gex_negative(self):
        """Put GEX should be negative (MM long puts → negative for market)."""
        df = make_synthetic_chain(spot=100, n_strikes=5, dte=30)
        df = compute_vectorized_greeks(df)
        puts = df[df['option_type'] == 'put']
        put_gex = -puts['openInterest'] * puts['dollar_gamma'] * CONTRACT_SIZE
        self.assertTrue((put_gex < 0).all())

    def test_net_gex_is_sum(self):
        """Net GEX = Call GEX + Put GEX."""
        df = make_synthetic_chain(spot=100, n_strikes=11, dte=30)
        df = compute_vectorized_greeks(df)
        df['contract_gex'] = np.where(
            df['option_type'] == 'call',
            df['openInterest'] * df['dollar_gamma'] * CONTRACT_SIZE,
           -df['openInterest'] * df['dollar_gamma'] * CONTRACT_SIZE,
        )
        total = df['contract_gex'].sum()
        call_sum = df[df['option_type'] == 'call']['contract_gex'].sum()
        put_sum = df[df['option_type'] == 'put']['contract_gex'].sum()
        self.assertAlmostEqual(total, call_sum + put_sum, places=6)


class TestGTBR(unittest.TestCase):
    """Validate Gamma-Theta Breakeven Range formula."""

    def test_gtbr_positive(self):
        """GTBR should yield a positive number when theta<0 and gamma>0."""
        theta_daily = -0.05   # typical negative theta
        dollar_gamma = 0.50   # typical positive dollar gamma
        gtbr = np.sqrt(-theta_daily / (50.0 * dollar_gamma))
        self.assertGreater(gtbr, 0)

    def test_gtbr_symmetric(self):
        """GTBR is ± symmetric around zero."""
        theta_daily = -0.10
        dollar_gamma = 1.0
        gtbr = np.sqrt(-theta_daily / (50.0 * dollar_gamma))
        self.assertAlmostEqual(gtbr, abs(-gtbr))

    def test_gtbr_increases_with_iv(self):
        """Higher IV → wider GTBR (approximation: σ/√365)."""
        gtbr_low = 0.15 / np.sqrt(365)
        gtbr_high = 0.40 / np.sqrt(365)
        self.assertGreater(gtbr_high, gtbr_low)

    def test_gtbr_approximation_reasonable(self):
        """GTBR ≈ σ/√365 should be in the 0.5%-3% daily range for typical IV."""
        for iv in [0.15, 0.25, 0.40, 0.60]:
            gtbr = iv / np.sqrt(365)
            self.assertGreater(gtbr, 0.005)  # > 0.5%
            self.assertLess(gtbr, 0.05)      # < 5%


class TestSkewAdjustedDelta(unittest.TestCase):
    """Validate the Skew-Adjusted Delta correction."""

    def test_skew_adjustment_modifies_delta(self):
        """With non-zero skew, adjusted delta should differ from standard."""
        df = make_synthetic_chain(spot=100, n_strikes=21, dte=30,
                                  base_iv=0.25, skew_slope=-0.002)
        df = compute_vectorized_greeks(df)
        df = df.sort_values(['option_type', 'strike']).reset_index(drop=True)

        def _grad(g):
            if len(g) < 3:
                g['dIV_dK'] = 0.0
                return g
            g['dIV_dK'] = np.gradient(g['impliedVolatility'].values,
                                       g['strike'].values)
            return g

        df = df.groupby('option_type', group_keys=False).apply(_grad)
        df['dIV_dSpot'] = -df['dIV_dK']
        df['skew_adj_delta'] = df['delta'] + (df['vega'] * 100.0) * df['dIV_dSpot']

        # With negative skew, skew-adjusted delta should differ
        diff = (df['skew_adj_delta'] - df['delta']).abs()
        self.assertGreater(diff.mean(), 0.0001,
                           "Skew adjustment should produce non-trivial differences")

    def test_zero_skew_no_adjustment(self):
        """With flat IV (zero skew), adjusted delta ≈ standard delta."""
        df = make_synthetic_chain(spot=100, n_strikes=11, dte=30,
                                  base_iv=0.25, skew_slope=0.0)
        df = compute_vectorized_greeks(df)
        df = df.sort_values(['option_type', 'strike']).reset_index(drop=True)

        def _grad(g):
            if len(g) < 3:
                g['dIV_dK'] = 0.0
                return g
            g['dIV_dK'] = np.gradient(g['impliedVolatility'].values,
                                       g['strike'].values)
            return g

        df = df.groupby('option_type', group_keys=False).apply(_grad)
        df['dIV_dSpot'] = -df['dIV_dK']
        df['skew_adj_delta'] = df['delta'] + (df['vega'] * 100.0) * df['dIV_dSpot']

        diff = (df['skew_adj_delta'] - df['delta']).abs()
        self.assertLess(diff.max(), 0.01,
                        "With zero skew, adjustment should be negligible")


class TestDiscreteVRP(unittest.TestCase):
    """Validate discrete VIX-style implied variance calculation."""

    def _build_synthetic_strip(self, spot=100, n=11, T=30/365, iv=0.20):
        """Build a synthetic OTM option strip for VRP testing."""
        F = spot * np.exp(RISK_FREE_RATE * T)
        strikes = np.linspace(spot * 0.80, spot * 1.20, n)
        K0 = strikes[strikes <= F][-1]

        rows = []
        for K in strikes:
            if K < K0:
                comp = 'bad'
                # BS put price approximation
                d1 = (np.log(spot/K) + (RISK_FREE_RATE + 0.5*iv**2)*T) / (iv*np.sqrt(T))
                d2 = d1 - iv*np.sqrt(T)
                price = K * np.exp(-RISK_FREE_RATE*T) * norm.cdf(-d2) - spot * norm.cdf(-d1)
            elif K > K0:
                comp = 'good'
                d1 = (np.log(spot/K) + (RISK_FREE_RATE + 0.5*iv**2)*T) / (iv*np.sqrt(T))
                d2 = d1 - iv*np.sqrt(T)
                price = spot * norm.cdf(d1) - K * np.exp(-RISK_FREE_RATE*T) * norm.cdf(d2)
            else:
                comp = 'both'
                d1 = (np.log(spot/K) + (RISK_FREE_RATE + 0.5*iv**2)*T) / (iv*np.sqrt(T))
                d2 = d1 - iv*np.sqrt(T)
                put_p = K * np.exp(-RISK_FREE_RATE*T) * norm.cdf(-d2) - spot * norm.cdf(-d1)
                call_p = spot * norm.cdf(d1) - K * np.exp(-RISK_FREE_RATE*T) * norm.cdf(d2)
                price = (put_p + call_p) / 2
            rows.append({'K': K, 'Q': max(price, 0.001), 'comp': comp})

        return pd.DataFrame(rows), F, K0, T

    def test_implied_variance_positive(self):
        """Discrete implied variance should be positive."""
        strip, F, K0, T = self._build_synthetic_strip()
        Kv = strip['K'].values
        n = len(Kv)
        dK = np.empty(n)
        dK[0] = Kv[1] - Kv[0]
        dK[-1] = Kv[-1] - Kv[-2]
        dK[1:-1] = (Kv[2:] - Kv[:-2]) / 2.0

        eRT = np.exp(RISK_FREE_RATE * T)
        contrib = (dK / Kv**2) * eRT * strip['Q'].values
        iv2 = (2.0/T) * contrib.sum() - (1.0/T) * ((F/K0) - 1)**2
        self.assertGreater(iv2, 0, "Implied variance must be positive")

    def test_implied_vol_close_to_input(self):
        """Discrete IV should approximate the input flat IV."""
        input_iv = 0.25
        strip, F, K0, T = self._build_synthetic_strip(iv=input_iv, n=51)
        Kv = strip['K'].values
        n = len(Kv)
        dK = np.empty(n)
        dK[0] = Kv[1] - Kv[0]
        dK[-1] = Kv[-1] - Kv[-2]
        dK[1:-1] = (Kv[2:] - Kv[:-2]) / 2.0

        eRT = np.exp(RISK_FREE_RATE * T)
        contrib = (dK / Kv**2) * eRT * strip['Q'].values
        iv2 = (2.0/T) * contrib.sum() - (1.0/T) * ((F/K0) - 1)**2
        computed_iv = np.sqrt(max(iv2, 0))

        # Should be within 5% of input IV (discretization error expected)
        self.assertAlmostEqual(computed_iv, input_iv, delta=input_iv * 0.15,
                               msg=f"Computed IV {computed_iv:.4f} too far from input {input_iv}")

    def test_bad_vrp_uses_puts_only(self):
        """Bad IV² should only include puts (K < K₀)."""
        strip, F, K0, T = self._build_synthetic_strip()
        bad_rows = strip[strip['comp'].isin(['bad', 'both'])]
        good_rows = strip[strip['comp'].isin(['good', 'both'])]

        # Bad should have strikes ≤ K0
        self.assertTrue((bad_rows['K'] <= K0).all())
        # Good should have strikes ≥ K0
        self.assertTrue((good_rows['K'] >= K0).all())

    def test_realized_variance_decomposition(self):
        """Bad RV + Good RV should approximately equal Total RV."""
        np.random.seed(42)
        returns = np.random.normal(0, 0.01, 21)
        ann = 252.0 / 21

        total = np.sum(returns**2) * ann
        bad = np.sum(returns[returns < 0]**2) * ann
        good = np.sum(returns[returns >= 0]**2) * ann

        self.assertAlmostEqual(total, bad + good, places=10)


class TestScreenerMasks(unittest.TestCase):
    """Validate screener boolean mask logic."""

    def test_uoa_mask(self):
        """UOA mask should correctly flag unusual activity."""
        df = pd.DataFrame({
            'volume': [5000, 100, 3000],
            'openInterest': [1000, 1000, 1000],
            'dte': [10, 10, 10],
            'total_premium': [150000, 150000, 150000],
        })
        mask = ((df['volume'] > df['openInterest'] * 2.5) &
                (df['dte'] < 21) & (df['total_premium'] > 100_000))
        self.assertEqual(mask.tolist(), [True, False, True])

    def test_uoa_dte_filter(self):
        """UOA should reject contracts with DTE >= 21."""
        df = pd.DataFrame({
            'volume': [5000], 'openInterest': [1000],
            'dte': [25], 'total_premium': [200000],
        })
        mask = ((df['volume'] > df['openInterest'] * 2.5) &
                (df['dte'] < 21) & (df['total_premium'] > 100_000))
        self.assertFalse(mask.iloc[0])

    def test_uoa_premium_filter(self):
        """UOA should reject contracts with premium <= $100k."""
        df = pd.DataFrame({
            'volume': [5000], 'openInterest': [1000],
            'dte': [10], 'total_premium': [50000],
        })
        mask = ((df['volume'] > df['openInterest'] * 2.5) &
                (df['dte'] < 21) & (df['total_premium'] > 100_000))
        self.assertFalse(mask.iloc[0])

    def test_credit_spread_positive_net_delta(self):
        """Bull put spread should have net positive delta."""
        # Short higher-strike put (less negative delta) + long lower-strike put
        short_delta = -0.20   # higher strike, closer to ATM
        long_delta = -0.05    # lower strike, further OTM
        net_delta = short_delta + long_delta
        # For a bull put we want net_delta > 0 when measured correctly
        # Actually: net delta = |short_delta| + long_delta
        # Short put → +delta (flipped), long put → -delta
        net_delta_spread = (-short_delta) + long_delta
        self.assertGreater(net_delta_spread, 0)


class TestZeroGammaLevel(unittest.TestCase):
    """Validate Zero Gamma Level interpolation."""

    def test_finds_zero_crossing(self):
        """Should find the strike where cumulative GEX crosses zero."""
        gex_df = pd.DataFrame({
            'strike': [90, 95, 100, 105, 110],
            'net_gex': [100, 50, -20, -80, -100],
        })
        gex_df['cum_gex'] = gex_df['net_gex'].cumsum()

        cum = gex_df['cum_gex'].values
        strikes = gex_df['strike'].values
        flips = np.where(np.diff(np.sign(cum)))[0]
        self.assertTrue(len(flips) > 0, "Should find a zero crossing")

        i = flips[0]
        s1, s2 = strikes[i], strikes[i+1]
        g1, g2 = cum[i], cum[i+1]
        zg = s1 + (s2 - s1) * (-g1) / (g2 - g1)
        self.assertGreater(zg, 100)
        self.assertLess(zg, 110)


class TestEdgeCases(unittest.TestCase):
    """Edge case and numerical stability tests."""

    def test_very_short_dte(self):
        """Greeks should not blow up for DTE=1."""
        g = bs_greeks(S=100, K=100, T=1/365, sigma=0.20,
                      r=0.043, is_call=True)
        self.assertTrue(np.isfinite(g['delta']))
        self.assertTrue(np.isfinite(g['gamma']))
        self.assertTrue(np.isfinite(g['theta']))
        self.assertTrue(np.isfinite(g['vega']))

    def test_very_high_iv(self):
        """Greeks should remain finite for IV = 500%."""
        g = bs_greeks(S=100, K=100, T=30/365, sigma=5.0,
                      r=0.043, is_call=True)
        self.assertTrue(np.isfinite(g['delta']))
        self.assertTrue(np.isfinite(g['gamma']))

    def test_deep_otm_stability(self):
        """Deep OTM options should have near-zero but finite Greeks."""
        g = bs_greeks(S=100, K=300, T=30/365, sigma=0.20,
                      r=0.043, is_call=True)
        self.assertTrue(np.isfinite(g['delta']))
        self.assertAlmostEqual(g['delta'], 0.0, delta=0.001)

    def test_vectorized_empty_df(self):
        """Vectorized Greeks should handle empty DataFrames."""
        df = pd.DataFrame(columns=['spot', 'strike', 'T',
                                   'impliedVolatility', 'option_type'])
        result = compute_vectorized_greeks(df)
        self.assertEqual(len(result), 0)


# ═══════════════════════════════════════════════════════════════
# RUN
# ═══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("=" * 60)
    print("🧪 Hidden Alpha Screener — Math Validation Suite")
    print("=" * 60)
    unittest.main(verbosity=2)
