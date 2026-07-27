---
archived: 2026-07-25T23:09:26.692703
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\b9325f24-6175-4aa5-902e-965695189e79\walkthrough.md
---

# Walkthrough - Backend-Authoritative Block Alignment Extraction

We implemented **Backend-Authoritative Block Alignment** so paragraph alignment is calculated directly by Python (`PyMuPDF`) during layout extraction:

## 1. Python Backend Alignment Detector ([backend/pdf_routes/editor.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/pdf_routes/editor.py))
- Evaluated line coordinates (`line_x0`, `line_x1`) against paragraph column boundaries (`block_x0`, `block_x1`) inside `extract_page_spacing_data`.
- Calculated whether a block is `justify`, `left`, `center`, or `right` based on whether non-final lines touch both left and right margins.
- Returned `"align": "justify" | "left" | "center" | "right"` in the `/api/pdf/extract-spacing` response.

## 2. Frontend Alignment Consumption ([Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx) & [InlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx))
- `Viewer.jsx` attaches `align: blockData.align` to each `paragraphItem`.
- `InlineEditor.jsx` applies `textAlign: item.align`, removing hardcoded frontend assumptions and ensuring alignment is authoritatively driven by the backend.

## Verification
- Verified Vite frontend compilation (`npm run build`).
