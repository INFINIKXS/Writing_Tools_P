---
archived: 2026-08-05T19:19:38.199109
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\5f57d800-5999-4c52-8dab-7606bfdf70bb\walkthrough.md
---

# Soft Hyphen (U+00AD) Filtering & Sanity Check Alignment

## Summary

This update fixes double hyphen rendering (`person--centred`), font fallback triggers (FiraGO font fallback due to `['\xad']`), and false-positive sanity check warnings (`sanity check ✗`) by stripping soft hyphens (`U+00AD`) across all extraction, editing, and rendering layers, and relaxing the sanity check to accept PyMuPDF's composed font names.

## Key Changes

### A. [`backend/converter/font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py)
1. **`_find_missing_glyphs`**: Added `text = text.replace("\u00AD", "")` at the top of the function so break hints do not trigger glyph missing warnings or universal font fallbacks.
2. **Sanity Check Alignment**: Updated `wrap_cff_in_otf` post-serialization check to test `check_font.name in {bare, f"{bare} {subfamily}"}` to account for PyMuPDF returning `"NewBaskerville-Roman Regular"`.

### B. [`backend/converter/pdf_edit.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py)
1. **`_check_font_buf_missing_glyphs`**: Added `text = text.replace("\u00AD", "")`.
2. **`apply-edits` Text Cleaning**: Added `.replace("\u00AD", "")` to `new_text` and `orig_text`.
3. **Span Runs & Character Extraction**:
   - In `_span_runs_in_rect`: filtered `c.get("c") != "\u00AD"` when concatenating span text.
   - In `rawdict_chars` extraction: filtered out `c.get("c") == "\u00AD"`.

### C. [`frontend/src/components/PDFEditor/CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx)
1. **`expandMultiCharEntries`**: `if (c === '\u00AD') continue;` skips soft hyphens from being anchored or rendered in the canvas editor.
2. **`parseCharMetadata` & `getInitialText`**: Added `.replace(/\u00AD/g, '')` to strip soft hyphens at ingestion.
3. **`sanitizeForCommit`**: Added `.replace(/\u00AD/g, '')` to ensure soft hyphens are never emitted back to the backend.

## Verification Matrix

| Check | Expected Result | Status |
|---|---|---|
| `py_compile font_utils.py` & `pdf_edit.py` | Exit 0 | ✅ PASSED |
| `pytest backend/test_challenge_pdf_edit.py` | 5/5 passed | ✅ PASSED |
| Wrapped OTF sanity check | `sanity check ✓: 'NewBaskerville-Roman Regular'` | ✅ Verified |
| Soft hyphen glyph check | `\xad` ignored in missing glyphs check | ✅ Verified |
| Canvas inline editor | Single `-` rendered; soft hyphen dropped | ✅ Verified |
