"""
Writing Tools API — Slim entry point.

All domain logic has been refactored into subpackages:
    core/       — config, Gemini client, retry logic
    utils/      — text extraction, text utilities
    citations/  — detection, deduplication, extraction, ordering, verification, formatting, routes
    references/ — metadata extraction, parser, routes
    converter/  — document conversion routes (PDF↔Word, OCR, merge, compress, etc.)

This file:
  1. Creates the FastAPI app with CORS middleware
  2. Includes all domain routers
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import logging

# Silence fontTools internals (the "'created' timestamp" warnings)
logging.getLogger("fontTools").setLevel(logging.ERROR)

# Suppress health-poll routes from uvicorn access log
class _AccessFilter(logging.Filter):
    _QUIET = ("/api-key-usage", "/api/style/profile")
    def filter(self, rec):
        return not any(p in rec.getMessage() for p in self._QUIET)
logging.getLogger("uvicorn.access").addFilter(_AccessFilter())

# Verbose opt-in: PDF_VERBOSE=1 restores all detail
if os.environ.get("PDF_VERBOSE") == "1":
    for _n in ("pdf_routes.editor", "converter.font_utils", "converter.pdf_edit"):
        logging.getLogger(_n).setLevel(logging.DEBUG)

# ─── App creation ─────────────────────────────────────────────────────────

app = FastAPI(title="Writing Tools API")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type", "Content-Length"],
)

# ─── Include domain routers ──────────────────────────────────────────────
from citations.routes import router as citations_router
from references.routes import router as references_router

from converter import router as converter_router
from analyzer.routes import router as analyzer_router
from style_routes import router as style_router
from vocabularybank_routes import router as vocabularybank_router

app.include_router(citations_router)
app.include_router(references_router)

app.include_router(converter_router)
app.include_router(analyzer_router)
app.include_router(style_router)
app.include_router(vocabularybank_router)

from pdf_routes.editor import router as pdf_editor_router
app.include_router(pdf_editor_router, prefix="/api/pdf")
from converter.pdf_edit import router as pdf_inline_edit_router
app.include_router(pdf_inline_edit_router, prefix="/api/pdf")
from pdf_routes.vault import router as pdf_vault_router
app.include_router(pdf_vault_router, prefix="/api/pdf/vault")


# ─── Backward-compatibility re-exports ───────────────────────────────────
from core.gemini import get_client, gemini_request_with_retry          # noqa: F401
from citations.formatting import format_reference                       # noqa: F401


# ─── Dev server entry point ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
