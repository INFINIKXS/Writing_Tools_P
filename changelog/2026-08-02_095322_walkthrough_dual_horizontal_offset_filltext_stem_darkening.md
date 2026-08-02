---
archived: 2026-08-02T09:53:22.076579
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Dual Horizontal Offset `fillText` Stem Darkening

Replaced `strokeText`-based stem darkening with dual horizontal-offset `fillText` rendering (`crispX ± (darken / 2)`) in [`CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx).

## Problem & Motivation

`ctx.strokeText()` centers outline strokes on glyph edges, causing half of the stroke to double-composite alpha on top of the glyph's interior anti-aliased pixels (`source-over` blending). This produced visually darker/blacker glyphs rather than genuinely wider stems. Furthermore, offsetting vertically thickened horizontal serifs and crossbars unnecessarily.

## Changes Made

### Frontend Layout Engine ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))

```javascript
if (!isBold) {
  const glyphFontSizePx = (isSuper || isSub) ? fontSizePx * 0.65 : fontSizePx;
  const stemVwRatio = getFontStemVwRatio(currentFontFamily);
  const darken = getStemDarkeningPx(ctx.font, glyphFontSizePx, stemVwRatio);
  if (darken > 0) {
    // Geometric identity: two opaque fillText copies offset by ±d horizontally
    // widen a vertical stroke by exactly 2d (d = darken / 2).
    // Horizontal-only to preserve vertical-stem geometry without thickening serifs.
    const offsetPx = darken / 2;
    ctx.fillText(cm.displayChar, crispX + offsetPx, crispY);
    ctx.fillText(cm.displayChar, crispX - offsetPx, crispY);
  }
}
```
- Replaced `ctx.lineWidth` / `ctx.strokeStyle` / `ctx.strokeText` with horizontal-only `ctx.fillText(cm.displayChar, crispX + offsetPx, crispY)` and `ctx.fillText(cm.displayChar, crispX - offsetPx, crispY)`.
