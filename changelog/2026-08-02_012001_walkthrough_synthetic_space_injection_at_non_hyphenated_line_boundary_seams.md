---
archived: 2026-08-02T01:20:01.550227
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Synthetic Space Injection at Non-Hyphenated Line-Boundary Seams

Fixed missing inter-word spaces at original-line-to-original-line reflow boundaries in [`CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx).

## Problem & Root Cause

When paragraph text reflows or carries overflow units over from `pIdx - 1` to `pIdx`, concatenating `[...overflowUnitsFromPrevLine, ...lineUnits]` directly fused words across PDF line boundaries (e.g. `practices.` + `Handover` → `practices.Handover`) because source PDF lines end with `\n` rather than an explicit space character. Hyphenated continuations (e.g. `prac-` + `tice` → `prac-tice`), however, are meant to concatenate without spaces.

## Changes Made

### Frontend Layout Engine ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))

1. **Synthetic Space Unit Injection**:
   ```javascript
   let allUnitsForLine = [...overflowUnitsFromPrevLine, ...lineUnits];
   if (overflowUnitsFromPrevLine.length > 0 && lineUnits.length > 0) {
     const lastOverflowUnit = overflowUnitsFromPrevLine[overflowUnitsFromPrevLine.length - 1];
     const lastOverflowChar = lastOverflowUnit?.chars?.[lastOverflowUnit.chars.length - 1]?.origChar;
     const firstNewChar = lineUnits[0]?.chars?.[0]?.origChar;
     const isHyphenContinuation = lastOverflowChar === '-' || lastOverflowChar === '\u00AD';
     const alreadyHasSpace = lastOverflowChar === ' ' || lastOverflowChar === '\u00A0' ||
                              firstNewChar === ' ' || firstNewChar === '\u00A0';
     if (!isHyphenContinuation && !alreadyHasSpace) {
       const spaceMeta = { origChar: ' ', displayChar: ' ', kind: 'normal', charIndex: -1 };
       const spaceUnit = { chars: [spaceMeta], width: ctx.measureText(' ').width };
       allUnitsForLine = [...overflowUnitsFromPrevLine, spaceUnit, ...lineUnits];
     }
   }
   ```
2. **Debug Cleanup**:
   - Removed temporary `console.log('[debug] raw text at seams:', ...)` line.
