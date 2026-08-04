---
archived: 2026-08-04T00:43:00.235734
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\0bea45e7-01a1-41f7-b0fa-333dbbd7bdd6\walkthrough.md
---

# PDF Editor Ligature Resolution Walkthrough

Resolved the missing `'i'` ligature bug in the PDF Editor feature where words containing typographic ligatures like `fi` and `ffi` rendered as `"f nal"` and `"suff ciently"`.

## Summary of Changes

### Backend Changes

#### 1. [backend/pdf_routes/editor.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/pdf_routes/editor.py#L38-L61)
- **Unicode NFKC Normalization & Fallback Ligature Map**: Updated `normalize_pdf_text()` to run `unicodedata.normalize('NFKC', text)` and fallback replacements for `\uFB00`–`\uFB06` (`ff`, `fi`, `fl`, `ffi`, `ffl`, `ft`, `st`).
- **PyMuPDF Ligature Decomposition**: Configured `_extract_all_lines()` to pass extraction flags excluding `fitz.TEXT_PRESERVE_LIGATURES` (`flags = fitz.TEXTFLAGS_TEXT & ~fitz.TEXT_PRESERVE_LIGATURES`), forcing PyMuPDF to extract decomposed constituent characters.

### Frontend Changes

#### 2. [frontend/src/components/PDFEditor/CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx#L189-L225)
- **Single-Codepoint Ligature Expansion**: Added `LIGATURE_MAP` and updated `expandMultiCharEntries()` to expand single-codepoint Unicode ligatures (`\uFB00`–`\uFB06`) into per-character objects with interpolated `x0`, `x1`, and `origin_x` coordinates, ensuring 1-to-1 character index matching.

#### 3. [frontend/src/components/PDFEditor/Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx#L61-L76)
- **Decomposed Ligature Gap Guard**: Added a `gap <= 0` check in `groupCharsIntoWords()` to prevent zero or negative character gaps from decomposed ligature components from triggering false word breaks and inserting unwanted spaces into words.

---

## Verification Results

1. **Ligature Normalization Test**:
   - `normalize_pdf_text("given \uFB01nal approval... participated suf\uFB03ciently")` correctly outputs `"given final approval... participated sufficiently"`.
2. **PyMuPDF Extraction**:
   - Spacing extraction API (`/api/pdf/extract-spacing`) extracts character metrics with decomposed constituent characters.
3. **Frontend Word Building**:
   - Word segmentation in `Viewer.jsx` keeps `"final"` and `"sufficiently"` as single word tokens without space injection.
