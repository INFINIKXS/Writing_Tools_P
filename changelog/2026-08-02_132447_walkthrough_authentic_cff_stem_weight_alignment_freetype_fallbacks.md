---
archived: 2026-08-02T13:24:47.531202
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Authentic CFF Stem Weight Alignment & FreeType Fallbacks

Implemented FreeType CFF parser fallbacks (`StemSnapV[0]` $\to$ median `vstem` hints) and aligned frontend stem darkening with authentic PDF rendering metrics in [`font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py) and [`CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx).

## Changes Made

### 1. Backend CFF Stem Extraction Engine ([font_utils.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py))

- **Implemented FreeType CFF Parser Fallback (`get_stem_darkening_ratio`)**:
  - Checks `private.StdVW`.
  - If `StdVW` is missing, falls back to `private.StemSnapV[0]` (the primary vertical stem width array).
  - If `StemSnapV` is also missing, inspects glyph `CharStrings` to compute the median width of vertical stem hints (`vstem`).
  - Returns `None` for TrueType (`glyf`) fonts so they are correctly flagged as bytecode fonts.

### 2. Frontend Layout Engine ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))

- **Updated `getStemDarkeningPx`**:
  - For TrueType / Base-14 fonts (`stemVwRatio == null`): Returns `0` (allows native browser DirectWrite / CoreText bytecode grid-fitting to render clean text without extra ink).
  - For CFF fonts (`stemVwRatio != null`): Computes `targetStemWidthPx = stemVwRatio * fontSizePx` using authentic CFF stem metrics (without adding low-DPI `freeTypeStemDarkeningPx` curve padding on high-DPR canvases).
  - Computes `darken = Math.max(0, targetStemWidthPx - nativeStemWidthPx)`.

- **Refined `drawCanvasLine`**:
  - Always executes single primary `ctx.fillText(cm.displayChar, crispX, crispY)`.
  - Only if `darken > 0.05` (native browser rendering is genuinely thinner than PDF CFF target width), applies a single subtle top-up offset pass (`ctx.fillText(cm.displayChar, crispX + darken, crispY)`).
