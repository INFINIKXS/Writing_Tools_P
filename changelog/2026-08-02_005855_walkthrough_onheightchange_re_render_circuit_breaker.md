---
archived: 2026-08-02T00:58:55.787635
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - `onHeightChange` Re-Render Circuit Breaker

Implemented a dual-layer circuit breaker across [`CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx) and [`Viewer.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx) to eliminate re-render cascades caused by height changes.

## Problem & Root Cause

`CanvasInlineEditor` invoked `onHeightChange(item.pdfY, deltaH)` on every `renderCanvas` layout pass. In response, `Viewer.jsx` unconditionally instantiated a new `{ pageNum, activePdfY, deltaH }` object literal in `setActiveBlockShift`, triggering a re-render cascade of `Viewer` and `CanvasInlineEditor`.

## Changes Made

### 1. Child Guard ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))

- Added `lastReportedDeltaHRef = useRef(null)`.
- Added threshold check (`HEIGHT_CHANGE_THRESHOLD = 0.5px`) in `renderCanvas` before invoking `onHeightChange`:
  ```javascript
  const HEIGHT_CHANGE_THRESHOLD = 0.5;
  if (
    onHeightChange &&
    (lastReportedDeltaHRef.current === null ||
      Math.abs(deltaH - lastReportedDeltaHRef.current) > HEIGHT_CHANGE_THRESHOLD)
  ) {
    lastReportedDeltaHRef.current = deltaH;
    onHeightChange(item.pdfY, deltaH);
  }
  ```
- Removed temporary `console.log('[debug] existingEdit...')` line.

### 2. Parent Circuit Breaker ([Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx))

- Converted `setActiveBlockShift` in `onHeightChange` to functional state update form with reference bailout:
  ```javascript
  onHeightChange={(activePdfY, deltaH) => {
    setActiveBlockShift(prev => {
      if (
        prev &&
        prev.pageNum === index + 1 &&
        prev.activePdfY === activePdfY &&
        Math.abs(prev.deltaH - deltaH) < 0.5
      ) {
        return prev; // bail out — same object reference, no re-render
      }
      return { pageNum: index + 1, activePdfY, deltaH };
    });
  }}
  ```
