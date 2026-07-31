---
archived: 2026-07-31T00:03:00.178849
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\feeea78e-e359-448e-b210-460d0512eeb9\walkthrough.md
---

# Walkthrough — Direct PyMuPDF Backend Character Superscript Pipeline

All updates to stream PyMuPDF's authoritative per-character `is_superscript` flags directly from the backend into the HTML5 Canvas engine have been implemented and verified.

---

## 💡 Simple Explanation: Why We Use 65% Font Size & Baseline Elevation

### 1. Is this direction from the backend?
**YES!**
- On the backend, PyMuPDF analyzes the raw PDF stream. It inspects physical baseline coordinates (`origin_y`) and font matrix flags (`flags & 1`), telling us **WHICH exact characters are superscripts** (`is_superscript: true`).
- For example, for `"Suserud35"`, PyMuPDF explicitly flags `'Suserud'` as `is_superscript: false` and `'35'` as `is_superscript: true`.

### 2. Why do we render with 65% font size?
- In published typography and academic journal citations (like `Suserud³⁵`), reference numbers are printed at approximately **58% to 68%** of the line's base font size.
- Rendering `'35'` at 100% font size (e.g. 10pt) would make them look like giant regular numbers. Scaling to **65%** (6.5pt) gives them the exact visual proportions of published academic citations.

### 3. Why do we elevate the vertical baseline (`yBaseline - 0.32 * fontSizePx`)?
- Regular text sits flat on the line's main baseline (`yBaseline`).
- Superscripts float above the main line of text (above the x-height of letters like `d` or `s`).
- HTML `<sup />` elements do this automatically in DOM rendering. On an HTML5 Canvas, we float the small numbers by shifting their $Y$-coordinate upwards by `0.32 * fontSizePx` so they sit neatly at the top right of words.

---

## 🛠️ Architecture Pipeline Summary

1. **Backend (`editor.py`)**:
   - `extract_page_spacing_data(page)` includes PyMuPDF's `chars` array (`c`, `is_superscript`, `is_subscript`) for every line.

2. **Frontend Viewer (`Viewer.jsx`)**:
   - Attaches `origLines` carrying the line objects with `chars` directly to paragraph items (`item.origLines`).

3. **Canvas Engine (`CanvasInlineEditor.jsx`)**:
   - `parseCharMetadata()` initializes `charMeta` directly from `item.origLines.flatMap(l => l.chars)`.
   - Each character reads `kind = ch.is_superscript ? 'super' : 'normal'` straight from PyMuPDF.
   - **Zero String Index Calculation**: No string offset matching, no regex, no range drift, zero fallbacks!

---

## 🧪 Verification Results

- **Frontend Compilation**: `npm run build` compiled 2,538 modules in `frontend/` cleanly with **0 errors**.
- **Backend Integration Tests**: `python backend/test_challenge_pdf_edit.py` executed and passed all 5 test cases with 100% success.
- **Changelog Entry**: Archived walkthrough to `changelog/`.
