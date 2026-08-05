---
archived: 2026-08-04T19:18:56.212341
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\5f57d800-5999-4c52-8dab-7606bfdf70bb\walkthrough.md
---

# Bake Engine Fidelity Fixes v2 Walkthrough

## Summary of Changes

### TASK A — `backend/converter/font_utils.py`: Bare PostScript Name Fix (Font Drift Root Cause)

- **Root Cause Identified**: `wrap_cff_in_otf` was writing full or family-derived strings into CFF Top DICT `FullName` / `FamilyName` and OTF nameID 4 & 6. PyMuPDF's BaseFont length limit (31 chars) truncated `"ABCDEF+" + "NewBaskerville-Roman Regular"` (35 chars) down to `ABCDEF+NewBaskerville-Roman Reg`. On second extraction, the frontend received `NewBaskerville-Roman Reg`, causing `@font-face` lookup failures and CSS font fallback.
- **Fix Implemented**:
  1. Compute `bare = re.sub(r'^[A-Z]{6}\+', '', basefont_name)` (strip 6-letter subset prefix).
  2. Set CFF Top DICT `FullName = bare` and `FamilyName = bare` verbatim (no style words like `" Regular"` appended).
  3. Set OTF `name` table nameID 4 and nameID 6 = `bare` verbatim.
  4. Updated sanity check to compare against `bare` (`Wrapped OTF font name sanity check ✓: 'NewBaskerville-Roman' (expected 'NewBaskerville-Roman')`).
- **Frontend Normalization (`CanvasInlineEditor.jsx`, `InlineEditor.jsx`, `DebugOverlay.jsx`)**:
  - Extended `sanitizeFontName` to strip trailing style tokens (`Regular`, `Reg`, `Bold`, `Italic`, `Oblique`) and normalize hyphens: `name.replace(/\s*-\s*/g, '-').replace(/\s+(Regular|Reg|Bold|Italic|Oblique)$/i, '')`.

### TASK B — `backend/converter/pdf_edit.py`: Justified Emission Pipeline for RUN-SEG Path

- Replaced single-pass emission loop with a two-pass **wrap → justify → emit** pipeline:
  - **`_detect_justify()`**: Checks if `plan["align"] == "justify"` (authoritative from frontend), or inspects original run bounding boxes to detect if ≥70% of non-last lines hit the right margin within 2pt tolerance.
  - **Pass 1 (Line Wrapping)**: Wraps tokens into `out_lines` using `_unit_width` and `token["break_ok"]`.
  - **Pass 2 (Justification & Emission)**:
    - Calculates natural width of line tokens and space count `n_sp`.
    - Distributes deficit width evenly across spaces via `extra_per_space = deficit / n_sp` for all non-last lines when `is_justify` is True.
    - Emits tokens with `_emit_token` using adjusted space advances (`space_w + extra_per_space`).

### TASK C — Frontend Alignment Pass-Through & Backend Plan Integration

- **Frontend (`CanvasInlineEditor.jsx`)**: Updated `handleCommit` to include `align: blockAlign` in the options payload sent to `onCommit`.
- **Backend (`pdf_edit.py`)**: Added `plan["align"] = (edit.get("align") or "").lower()` to store authoritative alignment in the paragraph plan.

## Verification

- **Python Syntax Check**: `pdf_edit.py`, `font_utils.py`, and `editor.py` compiled with exit code 0.
- **Automated Tests**: `pytest backend/test_challenge_pdf_edit.py` — 5/5 tests passed (100%).
