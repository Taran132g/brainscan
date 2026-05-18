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
ANTHROPIC_API_KEY=sk-ant-...           # from console.anthropic.com
PINECONE_API_KEY=pcsk-...              # from app.pinecone.io
PINECONE_INDEX_NAME=finding-founders
SUPABASE_JWT_SECRET=your-jwt-secret    # set after Supabase setup below
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
2. Copy these three values:
   - **Project URL** — e.g. `https://abcdefgh.supabase.co` → frontend
   - **anon public key** — long JWT starting with `eyJ...` → frontend
   - **JWT Secret** (further down on the same page, under "JWT Settings") → backend `SUPABASE_JWT_SECRET`

> The JWT secret is what your FastAPI backend uses to verify that incoming
> requests have a real Supabase session. Treat it like a server secret —
> never expose it to the browser.

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
