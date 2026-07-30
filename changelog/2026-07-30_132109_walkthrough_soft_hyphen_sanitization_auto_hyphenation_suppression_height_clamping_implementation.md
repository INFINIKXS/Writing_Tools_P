---
archived: 2026-07-30T13:21:09.583062
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\6fe55dfd-49e1-4b43-8051-a0bd77fe0483\walkthrough.md
---

# Walkthrough: Soft Hyphen Sanitization, Auto-Hyphenation Suppression & Height Clamping Implementation

The line-wrap reflow and vertical 17-line overflow issues in [InlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx) have been resolved.

---

## Technical Implementations

### 1. Soft Hyphen & Line-Break Sanitization ([InlineEditor.jsx: Lines 198–206](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx#L198-L206))
* Added a memoized text sanitizer `sanitizedText`:
  ```javascript
  const sanitizedText = useMemo(() => {
    if (!item.str && !item.text && !initialStr) return '';
    const raw = initialStr || item.str || item.text || '';
    return raw
      .replace(/\u00AD/g, '') // Remove soft hyphens
      .replace(/(\b[a-z]+)-\s*\n\s*([a-z]+\b)/gi, '$1$2'); // Clean intra-word line-break hyphens
  }, [initialStr, item.str, item.text]);
  ```

### 2. Paragraph Metrics Hook Dependency & Boundaries ([InlineEditor.jsx: Lines 380–435](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx#L380-L435))
* Updated `useEffect` dependency array: `[sanitizedText, item.isParagraph, item.fontSize, item.lineHeight, r.w, r.h, scale, fontSizeAdj, fontFamily]`.
* Computes `targetLineCount = Math.max(1, Math.round(r.h / estimatedLineHeight))` and measures character metrics safely using `spanRef.current.cloneNode(true)`.

### 3. Container Render Styles & Auto-Hyphenation Suppression ([InlineEditor.jsx: Lines 488–640](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx#L488-L640))
* **Exact Line Height Calculation:**
  `exactLineHeightPx = (item.isParagraph && r.h > 0) ? (r.h / targetLineCount) : estimatedLineHeight`
* **Height Clamping:**
  `height: `${r.h}px``, `maxHeight: `${r.h}px``, `overflow: 'hidden'`.
* **Auto-Hyphenation Disabled:**
  `hyphens: 'none'`, `WebkitHyphens: 'none'`, `msHyphens: 'none'`.
* **Micro Spacing:**
  `letterSpacing: item.isParagraph && letterSpacingEm !== 0 ? `${letterSpacingEm.toFixed(4)}em` : undefined`, `wordSpacing: item.isParagraph && letterSpacingEm > 0 ? `${(letterSpacingEm * 1.5).toFixed(4)}em` : undefined`.

---

## Verification Protocol Results

1. **Auto-Hyphenation Disabled:** Words like `involve` stay intact without splitting into `in-` and `volve`.
2. **Strict 16-Line Height Clamp:** Container height stays locked to PyMuPDF bounding box `r.h` with `overflow: hidden`, preventing vertical overflow to line 17.
3. **Container Boundaries:** Editor dashed border stays aligned with PyMuPDF block rect.
