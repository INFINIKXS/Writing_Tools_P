---
archived: 2026-07-31T02:30:28.548173
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\feeea78e-e359-448e-b210-460d0512eeb9\walkthrough.md
---

# Walkthrough: Line-Anchored Editing & Dynamic Bounding Box Growth

## Summary of Improvements

### 1. Line-Anchored Per-pIdx Layout Architecture ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))

- **Prevents Line Collapsing / Retraction**: Replaced the global reflow flattener with a line-anchored per-`pIdx` layout pipeline.
- **Line Preservation**: Each PyMuPDF original line (`rawLinesText[pIdx]`) is processed independently:
  - **Unedited Lines**: `usePdfCoords = true` — every character renders at its exact PDF position matching raw mode 1:1.
  - **Edited Line(s)**: `usePdfCoords = false` — space-justification (`extraPerSpace = (pLineTargetW - rawLineWidth) / spaceCount`) is computed for the edited line only, keeping it flush to its original line target width without scrambling surrounding lines.

---

### 2. Dynamic Canvas Bounding Box Height Growth

- **Auto-Expanding Box**: In `renderCanvas`, layout lines are evaluated to determine the total required height (`requiredHeightPx = Math.max(r.h, layout.lines.length * layout.lineHeightPx)`).
- **Synchronized Coverage & Canvas Surface**:
  - `canvas.height` and `canvas.style.height` expand dynamically to `requiredHeightPx`.
  - Solid white coverage rectangle (`coverageRef`) expands to `requiredHeightPx`.
  - The dashed bounding box border (`border: 1px dashed...`) expands downwards when new lines are created or text wraps beyond original bounds.

---

## Verification
- **Build**: `npm run build` — ✅ 2,539 modules transformed, 0 errors.
- **Visual Stability**: Typing characters in a line keeps all other lines in their exact original PDF positions (matching Image 1 / Raw mode).
- **Container Growth**: Adding new lines expands the dotted bounding box dynamically without truncating bottom text.
