---
archived: 2026-07-24T23:19:35.510874
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\ba21c340-6d1d-4da2-983b-d9d41aa38c40\walkthrough.md
---

# Add Watermark Engine Upgrade Walkthrough

## Summary of Changes

Upgraded the **Add Watermark** engine in `backend/converter/__init__.py` to support comprehensive text and image watermarking capabilities.

### 1. Form Parameters Upgrade (`add_watermark` Endpoint)
Path: `backend/converter/__init__.py#L3535`

- `watermark_type`: `"text"` or `"image"` (default: `"text"`)
- `text`: Watermark text (default: `"CONFIDENTIAL"`)
- `image_file`: `UploadFile` (Optional image file upload)
- `font_family`: Font name (default: `"Helvetica"`)
- `font_size`: Font size in points (default: `36`)
- `bold`: Boolean (default: `False`)
- `italic`: Boolean (default: `False`)
- `color`: Hex color string e.g. `"#FF0000"` (default: `"#FF0000"`)
- `position`: Grid position anchor (`"top-left"`, `"top-center"`, `"top-right"`, `"center-left"`, `"center"`, `"center-right"`, `"bottom-left"`, `"bottom-center"`, `"bottom-right"`, or `"mosaic"`)
- `opacity`: Opacity float `0.0` to `1.0` (default: `0.5`)
- `rotation`: Rotation angle in degrees (default: `45`)
- `from_page`: Starting page index 1-based (default: `1`)
- `to_page`: Ending page index 1-based or `0` for all pages (default: `0`)
- `layer`: `"over"` (foreground overlay) or `"below"` (background) (default: `"over"`)

### 2. Synchronous Runner Upgrade (`_run_add_watermark_sync`)
Path: `backend/converter/__init__.py#L1050`

- Uses PyMuPDF (`fitz`) to manipulate PDF pages in specified page ranges (`from_page - 1` to `to_page - 1` or all pages).
- **Text Watermark Logic**:
  - Parses hex colors to RGB float tuples `(r, g, b)`.
  - Maps font parameters (`font_family`, `bold`, `italic`) to standard PyMuPDF font names (`Helvetica`, `Times-Roman`, `Courier` variants).
  - Calculates target coordinates for all 9 grid positions as well as 3x3 tiled grids (`"mosaic"`).
  - Uses `fill_opacity=opacity`, `overlay=(layer == "over")`, and `morph=(fitz.Point(cx, cy), fitz.Matrix(-rotation))` for custom rotation angles.
- **Image Watermark Logic**:
  - Reads uploaded image via PIL, converting to RGBA.
  - Applies arbitrary rotation using `img.rotate(-rotation, expand=True)`.
  - Multiplies image alpha channel by `opacity`.
  - Scales and positions image inside target bounding boxes or 3x3 tiled grid (`"mosaic"`).
  - Inserts image into PDF page using `page.insert_image(rect, stream=img_bytes, overlay=(layer == "over"))`.

### 3. Verification & Testing
- Direct backend unit test verified both text watermarking (mosaic tiling, rotated, colored) and image watermarking (centered, transparent, rotated).

---
