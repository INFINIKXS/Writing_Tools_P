---
archived: 2026-07-31T16:30:57.686776
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\855d83d6-0b33-4a8a-8175-8c2cdbb38a19\walkthrough.md
---

# Walkthrough: Strategy A Tight Line Capacity & Instant Paragraph Cascade with Step 2 Kerning Retention

## Implementation Overview

### 1. Strategy A: Tight Line Capacity (`origUnitsCount`)
#### [CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx)

- **Helper `countWordsInPdfChars`:**
  - Extracts the exact original word count of line $k$ from `pOrigLine.chars`.
- **Line Packing Limit:**
  - In `computeLineLayout`, line $k$ packs words until either target width `pLineTargetW` is met or `currentLineUnits.length >= origUnitsCount`.

```javascript
const pdfCharsForCount = pOrigLine?.chars || [];
const origUnitsCount = countWordsInPdfChars(pdfCharsForCount);

const exceedsWidth = currentLineWidth + unit.width > pLineTargetW;
const exceedsOrigWordCount = origUnitsCount > 0 && currentLineUnits.length >= origUnitsCount;

if ((!exceedsWidth && !exceedsOrigWordCount) || isFirstInLine) {
  currentLineUnits.push(unit);
  currentLineWidth += unit.width;
} else {
  overflowUnitsFromPrevLine = allUnitsForLine.slice(uIdx);
  break;
}
```

- **Instant Cascade to Paragraph End:**
  - Intermediate lines can no longer absorb extra words into their un-justified canvas gaps.
  - Adding 1 word at Line 2 forces 1 word off Line 3, Line 4, Line 5... all the way to the bottom.
  - A brand-new line is created immediately at the paragraph end, expanding total paragraph height ($\Delta H$) and triggering `onHeightChange` to shift lower page elements down ($\Delta Y$ cascade).

---

### 2. Step 2: Trailing Word $\Delta X$ Offset Shift & Kerning Retention
- **Preserved Kerning:**
  - Trailing unmodified words on every line continue to compute their coordinates via `(pdfCh.x0 - item.pdfX) * scale + deltaXShift`.
  - Trailing words retain 100% of their original PDF character kerning and font spacing, shifted right by $\Delta X$.
