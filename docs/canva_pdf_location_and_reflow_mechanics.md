# Deep-Dive Technical Architecture: PDF Spatial Location Tracking & Paragraph Reflow Engine

This document provides a comprehensive technical breakdown of how modern web-based PDF editors (such as Canva, Adobe Acrobat Web, Figma PDF import, and our custom PyMuPDF + HTML5 Canvas editor) extract the exact spatial locations of words and letters when a paragraph is clicked, and how paragraph reflow logic operates in real time during editing.

---

## Executive Overview

Unlike standard web documents (HTML/CSS) or word processor files (.docx), a PDF **does not naturally contain concept definitions for "paragraphs", "sentences", or "words"**. 

A PDF is essentially a page-based graphics canvas executed by stream commands: instructions specifying *which glyph index from which font file to paint at exact coordinate (x, y)*.

```
Raw PDF Page Stream ──► Glyph Extraction ──► Spatial Clustering ──► Interactive Canvas ──► Dynamic Reflow & Bake
(BT /Tf /Tj ET)         (BBoxes, Origins)   (Words & Paragraphs)   (Hit-Testing & Caret)   (Knuth-Plass / Redaction)
```

To enable WYSIWYG paragraph editing, the engine must execute two primary algorithms:
1. **Spatial & Typographic Reconstruction**: Reverse-engineer raw PDF coordinate streams into hierarchical structures (`Glyph -> Word -> Line -> Paragraph Block`).
2. **Dynamic Canvas Reflow Engine**: Decouple visual rendering from input capture to compute character advance widths, word wraps, baseline alignment, and vector redaction baking.

---

## 1. How the Editor Knows the Exact Location of Words & Letters

When a user clicks on a PDF paragraph, the editor executes a multi-stage spatial pipeline to map the raw screen `(x, y)` coordinate to an exact character index inside a structured paragraph.

```
User Click (Screen X, Y)
       │
       ▼
1. Coordinate Transformation (Screen Px ──► PDF Pt)
       │
       ▼
2. Region & Bounding Box Hit-Testing (PDF Pt ──► Block Bounding Box)
       │
       ▼
3. Line Index Calculation (Y-offset ──► Line Index)
       │
       ▼
4. Advance-Width Search (X-offset ──► Exact Character Index)
```

### 1.1 Step 1: Raw PDF Glyph & Metadata Extraction

When a PDF is parsed (e.g., using **PyMuPDF / fitz** on the backend or **PDF.js** on the frontend), the renderer scans the page operator stream (`BT` Begin Text, `Tf` Set Font, `Tm` Text Matrix, `Tj` / `TJ` Show Text).

Each individual character glyph extracted contains:
- **`char`**: Unicode character representation (e.g., `"A"`).
- **`bbox`**: `[x0, y0, x1, y1]` in PDF point space ($1\text{ pt} = 1/72\text{ inch}$).
- **`origin`**: `(x, y)` coordinate of the character's baseline origin point.
- **`font_family` / `font_name`**: PostScript name of embedded font (e.g., `MetaProLight-Regular`).
- **`size`**: Font size in points.
- **`ascender` / `descender`**: Vertical metrics defining font top/bottom bounds relative to baseline.

#### Handling Ligatures
PDF streams often combine common multi-character glyphs into single ligature codepoints (e.g., `"fi"`, `"fl"`, `"ffi"`). The location extraction engine runs a **Ligature Expansion Algorithm** to divide multi-char glyph bboxes into single-character bounds via linear spatial interpolation:

$$\text{char\_x0}_k = x_0 + \frac{(x_1 - x_0) \cdot k}{N}, \quad \text{char\_x1}_k = x_0 + \frac{(x_1 - x_0) \cdot (k + 1)}{N}$$

---

### 1.2 Step 2: 3-Tier Spatial Clustering (Glyphs ──► Words ──► Lines ──► Paragraphs)

Because glyphs exist as raw coordinates, the editor aggregates them into readable paragraph blocks using a 3-tier heuristic engine:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Raw Extracted Glyphs                            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Word Tokenization: Inter-character gap > 2.5 × median char gap      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Line Grouping: Group words sharing baseline Y within ±1.5pt         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Paragraph Assembly (3-Tier Engine):                                 │
│    • Tier 1 (Rect-Bound): Vector boxes / table cells                   │
│    • Tier 2 (Gap-Clustered): Left-edge bucketing & vertical gap tol    │
│    • Tier 3 (Fallback): Single-line regions                            │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Word Tokenization**:
   Calculates inter-character horizontal gaps $\Delta x = x0_{next} - x1_{prev}$. If $\Delta x > 2.5 \times \text{median\_gap}$, a word boundary (`space`) is inserted.

2. **Line Grouping**:
   Groups words that share the same baseline Y coordinate (within a vertical tolerance, e.g., $\pm 1.5\text{ pt}$).

3. **Paragraph Assembly (Column-Aware Gap Clustering)**:
   - **Column Bucketing**: Lines are sorted into columns by their **left-edge $x_0$ coordinate** (not center point), preventing short centered or left-aligned lines from drifting across columns.
   - **Vertical Gap Tolerance ($v_{tol}$)**: Lines within the same column are merged into a single paragraph block if:
     $$v_{gap} = y0_{next\_line} - y1_{prev\_line} \le \max(2.0\text{ pt}, 0.6 \times \min(h_{prev}, h_{next}))$$
     and font size difference $\le 2.5\text{ pt}$.

---

### 1.3 Step 3: Spatial Hit Testing (Screen Click ──► Caret Index)

When the user clicks the paragraph on screen:

1. **Transform Coordinates**:
   $$\text{pdfX} = \frac{\text{screenX}}{\text{scale}}, \quad \text{pdfY} = \frac{\text{screenY}}{\text{scale}}$$

2. **Paragraph Block Lookup**:
   Scans cached paragraph bboxes to find the block containing `(pdfX, pdfY)`:
   $$x_0 \le \text{pdfX} \le x_1 \quad \text{AND} \quad y_0 \le \text{pdfY} \le y_1$$

3. **Line Hit-Testing**:
   Identifies target line index $L$:
   $$L = \left\lfloor \frac{\text{pdfY} - \text{block\_y0}}{\text{line\_height}} \right\rfloor$$

4. **Character Index Hit-Testing**:
   Within line $L$, iterates through characters $i = 0 \dots M$, calculating cumulative advance widths:
   $$w_i = \text{measureText}(\text{line}[0 \dots i])$$
   Finds $i$ that minimizes $|\text{pdfX} - (x_{\text{line\_start}} + w_i)|$.

5. **Caret Placement**:
   Sets caret position to index $i$ and focuses the underlying headless input capture bridge (`<textarea>`).

---

## 2. How the Reflow Logic Works

When typing or deleting characters inside a selected paragraph, the text length changes. Because PDF lines have fixed bounding widths (`maxWidth`), the editor must re-wrap the paragraph dynamically.

```
                        User Keystroke / Input Event
                                     │
                                     ▼
                    Headless <textarea> Bridge Updated
                                     │
                                     ▼
                   Authoritative State (charMetaRef) Spliced
                                     │
                                     ▼
                  Line Layout & Reflow Engine (computeLineLayout)
                    ├── Tokenize words & superscript runs
                    ├── Measure advance widths via ctx.measureText()
                    ├── Wrap words exceeding maxWidth
                    └── Align lines (left, right, center, justify)
                                     │
                                     ▼
                     60 FPS Canvas Render Loop (drawCanvas)
                    ├── Draw underlay PNG (background graphics)
                    ├── Draw selection highlights & styled text
                    └── Draw metric-derived caret bar |
                                     │
                                     ▼
                   Backend Redaction & Insertion ("Bake")
```

---

### 2.1 The Dual-Model Architecture: Decoupling Input from Display

Canvas-based PDF editors (Canva, Figma, Google Docs) use a **Headless Input Bridge**:

- **Offscreen Capture (`<textarea>`)**: An invisible HTML `<textarea>` (`opacity: 0`, `position: absolute`, `left: -9999px`) handles OS keyboard events, copy/paste, IME composition (e.g., Japanese/Chinese input), and native virtual keyboards.
- **Authoritative Attribute Array (`charMetaRef`)**: Rich-text attributes (font family, font size, bold, italic, baseline rise for superscripts/subscripts, color) are stored in a parallel array mapped 1-to-1 with character indices.
- **On Keystroke**: When input changes in `<textarea>`, the engine calculates common prefix $p$ and suffix windows $(s_{old}, s_{new})$ to splice `charMetaRef` in-place, preserving font styling and superscript rules without re-parsing raw text.

---

### 2.2 The Line Layout & Reflow Algorithm (`computeLineLayout`)

During every frame or keystroke, the layout engine calculates how text flows across lines inside the paragraph's fixed width $\text{maxWidth} = \text{block\_w} \times \text{scale}$.

#### Algorithm Steps:

1. **Hard Split on Explicit Newlines**:
   Splits text on `\n` into hard paragraph segments.

2. **Word & Superscript Unit Assembly**:
   Groups character sequences into word tokens. Inline superscripts/subscripts (e.g., $x^2$ or citation numbers $[1]$) are bound to their preceding word unit as a single reflowable token.

3. **Advance Width Measurement**:
   For each word token $W_k$, computes pixel width using canvas metrics:
   $$\text{width}(W_k) = \sum_{c \in W_k} \text{measureText}(c.\text{displayChar})$$
   *(Superscript character widths use scaled font sizes, e.g., $0.65 \times \text{fontSize}$).*

4. **Greedy Line Wrapping**:
   Iterates through word tokens. Maintains current line width $\text{lineWidth}$:
   - If $\text{lineWidth} + \text{width}(W_k) \le \text{maxWidth}$, append $W_k$ to the current line.
   - If $\text{lineWidth} + \text{width}(W_k) > \text{maxWidth}$, push the current line into `lines[]` and wrap $W_k$ to start a new line.

5. **Text Alignment & Space Distribution**:
   Adjusts character X origins per line based on alignment mode:
   - **Left**: $x_0 = \text{block\_x0}$
   - **Center**: $x_0 = \text{block\_x0} + \frac{\text{maxWidth} - \text{lineWidth}}{2}$
   - **Right**: $x_0 = \text{block\_x0} + (\text{maxWidth} - \text{lineWidth})$
   - **Justify**: For non-final lines, distributes remaining space $\Delta x = \text{maxWidth} - \text{lineWidth}$ evenly across all inter-word space characters.

6. **Prefix/Suffix PDF Anchoring (Pixel-Perfect Overlay)**:
   For lines that remain **unedited** (identical to original PDF text), the renderer locks character X coordinates to raw PDF glyph origins (`origin_x`). This guarantees that unchanged text sits pixel-for-pixel over the background PDF render without micro-jitter. Edited lines flow dynamically using computed advance widths.

---

### 2.3 Canvas Rendering Loop (60 FPS)

Once line layout is computed, the HTML5 Canvas draws the visual state:

1. **`ctx.clearRect()`**: Clears the paragraph edit canvas.
2. **Underlay Render**: Paints a text-free background PNG (extracted from temporary PDF redaction) so background graphics, images, or vector fills stay intact behind new text.
3. **Inline Image Render**: Paints inline vector icons/badges (e.g., ORCID logos, inline figures).
4. **Selection Rectangles**: If text is selected ($\text{selStart} \ne \text{selEnd}$), draws highlighted fill rects (`rgba(147, 197, 253, 0.6)`).
5. **Text Glyphs (`fillText`)**: Iterates line by line, rendering characters with specific font weights, colors, and vertical baseline rise offsets ($+0.30 \times \text{fontSize}$ for superscripts).
6. **Metric-Derived Blinking Caret**:
   Calculates precise caret height and Y position from the active run's font metrics:
   $$\text{caretAscent} = \text{measureText}('|').\text{actualBoundingBoxAscent}$$
   $$\text{caretY} = y_{\text{baseline}} - \text{rise} - \text{caretAscent}$$
   Paints a 2px-wide vertical bar at $\text{caretX}, \text{caretY}$.

---

### 2.4 Backend Redaction & Insertion ("Baking" Phase)

When the user finishes editing and clicks **"Finish & Export"**, the client commits the reflowed paragraph back to the backend PDF engine (e.g. PyMuPDF FastAPI service):

```
Client Payload (Edited Text, Lines, Fonts, Superscript Ranges, Bounding Box)
                                │
                                ▼
1. Span Run Extraction (Capture existing font, color, size metrics in edit rect)
                                │
                                ▼
2. Target Vector Redaction (page.add_redact_annot + page.apply_redactions)
   • Clears original text streams inside paragraph bbox
   • Preserves underlying images and line art (PDF_REDACT_IMAGE_NONE)
                                │
                                ▼
3. Font Registration (page.insert_font with base64 OTF/TTF buffer)
                                │
                                ▼
4. Run-Faithful Baseline Re-insertion (page.insert_text anchored to baselines)
   • Emits reflowed text line by line onto original baseline coordinates
```

---

## Summary Comparison Matrix

| Step | How Location Is Known | How Reflow Logic Works |
| :--- | :--- | :--- |
| **Data Extraction** | PyMuPDF/PDF.js extracts raw glyph bboxes `[x0,y0,x1,y1]` and baseline origins `(x,y)` from PDF stream operators (`TJ`/`Tj`). | Captures original font properties, line height, baseline pitch, and paragraph column width (`maxWidth`). |
| **Clustering / Layout** | 3-tier gap clustering aggregates free lines into column-bound paragraph blocks using left-edge bucketing. | Groups characters into word units and measures advance widths using `ctx.measureText()`. |
| **Hit Testing / Input** | Click `(screenX, screenY)` converted to PDF pt $\rightarrow$ bbox containment $\rightarrow$ line index $\rightarrow$ character advance width search. | Keystrokes update offscreen `<textarea>` bridge and splice parallel attribute array (`charMetaRef`). |
| **Visual Rendering** | Renders selection rects and metric-derived carets directly over glyph locations. | Re-calculates line breaks dynamically; wraps words exceeding `maxWidth`; applies space distribution for `justify`. |
| **Export / Baking** | Redaction annotations wipe exact original text bounding box. | PyMuPDF re-inserts reflowed text lines onto page stream anchored to original baselines. |

---

## Technical Files in Codebase

For deeper implementation code in this workspace, refer to:
- **Architecture & System Design**: [`docs/pdf_editor_architecture.md`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/docs/pdf_editor_architecture.md)
- **Canvas Editor Pivot Spec**: [`docs/canvas_pdf_text_block_editor_pivot.md`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/docs/canvas_pdf_text_block_editor_pivot.md)
- **Backend Typography & Region Extraction**: [`backend/pdf_routes/editor.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/pdf_routes/editor.py)
- **Backend Redaction & Bake Engine**: [`backend/converter/pdf_edit.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py)
- **Frontend Canvas Block Editor**: [`frontend/src/components/PDFEditor/CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx)
- **Frontend PDF Viewer & Paragraph Builder**: [`frontend/src/components/PDFEditor/Viewer.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/Viewer.jsx)
