---
archived: 2026-07-23T21:50:12.761490
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\8bb50279-fc75-4a19-a4cc-2f021dc51f7b\walkthrough.md
---

# Mode Switcher & Header Layout Redesign

Redesigned the top-level mode switcher in **Citation & Reference Manager** to eliminate overlap with the floating nav orb, remove duplicate headers, and improve typography & element hierarchy.

---

## Key Improvements

### 1. Zero-Overlap Mode Switch Placement
- Pushed the top-level **Citation Verifier** vs **Reference Manager** segmented mode switcher onto its own dedicated row below the main header line.
- Added `pr-24 md:pr-28` to the header text container to maintain generous margin from the top-right floating orb.

### 2. Clean Single Header Architecture
- Added `hideHeader={true}` to [VerifierView.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/VerifierView.jsx) when embedded inside [LibraryView.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/LibraryView.jsx).
- Prevents double-rendering of `Citation Verifier` title headers.

### 3. Clear Sub-Tab Distinction
- Relabeled the second sub-tab inside **Reference Manager** mode to **DOI Verifier** (from "Verifier").
- Clearly differentiates in-text citation auditing (**Citation Verifier** mode) from individual DOI reference validation (**DOI Verifier** sub-tab).

---

## Verification

- Tested layout via Chrome DevTools screenshot verification across both **Citation Verifier** and **Reference Manager** modes.
- Confirmed zero visual overlap with the orb across viewports.
