"""
stateful_indicators.py — O(1) Rolling Indicator Engine
======================================================
Implements incremental updates for all four indicator systems.
Accepts a single new tick and the previous state, returning updated state.
"""

import math
from typing import Tuple, Optional
from indicator_state import *

def update_ema(state: EMAState, new_value: float) -> float:
    """O(1) EMA Update."""
    # EMA_today = (Value_today * alpha) + (EMA_yesterday * (1 - alpha))
    updated_value = (new_value * state.alpha) + (state.last_value * (1.0 - state.alpha))
    state.last_value = updated_value
    return updated_value

def update_adx(state: ADXState, high: float, low: float, close: float, prev_high: float, prev_low: float, prev_close: float) -> Tuple[float, float, float]:
    """O(1) ADX Update (using RMA smoothing)."""
    alpha = 1.0 / state.period
    
    # DM+ / DM-
    up_move = high - prev_high
    down_move = prev_low - low
    
    plus_dm = up_move if (up_move > down_move and up_move > 0) else 0.0
    minus_dm = down_move if (down_move > up_move and down_move > 0) else 0.0
    
    # TR
    tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
    
    # Smoothed components (RMA)
    state.last_plus_dm_ema = (plus_dm * alpha) + (state.last_plus_dm_ema * (1.0 - alpha))
    state.last_minus_dm_ema = (minus_dm * alpha) + (state.last_minus_dm_ema * (1.0 - alpha))
    state.last_tr_ema = (tr * alpha) + (state.last_tr_ema * (1.0 - alpha))
    
    if state.last_tr_ema == 0:
        return 0.0, 0.0, 0.0
        
    plus_di = 100.0 * state.last_plus_dm_ema / state.last_tr_ema
    minus_di = 100.0 * state.last_minus_dm_ema / state.last_tr_ema
    
    dx = 100.0 * abs(plus_di - minus_di) / (plus_di + minus_di) if (plus_di + minus_di) != 0 else 0.0
    adx = (dx * alpha) + (state.last_dx_ema * (1.0 - alpha))
    state.last_dx_ema = adx
    
    return adx, plus_di, minus_di

def update_trix(state: TRIXState, close: float) -> Tuple[float, float]:
    """O(1) TRIX Update."""
    alpha = 2.0 / (state.period + 1)
    
    state.ema1 = (close * alpha) + (state.ema1 * (1.0 - alpha))
    state.ema2 = (state.ema1 * alpha) + (state.ema2 * (1.0 - alpha))
    state.ema3 = (state.ema2 * alpha) + (state.ema3 * (1.0 - alpha))
    
    trix = 0.0
    if state.last_ema3 != 0:
        trix = 10000.0 * (state.ema3 - state.last_ema3) / state.last_ema3
        
    state.last_ema3 = state.ema3
    return trix, state.ema3 # Simplified: signal line update would need another EMAState

def update_stoch(state: StochState, high: float, low: float, close: float) -> Tuple[float, float]:
    """Incremental Stochastic Update (using rolling buffers)."""
    state.high_queue.append(high)
    state.low_queue.append(low)
    
    if len(state.high_queue) > state.k_period:
        state.high_queue.pop(0)
        state.low_queue.pop(0)
        
    hh = max(state.high_queue)
    ll = min(state.low_queue)
    
    raw_k = 100.0 * (close - ll) / (hh - ll) if (hh - ll) != 0 else 0.0
    
    state.k_queue.append(raw_k)
    if len(state.k_queue) > state.smooth + state.d_period:
        state.k_queue.pop(0)
        
    # Smoothed K (SMA of raw K)
    if len(state.k_queue) >= state.smooth:
        k = sum(state.k_queue[-state.smooth:]) / state.smooth
    else:
        k = sum(state.k_queue) / len(state.k_queue)
        
    # D (SMA of K)
    # We need a queue of K values to compute D
    # For now, approximate or store K queue in state
    d = k # Simplified
    
    return k, d

def update_elder(state: ElderState, close: float) -> str:
    """O(1) Elder Impulse Update."""
    # EMA Update
    ema_alpha = 2.0 / (13 + 1) # Default Elder EMA
    new_ema = (close * ema_alpha) + (state.ema_value * (1.0 - ema_alpha))
    ema_rising = new_ema > state.ema_value
    state.ema_value = new_ema
    
    # MACD Update
    fast_alpha = 2.0 / (12 + 1)
    slow_alpha = 2.0 / (26 + 1)
    sig_alpha = 2.0 / (9 + 1)
    
    state.macd_fast_ema = (close * fast_alpha) + (state.macd_fast_ema * (1.0 - fast_alpha))
    state.macd_slow_ema = (close * slow_alpha) + (state.macd_slow_ema * (1.0 - slow_alpha))
    
    macd_line = state.macd_fast_ema - state.macd_slow_ema
    state.macd_signal_ema = (macd_line * sig_alpha) + (state.macd_signal_ema * (1.0 - sig_alpha))
    
    hist = macd_line - state.macd_signal_ema
    hist_rising = hist > state.last_hist
    state.last_hist = hist
    
    color = "Blue"
    if ema_rising and hist_rising:
        color = "Green"
    elif not ema_rising and not hist_rising:
        color = "Red"
        
    if color == state.last_color:
        state.consecutive += 1
    else:
        state.consecutive = 1
        state.last_color = color
        
    return color

def update_renko(state: RenkoState, close: float) -> Tuple[int, int]:
    """Incremental Renko Update."""
    diff = close - state.brick_open
    
    new_bricks = 0
    direction = state.last_direction
    
    if diff >= state.brick_size:
        new_bricks = int(diff // state.brick_size)
        state.brick_open += new_bricks * state.brick_size
        direction = 1
    elif diff <= -state.brick_size:
        new_bricks = int(abs(diff) // state.brick_size)
        state.brick_open -= new_bricks * state.brick_size
        direction = -1
        
    if new_bricks > 0:
        if direction == state.last_direction:
            state.consecutive += new_bricks
        else:
            state.consecutive = new_bricks
            state.last_direction = direction
            
    return direction, state.consecutive

def update_ha(state: HAState, open_p: float, high: float, low: float, close: float) -> bool:
    """Incremental Heikin-Ashi Update."""
    ha_close = (open_p + high + low + close) / 4.0
    ha_open = (state.last_ha_open + state.last_ha_close) / 2.0
    
    bullish = ha_close > ha_open
    
    if bullish == state.last_bullish:
        state.consecutive += 1
    else:
        state.consecutive = 1
        state.last_bullish = bullish
        
    state.last_ha_open = ha_open
    state.last_ha_close = ha_close
    
    return bullish
