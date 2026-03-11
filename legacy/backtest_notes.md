# Backtest Validation & Statistical Methodology

## 1. Information Ratio vs Simple Return — Mathematical Significance

### Simple Return

$$R = \frac{P_T - P_0}{P_0}$$

Tells you **how much** money was made. A 40% return sounds impressive—until you learn it came with 80% drawdowns and a standard deviation of 60%.

### Information Ratio (IR)

$$IR = \frac{\bar{r}_p - \bar{r}_b}{\sigma(r_p - r_b)} \cdot \sqrt{252}$$

where:
- $\bar{r}_p - \bar{r}_b$ = mean daily excess return (alpha)
- $\sigma(r_p - r_b)$ = tracking error (active risk)

**Why IR is superior:**

| Metric | Strategy A | Strategy B |
|--------|-----------|-----------|
| Return | 20% | 10% |
| Tracking Error | 40% | 5% |
| **IR** | **0.50** | **2.00** |

Strategy B is vastly superior. It generates alpha with **precision** — more *skill*, less *luck*. Renaissance reportedly requires IR > 2.0 at the signal level before allocating capital.

**Key insight:** IR is scale-invariant. A signal with IR = 2.0 can be leveraged to any desired return level while maintaining the same risk-adjusted quality. Simple return cannot tell you this.

---

## 2. Multiple Testing Correction — The False Discovery Problem

### The Problem

> "If you test 1,000 tickers at α = 0.05, approximately 50 will show
> |Z| > 2.0 by pure chance (Type I Error)."

This is the exact mechanism behind most "backtested alpha" that fails in production. With enough tickers and enough parameters, you *will* find patterns — but they are noise.

### Benjamini-Hochberg (BH) Procedure (recommended)

Controls the **False Discovery Rate (FDR)** — the expected proportion of false positives among all discoveries.

**Algorithm:**
1. Compute p-values for all N tickers (e.g., from the ADF test or from the Z-Score).
2. Sort p-values in ascending order: $p_{(1)} \le p_{(2)} \le \ldots \le p_{(N)}$.
3. Find the largest $k$ such that $p_{(k)} \le \frac{k}{N} \cdot q$, where $q$ is the target FDR (e.g., 0.05).
4. Reject all hypotheses $H_{(1)}, \ldots, H_{(k)}$.

```python
from scipy.stats import false_discovery_control  # scipy ≥ 1.11

p_values = [...]  # one p-value per ticker
rejected = false_discovery_control(p_values, method='bh')
# Or manually:
import numpy as np

def benjamini_hochberg(p_values, q=0.05):
    n = len(p_values)
    sorted_idx = np.argsort(p_values)
    sorted_p = np.array(p_values)[sorted_idx]
    thresholds = (np.arange(1, n + 1) / n) * q
    below = sorted_p <= thresholds
    if below.any():
        max_k = np.max(np.where(below)[0])
        rejected_idx = sorted_idx[:max_k + 1]
        return rejected_idx
    return np.array([], dtype=int)
```

### Deflated Sharpe Ratio (DSR)

Goes further than BH by adjusting the Sharpe Ratio for:
- Number of trials (strategies tested)
- Skewness and kurtosis of returns
- Length of backtest

$$DSR = \Phi\left[\frac{(\hat{SR} - SR_0)\sqrt{T-1}}{\sqrt{1 - \hat{\gamma}_3 \hat{SR} + \frac{\hat{\gamma}_4 - 1}{4}\hat{SR}^2}}\right]$$

where $SR_0$ is the expected maximum Sharpe under the null (all strategies are noise), and $\hat{\gamma}_3, \hat{\gamma}_4$ are sample skewness and kurtosis. If DSR < 0.95, the Sharpe Ratio is not statistically significant given the number of trials.

---

## 3. Look-Ahead Bias Prevention

### Sources in EOD Models

| Bias Type | Example | Mitigation |
|-----------|---------|------------|
| **Survivorship** | Only analysing tickers that exist today | Use point-in-time universe snapshots; include delisted stocks |
| **Data snooping** | Using future data to compute rolling indicators | Strictly use `shift(1)` on all features; never access row *t* for a signal on day *t* |
| **Settlement timing** | Using closing price for signal AND execution | Signal at day *t* close → execute at day *t+1* open (or VWAP) |
| **Corporate actions** | Splits, dividends altering historical prices | Use adjusted OHLCV data only |
| **Information leakage** | Fitting HMM or parameters on the full dataset | Walk-forward or expanding-window fitting only |

### Recommended Backtest Architecture

```
for t in [window_start, ..., T]:
    # 1. Universe: only tickers that existed at time t
    # 2. Fit all models (HMM, beta, Hurst) on data [0, t-1]
    # 3. Generate signals using parameters estimated on [0, t-1]
    # 4. Record hypothetical trade at t+1 open price
    # 5. Apply transaction costs (e.g., 5 bps per side)
```

### Purged k-Fold Cross-Validation

Standard k-fold CV leaks information through serial correlation. **Purged CV** (López de Prado, 2018):
1. Remove observations in the test fold's **embargo period** (e.g., ±5 days) from the training fold.
2. Ensures no temporal leakage between train and test.

```
Train: [---████████████-----████████████---]
Purge:              ↕↕↕↕↕         (embargo)
Test:               [████]
```

### Practical Checklist

- [ ] All features use `shift(1)` or are computed on `[0, t-1]` only
- [ ] Execution assumes t+1 open, not t close
- [ ] Transaction costs ≥ 5 bps per side included
- [ ] Universe includes delisted tickers (no survivorship bias)
- [ ] HMM / regression parameters re-fit on expanding window
- [ ] Multiple testing correction applied (BH or DSR)
- [ ] Out-of-sample period ≥ 1 year is *never* touched during development
- [ ] Reported Sharpe is net of costs and adjusted for multiple trials
