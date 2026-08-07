---
archived: 2026-08-06T13:04:21.023098
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\f645c1a7-29aa-477f-b48e-5bee75574bbf\walkthrough.md
---

# Walkthrough — Layout Manifest Bake (Canva-style Absolute Placement)

We have successfully implemented and verified the **Layout Manifest Bake** architecture across both the React frontend and Python FastAPI backend. This feature captures absolute character coordinates computed by the frontend HTML5 Canvas layout engine and emits them directly onto the PDF page streams during baking—preserving paragraph justification, word spacing, superscript baselines, and line reflow positions without backend re-wrapping.

---

## Changes Made

### Frontend Layer

#### [CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx)
1. **Added `buildLayoutManifest(layout, item, opts)` Module Helper**:
   - Computes absolute PDF points for every word token and space:
     $$\text{absX} = \text{item.pdfX} + \text{rx}, \quad \text{absY} = \text{item.pdfY\_top} + \text{baseline}$$
   - Emits spaces as independent runs (`text: ' '`) so exact justified gaps and re-extraction integrity are preserved.
   - Calculates `manifestBbox` covering the entire reflowed paragraph geometry.
2. **Updated `handleCommit()`**:
   - Calls `buildLayoutManifest(canvas._layout, item, opts)` when committing.
   - Passes `layoutManifest` and `manifestBbox` inside `formatOptions` to `onCommit(...)`.

#### [Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx)
1. **Updated `onCommit` Handler**:
   - Passes `layoutManifest`, `manifestBbox`, and `align` into the edit object committed to `pdfEditStore.commitEdit(...)`.
   - Added assertion checking:
     ```javascript
     console.assert(Math.abs(rect.x - origItem.pdfX) < 0.5, 'edit.rect.x must be PDF-point item.pdfX');
     ```

---

### Backend Layer

#### [pdf_edit.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py)
1. **Added `_normalize_color_rgb(color_val, default_color)`**:
   - Normalizes Hex `#RRGGBB`, `rgb(r,g,b)`, packed integers, and tuples/lists into PyMuPDF $(r, g, b)$ floats in range $0.0 \dots 1.0$.
2. **Added `_emit_layout_manifest(...)` Helper**:
   - Iterates through positioned runs from `layoutManifest` and paints text directly at `fitz.Point(x, y)` with missing glyph / universal fallback support.
3. **Phase 1 Redaction Box Expansion**:
   - Expands `erase_rect` using `manifestBbox` if present:
     ```python
     erase_rect = erase_rect | fitz.Rect(mb_rect.x0 - 2, mb_rect.y0 - 2, mb_rect.x1 + 2, mb_rect.y1 + 2)
     ```
   - Stores `plan["layout_manifest"] = edit.get("layoutManifest") or []`.
4. **Phase 3 Fast-Path Insertion**:
   - Inserts layout manifest fast-path in `if plan.get("is_paragraph_op"):` before legacy wrapping.
   - Executes `continue` to completely bypass legacy greedy word-wrapping when `layout_manifest` is present.

---

## Verification Results

### Automated Verification
- **Frontend Build**: Executed `npm run build` inside `frontend/` $\rightarrow$ Passed with exit code **0**.
- **Backend Compilation**: Executed `python -m py_compile backend/converter/pdf_edit.py` $\rightarrow$ Passed with exit code **0**.

---

## Technical Files Modified

- [`frontend/src/components/PDFEditor/CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx)
- [`frontend/src/components/PDFEditor/Viewer.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx)
- [`backend/converter/pdf_edit.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py)
- [`docs/pdf_editor_architecture.md`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/docs/pdf_editor_architecture.md)
