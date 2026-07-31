---
archived: 2026-07-30T23:42:32.865070
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\feeea78e-e359-448e-b210-460d0512eeb9\walkthrough.md
---

# Walkthrough — Fix Duplicate Font Extractions & 100% Canvas Paragraph Justification

All root causes for duplicate font extractions (`/api/pdf/extract-fonts`) and un-justified Canvas paragraph text have been identified, fixed, and verified across `Viewer.jsx` and `CanvasInlineEditor.jsx`.

---

## Root Causes & Technical Solutions

### 1. Duplicate Font Extraction Fix ([Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx))
- **Root Cause**: When a PDF edit was committed, `PDFEditorPage.jsx` updated `currentFile` with a new baked PDF blob URL (`blob:http://...`). This updated `Viewer.jsx`'s `file` prop, re-triggering `useEffect([file])` and causing `/api/pdf/extract-fonts` to be called a second time.
- **Solution**: Added `extractedFontsRef` in `Viewer.jsx` to track whether font extraction has already executed for the document session. When `file` updates to a live preview blob URL, `extractFonts()` is safely skipped.

### 2. Canvas Text Justification & Rich Line Metrics ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx) & [Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx))
- **Root Cause**:
  1. `Viewer.jsx` passed `lines` on paragraph items as plain string arrays (`['In addition to...']`), causing `typeof lineData === 'object'` in `CanvasInlineEditor.jsx` to evaluate to `false`.
  2. In the fallback justification calculation, a restrictive check (`deficit < boxWidth * 0.25`) was rejecting lines where deficit was $> 25\%$ of box width (e.g. 57px deficit on 207px box), setting `extraPerSpace = 0` and leaving lines un-justified.
- **Solution**:
  1. **Rich Line Objects**: Updated `Viewer.jsx` to supply rich line metric objects (`lines: sgLines.map(l => ({ text: l.str, width: l.pdfW }))`).
  2. **Justification Deficit Fix**: Updated `pushLine()` in `CanvasInlineEditor.jsx` so that for all non-last lines of a justified paragraph (`!isLastLineOfParagraph`), `extraPerSpace` is ALWAYS computed as `deficit / spaceCount` for any positive deficit (`deficit > 0`).

---

## Verification Results

- **Frontend Compilation**: `npm run build` completed with **0 errors** across 2,538 modules.
- **Backend Test Suite**: `python backend/test_challenge_pdf_edit.py` executed and passed all 5 test cases with 100% success.
- **Changelog Entry**: Archived walkthrough entry to `changelog/`.
