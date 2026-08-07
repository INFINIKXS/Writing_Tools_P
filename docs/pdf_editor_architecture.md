# PDF Editor — Full Technical Architecture

> **Last updated:** 2026-08-06  
> **Stack:** FastAPI (Python) backend · React + Vite frontend · PyMuPDF (fitz) · PDF.js (react-pdf)

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Repository Layout](#2-repository-layout)
3. [Backend Architecture](#3-backend-architecture)
   - [3.1 API Routes](#31-api-routes)
   - [3.2 Typography Engine Pipeline (`editor.py`)](#32-typography-engine-pipeline-editorpy)
   - [3.3 Region Extraction Engine (3-Tier System + Nested Fill Collapse)](#33-region-extraction-engine-3-tier-system--nested-fill-collapse)
   - [3.4 Column Detection](#34-column-detection)
   - [3.5 Font Extraction, Subset Tag Stripping & CFF->OTF Wrapping (`font_utils.py`)](#35-font-extraction-subset-tag-stripping--cff-otf-wrapping-font_utilspy)
   - [3.6 Edit & Bake Engine (`pdf_edit.py`)](#36-edit--bake-engine-pdf_editpy)
   - [3.7 Backend Diagnostic Logging Infrastructure](#37-backend-diagnostic-logging-infrastructure)
4. [Frontend State Layer — Stores](#4-frontend-state-layer--stores)
   - [4.1 `pdfEditStore.js`](#41-pdfeditstorejs)
   - [4.2 `pdfTypographyStore.js`](#42-pdftypographystorejs)
   - [4.3 `activeEditorStore.js`](#43-activeeditorstorejs)
5. [Frontend — `Viewer.jsx` & Atomic Pre-Rendered Bake Swap](#5-frontend--viewerjsx--atomic-pre-rendered-bake-swap)
6. [Frontend — `CanvasInlineEditor.jsx`](#6-frontend--canvasinlineeditorjsx)
7. [Frontend — `InlineEditor.jsx`](#7-frontend--inlineeditorjsx)
8. [Frontend — Supporting Components & GlobalFormatToolbar](#8-frontend--supporting-components--globalformattoolbar)
9. [Utility Layer](#9-utility-layer)
10. [End-to-End Data Flow Diagram](#10-end-to-end-data-flow-diagram)
11. [Key Coordinate Systems](#11-key-coordinate-systems)
12. [Critical Algorithms Reference](#12-critical-algorithms-reference)

---

## 1. High-Level Overview

The PDF Editor is a WYSIWYG in-place editor that lets a user click on any paragraph in a PDF and type to change it. It works through a tight loop between a Python/FastAPI backend (which understands raw PDF geometry, font metrics, subset tag stripping, and vector redaction) and a React frontend (which renders an HTML5 Canvas editing engine over the PDF.js canvas with zero-flash double-buffered page swaps).

```
User uploads PDF
      │
      ▼
Backend /api/pdf/extract-spacing  ──►  Typography Engine (PyMuPDF)
      │                                     │
      │                            3-tier region extraction + nested fill collapse
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
      │                       activeEditorStore syncs selection to GlobalFormatToolbar
      │
      ▼
User edits text  ──►  pdfEditStore (undo/redo store)
      │
      ▼
"Bake" button  ──►  Backend /api/pdf/apply-edits  ──►  PyMuPDF redacts + reinserts text
      │
      ▼
New PDF bytes streamed back  ──►  Atomic Pre-Rendered Bake Swap (zero blank-canvas flash)
```

---

## 2. Repository Layout

```
Writing_Tools_Production/
├── debug.md                           # Backend diagnostic logging guide (EDITOR_LOG_LEVEL=DEBUG)
├── backend/
│   ├── main.py                        # FastAPI app entry point, mounts all routers
│   ├── pdf_routes/
│   │   └── editor.py                  # Typography engine, layout extraction, column detection & font API
│   └── converter/
│       ├── pdf_edit.py                # Core PDF redaction, paragraph bake & edit engine
│       └── font_utils.py              # CFF→OTF wrapping, OTF name table fix, stem-vw extraction
│
└── frontend/src/
    ├── App.jsx                        # Root shell, navigation, persistent view mounting
    ├── pages/
    │   └── PDFEditorPage.jsx          # Top-level page: file upload, bake orchestration
    ├── components/PDFEditor/
    │   ├── Viewer.jsx                 # PDF.js renderer + atomic pre-rendered bake swap + paragraph builder
    │   ├── CanvasInlineEditor.jsx     # Per-paragraph Canvas editor with charMetaRef model
    │   ├── GlobalFormatToolbar.jsx    # Floating/top rich-text toolbar for active canvas text selections
    │   ├── InlineEditor.jsx           # Legacy contentEditable editor
    │   ├── RightPanel.jsx             # Tool settings sidebar
    │   ├── Toolbar.jsx                # Left toolbar (tool picker)
    │   ├── DebugOverlay.jsx           # Ctrl+Shift+D debug bbox overlay
    │   ├── TextOverlay.jsx            # Thin shim for annotation placement
    │   ├── DraggableItem.jsx          # Drag-and-drop wrapper for annotations
    │   └── superscriptUtils.js        # Unicode super/sub char maps
    ├── stores/
    │   ├── pdfEditStore.js            # Observable edit store (undo/redo)
    │   ├── pdfTypographyStore.js      # Observable typography/paragraph store
    │   └── activeEditorStore.js       # Active canvas editor registry & global selection state
    └── utils/
        ├── pdfCoords.js               # pdfToScreen() coordinate transform helper
        └── pdfFontLoader.js           # @font-face injection + stem-vw cache
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
3. Calls `extract_page_spacing_data(page, ...)` $\rightarrow$ list of block dicts
4. Calls `_get_column_boundaries(page)` $\rightarrow$ `[[x_left, x_split], [x_split, x_right]]` or `[[x_left, x_right]]`
5. Extracts all inline images as base64 PNG blobs
6. Appends `{page, blocks, columns, inline_images}` to payload

---

### 3.3 Region Extraction Engine (3-Tier System + Nested Fill Collapse)

**Function:** `extract_page_spacing_data(page, page_idx, page_images, page_drawings, pdf_bytes)`

#### Tier 1 — Rect-Bound (vector structure + Nested Redaction Fill Collapse)

`_collect_enclosing_rects(page)` scans `page.get_drawings()` for true rectangle operations (`"re"`). Rects smaller than 8×8pt or covering >90% of the page are skipped. Near-identical rects ($\pm 0.5\text{pt}$) are de-duplicated.

> [!IMPORTANT]
> **Nested Redaction Fill Collapse:** Repeated edit bakes over the same paragraph leave a stack of nested fill-only rects in the PDF drawing stream. Without filtering, `_innermost_rect` partitions the paragraph's text lines across nested rects, causing paragraph fragmentation on subsequent edits. `_collect_enclosing_rects()` checks `fill_only` rects and drops any inner fill-only rect contained by an outer fill-only rect, preserving structural stroked rects (table cells/borders) and keeping all text lines in a single region.

For each text line, `_innermost_rect()` finds the smallest enclosing rectangle. Lines sharing the same rect are grouped — capturing table cells, text boxes, and sidebars.

#### Tier 2 — Gap-Clustered (free lines, per column)

Lines not captured by any rect are "free lines". They are partitioned into columns by their **`line_x0` (left edge)** value — NOT center point, preventing short lines from drifting across columns.

Within each column's bucket, `_cluster_free_lines(bucket)` runs:

```python
v_gap   = nb.y0 - pb.y1
v_tol   = max(3.5, 0.6 * min(prev["size"], nxt["size"]))  # font-scaled tolerance
h_ovl   = min(pb.x1, nb.x1) - max(pb.x0, nb.x0)
x_close = abs(pb.x0 - nb.x0) <= 0.5 * max(pb.height, nb.height) or h_ovl > 0.3 * min(pb.width, nb.width)
size_ok = abs(prev["size"] - nxt["size"]) <= 2.5
family_similar = base_font_family_match(prev, nxt)
merge_ok = size_ok or (abs(prev["size"] - nxt["size"]) <= 1.0 and family_similar)

if v_gap <= v_tol and x_close and merge_ok:
    merge into current cluster
```

If a column bucket secretly contains two visual columns (e.g. 8pt sidebar + 9pt body text), `_split_bucket_by_left_edge()` splits sub-buckets when left-edge separation is $\ge \max(36\text{pt}, 5 \times \text{dominant\_font\_size})$.

#### Tier 3 — Per-Line Fallback

If Tiers 1+2 produce no regions, every line becomes its own single-line region.

---

### 3.4 Column Detection

**Function:** `_get_column_boundaries(page)`

1. Collect all line left-edge `x0` values; skip lines narrower than 20pt.
2. Find dominant font size (most common size bucket, 0.5pt precision).
3. Filter to lines at the dominant size.
4. Bucket `x0` values into bins of `max(dominant_size, 6.0)` pt width.
5. Find the two most popular buckets.
6. **Two-column test:** both clusters $\ge 15\%$ of lines AND $> 50\text{pt}$ apart.
7. If two-column: calculate column gap midpoint $\rightarrow$ `split_x`.
8. Return `[[text_x_min, split_x], [split_x, text_x_max]]` or `[[text_x_min, text_x_max]]`.

---

### 3.5 Font Extraction, Subset Tag Stripping & CFF->OTF Wrapping (`font_utils.py`)

**Route:** `POST /api/pdf/extract-fonts`

For every embedded font xref:
1. Extracts raw font bytes via `doc.extract_font(xref)`.
2. **Subset Tag Stripping:** Strips 6-letter PostScript subset prefixes (e.g. `NBUDXT+MetaProLight-Regular` $\rightarrow$ `MetaProLight-Regular`).
3. CFF format: wraps in OTF container via `wrap_cff_in_otf(cff_bytes, basefont_name)`.
4. **OTF Name Table Fix:** Populates OTF `name` table with family, subfamily, unique ID, full name, and PostScript name matching `basefont_name`.
5. Injects a valid `cmap` subtable via `_inject_cmap()` for Unicode $\rightarrow$ glyph ID mapping.
6. Extracts **StdVW stem-width ratio** for canvas stem darkening compensation.
7. Returns `{ basename: { data, format, postscript_name, subset_tag, stem_vw_ratio } }`.

---

### 3.6 Edit & Bake Engine (`pdf_edit.py`)

**Route:** `POST /api/pdf/apply-edits`

Processes text and paragraph edits with run-level style fidelity:

1. **Span Run Extraction (`_span_runs_in_rect`):** Extracts every span run inside the edit rectangle from PyMuPDF `rawdict`, preserving `text`, `font`, `size`, `color_rgb`, origin `x`, `line_baseline_y`, and `rise` (superscript offset).
2. **Character Style Diffing (`_build_styled_chars`):** Uses Python `difflib.SequenceMatcher` to diff original text against edited text and map font styling, colors, and baseline rise to newly typed character ranges.
3. **Redaction:** Calls `page.add_redact_annot(rect)` + `page.apply_redactions(images=PDF_REDACT_IMAGE_NONE, graphics=PDF_REDACT_LINE_ART_NONE)` to erase original text while preserving images and vector graphics.
4. **Font Registration:** Calls `page.insert_font(fontname, fontbuffer)` with the stored embedded font buffer.
5. **Run-Faithful Paragraph Insertion:** Emits reflowed text lines via `page.insert_text(fitz.Point(x, y_pos), token["text"], ...)` anchored to original baselines (`y_pos = baseline - rise`).

---

### 3.7 Backend Diagnostic Logging Infrastructure

Set `EDITOR_LOG_LEVEL=DEBUG` (see [`debug.md`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/debug.md)) to view detailed backend diagnostic traces:
- `[RECTS]`: Enclosing drawing/image rect coordinates extracted from PyMuPDF.
- `[GROUP]`: Count of rect-assigned text lines vs. free text lines.
- `[REGION]`: Kind (`rect`/`gap`/`line`), column index, y-extents, and line text preview.
- `[HEAL]`: Block pair evaluation results (`MERGE` or exact rejection reasons like `kind_mismatch`, `vertical_overlap`, `v_gap_too_large`, `font_size`, `font_family`).

---

## 4. Frontend State Layer — Stores

All stores implement the React `useSyncExternalStore` interface without external state dependencies.

### 4.1 `pdfEditStore.js`

**Purpose:** Tracks all user text edits in memory with undo/redo history.
- `commitEdit(fileId, edit)` — upserts edits by `(pageNum, nodeIndex)` and pushes undo snapshot.
- `undo(fileId)` / `redo(fileId)` — stack-based undo/redo.
- `clearEdits(fileId)` — called post-bake to clear stale edit mappings.

### 4.2 `pdfTypographyStore.js`

**Purpose:** Caches typography payloads per document and provides block spatial hit-testing (`getParagraphAt(docId, pageIndex, x, y)`).

### 4.3 `activeEditorStore.js`

**Purpose:** Manages active canvas inline editor instances across pages.
- `registerEditor(id, instance)` / `unregisterEditor(id)` — registers active canvas editors.
- `setActiveEditor(id)` — tracks currently focused paragraph editor.
- `pushState(state)` — broadcasts selection formatting attributes (font family, font size, bold, italic, color, superscripts) to `GlobalFormatToolbar.jsx`.

---

## 5. Frontend — `Viewer.jsx` & Atomic Pre-Rendered Bake Swap

`Viewer.jsx` orchestrates PDF rendering via PDF.js, builds `paragraphItems`, and manages canvas inline editors.

> [!TIP]
> **Atomic Pre-Rendered Bake Swap (Zero Blank-Canvas Flash):**  
> When a user clicks "Finish & Export" to bake edits, active canvas inline editors and staged overlays remain visible and immutable over a double-buffered backdrop canvas. The instant the new baked PDF page completes rendering underneath, the overlay snapshot is unmounted in a single atomic React frame—preventing page flickering or transient text tearing.

---

## 6. Frontend — `CanvasInlineEditor.jsx`

The core canvas editing engine. Each `paragraphItem` gets its own instance when clicked, built on a **headless `<textarea>` + `<canvas>`** architecture.

### Key Technical Mechanisms:

1. **Authoritative Character Attribute Model (`charMetaRef`)**:
   - `charMetaRef.current` holds the parallel attribute array (`origChar`, `displayChar`, `fontSize`, `fontFamily`, `color`, `kind` [normal/super/sub], `charIndex`).
   - Keystrokes splice `charMetaRef` in-place using common prefix $p$ and suffix windows $(s_{old}, s_{new})$, preserving styling without re-parsing raw text.
2. **Citation Unit Atomic Re-attachment**:
   - In `computeLineLayout()`, orphaned superscript units (e.g. $[31]$) are re-attached to their preceding word unit so citation numbers never wrap onto a line alone.
3. **Dominant Baseline Calculation**:
   - Buckets normal text origins to $0.1\text{pt}$ precision to establish stable `dominantPdfOriginY`.
4. **Prefix/Suffix PDF Anchoring**:
   - Unedited word prefixes maintain raw PDF glyph origins (`origin_x`), preventing micro-jitter over the PDF background.
5. **Stem Darkening Compensation**:
   - Compares CFF `stemVwRatio` against browser native stem width measurements (`measureNativeStemWidthPx`) to compensate canvas stroke weight.

---

## 7. Frontend — `InlineEditor.jsx`

Legacy `contentEditable` block editor used for simple drag-and-drop text annotations.

---

## 8. Frontend — Supporting Components & GlobalFormatToolbar

| Component | File Line Count | Role |
|-----------|-----------------|------|
| `GlobalFormatToolbar.jsx` | 240 lines | Floating/top rich-text toolbar. Subscribes to `activeEditorStore.js` to format active canvas text selection (font, size, color, super/subscript toggles). |
| `RightPanel.jsx` | 346 lines | Tool settings sidebar (color pickers, shape type, opacity, "Finish & Export" button). |
| `Toolbar.jsx` | 115 lines | Left-side vertical tool picker (`select`, `text`, `highlight`, `draw`, `shape`, `eraser`). |
| `DebugOverlay.jsx` | 87 lines | `Ctrl+Shift+D` overlay displaying red bounding boxes and `paragraph_id` labels. |
| `TextOverlay.jsx` | 108 lines | PDF-space coordinate positioning container for annotations. |
| `DraggableItem.jsx` | 111 lines | Pointer-event wrapper for annotation drag-and-drop positioning. |
| `superscriptUtils.js` | 36 lines | Unicode super/sub character mapping tables. |

---

## 9. Utility Layer

* `utils/pdfCoords.js` — `pdfToScreen(item, scale)`: `screenPx = pdfPt × scale` (Y-down matched).
* `utils/pdfFontLoader.js` — `loadPDFFonts(fontsData)`: Injects `@font-face` CSS rules and caches `stem_vw_ratio`.

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
    │       ├── _collect_enclosing_rects(page)   [Tier 1 + Nested Fill Collapse]│
    │       ├── _cluster_free_lines(bucket)      [Tier 2, v_tol=max(3.5,0.6*sz)]│
    │       ├── _split_bucket_by_left_edge()     [Left-edge sub-bucketing]       │
    │       └── union bbox + underlay PNG per block                            │
    │   → spacingData ◄─────────────────────────────────────────────────────────┘
    │
    ├── POST /api/pdf/extract-fonts
    │       └── Subset Tag Stripping → CFF→OTF → OTF Name Table Fix → @font-face
    │
    ▼
Viewer.jsx
    ├── Renders PDF via <Document> + <Page> (react-pdf / PDF.js)
    ├── Maps backend blocks → paragraphItems
    │
    ▼
Per-paragraphItem: CanvasInlineEditor
    ├── charMetaRef (authoritative parallel attribute model)
    ├── activeEditorStore.pushState() ──► GlobalFormatToolbar.jsx
    ├── computeLineLayout()
    │     ├── Citation Unit Atomic Re-attachment
    │     ├── Dominant Baseline Bucketing (0.1pt)
    │     └── Word-level prefix PDF anchoring
    └── drawCanvas() ──► 60 FPS Render Loop + Metric Caret Bar |

User edits text → pdfEditStore.commitEdit()

"Bake" clicked
    │
    ▼
POST /api/pdf/apply-edits
    ├── _span_runs_in_rect()                 [extract per-span metrics & rise]
    ├── _build_styled_chars()                [difflib sequence matching]
    ├── page.add_redact_annot(rect)          [target vector redaction]
    └── page.insert_text()                   [baseline-anchored re-insertion]
    → new PDF bytes

Atomic Pre-Rendered Bake Swap (double-buffered canvases, zero blank-canvas flash)
POST /api/pdf/extract-spacing (new PDF) → fresh spacingData
pdfEditStore.clearEdits()
```

---

## 11. Key Coordinate Systems

| System | Origin | Units | Used In |
|--------|--------|-------|---------|
| **PDF points** | Top-left of page, Y-down | pt (1/72 inch) | PyMuPDF (`fitz.Rect`), backend outputs |
| **CSS/screen pixels** | Top-left of page container, Y-down | px | Viewer.jsx positioning, CanvasInlineEditor CSS |
| **Canvas pixels** | Top-left of canvas element, Y-down | px | HTML5 Canvas 2D context drawing |

Transform: `screenPx = pdfPt × scale`.

---

## 12. Critical Algorithms Reference

### Nested Redaction Fill Collapse
```python
# Drops nested fill-only rects created by repeated bakes to prevent paragraph fragmentation
nested = fo and any(
    o_fo and (o is not r) and
    o.x0 <= r.x0 + 0.5 and o.y0 <= r.y0 + 0.5 and
    o.x1 >= r.x1 - 0.5 and o.y1 >= r.y1 - 0.5
    for o, o_fo in deduped
)
if nested:
    continue  # drop nested redaction fill, preserve structural stroked rects
```

### Font-Scaled Gap Clustering Tolerance
```python
v_tol = max(3.5, 0.6 * min(prev["size"], nxt["size"]))
```

### Authoritative Attribute Splicing
```js
// Keystrokes splice charMetaRef using common prefix p and suffix windows so / sn
charMetaRef.current = [...oldMeta.slice(0, p), ...inserted, ...oldMeta.slice(so)]
  .map((m, i) => ({ ...m, charIndex: i }));
```

### Atomic Pre-Rendered Bake Swap
Keeps active canvas inline editors and snapshot masks mounted over double-buffered page canvases until the new baked PDF canvas signals complete rendering, guaranteeing zero visual flash.
