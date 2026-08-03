import os
import tempfile
try:
    import ocrmypdf
    OCRMYPDF_AVAILABLE = True
except ImportError:
    OCRMYPDF_AVAILABLE = False
    ocrmypdf = None

import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Form
from fastapi.responses import FileResponse, JSONResponse
from pypdf import PdfReader, PdfWriter
import logging
import base64
import hashlib
from collections import Counter
from converter.font_utils import wrap_cff_in_otf, extract_stem_vw_ratio, _inject_cmap

logger = logging.getLogger(__name__)

TYPOGRAPHY_CACHE = {}

def parse_color(color_val):
    if isinstance(color_val, (tuple, list)):
        if len(color_val) == 3:
            r = int(color_val[0] * 255) if isinstance(color_val[0], float) and color_val[0] <= 1.0 else int(color_val[0])
            g = int(color_val[1] * 255) if isinstance(color_val[1], float) and color_val[1] <= 1.0 else int(color_val[1])
            b = int(color_val[2] * 255) if isinstance(color_val[2], float) and color_val[2] <= 1.0 else int(color_val[2])
            return f"rgb({r}, {g}, {b})", f"#{r:02x}{g:02x}{b:02x}"
    elif isinstance(color_val, int):
        r = (color_val >> 16) & 0xFF
        g = (color_val >> 8) & 0xFF
        b = color_val & 0xFF
        return f"rgb({r}, {g}, {b})", f"#{r:02x}{g:02x}{b:02x}"
    return "rgb(0, 0, 0)", "#000000"

UNICODE_SUPER_MAP = str.maketrans({
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9'
})

def normalize_pdf_text(text: str) -> str:
    if not text:
        return ""
    return text.translate(UNICODE_SUPER_MAP)

router = APIRouter()

@router.post("/run_ocr")
async def run_ocr(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Accepts a scanned PDF, runs OCRmyPDF on it, and returns a selectable PDF.
    """
    tmp_input = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp_output = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    
    # Save the upload to disk
    content = await file.read()
    tmp_input.write(content)
    tmp_input.close()
    
    try:
        # Run OCRmyPDF (force_ocr ensures we ignore existing text layers if broken)
        ocrmypdf.ocr(tmp_input.name, tmp_output.name, force_ocr=True)
    except Exception as e:
        os.remove(tmp_input.name)
        os.remove(tmp_output.name)
        return {"error": str(e)}

    # Ensure files are cleaned up after returning
    background_tasks.add_task(os.remove, tmp_input.name)
    background_tasks.add_task(os.remove, tmp_output.name)

    return FileResponse(
        tmp_output.name, 
        media_type="application/pdf", 
        filename=f"ocr_{file.filename}"
    )

@router.post("/detect_font")
async def detect_font(
    file: UploadFile = File(...),
    page_index: int = Form(...),
    x: float = Form(...),
    y: float = Form(...)
):
    """
    Given a raw x/y coordinate on a specific page, uses PyMuPDF to extract
    the font dictionary characteristics of the natively embedded text string.
    """
    pdf_bytes = await file.read()
    doc = fitz.open("pdf", pdf_bytes)
    
    if page_index < 0 or page_index >= len(doc):
        return JSONResponse(status_code=400, content={"error": "Invalid page index"})
        
    page = doc[page_index]
    
    best_match = None
    min_dist = float('inf')
    
    text_dict = page.get_text("dict")
    for block in text_dict.get("blocks", []):
        if block["type"] == 0:  # text block
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    bbox = span["bbox"] # [x0, y0, x1, y1]
                    
                    # If the click naturally falls perfectly inside a span BBOX
                    if bbox[0] <= x <= bbox[2] and bbox[1] <= y <= bbox[3]:
                         return {
                             "font": span.get("font"),
                             "size": round(span.get("size"), 1),
                             "text": normalize_pdf_text(span.get("text"))
                         }
                    
                    # Otherwise map to the closest spanning block centroid
                    center_x = (bbox[0] + bbox[2]) / 2
                    center_y = (bbox[1] + bbox[3]) / 2
                    dist = ((center_x - x) ** 2 + (center_y - y) ** 2) ** 0.5
                    
                    if dist < min_dist:
                         min_dist = dist
                         best_match = {
                             "font": span.get("font"),
                             "size": round(span.get("size"), 1),
                             "text": normalize_pdf_text(span.get("text"))
                         }
                         
    if best_match and min_dist < 100: # Ensure we didn't just match something 1000px away
        return best_match
        
    # Safe default fallback
    return {"font": "Helvetica", "size": 16, "text": ""}

@router.post("/encrypt")
async def encrypt_pdf(password: str, background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Example PyPDF router endpoint securely encrypting the PDF.
    """
    tmp_input = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp_output = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    
    content = await file.read()
    tmp_input.write(content)
    tmp_input.close()
    
    reader = PdfReader(tmp_input.name)
    writer = PdfWriter()
    
    for page in reader.pages:
        writer.add_page(page)
        
    writer.encrypt(password)
    with open(tmp_output.name, "wb") as f:
        writer.write(f)
        
    background_tasks.add_task(os.remove, tmp_input.name)
    background_tasks.add_task(os.remove, tmp_output.name)

    return FileResponse(tmp_output.name, media_type="application/pdf", filename=f"encrypted_{file.filename}")

def _get_column_boundaries(page):
    """
    Detect columns by clustering the left-edge x-coordinates of text lines.

    Real two-column body text has a distinctive signature: most lines start
    at one of exactly two x-coordinates (the left edge of each column).
    Full-width text has lines that all start at roughly ONE x-coordinate.
    This is a structural property and is robust against:
      - Full-width boxes mixed into two-column pages
      - Margin/sidebar text (doesn't contribute enough lines to form a peak)
      - Page headers and footers
      - Rotated text

    Algorithm:
      1. Get line-level bboxes from PyMuPDF (get_text("dict")).
      2. Filter out single-line blocks and tiny lines.
      3. Cluster line x0 values into buckets of width FONT_SIZE.
      4. Find the two most popular buckets.
      5. If the two top buckets are well-separated (>50pt apart) and
         each has a substantial count, this is a two-column page.
    """
    try:
        data = page.get_text("dict")
    except Exception:
        return [[0, page.rect.width]]

    # Collect line x0 (left edge) and x1 (right edge) for every line with
    # substantial text content. Skip very short lines (captions, footers).
    line_starts = []  # list of (x0, x1, width)
    line_sizes = []   # font sizes seen

    for block in data.get("blocks", []):
        if block.get("type", 0) != 0:
            continue
        for line in block.get("lines", []):
            bbox = line.get("bbox", (0, 0, 0, 0))
            lw = bbox[2] - bbox[0]
            if lw < 20:  # skip tiny stubs
                continue

            # Collect font size from the first span
            spans = line.get("spans", [])
            if spans:
                line_sizes.append(spans[0].get("size", 10))

            line_starts.append((bbox[0], bbox[2], lw))

    if len(line_starts) < 5:
        return [[0, page.rect.width]]

    # Determine dominant font size (for bucket width)
    from collections import Counter
    size_counts = Counter(round(s * 2) / 2 for s in line_sizes)
    dominant_size = size_counts.most_common(1)[0][0] if size_counts else 10.0
    bucket_width = max(dominant_size, 6.0)

    # Filter to lines at dominant font size (removes caption-size text)
    filtered_starts = [
        (x0, x1, lw)
        for (x0, x1, lw), sz in zip(line_starts, line_sizes)
        if abs(round(sz * 2) / 2 - dominant_size) <= 1.0
    ]
    if len(filtered_starts) < 5:
        filtered_starts = line_starts

    # Bucket the x0 values
    bucket_counts = Counter()
    for x0, x1, lw in filtered_starts:
        bucket = round(x0 / bucket_width) * bucket_width
        bucket_counts[bucket] += 1

    # Find the two most popular buckets
    top = bucket_counts.most_common()
    if len(top) < 2:
        return [[filtered_starts[0][0], max(f[1] for f in filtered_starts)]]

    b1_x, b1_count = top[0]
    b2_x, b2_count = top[1]
    total_lines = len(filtered_starts)

    # For a true two-column page, BOTH clusters should account for at least
    # 15% of the dominant-size lines. If only one cluster dominates (>70%),
    # it's single-column text.
    min_cluster_share = 0.15
    is_two_column = (
        b1_count >= total_lines * min_cluster_share
        and b2_count >= total_lines * min_cluster_share
        and abs(b1_x - b2_x) > 50  # columns must be at least 50pt apart
    )

    # Overall x-range
    text_x_min = min(f[0] for f in filtered_starts)
    text_x_max = max(f[1] for f in filtered_starts)

    if is_two_column:
        left_start = min(b1_x, b2_x)
        right_start = max(b1_x, b2_x)

        # Find the actual gap: max right-edge of left-column lines,
        # vs min left-edge of right-column lines.
        left_col_rights = [
            x1 for x0, x1, lw in filtered_starts
            if abs(round(x0 / bucket_width) * bucket_width - left_start) < bucket_width
        ]
        right_col_lefts = [
            x0 for x0, x1, lw in filtered_starts
            if abs(round(x0 / bucket_width) * bucket_width - right_start) < bucket_width
        ]

        if left_col_rights and right_col_lefts:
            left_col_right_edge = max(left_col_rights)
            right_col_left_edge = min(right_col_lefts)
            split_x = (left_col_right_edge + right_col_left_edge) / 2
        else:
            split_x = (left_start + right_start) / 2

        logger.info(
            f"Column detection: two columns "
            f"(left starts at x≈{left_start:.0f} [{b1_count} lines], "
            f"right starts at x≈{right_start:.0f} [{b2_count} lines], "
            f"split at x={split_x:.1f}, total lines={total_lines})"
        )
        return [[text_x_min, split_x], [split_x, text_x_max]]

    logger.info(
        f"Column detection: single column "
        f"(top bucket x≈{b1_x:.0f} has {b1_count}/{total_lines} lines, "
        f"2nd bucket x≈{b2_x:.0f} has {b2_count} — not enough for 2 cols)"
    )
    return [[text_x_min, text_x_max]]


def _line_font_flags(spans):
    """
    Given a list of PyMuPDF spans for a line, return (is_bold, is_italic, dominant_font_name)
    based on the span that contains the most characters.
    """
    from collections import Counter
    font_counts = Counter()
    font_details = {}

    for span in spans:
        font_name = span.get("font", "")
        flags = span.get("flags", 0)
        
        is_bold = bool(flags & 16) or "Bold" in font_name
        is_italic = bool(flags & 2) or "Italic" in font_name or "Oblique" in font_name
        
        chars_len = len(span.get("chars", []))
        font_counts[font_name] += chars_len
        
        if font_name not in font_details:
            font_details[font_name] = {"is_bold": is_bold, "is_italic": is_italic}
            
    if not font_counts:
        return False, False, ""
        
    dom_font = font_counts.most_common(1)[0][0]
    return font_details[dom_font]["is_bold"], font_details[dom_font]["is_italic"], dom_font


def extract_page_spacing_data(page, page_idx: int = None):
    """
    Extract per-character spatial data and paragraph typography metadata from a page.

    Returns a list of blocks (paragraphs), each containing:
      - paragraph_id: string e.g. "p_{page_idx}_{block_number}"
      - font_size: float (dominant font size in pt)
      - font_family: string (dominant postscript font name)
      - font_color: string (CSS "rgb(r,g,b)")
      - hex_color: string ("#RRGGBB")
      - is_bold: boolean
      - is_italic: boolean
      - align: string ("left", "center", "right", "justify")
      - bbox: list [x0, y0, x1, y1]
      - text: full string content of the paragraph
      - line_count: int
      - spans: list of text span objects
      - lines: list of line objects with line text, bbox, size, font, color, bold, italic, chars
    """
    if page_idx is None:
        page_idx = getattr(page, 'number', 0)

    data = page.get_text("rawdict", flags=fitz.TEXTFLAGS_TEXT)
    blocks_out = []

    for b_idx, block in enumerate(data.get("blocks", [])):
        if block.get("type", -1) != 0:
            continue  # skip image blocks

        block_num = block.get("number", b_idx)
        block_lines = []
        block_spans = []
        all_block_fonts = Counter()
        all_block_sizes = Counter()
        all_block_colors = Counter()
        all_block_bolds = Counter()
        all_block_italics = Counter()

        for line in block.get("lines", []):
            # ── Pass 1: collect all chars with span-level metadata ──────────
            raw_chars = []
            spans = line.get("spans", [])
            dom_bold, dom_italic, dom_font = _line_font_flags(spans)

            for span in spans:
                is_superscript_flag = bool(span.get("flags", 0) & fitz.TEXT_FONT_SUPERSCRIPT)
                span_font = span.get("font", "")
                span_size = span.get("size", 0.0)
                span_flags = span.get("flags", 0)
                
                span_bold = bool(span_flags & 16) or "Bold" in span_font or "bold" in span_font.lower()
                span_italic = bool(span_flags & 2) or "Italic" in span_font or "Oblique" in span_font or "italic" in span_font.lower()
                
                span_color_css, span_hex = parse_color(span.get("color", 0))
                
                span_text = normalize_pdf_text(span.get("text", ""))
                if not span_text and "chars" in span:
                    span_text = "".join(normalize_pdf_text(ch.get("c", "")) for ch in span.get("chars", []))

                block_spans.append({
                    "text": span_text,
                    "font": span_font,
                    "size": round(span_size, 1),
                    "color": span_color_css,
                    "hex_color": span_hex,
                    "is_bold": span_bold,
                    "is_italic": span_italic,
                })

                for ch in span.get("chars", []):
                    ch_text = normalize_pdf_text(ch.get("c", ""))
                    raw_chars.append({
                        "c":              ch_text,
                        "x0":             ch["bbox"][0],
                        "x1":             ch["bbox"][2],
                        "y0":             ch["bbox"][1],
                        "y1":             ch["bbox"][3],
                        "origin_x":       ch["origin"][0],
                        "origin_y":       ch["origin"][1],
                        "font":           span_font,
                        "size":           span_size,
                        "is_superscript_flag": is_superscript_flag,
                        "color":          span_color_css,
                        "hex_color":      span_hex,
                        "is_bold":        span_bold,
                        "is_italic":      span_italic,
                    })
                    if ch_text.strip():
                        all_block_fonts[span_font] += 1
                        all_block_sizes[round(span_size, 1)] += 1
                        all_block_colors[(span_color_css, span_hex)] += 1
                        all_block_bolds[span_bold] += 1
                        all_block_italics[span_italic] += 1

            if not raw_chars:
                continue

            # ── Pass 2: compute dominant baseline & size for subscript detection ──
            normal_origins = [ch["origin_y"] for ch in raw_chars if not ch["is_superscript_flag"]]
            if not normal_origins:
                normal_origins = [ch["origin_y"] for ch in raw_chars]
            bucketed = [round(y * 2) / 2 for y in normal_origins]
            dom_baseline = Counter(bucketed).most_common(1)[0][0]

            normal_sizes = [ch["size"] for ch in raw_chars if not ch["is_superscript_flag"]]
            if not normal_sizes:
                normal_sizes = [ch["size"] for ch in raw_chars]
            dom_line_size = Counter(normal_sizes).most_common(1)[0][0]

            sub_threshold = dom_line_size * 0.15

            # ── Pass 3: tag each char with final is_superscript / is_subscript ──
            line_chars = []
            for ch in raw_chars:
                is_sup = ch["is_superscript_flag"]
                is_sub = (
                    not is_sup
                    and ch["origin_y"] > dom_baseline + sub_threshold
                    and ch["size"] < dom_line_size - 0.5
                )
                line_chars.append({
                    "c":              ch["c"],
                    "x0":             ch["x0"],
                    "x1":             ch["x1"],
                    "y0":             ch["y0"],
                    "y1":             ch["y1"],
                    "origin_x":       ch["origin_x"],
                    "origin_y":       ch["origin_y"],
                    "font":           ch["font"],
                    "size":           ch["size"],
                    "is_superscript": is_sup,
                    "is_subscript":   is_sub,
                    "color":          ch["color"],
                })

            if not line_chars:
                continue

            gaps = []
            for i in range(1, len(line_chars)):
                gap = line_chars[i]["x0"] - line_chars[i - 1]["x1"]
                gaps.append(gap)

            line_color_counts = Counter(c["color"] for c in line_chars)
            dom_color = line_color_counts.most_common(1)[0][0] if line_color_counts else "rgb(0, 0, 0)"

            x0 = line["bbox"][0]
            y0 = line["bbox"][1]
            x1 = line["bbox"][2]
            y1 = line["bbox"][3]
            line_text = "".join(c["c"] for c in line_chars)
            space_count = line_text.count(" ")

            block_lines.append({
                "text":        line_text,
                "bbox":        [x0, y0, x1, y1],
                "width":       x1 - x0,
                "height":      y1 - y0,
                "space_count": space_count,
                "chars":       line_chars,
                "gaps":        gaps,
                "line_x0":     x0,
                "line_x1":     x1,
                "line_y0":     y0,
                "line_y1":     y1,
                "is_bold":     dom_bold,
                "is_italic":   dom_italic,
                "dominant_font": dom_font,
                "dominant_color": dom_color,
                "size":        round(dom_line_size, 1),
                "font":        dom_font,
                "color":       dom_color,
                "bold":        dom_bold,
                "italic":      dom_italic,
            })

        if block_lines:
            # Determine block alignment authoritatively from line coordinates
            block_align = "left"
            b_x0s = [l["line_x0"] for l in block_lines]
            b_x1s = [l["line_x1"] for l in block_lines]
            b_y0s = [l["line_y0"] for l in block_lines]
            b_y1s = [l["line_y1"] for l in block_lines]
            block_x0 = min(b_x0s)
            block_x1 = max(b_x1s)
            block_y0 = min(b_y0s)
            block_y1 = max(b_y1s)

            if len(block_lines) > 1:
                justified_count = 0
                for l in block_lines[:-1]:  # exclude final line
                    touches_left = abs(l["line_x0"] - block_x0) < 5.0
                    touches_right = abs(l["line_x1"] - block_x1) < 18.0
                    if touches_left and touches_right:
                        justified_count += 1

                if len(block_lines) > 1 and justified_count >= (len(block_lines) - 1) / 2:
                    block_align = "justify"
                else:
                    midpoints = [(l["line_x0"] + l["line_x1"]) / 2 for l in block_lines]
                    block_mid = (block_x0 + block_x1) / 2
                    if all(abs(m - block_mid) < 5.0 for m in midpoints):
                        block_align = "center"
                    elif all(abs(l["line_x1"] - block_x1) < 5.0 for l in block_lines):
                        block_align = "right"

            # Dominant block font properties
            dom_font_family = all_block_fonts.most_common(1)[0][0] if all_block_fonts else (block_lines[0]["dominant_font"] if block_lines else "Helvetica")
            dom_font_size = all_block_sizes.most_common(1)[0][0] if all_block_sizes else (block_lines[0]["size"] if block_lines else 12.0)
            dom_color_pair = all_block_colors.most_common(1)[0][0] if all_block_colors else ("rgb(0, 0, 0)", "#000000")
            dom_rgb, dom_hex = dom_color_pair
            dom_block_bold = all_block_bolds.most_common(1)[0][0] if all_block_bolds else False
            dom_block_italic = all_block_italics.most_common(1)[0][0] if all_block_italics else False

            paragraph_text = "\n".join(l["text"] for l in block_lines)
            paragraph_id = f"p_{page_idx}_{block_num}"

            blocks_out.append({
                "paragraph_id": paragraph_id,
                "block_number": block_num,
                "font_size": dom_font_size,
                "font_family": dom_font_family,
                "font_color": dom_rgb,
                "hex_color": dom_hex,
                "is_bold": dom_block_bold,
                "is_italic": dom_block_italic,
                "align": block_align,
                "bbox": [block_x0, block_y0, block_x1, block_y1],
                "text": paragraph_text,
                "line_count": len(block_lines),
                "spans": block_spans,
                "lines": block_lines,
            })

    return blocks_out


def get_pdf_spacing_payload(pdf_bytes, doc_id: str = None):
    """
    Process a PDF byte-string and return a per-page spacing and typography payload.
    Each entry: {"page": int, "blocks": [...], "columns": [[xL, xR], ...]}
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    payload = []
    total_paragraphs = 0

    logger.info("=" * 70)
    logger.info(f"   [TYPOGRAPHY ENGINE] START: Extracting typography for PDF ({len(doc)} pages)")
    logger.info("=" * 70)

    for page_index in range(len(doc)):
        page = doc[page_index]
        page_blocks = extract_page_spacing_data(page, page_idx=page_index)
        column_boundaries = _get_column_boundaries(page)

        # Collect inline images (e.g. ORCID iD badge, symbol glyphs) so the
        # frontend canvas can redraw them during editing.
        images = []
        for img_info in page.get_image_info(xrefs=True):
            xref = img_info.get("xref")
            if not xref or img_info.get("bbox") is None:
                continue
            try:
                extracted = doc.extract_image(xref)
                images.append({
                    "bbox": list(img_info["bbox"]),
                    "data": base64.b64encode(extracted["image"]).decode("ascii"),
                    "ext": extracted["ext"],
                })
            except Exception:
                continue

        for p_idx, blk in enumerate(page_blocks):
            total_paragraphs += 1
            preview = blk["text"].replace("\n", " ")
            if len(preview) > 40:
                preview = preview[:40] + "..."
            logger.info(
                f"[INFO] [TYPOGRAPHY] Page P{page_index + 1} | Paragraph #{p_idx + 1} ({blk['paragraph_id']}) | "
                f"Font: {blk['font_family']} ({blk['font_size']}pt) | Color: {blk['font_color']}/{blk['hex_color']} | "
                f"Align: {blk['align']} | Text: \"{preview}\""
            )

        payload.append({
            "page": page_index,
            "blocks": page_blocks,
            "columns": column_boundaries,
            "inline_images": images,
        })

    doc.close()

    logger.info("=" * 70)
    logger.info(f"   [TYPOGRAPHY ENGINE] SUCCESS: Extracted {total_paragraphs} paragraphs across {len(payload)} pages")
    logger.info("=" * 70)

    return payload


@router.post("/extract-typography")
async def extract_typography(file: UploadFile = File(...), doc_id: str = Form(None)):
    """
    Extracts rich paragraph typography payload from PDF and caches it in memory.
    """
    try:
        content = await file.read()
        if not doc_id:
            doc_id = hashlib.sha256(content).hexdigest()[:16]

        payload = get_pdf_spacing_payload(content, doc_id=doc_id)

        cached_result = {
            "doc_id": doc_id,
            "total_pages": len(payload),
            "total_paragraphs": sum(len(p["blocks"]) for p in payload),
            "pages": payload,
        }
        TYPOGRAPHY_CACHE[doc_id] = cached_result
        return JSONResponse(status_code=200, content=cached_result)
    except Exception as e:
        logger.error(f"extract-typography failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to extract typography: {str(e)}"},
        )


@router.get("/typography/{doc_id}")
async def get_cached_typography(doc_id: str):
    """
    Retrieves cached typography payload for doc_id.
    """
    if doc_id in TYPOGRAPHY_CACHE:
        return JSONResponse(status_code=200, content=TYPOGRAPHY_CACHE[doc_id])
    return JSONResponse(
        status_code=404,
        content={"error": f"Typography metadata for doc_id '{doc_id}' not found in cache"},
    )


@router.post("/extract-spacing")
async def extract_spacing(file: UploadFile = File(...)):
    """
    Extract per-character spacing data and column boundaries for every page.
    Used by the frontend to build editing boxes that correctly handle
    multi-column layouts and post-bake text positioning.
    Enriched with rich paragraph typography metadata for backwards compatibility.
    """
    try:
        content = await file.read()
        doc_id = hashlib.sha256(content).hexdigest()[:16]
        payload = get_pdf_spacing_payload(content, doc_id=doc_id)

        cached_result = {
            "doc_id": doc_id,
            "total_pages": len(payload),
            "total_paragraphs": sum(len(p["blocks"]) for p in payload),
            "pages": payload,
        }
        TYPOGRAPHY_CACHE[doc_id] = cached_result

        return JSONResponse(status_code=200, content=payload)
    except Exception as e:
        logger.error(f"extract-spacing failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to extract spacing layout"},
        )


@router.post("/extract-fonts")
async def extract_fonts(file: UploadFile = File(...)):
    """
    Extract all embedded fonts from the PDF and return them as base64-encoded
    blobs suitable for @font-face injection in the frontend.
    
    Returns: {
      "MetaProLight-Regular": {
        "data": "<base64>",
        "format": "otf",  // "otf" | "ttf" | "woff" etc.
        "postscript_name": "MetaProLight-Regular",
        "subset_tag": "NBUDXT",  // 6-letter prefix, if any
      },
      ...
    }
    """
    
    try:
        pdf_bytes = await file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        fonts_out = {}
        seen_xrefs = set()
        
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            # page.get_fonts(full=True) returns list of tuples:
            # (xref, ext, type, basename, refname, encoding)
            for font_info in page.get_fonts(full=True):
                xref = font_info[0]
                if xref in seen_xrefs:
                    continue
                seen_xrefs.add(xref)
                
                basename = font_info[3]  # e.g. "NBUDXT+MetaProLight-Regular"
                
                # Parse subset prefix (6 uppercase letters + "+")
                subset_tag = None
                postscript_name = basename
                if len(basename) > 7 and basename[6] == "+" and basename[:6].isupper() and basename[:6].isalpha():
                    subset_tag = basename[:6]
                    postscript_name = basename[7:]
                
                # Skip duplicate base names (same font embedded multiple times)
                if basename in fonts_out:
                    continue
                
                try:
                    font_data = doc.extract_font(xref)
                    # extract_font returns (basename, ext, encoding, content)
                    ext = font_data[1]
                    buffer = font_data[3]
                    
                    if not buffer:
                        logger.warning(f"Font {basename} has empty buffer")
                        continue
                    
                    # Wrap bare CFF in OTF container so the browser can parse it.
                    # (Browsers don't load naked .cff files via @font-face.)
                    if ext == "cff":
                        try:
                            buffer = wrap_cff_in_otf(buffer)
                            if buffer:
                                ext = "otf"
                            else:
                                logger.warning(f"CFF→OTF wrap returned None for {basename}")
                                continue
                        except Exception as e:
                            logger.warning(f"CFF→OTF wrap failed for {basename}: {e}")
                            continue
                    
                    # Handle Type1 / Type3 / other unsupported-by-browsers formats
                    if ext not in ("otf", "ttf", "woff", "woff2"):
                        logger.info(f"Skipping font {basename} with unsupported ext '{ext}'")
                        continue
                    
                    # Inject valid cmap subtable for browser font preview loading (skip_cmap=False)
                    try:
                        injected_buffer = _inject_cmap(
                            buffer, doc, xref, page=page, basefont_name=basename, skip_cmap=False
                        )
                        if injected_buffer:
                            buffer = injected_buffer
                        else:
                            logger.warning(f"cmap injection returned None for {basename} — skipping font")
                            continue
                    except Exception as e:
                        logger.warning(f"cmap injection failed for {basename}: {e} — skipping font")
                        continue

                    stem_vw_ratio = extract_stem_vw_ratio(buffer, ext)
                    
                    fonts_out[basename] = {
                        "data": base64.b64encode(buffer).decode("ascii"),
                        "format": ext,
                        "postscript_name": postscript_name,
                        "subset_tag": subset_tag,
                        "stem_vw_ratio": stem_vw_ratio,
                    }
                    logger.info(f"Extracted font {basename} ({len(buffer)} bytes, {ext}, stem_vw_ratio: {stem_vw_ratio})")
                except Exception as e:
                    logger.warning(f"Failed to extract font {basename}: {e}")
        
        doc.close()
        logger.info("=" * 70)
        logger.info(f"   [FONT ENGINE] SUCCESS: Serving {len(fonts_out)} embedded PDF fonts to frontend:")
        for fn in fonts_out.keys():
            logger.info(f"      • {fn}")
        logger.info("=" * 70)
        return JSONResponse(status_code=200, content=fonts_out)
    except Exception as e:
        logger.error(f"extract-fonts failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to extract fonts"},
        )
