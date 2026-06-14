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
cd ~ && git clone https://github.com/Taran132g/brainscan.git findingfounders
cd ~/pais-api/backend

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
#    STRIPE_WEBHOOK_SECRET=...        # from Stripe dashboard webhook (Step 6 below)
#    STRIPE_PRICE_BRAIN_CARD=...
#    FRONTEND_URL=https://findingfounders.app
#    BACKEND_URL=https://api.findingfounders.app   # REQUIRED for GitHub OAuth callback
nano .env && chmod 600 .env

# 4. CORS already updated in main.py (allow_origins includes https://findingfounders.app)

# 5. systemd unit
sudo tee /etc/systemd/system/pais-api.service > /dev/null << 'EOF'
[Unit]
Description=FindingFounders FastAPI backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/pais-api/backend
EnvironmentFile=/home/ubuntu/pais-api/backend/.env
ExecStart=/home/ubuntu/pais-api/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now pais-api
sudo systemctl status pais-api      # verify it's running
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

## Step 4.5 — External dashboard config (CRITICAL — auth & payments break silently without these)

These can't be done in code. Each is a hard blocker for the feature it gates.

**Supabase** (dashboard → Authentication → URL Configuration):
- Set **Site URL** → `https://findingfounders.app`
- Add to **Redirect URLs** allowlist → `https://findingfounders.app/auth/callback` and `https://findingfounders.app/**`
- Without this: Google sign-in + email OTP redirect to a blocked URL → login dead-ends.

**Google OAuth** (already wired through Supabase — no separate change needed as long as Supabase Site URL is set).

**GitHub OAuth App** (github.com → Settings → Developer settings → OAuth Apps → your app):
- Add **Authorization callback URL** → `https://api.findingfounders.app/api/github/callback`
- Without this: "Connect GitHub" on the profile form fails with redirect_uri mismatch.

**Stripe** (dashboard → Developers → Webhooks → Add endpoint):
- Endpoint URL → `https://api.findingfounders.app/api/payment/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Copy the **Signing secret** → set as `STRIPE_WEBHOOK_SECRET` in Oracle `.env`, then `sudo systemctl restart pais-api`
- Without this: payments succeed at Stripe but the tier/credit never updates in your DB.
- Also switch Stripe keys from test → live mode when ready (`STRIPE_SECRET_KEY` + `STRIPE_PRICE_BRAIN_CARD` live IDs).

---

## Step 4.6 — Embeddings note (already handled in code)

Embeddings moved from local `sentence-transformers`/torch (heavy, would OOM the 1 GB box) to **Pinecone hosted inference** (`multilingual-e5-large`, 1024-dim). This means:
- The backend no longer installs torch — `requirements.txt` is light (~150 MB total install).
- The Pinecone index name changed to `finding-founders-v2` (auto-provisions at 1024-dim on first call). The old 384-dim `finding-founders` index is left untouched and unused.
- **Existing vault data must be re-embedded:** after deploy, each existing user (just you right now) re-uploads their vault once to populate the new index. Cached brain cards in the `profiles` table still render fine in the meantime — only a fresh re-scan needs the new index.

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
