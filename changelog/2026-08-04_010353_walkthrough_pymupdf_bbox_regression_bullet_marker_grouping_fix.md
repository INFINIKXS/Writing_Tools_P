---
archived: 2026-08-04T01:03:53.248105
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\150596ac-f5dc-4542-a5c0-a5c108ae01d6\walkthrough.md
---

# Walkthrough — PyMuPDF BBox Regression & Bullet Marker Grouping Fix

## What was changed

### Backend — `backend/pdf_routes/editor.py`

#### 1. Vector-Accurate Text Bounding Boxes (`TEXT_ACCURATE_BBOXES`)
**Why:** PyMuPDF ≥1.25.0 synthesises character bboxes from font metric ascenders/descenders instead of evaluating actual glyph outlines. For condensed CFF fonts (`HelveticaNeueLTStd-Cn`) and symbol glyphs (`⇒`), the synthesised right edge is narrower than the true ink extent, causing paragraph union boxes to cut off right-side content.

**Change in `_extract_all_lines()`:**
```python
fitz.TOOLS.unset_quad_corrections(True)          # required companion setting
flags = fitz.TEXTFLAGS_RAWDICT | fitz.TEXT_ACCURATE_BBOXES
data = page.get_text("rawdict", flags=flags)
```

#### 2. Bullet Marker Attachment Pre-pass (`_attach_bullet_markers`)
**Why:** PyMuPDF emits bullet/arrow marker symbols (`⇒`, `•`, `►`) as independent lines with a different font and zero horizontal overlap with the adjacent body text. The Tier-2 `x_close` clustering rule (left-edge alignment **or** >30% horizontal overlap) never fires for these, leaving them as orphan regions excluded from paragraph bboxes.

**New helpers defined as module-level functions:**
- `MARKER_GLYPHS` — set of 14 common bullet/arrow Unicode codepoints
- `_is_marker_line(ln)` — returns True for 1-2 non-space chars that are all in MARKER_GLYPHS
- `_attach_bullet_markers(lines)` — merges each marker line into the text line with vertical overlap sitting immediately to its right; updates chars, line_x0, bbox, and text; marks consumed lines for removal

**Called immediately after `_extract_all_lines()`:**
```python
all_lines = _attach_bullet_markers(all_lines)
```

#### 3. Dilated BBox for Drawing/Image Intersection
**Why:** Vector-art bullets drawn as PDF paths sit 1-3pt outside the text cluster edge and were silently skipped by the image/drawing intersection check.

**Change in union bbox assembly:**
```python
dilated_bbox = [text_bbox[0]-3, text_bbox[1]-3, text_bbox[2]+3, text_bbox[3]+3]
# intersect images and drawings against dilated_bbox (not text_bbox)
```

#### 4. `line_bbox` Field Added to Output Payloads
Each line dict in the `"lines"` array now carries an explicit `line_bbox` key equal to `line["bbox"]`. This allows the frontend to reconstruct per-line spatial extents (including the newly merged bullet extents) without recomputing from char coords.

---

### Frontend — `frontend/src/components/PDFEditor/CanvasInlineEditor.jsx`

#### 5. `isSaneChar` Coordinate Sanity Gate
**Why:** When PyMuPDF emits degenerate bbox metadata (NaN, zero-width, wildly out-of-range values for symbol glyphs), the canvas anchoring math produces NaN x-positions, causing `fillText(x=NaN)` to silently render nothing. First lines of edited paragraphs were completely invisible.

**New helper (module-level):**
```js
const isSaneChar = (c, pageW = 2000) =>
  c != null &&
  Number.isFinite(c.x0) && Number.isFinite(c.x1) &&
  (c.x1 - c.x0) > 0.05 &&
  c.x0 >= -50 && c.x1 <= pageW + 50;
```

Applied in `parseCharMetadata`: chars failing `isSaneChar` have `pdfOriginX`/`pdfOriginY`/`pdfX0`/`pdfX1` set to `undefined`, causing `pushLine` to fall back to pure canvas flow layout for those glyphs.

#### 6. `getOrigLineBounds` Expanded with `line_bbox`
**Why:** The canvas safety-net bounding rect that determines line target width was computed only from `line_x0` and the block bbox. After bullet marker attachment, the line's true left edge (`line_bbox[0]`) may be the marker's x0, and the right edge (`line_bbox[2]`) may now exceed the text-only right edge.

**Change in `getOrigLineBounds`:**
- Prefers `origLine.line_bbox[0]` as `x0` (overrides `line_x0` which may not reflect merged bullet)
- Expands `containerRightX` with `origLine.line_bbox[2]`

---

## Verification
1. **Syntax** — `python -c "ast.parse(open('editor.py',encoding='utf-8').read())"` → exit 0 ✅
2. **Manual** — Load PDF with `⇒` bullets and `HelveticaNeueLTStd-Cn` font, toggle Debug Overlay (`Ctrl+Shift+D`):
   - Block bbox should now extend to the true ink right edge
   - Bullet arrows (`⇒`) should be inside, not orphaned outside, the paragraph block
   - Editing text on those lines should render visible text throughout (no vanishing first lines)
