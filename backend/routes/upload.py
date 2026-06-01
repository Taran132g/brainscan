from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import JSONResponse
from services.auth import verify_user_owns_path
from services.ingest import ingest_vault

router = APIRouter()


@router.post("/upload/{user_id}")
def upload_vault(
    file: UploadFile = File(...),
    github_username: Optional[str] = Form(default=None),
    linkedin_url: Optional[str] = Form(default=None),
    user_id: str = Depends(verify_user_owns_path),
):
    # NOTE: sync `def` (not async) so FastAPI runs this heavy, multi-minute job
    # in a worker thread — a big vault upload no longer blocks /health or the
    # rest of the single-worker API.
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload must be a .zip file")

    zip_bytes = file.file.read()
    result = ingest_vault(
        user_id,
        zip_bytes,
        github_username=github_username,
        linkedin_url=linkedin_url,
    )
    return JSONResponse(result)
