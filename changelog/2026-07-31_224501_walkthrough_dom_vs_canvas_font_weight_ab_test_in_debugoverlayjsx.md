---
archived: 2026-07-31T22:45:01.882461
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - DOM-vs-Canvas Font-Weight A/B Test in DebugOverlay.jsx

Added a toggleable debug mode (`debugFontWeightCompare`) to [`DebugOverlay.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/DebugOverlay.jsx) to render text lines as real positioned DOM elements for direct visual side-by-side comparison against Canvas rendering.

## Changes Made

### Frontend Debug Component ([DebugOverlay.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/DebugOverlay.jsx))

1. **Toggleable Debug State**:
   Supported `debugFontWeightCompare` prop as well as a local toggle state controlled via an on-screen toggle button (`🔍 Enable DOM vs Canvas A/B Test` / `⚡ DOM Font-Weight Compare ON`).

2. **Font Stack & Metric Synchronization**:
   Used the exact font stack resolution logic as `CanvasInlineEditor.jsx`:
   ```javascript
   const currentFontFamily = item.renderedFontFamily || (realFontStack ? `${realFontStack}, ${fallbackStack}` : fallbackStack);
   ```

3. **DOM Element A/B Test Layer**:
   When `debugFontWeightCompare` is active, renders positioned DOM elements for each text item:
   ```javascript
   <div
     style={{
       position: 'absolute',
       left: r.x,
       top: r.y,
       fontFamily: currentFontFamily,
       fontSize: `${fontSizePx}px`,
       color: color,
       fontWeight: isBold ? 'bold' : 'normal',
       fontStyle: isItalic ? 'italic' : 'normal',
       whiteSpace: 'pre',
       pointerEvents: 'none',
       zIndex: 101,
     }}
   >
     {text}
   </div>
   ```

## Purpose & Diagnosis Goal
This A/B test allows testing whether thin text rendering is specific to HTML5 Canvas 2D `fillText` (addressable via stroke/shadow tuning) or stems from upstream font pipeline conversion (such as CFF→OTF conversion stripping font hinting data).
