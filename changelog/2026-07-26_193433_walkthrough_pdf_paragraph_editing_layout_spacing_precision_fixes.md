---
archived: 2026-07-26T19:34:33.734113
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\b9325f24-6175-4aa5-902e-965695189e79\walkthrough.md
---

# Walkthrough - PDF Paragraph Editing Layout & Spacing Precision Fixes

We diagnosed and resolved the exact causes of missing words, font size mismatches, and the upward visual jump when entering inline paragraph editing mode.

## 1. Root Cause & Fix for Missing Words (Horizontal Padding Reduction)
- **Root Cause**: `InlineEditor.jsx` used Tailwind class `p-1` (`padding: 4px`) on `box-sizing: border-box`. On a box of width `r.w`, 8px was lost to horizontal padding (`4px` left + `4px` right). This reduced the inner width available for HTML text reflow by 8px (~1-2 characters per line). By the end of a 16-line paragraph, lines wrapped early and words at the bottom were pushed beyond the container boundary or clipped.
- **The Fix** ([InlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx)): Set `padding: 0px` in paragraph mode so 100% of container width `r.w` is available for text reflow.

## 2. Root Cause & Fix for Upward Visual Jump (Line Height & Baseline Pitch)
- **Root Cause**: `Viewer.jsx` calculated paragraph line height as `(bottom_descender - top_ascender) / line_count`. This averaged the total bounding box height divided by the number of lines, which produced a value smaller than the PDF's true baseline-to-baseline pitch. Setting a smaller CSS `line-height` compressed lines upward toward the top of the box. Across 15 lines, the text physically jumped upward by ~10–15 pixels.
- **The Fix** ([Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx)): Calculated line height from exact PDF baseline coordinates: `linePitch = (lastLine.pdfY_base - firstLine.pdfY_base) / (lineCount - 1)`. Setting CSS `line-height = linePitch * scale` ensures pixel-for-pixel baseline alignment with zero vertical shift.

## 3. Font Size Precision & Hyphenated Line Joins
- **Font Size**: Calculated `dominantFontSize` across all lines in the paragraph block so single line anomalies (e.g. superscripts at the start of line 1) do not skew the paragraph's base font size.
- **Hyphenated Joins**: Added soft-hyphen detection when joining justified lines (`prev.endsWith('-') ? '' : ' '`), avoiding broken words like `ambu- lance`.
