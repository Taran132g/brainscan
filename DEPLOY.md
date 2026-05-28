# FindingFounders — Deployment

**Architecture:** Vercel (frontend) + Oracle E2.1.Micro (backend) + Supabase (DB/Auth, cloud) + Pinecone (vectors, cloud) + Stripe (payments)

**Domain:** `findingfounders.app` (root → Vercel, `api.findingfounders.app` → Oracle)

---

## Step 1 — Domain

Buy `findingfounders.app` at Porkbun (~$14/yr). Don't set DNS yet — we do that after Vercel + Oracle are ready and we know the target IPs/CNAMEs.

---

## Step 2 — Vercel (frontend)

1. Push the repo to GitHub if not already (private is fine).
2. vercel.com → New Project → import the repo.
3. **Root directory:** `frontend` (Vercel auto-detects Next.js).
4. **Framework preset:** Next.js (auto).
5. **Environment variables** (Production scope):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from existing `frontend/.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from existing `frontend/.env.local` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.findingfounders.app` |
| `NEXT_PUBLIC_APP_URL` | `https://findingfounders.app` |

6. Deploy. Vercel issues a `*.vercel.app` URL — verify it works before adding custom domain.
7. Project → Settings → Domains → add `findingfounders.app` + `www.findingfounders.app`. Vercel will print the A record and CNAME you need.

---

## Step 3 — Oracle (backend) on existing box

**Box:** `ssh -i ~/.ssh/oracle_pais.key ubuntu@129.159.182.210`

Pre-flight (from Mac, in this repo):
```bash
git status                              # commit & push backend changes first
git push origin main
```

On Oracle:

```bash
# 1. Clone
cd ~ && git clone https://github.com/Taran132g/FindingFounders.git findingfounders
cd ~/findingfounders/backend

# 2. Python venv + deps
python3.10 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. .env (chmod 600) — copy values from Mac backend/.env, set:
#    SUPABASE_URL=...
#    SUPABASE_SERVICE_ROLE_KEY=...
#    PINECONE_API_KEY=...
#    ANTHROPIC_API_KEY=...
#    OPENAI_API_KEY=...  (if used)
#    STRIPE_SECRET_KEY=...
#    STRIPE_WEBHOOK_SECRET=...
#    STRIPE_PRICE_BRAIN_CARD=...
#    FRONTEND_URL=https://findingfounders.app
nano .env && chmod 600 .env

# 4. Update CORS in main.py to allow the new origin
# (already need: allow_origins=["https://findingfounders.app"])

# 5. systemd unit
sudo tee /etc/systemd/system/findingfounders-api.service > /dev/null << 'EOF'
[Unit]
Description=FindingFounders FastAPI backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/findingfounders/backend
EnvironmentFile=/home/ubuntu/findingfounders/backend/.env
ExecStart=/home/ubuntu/findingfounders/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now findingfounders-api
sudo systemctl status findingfounders-api      # verify it's running
curl -s http://127.0.0.1:8001/health           # → {"status":"ok"}

# 6. nginx reverse proxy
sudo apt update && sudo apt install -y nginx
sudo tee /etc/nginx/sites-available/findingfounders > /dev/null << 'EOF'
server {
    listen 80;
    server_name api.findingfounders.app;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;          # vault uploads can be large
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/findingfounders /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 7. Open ports 80 + 443 in OCI security list (web console: VCN → Security Lists → Default → Ingress Rules)
#    Add: 0.0.0.0/0 TCP 80 and 0.0.0.0/0 TCP 443
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp

# 8. Certbot for HTTPS (do this AFTER DNS A record points to this IP)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.findingfounders.app --non-interactive --agree-tos -m taran.impact@gmail.com
```

---

## Step 4 — DNS (at the registrar)

After Vercel is live with a Vercel domain assigned, and Oracle is reachable on port 80:

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | (Vercel IP from project) | 300 |
| CNAME | `www` | `cname.vercel-dns.com` | 300 |
| A | `api` | `129.159.182.210` | 300 |

Wait ~5 min. Verify:
```bash
dig +short A findingfounders.app
dig +short A api.findingfounders.app
```

Then run `certbot` on Oracle (Step 3.8) to issue SSL.

---

## Step 5 — Smoke tests

- `https://findingfounders.app/` loads
- `https://api.findingfounders.app/health` → `{"status":"ok"}`
- Sign in via Google → OAuth callback resolves
- Upload a vault → brain card generates → `/profile/{id}` renders
- Share button copies `https://findingfounders.app/profile/...`
- Paste a share link into Slack/iMessage → OG image previews

---

## Cost summary

| Service | Plan | $/yr |
|---|---|---|
| Domain (findingfounders.app) | Porkbun | ~$14 |
| Vercel | Hobby | $0 |
| Oracle E2.1.Micro | Always Free | $0 |
| Supabase | Free | $0 |
| Pinecone | Starter (free) | $0 |
| Stripe | Pay-as-you-go | 2.9% + $0.30/tx |
| Anthropic API | Pay-as-you-go | variable |
| **Fixed** | | **~$14/yr** |

---

## Notes on the Oracle box

The PAIS dr_profit_listener already runs on this box (`systemctl status dr-profit-listener`). It uses ~150 MB RAM, leaving ~700 MB for FindingFounders. FastAPI + uvicorn at idle is ~80 MB; brain-card generation spikes briefly during Pinecone queries + Claude API calls. Should fit comfortably with 2 GB swap as headroom.

If RAM pressure becomes an issue, the listener and the API are isolated by systemd — kill either independently. Don't co-locate anything memory-heavy here (no Ollama, no local vector DB).
