"""
celery_app.py — Root Celery Re-Export
======================================
Re-exports the Celery application from pipelines.celery_app
so that `celery -A celery_app worker` works from backend/.
"""

import sys
import os

# Ensure pipelines/ is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "pipelines"))

from pipelines.celery_app import celery_app

# Alias for backward compatibility (some modules import 'app')
app = celery_app

if __name__ == "__main__":
    app.start()

