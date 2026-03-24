"""
celery_app.py — Celery Application Configuration
===================================================
Configures the Celery distributed task queue with Redis as both
the message broker and result backend.

This module is imported by:
    - worker.py  (task definitions)
    - main.py    (task dispatch via .delay())

Redis URL:
    Defaults to localhost:6379, overridable via REDIS_URL env var.

Run worker:
    celery -A celery_app worker --loglevel=info --concurrency=2
"""

from __future__ import annotations

import os

from celery import Celery

# ── Redis connection URL ──
# Same Redis instance used by redis_cache.py for the dashboard cache.
# The Celery worker uses it as both broker (message queue) and
# result backend (task state/results).
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# ── Celery application instance ──
celery_app = Celery(
    "momentum_ml",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

# ── Configuration ──
celery_app.conf.update(
    # Serialise tasks and results as JSON (not pickle — security)
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # Results expire after 1 hour (ML jobs are request-scoped)
    result_expires=3600,
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Worker settings
    worker_prefetch_multiplier=1,   # fair scheduling for long tasks
    task_acks_late=True,            # ack after completion (crash safety)
)

# ── Auto-discover tasks in worker.py ──
celery_app.autodiscover_tasks(["worker"])
