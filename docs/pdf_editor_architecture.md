# PDF Editor — Full Technical Architecture

> **Last updated:** 2026-08-04  
> **Stack:** FastAPI (Python) backend · React + Vite frontend · PyMuPDF (fitz) · PDF.js (react-pdf)

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Repository Layout](#2-repository-layout)
3. [Backend Architecture](#3-backend-architecture)
   - [3.1 API Routes](#31-api-routes)
   - [3.2 Typography Engine Pipeline (`editor.py`)](#32-typography-engine-pipeline-editorpy)
   - [3.3 Region Extraction Engine (3-Tier System)](#33-region-extraction-engine-3-tier-system)
   - [3.4 Column Detection](#34-column-detection)
   - [3.5 Font Extraction & CFF->OTF Wrapping (`font_utils.py`)](#35-font-extraction--cff-otf-wrapping-font_utilspy)
   - [3.6 Edit & Bake Engine (`pdf_edit.py`)](#36-edit--bake-engine-pdf_editpy)
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

The PDF Editor is a WYSIWYG in-place editor that lets a user click on any paragraph in a PDF and type to change it. It works through a tight loop between a Python/FastAPI backend (which understands raw PDF geometry, font metrics, and redaction) and a React frontend (which renders the visual editing interface on top of the PDF.js canvas).

```
User uploads PDF
      │
      ▼
Backend /api/pdf/extract-spacing  ──►  Typography Engine (PyMuPDF)
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
      │                       charMetaRef holds authoritative attribute model
      │
      ▼
User edits text  ──►  pdfEditStore (undo/redo store)
      │
      ▼
"Bake" button  ──►  Backend /api/pdf/apply-edits  ──►  PyMuPDF redacts + reinserts text
      │
      ▼
New PDF bytes streamed back  ──►  Viewer re-renders with new PDF
```

---

## 2. Repository Layout

```
Writing_Tools_Production/
├── backend/
│   ├── main.py                        # FastAPI app entry point, mounts all routers (69 lines)
│   ├── pdf_routes/
│   │   └── editor.py                  # Typography engine, layout extraction & font API (1167 lines)
│   └── converter/
│       ├── pdf_edit.py                # Core PDF redaction, paragraph bake & edit engine (2291 lines)
│       └── font_utils.py              # CFF→OTF wrapping, OTF name table fix, stem-vw extraction (1373 lines)
│
└── frontend/src/
    ├── App.jsx                        # Root shell, navigation, persistent view mounting (203 lines)
    ├── pages/
    │   └── PDFEditorPage.jsx          # Top-level page: file upload, bake orchestration (452 lines)
    ├── components/PDFEditor/
    │   ├── Viewer.jsx                 # PDF.js renderer + paragraph item builder (1582 lines)
    │   ├── CanvasInlineEditor.jsx     # Per-paragraph Canvas editor with charMetaRef model (2098 lines)
    │   ├── InlineEditor.jsx           # Legacy contentEditable editor (726 lines)
    │   ├── RightPanel.jsx             # Tool settings sidebar (346 lines)
    │   ├── Toolbar.jsx                # Left toolbar (tool picker) (115 lines)
    │   ├── DebugOverlay.jsx           # Ctrl+Shift+D debug bbox overlay (87 lines)
    │   ├── TextOverlay.jsx            # Thin shim for annotation placement (108 lines)
    │   ├── DraggableItem.jsx          # Drag-and-drop wrapper for annotations (111 lines)
    │   └── superscriptUtils.js        # Unicode super/sub char maps (shared, non-JSX) (36 lines)
    ├── stores/
    │   ├── pdfEditStore.js            # Observable edit store (undo/redo) (128 lines)
    │   └── pdfTypographyStore.js      # Observable typography/paragraph store (229 lines)
    └── utils/
        ├── pdfCoords.js               # pdfToScreen() coordinate transform helper (19 lines)
        └── pdfFontLoader.js           # @font-face injection + stem-vw cache (89 lines)
```

---

## 3. Backend Architecture

Backend routes are mounted under `/api/pdf` via FastAPI (`backend/main.py`). The backend logic is split cleanly between layout extraction (`pdf_routes/editor.py`), font synthesis (`converter/font_utils.py`), and the PDF modification/bake engine (`converter/pdf_edit.py`).

### 3.1 API Routes

| Method | Route Path | Defined In | Purpose |
|--------|------------|------------|---------|
| `POST` | `/api/pdf/extract-spacing` | `editor.py` | **Main entry point.** Sends full typography payload (blocks, columns, inline images) for every page. Also caches in `TYPOGRAPHY_CACHE`. |
| `POST` | `/api/pdf/extract-typography` | `editor.py` | Identical to extract-spacing but returns a wrapped `{doc_id, pages, total_paragraphs}` object. |
| `GET`  | `/api/pdf/typography/{doc_id}` | `editor.py` | Retrieves a previously cached typography payload by its SHA-256 doc_id. |
| `POST` | `/api/pdf/extract-fonts` | `editor.py` | Extracts all embedded fonts from the PDF as base64-encoded OTF/TTF blobs for `@font-face` injection. |
| `POST` | `/api/pdf/detect_font` | `editor.py` | Hit-test a raw (x, y) coordinate — returns font name, size, and text of the nearest span. |
| `POST` | `/api/pdf/run_ocr` | `editor.py` | Runs OCRmyPDF on a scanned PDF to add a text layer, returns selectable PDF. |
| `POST` | `/api/pdf/encrypt` | `editor.py` | Encrypts a PDF with a password using pypdf. |
| `POST` | `/api/pdf/apply-edits` | `pdf_edit.py` | **Primary bake route.** Receives text/paragraph edit payloads, redacts original rects, and re-inserts styled text. |
| `POST` | `/api/pdf/bake-annotations` | `pdf_edit.py` | Bakes freehand drawings, highlights, shapes, and images directly into the PDF streams. |

### 3.2 Typography Engine Pipeline (`editor.py`)

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

### 3.3 Region Extraction Engine (3-Tier System)

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
8. Return `[[text_x_min, split_x], [split_x, text_x_max]]` or `[[text_x_max]]`

### 3.5 Font Extraction & CFF->OTF Wrapping (`font_utils.py`)

**Route:** `POST /api/pdf/extract-fonts`

For every embedded font xref:
1. Extracts raw font bytes via `doc.extract_font(xref)`
2. CFF format: wraps in OTF container via `wrap_cff_in_otf(cff_bytes, basefont_name)` (browsers can't load bare `.cff` files via `@font-face`)
3. **OTF Name Table Fix:** Populates OTF `name` table with nameID 1 (family), nameID 2 (subfamily: Regular/Bold/Italic), nameID 3 (unique ID), nameID 4 (Full Name: verbatim `basefont_name`), and nameID 6 (PostScript name: verbatim `basefont_name`). This guarantees `fitz.Font(fontbuffer=...).name` matches `basefont_name` during backend font registration.
4. Injects a valid `cmap` subtable via `_inject_cmap()` so the browser can map Unicode → glyph IDs
5. Extracts **StdVW stem-width ratio** for canvas stem darkening compensation
6. Returns `{ basename: { data, format, postscript_name, subset_tag, stem_vw_ratio } }`

### 3.6 Edit & Bake Engine (`pdf_edit.py`)

**Route:** `POST /api/pdf/apply-edits`

Processes text and paragraph edits with run-level style fidelity:

1. **Span Run Extraction (`_span_runs_in_rect`):** Before redacting, extracts every span run inside the edit rectangle, capturing `text`, `font`, `size`, `color_rgb`, origin `x`, `line_baseline_y`, and `line_y`.
2. **Redaction:** Calls `page.add_redact_annot(rect)` + `page.apply_redactions(images=PDF_REDACT_IMAGE_NONE, graphics=PDF_REDACT_LINE_ART_NONE)` to erase original text while preserving images and vector graphics.
3. **Font Registration:** Calls `page.insert_font(fontname, fontbuffer)` with the stored embedded font buffer.
4. **Run-Faithful Paragraph Insertion:**
   - Resolves superscript ranges from `plan["super_ranges"]` (reading `charStart`/`charEnd` and carried `fontSize`) or derives them from extracted runs.
   - Computes left/right margins and `orig_baselines[]` from the extracted runs.
   - Reflows word tokens over original line boundaries.
   - Emits characters via `page.insert_text(fitz.Point(x, y_pos), token["text"], ...)` anchored to original baselines with `y_pos = baseline - rise`.

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

The main PDF display orchestrator (1582 lines). Responsible for rendering the PDF, transforming `spacingData` into editor-ready `paragraphItems`, overlaying `CanvasInlineEditor` instances, and handling all canvas tool interactions.

### 5.1 Dual-Document Flash Prevention

When a baked PDF arrives the viewer keeps the old document rendered as an opaque backdrop while the new one loads invisibly underneath. The instant `onLoadSuccess` fires, the backdrop disappears and the new document becomes visible — zero blank-canvas flash.

### 5.2 Font Injection

On every new PDF load: calls `POST /api/pdf/extract-fonts` → passes to `loadPDFFonts(fontsData)` in `utils/pdfFontLoader.js` → creates `@font-face` CSS rules → awaits `document.fonts.ready` → stores `stem_vw_ratio` per font name for canvas stem darkening.

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

The core canvas editing engine (2098 lines). Each `paragraphItem` gets its own instance when clicked. Uses a **headless `<textarea>` + `<canvas>`** architecture:
- Offscreen `<textarea>` captures all raw keyboard input, focus, composition, and selection
- HTML5 Canvas renders text, baseline-shifted superscripts, selection highlights, and blinking caret

### 6.1 Authoritative Character Attribute Model (`charMetaRef`)

Rich-text character attributes are **never re-derived by positional re-matching after mount**.
- At mount only: `parseCharMetadata(rawInitialStr, rawInitialRanges, origLines)` runs once to create `initialParsed.charMeta`.
- `const charMetaRef = useRef(initialParsed.charMeta)` holds the single-source-of-truth parallel attribute array.
- On keystrokes (`textarea onChange`): computes common prefix `p` and suffix window `so`/`sn`, then splices `charMetaRef.current`. Newly typed characters inherit `'super'` kind only if typed strictly inside an existing superscript run on both sides.
- `computeLineLayout` and `handleCommit` use `charMetaRef.current` directly. `parseCharMetadata` is never called again after mount.

### 6.2 Metric-Based Run-Aware Caret

The blinking caret is drawn as a 2px-wide vertical bar whose height and vertical position are calculated dynamically from the font metrics of the run under the selection:

```js
const pos = layout.globalCharMap[selection.start] ?? layout.globalCharMap.at(-1);
if (pos) {
  const isSup = pos.kind === 'super' || pos.kind === 'sub';
  const runPt = isSup ? (pos.charFontSize || baseFontPt * 0.65) : baseFontPt;
  const rise  = pos.kind === 'super' ? baseFontPt * 0.30 : (pos.kind === 'sub' ? -baseFontPt * 0.10 : 0);
  ctx.font = `${isItalic?'italic ':''}${isBold?'bold ':''}${runPt}px ${currentFontFamily}`;
  const m = ctx.measureText('|');
  const asc = m.actualBoundingBoxAscent ?? runPt * 0.75;
  const desc = m.actualBoundingBoxDescent ?? runPt * 0.20;
  ctx.fillStyle = color || '#000';
  ctx.fillRect(pos.x, pos.yBaseline - rise - asc, 2 / scale, asc + desc);
}
```

No text or label badges ("SUP"/"SUB") are ever painted onto the visual editing surface.

### 6.3 Geometry Safety-Net (bbox Union)

Before rendering, `item` is expanded via `useMemo` to include all char bboxes and inline image bboxes. This prevents bullet glyphs, Symbol-font characters (⇒, ►), and ORCID badges from rendering at negative canvas coordinates.

### 6.4 Ligature Expansion

**`expandMultiCharEntries(chars)`**

PyMuPDF emits ligatures (fi, fl, ffi) as a single entry with multi-codepoint `c`. The helper splits each into individual entries with **linearly interpolated geometry**:

```js
const sx0 = x0 + ((x1 - x0) * k) / c.length;
const sx1 = x0 + ((x1 - x0) * (k + 1)) / c.length;
```

### 6.5 Layout Engine (`computeLineLayout`)

Called on render. Performs full text layout:

1. Uses `charMetaRef.current` directly.
2. Measures HTML ascender via `ctx.measureText('Hpx').actualBoundingBoxAscent`.
3. Splits text on `\n` (hard PDF line boundaries).
4. Groups chars into word units with measured widths.
5. Reflows overflowing units across canvas lines.
6. Merges orphaned superscript units back into preceding units.
7. Calls `pushLine()` for word-level PDF prefix/suffix anchoring on unedited lines.

### 6.6 Canvas Drawing (`drawCanvas`)

Sequence on render:
1. `ctx.clearRect()`
2. Draw **underlay PNG** (background non-text content)
3. Draw **inline images** (ORCID badges, decoded and cached in `imgCache` ref)
4. For each layout line:
   - Apply **stem darkening offset** to baseline Y (CFF fonts only)
   - Draw **selection highlight** rectangle
   - `ctx.fillText(displayChar, x, baselineY)` per char
5. Draw **blinking caret** bar using `ctx.measureText` run metrics

### 6.7 Commit / Bake Flow

**Commit:** outside click (document mousedown capture phase) or Enter in single-line mode:
1. `sanitizeForCommit(text)` — converts `\u00A0` → regular spaces
2. `extractRangesFromCharMeta(charMetaRef.current)` — rebuilds `superscriptRanges` carrying `fontSize` and `color`
3. `onCommit(edit)` → `pdfEditStore.commitEdit(fileId, edit)`

**Bake:** user clicks "Finish & Export":
1. Collect all edits from `pdfEditStore.getEdits()`
2. `POST /api/pdf/apply-edits` with edit list + original PDF bytes
3. Receive new PDF bytes → dual-doc transition (no flash)
4. `POST /api/pdf/extract-spacing` on new PDF → fresh `spacingData`
5. `pdfEditStore.clearEdits()` — stale pre-bake edits removed

---

## 7. Frontend — `InlineEditor.jsx`

The **legacy** inline editor (726 lines). Uses `contentEditable` instead of canvas. Used for drag-and-drop text annotations and legacy simple edit mode.

Key utilities:
- `buildInitialChildren(str, superscriptRanges)` — renders `<sup>` / `<sub>` HTML inside the contentEditable span
- `sanitizeForDisplay()` — leading spaces → `\u00A0` so `contentEditable` doesn't strip them
- `sanitizeForCommit()` — converts `\u00A0` back before saving

---

## 8. Frontend — Supporting Components

| Component | File Line Count | Role |
|-----------|-----------------|------|
| `RightPanel.jsx` | 346 lines | Tool settings sidebar (color pickers, opacity, shape type). Contains "Finish & Export" button. |
| `Toolbar.jsx` | 115 lines | Left-side vertical toolbar. Sets `activeTool`. |
| `DebugOverlay.jsx` | 87 lines | Activated by `Ctrl+Shift+D`. Renders red bbox overlays with `paragraph_id`, font name, size labels. |
| `TextOverlay.jsx` | 108 lines | Positions an element at a PDF-space coordinate. Used for annotation overlays. |
| `DraggableItem.jsx` | 111 lines | Pointer-event drag wrapper. Translates drag deltas to PDF-space coordinate updates. |
| `superscriptUtils.js` | 36 lines | Exports `SUPER_MAP`, `UNICODE_SUPER_MAP`, `UNICODE_SUB_MAP`. Non-JSX. |

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
    ├── POST /api/pdf/extract-spacing ──────────────────────────────────────────┐
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
    ├── POST /api/pdf/extract-fonts
    │       └── fitz.extract_font() → CFF→OTF → OTF name table fix → cmap inject → base64
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
    ▼
Per-paragraphItem: CanvasInlineEditor
    ├── expandMultiCharEntries()             [ligature splitting]
    ├── charMetaRef (useRef)                 [authoritative parallel attribute model]
    ├── useMemo: bbox union safety-net
    │
    ├── computeLineLayout(ctx)
    │     ├── Uses charMetaRef.current directly (never re-parses rawText)
    │     ├── measureText() per char/unit
    │     ├── Overflow reflow across lines
    │     ├── Word-level prefix/suffix PDF anchoring
    │     └── Return lines[] with per-char x positions
    │
    └── drawCanvas()
          ├── Draw underlay PNG (non-text background)
          ├── Draw inline images (ORCID, formula images)
          ├── Draw selection highlights
          ├── fillText() per char with stem-darkening offset
          └── Draw blinking caret bar (measured via ctx.measureText('|'))

User types → onChange splices charMetaRef → pdfEditStore.commitEdit()

"Bake" clicked
    │
    ▼
POST /api/pdf/apply-edits
    ├── _span_runs_in_rect()                 [extract per-span font/size/color/baselines]
    ├── page.add_redact_annot(rect)
    ├── page.apply_redactions(images=NONE, graphics=NONE)
    └── page.insert_text()                   [run-faithful baseline & size emission]
    → new PDF bytes

New PDF → Viewer (dual-doc transition, no flash)
POST /api/pdf/extract-spacing (new PDF) → new spacingData → new boxes
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

**DPR:** Canvas physical size = `round(cssPx × DPR)`. Drawing coordinates are in CSS pixels. Physical canvas size maps 1:1 to DPR-scaled pixels.

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

### Authoritative Attribute Splicing
```js
// Textarea onChange: compute common prefix p and suffix window so / sn
const inserted = Array.from(neu.slice(p, sn), (ch, i) => ({
  origChar: ch, displayChar: ch,
  kind: inside ? 'super' : 'normal',
  color: inside ? oldMeta[p - 1]?.color : undefined,
  pdfSize: inside ? oldMeta[p - 1]?.pdfSize : undefined,
  charIndex: p + i,
}));
charMetaRef.current = [...oldMeta.slice(0, p), ...inserted, ...oldMeta.slice(so)]
  .map((m, i) => ({ ...m, charIndex: i }));
```
Prevents text-based positional re-matching from corrupting formatting attributes after edits. Newly typed chars inherit `'super'` strictly inside an existing superscript run.

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
