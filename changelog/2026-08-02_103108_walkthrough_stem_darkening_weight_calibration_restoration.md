---
archived: 2026-08-02T10:31:08.768219
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Stem Darkening Weight Calibration Restoration

Restored FreeType CFF stem darkening curve and calibrated dual-offset `fillText` stem widening (`crispX ± (darken / 2)`) in [`CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx).

## Changes Made

### Frontend Layout Engine ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))

1. **Probe Core Ink Threshold (`measureNativeStemWidthPx`)**:
   - Updated `'l'` probe stroke measurement to use core ink threshold `alpha > 60` (instead of total alpha sum), measuring actual core native stem width.

2. **FreeType CFF Stem Darkening Curve**:
   - Restored `freeTypeStemDarkeningPx` CFF curve addition in `getStemDarkeningPx`:
     ```javascript
     const targetStemWidthPx = (stemVwRatio * fontSizePx) + freeTypeStemDarkeningPx(stemVwRatio * fontSizePx);
     ```

3. **Dual Horizontal-Offset `fillText` Widening**:
   - Restored dual-offset `fillText` rendering (`crispX ± offsetPx` with `offsetPx = darken / 2`):
     ```javascript
     if (!isBold) {
       const glyphFontSizePx = (isSuper || isSub) ? fontSizePx * 0.65 : fontSizePx;
       const stemVwRatio = getFontStemVwRatio(currentFontFamily);
       const darken = getStemDarkeningPx(ctx.font, glyphFontSizePx, stemVwRatio);
       if (darken > 0) {
         const offsetPx = darken / 2;
         ctx.fillText(cm.displayChar, crispX + offsetPx, crispY);
         ctx.fillText(cm.displayChar, crispX - offsetPx, crispY);
       }
     }
     ```
