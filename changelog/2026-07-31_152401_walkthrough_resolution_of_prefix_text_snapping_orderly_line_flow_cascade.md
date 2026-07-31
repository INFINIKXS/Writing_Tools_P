---
archived: 2026-07-31T15:24:01.798310
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\855d83d6-0b33-4a8a-8175-8c2cdbb38a19\walkthrough.md
---

# Walkthrough: Resolution of Prefix Text Snapping & Orderly Line Flow Cascade

## Root Cause Discovered & Resolved

### 1. Root Cause Analysis
When editing mid-sentence (typing `g` in `We` on Line 2):
- **Condition Flaw:** Previously, `usePdfCoords` was evaluated per-line and turned `false` as soon as any character edit occurred on that line.
- **Backwards Snapping:** When `usePdfCoords` became `false`, unedited leading words (`involve the transfer of responsibility.31`) collapsed back to un-justified canvas font measurements (~20px narrower than original PDF justified positions).
- **Visual Artifact:** The word `We` snapped backwards to the left by 20px, overlapping directly on top of `.31` (`Wegggggld`).

---

### 2. Solution: Unconditional Prefix PDF Pinning
#### [CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx)

- **Prefix Pinning Rule:**
  - `pushLine` now enforces that all leading non-space characters (`pdfCharIdx < prefixMatchCount`) and intervening spaces **ALWAYS use exact PDF coordinates** (`pdfX0`, `pdfX1`), regardless of whether the line is edited downstream.

```javascript
if (!isSpace && pdfCharIdx < prefixMatchCount) {
  // Matching leading prefix character -> ALWAYS use exact PDF coordinates!
  const pdfCh = pdfNonSpaceChars[pdfCharIdx];
  const pdfX0 = (pdfCh.x0 - item.pdfX) * scale;
  const pdfX1 = (pdfCh.x1 - item.pdfX) * scale;
  charXPositions.push(pdfX0);
  accumX = pdfX1;
  pdfCharIdx++;
} else if (isSpace && pdfCharIdx > 0 && pdfCharIdx < prefixMatchCount) {
  const nextPdfCh = pdfNonSpaceChars[pdfCharIdx];
  const nextPdfX0 = (nextPdfCh.x0 - item.pdfX) * scale;
  charXPositions.push(accumX);
  accumX = nextPdfX0;
}
```

- **Orderly Vertical Line Flow:**
  - Leading words (`involve the transfer of responsibility.31`) remain 100% fixed at their original PDF coordinates with zero shifting or overlap.
  - Inserted characters advance rightward smoothly from the cursor.
  - Overflowing words wrap dynamically to a new line at the bottom of the paragraph, creating vertical space and shifting lower page elements down cleanly.
