"""
redis_cache.py — Redis Caching Layer with Graceful Fallback
=============================================================
Primary read-layer for the Next.js dashboard. If Redis is unavailable,
falls back to an in-memory dict (identical behaviour to the legacy system).

Strategy for sub-50ms reads:
    1. Write-through: pipeline writes dashboard JSON to Redis immediately
    2. TTL-based keys: dashboard data (5 min), chart data (10 min)
    3. Granular keys: per-ticker charts cached separately to avoid
       deserialising the full ~2MB dashboard payload
    4. Graceful fallback: if Redis is down, in-memory dict takes over

Key structure:
    momentum:dashboard           → full dashboard JSON (300s TTL)
    momentum:dashboard:version   → pipeline run Unix timestamp
    momentum:chart:{ticker}      → per-ticker chart data (600s TTL)
    momentum:pipeline:status     → pipeline state JSON
"""

from __future__ import annotations

import json
import time
import warnings
from typing import Any, Optional

warnings.filterwarnings("ignore")

# ── Try to import redis, fallback gracefully ──
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


class RedisCache:
    """
    Unified cache layer. Attempts Redis first; falls back to in-memory dict.
    All methods are safe to call even when Redis is completely unavailable.
    """

    # Key constants
    KEY_DASHBOARD = "momentum:dashboard"
    KEY_VERSION = "momentum:dashboard:version"
    KEY_PIPELINE = "momentum:pipeline:status"
    KEY_CHART_PREFIX = "momentum:chart:"

    # TTLs (seconds)
    TTL_DASHBOARD = 300     # 5 minutes
    TTL_CHART = 600         # 10 minutes
    TTL_PIPELINE = 60       # 1 minute

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: Optional[str] = None,
        socket_timeout: float = 1.0,
    ):
        self._fallback: dict[str, Any] = {}
        self._redis: Optional[Any] = None
        self._redis_ok = False

        if REDIS_AVAILABLE:
            try:
                self._redis = redis.Redis(
                    host=host,
                    port=port,
                    db=db,
                    password=password,
                    socket_timeout=socket_timeout,
                    socket_connect_timeout=socket_timeout,
                    decode_responses=True,
                )
                # Test connection
                self._redis.ping()
                self._redis_ok = True
                print(f"  ✓ Redis connected ({host}:{port})")
            except Exception as e:
                print(f"  ⚠ Redis unavailable ({e}). Using in-memory fallback.")
                self._redis = None
                self._redis_ok = False
        else:
            print("  ⚠ redis-py not installed. Using in-memory fallback.")

    @property
    def is_redis_connected(self) -> bool:
        """Check if Redis is currently available."""
        if not self._redis_ok or self._redis is None:
            return False
        try:
            self._redis.ping()
            return True
        except Exception:
            self._redis_ok = False
            return False

    # ── Generic get/set ──

    def get(self, key: str) -> Optional[str]:
        """Get a value by key. Returns None if not found or error."""
        if self._redis_ok:
            try:
                return self._redis.get(key)
            except Exception:
                self._redis_ok = False
        return self._fallback.get(key)

    def set(self, key: str, value: str, ttl: Optional[int] = None) -> bool:
        """Set a value. Returns True on success."""
        self._fallback[key] = value
        if self._redis_ok:
            try:
                if ttl:
                    self._redis.setex(key, ttl, value)
                else:
                    self._redis.set(key, value)
                return True
            except Exception:
                self._redis_ok = False
        return False

    def delete(self, key: str) -> bool:
        """Delete a key."""
        self._fallback.pop(key, None)
        if self._redis_ok:
            try:
                self._redis.delete(key)
                return True
            except Exception:
                self._redis_ok = False
        return False

    # ── JSON helpers ──

    def get_json(self, key: str) -> Optional[dict]:
        """Get and deserialise a JSON value."""
        raw = self.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None

    def set_json(self, key: str, data: Any, ttl: Optional[int] = None) -> bool:
        """Serialise and store a JSON value."""
        try:
            raw = json.dumps(data, default=str)
            return self.set(key, raw, ttl)
        except (TypeError, ValueError):
            return False

    # ── Dashboard-specific methods ──

    def set_dashboard(self, data: dict) -> bool:
        """Store full dashboard data with TTL."""
        version = str(int(time.time()))
        self.set(self.KEY_VERSION, version)
        return self.set_json(self.KEY_DASHBOARD, data, ttl=self.TTL_DASHBOARD)

    def get_dashboard(self) -> Optional[dict]:
        """Retrieve cached dashboard data."""
        return self.get_json(self.KEY_DASHBOARD)

    def get_dashboard_version(self) -> Optional[str]:
        """Get the pipeline run timestamp."""
        return self.get(self.KEY_VERSION)

    # ── Chart data (granular per-ticker) ──

    def set_chart(self, ticker: str, chart_data: dict) -> bool:
        """Cache per-ticker chart data."""
        key = f"{self.KEY_CHART_PREFIX}{ticker}"
        return self.set_json(key, chart_data, ttl=self.TTL_CHART)

    def get_chart(self, ticker: str) -> Optional[dict]:
        """Get cached chart data for a ticker."""
        key = f"{self.KEY_CHART_PREFIX}{ticker}"
        return self.get_json(key)

    def set_charts_bulk(self, charts: dict[str, dict]) -> int:
        """Cache chart data for multiple tickers. Returns count stored."""
        stored = 0
        for ticker, data in charts.items():
            if self.set_chart(ticker, data):
                stored += 1
        return stored

    # ── Pipeline status ──

    def set_pipeline_status(self, status: dict) -> bool:
        return self.set_json(self.KEY_PIPELINE, status, ttl=self.TTL_PIPELINE)

    def get_pipeline_status(self) -> Optional[dict]:
        return self.get_json(self.KEY_PIPELINE)

    # ── Cache invalidation ──

    def invalidate_dashboard(self) -> None:
        """Clear all dashboard-related keys."""
        self.delete(self.KEY_DASHBOARD)
        self.delete(self.KEY_VERSION)

    def invalidate_all(self) -> None:
        """Clear all momentum-related keys."""
        self.invalidate_dashboard()
        self.delete(self.KEY_PIPELINE)
        # Clear chart keys (pattern delete on Redis, full clear on fallback)
        if self._redis_ok:
            try:
                cursor = 0
                while True:
                    cursor, keys = self._redis.scan(
                        cursor, match=f"{self.KEY_CHART_PREFIX}*", count=100
                    )
                    if keys:
                        self._redis.delete(*keys)
                    if cursor == 0:
                        break
            except Exception:
                pass
        # Clear fallback
        chart_keys = [k for k in self._fallback if k.startswith(self.KEY_CHART_PREFIX)]
        for k in chart_keys:
            del self._fallback[k]

    # ── Diagnostics ──

    def stats(self) -> dict:
        """Return cache diagnostics."""
        info = {
            "backend": "redis" if self._redis_ok else "memory",
            "fallback_keys": len(self._fallback),
            "dashboard_cached": self.get(self.KEY_DASHBOARD) is not None,
            "version": self.get_dashboard_version(),
        }
        if self._redis_ok:
            try:
                redis_info = self._redis.info("memory")
                info["redis_memory_mb"] = round(
                    redis_info.get("used_memory", 0) / 1024 / 1024, 2
                )
            except Exception:
                pass
        return info


# ── Module-level singleton ──

_cache_instance: Optional[RedisCache] = None


def get_cache(
    host: str = "localhost",
    port: int = 6379,
    password: Optional[str] = None,
) -> RedisCache:
    """Get or create the singleton cache instance."""
    global _cache_instance
    if _cache_instance is None:
        import os
        _cache_instance = RedisCache(
            host=os.environ.get("REDIS_HOST", host),
            port=int(os.environ.get("REDIS_PORT", port)),
            password=os.environ.get("REDIS_PASSWORD", password),
        )
    return _cache_instance
