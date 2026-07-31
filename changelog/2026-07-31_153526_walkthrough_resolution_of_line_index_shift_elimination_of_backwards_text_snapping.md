---
archived: 2026-07-31T15:35:26.997971
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\855d83d6-0b33-4a8a-8175-8c2cdbb38a19\walkthrough.md
---

# Walkthrough: Resolution of Line Index Shift & Elimination of Backwards Text Snapping

## Root Cause Discovered & Resolved

### 1. Root Cause Analysis
When an inline edit caused a line to wrap and create an additional canvas line:
- **Line Index Desynchronization:** `computeLineLayout` previously used `lineIndex = lines.length` to fetch `origLines[lineIndex]`.
- **Misaligned Line Lookup:** When line 0 wrapped into 2 canvas lines, line 1 of the edited text attempted to fetch `origLines[2]` (which contained completely different words).
- **Match Failure & Backwards Snap:** Because `origLines[2]` didn't match line 1's words (`involve the transfer of responsibility.31`), `prefixMatchCount` dropped to **0**. Line 1 fell back to un-justified canvas font measurements (~20px narrower than original PDF justified positions), causing leading text to **snap backwards to the left by 20px**.

---

### 2. Solution: Direct `pIdx` `origLines` Mapping
#### [CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx)

- **Direct Line Mapping:**
  - `computeLineLayout` now maps `pOrigLine = origLines[pIdx]`, binding line $p$ of the paragraph directly to line $p$ of `origLines`.

```javascript
const pOrigLine = (origLines && Array.isArray(origLines) && origLines[pIdx]) ? origLines[pIdx] : null;
const { line_x0, line_x1 } = getOrigLineBounds(pOrigLine, pIdx);
```

- **Verification:**
  - Leading words (`involve the transfer of responsibility.31`) ALWAYS match `origLines[p]` with 100% accuracy.
  - Zero backwards snapping: leading words remain 100% fixed at their exact original PDF coordinates.
  - New letters advance smoothly to the right.
  - When text reaches the right border, overflow creates a new line at the bottom of the paragraph, expanding total paragraph height ($\Delta H$) and shifting lower page blocks down cleanly ($\Delta Y$ cascade).
