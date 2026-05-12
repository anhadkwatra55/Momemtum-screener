"""
indicator_state.py — State Dataclasses for O(1) Indicators
==========================================================
Defines the memory structure for incremental indicator updates.
Allows bypassing O(N) recalculations for streaming data.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

@dataclass
class EMAState:
    last_value: float
    span: int
    alpha: float

@dataclass
class ADXState:
    last_plus_dm_ema: float
    last_minus_dm_ema: float
    last_tr_ema: float
    last_dx_ema: float
    period: int

@dataclass
class TRIXState:
    ema1: float
    ema2: float
    ema3: float
    last_ema3: float
    period: int

@dataclass
class StochState:
    low_queue: List[float] = field(default_factory=list)
    high_queue: List[float] = field(default_factory=list)
    k_queue: List[float] = field(default_factory=list)
    k_period: int = 14
    smooth: int = 3
    d_period: int = 3

@dataclass
class ElderState:
    ema_value: float
    macd_fast_ema: float
    macd_slow_ema: float
    macd_signal_ema: float
    last_hist: float
    last_ema: float
    last_color: str
    consecutive: int

@dataclass
class RenkoState:
    brick_open: float
    brick_size: float
    last_direction: int
    consecutive: int
    last_index: int

@dataclass
class HAState:
    last_ha_open: float
    last_ha_close: float
    consecutive: int
    last_bullish: bool

@dataclass
class HMAState:
    wma_half_queue: List[float] = field(default_factory=list)
    wma_full_queue: List[float] = field(default_factory=list)
    diff_wma_queue: List[float] = field(default_factory=list)
    period: int = 20

@dataclass
class TickerState:
    ticker: str
    last_update: str
    s1: ADXState
    s1_trix: TRIXState
    s1_stoch: StochState
    s2: ElderState
    s3: RenkoState
    s4: HAState
    s4_hma: HMAState
    
    # Combined scores
    composite_score: float = 0.0
    sentiment: str = "Neutral"
