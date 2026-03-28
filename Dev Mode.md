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

### Step 4: Start prod backend (background, survives terminal close)
```bash
cd ~/Desktop/momentum-screener-server/backend
source venv/bin/activate
MAC_MINI_SERVER_MODE=true \
API_KEY=<paste-your-64-char-key> \
ALLOWED_ORIGINS=https://momentum-screener.vercel.app \
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8060 --workers 1 \
  > nohup.out 2>&1 &
echo "Backend PID: $!"
```

### Step 5: Start Cloudflare Tunnel (connects your Mac to the internet)
```bash
nohup cloudflared tunnel --url http://localhost:8060 > ~/cloudflared.log 2>&1 &
```
Check the log for your public URL:
```bash
grep -o 'https://.*trycloudflare.com' ~/cloudflared.log
```
This gives you a URL like `https://something-random.trycloudflare.com`.

For a permanent custom domain, use a named tunnel instead:
```bash
cloudflared tunnel login
cloudflared tunnel create momentum-api
cloudflared tunnel route dns momentum-api api.yourdomain.com
cloudflared tunnel run momentum-api --url http://localhost:8060
```

### Step 6: Connect Vercel
In Vercel Dashboard → Project → Settings → Environment Variables:
```
NEXT_PUBLIC_API_URL = https://something-random.trycloudflare.com  (or https://api.yourdomain.com)
NEXT_PUBLIC_API_KEY = <same API_KEY from step 3>
```
Then **redeploy** the Vercel project.

---

## DAILY OPS — Start / Stop / Check Prod

```bash
# Check if backend is running
lsof -i :8060

# View live logs
tail -f ~/Desktop/momentum-screener-server/backend/nohup.out

# Stop prod backend
kill $(lsof -ti :8060)

# Restart prod backend
cd ~/Desktop/momentum-screener-server/backend
source venv/bin/activate
MAC_MINI_SERVER_MODE=true \
API_KEY=<your-key> \
ALLOWED_ORIGINS=https://momentum-screener.vercel.app \
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8060 --workers 1 \
  > nohup.out 2>&1 &

# Check Cloudflare tunnel
lsof -i :8060
grep trycloudflare ~/cloudflared.log
```

---

## Deploy New Code (Dev → Prod)

### Push from dev, pull in server
```bash
# In dev clone — push your changes
cd ~/Desktop/momentum-screener-dev
git add -A && git commit -m "your changes" && git push origin main

# In server clone — pull and restart
cd ~/Desktop/momentum-screener-server
git pull origin main
kill $(lsof -ti :8060)   # stop old backend
cd backend && source venv/bin/activate
MAC_MINI_SERVER_MODE=true \
API_KEY=<your-key> \
ALLOWED_ORIGINS=https://momentum-screener.vercel.app \
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8060 --workers 1 \
  > nohup.out 2>&1 &
```

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
