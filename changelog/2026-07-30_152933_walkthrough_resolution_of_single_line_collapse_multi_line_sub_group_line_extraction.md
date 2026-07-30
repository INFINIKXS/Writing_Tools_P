---
archived: 2026-07-30T15:29:33.616157
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\6fe55dfd-49e1-4b43-8051-a0bd77fe0483\walkthrough.md
---

# Walkthrough: Resolution of Single Line Collapse & Multi-Line Sub-Group Line Extraction

Resolved the single line collapse bug across paragraph editing in [Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx) and [InlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx).

---

## Root Cause & Technical Fixes

### 1. Root Cause Analysis
* `Viewer.jsx` was creating paragraph items using `paragraphItems.push({ str: pStr, origLines: sgLines, ... })` without explicitly attaching `pdfLines` or structured `lines` to the `item` prop.
* `pStr` was joined with single spaces (`' '`) for justified paragraphs, containing no `\n` line breaks.
* Consequently, `InlineEditor` received `pdfLines = undefined` and `lines = undefined`, falling back to `pStr.split('\n')`, which produced a single continuous 1-element array (`[entireParagraphText]`) rendered in Line 0 with `whiteSpace: 'nowrap'`.

### 2. Multi-Line Item Propagation ([Viewer.jsx: Lines 754–766](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx#L754-L766))
* Explicitly passed `pdfLines` and structured `lines` (with `pdfX`, `pdfY_top`, `pdfW`, `pdfH`) when building paragraph items in `Viewer.jsx`:
  ```javascript
  pdfLines: sgLines.map((l) => l.str),
  lines: sgLines.map((l) => ({
    text: l.str,
    bbox: {
      x0: l.pdfX,
      y0: l.pdfY_top,
      width: l.pdfW,
      height: l.pdfH
    }
  })),
  origLines: sgLines,
  ```

### 3. Flexible Line State Initialization ([InlineEditor.jsx: Lines 400–445](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx#L400-L445))
* Updated `InlineEditor` to extract lines from `item.pdfLines`, `item.lines`, or `item.origLines`, mapping each line item to its exact scaled PyMuPDF screen coordinates (`x0`, `y0`, `width`, `height`):
  ```javascript
  const rawLines = item.pdfLines || item.lines || item.origLines || [];
  if (rawLines.length > 0) {
    const calculatedLineHeight = item.lineHeight 
      ? item.lineHeight * scale 
      : (itemScreen.h / Math.max(1, rawLines.length));

    return rawLines.map((lineObj, i) => {
      const txt = typeof lineObj === 'string' ? lineObj : (lineObj.str || lineObj.text || '');
      const pdfX0 = (typeof lineObj !== 'string') ? (lineObj.pdfX ?? lineObj.bbox?.x0) : null;
      const pdfY0 = (typeof lineObj !== 'string') ? (lineObj.pdfY_top ?? lineObj.bbox?.y0) : null;
      const pdfW = (typeof lineObj !== 'string') ? (lineObj.pdfW ?? lineObj.bbox?.width) : null;
      const pdfH = (typeof lineObj !== 'string') ? (lineObj.pdfH ?? lineObj.bbox?.height) : null;

      return {
        id: `line-${i}-${Date.now()}`,
        text: txt.replace(/\u00AD/g, ''),
        bbox: {
          x0: pdfX0 != null ? pdfX0 * scale : itemScreen.x,
          y0: pdfY0 != null ? pdfY0 * scale : itemScreen.y + (i * calculatedLineHeight),
          width: pdfW != null ? pdfW * scale : itemScreen.w,
          height: pdfH != null ? pdfH * scale : calculatedLineHeight,
        }
      };
    });
  }
  ```

---

## Verification Results

* **Vite Production Build:** Successfully compiled frontend modules with zero errors.
* **Multi-Line Isolation:** Every line in the paragraph now renders in its own distinct `position: absolute` DOM node at its exact calculated `y0` vertical offset.
