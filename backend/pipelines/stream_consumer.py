"""
stream_consumer.py — Redis Stream Consumer & Write-Behind Buffer
================================================================
Reads tick data from 'momentum:ticks' in batches and performs
bulk upserts to SQLite via the synchronous db module.

Runs as an asyncio background task within the FastAPI lifespan,
using asyncio.sleep to yield control between polling cycles.
"""

import asyncio
import json
import logging
import time
from typing import Any, Dict, List

from redis_cache import get_cache
import db

logger = logging.getLogger(__name__)

class WriteBehindConsumer:
    """
    Consumer for the 'momentum:ticks' Redis Stream.
    Implements a write-behind buffer strategy for bulk DB updates.
    """

    STREAM_NAME = "momentum:ticks"
    CONSUMER_GROUP = "momentum_ingest_group"
    CONSUMER_NAME = "worker_1"
    
    BATCH_SIZE = 100
    BLOCK_MS = 5000

    def __init__(self, cache=None):
        self.cache = cache or get_cache()
        self.redis = self.cache._redis if hasattr(self.cache, '_redis') else None
        self.redis_ok = self.cache._redis_ok if hasattr(self.cache, '_redis_ok') else False
        self.running = False

    def _setup_group(self):
        """Ensure the consumer group exists."""
        if not self.redis_ok or self.redis is None:
            return False
        try:
            self.redis.xgroup_create(self.STREAM_NAME, self.CONSUMER_GROUP, id="0", mkstream=True)
            logger.info(f"Created Redis Stream consumer group: {self.CONSUMER_GROUP}")
        except Exception as e:
            if "BUSYGROUP" in str(e):
                pass  # Group already exists
            else:
                logger.error(f"Failed to create consumer group: {e}")
                return False
        return True

    async def start(self):
        """Main consumer loop."""
        if not self._setup_group():
            logger.error("Redis Stream consumer could not start: Setup failed.")
            return

        self.running = True
        logger.info(f"🚀 Write-Behind Consumer started: {self.CONSUMER_NAME}")

        while self.running:
            try:
                response = self.redis.xreadgroup(
                    self.CONSUMER_GROUP,
                    self.CONSUMER_NAME,
                    {self.STREAM_NAME: ">"},
                    count=self.BATCH_SIZE,
                    block=self.BLOCK_MS
                )

                if not response:
                    await asyncio.sleep(0.1)
                    continue

                for stream_name, messages in response:
                    if not messages:
                        continue
                    
                    batch_data = []
                    msg_ids = []

                    for msg_id, fields in messages:
                        try:
                            # Redis returns bytes keys — decode if needed
                            if isinstance(msg_id, bytes):
                                msg_id = msg_id.decode()
                            decoded = {}
                            for k, v in fields.items():
                                dk = k.decode() if isinstance(k, bytes) else k
                                dv = v.decode() if isinstance(v, bytes) else v
                                decoded[dk] = dv

                            ticker = decoded.get("ticker")
                            raw_data = decoded.get("data")
                            if ticker and raw_data:
                                data = json.loads(raw_data)
                                batch_data.append({"ticker": ticker, "data": data})
                            msg_ids.append(msg_id)
                        except Exception as e:
                            logger.error(f"Failed to parse stream message {msg_id}: {e}")

                    if batch_data:
                        success = self._persist_batch(batch_data)
                        
                        if success:
                            self.redis.xack(self.STREAM_NAME, self.CONSUMER_GROUP, *msg_ids)
                            self.redis.xdel(self.STREAM_NAME, *msg_ids)

            except Exception as e:
                logger.error(f"Consumer loop error: {e}")
                await asyncio.sleep(1)

    def _persist_batch(self, batch: List[Dict[str, Any]]) -> bool:
        """
        Convert batch data to DataFrames and push to SQLite (synchronous).
        """
        try:
            import pandas as pd
            # Group by ticker for efficiency
            ticker_groups = {}
            for item in batch:
                ticker = item["ticker"]
                data = item["data"]
                if ticker not in ticker_groups:
                    ticker_groups[ticker] = []
                ticker_groups[ticker].append(data)

            for ticker, data_list in ticker_groups.items():
                df = pd.DataFrame(data_list)
                if "Date" in df.columns:
                    df.set_index("Date", inplace=True)
                elif "date" in df.columns:
                    df.set_index("date", inplace=True)
                
                # Synchronous SQLite upsert
                db.upsert_ohlcv(ticker, df)
            
            return True
        except Exception as e:
            logger.error(f"Failed to persist batch to DB: {e}")
            return False

    def stop(self):
        self.running = False
        logger.info("Write-Behind Consumer stopping...")

async def run_consumer():
    consumer = WriteBehindConsumer()
    await consumer.start()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_consumer())
