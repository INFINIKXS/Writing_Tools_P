---
archived: 2026-07-31T23:05:44.963095
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - CFF Stem-Darkening Compensation in CanvasInlineEditor.jsx

Implemented synthetic CFF stem-darkening compensation in [`CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx) to match FreeType/Adobe CFF rasterization stem weights.

## Changes Made

### Frontend Engine ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))

1. **Stem Darkening Curve Helper**:
   Added `getStemDarkeningPx(fontSizePx)` helper function:
   ```javascript
   const getStemDarkeningPx = (fontSizePx) => {
     const SMALL_PX = 11;   // at/below this size, apply max darkening
     const LARGE_PX = 22;   // at/above this size, darkening fully tapers off
     const MAX_DARKEN = 0.35;
     if (fontSizePx <= SMALL_PX) return MAX_DARKEN;
     if (fontSizePx >= LARGE_PX) return 0;
     const t = (fontSizePx - SMALL_PX) / (LARGE_PX - SMALL_PX);
     return MAX_DARKEN * (1 - t);
   };
   ```

2. **Synthetic Compensation Stroke**:
   Updated `drawCanvasLine` to apply a stroke over non-bold glyphs:
   ```javascript
   ctx.fillText(cm.displayChar, crispX, crispY);

   if (!isBold) {
     const darken = getStemDarkeningPx(fontSizePx);
     if (darken > 0) {
       ctx.lineWidth = darken;
       ctx.strokeStyle = cm.color || defaultColor || '#000000';
       ctx.strokeText(cm.displayChar, crispX, crispY);
     }
   }
   ```
