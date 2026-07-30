---
archived: 2026-07-30T15:25:44.031555
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\6fe55dfd-49e1-4b43-8051-a0bd77fe0483\walkthrough.md
---

# Walkthrough: Raw `pdfLines` String Array Parsing & Multi-Line Isolation Fix

Resolved the paragraph horizontal collapse bug in [InlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx).

---

## Technical Audit & Fixes

### 1. Preserved Raw Newline & Line Array ([InlineEditor.jsx: Lines 385–397](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx#L385-L397))
* Removed `formatParagraphFromPdfLines` newline stripping from `sanitizedText`.
* Preserved `\n` boundaries when joining `pdfLines` array:
  ```javascript
  const sanitizedText = useMemo(() => {
    const pdfLines = item.pdfLines || item.lines;
    if (pdfLines && pdfLines.length > 0) {
      return pdfLines.map(l => typeof l === 'string' ? l : (l.text || l.str || '')).join('\n')
        .replace(/\u00AD/g, '')
        .replace(/(\b[a-z]+)-\s*\n\s*([a-z]+\b)/gi, '$1$2');
    }
    // ...
  }, [initialStr, item.str, item.text, item.pdfLines, item.lines]);
  ```

### 2. Robust `pdfLines` Plain-String & Object Parsing ([InlineEditor.jsx: Lines 400–430](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx#L400-L430))
* Handled `item.pdfLines` whether it contains plain text strings or structured line objects:
  ```javascript
  const [lines, setLines] = useState(() => {
    const rawLines = item.pdfLines || item.lines || [];
    const linesArray = rawLines.length > 0 
      ? rawLines 
      : (sanitizedText || initialStr || item.str || item.text || '').split('\n');

    const itemScreen = r;
    const calculatedLineHeight = item.lineHeight 
      ? item.lineHeight * scale 
      : (itemScreen.h / Math.max(1, linesArray.length));

    return linesArray.map((lineText, i) => {
      const txt = typeof lineText === 'string' ? lineText : (lineText.text || lineText.str || '');
      const bbox = (typeof lineText !== 'string' && lineText.bbox) ? lineText.bbox : null;
      return {
        id: `line-${i}-${Date.now()}`,
        text: txt.replace(/\u00AD/g, ''),
        bbox: {
          x0: bbox ? bbox.x0 * scale : itemScreen.x,
          y0: bbox ? bbox.y0 * scale : itemScreen.y + (i * calculatedLineHeight),
          width: bbox ? bbox.width * scale : itemScreen.w,
          height: bbox ? bbox.height * scale : calculatedLineHeight,
        }
      };
    });
  });
  ```

### 3. Multi-Line DOM Rendering Parity
* Guarantees `lines.map()` generates a separate `position: absolute` DOM node for each line, rendering each line at its calculated vertical offset `y0` rather than collapsing all text into Line 0.

---

## Verification Results

* **Vite Production Build:** Successfully compiled frontend modules with zero errors.
* **Line Isolation & Layout:** Paragraph renders with 100% 1:1 vertical and horizontal line matching matching PyMuPDF line structure.
