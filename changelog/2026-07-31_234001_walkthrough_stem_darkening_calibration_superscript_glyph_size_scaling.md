---
archived: 2026-07-31T23:40:01.971502
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Stem Darkening Calibration & Superscript Glyph Size Scaling

Adjusted stem-darkening parameters in [`CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx) for accurate font weight matching and superscript/subscript scaling.

## Changes Made

### 1. Calibrated Fallback Heuristic (`MAX_DARKEN`)
- Reduced `MAX_DARKEN` from `0.35` to `0.18` in `getStemDarkeningPxHeuristic` to prevent overshooting body text weight on standard serif fonts (such as NewBaskerville).

### 2. Superscript/Subscript Glyph Font Size Scaling
- Computed `glyphFontSizePx = (isSuper || isSub) ? fontSizePx * 0.65 : fontSizePx` in `drawCanvasLine`.
- Passed `glyphFontSizePx` into `getStemDarkeningPx(glyphFontSizePx, stemVwRatio)` so smaller superscript citation numerals do not receive excessive darkening calculated from the base body font size.

### 3. Diagnostic Console Logging
- Added temporary console log in `drawCanvasLine`: `console.log('[stem-darkening]', currentFontFamily, 'ratio:', stemVwRatio)` to verify whether the backend per-font `StdVW` metric or heuristic fallback path is firing in devtools.
