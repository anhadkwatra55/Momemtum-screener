"""
stream_ingest.py — Redis Stream Producer
=========================================
Pushes raw tick/OHLCV data into a Redis Stream for asynchronous ingestion.
Decouples data fetching from database persistence.
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional

from redis_cache import get_cache

logger = logging.getLogger(__name__)

class TickStreamProducer:
    """
    Producer for the 'momentum:ticks' Redis Stream.
    Handles serialization and ingestion of raw data blobs.
    """

    STREAM_NAME = "momentum:ticks"
    MAX_LEN = 10000  # Cap the stream size to prevent OOM

    def __init__(self, cache=None):
        self.cache = cache or get_cache()
        self.redis = self.cache._redis if hasattr(self.cache, '_redis') else None
        self.redis_ok = self.cache._redis_ok if hasattr(self.cache, '_redis_ok') else False

    async def push_tick(self, ticker: str, data: Dict[str, Any]) -> bool:
        """
        Push a single ticker's data blob to the stream.
        Data should include close, volume, etc.
        """
        if not self.redis_ok or self.redis is None:
            # If Redis is down, we can't stream. Fallback to direct DB write 
            # (handled by the caller in momentum_data.py)
            return False

        try:
            # Flatten data to JSON string for the stream entry
            payload = {
                "ticker": ticker,
                "data": json.dumps(data),
                "ts": time.time()
            }
            
            # XADD key ID field value [field value ...]
            # Using '*' for auto-generated ID
            self.redis.xadd(self.STREAM_NAME, payload, maxlen=self.MAX_LEN, approximate=True)
            return True
        except Exception as e:
            logger.error(f"Failed to push tick for {ticker} to Redis Stream: {e}")
            self.redis_ok = False
            return False

    async def push_batch(self, batch: List[Dict[str, Any]]) -> int:
        """
        Push a batch of ticks to the stream.
        Batch should be a list of dicts with 'ticker' and 'data'.
        """
        if not self.redis_ok or self.redis is None:
            return 0

        count = 0
        try:
            # Redis-py doesn't have a native xadd_multi, so we use a pipeline
            pipe = self.redis.pipeline()
            for item in batch:
                ticker = item.get("ticker")
                data = item.get("data")
                if ticker and data:
                    payload = {
                        "ticker": ticker,
                        "data": json.dumps(data),
                        "ts": time.time()
                    }
                    pipe.xadd(self.STREAM_NAME, payload, maxlen=self.MAX_LEN, approximate=True)
            
            pipe.execute()
            count = len(batch)
        except Exception as e:
            logger.error(f"Failed to push batch to Redis Stream: {e}")
            self.redis_ok = False
        
        return count

# Singleton instance
_producer = None

def get_producer():
    global _producer
    if _producer is None:
        _producer = TickStreamProducer()
    return _producer
