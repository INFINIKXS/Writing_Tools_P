---
archived: 2026-07-31T14:33:35.565299
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\855d83d6-0b33-4a8a-8175-8c2cdbb38a19\walkthrough.md
---

# Walkthrough: Token-Based Shift & Line-Bucket Layout Engine

## Implementation Details

### Frontend Editor Component
#### [CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx)

- **Step 1: Word & Space Tokenization:**
  - `charMeta` is extracted into discrete Word and Space tokens: `{ chars, lineId, width }`.
  - Soft newlines (`\n`) increment `currentLineId`, keeping each token initially mapped to its extracted PDF line.

- **Step 2: Line Bucket Assignment ($\Delta X, \Delta Y$ Shift):**
  - Tokens are evaluated sequentially against the target line width `targetWidth`.
  - When text is inserted mid-sentence (e.g. `nnnn...` between `and` and `patients`), the shifted token `patients.33 35 36` exceeds the line width threshold.
  - Its `assignedLineId` is incremented, and it is pushed into `lineBuckets[16]`.
  - **Single Token Ownership:** Because each token is assigned to **exactly one `lineBucket`**, it is impossible for a token to render on both Line 15 and Line 16 simultaneously.

- **Step 3: Rendering & Prefix Coordinate Preservation:**
  - Tokens in `lineBuckets[lineIdx]` are rendered sequentially.
  - Unedited prefix characters on each line retain 100% exact PDF coordinates ($x_0, x_1$), ensuring **zero text scattering / zero baseline jumping** on editor focus.

---

## Verification Summary

1. **Focus Parity:** Edit mode is 100% visually identical to Raw PDF mode on focus.
2. **Zero Duplication:** Typing `nnnn...` mid-sentence shifts `and patients.33 35 36` to the next line without any duplication.
