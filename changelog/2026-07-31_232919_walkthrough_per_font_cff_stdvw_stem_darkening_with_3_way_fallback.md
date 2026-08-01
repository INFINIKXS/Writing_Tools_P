---
archived: 2026-07-31T23:29:19.440195
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Per-Font CFF StdVW Stem Darkening with 3-Way Fallback

Implemented CFF stem-darkening driven by embedded `StdVW` metrics with a 3-way fallback path to `getStemDarkeningPxHeuristic` for non-embedded/non-CFF fonts.

## Lookup & Fallback Verification

`getFontStemVwRatio(fontFamilyName)` in [`pdfFontLoader.js`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/utils/pdfFontLoader.js) returns `null` on a miss. In JavaScript, `stemVwRatio == null` evaluates to `true` for both `null` and `undefined`, seamlessly triggering the `getStemDarkeningPxHeuristic(fontSizePx)` fallback across all three missing-metric scenarios:

1. **TrueType/glyf-outline fonts** (where `StdVW` is not a CFF concept).
2. **CFF subsets** where `StdVW` was stripped or omitted from the Private dict.
3. **Non-embedded base-14 PDF fonts** (where the browser renders system fallbacks instead of PDF embedded font streams).

## Implementation ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))

```javascript
// FALLBACK: used when the font has no derivable StdVW
const getStemDarkeningPxHeuristic = (fontSizePx) => {
  const SMALL_PX = 11;
  const LARGE_PX = 22;
  const MAX_DARKEN = 0.35;
  if (fontSizePx <= SMALL_PX) return MAX_DARKEN;
  if (fontSizePx >= LARGE_PX) return 0;
  const t = (fontSizePx - SMALL_PX) / (LARGE_PX - SMALL_PX);
  return MAX_DARKEN * (1 - t);
};

// PRIMARY: real per-font metric extracted from the embedded CFF's Private dict.
const FT_DARKENING_CURVE = [
  [0.5, 0.4],
  [1.0, 0.275],
  [1.667, 0.275],
  [2.333, 0.0],
];

const freeTypeStemDarkeningPx = (stemWidthPx) => {
  const pts = FT_DARKENING_CURVE;
  if (stemWidthPx <= pts[0][0]) return pts[0][1];
  if (stemWidthPx >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (stemWidthPx >= x0 && stemWidthPx <= x1) {
      const t = (stemWidthPx - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return 0;
};

// Single entry point drawCanvasLine actually calls.
const getStemDarkeningPx = (fontSizePx, stemVwRatio) => {
  if (stemVwRatio == null) return getStemDarkeningPxHeuristic(fontSizePx);
  const stemWidthPx = stemVwRatio * fontSizePx;
  return freeTypeStemDarkeningPx(stemWidthPx);
};
```
