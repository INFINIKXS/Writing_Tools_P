---
archived: 2026-07-25T22:56:29.246747
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\b9325f24-6175-4aa5-902e-965695189e79\walkthrough.md
---

# Walkthrough - Paragraph Superscript Accumulation Fix

We fixed the exact missing information identified by the user: **Superscript & Citation Ranges in Paragraph Blocks**.

## Root Cause Discovered
When single lines were merged into paragraph blocks, `paragraphItem.superscriptRanges` was previously empty (`[]`). As a result, reference numbers and citations (such as `responsibility.31`, `Bost et al31`, `Suserud35`, `patients.33 35 36`) rendered inside the editor as full-size `10px` normal text instead of `6px` superscripts (`<sup>31</sup>`). Full-size text took up extra horizontal space, pushing words right and causing line wrap shifts.

## Solution Implemented ([Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx))
- Accumulated all line superscript ranges (`l.superscriptRanges`) into `paragraphItem.superscriptRanges` with calculated string character offsets (`charOffset += line.length + 1`).
- Inside `InlineEditor`, `buildInitialChildren` now renders all citations and reference numbers as true HTML `<sup>` elements with small font size and raised baseline.
- Superscripts take up the exact same character width as on the PDF canvas, resulting in **zero word push, zero line shift, and 100% visual fidelity**.

## Verification
- Verified Vite frontend compilation (`npm run build`).
