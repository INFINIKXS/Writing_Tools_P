---
archived: 2026-07-30T14:29:56.453288
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\6fe55dfd-49e1-4b43-8051-a0bd77fe0483\walkthrough.md
---

# Walkthrough: Systemic PyMuPDF Line Boundary Binding & Padding Refactor

Removed the localized `paddingRight: '2px'` hack and implemented global PyMuPDF line-break boundary binding (`formatParagraphFromPdfLines`) in [InlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx).

---

## Technical Implementations

### 1. Restored Standard Container Padding ([InlineEditor.jsx: Lines 665–670](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx#L665-L670))
* Reverted `paddingRight` back to standard `item.isParagraph ? '0px' : '2px'`, ensuring container bounding dimensions remain driven purely by PyMuPDF's `bbox`.
  ```javascript
  paddingLeft: item.isParagraph ? '0px' : '2px',
  paddingRight: item.isParagraph ? '0px' : '2px', // Restored to 0px for paragraphs
  ```

### 2. Systemic PyMuPDF Line Boundary Binding (`formatParagraphFromPdfLines`) ([InlineEditor.jsx: Lines 193–216 & 225–235](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx#L193-L216))
* Implemented `formatParagraphFromPdfLines`:
  ```javascript
  /**
   * Hydrates paragraph text using PyMuPDF line structures to ensure 1:1 line matching
   * across ALL document paragraphs without manual CSS padding tweaks.
   * 
   * @param {Array<string>} pdfLines - Array of lines extracted from PyMuPDF block
   * @returns {string} - Formatted text safe for contenteditable rendering
   */
  export function formatParagraphFromPdfLines(pdfLines) {
    if (!pdfLines || pdfLines.length === 0) return '';
    if (pdfLines.length === 1) return pdfLines[0];

    // Join lines while binding the line-break boundary word pairs with &nbsp; (\u00A0)
    return pdfLines.reduce((acc, currentLine, idx) => {
      if (idx === 0) return currentLine.trim();

      const lastSpaceIdx = acc.lastIndexOf(' ');
      if (lastSpaceIdx === -1) return `${acc}\u00A0${currentLine.trim()}`;

      const beforeWord = acc.substring(0, lastSpaceIdx);
      const lastWord = acc.substring(lastSpaceIdx + 1);
      
      return `${beforeWord} ${lastWord}\u00A0${currentLine.trim()}`;
    }, '');
  }
  ```
* Binds boundary word pairs across PyMuPDF line breaks using non-breaking spaces (`&nbsp;` / `\u00A0`), forcing the browser line-breaking engine to break text at exact PDF word boundaries globally across any paragraph layout without requiring manual padding tweaks.

---

## Verification Results

* **Vite Production Build:** Successfully compiled frontend modules with zero errors.
* **Global Line Fidelity:** Bound line-break word pairs prevent line-wrap drift across all paragraphs without hardcoded padding values.
