---
archived: 2026-07-30T21:59:57.578498
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\feeea78e-e359-448e-b210-460d0512eeb9\walkthrough.md
---

# Walkthrough — Fix Canvas Text Editing Line-Drift & PyMuPDF Re-Serialization Ghosting

The horizontal line-wrap drift during active canvas editing and the PyMuPDF re-serialization ghosting / paragraph block breakdown upon export have been resolved.

---

## Technical Changes Implemented

### 1. Frontend Line Layout Engine & Line Preservation ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))
- **Explicit Line Break Preservation**: `text` state is initialized via `getInitialText()` using explicit newline separators (`\n`) from `item.lines` or `item.rawPdfLines`.
- **Line-Aware Layout Calculator**: Refactored `computeLineLayout()` to split text by explicit newlines (`text.split('\n')`). Soft wrapping occurs only if user typing causes a line to overflow `boxWidth`.
- **Space Justification**: Calculates width deficit (`deficit = boxWidth - rawLineWidth`) and distributes `extraPerSpace` across spaces on non-final paragraph lines.
- **Payload Commitment**: Updated `handleCommit()` in `CanvasInlineEditor.jsx` and `Viewer.jsx` to compute line strings (`computedLines = canvas._layout.lines.map(l => l.text)`) and pass `lines: computedLines` to `pdfEditStore.commitEdit()`.

### 2. Backend PyMuPDF Re-Serialization ([pdf_edit.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py))
- **Line Array Payload Capture**: Extracted `lines = edit.get("lines", [])` from the frontend payload and stored it in `plan["lines"]`.
- **Explicit Newline Formatting**: Formatted `paragraph_text = "\n".join(lines)` when `lines` is present, forcing PyMuPDF to respect Canvas line breaks during re-serialization.
- **Justified Text Box Insertion**: Invoked `page.insert_textbox()` with `align=fitz.TEXT_ALIGN_JUSTIFY` and the newline-joined `paragraph_text`.

---

## Verification Results

- **Frontend Compilation**: `npm run build` completed with **0 errors** across 2,538 modules.
- **Backend Test Suite**: `python backend/test_challenge_pdf_edit.py` executed and passed all 4 test cases (Plain text, Superscript same-text, Superscript diff-text, and Paragraph edit with lines array) with 100% success.
- **Line Count & Paragraph Preservation**: Verified that 16-line paragraphs maintain exact 16-line geometry without horizontal drift or ghosting upon PDF reload.
