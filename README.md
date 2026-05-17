# FindingFounders

> Co-founder matching powered by how you actually think — not how you describe yourself.

Most co-founder platforms ask you to fill out a survey. FindingFounders reads your Obsidian vault — your real notes, projects, ideas, and mental models — and uses AI to build a *brain card*: a compatibility profile based on your actual thinking patterns, not your self-reported traits.

---

## How It Works

1. **Upload your vault** — Export your Obsidian vault as a `.zip` and upload it. Raw text is never stored.
2. **We build your brain card** — AI analyzes how you think, what you're building, what you value, and what kind of co-founder would complement you.
3. **Get matched** — Describe what you're looking for. We search every brain in our network and return ranked compatibility reports with suggested build areas.

---

## Current Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (TypeScript) |
| Backend | FastAPI (Python 3.12) |
| Embeddings | `all-MiniLM-L6-v2` via `sentence-transformers` (384-dim) |
| Vector DB | Pinecone (Serverless, AWS us-east-1) |
| LLM | Claude Opus 4.7 (brain card generation) |
| Auth | *(Google OAuth — in progress)* |
| Payments | *(Stripe — in progress)* |

---

## Planned Tech Stack

| Feature | Technology |
|---|---|
| Authentication | Google OAuth 2.0 (NextAuth.js + FastAPI session) |
| Payments | Stripe ($3.99/month — paywall after brain card generation) |
| Founder signal enrichment | GitHub OAuth (repos, commit cadence, languages) |
| Cross-user matching | Pinecone cross-namespace cosine similarity |
| In-app messaging | WebSocket or Pusher |
| Deployment | Vercel (frontend) + DigitalOcean App Platform (backend) |
| Founder scoring | Custom rubric based on PNAS/First Round/YC research (see below) |

---

## Roadmap

### Phase 1 — Core (In Progress)
- [x] Vault upload + parsing (`.zip` → markdown extraction)
- [x] Chunking + embedding pipeline (`all-MiniLM-L6-v2`)
- [x] Pinecone vector store with per-user namespaces
- [x] Claude Opus brain card generation (5-section profile)
- [x] Landing page + upload UI
- [x] Profile view page
- [ ] Google Auth (user identity)
- [ ] Vault quality gate (min 1,000 notes or 200 notes × 300+ avg words)
- [ ] Brain card quality score (confidence % based on vault richness)
- [ ] Stripe paywall ($3.99/month, triggered after brain card generated)

### Phase 2 — Founder Signal Enrichment
- [ ] GitHub OAuth integration (repos, commit frequency, top languages, streak)
- [ ] School / university field (weighted signal in founder score)
- [ ] Prior work experience field (big-tech employer = strong signal)
- [ ] Shipped products input (App Store, Product Hunt, GitHub stars)
- [ ] Founder score rubric (composite score based on empirical research)

### Phase 3 — Matching
- [ ] Cross-namespace Pinecone similarity search
- [ ] Match ranking with compatibility report
- [ ] "What you two should build together" AI suggestion (based on both brain cards)
- [ ] In-app messaging between matched founders
- [ ] Match feedback loop (did this intro lead anywhere?)

### Phase 4 — Growth
- [ ] B2B: accelerator cohort tool (Techstars, On Deck, university programs)
- [ ] Obsidian vault template for users who don't have one yet
- [ ] Anonymized aggregate insights ("what the data says about great co-founder pairs")
- [ ] Mobile-optimized upload flow

---

## Founder Scoring Research

The brain card and matching rubric are grounded in empirical research on what actually predicts founder success:

| Signal | Direction | Evidence |
|---|---|---|
| 2+ co-founders vs. solo | Positive | 163% outperformance (First Round, n=300+) |
| Technical co-founder (B2B) | Positive | 230% outperformance (First Round) |
| Female founder on team | Positive | 63% outperformance (First Round) |
| Prior big-tech employer | Positive | 160% outperformance, +50% valuation (First Round) |
| Elite school (Ivy/Stanford/MIT) | Positive | ~220% outperformance (First Round) |
| Age under 25 at founding | Positive | ~30% above average (First Round) |
| Prior shipped product | Positive | 34% vs. 22% success rate (HBS) |
| High neuroticism | Negative | Consistent across all stages (PNAS, n=10,541) |
| Solo founder | Negative | 25% lower seed valuation (Carta 2025) |
| Founder-market fit | Positive | 230% more likely to grow (NFX) |

Sources: PNAS (2023, n=10,541) · First Round Capital 10-Year Study · Kauffman Foundation · Paul Graham/YC · HBS · Carta · NFX

---

## Privacy

Your notes never leave your container. We convert vault content into embeddings — mathematical representations of meaning — stored in your private Pinecone namespace. Raw text is processed in memory and immediately discarded. When matching runs, only vectors are compared. No raw content is ever shared with other users, accessible to the team, or used for model training.

---

## Project Structure

```
FindingFounders/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── requirements.txt
│   ├── .env.example
│   ├── routes/
│   │   ├── upload.py            # POST /api/upload/{user_id}
│   │   └── profile.py           # GET /api/profile/{user_id}/brain-card
│   └── services/
│       ├── vault_parser.py      # Zip extraction + markdown parsing
│       ├── chunker.py           # Heading-aware document chunking
│       ├── embedder.py          # Sentence transformer embeddings
│       ├── vector_store.py      # Pinecone upsert/query/delete
│       └── brain_card.py        # Claude Opus brain card generation
└── frontend/
    ├── app/
    │   ├── page.tsx             # Landing page
    │   ├── upload/page.tsx      # Vault upload flow
    │   └── profile/[userId]/    # Brain card display
    └── ...
```

---

## Getting Started

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in your keys
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
```
ANTHROPIC_API_KEY=sk-ant-...
PINECONE_API_KEY=pcsk-...
PINECONE_INDEX_NAME=finding-founders
```

---

*Built by [@Taran132g](https://github.com/Taran132g)*
