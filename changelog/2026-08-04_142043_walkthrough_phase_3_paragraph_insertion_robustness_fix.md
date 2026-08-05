---
archived: 2026-08-04T14:20:43.197376
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\c38fcd32-3b81-4c53-9f32-959e3ed19c28\walkthrough.md
---

# Walkthrough: Phase 3 Paragraph Insertion & Robustness Fix

## Problem
In page 5 of the test document, the conclusion section was redacted (erased) but the text re-insertion failed silently:
1. `Page.insert_textbox()` was called with `fontbuffer=...`, which is **not** a valid keyword argument for `insert_textbox()` in PyMuPDF (throwing `TypeError: Page.insert_textbox() got an unexpected keyword argument 'fontbuffer'`).
2. The fallback chain re-invoked `insert_textbox()` with `fontbuffer=...`, causing all attempts to fail with `TypeError`.
3. The endpoint swallowed errors and returned `200 OK`, leaving a blank white redacted column.

## Fixes Implemented

### 1. Correct `insert_textbox()` Calling Convention
- Removed `fontbuffer` kwarg from `page.insert_textbox()`.
- Added explicit pre-registration call: `page.insert_font(fontname=name, fontbuffer=buf)` before `insert_textbox()`.

### 2. Missing Glyphs Subset Pre-Check
- Added `_check_font_buf_missing_glyphs(font_buf, text)`.
- If the primary font subset is missing glyphs for the edited text, universal fallback font (`figo` / `ubuntu` from `pymupdf-fonts`) is automatically prioritized over the incomplete subset.

### 3. Overflow Detection & Font Size Auto-Shrink
- Checks the return code `rc` from `page.insert_textbox()`.
- If `rc < 0` (text overflowed bounding box height), tries scaled font sizes: `[100%, 95%, 90%, 85%, 80%]`.
- Logs successful insertion details (`font`, `fontsize`, `remaining_height`).

### 4. Transactional Failure Guard
- If all font candidates and font size adjustments fail or overflow, raises `HTTPException(status_code=422)`.
- Guarantees the server will **never** return a 200 OK with a blank white redacted hole.

## Verification
- `pytest backend/test_challenge_pdf_edit.py` → **5/5 passed** (172s).
