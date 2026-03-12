FROM python:3.10-slim

# Install system dependencies for numpy/scipy/scikit-learn compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies first (Docker layer cache)
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code (main.py is in backend/, modules in backend/pipelines/)
COPY backend/ /app/

# Create data directory for SQLite and JSON output
RUN mkdir -p /app/pipelines/data

# Environment
ENV PORT=8060
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV DEPLOY_TICKER_LIMIT=500

# Health check (Railway/Render will use this to know when the server is ready)
HEALTHCHECK --interval=60s --timeout=30s --start-period=120s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/api/health')" || exit 1

EXPOSE ${PORT}

# main.py adds pipelines/ to sys.path itself (line 49-50), so we run from backend/
CMD python -m uvicorn main:app --host 0.0.0.0 --port ${PORT}
