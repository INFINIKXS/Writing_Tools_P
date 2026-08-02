---
archived: 2026-08-02T00:10:40.740304
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Overflow Unit Inter-Word Space Synthesis

Added space unit synthesis between overflow units from previous lines and current line units in [`frontend/src/components/PDFEditor/CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx).

## Problem & Solution

When line units overflowed onto subsequent lines during line wrapping or reflow, words at line boundaries could collide if the last character of the overflow unit was not a space, non-breaking space, or hyphen (`-`).

## Changes Made

### Frontend Layout Engine ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx#L650-L665))

Updated `allUnitsForLine` assembly in `computeLineLayout`:

```javascript
// Combine overflow units from previous line with current line units
let allUnitsForLine;
if (overflowUnitsFromPrevLine.length > 0 && lineUnits.length > 0) {
  const lastOverflowUnit = overflowUnitsFromPrevLine[overflowUnitsFromPrevLine.length - 1];
  const lastChar = lastOverflowUnit.chars[lastOverflowUnit.chars.length - 1]?.origChar;
  if (lastChar !== '-' && lastChar !== ' ' && lastChar !== '\u00A0') {
    const spaceMeta = { origChar: ' ', displayChar: ' ', kind: 'normal', charIndex: -1 };
    const spaceUnit = { chars: [spaceMeta], width: ctx.measureText(' ').width };
    allUnitsForLine = [...overflowUnitsFromPrevLine, spaceUnit, ...lineUnits];
  } else {
    allUnitsForLine = [...overflowUnitsFromPrevLine, ...lineUnits];
  }
} else {
  allUnitsForLine = [...overflowUnitsFromPrevLine, ...lineUnits];
}
overflowUnitsFromPrevLine = [];
```
