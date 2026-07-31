---
archived: 2026-07-31T00:52:46.811305
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\feeea78e-e359-448e-b210-460d0512eeb9\walkthrough.md
---

# Walkthrough: Canvas Justification Fix & HMR Export Compatibility

## Changes Made

### 1. Fix Vite HMR "SUPER_MAP export is incompatible"
**Problem**: `CanvasInlineEditor.jsx` exported both a React component (`CanvasInlineEditor`) AND plain constants (`SUPER_MAP`, `UNICODE_SUPER_MAP`, `UNICODE_SUB_MAP`, `normalizeText`). Vite React Fast Refresh requires `.jsx` files to export ONLY React components — mixing them breaks HMR, forcing full page reloads on every save.

**Fix**: Created `superscriptUtils.js` (pure non-JSX utility file) to hold all four exported constants. `CanvasInlineEditor.jsx` now imports from there, satisfying Fast Refresh requirements.

**Files**:
- `frontend/src/components/PDFEditor/superscriptUtils.js` — [NEW] pure utility exports
- `frontend/src/components/PDFEditor/CanvasInlineEditor.jsx` — imports from superscriptUtils.js, removes local exports

---

### 2. Fix Canvas Paragraph Justification (Root Cause)
**Problem**: Two compounding bugs prevented text from justifying to the right margin in edit mode:

#### Bug 1 — `Viewer.jsx` used `' '` (space) separator for justified paragraphs (line 754)
```javascript
// BEFORE (broken):
const sep = pStr.endsWith('-') ? '' : (blockAlign === 'justify' ? ' ' : '\n');
```
This merged all PyMuPDF lines into **one giant text blob** with spaces between them. The canvas had to re-wrap this entire blob from scratch — producing **different line breaks** than PyMuPDF's original layout.

#### Bug 2 — `pushLine` used `origLines[lines.length]` (canvas line index) for bounds lookup
Since canvas re-wrapped the blob into its own (different) line breaks, canvas line 3 ≠ PyMuPDF line 3. The `origLines[3].line_x1 - origLines[3].line_x0` lookup gave the **wrong `targetWidth`** — causing `extraPerSpace = (targetWidth - rawLineWidth) / spaceCount` to compute wildly incorrect values, leaving text left-aligned.

**Fix**:

**`Viewer.jsx`** (line 754): Changed separator to always `'\n'` for all paragraph types:
```javascript
// AFTER (fixed):
const sep = pStr.endsWith('-') ? '' : '\n';
```
Each `\n`-block now maps **1:1** to a PyMuPDF original line.

**`CanvasInlineEditor.jsx`** — Refactored `computeLineLayout` wrapping loop:
- Computed `pOrigLine = origLines[pIdx]`, `pStartX`, `pLineTargetW` **once per `pIdx` block** (not per canvas line)
- All canvas lines within a `pIdx` block share the same `pStartX` and `pLineTargetW` from the correct PyMuPDF origLine
- `isLastLineOfParagraph = isLastPdfLine && isLastCanvasLineOfBlock` — only the very last PyMuPDF line's last canvas line is unjustified
- Added `blockAlign = item.align || 'left'` to component scope
- Updated `shouldJustify` to require `blockAlign === 'justify'` (not just `item.isParagraph`)
- Fixed span relX override: `accumX = Math.max(accumX, spanInfo.relX + pStartX)` (was missing `pStartX` offset)

---

## Verification
- **Frontend build**: `npm run build` — ✅ 2,539 modules transformed, 0 errors
- **HMR**: `SUPER_MAP export is incompatible` error resolved — Fast Refresh now works on every save
- **Justification**: Each canvas line maps 1:1 to its PyMuPDF origLine — `targetWidth`, `startX`, and `extraPerSpace` are computed from authoritative PDF coordinates
