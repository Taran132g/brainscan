from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.upload import router as upload_router
from routes.profile import router as profile_router
from routes.auth import router as auth_router
from routes.match import router as match_router
from routes.payment import router as payment_router
from routes.github import router as github_router
from routes.linkedin import router as linkedin_router
from routes.scan import router as scan_router
from routes.plugin import router as plugin_router

app = FastAPI(title="BrainScan API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://findingfounders.app",
        "https://www.findingfounders.app",
    ],
    # Vercel deploys (preview + production *.vercel.app) — covers the live URL
    # before the custom domain is attached.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router, prefix="/api", tags=["vault"])
app.include_router(profile_router, prefix="/api", tags=["profile"])
app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(match_router, prefix="/api", tags=["match"])
app.include_router(payment_router, prefix="/api", tags=["payment"])
app.include_router(github_router, prefix="/api", tags=["github"])
app.include_router(linkedin_router, prefix="/api", tags=["linkedin"])
app.include_router(scan_router, prefix="/api", tags=["scan"])
app.include_router(plugin_router, prefix="/api", tags=["plugin"])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")
