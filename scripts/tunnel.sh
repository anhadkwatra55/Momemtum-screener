#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
#  Momentum Screener — Resilient Cloudflare Tunnel
# ═══════════════════════════════════════════════════════
#
# Auto-restarts cloudflared on crash with exponential backoff.
# Usage:  bash ~/Desktop/momentum-screener-dev/scripts/tunnel.sh
#
# The tunnel URL will be printed to the terminal. Copy it and
# set NEXT_PUBLIC_API_URL in Vercel, then redeploy.
#
# NOTE: Quick tunnels get a NEW URL each time cloudflared restarts.
#       If cloudflared crashes and restarts, you'll need to update
#       the Vercel env var with the new URL and redeploy.
# ═══════════════════════════════════════════════════════

set -euo pipefail

BACKEND_PORT="${BACKEND_PORT:-8060}"
BACKEND_URL="http://localhost:${BACKEND_PORT}"

# Backoff settings
INITIAL_BACKOFF=2       # seconds
MAX_BACKOFF=120         # 2 minutes max
BACKOFF_MULTIPLIER=2

# Log file for tunnel output
LOG_DIR="$HOME/.momentum_logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/tunnel_$(date +%Y%m%d_%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Momentum Screener — Cloudflare Tunnel Manager${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "  Backend URL:  ${GREEN}${BACKEND_URL}${NC}"
echo -e "  Log file:     ${LOG_FILE}"
echo -e "  Press Ctrl+C to stop"
echo ""

# Verify backend is running
if ! lsof -i ":${BACKEND_PORT}" &>/dev/null; then
    echo -e "${RED}✗ Backend not detected on port ${BACKEND_PORT}!${NC}"
    echo -e "  Start the backend first, then re-run this script."
    exit 1
fi
echo -e "${GREEN}✓ Backend detected on port ${BACKEND_PORT}${NC}"

# Cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}⏹ Shutting down tunnel...${NC}"
    # Kill any child cloudflared processes
    jobs -p | xargs -r kill 2>/dev/null || true
    wait 2>/dev/null || true
    echo -e "${GREEN}✓ Tunnel stopped.${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

backoff=$INITIAL_BACKOFF
attempt=0

while true; do
    attempt=$((attempt + 1))
    echo -e "\n${CYAN}[$(date '+%H:%M:%S')] Starting cloudflared (attempt #${attempt})...${NC}"

    # Run cloudflared and tee output to both terminal and log file
    # The URL line looks like: "https://xxxxx.trycloudflare.com"
    cloudflared tunnel --url "$BACKEND_URL" 2>&1 | tee -a "$LOG_FILE" &
    TUNNEL_PID=$!

    # Wait for cloudflared to exit
    wait $TUNNEL_PID 2>/dev/null
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${YELLOW}⚠ cloudflared exited cleanly (code 0). Restarting...${NC}"
        backoff=$INITIAL_BACKOFF  # Reset backoff on clean exit
    else
        echo -e "${RED}✗ cloudflared crashed (exit code: ${EXIT_CODE}).${NC}"
        echo -e "${YELLOW}  Waiting ${backoff}s before restart (exponential backoff)...${NC}"
        sleep $backoff

        # Increase backoff with cap
        backoff=$((backoff * BACKOFF_MULTIPLIER))
        if [ $backoff -gt $MAX_BACKOFF ]; then
            backoff=$MAX_BACKOFF
        fi
    fi

    # Check if backend is still running before restarting tunnel
    if ! lsof -i ":${BACKEND_PORT}" &>/dev/null; then
        echo -e "${RED}✗ Backend no longer running on port ${BACKEND_PORT}. Exiting tunnel manager.${NC}"
        exit 1
    fi
done
