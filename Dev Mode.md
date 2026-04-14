# Momentum Screener — Dev & Server Guide

## Folder Layout

```
~/Desktop/
├── momentum-screener-dev/      ← YOUR CODE (write features here)
│   ├── backend  on :8000
│   └── frontend on :3001
│
└── momentum-screener-server/   ← LIVE SERVER (runs 24/7, don't edit)
    ├── backend  on :8060 (nohup background)
    ├── admin    on 127.0.0.1:9090
    └── Cloudflare Tunnel → Vercel
```

Both run **simultaneously** — zero port collisions.

---

## SETUP (one-time per clone)

Run this for EACH clone (dev and server) when setting up:
```bash
cd ~/Desktop/momentum-screener-dev/backend   # or -server
/opt/homebrew/bin/python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Frontend (dev clone only):
```bash
cd ~/Desktop/momentum-screener-dev/frontend
npm install
```

### If venv breaks (e.g. after folder rename)
```bash
cd ~/Desktop/momentum-screener-dev/backend
rm -rf venv
/opt/homebrew/bin/python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## DEV MODE

### Start Dev Backend (Terminal 1)
```bash
cd ~/Desktop/momentum-screener-dev/backend
source venv/bin/activate
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

### Start Dev Frontend (Terminal 2)
```bash
cd ~/Desktop/momentum-screener-dev/frontend
npm run dev -- -p 3001
```

Open http://localhost:3001 — auto-connects to backend on :8000.

### Stop Dev
Ctrl+C in each terminal.

---

## PROD / LIVE SERVER — FIRST-TIME SETUP

### Step 1: Install Cloudflare Tunnel (already done ✅)
```bash
brew install cloudflared
cloudflared --version
```

### Step 2: Set up venv in server clone
```bash
cd ~/Desktop/momentum-screener-server/backend
/opt/homebrew/bin/python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Generate API key
```bash
openssl rand -hex 32
```
Copy the output — this is your API_KEY. You'll set it in both your server AND Vercel.

### Step 4: Start prod backend (with live logs in terminal)
```bash
cd ~/Desktop/momentum-screener-server/backend
source venv/bin/activate
MAC_MINI_SERVER_MODE=true API_KEY=911ee14f92d5c622fb2445ab6b8f5840738a158ac45a24adbd7d7bee0c36442c ALLOWED_ORIGINS=https://headstart-ai.vercel.app python3 -m uvicorn main:app --host 0.0.0.0 --port 8060 --workers 1
```
You should see: `🔒 [SERVER MODE] Security active: CORS=..., Rate=60/min, API-Key=SET`

### Step 5: Start Cloudflare Tunnel (new terminal tab)

**Option A — Resilient tunnel script (recommended):**
```bash
bash ~/Desktop/momentum-screener-dev/scripts/tunnel.sh
```
This auto-restarts cloudflared on crash with exponential backoff (2s → 4s → 8s → … → 120s max).
Logs are saved to `~/.momentum_logs/tunnel_*.log`.

**Option B — Raw cloudflared:**
```bash
cloudflared tunnel --url http://localhost:8060
```

Copy the `https://______.trycloudflare.com` URL it prints.

Note: URL stays constant as long as this terminal is running. If you restart cloudflared, you get a new URL and must update Vercel.

### Step 6: Connect Vercel
In Vercel Dashboard → headstart-ai → Settings → Environment Variables:
```
NEXT_PUBLIC_API_URL = <paste the trycloudflare.com URL from step 5>
NEXT_PUBLIC_API_KEY = 911ee14f92d5c622fb2445ab6b8f5840738a158ac45a24adbd7d7bee0c36442c
```
Then go to Deployments → ... → **Redeploy**.

---

## DAILY OPS — Start / Stop / Check Prod

```bash
# Check if backend is running
lsof -i :8060

# Stop prod backend
Ctrl+C in the server terminal (or: kill $(lsof -ti :8060))

# Restart prod backend
cd ~/Desktop/momentum-screener-server/backend
source venv/bin/activate
MAC_MINI_SERVER_MODE=true API_KEY=911ee14f92d5c622fb2445ab6b8f5840738a158ac45a24adbd7d7bee0c36442c ALLOWED_ORIGINS=https://headstart-ai.vercel.app python3 -m uvicorn main:app --host 0.0.0.0 --port 8060 --workers 1

# Restart Cloudflare tunnel (new terminal tab) — USE THE RESILIENT SCRIPT:
bash ~/Desktop/momentum-screener-dev/scripts/tunnel.sh
# Or raw: cloudflared tunnel --url http://localhost:8060
# If URL changed, update NEXT_PUBLIC_API_URL in Vercel and redeploy

# Check all ports
lsof -i :8000 -i :8060 -i :3001 -i :9090
```

---

## Deploy New Code (Dev → Prod)

### Step 1: Push from dev
```bash
cd ~/Desktop/momentum-screener-dev
git add -A && git commit -m "describe your changes" && git push origin main
```

### Step 2: Pull into server + restart
```bash
# Stop the running server (Ctrl+C), then:
cd ~/Desktop/momentum-screener-server
git pull origin main
cd backend
source venv/bin/activate
MAC_MINI_SERVER_MODE=true API_KEY=911ee14f92d5c622fb2445ab6b8f5840738a158ac45a24adbd7d7bee0c36442c ALLOWED_ORIGINS=https://headstart-ai.vercel.app python3 -m uvicorn main:app --host 0.0.0.0 --port 8060 --workers 1
```

Cloudflare tunnel stays running — no need to restart it or update Vercel unless you restarted cloudflared.

---

## Security (Prod Only — Dev is unrestricted)

| Layer | Protection | Response |
|-------|-----------|----------|
| CORS | Only your Vercel domain | Blocked |
| Rate Limit | 60 req/min per IP | 429 |
| API Key | X-API-Key header required | 401 |
| Route Block | 13 compute endpoints blocked | 403 |
| Admin | 127.0.0.1 only + Master Key | Localhost |

---

## Health Checks
```bash
curl http://localhost:8060/api/health        # prod
curl http://localhost:8000/api/health        # dev
docker ps                                    # containers
lsof -i :8000 -i :8060 -i :3001 -i :9090   # ports
```

## Notes
- Never edit code in momentum-screener-server/ — use dev clone only
- Docker auto-restarts containers on reboot
- Admin logs persist to ~/.momentum_logs/
- .env.local is gitignored





(Commands to Run
Terminal 1 — Production Backend (already running on :8060 ✅)
Your server is already up. If you need to restart it:


cd ~/Desktop/momentum-screener-server/backend
source venv/bin/activate
MAC_MINI_SERVER_MODE=true API_KEY=911ee14f92d5c622fb2445ab6b8f5840738a158ac45a24adbd7d7bee0c36442c ALLOWED_ORIGINS=https://headstart-ai.vercel.app python3 -m uvicorn main:app --host 0.0.0.0 --port 8060 --workers 1


Terminal 2 — Cloudflare Tunnel (this is what you need NOW)
bash ~/Desktop/momentum-screener-dev/scripts/tunnel.sh
Or the raw version:

cloudflared tunnel --url http://localhost:8060
➡️ Copy the https://______.trycloudflare.com URL → paste into Vercel as NEXT_PUBLIC_API_URL → redeploy.


Terminal 3 — Dev Backend (optional, for local dev)
cd ~/Desktop/momentum-screener-dev/backend
source venv/bin/activate
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1


Terminal 4 — Dev Frontend (optional, for local dev)
cd ~/Desktop/momentum-screener-dev/frontend
npm run dev -- -p 3001)