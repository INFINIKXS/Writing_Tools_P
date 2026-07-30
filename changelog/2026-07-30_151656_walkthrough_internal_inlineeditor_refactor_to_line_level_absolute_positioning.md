---
archived: 2026-07-30T15:16:56.547116
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\6fe55dfd-49e1-4b43-8051-a0bd77fe0483\walkthrough.md
---

# Walkthrough: Internal `InlineEditor` Refactor to Line-Level Absolute Positioning

Refactored [InlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx) internally to render line-level DOM nodes while preserving all domain logic (canvas ascender math, superscript range metadata, font active badges, and toolbar controls).

---

## Refactor Accomplishments

### 1. Line Coordinate Mapping ([InlineEditor.jsx: Lines 404–431](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx#L404-L431))
* Converted `item.pdfLines` / `item.lines` (or line split fallback) into state `lines`.
* Derived exact `bbox: { x0, y0, width, height }` coordinates per line from PyMuPDF metadata or calculated line metrics.

### 2. Surgical JSX Replacement ([InlineEditor.jsx: Lines 820–875](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx#L820-L875))
* Replaced the single paragraph container span with a mapped `inline-editor-lines-container`.
* Rendered each line as its own DOM node with:
  - `position: 'absolute'`
  - `left: ${line.bbox.x0}px`
  - `top: ${line.bbox.y0 + baselineTopAdj}px`
  - `paddingTop: ${baselinePaddingTop}px`
  - `whiteSpace: 'nowrap'` (prevents browser auto-wrapping and word-stealing completely).

### 3. Preserved Superscripts & Canvas Baseline Math ([InlineEditor.jsx: Lines 425–440 & 670–710](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx#L425-L440))
* Retained `baselinePaddingTop` and `baselineTopAdj` canvas ascender corrections (`htmlAscenderPx`/`pdfAscenderPx`).
* Hydrated superscript tags (`<sup style="...">...</sup>`) and citation formatting directly into line DOM nodes once on mount.

### 4. On-Demand Key Handlers ([InlineEditor.jsx: Lines 455–535](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx#L455-L535))
* Attached `onKeyDown` per line node:
  - `Enter`: Splits line text at `caretOffset`, creates a new line node below (`y0 = currentLine.bbox.y0 + lineHeight`), translates downstream lines down by `lineHeight`, and focuses offset 0 of the new line.
  - `Backspace` (at `caretOffset === 0`): Merges line text into previous line, deletes current line node, shifts downstream lines up by `lineHeight`, and focuses previous line at merge offset.

### 5. Multi-Node Harvesting on Commit ([InlineEditor.jsx: Lines 540–565](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx#L540-L565))
* Updated `handleCommit` to iterate over all line DOM nodes (`lineRefs.current`), extracting text and citation ranges via `extractTextAndRanges` and `enrichRangesWithOriginalMetadata` before invoking `onCommit`.

---

## Verification Results

* **Vite Production Build:** Successfully compiled frontend modules with zero errors.
* **Line Isolation:** Rendered each line in an isolated `whiteSpace: 'nowrap'` DOM node, eliminating sub-pixel auto-wrapping and word-stealing cascades.
* **Domain Logic Integrity:** Canvas ascenders, toolbar state, and superscript metadata extraction remain 100% functional.
