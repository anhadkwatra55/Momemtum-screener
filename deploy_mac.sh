#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  deploy_mac.sh — MOMENTUM SCREENER  •  Mac Mini M4 Self-Hosted Deploy
# ═══════════════════════════════════════════════════════════════════════
#  Strict 3.5GB RAM budget  •  SSD-first architecture
#  Services: api (1GB) + redis (256MB) + celery (1.5GB) + cloudflared (128MB) + dashboard (128MB)
#
#  Usage:  chmod +x deploy_mac.sh && ./deploy_mac.sh
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

banner() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
}

info()  { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; }
error() { echo -e "  ${RED}✗${NC} $1"; }
step()  { echo -e "\n  ${CYAN}[$1]${NC} $2"; }

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="${PROJECT_DIR}/mac_infrastructure"

banner "MOMENTUM SCREENER — Mac Mini M4 Deployment"
echo -e "  ${BOLD}RAM Budget:${NC} 3.5GB total (leaves ~12.5GB for macOS + LLMs)"
echo -e "  ${BOLD}Infrastructure:${NC} mac_infrastructure/ (gitignored)"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 1: PREREQUISITES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

step "1/7" "Checking prerequisites..."

# Homebrew
if ! command -v brew &>/dev/null; then
    warn "Homebrew not found. Installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi
info "Homebrew ✓"

# Docker
if ! command -v docker &>/dev/null; then
    warn "Docker not found. Installing Docker Desktop..."
    brew install --cask docker
    echo ""
    warn "Docker Desktop installed. Please:"
    echo "    1. Open Docker Desktop from Applications"
    echo "    2. Complete the setup wizard"
    echo "    3. Wait for Docker Engine to start (whale icon in menu bar)"
    echo "    4. Re-run this script"
    echo ""
    open -a Docker
    exit 1
fi

# Wait for Docker daemon
if ! docker info &>/dev/null; then
    warn "Docker Desktop is not running. Starting it..."
    open -a Docker
    echo "    Waiting for Docker Engine to start..."
    for i in $(seq 1 30); do
        if docker info &>/dev/null 2>&1; then
            break
        fi
        sleep 2
    done
    if ! docker info &>/dev/null; then
        error "Docker Engine failed to start after 60s. Please start Docker Desktop manually and re-run."
        exit 1
    fi
fi
info "Docker $(docker --version | awk '{print $3}') ✓"

# cloudflared
if ! command -v cloudflared &>/dev/null; then
    warn "cloudflared not found. Installing..."
    brew install cloudflared
fi
info "cloudflared $(cloudflared --version 2>&1 | head -1 | awk '{print $3}') ✓"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 2: DIRECTORY STRUCTURE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

step "2/7" "Creating directory structure..."

mkdir -p "${DOCKER_DIR}/dashboard/templates"
mkdir -p "${DOCKER_DIR}/volumes/db"
mkdir -p "${DOCKER_DIR}/volumes/redis"
mkdir -p "${DOCKER_DIR}/volumes/pipeline_data"
mkdir -p "${DOCKER_DIR}/cloudflared"

info "Directory tree created"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 3: GENERATE DOCKERFILE (ARM64 OPTIMIZED)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

step "3/7" "Generating Dockerfile.arm64 (Apple Silicon optimized)..."

cat << 'DOCKERFILE_EOF' > "${DOCKER_DIR}/Dockerfile.arm64"
# ═══════════════════════════════════════════════════════════════
#  Dockerfile.arm64 — Momentum Screener API
#  Optimized for Apple Silicon (M4) • 1GB RAM cap
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Builder (compiles native wheels) ──
FROM python:3.10-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ gfortran \
    libopenblas-dev liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY backend/requirements.txt /build/requirements.txt

# Build wheels with memory-efficient compilation flags
ENV OPENBLAS_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
RUN pip wheel --no-cache-dir --wheel-dir=/build/wheels -r requirements.txt

# ── Stage 2: Runtime (minimal image) ──
FROM python:3.10-slim

# Install only runtime libs (no compilers!)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopenblas0 libgomp1 curl git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install pre-built wheels (no compilation in runtime stage)
COPY --from=builder /build/wheels /tmp/wheels
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --no-index --find-links=/tmp/wheels \
    -r requirements.txt && rm -rf /tmp/wheels

# Copy backend code
COPY backend/ /app/

# Create data directories
RUN mkdir -p /app/pipelines/data /data/db

# ── Memory optimization environment ──
ENV PORT=8060
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
# Limit OpenBLAS/MKL threads to prevent RAM spikes during numpy ops
ENV OPENBLAS_NUM_THREADS=2
ENV MKL_NUM_THREADS=2
ENV OMP_NUM_THREADS=2
ENV NUMEXPR_MAX_THREADS=2
# Tell Python to be aggressive with memory
ENV MALLOC_TRIM_THRESHOLD_=100000
ENV PYTHONMALLOC=malloc

# Redis connection (resolved via Docker DNS)
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379

# Mac Mini local mode — full universe, no cloud limits
ENV DEPLOY_TICKER_LIMIT=0
ENV PIPELINE_CPU_WORKERS=2
ENV PIPELINE_IO_WORKERS=8
# Chunked processing to stay under 1GB
ENV SCREEN_CHUNK_SIZE=75
# Feature flag: activates RAM-diet chunked processing
ENV MAC_MINI_SERVER_MODE=true

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/api/health')" || exit 1

EXPOSE ${PORT}

CMD python -m uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1
DOCKERFILE_EOF

info "Dockerfile.arm64 generated"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 4: GENERATE DOCKER-COMPOSE.YML
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

step "4/7" "Generating docker-compose.yml (3.5GB RAM budget)..."

cat << 'COMPOSE_EOF' > "${DOCKER_DIR}/docker-compose.yml"
# ═══════════════════════════════════════════════════════════════
#  Momentum Screener — Mac Mini M4 Compose Stack
#  Total RAM: 3.5GB  |  SSD-First Architecture
# ═══════════════════════════════════════════════════════════════

services:

  # ── FastAPI Backend (1GB cap) ──
  api:
    build:
      context: ..
      dockerfile: mac_infrastructure/Dockerfile.arm64
      platforms:
        - linux/arm64
    container_name: momentum-api
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "8060:8060"
    volumes:
      # Persistent SQLite database (SSD-backed)
      - ./volumes/db:/data/db
      # Pipeline output (JSON, parquet, model files)
      - ./volumes/pipeline_data:/app/pipelines/data
      # DEV MODE: mount source for hot reload
      - ../backend:/app
    environment:
      - PORT=8060
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - DATA_DIR=/data/db
      - DEPLOY_TICKER_LIMIT=0
      - PIPELINE_CPU_WORKERS=2
      - PIPELINE_IO_WORKERS=8
      - SCREEN_CHUNK_SIZE=75
      - OPENBLAS_NUM_THREADS=2
      - OMP_NUM_THREADS=2
      - PYTHONMALLOC=malloc
      - MALLOC_TRIM_THRESHOLD_=100000
      - MAC_MINI_SERVER_MODE=true
      - API_KEY=${API_KEY:-}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-https://momentum-screener.vercel.app}
      - REDIS_URL=redis://redis:6379/0
      - INTERNAL_TRIGGER_KEY=${INTERNAL_TRIGGER_KEY:-momentum-internal-2024}
    deploy:
      resources:
        limits:
          memory: 1024M
          cpus: "3.0"
        reservations:
          memory: 512M
          cpus: "1.0"
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8060/api/health')"]
      interval: 30s
      timeout: 10s
      start_period: 180s
      retries: 3
    networks:
      - screener-net

  # ── Redis Cache (256MB cap) ──
  redis:
    image: redis:7-alpine
    container_name: momentum-redis
    restart: unless-stopped
    command: >
      redis-server
      --maxmemory 200mb
      --maxmemory-policy allkeys-lru
      --save 60 1000
      --save 300 100
      --appendonly no
      --tcp-backlog 128
      --timeout 300
    ports:
      - "6379:6379"
    volumes:
      - ./volumes/redis:/data
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"
        reservations:
          memory: 64M
          cpus: "0.1"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - screener-net

  # ── Celery Worker (1.5GB cap — XGBoost inference) ──
  celery_worker:
    build:
      context: ..
      dockerfile: mac_infrastructure/Dockerfile.arm64
      platforms:
        - linux/arm64
    container_name: momentum-celery
    restart: unless-stopped
    command: >
      celery -A celery_app worker
      --loglevel=info
      --concurrency=1
      --pool=solo
      --max-tasks-per-child=5
    working_dir: /app/pipelines
    volumes:
      - ./volumes/db:/data/db
      - ./volumes/pipeline_data:/app/pipelines/data
      - ../backend:/app
    environment:
      - REDIS_URL=redis://redis:6379/0
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - DATA_DIR=/data/db
      - OPENBLAS_NUM_THREADS=2
      - OMP_NUM_THREADS=2
      - PYTHONMALLOC=malloc
      - MALLOC_TRIM_THRESHOLD_=100000
      - MAC_MINI_SERVER_MODE=true
    deploy:
      resources:
        limits:
          memory: 1536M
          cpus: "3.0"
        reservations:
          memory: 512M
          cpus: "0.5"
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - screener-net

  # ── Cloudflare Tunnel (128MB cap) ──
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: momentum-tunnel
    restart: unless-stopped
    env_file:
      - .env
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN:-}
    deploy:
      resources:
        limits:
          memory: 128M
          cpus: "0.25"
        reservations:
          memory: 32M
          cpus: "0.1"
    depends_on:
      api:
        condition: service_healthy
    networks:
      - screener-net

  # ── Air-Gapped Admin Dashboard (127.0.0.1 ONLY — 128MB cap) ──
  admin_dash:
    build:
      context: .
      dockerfile: Dockerfile.admin
    container_name: momentum-admin
    restart: unless-stopped
    ports:
      - "127.0.0.1:9090:9090"   # CRITICAL: localhost only — never 0.0.0.0
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ..:/project
      - momentum-admin-logs:/app/logs
    environment:
      - API_URL=http://api:8060
      - PROJECT_DIR=/project
      - LOG_DIR=/app/logs
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - INTERNAL_TRIGGER_KEY=${INTERNAL_TRIGGER_KEY:-momentum-internal-2024}
      - MASTER_ENCRYPTION_KEY=${MASTER_ENCRYPTION_KEY:-}
      - FLASK_SECRET_KEY=${FLASK_SECRET_KEY:-}
    deploy:
      resources:
        limits:
          memory: 128M
          cpus: "0.5"
        reservations:
          memory: 32M
          cpus: "0.1"
    networks:
      - screener-net

networks:
  screener-net:
    driver: bridge

volumes:
  momentum-admin-logs:
    driver: local

COMPOSE_EOF

info "docker-compose.yml generated (3.5GB total RAM budget)"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 5: GENERATE MANAGEMENT DASHBOARD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

step "5/7" "Generating management dashboard..."

# ── Dashboard Dockerfile ──
cat << 'DASH_DOCKER_EOF' > "${DOCKER_DIR}/dashboard/Dockerfile"
FROM python:3.10-alpine
RUN pip install --no-cache-dir flask docker requests
WORKDIR /dashboard
COPY . /dashboard/
EXPOSE 9090
CMD ["python", "app.py"]
DASH_DOCKER_EOF

# ── Dashboard Backend (Flask) ──
cat << 'DASH_APP_EOF' > "${DOCKER_DIR}/dashboard/app.py"
#!/usr/bin/env python3
"""
Momentum Screener — Management Dashboard
==========================================
Lightweight Flask UI for controlling the Docker stack.
Talks to Docker Engine API via socket mount.
"""

import json
import os
import subprocess
import time
import traceback
from datetime import datetime, timezone

import docker
import requests
from flask import Flask, Response, jsonify, render_template, request, stream_with_context

app = Flask(__name__)
client = docker.from_env()

API_URL = os.environ.get("API_URL", "http://momentum-api:8060")
PROJECT_DIR = os.environ.get("PROJECT_DIR", "/project")
MANAGED = ["momentum-api", "momentum-redis", "momentum-celery", "momentum-tunnel"]


def _container_info(name):
    """Get container status + resource stats."""
    try:
        c = client.containers.get(name)
        stats = c.stats(stream=False)

        # Calculate memory
        mem_usage = stats["memory_stats"].get("usage", 0)
        mem_limit = stats["memory_stats"].get("limit", 1)
        mem_mb = round(mem_usage / 1024 / 1024, 1)
        mem_pct = round(mem_usage / mem_limit * 100, 1) if mem_limit else 0

        # Calculate CPU
        cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - \
                    stats["precpu_stats"]["cpu_usage"]["total_usage"]
        sys_delta = stats["cpu_stats"]["system_cpu_usage"] - \
                    stats["precpu_stats"]["system_cpu_usage"]
        n_cpus = stats["cpu_stats"].get("online_cpus", 1)
        cpu_pct = round(cpu_delta / sys_delta * n_cpus * 100, 1) if sys_delta else 0

        started = c.attrs["State"].get("StartedAt", "")
        return {
            "name": name,
            "status": c.status,
            "mem_mb": mem_mb,
            "mem_pct": mem_pct,
            "cpu_pct": cpu_pct,
            "started": started[:19].replace("T", " ") if started else "",
            "image": c.image.tags[0] if c.image.tags else "unknown",
        }
    except docker.errors.NotFound:
        return {"name": name, "status": "not found", "mem_mb": 0, "mem_pct": 0, "cpu_pct": 0}
    except Exception as e:
        return {"name": name, "status": f"error: {e}", "mem_mb": 0, "mem_pct": 0, "cpu_pct": 0}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status")
def status():
    """Get status of all managed containers."""
    containers = [_container_info(n) for n in MANAGED]
    total_mem = sum(c["mem_mb"] for c in containers)

    # API health
    api_health = {"status": "unknown"}
    try:
        r = requests.get(f"{API_URL}/api/health", timeout=3)
        api_health = r.json()
    except Exception:
        api_health = {"status": "unreachable"}

    return jsonify({
        "containers": containers,
        "total_memory_mb": round(total_mem, 1),
        "budget_mb": 3500,
        "api_health": api_health,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/api/action", methods=["POST"])
def action():
    """Start/stop/restart a container or all."""
    data = request.json or {}
    target = data.get("target", "all")
    act = data.get("action", "restart")

    targets = MANAGED if target == "all" else [target]
    results = []

    for name in targets:
        try:
            c = client.containers.get(name)
            if act == "stop":
                c.stop(timeout=10)
            elif act == "start":
                c.start()
            elif act == "restart":
                c.restart(timeout=10)
            results.append({"name": name, "result": "ok"})
        except docker.errors.NotFound:
            results.append({"name": name, "result": "not found"})
        except Exception as e:
            results.append({"name": name, "result": str(e)})

    return jsonify({"action": act, "results": results})


@app.route("/api/logs/<container_name>")
def logs(container_name):
    """Stream container logs as SSE."""
    tail = request.args.get("tail", "100")

    def generate():
        try:
            c = client.containers.get(container_name)
            for line in c.logs(stream=True, follow=True, tail=int(tail), timestamps=True):
                decoded = line.decode("utf-8", errors="replace").strip()
                yield f"data: {json.dumps({'line': decoded})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/api/git-pull", methods=["POST"])
def git_pull():
    """Pull latest from git and optionally rebuild."""
    try:
        result = subprocess.run(
            ["git", "-C", PROJECT_DIR, "pull", "--ff-only", "origin", "main"],
            capture_output=True, text=True, timeout=60,
        )
        output = result.stdout + result.stderr

        rebuild = request.json.get("rebuild", False) if request.json else False
        rebuild_output = ""

        if rebuild:
            # Trigger rebuild by restarting api and celery
            for name in ["momentum-api", "momentum-celery"]:
                try:
                    c = client.containers.get(name)
                    c.restart(timeout=15)
                    rebuild_output += f"{name}: restarted\n"
                except Exception as e:
                    rebuild_output += f"{name}: {e}\n"

        return jsonify({
            "git_output": output.strip(),
            "git_returncode": result.returncode,
            "rebuild_output": rebuild_output.strip(),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/pipeline-trigger", methods=["POST"])
def pipeline_trigger():
    """Trigger a pipeline re-run via the internal-only endpoint.
    This is the ONLY way to trigger compute — public API is read-only."""
    internal_key = os.environ.get("INTERNAL_TRIGGER_KEY", "momentum-internal-2024")
    try:
        r = requests.post(
            f"{API_URL}/internal/pipeline/trigger",
            headers={"X-Internal-Key": internal_key},
            timeout=10,
        )
        return jsonify({"status": "triggered", "response": r.json()})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/api/pipeline-status")
def pipeline_status():
    """Get current pipeline status."""
    try:
        r = requests.get(f"{API_URL}/api/health", timeout=3)
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"status": "unreachable", "error": str(e)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9090, debug=False)
DASH_APP_EOF

# ── Dashboard HTML Template ──
cat << 'DASH_HTML_EOF' > "${DOCKER_DIR}/dashboard/templates/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MOMENTUM — Control Center</title>
<style>
  :root {
    --bg: #0a0a0f;
    --surface: #13131a;
    --surface2: #1a1a24;
    --border: #2a2a3a;
    --text: #e0e0e8;
    --text2: #8888a0;
    --accent: #6366f1;
    --accent2: #818cf8;
    --green: #22c55e;
    --red: #ef4444;
    --yellow: #f59e0b;
    --cyan: #06b6d4;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    padding: 20px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }
  .header h1 {
    font-size: 18px;
    font-weight: 600;
    background: linear-gradient(135deg, var(--accent), var(--cyan));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .header .mem-budget {
    font-size: 13px;
    color: var(--text2);
  }
  .mem-bar {
    width: 200px;
    height: 6px;
    background: var(--surface2);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 4px;
  }
  .mem-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.5s ease, background 0.5s ease;
  }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    transition: border-color 0.2s;
  }
  .card:hover { border-color: var(--accent); }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .card-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .status-dot {
    width: 8px; height: 8px; border-radius: 50%;
    display: inline-block; margin-right: 6px;
  }
  .status-running { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .status-stopped { background: var(--red); }
  .status-unknown { background: var(--yellow); }
  .metric { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .metric-label { color: var(--text2); }
  .metric-value { font-weight: 500; }
  .controls { display: flex; gap: 6px; margin-top: 10px; }
  .btn {
    padding: 5px 12px;
    font-size: 11px;
    font-family: inherit;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface2);
    color: var(--text);
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn:hover { border-color: var(--accent); background: #1e1e2e; }
  .btn-green { border-color: var(--green); color: var(--green); }
  .btn-green:hover { background: rgba(34,197,94,0.1); }
  .btn-red { border-color: var(--red); color: var(--red); }
  .btn-red:hover { background: rgba(239,68,68,0.1); }
  .btn-accent { border-color: var(--accent); color: var(--accent2); }
  .btn-accent:hover { background: rgba(99,102,241,0.1); }
  .section-title {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text2);
    margin: 20px 0 10px;
  }
  .log-panel {
    background: #000;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    height: 350px;
    overflow-y: auto;
    font-size: 11px;
    line-height: 1.6;
    color: #8ec07c;
  }
  .log-panel .error { color: var(--red); }
  .log-panel .warn { color: var(--yellow); }
  .log-controls { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
  .log-select {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 5px 10px;
    font-size: 12px;
    font-family: inherit;
    border-radius: 4px;
  }
  .actions-bar {
    display: flex;
    gap: 10px;
    padding: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    align-items: center;
  }
  .git-output {
    background: #000;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px;
    font-size: 11px;
    color: var(--cyan);
    white-space: pre-wrap;
    max-height: 150px;
    overflow-y: auto;
    margin-top: 8px;
    display: none;
  }
  .pipeline-status {
    padding: 8px 14px;
    background: var(--surface2);
    border-radius: 6px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
</head>
<body>

<div class="header">
    <div>
        <h1>⚡ MOMENTUM CONTROL CENTER</h1>
        <span style="font-size:11px;color:var(--text2)">Mac Mini M4 · Docker Stack</span>
    </div>
    <div class="mem-budget" style="text-align:right">
        <span id="totalMem">0</span> MB / 3,500 MB
        <div class="mem-bar"><div class="mem-bar-fill" id="memBarFill" style="width:0%;background:var(--green)"></div></div>
    </div>
</div>

<!-- Container Cards -->
<div class="grid" id="containerGrid"></div>

<!-- Global Actions -->
<div class="actions-bar">
    <span style="font-size:12px;color:var(--text2);margin-right:8px">STACK:</span>
    <button class="btn btn-green" onclick="stackAction('start')">▶ Start All</button>
    <button class="btn btn-red" onclick="stackAction('stop')">■ Stop All</button>
    <button class="btn" onclick="stackAction('restart')">↻ Restart All</button>
    <div style="flex:1"></div>
    <span style="font-size:12px;color:var(--text2);margin-right:8px">PIPELINE:</span>
    <button class="btn btn-accent" onclick="triggerPipeline()">🚀 Run Pipeline</button>
    <div class="pipeline-status" id="pipelineStatus">
        <span class="status-dot status-unknown"></span>
        <span>Loading...</span>
    </div>
</div>

<!-- Git Sync -->
<div class="actions-bar">
    <span style="font-size:12px;color:var(--text2);margin-right:8px">GIT:</span>
    <button class="btn btn-accent" onclick="gitPull(false)">⬇ Pull Main</button>
    <button class="btn btn-green" onclick="gitPull(true)">⬇ Pull & Restart</button>
    <div id="gitOutput" class="git-output"></div>
</div>

<!-- Logs -->
<div class="section-title">LIVE LOGS</div>
<div class="log-controls">
    <select class="log-select" id="logSource" onchange="switchLogs()">
        <option value="momentum-api">API Server</option>
        <option value="momentum-celery">Celery Worker</option>
        <option value="momentum-redis">Redis</option>
        <option value="momentum-tunnel">Cloudflare Tunnel</option>
    </select>
    <button class="btn" onclick="clearLogs()">Clear</button>
    <button class="btn" onclick="switchLogs()">↻ Reconnect</button>
</div>
<div class="log-panel" id="logPanel"></div>

<script>
let logSource = null;

function renderContainers(data) {
    const grid = document.getElementById('containerGrid');
    grid.innerHTML = data.containers.map(c => {
        const dotClass = c.status === 'running' ? 'status-running' : 
                         c.status === 'not found' ? 'status-unknown' : 'status-stopped';
        const memColor = c.mem_pct > 85 ? 'var(--red)' : c.mem_pct > 60 ? 'var(--yellow)' : 'var(--green)';
        return `
        <div class="card">
            <div class="card-header">
                <span class="card-title"><span class="status-dot ${dotClass}"></span>${c.name.replace('momentum-','')}</span>
                <span style="font-size:11px;color:${memColor}">${c.mem_mb} MB</span>
            </div>
            <div class="metric"><span class="metric-label">Status</span><span class="metric-value">${c.status}</span></div>
            <div class="metric"><span class="metric-label">CPU</span><span class="metric-value">${c.cpu_pct}%</span></div>
            <div class="metric"><span class="metric-label">Memory</span><span class="metric-value">${c.mem_mb} MB (${c.mem_pct}%)</span></div>
            <div class="metric"><span class="metric-label">Started</span><span class="metric-value">${c.started || '—'}</span></div>
            <div class="controls">
                <button class="btn btn-green" onclick="containerAction('${c.name}','start')">▶</button>
                <button class="btn btn-red" onclick="containerAction('${c.name}','stop')">■</button>
                <button class="btn" onclick="containerAction('${c.name}','restart')">↻</button>
            </div>
        </div>`;
    }).join('');

    // Update memory bar
    document.getElementById('totalMem').textContent = Math.round(data.total_memory_mb);
    const pct = Math.min(100, data.total_memory_mb / data.budget_mb * 100);
    const fill = document.getElementById('memBarFill');
    fill.style.width = pct + '%';
    fill.style.background = pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--yellow)' : 'var(--green)';

    // Update pipeline status
    const ps = document.getElementById('pipelineStatus');
    const h = data.api_health;
    if (h.pipeline) {
        const state = h.pipeline.state || 'unknown';
        const dotCls = state === 'done' ? 'status-running' : state === 'running' ? 'status-unknown' : 'status-stopped';
        ps.innerHTML = `<span class="status-dot ${dotCls}"></span><span>${h.pipeline.message || state}</span>`;
    } else {
        ps.innerHTML = `<span class="status-dot status-stopped"></span><span>${h.status || 'unreachable'}</span>`;
    }
}

async function fetchStatus() {
    try {
        const r = await fetch('/api/status');
        const data = await r.json();
        renderContainers(data);
    } catch(e) { console.error(e); }
}

async function containerAction(name, action) {
    await fetch('/api/action', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({target: name, action}),
    });
    setTimeout(fetchStatus, 1500);
}

async function stackAction(action) {
    await fetch('/api/action', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({target: 'all', action}),
    });
    setTimeout(fetchStatus, 2000);
}

async function triggerPipeline() {
    try {
        await fetch('/api/pipeline-trigger', {method: 'POST'});
    } catch(e) {}
    setTimeout(fetchStatus, 1000);
}

async function gitPull(rebuild) {
    const out = document.getElementById('gitOutput');
    out.style.display = 'block';
    out.textContent = 'Pulling...';
    try {
        const r = await fetch('/api/git-pull', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({rebuild}),
        });
        const data = await r.json();
        out.textContent = data.git_output + (data.rebuild_output ? '\n\n' + data.rebuild_output : '');
    } catch(e) { out.textContent = 'Error: ' + e.message; }
}

function switchLogs() {
    if (logSource) logSource.close();
    const panel = document.getElementById('logPanel');
    const container = document.getElementById('logSource').value;
    panel.innerHTML = `<div style="color:var(--text2)">Connecting to ${container}...</div>`;

    logSource = new EventSource(`/api/logs/${container}?tail=200`);
    logSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.error) {
            panel.innerHTML += `<div class="error">${data.error}</div>`;
            return;
        }
        const line = data.line || '';
        let cls = '';
        if (line.includes('ERROR') || line.includes('error') || line.includes('✗')) cls = 'error';
        else if (line.includes('WARNING') || line.includes('⚠')) cls = 'warn';
        panel.innerHTML += `<div class="${cls}">${escapeHtml(line)}</div>`;
        panel.scrollTop = panel.scrollHeight;
        // Keep last 500 lines
        while (panel.children.length > 500) panel.removeChild(panel.firstChild);
    };
}

function clearLogs() { document.getElementById('logPanel').innerHTML = ''; }
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Boot
fetchStatus();
setInterval(fetchStatus, 5000);
setTimeout(switchLogs, 1000);
</script>
</body>
</html>
DASH_HTML_EOF

info "Management dashboard generated"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 6: GENERATE .env TEMPLATE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

step "6/7" "Generating .env template..."

cat << 'ENV_EOF' > "${DOCKER_DIR}/.env"
# ═══════════════════════════════════════════════════════════════
#  Momentum Screener — Environment Variables
# ═══════════════════════════════════════════════════════════════

# Cloudflare Tunnel Token (get this after `cloudflared tunnel create`)
# Run:  cloudflared tunnel token <TUNNEL_NAME>
CLOUDFLARE_TUNNEL_TOKEN=

# ── Zero-Trust Security ──

# API Key: Required by Vercel frontend in X-API-Key header.
# Generate: openssl rand -hex 32
# Set this same key in your Vercel environment as NEXT_PUBLIC_API_KEY
API_KEY=

# Allowed CORS Origins (comma-separated)
ALLOWED_ORIGINS=https://momentum-screener.vercel.app

# Internal trigger key (dashboard → API, Docker-network only)
INTERNAL_TRIGGER_KEY=momentum-internal-2024

# Redis (auto-configured via Docker DNS — don't change)
REDIS_URL=redis://redis:6379/0

# Pipeline settings
DEPLOY_TICKER_LIMIT=0
PIPELINE_CPU_WORKERS=2
PIPELINE_IO_WORKERS=8
SCREEN_CHUNK_SIZE=75

# ── Admin Dashboard (127.0.0.1:9090) ──

# Master key to login to the admin dashboard.
# Generate: openssl rand -hex 32
# Leave empty for open access (dev mode).
MASTER_ENCRYPTION_KEY=

# Flask session secret (auto-generated if empty)
FLASK_SECRET_KEY=

ENV_EOF

info ".env template generated"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 7: COPY EXISTING DB (if exists) + BUILD + LAUNCH
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

step "7/7" "Building and launching the stack..."

# Copy existing SQLite database if it exists
if [ -f "${PROJECT_DIR}/backend/pipelines/quant_screener.db" ]; then
    cp "${PROJECT_DIR}/backend/pipelines/quant_screener.db" "${DOCKER_DIR}/volumes/db/quant_screener.db"
    info "Copied existing quant_screener.db to persistent volume"
fi

# Copy XGBoost model if exists
if [ -f "${PROJECT_DIR}/backend/pipelines/xgb_model.json" ]; then
    cp "${PROJECT_DIR}/backend/pipelines/xgb_model.json" "${DOCKER_DIR}/volumes/pipeline_data/xgb_model.json"
    info "Copied XGBoost model to persistent volume"
fi

# Build and launch (without cloudflared for now)
cd "${DOCKER_DIR}"

echo ""
echo -e "  ${CYAN}Building Docker images (this takes 3-5 min on first run)...${NC}"
echo ""

docker compose build --no-cache api celery_worker dashboard

echo ""
echo -e "  ${CYAN}Starting containers...${NC}"
echo ""

# Start everything except cloudflared (needs token first)
docker compose up -d redis
sleep 3
docker compose up -d api celery_worker dashboard

echo ""
banner "DEPLOYMENT COMPLETE"

echo ""
echo -e "  ${GREEN}━━━ Services Running ━━━${NC}"
echo -e "  ${BOLD}API Server:${NC}      http://localhost:8060"
echo -e "  ${BOLD}API Health:${NC}      http://localhost:8060/api/health"
echo -e "  ${BOLD}Dashboard:${NC}       http://localhost:9090"
echo -e "  ${BOLD}Redis:${NC}           localhost:6379"
echo ""
echo -e "  ${GREEN}━━━ RAM Budget ━━━${NC}"
echo -e "  API:           1,024 MB"
echo -e "  Celery Worker: 1,536 MB"
echo -e "  Redis:           256 MB"
echo -e "  Cloudflared:     128 MB"
echo -e "  Dashboard:       128 MB"
echo -e "  ${BOLD}Total:         3,072 MB (~3 GB)${NC}"
echo ""
echo -e "  ${YELLOW}━━━ Cloudflare Tunnel Setup ━━━${NC}"
echo -e "  Run these commands to connect Vercel to this Mac Mini:"
echo ""
echo -e "    ${CYAN}# Step 1: Login to Cloudflare${NC}"
echo -e "    cloudflared tunnel login"
echo ""
echo -e "    ${CYAN}# Step 2: Create tunnel${NC}"
echo -e "    cloudflared tunnel create momentum-api"
echo ""
echo -e "    ${CYAN}# Step 3: Route your domain${NC}"
echo -e "    cloudflared tunnel route dns momentum-api api.YOURDOMAIN.com"
echo ""
echo -e "    ${CYAN}# Step 4: Get the tunnel token${NC}"
echo -e "    TUNNEL_TOKEN=\$(cloudflared tunnel token momentum-api)"
echo ""
echo -e "    ${CYAN}# Step 5: Add token to .env and start tunnel${NC}"
echo -e "    echo \"CLOUDFLARE_TUNNEL_TOKEN=\${TUNNEL_TOKEN}\" >> ${DOCKER_DIR}/.env"
echo -e "    cd ${DOCKER_DIR} && docker compose up -d cloudflared"
echo ""
echo -e "    ${CYAN}# Step 6: Set in Vercel Dashboard${NC}"
echo -e "    NEXT_PUBLIC_API_URL=https://api.YOURDOMAIN.com"
echo ""
echo -e "  ${GREEN}━━━ Development Workflow ━━━${NC}"
echo -e "  Code changes in backend/ are auto-mounted (Docker volume)."
echo -e "  Restart to apply:  cd ${DOCKER_DIR} && docker compose restart api celery_worker"
echo -e "  Or use the dashboard at http://localhost:9090"
echo ""
echo -e "  ${GREEN}━━━ Useful Commands ━━━${NC}"
echo -e "  Logs:     cd ${DOCKER_DIR} && docker compose logs -f api"
echo -e "  Stop:     cd ${DOCKER_DIR} && docker compose down"
echo -e "  Rebuild:  cd ${DOCKER_DIR} && docker compose up -d --build api celery_worker"
echo -e "  Status:   cd ${DOCKER_DIR} && docker compose ps"
echo ""
