---
archived: 2026-08-06T11:12:29.664082
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\f645c1a7-29aa-477f-b48e-5bee75574bbf\walkthrough.md
---

# Walkthrough: Safe Line-Break Calibration (Concern 2) Implementation

We have implemented the surgical changes for **Safe Line-Break Calibration** in [`backend/converter/pdf_edit.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py).

## Changes Made

### 1. Phase 1 Raw Character Capture
- Captured raw character objects from PyMuPDF `rawdict` inside `erase_rect` during Phase 1 (`if is_paragraph_edit:` block).
- Stored extracted character bounding boxes, origin coordinates, size, and ligature-expanded text under `plan["raw_chars"]` to build exact-width oracles in Phase 3.

### 2. Phase 3 Calibration Scalar (`k_cal`) & Guarded Exact-Width Oracle
- Computed `k_cal` ratio (`_act / _nom`) across non-superscript body runs in the paragraph.
- Applied safety bounds `[0.92, 1.10]`, logging calibration results or resetting to `1.0` if out of bounds.
- Implemented sequence matching (`difflib.SequenceMatcher`) between `_raw_chars` and target text to build `_exact_width(text, j)`.
- Created `_tok_w(text, size, j=None)` wrapper combining nominal font width scaled by `k_cal` with guarded exact character widths for matched original runs.

### 3. Updated Measurement Sites
- Fixed latent `NameError` by replacing `advance_table` / `k_cal` lookup on space width with `space_w = _tok_w(" ", body)`.
- Updated `_unit_width(idx)` to sum token widths via `_tok_w(t["text"], t["size"], t.get("start"))`.
- Updated `_emit_token()` returns and character advances to use `_tok_w` for main font rendering and `* k_cal` for fallback font rendering.
- Updated Pass 1 word-wrap line width (`tw = _tok_w(...)`) and Pass 2 justification natural line width (`nat_w = ...`).

## Verification
- Verified compilation clean with `python -m py_compile backend/converter/pdf_edit.py`.
- No modifications were made to `pdf_routes/editor.py` or any other non-target files.
