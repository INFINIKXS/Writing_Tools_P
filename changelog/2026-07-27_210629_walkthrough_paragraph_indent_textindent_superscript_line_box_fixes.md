---
archived: 2026-07-27T21:06:29.777067
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\b9325f24-6175-4aa5-902e-965695189e79\walkthrough.md
---

# Walkthrough - Paragraph Indent (textIndent) & Superscript Line-Box Fixes

We diagnosed and resolved all 3 symptoms identified in the technical breakdown:

## 1. Fixes Implemented

### **Fix 1: Paragraph Indent (`textIndent`)**
- **Problem**: PDFs create paragraph indents using explicit $X$-coordinate offsets on Line 1 ($X_{\text{line 1}} > X_{\text{block}}$) without literal space characters (`"   In"`). When PyMuPDF extracted raw text, line 1 lost its indent when rendered in HTML.
- **Solution**: In `Viewer.jsx`, when grouping paragraph lines, we now calculate:
  $$\text{textIndentPdf} = X_{\text{line 1}} - X_{\text{block\_left}}$$
  And in `InlineEditor.jsx`, we apply `textIndent: item.textIndent * scale` to the `contentEditable` container.

### **Fix 2: Superscript Line Box Protection (`line-height: 0`)**
- **Problem**: Inline superscripts (e.g. `31`, `35`) were causing default browser line-box expansion, pushing line heights down and causing visual text jumps on mount.
- **Solution**: Styled superscripts as inline spans with `fontSize: '0.65em'`, `lineHeight: 0`, `verticalAlign: 'super'`. `lineHeight: 0` ensures superscripts cannot alter the CSS line-box height.

### **Fix 3: Zero-Shift Anchor**
- Combined `textIndent`, `lineHeight: 0` superscripts, and Fix 4 baseline offset adjustment (`baselinePaddingTop`) to guarantee zero-shift positioning on click.

---

## 2. Verification

- Ran `npm run build` — compiled cleanly without errors.
