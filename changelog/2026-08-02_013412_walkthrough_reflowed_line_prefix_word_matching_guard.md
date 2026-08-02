---
archived: 2026-08-02T01:34:12.047800
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Reflowed Line Prefix Word-Matching Guard

Disabled prefix word-matching on reflowed lines (`isReflowedLine`) in [`CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx).

## Problem & Motivation

When content is reflowed across PDF line boundaries (`isReflowedLine = allUnitsForLine.length > lineUnits.length`), combining carried-over overflow units with a line's own `pOrigLine` contents caused prefix matching to attempt mapping words against `pOrigLine.chars` of a different physical PDF line. While suffix matching was already guarded by `!isReflowedLine`, prefix matching lacked this guard.

## Changes Made

### Frontend Layout Engine ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))

1. **Hoisted `isReflowedLine`**:
   Moved `const isReflowedLine = allUnitsForLine.length > lineUnits.length;` above prefix matching logic.
2. **Guarded Prefix Matching**:
   Wrapped prefix word-matching calculation with `if (!isReflowedLine && pdfWords.length > 0)`.
3. **Cleaned Up Duplicate Declaration**:
   Removed duplicate `const isReflowedLine` right before suffix matching, reusing the hoisted boolean.
