---
archived: 2026-07-31T15:02:38.412719
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\855d83d6-0b33-4a8a-8175-8c2cdbb38a19\walkthrough.md
---

# Walkthrough: Resolution of Mid-Sentence Text Duplication via Diff-Aware Metadata Matching

## Root Cause Discovered & Fixed

### 1. The Hidden Root Cause
In `CanvasInlineEditor.jsx`, `parseCharMetadata` previously used a naive sequential loop (`bIdx++`) to map characters in `rawText` to `backendChars` (extracted PyMuPDF character positions).

When text (`kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk`) was inserted mid-sentence:
- **Metadata Stealing:** The inserted characters (`kkkk...`) consumed the `backendChars` positions belonging to the trailing phrase (`"patients.33 35 36"`).
- **Line 15 Corruption:** Line 15 rendered `kkkk...` at the character coordinates of `"patients.33 35 36"` on Line 15.
- **Line 16 Overflow:** The real trailing phrase (`"patients.33 35 36"`) was pushed to Line 16 as unmapped text.
- **Result:** `"patients.33 35 36"` appeared on **both** Line 15 (via stolen metadata) and Line 16 (via overflow).

---

### 2. Diff-Aware Character Matching Engine
#### [CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx)

- **Prefix & Suffix Diff Mapping:**
  - `parseCharMetadata` now computes the **longest common prefix** and **longest common suffix** between `rawText` and `backendChars`.
  - Newly inserted characters (`kkkk...`) are recognized as edits and marked as new characters without consuming `backendChars` items.
  - Suffix characters (`"patients.33 35 36"`) retain their exact backend metadata.

- **Verification:**
  - Typing `kkkk...` mid-sentence no longer corrupts Line 15's character map.
  - Line 15 renders ONLY what fits (`ED physicians, ED nurses, ECPs and `).
  - The trailing phrase `"patients.33 35 36"` moves to Line 16 **exactly once** with zero duplication.
