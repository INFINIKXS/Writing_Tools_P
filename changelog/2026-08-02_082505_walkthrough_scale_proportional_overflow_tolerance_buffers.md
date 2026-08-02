---
archived: 2026-08-02T08:25:05.431648
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Scale-Proportional Overflow Tolerance Buffers

Updated line overflow tolerance thresholds in [`CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx) to scale proportionally with viewport zoom (`scale`).

## Problem & Motivation

Font measurement metrics scale proportionally with viewport zoom (`scale`). A flat `1.5px` constant tolerance at `scale = 1.0` (100% zoom) became insufficient at higher zoom levels (e.g. 175% zoom), causing zoom-dependent line overflow triggers.

## Changes Made

### Frontend Layout Engine ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))

1. **Scale-Proportional Outer Tolerance**:
   ```javascript
   const OUTER_OVERFLOW_TOLERANCE_PX = 1.5 * scale;
   for (let uIdx = 0; uIdx < allUnitsForLine.length; uIdx++) {
     const unit = allUnitsForLine[uIdx];
     const isFirstInLine = currentLineUnits.length === 0;

     if (currentLineWidth + unit.width <= pLineTargetW + OUTER_OVERFLOW_TOLERANCE_PX || isFirstInLine) {
       currentLineUnits.push(unit);
       currentLineWidth += unit.width;
     } else {
       overflowUnitsFromPrevLine = allUnitsForLine.slice(uIdx);
       break;
     }
   }
   ```

2. **Scale-Proportional Inner `pushLine` Tolerance**:
   ```javascript
   if (unitsToPush.length > 1 && accumX > pStartX + pLineTargetW + (1.5 * scale)) {
     const trimmedUnits = unitsToPush.slice(0, unitsToPush.length - 1);
     ...
   ```

3. **Debug Log Cleanup**:
   - Removed temporary `console.log('[overflow]', ...)` log.
