---
archived: 2026-07-25T10:06:21.074753
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\97a6308b-4cda-4fc9-a0e9-efbebac2ca77\walkthrough.md
---

# Full-Height PDF Canvas Preview Layout Fix

We updated the height calculations in `RedactPdfVisualView` so the center PDF preview canvas extends downward to align with the base of the screen workspace:

---

## 1. Summary of Layout Adjustments

- **Container Viewport Height**: Updated outer workspace wrapper to `minHeight: 'calc(100vh - 220px)'`.
- **Canvas Preview Area (`containerRef`)**: Set `minHeight: 'calc(100vh - 310px)'` with `flex: 1`. The PDF canvas container now dynamically expands downward to fill all available vertical space down to the page navigation bar.
- **Sidebars (Thumbnails & Controls)**: Updated maximum heights for the page thumbnail column and right controls sidebar to `calc(100vh - 240px)` for a unified screen alignment.

---

## 2. Verification Results
- **Frontend Build**: Verified `npm run build` completed with 0 errors.
- **Layout Alignment**: PDF preview container now dynamically spans full screen height.
