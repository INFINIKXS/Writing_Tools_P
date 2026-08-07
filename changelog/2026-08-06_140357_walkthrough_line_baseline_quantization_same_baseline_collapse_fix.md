---
archived: 2026-08-06T14:03:57.537294
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\f645c1a7-29aa-477f-b48e-5bee75574bbf\walkthrough.md
---

# Walkthrough — Line Baseline Quantization & Same-Baseline Collapse Fix

We have implemented and verified the fixes for post-bake paragraph region fragmentation and double-space text extraction corruption.

---

## Changes Made

### 1. Frontend Line Baseline Quantization & Space Run Fix ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))
- **Quantized Baseline Y**: Added `const lineBaseAbs = Math.round((blockY + line.yBaseline) * 100) / 100;` before the character loop in `buildLayoutManifest()`.
- **Character Y Assignment**: Set `absY = lineBaseAbs;` for all normal characters on a line so every normal run on a visual line shares the exact same Y coordinate. Superscripts/subscripts use `Math.round((blockY + runBaseline(cm, line)) * 100) / 100;`.
- **Single Space Emission**: Space characters attach to an active preceding run (`run.text += ' '`) or start a single space run, and `continue` to ensure spaces are never emitted twice.

### 2. Backend Same-Baseline Line Collapse Post-Pass ([editor.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/pdf_routes/editor.py))
- Added a same-baseline line collapse post-pass at the end of `_extract_all_lines` in [`editor.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/pdf_routes/editor.py#L717-L741).
- Lines sharing a baseline within $\pm 0.6\text{pt}$ and vertical overlap are collapsed into single lines, re-sorting characters by $x_0$ and rebuilding line bounds and space counts.
- Ensures PyMuPDF always reports a visual line as a single `rawdict` line so `_cluster_free_lines` never encounters mid-line fragment splits.

---

## Verification Results

1. **Frontend Build**: `npm run build` $\rightarrow$ **Passed (Exit code 0)**.
2. **Backend Compilation**: `python -m py_compile backend/pdf_routes/editor.py` $\rightarrow$ **Passed (Exit code 0)**.
3. **Backend Test Suite**: `pytest backend/test_heal_rect_splits.py` $\rightarrow$ **100% Passed (6/6 tests passed)**.
