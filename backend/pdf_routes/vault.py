from fastapi import APIRouter, HTTPException, File, UploadFile, Form
from fastapi.responses import FileResponse
import os
from converter.font_vault import VAULT_DIR, vault_ingest, vault_list, root_family

router = APIRouter()

@router.get("/font/{filename}")
async def vault_font(filename: str):
    filename = os.path.basename(filename)                     # path-traversal guard
    for sub in ("full", "buffers", "subsets"):
        p = VAULT_DIR / sub / filename
        if p.exists():
            return FileResponse(p, media_type="font/otf", headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": "*"})
    raise HTTPException(status_code=404, detail="Font not found")

@router.get("/manifest")
async def vault_manifest():
    return vault_list()

@router.post("/register")          # manual upload of a licensed full font
async def vault_register(file: UploadFile = File(...), family: str = Form(...),
                         license: str = Form("local-install (do not redistribute)"),
                         stand_in_for: str = Form(None)):
    buf = await file.read()
    vault_ingest(family, os.path.basename(file.filename), buf,
                 fmt="otf" if buf[:4] == b"OTTO" else "ttf",
                 license=license, full=True, stand_in_for=stand_in_for)
    return {"ok": True, "family": root_family(family)}
