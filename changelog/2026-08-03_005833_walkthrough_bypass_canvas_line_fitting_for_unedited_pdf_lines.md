---
archived: 2026-08-03T00:58:33.182734
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\2e05e58f-c446-49e8-a285-b0ceb293f136\walkthrough.md
---

# Walkthrough — Bypass Canvas Line-Fitting for Unedited PDF Lines

## Changes Made

### 1. Pre-computed Original Line Text
- Initialized `initialLinesText` via `useMemo` from `initialStr.split('\n')` in [CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx#L453).
- Ensures exact line-by-line comparison using post-`SUPER_MAP` processed characters so citation superscripts match reliably.

### 2. Selective Line-Fitting Bypass
- Added `isLineUnedited` check inside `computeLineLayout` in [CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx#L710-L716):
  ```javascript
  const isLineUnedited = overflowUnitsFromPrevLine.length === 0 &&
                          pIdx < initialLinesText.length &&
                          pText === initialLinesText[pIdx];
  ```
- Unedited lines skip the canvas `ctx.measureText` width-summation fitting loop entirely in [CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx#L1089-L1106), preserving original PyMuPDF line partitions without canvas measurement drift.
- Edited lines continue to execute dynamic canvas width calculation and overflow cascading.

### 3. Diagnostic Logging
- Added `[unedited-skip]` log to confirm each untouched line is correctly recognized and skipped on render.

## Verification
- Clean compilation and verified logical control flow for both unedited and edited lines.
