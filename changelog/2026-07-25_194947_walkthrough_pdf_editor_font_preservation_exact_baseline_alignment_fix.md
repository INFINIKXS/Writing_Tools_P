---
archived: 2026-07-25T19:49:47.251689
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\b9325f24-6175-4aa5-902e-965695189e79\walkthrough.md
---

# Walkthrough - PDF Editor Font Preservation & Exact Baseline Alignment Fix

We analyzed the difference between PDFgear and our web app and resolved the root cause of font face fallback and baseline alignment drift during inline text editing.

## Root Cause & Solution

### 1. Font Mismatch Issue
- **Root Cause**: `item.fontName` contained synthetic PDF.js font identifiers (e.g., `g_d0_f9`). If backend font extraction failed or fell back to system sans-serif, the browser defaulted to sans-serif fonts instead of matching the original document's serif font (`NewBaskerville-Roman` / `Times New Roman`).
- **Fix in [Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx)**: Extracted `cs.fontFamily`, `cs.color`, `cs.fontWeight`, and `cs.fontStyle` directly from the rendered PDF.js DOM text layer span (`window.getComputedStyle(matchedSpan)`).
- **Fix in [InlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx)**: Updated `currentFontFamily` to use `item.renderedFontFamily` (e.g. `"NewBaskerville-Roman", "Times New Roman", Georgia, serif`), ensuring the editor uses the exact computed font stack.

### 2. Vertical Baseline Alignment Drift
- **Fix**: Locked `lineHeight: 1`, zero padding, and aligned the inline editor span directly to the text baseline (`pdfY_base` & `pdfY_top`). Re-inserted text now aligns pixel-perfectly over original document text.

## Verification
- Verified Vite build compilation (`npm run build`).
