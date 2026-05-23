# FindingFounders — One-time Setup Guide

This walks you through the external services you need to set up before running the app locally.

---

## 1. Backend Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...               # from console.anthropic.com
PINECONE_API_KEY=pcsk-...                  # from app.pinecone.io
PINECONE_INDEX_NAME=finding-founders
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=...                    # legacy HS256 secret (optional for ES256-only projects)
SUPABASE_SERVICE_ROLE_KEY=...              # service-role secret (Phase 2 — Postgres writes)
```

> **Note on `SUPABASE_JWT_SECRET`:** the backend uses this to verify auth
> tokens on every protected request. You'll fill it in after creating your
> Supabase project (next section). Without it, all uploads and profile reads
> return 500.

Start the backend:
```bash
uvicorn main:app --reload --port 8000
```

---

## 2. Supabase Setup (Auth + Database)

### Create a Supabase project

1. Go to **[supabase.com](https://supabase.com)** → sign in with GitHub
2. Click **New Project**
   - **Name:** `finding-founders`
   - **Region:** closest to you (e.g. `us-east-1`)
   - **Database password:** strong, save it to your password manager
3. Wait ~2 min for provisioning

### Grab your keys

In the Supabase dashboard:
1. Go to **Settings** → **API**
2. Copy these four values:
   - **Project URL** — e.g. `https://abcdefgh.supabase.co` → frontend `.env.local` + backend `.env`
   - **anon public key** — long JWT starting with `eyJ...` → frontend `.env.local`
   - **service_role secret** — long JWT starting with `eyJ...` → backend `.env` (`SUPABASE_SERVICE_ROLE_KEY`)
   - **JWT Secret** (further down, "JWT Keys" section, "Legacy JWT Secret") → backend `.env` (`SUPABASE_JWT_SECRET`)

> **Two backend secrets:**
> - `SUPABASE_SERVICE_ROLE_KEY` lets the backend write to Postgres bypassing
>   row-level security. The routes are already JWT-gated so this is safe.
> - `SUPABASE_JWT_SECRET` is the legacy HS256 fallback for verifying tokens.
>   New Supabase projects issue ES256 tokens, verified via the public JWKS
>   endpoint, so this can be left blank for greenfield projects.

Both are server-only — never bundle them into a `NEXT_PUBLIC_*` var.

### Run the Phase 2 database migrations

The backend persists vault uploads, profile snapshots, and paywall state to
Postgres tables. Run these once, in order.

1. **Migration `0001_initial_schema.sql`** — creates the `profiles`,
   `vault_uploads`, and `matches` tables plus the auth signup trigger
2. **Migration `0002_backfill_profiles.sql`** — backfills profile rows
   for any users that signed up before the trigger existed, and syncs
   their latest brain card from `vault_uploads`
3. **Migration `0003_paywall_counters.sql`** — adds upload counters and
   the `upload_credits` table for the Stripe paywall

For each: Supabase Dashboard → SQL Editor → New query → paste the file
contents → Run.

> All migrations are idempotent. Safe to re-run if anything goes wrong.

---

## 4. Stripe Setup (Phase 2 paywall)

### Create a Stripe account

1. [stripe.com](https://stripe.com) → sign up
2. Stay in **test mode** for development (toggle in the top-right)
3. Activate live mode only when you're ready to take real payments

### Create the 4 products + prices

In the Stripe dashboard, go to **Products → Add product** four times:

| Product name        | Pricing               | Recurring? |
|---------------------|-----------------------|------------|
| Brain Card          | $0.99 USD             | one-time   |
| Full Membership     | $3.99 USD             | monthly    |
| Extra Upload        | $0.99 USD             | one-time   |
| Upgrade to Full     | $3.00 USD             | one-time   |

After each one, click into the product and copy the **price ID** (starts
with `price_...`). You'll add all four to `backend/.env`:

```
STRIPE_PRICE_BRAIN_CARD=price_...
STRIPE_PRICE_FULL_MEMBERSHIP=price_...
STRIPE_PRICE_EXTRA_UPLOAD=price_...
STRIPE_PRICE_UPGRADE=price_...
```

### Grab the API keys

**Developers → API keys** in the dashboard:

- **Publishable key** (`pk_test_...`) → frontend `.env.local` as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Secret key** (`sk_test_...`) → backend `.env` as `STRIPE_SECRET_KEY` (server-only)

### Webhook for local dev (Stripe CLI)

Stripe webhooks need to reach your backend. For local development the
Stripe CLI forwards live events to `localhost`:

```bash
brew install stripe/stripe-cli/stripe   # or download from stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to http://localhost:8001/api/payment/webhook
```

The CLI prints a signing secret on first run (starts with `whsec_...`).
Copy it into `backend/.env`:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

Keep the `stripe listen` process running while you test — it forwards
real Stripe events to your local backend.

### Test a checkout flow

1. Start backend + frontend + `stripe listen`
2. Sign in → go to `/pricing`
3. Click "Get your brain card" → completes a Stripe Checkout in test mode
4. Use card number `4242 4242 4242 4242`, any future date, any CVC, any ZIP
5. After completing, watch the `stripe listen` console — you'll see
   `checkout.session.completed` and the backend will set
   `subscription_tier = brain_card` + grant one upload credit
6. Refresh `/dashboard/settings` → plan should now show "Brain Card — one-time"

### Production webhook

When you deploy, replace `stripe listen` with a real webhook endpoint:

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://your-backend-host.com/api/payment/webhook`
3. Events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the new signing secret into your production environment's
   `STRIPE_WEBHOOK_SECRET`

### Enable Google OAuth

1. In Supabase: **Authentication** → **Providers** → **Google** → toggle **Enable**
2. You'll see a callback URL like:
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
   — copy it, you'll need it in Google Cloud Console.

### Create Google OAuth credentials

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**
2. Create a new project (or use an existing one) — e.g. `FindingFounders`
3. Go to **APIs & Services** → **OAuth consent screen**
   - Choose **External**, fill in app name + your email, **Save and continue** through the rest
4. Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - **Application type:** Web application
   - **Name:** `FindingFounders`
   - **Authorized redirect URIs:** paste the Supabase callback URL from above
5. Click **Create** — you'll get:
   - **Client ID** — e.g. `1234-abc.apps.googleusercontent.com`
   - **Client secret** — copy both

### Connect Google → Supabase

1. Back in Supabase **Authentication** → **Providers** → **Google**
2. Paste **Client ID** and **Client secret**
3. **Save**

### Configure email OTP

By default Supabase sends email OTPs via their own email service in development.
For production, you'll want to plug in a real email provider (Resend, SendGrid, etc.)
via **Authentication** → **Email Templates** → **SMTP Settings**.

---

## 3. Frontend Environment

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

Fill in `frontend/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Start the frontend:
```bash
npm run dev
```

Open `http://localhost:3000`.

---

## 4. Test the Flow

1. Click **Get Started** on the landing page → routes to `/auth`
2. Either:
   - Click **Continue with Google** → consent → routes back to `/upload`, **OR**
   - Enter your email → click **Send verification code** → check inbox → enter 6-digit code → routes to `/upload`
3. Follow the on-screen steps to export your Obsidian vault as a `.zip`
4. Drop the `.zip` → click **Analyze My Brain**
5. Wait for processing (~30-90s for a typical vault)
6. Your brain card displays with the 5 narrative sections + 5 founder signal pills + brain confidence score

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `[supabase] Missing NEXT_PUBLIC_SUPABASE_URL...` in console | Fill in `frontend/.env.local` then restart `npm run dev` |
| Google sign-in says "redirect URI mismatch" | The Supabase callback URL in Google Cloud Console must match exactly |
| OTP email never arrives | Check spam; in Supabase dashboard → **Authentication** → **Logs** for delivery status |
| Backend says "vault zip exceeds 100MB limit" | Strip out `.obsidian/`, attachments, or large media before zipping |
| Brain card generation fails with `no tool_use block` | Check `ANTHROPIC_API_KEY` in `backend/.env`; verify Claude Opus 4.7 access |
| CORS error on upload | Backend `main.py` only allows `http://localhost:3000` — update if running frontend elsewhere |

---

## What's Next After Setup

- Try uploading your own vault end-to-end
- Tweak the brain card prompt in `backend/services/brain_card.py` if Claude's output feels off
- See the roadmap in `README.md` for what's coming in Phase 2 (matching, GitHub OAuth, etc.)
