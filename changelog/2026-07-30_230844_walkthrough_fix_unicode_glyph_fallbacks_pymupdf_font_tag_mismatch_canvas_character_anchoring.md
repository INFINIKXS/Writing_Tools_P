---
archived: 2026-07-30T23:08:44.702691
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\feeea78e-e359-448e-b210-460d0512eeb9\walkthrough.md
---

# Walkthrough — Fix Unicode Glyph Fallbacks, PyMuPDF Font Tag Mismatch & Canvas Character Anchoring

All three issues (Unicode superscript font fallback contractions, PyMuPDF `Ptr List creation failed` font tag mismatch, and Canvas character anchoring) have been resolved and verified.

---

## Technical Summary of Fixes

### 1. PyMuPDF Font Key Capture ([pdf_edit.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py))
- **Internal Font Reference Key (`font_key`)**: Updated Phase 2.5 font re-registration to capture the return value of `font_key = page.insert_font(fontname=fontname, fontbuffer=font_buffer)` (e.g. `'F0'`, `'F1'`).
- **Tag Mapping**: Mapped `font_tag_map[fontname] = font_key` so `plan["fontname"]` and `op["fontname"]` pass PyMuPDF's internal reference tag to `insert_textbox()` and `insert_text()`, completely resolving `Ptr List creation failed` / `(null)` font key errors.

### 2. Unicode Superscript Normalization ([editor.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/pdf_routes/editor.py) & [CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))
- **Backend Normalization**: Added `UNICODE_SUPER_MAP` and `normalize_pdf_text()` in `editor.py` converting Unicode superscript digits (`⁰`–`⁹`) to standard ASCII digits (`0`–`9`).
- **Frontend Normalization**: Updated `parseCharMetadata()` in `CanvasInlineEditor.jsx` to map Unicode superscripts to ASCII digits while setting `kind: 'super'`. This prevents custom embedded fonts (`NewBaskerville-Roman`) from falling back to system fonts or triggering font width contractions on characters like `³³ ³⁵ ³⁶`.

### 3. Absolute Span-X Anchoring & Elevated Baseline ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))
- **Span-X Positioning**: Extracted `span` metadata from `item.spans` or line spans and calculated relative X positions `(span.bbox[0] - item.pdfX) * scale` during line character layout calculation.
- **Superscript Elevation**: Adjusted superscript baseline elevation to `line.yBaseline - (0.2 * baseFontSizePx)`, ensuring citations like `Bruce and Suserud³⁵` render cleanly without overlapping adjacent characters.

---

## Verification Results

- **Frontend Compilation**: `npm run build` compiled 2,538 modules in `frontend/` cleanly with **0 errors**.
- **Backend Integration Tests**: `python backend/test_challenge_pdf_edit.py` executed and passed all 5 test cases cleanly.
- **Changelog**: Archived walkthrough entry to `changelog/`.
