# Technical Architecture & Implementation Plan: HTML5 Canvas PDF Text Block Editor Engine

## Executive Summary & Motivation

The current PDF inline text editor relies on HTML DOM `contenteditable` elements (`<sup>`, `<sub>`, `<span>`) positioned over PDF page renders. While DOM-based editing is fast to implement, browser rendering engines (Blink, Gecko, WebKit) handle sub-pixel font rasterization, kerning, tracking, and automatic word wrapping inconsistently across operating systems and zoom levels. This leads to line reflow bugs, font metric shifts, and caret misalignments (e.g. words shifting across line boundaries during editing).

By pivoting to a custom **2D HTML5 Canvas Text Editor Engine** (similar to the architecture used by Google Docs, Figma, and Canva), the editing environment gains **100% pixel-perfect control** over line breaks, character advance widths, superscripts, text selection, and caret positioning, completely eliminating browser DOM line wrapping discrepancies and matching PyMuPDF backend metrics precisely.

---

## 1. System Architecture Overview

The Canvas Text Engine operates by completely decoupling the **Data/Input Model** from the **Visual Display**.

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                        User Interactions                               │
  │           (Keyboard input, Mouse Clicks, Selection Dragging)           │
  └───────────────────┬────────────────────────────────┬───────────────────┘
                      │                                │
                      ▼                                ▼
  ┌────────────────────────────────────────┐     ┌─────────────────────────┐
  │ 1. Offscreen Hidden <textarea> Bridge  │     │ 3. Spatial Hit Tester   │
  │    - Captures focus & native typing    │     │    - Mouse (x, y) ──>   │
  │    - Holds selectionStart/End          │     │      (lineIdx, charIdx) │
  │    - Manages IME & Clipboard events    │     └────────────┬────────────┘
  └───────────────────┬────────────────────┘                  │
                      │                                       │
                      ▼                                       │
  ┌───────────────────────────────────────────────────────────▼────────────┐
  │ 2. Text Layout & Measurement Engine                                    │
  │    - PyMuPDF-aware greedy/Knuth-Plass line breaker                     │
  │    - Character advance width measurement (ctx.measureText)             │
  │    - Superscript/Subscript scaling & vertical baseline offsets         │
  └───────────────────┬────────────────────────────────────────────────────┘
                      │
                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 4. 60 FPS Canvas Render Loop                                           │
  │    - Clears frame & draws selection highlight rects                    │
  │    - Renders text glyphs & superscripts with precise offsets           │
  │    - Draws blinking caret bar |                                        │
  └───────────────────┬────────────────────────────────────────────────────┘
                      │
                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 5. PyMuPDF Backend Serializer                                           │
  │    - Packages edited text & line structure into JSON payload           │
  │    - Triggers PyMuPDF redaction & text insertion on backend PDF        │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Subsystems Specification

### Subsystem 1: Offscreen Hidden Input Bridge (`<textarea>`)
- **Purpose**: Delegate keyboard handling, input method editors (IME for international input), mobile virtual keyboards, and native OS copy/cut/paste actions to a standard browser element without letting the browser render any text.
- **Implementation**:
  - A `<textarea>` element with `opacity: 0`, `position: absolute`, `left: -9999px`, and `pointer-events: none`.
  - Syncs `value` with React state `text`.
  - Exposes `selectionStart` and `selectionEnd` to drive the visual selection and cursor positioning.
  - Event Listeners: `onChange`, `onSelect`, `onKeyDown` (forces immediate caret visibility on arrow key movements), and `onBlur`.

### Subsystem 2: Text Measurement & Line Layout Engine
- **Purpose**: Calculate exact character positions, line boundaries, and word wraps matching PyMuPDF bounding boxes (`bbox`).
- **Algorithm**:
  - `computeCanvasTextLayout(ctx, text, maxWidth, fontSize, fontFamily, lineHeight)`:
    1. Tokenize text into words and inline superscripts (e.g. `word³¹` or `<sup>31</sup>`).
    2. Measure word advance widths using `ctx.measureText()`. Superscript advance widths are calculated using `0.65 * fontSize`.
    3. Break text into line arrays respecting `maxWidth` (`blockData.w * scale`).
    4. Maintain strict character offset indices per line to enable instant spatial indexing.

### Subsystem 3: Spatial Hit Testing (Mouse Click & Drag to Caret Position)
- **Purpose**: Translate canvas mouse coordinates `(clickX, clickY)` into an exact character offset index in the underlying string.
- **Algorithm**:
  1. Determine `lineIdx = Math.floor((clickY - topPadding) / lineHeight)`. Clamp to `[0, lines.length - 1]`.
  2. Get `targetLine` text string.
  3. Iterate character indices `i` from `0` to `targetLine.length`, measuring cumulative width `w_i = measureSubstrWidth(ctx, targetLine.substring(0, i))`.
  4. Find `i` that minimizes `|w_i - clickX|`.
  5. Calculate absolute string index: `absoluteIdx = sum(lines[0..lineIdx-1].length + 1) + closestCharIdx`.
  6. Focus `<textarea>` and set native `selectionStart`/`selectionEnd` to `absoluteIdx`.

### Subsystem 4: 60 FPS Canvas Render Loop
- **Purpose**: Paint text glyphs, selection highlight rectangles, bounding box guide borders, and blinking carets cleanly onto the canvas layer.
- **Render Sequence**:
  1. `ctx.clearRect(0, 0, width, height)`.
  2. Draw dashed bounding box border indicating active edit state.
  3. Calculate current line layout.
  4. For each line:
     - **Selection Rect**: If `selection.start < selection.end`, calculate intersecting character range on the line, compute start `X` and width `W`, and draw `ctx.fillStyle = 'rgba(147, 197, 253, 0.6)'` highlight rectangle.
     - **Text Glyphs**: Draw base text using `ctx.fillText()`. If superscripts are present, switch `ctx.font` to `0.65 * fontSize`, apply `-0.25 * fontSize` vertical baseline offset, and render superscript glyphs.
     - **Caret Tracking**: If `selection.start` lies within this line, compute `caretX` and `caretY`.
  5. **Blinking Caret**: If `isFocused` and `caretVisible`, draw 2px wide cursor bar `ctx.fillRect(caretX, caretY, 2, lineHeight)`.

### Subsystem 5: Backend Commit & PDF Exporter
- **Purpose**: Send edited canvas block state to FastAPI backend (`/pdf_routes/editor.py`).
- **Payload**:
  ```json
  {
    "page_index": 0,
    "block_index": 3,
    "text": "Edited paragraph content...",
    "lines": ["Line 1 text...", "Line 2 text..."],
    "bbox": [x0, y0, x1, y1],
    "fontSize": 10.5,
    "fontFamily": "Georgia"
  }
  ```
- Backend executes PyMuPDF redaction on original block bbox and re-inserts fresh text lines with matched font properties.

---

## 3. Existing Codebase Integration Plan

| File Path | Current Role | Canvas Pivot Changes |
| --- | --- | --- |
| [InlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx) | DOM `contenteditable` block editor | **Replace with `CanvasInlineEditor.jsx`**: Pure HTML5 Canvas + hidden `<textarea>` bridge. |
| [Viewer.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx) | Page container & overlay renderer | Update block selection to mount `CanvasInlineEditor` over active text block canvas layer. |
| [pdfEditStore.js](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/stores/pdfEditStore.js) | Zustand store for active PDF edits | Update edit payload format to pass array of line strings and superscript coordinate ranges. |
| [editor.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/pdf_routes/editor.py) | PyMuPDF FastAPI endpoints | Maintain `/detect_font` and update apply-edits endpoint to handle canvas-calculated line arrays. |

---

## 4. Verification & Parity Criteria

1. **Pixel-Perfect Line Boundaries**: Edited text lines must lock to PyMuPDF bounding boxes without paragraph reflow drift or font size collapse.
2. **Superscript Preservation**: Citations (e.g. `al³¹` or `<sup>31</sup>`) stay visually attached to target words with exact baseline offsets.
3. **Smooth Selection & Cursor**: Mouse clicking and dragging on canvas updates selection rectangle and caret position accurately without lag.
4. **Backend Export Integrity**: Generated PDF output matches canvas preview 1-to-1.
