---
archived: 2026-07-25T20:19:54.836854
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\b9325f24-6175-4aa5-902e-965695189e79\walkthrough.md
---

# Walkthrough - Font Weight Calibration & Multi-Line Edit Fix

We diagnosed and resolved both issues reported from the editing logs and visual preview:

## 1. Font Weight / "Blacker" Text Fix
- **Root Cause**: In [Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx), Chrome's `window.getComputedStyle(matchedSpan)` returned `fontWeight: "700"` (bold) for PDF.js text layer spans even when the underlying embedded font (`NewBaskerville-Roman`) was regular weight. This overwrote `item.isBold = false` with `isBold = true` and forced the backend to insert text in bold weight.
- **Fix**: Updated [Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx) so browser computed style never overrides PyMuPDF's authoritative backend font flags (`item.isBold` / `item.isItalic`). The edited text now matches the exact regular weight of surrounding text.

## 2. Multi-Line Edit & Cross-Column Redaction Mismatch Fix
- **Root Cause**: In multi-column journal PDFs (like BMJ Open), two different blocks (e.g. left metadata sidebar vs main article text) can share baselines within ~2 points ($y=294.4$ vs $y=296.3$). `_measure_span_width` matched candidate spans purely by $y$-coordinate without verifying if the span's text matched `origStr` (the text the user clicked to edit). This caused the second edit to match the sidebar text `'and additional supplemental '` instead of line 15, erasing sidebar text and failing to edit the target line.
- **Fix**: Added `expected_text` fuzzy sequence matching to `_measure_span_width` in [pdf_edit.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py). If the primary baseline text doesn't match `expected_text`, the backend automatically scans neighboring baselines ($\pm 12\text{pt}$) to find the exact matching text line before performing minimal-diff redaction.

## Verification
- Both frontend (`npm run build`) and Python backend components verified.
