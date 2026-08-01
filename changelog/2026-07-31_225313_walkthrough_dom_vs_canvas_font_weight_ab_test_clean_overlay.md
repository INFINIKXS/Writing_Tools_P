---
archived: 2026-07-31T22:53:13.299612
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - DOM-vs-Canvas Font-Weight A/B Test & Clean Overlay

1. **Purple Toggle Button in Status Bar ([Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx))**:
   - Added a prominent purple toggle button directly inside the floating status bar (`🛠️ Debugger Active`):
     - Unchecked state: `🔍 Enable DOM vs Canvas A/B`
     - Active state: `⚡ DOM Font A/B Active` (purple highlight ring)

2. **Cleaned Debug Overlay Lines ([DebugOverlay.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/DebugOverlay.jsx))**:
   - Removed all red/blue baseline lines, yellow box outlines, character heatmap ticks, and discrepancy badges.
   - Now renders purely the DOM-vs-canvas text comparison layer when toggled on.
