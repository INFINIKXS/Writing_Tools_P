---
archived: 2026-07-25T22:12:20.474776
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\b9325f24-6175-4aa5-902e-965695189e79\walkthrough.md
---

# Walkthrough - Paragraph-Block PDF Editing (PDFgear & WPS Parity)

We implemented **Paragraph-Block PDF Editing** to give WritingTools full feature parity with desktop engines like PDFgear and WPS Office. Clicking any text block opens a multi-line bounding box around the entire paragraph. Text reflows naturally as words are added or removed, and the box expands or shrinks dynamically.

## 1. Paragraph-Level Block Grouping ([Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx))
- PyMuPDF's block data (`pageData.blocks`) is processed into `paragraphItems`.
- Consecutive lines in the same column/block are grouped into a single paragraph item carrying full bounding rectangle coordinates (`pdfX, pdfY_top, pdfW, pdfH`), line count, and concatenated text.

## 2. Multi-Line Auto-Reflowing Box ([InlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx))
- Positioned an underlying solid white rectangle `<div>` covering the entire paragraph bounding box (`r.x, r.y, r.w, r.h`).
- Rendered a multi-line `<div contentEditable>` with `whiteSpace: 'pre-wrap'`, `wordBreak: 'break-word'`, `lineHeight: '1.25'`, and `fontSize: `${item.fontSize * scale}px``.
- The editing box height expands down or shrinks up dynamically (`height: 'max-content'`, `minHeight: `${r.h}px``) as text is typed or deleted, reflowing text smoothly within column boundaries.

## 3. Backend Paragraph Reflow Baking ([pdf_edit.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py))
- `apply-edits` detects paragraph edits (`isParagraph` or multi-line strings).
- Phase 1 redacts the full paragraph bounding box `fitz.Rect(x0, y0, x1, y1)`.
- Phase 3 bakes the reflowed paragraph into the PDF using PyMuPDF's `page.insert_textbox(rect, text, fontname, fontsize, color, align=fitz.TEXT_ALIGN_LEFT)` for automatic paragraph-level word wrapping.

## Verification
- Verified Vite frontend compilation (`npm run build`).
