---
archived: 2026-07-27T20:16:07.362388
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\b9325f24-6175-4aa5-902e-965695189e79\walkthrough.md
---

# Walkthrough - Developer Debugger Overlay (Ctrl + Shift + D)

We implemented a full 3-step diagnostic pipeline directly in the frontend PDF viewer to inspect baseline metrics and character displacements in real-time.

## 1. Features Implemented

### **Developer Debug Toggle (`Ctrl + Shift + D`)**
- Pressing `Ctrl + Shift + D` toggles the visual debugger on and off.
- Displays a floating diagnostic badge in the upper right showing active status and metric legends.

### **Diagnostic Overlay Features ([DebugOverlay.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/DebugOverlay.jsx))**
1. **Red Solid Line**: Raw PyMuPDF expected baseline extracted directly from PDF structure (`span.origin[1]`).
2. **Blue Dashed Line**: Calculated HTML/DOM element baseline.
3. **Delta Y Badge (`Δy`)**: Calculates $\Delta y = |\text{PDF}_{\text{baseline}} - \text{DOM}_{\text{baseline}}|$:
   - 🟢 **Green** (`Δy: <0.5px`): Perfect / imperceptible pixel alignment.
   - 🟡 **Yellow** (`Δy: 0.5px - 1.5px`): Minor 1px baseline jitter.
   - 🔴 **Red** (`Δy: >=1.5px`): Significant baseline shift needing metric correction.
4. **Character Heatmap Ticks**: Renders vertical micro-ticks across the text item for tracking advance width and horizontal displacement alignment.

---

## 2. Verification

- Ran `npm run build` — compiled cleanly without errors.
