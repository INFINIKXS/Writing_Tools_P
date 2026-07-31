---
archived: 2026-07-31T02:06:10.202058
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\feeea78e-e359-448e-b210-460d0512eeb9\walkthrough.md
---

# Walkthrough: Hybrid Paragraph Reflow Engine

## Changes Made

### 1. Hybrid Reflow & Exact Position Engine ([CanvasInlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx))

Implemented a dual-mode paragraph layout engine inside `computeLineLayout`:

#### **Exact Mode (`!isTextEdited`)**
- Active when the user opens or focuses a text block without modifying it (`text === initialStr`).
- Uses PyMuPDF's exact per-character coordinates (`pdfNonSpaceChars`).
- **Guarantees 0-pixel shift** when clicking to activate edit mode — characters remain in their exact raw PDF positions.

#### **Reflow Mode (`isTextEdited`)**
- Active as soon as the user types, backspaces, or pastes text (`text !== initialStr`).
- Flattens continuous paragraph text and wraps words across lines using `paragraphTargetW = (item.pdfW || r.w / scale) * scale`.
- Applies first-line indent (`firstLineIndent`) to Line 0.
- Justifies intermediate lines (`extraPerSpace = (targetWidth - rawLineWidth) / spaceCount`) flush to the right margin.
- Keeps the final line of the paragraph left-aligned.

### 2. Bug Fix: PDF Render Crash on Typing
- Fixed a syntax/reference error where Reflow Mode mistakenly invoked `pushLine` instead of `pushReflowLine`.
- Fixed line-end termination logic for `currentLineUnits` in Reflow Mode.

---

## Verification
- **Build**: `npm run build` — ✅ 2,539 modules transformed, 0 errors.
- **Exact Position**: Opening edit mode displays text using PDF character coordinates (0px shift).
- **Dynamic Reflow**: Typing new text reflows words seamlessly across multi-line paragraphs with justified right borders.
