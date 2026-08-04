# PDF Editor — Full Technical Architecture

> **Last updated:** 2026-08-04  
> **Stack:** FastAPI (Python) backend · React + Vite frontend · PyMuPDF (fitz) · PDF.js (react-pdf)

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Repository Layout](#2-repository-layout)
3. [Backend — `backend/pdf_routes/editor.py`](#3-backend--backendpdf_routeseditorpy)
4. [Frontend State Layer — Stores](#4-frontend-state-layer--stores)
5. [Frontend — `Viewer.jsx`](#5-frontend--viewerjsx)
6. [Frontend — `CanvasInlineEditor.jsx`](#6-frontend--canvasinlineeditorjsx)
7. [Frontend — `InlineEditor.jsx`](#7-frontend--inlineeditorjsx)
8. [Frontend — Supporting Components](#8-frontend--supporting-components)
9. [Utility Layer](#9-utility-layer)
10. [End-to-End Data Flow Diagram](#10-end-to-end-data-flow-diagram)
11. [Key Coordinate Systems](#11-key-coordinate-systems)
12. [Critical Algorithms Reference](#12-critical-algorithms-reference)

---

## 1. High-Level Overview

The PDF Editor is a WYSIWYG in-place editor that lets a user click on any paragraph in a PDF and type to change it. It works through a tight loop between a Python/FastAPI backend (which understands the raw PDF geometry) and a React frontend (which renders the visual editing interface on top of the PDF.js canvas).

```
User uploads PDF
      │
      ▼
Backend /extract-spacing  ──────►  Typography Engine (PyMuPDF)
      │                                     │
      │                            3-tier region extraction
      │                            (rect-bound → gap-clustered → per-line)
      │
      ▼
spacingData (JSON) sent to React
      │
      ▼
Viewer.jsx  ──►  builds paragraphItems (PDF-space boxes)
      │
      ▼
CanvasInlineEditor.jsx  ──►  HTML5 Canvas draws each box
      │                       Offscreen textarea captures keystrokes
      │
      ▼
User edits text  ──►  pdfEditStore (undo/redo store)
      │
      ▼
"Bake" button  ──►  Backend /bake  ──►  PyMuPDF redacts + reinserts text
      │
      ▼
New PDF bytes streamed back  ──►  Viewer re-renders with new PDF
```

---

## 2. Repository Layout

```
Writing_Tools_Production/
├── backend/
│   ├── main.py                        # FastAPI app entry point, mounts all routers
│   ├── pdf_routes/
│   │   └── editor.py                  # THE PDF editing engine (999 lines)
│   └── converter/
│       └── font_utils.py              # CFF→OTF wrapping, cmap injection, stem-vw extraction
│
└── frontend/src/
    ├── App.jsx                        # Root shell, navigation, persistent view mounting
    ├── pages/
    │   └── PDFEditorPage.jsx          # Top-level page: file upload, bake orchestration
    ├── components/PDFEditor/
    │   ├── Viewer.jsx                 # PDF.js renderer + paragraph item builder (1548 lines)
    │   ├── CanvasInlineEditor.jsx     # Per-paragraph Canvas editor (1989 lines)
    │   ├── InlineEditor.jsx           # Legacy contentEditable editor (727 lines)
    │   ├── RightPanel.jsx             # Tool settings sidebar
    │   ├── Toolbar.jsx                # Left toolbar (tool picker)
    │   ├── DebugOverlay.jsx           # Ctrl+Shift+D debug bbox overlay
    │   ├── TextOverlay.jsx            # Thin shim for annotation placement
    │   ├── DraggableItem.jsx          # Drag-and-drop wrapper for annotations
    │   └── superscriptUtils.js        # Unicode super/sub char maps (shared, non-JSX)
    ├── stores/
    │   ├── pdfEditStore.js            # Observable edit store (undo/redo)
    │   └── pdfTypographyStore.js      # Observable typography/paragraph store
    └── utils/
        ├── pdfCoords.js               # pdfToScreen() coordinate transform helper
        └── pdfFontLoader.js           # @font-face injection + stem-vw cache
```

---

## 3. Backend — `backend/pdf_routes/editor.py`

This is the core of the system. All PDF geometry extraction, region grouping, font extraction, and text baking happen here via **PyMuPDF** (`fitz`).

### 3.1 API Routes

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/pdf/extract-spacing` | **Main entry point.** Sends full typography payload (blocks, columns, inline images) for every page. Also caches in `TYPOGRAPHY_CACHE`. |
| `POST` | `/pdf/extract-typography` | Identical to extract-spacing but returns a wrapped `{doc_id, pages, total_paragraphs}` object. |
| `GET`  | `/pdf/typography/{doc_id}` | Retrieves a previously cached typography payload by its SHA-256 doc_id. |
| `POST` | `/pdf/extract-fonts` | Extracts all embedded fonts from the PDF as base64-encoded OTF/TTF blobs for `@font-face` injection. |
| `POST` | `/pdf/detect_font` | Hit-test a raw (x, y) coordinate — returns font name, size, and text of the nearest span. |
| `POST` | `/pdf/run_ocr` | Runs OCRmyPDF on a scanned PDF to add a text layer, returns selectable PDF. |
| `POST` | `/pdf/encrypt` | Encrypts a PDF with a password using pypdf. |
| `POST` | `/pdf/bake` | Receives edit instructions, uses PyMuPDF redact+insert to produce a modified PDF. |

### 3.2 Typography Engine Pipeline

**Entry function:** `get_pdf_spacing_payload(pdf_bytes, doc_id)`

Called by both `/extract-spacing` and `/extract-typography`. For every page:

1. Opens the PDF with `fitz.open(stream=pdf_bytes, filetype="pdf")`
2. Collects `page_images = page.get_image_info(xrefs=True)` and `page_drawings = page.get_drawings()`
3. Calls `extract_page_spacing_data(page, ...)` → list of block dicts
4. Calls `_get_column_boundaries(page)` → `[[x_left, x_split], [x_split, x_right]]` or `[[x_left, x_right]]`
5. Extracts all inline images as base64 PNG blobs
6. Appends `{page, blocks, columns, inline_images}` to payload

**Output shape per page:**
```json
{
  "page": 0,
  "columns": [[144.0, 351.3], [351.3, 560.0]],
  "inline_images": [{"bbox": [x0,y0,x1,y1], "data": "<base64>", "ext": "png"}],
  "blocks": [
    {
      "paragraph_id": "p_0_3",
      "block_number": 3,
      "font_size": 9.0,
      "font_family": "MetaProLight-Regular",
      "font_color": "rgb(0,0,0)",
      "hex_color": "#000000",
      "is_bold": false,
      "is_italic": false,
      "align": "justify",
      "bbox": [144.0, 212.5, 351.3, 248.1],
      "pdfX": 144.0, "pdfY_top": 212.5,
      "pdfW": 207.3, "pdfH": 35.6,
      "text": "Background\nThe effectiveness of...",
      "line_count": 4,
      "lines": [...],
      "underlay": null,
      "region_kind": "gap"
    }
  ]
}
```

### 3.3 Region Extraction (3-Tier System)

**Function:** `extract_page_spacing_data(page, page_idx, page_images, page_drawings, pdf_bytes)`

#### Tier 1 — Rect-Bound (vector structure)

`_collect_enclosing_rects(page)` scans `page.get_drawings()` for true rectangle operations. Rects smaller than 8×8pt or covering >90% of the page are skipped. Near-identical rects (±0.5pt) are de-duplicated.

For each text line, `_innermost_rect()` finds the smallest enclosing rectangle. Lines sharing the same rect are grouped — capturing table cells, text boxes, and sidebars.

#### Tier 2 — Gap-Clustered (free lines, per column)

Lines not captured by any rect are "free lines". They are partitioned into columns by their **`line_x0` (left edge)** value — NOT center, because a line's left edge reliably identifies its column regardless of line width.

**Debug log emitted:** `[REGIONS-DEBUG] page N: cols=[...] bucket_sizes={0: 70, 1: 51}`

Within each column's bucket, `_cluster_free_lines(bucket)` runs:

```python
v_gap  = nb.y0 - pb.y1                              # vertical gap between lines
v_tol  = max(2.0, 0.6 * min(pb.height, nb.height)) # 60% of shorter line height
x_close = left-edge alignment OR >30% horizontal overlap
size_ok = abs(prev.size - nxt.size) <= 2.5pt
family_similar = same base font family (strip weight/style suffixes)
merge_ok = size_ok OR (size_diff <= 1.0pt AND family_similar)

if v_gap <= v_tol AND x_close AND merge_ok:
    merge into current cluster
```

The 0.6× factor handles academic papers where inter-line gaps can be 4–5pt on 8–9pt text.

#### Tier 3 — Per-Line Fallback

If Tiers 1+2 produce no regions, every line becomes its own single-line region.

#### Block Assembly

After sorting regions by `(column_index, y0, x0)`, for each region the function:

1. Computes **dominant font, size, color, bold, italic** from all non-space chars
2. Computes **union bounding box** = all char bboxes + intersecting image bboxes + intersecting drawing bboxes
3. Detects **text alignment** (justified, centered, right, left)
4. If the union bbox contains non-text content, renders a **text-free underlay PNG** at 144 DPI from a temporary redacted copy — sent to the frontend as base64 so the canvas editor can redraw images behind new text
5. Appends the complete block dict to `blocks_out`

**Diagnostic log:** `[REGIONS] page N: rect_regions=5 free_lines=121 regions=27`

### 3.4 Column Detection

**Function:** `_get_column_boundaries(page)`

1. Collect all line left-edge `x0` values; skip lines narrower than 20pt
2. Find dominant font size (most common size bucket, 0.5pt precision)
3. Filter to lines at the dominant size
4. Bucket `x0` values into bins of `max(dominant_size, 6.0)` pt width
5. Find the two most popular buckets
6. **Two-column test:** both clusters ≥15% of lines AND ≥50pt apart
7. If two-column: find actual gap between columns → `split_x = midpoint`
8. Return `[[text_x_min, split_x], [split_x, text_x_max]]` or `[[text_x_min, text_x_max]]`

### 3.5 Font Extraction Route

**Route:** `POST /pdf/extract-fonts`

For every embedded font xref:
1. Extracts raw font bytes via `doc.extract_font(xref)`
2. CFF format: wraps in OTF container via `wrap_cff_in_otf()` (browsers can't load bare `.cff` files via `@font-face`)
3. Injects a valid `cmap` subtable via `_inject_cmap()` so the browser can map Unicode → glyph IDs
4. Skips Type1, Type3, and other browser-incompatible formats
5. Extracts **StdVW stem-width ratio** for canvas stem darkening compensation
6. Returns `{ basename: { data, format, postscript_name, subset_tag, stem_vw_ratio } }`

### 3.6 Bake Route

Receives a list of edit instructions. For each edit:

1. **Redact** with `page.add_redact_annot(rect)` + `page.apply_redactions(images=PDF_REDACT_IMAGE_NONE, graphics=PDF_REDACT_LINE_ART_NONE)` — removes text while preserving inline images and vector art
2. **Reinsert** with `page.insert_text(origin, new_text, fontname, fontsize, color)`
3. Returns modified PDF bytes

---

## 4. Frontend State Layer — Stores

Both stores implement the React `useSyncExternalStore` interface without any external state library.

### 4.1 `pdfEditStore.js`

**Purpose:** Tracks all user text edits in memory with undo/redo history.

```js
store      = Map<fileId, Edit[]>      // current edits
undoStacks = Map<fileId, Edit[][]>    // up to 50 snapshots per file
redoStacks = Map<fileId, Edit[][]>
```

**Edit object shape:**
```js
{
  pageNum: 1, nodeIndex: 3,
  origStr: "Background",         // original text before any edits
  newStr: "Introduction",        // current edited text
  pdfX, pdfY_top,                // PDF-space position
  pdfDx, pdfDy,                  // drag repositioning delta
  superscriptRanges: [...],
  isBold, isItalic, color,
  fontSizeAdj, customFontFamily,
}
```

**Key methods:**
- `commitEdit(fileId, edit)` — upserts by `(pageNum, nodeIndex)`, pushes undo snapshot
- `undo(fileId)` / `redo(fileId)` — classic undo/redo via stack swap
- `clearEdits(fileId)` — called after a bake so stale `nodeIndex` mappings don't survive into the new PDF

### 4.2 `pdfTypographyStore.js`

**Purpose:** Caches the full typography payload so any component can look up paragraph metadata by `(docId, pageIndex, x, y)` without prop drilling.

**Key methods:**
- `setTypographyData(docId, payload)` — normalizes and stores the backend payload
- `getParagraphsForPage(docId, pageIndex)` → `Block[]`
- `getParagraphAt(docId, pageIndex, x, y)` → `Block | null` — hit-tests by bbox containment
- `getFontSummary(docId)` → unique fonts, sizes, colors, and per-style paragraph counts

---

## 5. Frontend — `Viewer.jsx`

The largest frontend file (1548 lines). Responsible for rendering the PDF, transforming `spacingData` into editor-ready `paragraphItems`, overlaying `CanvasInlineEditor` instances, and handling all canvas tool interactions.

### 5.1 Dual-Document Flash Prevention

When a baked PDF arrives the viewer keeps the old document rendered as an opaque backdrop while the new one loads invisibly underneath. The instant `onLoadSuccess` fires, the backdrop disappears and the new document becomes visible — zero blank-canvas flash.

### 5.2 Font Injection

On every new PDF load: calls `POST /pdf/extract-fonts` → passes to `loadPDFFonts(fontsData)` in `utils/pdfFontLoader.js` → creates `@font-face` CSS rules → awaits `document.fonts.ready` → stores `stem_vw_ratio` per font name for canvas stem darkening.

### 5.3 spacingData → paragraphItems Pipeline

**Step 1: Line Item Construction**

For each line in each block:
1. `groupCharsIntoWords(lineData)` — groups chars into words using inter-character gap statistics (gap > 2.5× median gap = word boundary)
2. Detects **dominant baseline** and **dominant font size**
3. Classifies each char as `normal`, `super`, or `sub`
4. Builds `superscriptRanges` and a `lineItem` with full coordinate data

**Step 2: Baseline Conflict Regroup**

If two blocks share the same baseline, line items for those baselines are regrouped word-by-word, splitting on column boundaries.

**Step 3: Block → Paragraph Mapping**

Each backend block is matched to line items by `(y ± 3.5pt, x ± 40pt)`. If a block spans multiple font families or sizes (>1.5pt), it is split into homogeneous sub-groups. Each sub-group becomes a `paragraphItem`:

```js
{
  str,                        // full text with \n line separators
  lines, origLines,           // per-line arrays for coordinate lookup
  pdfX, pdfY_top, pdfW, pdfH, // union bbox
  isParagraph: true,
  align,                      // justify | center | right | left
  lineHeight,                  // baseline pitch in PDF points
  textIndent,                 // first-line indent in PDF points
  inlineImages,               // images whose bboxes intersect this paragraph
  underlay,                   // base64 PNG of non-text content in the region
  paragraphTypography: { font_size, font_family, color, align, paragraph_id }
}
```

**Post-render enrichment:** After React renders the page, a `useEffect` matches each item to a PDF.js text-layer `<span>` by text content. For each matched span it captures rendered `pdfW`, `renderedFontFamily`, `color`, `isBold`, `isItalic` — used as fallbacks only if the authoritative backend flags are undefined.

### 5.4 Canvas Tool System

Pointer events on each page container handle:
- `highlight` → rectangle highlight annotation
- `draw` / `signature` → freehand path annotation
- `shape` → rect/circle/line/arrow shape annotation
- `eraser` → white rectangle annotation
- `sticky` → sticky note (via `window.prompt`)
- `image` → dropped image via FileReader

All coordinates are in PDF points (divided by `scale`). Annotations stored in React state in `PDFEditorPage`.

---

## 6. Frontend — `CanvasInlineEditor.jsx`

The most complex frontend file (1989 lines). Each `paragraphItem` gets its own instance when clicked. Uses a **headless `<textarea>` + `<canvas>`** pattern:
- Textarea positioned offscreen captures all keyboard input
- Canvas is the visual rendering surface (text, selections, caret)

### 6.1 Geometry Safety-Net (bbox Union)

Before any rendering, `item` is expanded via `useMemo` to include all char bboxes and inline image bboxes. This prevents bullet glyphs, Symbol-font characters (⇒, ►), and ORCID badges from rendering at negative canvas coordinates.

### 6.2 Character Metadata Pipeline

**`parseCharMetadata(rawText, initialRanges, origLines)`**

Builds `charMeta[]` — one entry per character — recording kind (normal/super/sub), color, per-char font, and PDF origin coordinates.

Algorithm:
1. Build `rawNonSpace[]` and `backendNonSpace[]` (non-whitespace chars from both sources)
2. Walk **prefix match** from left — count aligned chars
3. Walk **suffix match** from right — count aligned chars
4. Build `rawToBackendMap: rawCharIdx → backendCharMeta`
5. For each raw char, look up its backend metadata

The prefix/suffix approach is robust to text edits: inserted/deleted chars in the middle don't corrupt alignment at the start/end.

### 6.3 Ligature Expansion

**`expandMultiCharEntries(chars)`**

PyMuPDF emits ligatures (fi, fl, ffi) as a single entry with multi-codepoint `c`. This breaks the 1:1 assumption. The helper splits each into individual entries with **linearly interpolated geometry**:

```js
const sx0 = x0 + ((x1 - x0) * k) / c.length;
const sx1 = x0 + ((x1 - x0) * (k + 1)) / c.length;
```

Applied at:
- `backendChars` in `parseCharMetadata`
- `pdfChars` in `computeLineLayout`'s `pushLine`

### 6.4 Layout Engine (`computeLineLayout`)

Called on every render. Performs full text layout:

1. **Font construction** — CSS font string: `"italic bold 9px MetaProLight-Regular, serif"`
2. **Ascender measurement** — `ctx.measureText('Hpx').actualBoundingBoxAscent` for pixel-perfect baseline
3. **Line splitting** — splits `text` on `\n` (hard PDF line boundaries)
4. **Unit building** — groups chars into word units with measured widths
5. **Overflow reflow** — units exceeding `targetWidth` carry to the next canvas line
6. **Atomic citation binding** — orphaned superscript units are merged back into the previous unit
7. For each canvas line: calls `pushLine()` for PDF coordinate anchoring

### 6.5 PDF Coordinate Anchoring

In `pushLine()`, for unedited lines:

1. Build `pdfWords[]` and `lineWords[]`
2. Walk **word-level prefix match** (how many words from the start still match the PDF)
3. Walk **suffix match** (how many words from the end still match)
4. Prefix chars → draw at original `origin_x` from PyMuPDF (exact PDF glyph placement)
5. Suffix chars → draw at `lastPrefixX + canvasFlow + deltaX` (PDF suffix anchoring)
6. Middle (edited) chars → pure canvas flow layout

This preserves pixel-perfect glyph placement for unchanged text while allowing freely-typed text to flow naturally.

### 6.6 Canvas Drawing (`drawCanvas`)

Sequence on every render:
1. `ctx.clearRect()`
2. Draw **underlay PNG** (non-text content background, e.g. containing a formula image)
3. Draw **inline images** (ORCID badges, decoded and cached in `imgCache` ref)
4. For each layout line:
   - Set `ctx.font`
   - Apply **stem darkening offset** to baseline Y (CFF fonts only)
   - Draw **selection highlight** rectangle if selection overlaps
   - For each char: `ctx.fillText(displayChar, x, baselineY)`, advance `x` by measured width
5. Draw **blinking caret** (1px vertical line, 500ms interval)

**DPR:** Canvas physical size = `Math.round(r.w * dpr)` × `Math.round(r.h * dpr)`. CSS size = `physical / dpr`. All drawing is in CSS pixels — no `ctx.scale(dpr, dpr)` needed.

### 6.7 Stem Darkening / Font Weight Compensation

CFF fonts have FreeType synthetic stem darkening that the browser canvas does not replicate, making canvas text appear thinner. Compensation:

1. Backend extracts `StdVW` from CFF Private dict → `stem_vw_ratio = StdVW / 1000`
2. `targetStemWidthPx = stemVwRatio × fontSizePx`
3. `nativeStemWidthPx = measureNativeStemWidthPx()` — renders `'l'` at 256px on a probe canvas, counts alpha-covered pixels
4. `offset = max(0, targetStemWidthPx - nativeStemWidthPx)` added to canvas baseline Y

TrueType / Base-14 fonts (`stemVwRatio == null`): zero darkening — browser hinting handles these.

### 6.8 Commit / Bake Flow

**Commit:** click outside (captured in document mousedown capture phase) or Enter in single-line mode:
1. `sanitizeForCommit(text)` — converts `\u00A0` → regular spaces
2. `extractRangesFromCharMeta()` — rebuilds superscriptRanges from charMeta
3. `onCommit(edit)` → `pdfEditStore.commitEdit(fileId, edit)`

**Bake:** user clicks "Finish & Export":
1. Collect all edits from `pdfEditStore.getEdits()`
2. `POST /pdf/bake` with edit list + original PDF bytes
3. Receive new PDF bytes → update `file` prop → dual-doc transition
4. `POST /pdf/extract-spacing` on new PDF → new `spacingData` → new boxes
5. `pdfEditStore.clearEdits()` — stale pre-bake edits removed

---

## 7. Frontend — `InlineEditor.jsx`

The **legacy** inline editor (727 lines). Uses `contentEditable` instead of canvas. Used for drag-and-drop text annotations and legacy simple edit mode.

Key utilities:
- `buildInitialChildren(str, superscriptRanges)` — renders `<sup>` / `<sub>` HTML inside the contentEditable span
- `sanitizeForDisplay()` — leading spaces → `\u00A0` so `contentEditable` doesn't strip them
- `sanitizeForCommit()` — converts `\u00A0` back before saving

---

## 8. Frontend — Supporting Components

| Component | Role |
|-----------|------|
| `RightPanel.jsx` | Tool settings sidebar (color pickers, opacity, shape type). Contains "Finish & Export" button. |
| `Toolbar.jsx` | Left-side vertical toolbar. Sets `activeTool`. |
| `DebugOverlay.jsx` | Activated by `Ctrl+Shift+D`. Renders red bbox overlays with `paragraph_id`, font name, size labels. |
| `TextOverlay.jsx` | Positions an element at a PDF-space coordinate. Used for annotation overlays. |
| `DraggableItem.jsx` | Pointer-event drag wrapper. Translates drag deltas to PDF-space coordinate updates. |
| `superscriptUtils.js` | Exports `SUPER_MAP`, `UNICODE_SUPER_MAP`, `UNICODE_SUB_MAP`. Non-JSX (required for Vite Fast Refresh). |

---

## 9. Utility Layer

### `utils/pdfCoords.js` — `pdfToScreen(item, scale)`

Converts PDF-space item (`pdfX`, `pdfY_top`, `pdfW`, `pdfH`) to CSS screen coordinates. Transform: `screenPx = pdfPt × scale`. No Y-axis flip needed — PyMuPDF uses Y-down (top of page = 0), matching CSS.

### `utils/pdfFontLoader.js` — `loadPDFFonts(fontsData)`

1. Creates `FontFace` objects with base64 data → adds to `document.fonts` → `.load()`
2. Awaits `document.fonts.ready`
3. Stores `stem_vw_ratio` per PostScript name in a module-level `Map`
4. Exports `getFontStemVwRatio(fontName)` for the canvas editor

---

## 10. End-to-End Data Flow Diagram

```
PDF Upload
    │
    ▼
PDFEditorPage.jsx
    ├── POST /pdf/extract-spacing ─────────────────────────────────────────────┐
    │       │                                                                  │
    │   editor.py: get_pdf_spacing_payload()                                   │
    │       ├── _get_column_boundaries(page)                                   │
    │       ├── _collect_enclosing_rects(page)         [Tier 1]               │
    │       ├── _extract_all_lines() [rawdict → per-char metadata]             │
    │       ├── column bucket by line_x0               [left-edge bucketing]   │
    │       ├── _cluster_free_lines(bucket)            [Tier 2, v_tol=0.6×h]  │
    │       ├── per-line fallback                       [Tier 3]              │
    │       └── union bbox + underlay PNG per block                            │
    │   → spacingData ◄─────────────────────────────────────────────────────────┘
    │
    ├── POST /pdf/extract-fonts
    │       └── fitz.extract_font() → CFF→OTF → cmap inject → base64
    │   → fontsData → loadPDFFonts() → @font-face in <head>
    │
    ▼
Viewer.jsx
    ├── Renders PDF via <Document> + <Page> (react-pdf / PDF.js)
    │
    ├── useEffect([spacingData, pageMetadata])
    │     ├── groupCharsIntoWords()          [inter-char gap clustering]
    │     ├── Classify super/sub chars
    │     ├── Build lineItems[]
    │     ├── Regroup split baselines
    │     ├── Map backend blocks → paragraphItems
    │     └── setPageMetadata(pageNum, { items })
    │
    ├── useEffect([pageMetadata, scale])     [post-render color sampling]
    │     Match items to PDF.js <span> by text → capture rendered width/color/font
    │
    ▼
Per-paragraphItem: CanvasInlineEditor
    ├── expandMultiCharEntries()             [ligature splitting]
    ├── parseCharMetadata()                  [prefix/suffix char→backend mapping]
    ├── useMemo: bbox union safety-net
    │
    ├── computeLineLayout(ctx)
    │     ├── measureText() per char/unit
    │     ├── Overflow reflow across lines
    │     ├── expandMultiCharEntries() on pdfChars
    │     ├── Word-level prefix/suffix PDF anchoring
    │     └── Return lines[] with per-char x positions
    │
    └── drawCanvas()
          ├── Draw underlay PNG (non-text background)
          ├── Draw inline images (ORCID, formula images)
          ├── Draw selection highlights
          ├── fillText() per char with stem-darkening offset
          └── Draw blinking caret

User types → pdfEditStore.commitEdit()   [undo stack maintained]

"Bake" clicked
    │
    ▼
POST /pdf/bake
    ├── page.add_redact_annot(rect)
    ├── page.apply_redactions(images=NONE, graphics=NONE)
    └── page.insert_text(origin, newStr, fontname, fontsize, color)
    → new PDF bytes

New PDF → Viewer (dual-doc transition, no flash)
POST /pdf/extract-spacing (new PDF) → new spacingData → new boxes
pdfEditStore.clearEdits()
```

---

## 11. Key Coordinate Systems

| System | Origin | Units | Used In |
|--------|--------|-------|---------|
| **PDF points** | Top-left of page, Y-down | pt (1/72 inch) | PyMuPDF (`fitz.Rect`), all backend outputs |
| **CSS/screen pixels** | Top-left of page container, Y-down | px | Viewer.jsx positioning, CanvasInlineEditor CSS |
| **Canvas pixels** | Top-left of canvas element, Y-down | px | Canvas 2D context drawing |

**Transform:** `screenPx = pdfPt × scale`

**DPR:** Canvas physical size = `round(cssPx × DPR)`. Drawing coordinates are in CSS pixels. No `ctx.scale()` needed because physical canvas size maps 1:1 to DPR-scaled pixels.

All coordinates use **Y-down** convention (Y=0 at top of page) at every layer — no axis flip is ever needed.

---

## 12. Critical Algorithms Reference

### Gap Clustering Tolerance
```python
v_tol = max(2.0, 0.6 * min(pb.height, nb.height))
```
- 2pt floor prevents micro-gaps splitting small text
- 0.6× factor handles academic papers with generous inter-line spacing (4–5pt gaps on 8–9pt text)

### Column Bucketing (Left-Edge, not Center)
```python
x0 = ln["line_x0"]
for i, (c0, c1) in enumerate(cols):
    if c0 - 5 <= x0 <= c1 + 5: idx = i; break
if idx is None:
    idx = min(range(len(cols)), key=lambda i: abs(x0 - cols[i][0]))
```
Short lines' centers drift toward the column split; left edges never do.

### Prefix/Suffix PDF Anchoring
Canvas lines byte-identical to the original PDF line use `origin_x` from PyMuPDF for character placement. Preserved: exact glyph positions, inter-character kerning. Edited text: pure canvas flow. Result: unchanged text sits pixel-perfectly over the PDF.js render.

### Ligature Expansion
```js
// "fi" → [{c:"f", x0, x1: midpoint}, {c:"i", x0: midpoint, x1}]
const sx0 = x0 + ((x1 - x0) * k) / c.length;
```
Restores 1:1 char↔backend-meta correspondence broken by PyMuPDF ligature glyph merging.

### Stem Darkening Compensation
```js
const targetStemWidthPx = stemVwRatio * fontSizePx;
const nativeStemWidthPx = measureNativeStemWidthPx(fontString, dpr);
const offset = Math.max(0, targetStemWidthPx - nativeStemWidthPx);
```
CFF-only. Aligns canvas stroke weight with FreeType's automatic stem darkening for visual consistency between the PDF.js layer and the canvas editor.

### Alignment Detection
```python
# Justified: non-last lines touch both left AND right column edges (within 18pt)
# Centered: all line midpoints within 5pt of block center
# Right: all line right-edges within 5pt of block right edge
# Default: left
```
