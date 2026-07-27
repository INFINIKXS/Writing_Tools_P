---
archived: 2026-07-26T19:53:51.372917
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\b9325f24-6175-4aa5-902e-965695189e79\walkthrough.md
---

# Walkthrough - Zero-Shift / Zero-Jump Click Fixes

We identified and resolved the exact remaining cause of the visual jump upon clicking:

## 1. Double-Box Stacking Removal ([DraggableItem.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/DraggableItem.jsx))
- **Root Cause**: When an item was selected, `DraggableItem.jsx` rendered a `ring-2 ring-blue-500 bg-white shadow-md` box while `InlineEditor.jsx` simultaneously rendered an `outline: 2px solid #3b82f6` box over the same coordinates. The slight offset between Tailwind `ring-2` (shadow ring) and CSS `outline` caused a visible 2-pixel double-frame shift on click.
- **The Fix**: When `selectedIdx === index`, `DraggableItem.jsx` becomes transparent (`opacity-0 pointer-events-none`), allowing `InlineEditor.jsx` to serve as the single, authoritative active editor frame.

## 2. Zero-Offset Padding & Alignment ([InlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx))
- Set explicit `paddingTop: 0px` and `paddingBottom: 0px` on the `contentEditable` element to prevent browser default text-box padding offsets.
- Retained 100% width match ($r.w$) so line wraps and baseline positions lock into place without shift.
