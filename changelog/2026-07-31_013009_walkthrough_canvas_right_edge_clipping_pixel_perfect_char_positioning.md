---
archived: 2026-07-31T01:30:09.020698
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\feeea78e-e359-448e-b210-460d0512eeb9\walkthrough.md
---

# Walkthrough: Canvas Right-Edge Clipping & Pixel-Perfect Char Positioning

## Three Bugs Fixed

---

### Bug 1 — Characters clipped at the right border

**Root cause**: `r.w` (the canvas CSS width) was computed using **character extents**:
```javascript
// BEFORE (Viewer.jsx line 736):
const pX1 = Math.max(...sgLines.map((l) => l.pdfX + l.pdfW));
// pdfW = lineX1 - lineX0 = max(char.x1) - min(char.x0)
```
But `targetWidth` in CanvasInlineEditor was computed using PyMuPDF's **line bounding box** (`line_x1`), which can be slightly wider — it includes trailing whitespace glyphs and font metric overhangs. So `targetWidth > r.w` → text overflowed the canvas right edge → clipped.

**Fix (Viewer.jsx)**:
```javascript
// AFTER:
const pX0 = Math.min(...sgLines.map((l) => l.line_x0 ?? l.pdfX));
const pX1 = Math.max(...sgLines.map((l) => l.line_x1 ?? (l.pdfX + l.pdfW)));
```
Now `r.w` and `targetWidth` are both based on PyMuPDF's line bbox — they always match, no overflow possible.

---

### Bug 2a — Last-line superscripts not at right edge (false `usePdfCoords`)

**Root cause**: The `usePdfCoords` safety check compared:
```javascript
const usePdfCoords = pdfChars.length > 0 && pdfChars.length === nonSpaceCount;
```
PyMuPDF includes **space glyphs** in `pdfChars` for some lines — specifically citation spans like `³³ ³⁵ ³⁶` which have spaces between each citation group. This made `pdfChars.length > nonSpaceCount` → `usePdfCoords = false` → fell back to browser `ctx.measureText()` → browser font is narrower than the embedded PDF font → superscripts landed 5-15px short of where they should be.

**Fix (CanvasInlineEditor.jsx)**:
```javascript
// Filter PyMuPDF space glyphs before the count comparison
const pdfNonSpaceChars = pdfChars.filter(ch => {
  const c = ch.c ?? ch.char ?? '';
  return c !== ' ' && c !== '\u00A0' && c.length > 0;
});
const usePdfCoords = pdfNonSpaceChars.length > 0 && pdfNonSpaceChars.length === nonSpaceCount;
```
The loop uses `pdfNonSpaceChars[pdfCharIdx]` for coordinate lookups.

---

### Bug 2b — Why direct PDF coordinates fix the visual issue

When `usePdfCoords = true`, each non-space character is drawn at:
```javascript
const pdfX0 = (pdfCh.x0 - item.pdfX) * scale;  // exact PDF position
```
This bypasses browser font metrics entirely. The character appears at the EXACT SAME pixel position as in the raw PDF, regardless of whether the browser's CSS font renders slightly narrower or wider.

**The fallback** (`ctx.measureText + extraPerSpace`) now only activates when the user **edits** text — adding or removing characters changes `nonSpaceCount` relative to the original PDF's char count, making it impossible to apply original PDF coordinates to characters that didn't exist in the original.

---

## Files Changed

- **`frontend/src/components/PDFEditor/Viewer.jsx`**:
  - `pX0` now uses `line_x0 ?? pdfX` (PyMuPDF bbox left)
  - `pX1` now uses `line_x1 ?? (pdfX + pdfW)` (PyMuPDF bbox right)
  - `firstLineIndent` uses `line_x0 ?? pdfX` consistently

- **`frontend/src/components/PDFEditor/CanvasInlineEditor.jsx`**:
  - Added `pdfNonSpaceChars` filter to exclude space glyphs from count comparison
  - `usePdfCoords` check uses `pdfNonSpaceChars.length === nonSpaceCount`
  - Loop uses `pdfNonSpaceChars[pdfCharIdx]` for coordinate lookups

## Verification
- `npm run build` — ✅ 2,539 modules, 0 errors (×3 successive builds)
