"""
Style Analyser & Transformer — FastAPI routes.

Endpoints:
  POST   /api/style/analyse    — analyse writing sample, return Style Profile
  POST   /api/style/transform  — transform text into the user's saved style
  GET    /api/style/profile    — retrieve saved Style Profile
  DELETE /api/style/profile    — delete saved Style Profile
"""
import json
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google.genai import types as genai_types

from core.gemini import get_client, gemini_request_with_retry
from style_routes.prompts import (
    METRIC_SYSTEM_INSTRUCTION,
    METRIC_USER_PROMPT_TEMPLATE,
    SEMANTIC_SYSTEM_INSTRUCTION,
    SEMANTIC_USER_PROMPT_TEMPLATE,
    TRANSFORM_SYSTEM_INSTRUCTION,
    build_transform_prompt,
)
from style_routes.store import save_profile, load_profile, delete_profile

router = APIRouter()

# Use the same model as the rest of the app (analyzer/routes.py uses this)
_MODEL = "gemini-3.1-flash-lite"

# ─── Request / Response Models ────────────────────────────────────────────────

class AnalyseRequest(BaseModel):
    text: str


class TransformRequest(BaseModel):
    text: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _strip_json_fences(raw: str) -> str:
    """Remove markdown code fences that Gemini sometimes wraps JSON in."""
    raw = raw.strip()
    if raw.startswith("```json"):
        raw = raw[7:]
    elif raw.startswith("```"):
        raw = raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]
    return raw.strip()


async def _gemini_json_call(system_instruction: str, user_prompt: str, temperature: float) -> dict:
    """
    Call Gemini and parse the response as JSON.

    Uses the same call pattern as the rest of the app (plain string prompt,
    system instruction prepended, GenerateContentConfig for temperature only).
    Retries once if JSON parsing fails.
    """
    client = get_client(model=_MODEL)

    # Prepend system instruction to the user prompt — same pattern as analyzer/routes.py
    full_prompt = system_instruction + "\n\n" + user_prompt

    config = genai_types.GenerateContentConfig(temperature=temperature)

    response = await gemini_request_with_retry(
        client, full_prompt, model=_MODEL, config=config
    )
    raw = _strip_json_fences(response.text)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Retry once: ask Gemini to fix the malformed JSON
        repair_prompt = (
            "The following text should be valid JSON but failed to parse. "
            "Return it corrected as valid JSON with no other text:\n\n" + raw
        )
        repair_config = genai_types.GenerateContentConfig(temperature=0.0)
        repair_response = await gemini_request_with_retry(
            client, repair_prompt, model=_MODEL, config=repair_config
        )
        repaired = _strip_json_fences(repair_response.text)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Gemini returned malformed JSON that could not be repaired: {exc}",
            )


def _count_words(text: str) -> int:
    return len(re.findall(r"\S+", text))


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/api/style/analyse")
async def analyse_style(req: AnalyseRequest):
    """
    Phase 1 — Analyse a writing sample and generate a full Style Profile.

    Makes two sequential Gemini calls:
      1. Metric extraction (temp 0.1) — objective, countable metrics across all 10 domains
      2. Semantic analysis (temp 0.3) — qualitative patterns, rhetorical moves, idiosyncratic habits

    Merges outputs into a Style Profile and saves it to disk.
    """
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required.")

    word_count = _count_words(text)
    if word_count < 100:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Writing sample is too short ({word_count} words). "
                "Provide at least 200 words for basic analysis; 500+ words for reliable pattern detection."
            ),
        )

    # ── Call 1: Metric Extraction (temperature 0.1) ───────────────────────────
    metric_user_prompt = METRIC_USER_PROMPT_TEMPLATE.format(text=text)
    metrics = await _gemini_json_call(
        system_instruction=METRIC_SYSTEM_INSTRUCTION,
        user_prompt=metric_user_prompt,
        temperature=0.1,
    )

    # ── Call 2: Semantic Analysis (temperature 0.3) ───────────────────────────
    semantic_user_prompt = SEMANTIC_USER_PROMPT_TEMPLATE.format(text=text)
    semantic = await _gemini_json_call(
        system_instruction=SEMANTIC_SYSTEM_INSTRUCTION,
        user_prompt=semantic_user_prompt,
        temperature=0.3,
    )

    # ── Merge and persist ─────────────────────────────────────────────────────
    profile = save_profile(metrics=metrics, semantic=semantic, word_count=word_count)

    return {
        "profile_id": profile["profile_id"],
        "profile": profile,
    }


@router.post("/api/style/transform")
async def transform_text(req: TransformRequest):
    """
    Phase 2 — Transform target text into the user's saved style.

    Loads the saved Style Profile, constructs a dynamic transformation prompt
    from all 10 style domains, calls Gemini (temp 0.5), and returns the result.
    """
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Target text is required.")

    profile = load_profile()
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No style profile found. Please analyse a writing sample first "
                "using POST /api/style/analyse."
            ),
        )

    # ── Build dynamic prompt from all 10 style domains ────────────────────────
    transform_prompt = build_transform_prompt(profile=profile, target_text=text)

    # ── Estimate max output tokens: 3× input word count, min 1000 ────────────
    input_words = _count_words(text)
    max_output_tokens = max(1000, input_words * 3)  # generous — words ≠ tokens

    client = get_client(model=_MODEL)
    config = genai_types.GenerateContentConfig(
        temperature=0.5,
        max_output_tokens=max_output_tokens,
    )

    # Same call pattern as the rest of the app
    full_prompt = TRANSFORM_SYSTEM_INSTRUCTION + "\n\n" + transform_prompt
    response = await gemini_request_with_retry(client, full_prompt, model=_MODEL, config=config)
    transformed_text = response.text.strip()

    output_words = _count_words(transformed_text)

    return {
        "transformed_text": transformed_text,
        "input_word_count": input_words,
        "output_word_count": output_words,
    }


@router.get("/api/style/profile")
async def get_style_profile():
    """Retrieve the current saved Style Profile."""
    profile = load_profile()
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="No style profile found. Analyse a writing sample first."
        )
    return profile


@router.delete("/api/style/profile")
async def delete_style_profile():
    """Delete the saved Style Profile."""
    deleted = delete_profile()
    if not deleted:
        raise HTTPException(status_code=404, detail="No style profile to delete.")
    return {"success": True}
