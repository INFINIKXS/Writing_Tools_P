---
archived: 2026-08-02T09:11:11.268478
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Self-Calibrating Native Stem Width Probe Measurement

Implemented an off-screen probe measurement engine (`measureNativeStemWidthPx`) in [`CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx) to dynamically measure browser-native font stroke weight instead of relying on static weight heuristics.

## Changes Made

### Frontend Layout Engine ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))

1. **`measureNativeStemWidthPx` Off-Screen Probe**:
   - Renders a reference letter `'l'` at a fixed `256px` off-screen canvas buffer with the target `fontString`.
   - Inspects `getImageData` pixel alpha values to measure exact native stroke width.
   - Normalizes measurement into a per-em ratio (`stemToEmRatio = measuredAtProbeSize / (probeSize * 0.5)`).
   - Caches measurements per font spec in `nativeStemWidthCache`.

2. **Self-Calibrating `getStemDarkeningPx`**:
   - Calculates target stem width from CFF `StdVW` (`targetStemWidthPx = (stemVwRatio * fontSizePx) + freeTypeStemDarkeningPx(...)`).
   - Subtracts native browser stroke width (`nativeStemWidthPx = nativeStemRatio * fontSizePx`).
   - Applies `Math.max(0, targetStemWidthPx - nativeStemWidthPx)` so stroke darkening only tops up the precise missing weight difference.

3. **`drawCanvasLine` Integration**:
   - Updated `getStemDarkeningPx` call to pass `ctx.font` as the first argument:
     ```javascript
     const darken = getStemDarkeningPx(ctx.font, glyphFontSizePx, stemVwRatio);
     ```
