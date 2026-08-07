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
from converter.font_utils import (
    wrap_cff_in_otf,
    extract_stem_vw_ratio,
    _inject_cmap,
    vault_ingest,
    root_family,
)
from converter.font_vault import vault_ingest_batch

import os, re

logger = logging.getLogger(__name__)
logger.setLevel(os.getenv("EDITOR_LOG_LEVEL", "INFO").upper())
if not logger.handlers:
    _console = logging.StreamHandler()
    _console.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logger.addHandler(_console)
    logger.propagate = False

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

import unicodedata

UNICODE_SUPER_MAP = str.maketrans({
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9'
})

LIGATURE_MAP = {
    '\uFB00': 'ff',
    '\uFB01': 'fi',
    '\uFB02': 'fl',
    '\uFB03': 'ffi',
    '\uFB04': 'ffl',
    '\uFB05': 'ft',
    '\uFB06': 'st',
}

def normalize_pdf_text(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize('NFKC', text)
    for lig, replacement in LIGATURE_MAP.items():
        text = text.replace(lig, replacement)
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

        logger.debug(
            f"Column detection: two columns "
            f"(left starts at x≈{left_start:.0f} [{b1_count} lines], "
            f"right starts at x≈{right_start:.0f} [{b2_count} lines], "
            f"split at x={split_x:.1f}, total lines={total_lines})"
        )
        return [[text_x_min, split_x], [split_x, text_x_max]]

    logger.debug(
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


def _collect_enclosing_rects(page):
    """
    Collect enclosing rects from page drawings, filtering out rules, page frames,
    and — critically — nested redaction fill rects accumulated by repeated bakes.

    Each bake paints a fill-only rect into the content stream; repeated bakes
    over the same paragraph leave a stack of nested fill-only rects. If all are
    returned, _innermost_rect partitions the paragraph's lines across the nested
    rects into multiple 'rect' regions that _heal_rect_splits cannot merge
    (rect→rect hits kind_mismatch). Dropping inner fill-only rects collapses
    them back to the single outermost fill, keeping all lines in one region.

    Only fill-only (no stroke) rects are eligible for dropping; stroked rects
    (table cells, figure borders) are always preserved regardless of nesting.
    """
    pr = page.rect
    rects = []
    for d in page.get_drawings():
        r = fitz.Rect(d.get("rect"))
        its = d.get("items") or []
        if not any(it[0] == "re" for it in its):      # true rect ops only
            continue
        if r.width < 8 or r.height < 8:               # skip rules/underlines
            continue
        if r.get_area() > 0.9 * pr.get_area():        # skip page frame
            continue
        fill_only = (d.get("fill") is not None) and (d.get("color") is None)
        rects.append((r, fill_only))

    # de-duplicate near-identical rects (double-stroked borders)
    deduped = []
    for r, fo in rects:
        if not any(abs(o.x0-r.x0)<0.5 and abs(o.y0-r.y0)<0.5 and
                   abs(o.x1-r.x1)<0.5 and abs(o.y1-r.y1)<0.5 for o, _ in deduped):
            deduped.append((r, fo))

    # ── KEY FIX: collapse nested redaction fills ─────────────────────────────
    # Repeated bakes stack fill-only rects; _innermost_rect would partition one
    # paragraph's lines across the nested rects into multiple 'rect' regions,
    # which _heal_rect_splits cannot merge (rect→rect hits kind_mismatch).
    # Keep only the OUTERMOST fill-only rect; never drop stroked (structural)
    # rects, and never drop a rect that merely overlaps (not contained).
    out = []
    for r, fo in deduped:
        nested = fo and any(
            o_fo and (o is not r) and
            o.x0 <= r.x0 + 0.5 and o.y0 <= r.y0 + 0.5 and
            o.x1 >= r.x1 - 0.5 and o.y1 >= r.y1 - 0.5
            for o, o_fo in deduped
        )
        if nested:
            logger.debug(
                f"[RECTS] dropping nested redaction fill "
                f"{tuple(round(v, 1) for v in (r.x0, r.y0, r.x1, r.y1))}"
            )
            continue
        out.append(r)
    return out


def _innermost_rect(rects, bbox):
    best = None
    for r in rects:
        if r.contains(bbox):
            if best is None or r.get_area() < best.get_area():
                best = r
    return best


def get_base_font_family(font_name: str) -> str:
    if not font_name:
        return ""
    return font_name.split("-")[0].split(",")[0]


def _cluster_free_lines(free):
    if not free:
        return []
    free = sorted(free, key=lambda l: (round(l["bbox"][1], 1), l["bbox"][0]))
    out, cur = [], [free[0]]
    for prev, nxt in zip(free, free[1:]):
        pb, nb = fitz.Rect(prev["bbox"]), fitz.Rect(nxt["bbox"])
        v_gap   = nb.y0 - pb.y1
        v_tol   = max(3.5, 0.6 * min(prev["size"], nxt["size"]))   # font-scaled (stable across descenderless lines)
        h_ovl   = min(pb.x1, nb.x1) - max(pb.x0, nb.x0)
        x_close = (abs(pb.x0 - nb.x0) <= 0.5 * max(pb.height, nb.height)
                   or h_ovl > 0.3 * min(pb.width, nb.width))
        size_ok = abs(prev["size"] - nxt["size"]) <= 2.5
        family_similar = (prev.get("font_family") == nxt.get("font_family")
                          or prev.get("font_family", "") in nxt.get("font_family", "")
                          or nxt.get("font_family", "") in prev.get("font_family", ""))
        # Allow merge if: same family OR size difference <= 1.0
        merge_ok = size_ok or (abs(prev["size"] - nxt["size"]) <= 1.0 and family_similar)

        logger.debug(f"[CLUSTER-DEBUG] gap={v_gap:.2f} tol={v_tol:.2f} | x_close={x_close} | "
              f"sz={prev['size']:.1f}->{nxt['size']:.1f} | merge={merge_ok} | "
              f"Text: {prev.get('text', '')[:20]!r} -> {nxt.get('text', '')[:20]!r}")

        if v_gap <= v_tol and x_close and merge_ok:
            cur.append(nxt)
        else:
            out.append(cur); cur = [nxt]
    out.append(cur)
    return out


def _merge_line_fragments(lines):
    """Re-join baked-span fragments into single visual lines BEFORE clustering.
    Uses baseline matching (origin_y) to survive fallback fonts with different
    ascender/descender metrics that break strict bbox overlap checks."""
    if not lines:
        return lines
        
    from collections import Counter
    
    merged = []
    for ln in lines:
        h = max(0.1, ln["line_y1"] - ln["line_y0"])
        hit = None
        
        # Calculate dominant baseline for this fragment (ignore super/sub chars)
        ln_baseline = None
        chars = ln.get("chars") or []
        if chars:
            orig_ys = [
                c.get("origin_y", c.get("origin", [0,0])[1] if isinstance(c.get("origin"), (list, tuple)) and len(c.get("origin")) > 1 else 0) 
                for c in chars 
                if not c.get("is_superscript") and not c.get("is_subscript")
            ]
            if orig_ys:
                ln_baseline = Counter(round(y, 1) for y in orig_ys).most_common(1)[0][0]

        for m in merged:
            mh = max(0.1, m["line_y1"] - m["line_y0"])
            ov = min(m["line_y1"], ln["line_y1"]) - max(m["line_y0"], ln["line_y0"])
            
            # Check 1: Bbox overlap (lowered threshold to 0.25 for forgiveness)
            bbox_match = ov > 0.25 * min(h, mh)
            
            # Check 2: Baseline match (survives fallback font metric mismatches)
            baseline_match = False
            if ln_baseline is not None and m.get("_baseline") is not None:
                baseline_match = abs(ln_baseline - m["_baseline"]) < 1.5

            if bbox_match or baseline_match:
                hit = m
                break
                
        if hit is None:
            hit = dict(ln)
            hit["chars"] = list(chars)
            hit["_baseline"] = ln_baseline
            merged.append(hit)
            continue
            
        # Merge into existing hit
        hit["chars"] += chars
        hit["chars"].sort(key=lambda c: c.get("bbox", [c.get("x0", 0), c.get("y0", 0), c.get("x1", 0), c.get("y1", 0)])[0])
        hit["line_x0"] = min(hit["line_x0"], ln["line_x0"])
        hit["line_x1"] = max(hit["line_x1"], ln["line_x1"])
        hit["line_y0"] = min(hit["line_y0"], ln["line_y0"])
        hit["line_y1"] = max(hit["line_y1"], ln["line_y1"])
        
    # Rebuild text and metadata for merged lines
    for m in merged:
        cs = m["chars"]
        txt = ""
        for i, c in enumerate(cs):
            ch_c = c.get("c", "")
            c_x0 = c.get("bbox", [c.get("x0", 0), c.get("y0", 0), c.get("x1", 0), c.get("y1", 0)])[0]
            prev_x1 = cs[i-1].get("bbox", [cs[i-1].get("x0", 0), cs[i-1].get("y0", 0), cs[i-1].get("x1", 0), cs[i-1].get("y1", 0)])[2]
            if i and (c_x0 - prev_x1) > 0.5 and ch_c != " " and not txt.endswith(" "):
                txt += " "
            txt += ch_c
        m["text"] = txt
        m["bbox"] = [m["line_x0"], m["line_y0"], m["line_x1"], m["line_y1"]]
        m["width"] = m["line_x1"] - m["line_x0"]
        m["height"] = m["line_y1"] - m["line_y0"]
        m["space_count"] = txt.count(" ")
        m["gaps"] = [
            cs[i].get("bbox", [cs[i].get("x0", 0), cs[i].get("y0", 0), cs[i].get("x1", 0), cs[i].get("y1", 0)])[0] - 
            cs[i-1].get("bbox", [cs[i-1].get("x0", 0), cs[i-1].get("y0", 0), cs[i-1].get("x1", 0), cs[i-1].get("y1", 0)])[2] 
            for i in range(1, len(cs))
        ]
        
        body = [c for c in cs if not c.get("is_superscript") and not c.get("is_subscript")] or cs
        m["size"] = round(Counter(c.get("size", 10) for c in body).most_common(1)[0][0], 1)
        m["font"] = m["dominant_font"] = Counter(c.get("font", "helv") for c in body).most_common(1)[0][0]
        m["font_family"] = get_base_font_family(m["font"]) if 'get_base_font_family' in globals() else m["font"]
        m["color"] = m["dominant_color"] = Counter(c.get("color", 0) for c in body).most_common(1)[0][0]
        
    total_in  = sum(len(ln.get("chars") or []) for ln in lines)
    total_out = sum(len(m["chars"]) for m in merged)
    if total_out != total_in:
        logger.warning(f"[MERGE-LOSS] page fragment merge dropped "
                       f"{total_in - total_out} char(s); rebuilding unmerged")
        return lines   # fail safe: never emit lossy text
    for m in merged:
        logger.debug(f"[MERGED-LINE] y={m['line_y0']:.1f}..{m['line_y1']:.1f} "
                     f"text={m['text'][:60]!r}")
    return merged


def _split_bucket_by_left_edge(bucket, align_tol=3.0, min_share=0.15, depth=0):
    """Split a page-column bucket into left-edge sub-buckets when it secretly
    contains two visual columns (e.g. 8pt sidebar at x0=40 + 9pt abstract at x0=144).

    Returns a list with one element ([bucket] unchanged) unless BOTH:
      - the two largest left-edge clusters each hold >= max(3, 15%) lines, AND
      - their separation is >= max(36pt, 5x DOMINANT (not max) font size).

    Hanging-indents (~10-20pt gap) therefore never trigger a split, while a
    sidebar-vs-abstract separation of ~103pt will.
    """
    if depth > 1 or len(bucket) < 8:
        return [bucket]

    get_x0 = lambda ln: ln["line_x0"] if "line_x0" in ln else ln["bbox"][0]

    # Use the DOMINANT (most-common) font size, not max — a single 22pt heading
    # in the bucket must not inflate the threshold from 36pt to 110pt.
    size_counts = Counter(round(ln.get("size", 10.0), 1) for ln in bucket)
    dom_size = size_counts.most_common(1)[0][0] if size_counts else 10.0

    # Cluster lines by left-edge proximity (within align_tol)
    clusters = []
    for ln in sorted(bucket, key=get_x0):
        placed = False
        for c in clusters:
            if abs(c["x0"] - get_x0(ln)) <= align_tol:
                # Running average keeps anchor accurate
                c["x0"] = (c["x0"] * c["n"] + get_x0(ln)) / (c["n"] + 1)
                c["n"] += 1
                placed = True
                break
        if not placed:
            clusters.append({"x0": get_x0(ln), "n": 1})

    if len(clusters) < 2:
        return [bucket]

    # Evaluate only the two most-populated clusters
    clusters.sort(key=lambda c: -c["n"])
    a, b = sorted(clusters[:2], key=lambda c: c["x0"])
    n = len(bucket)
    sep = b["x0"] - a["x0"]
    sep_floor = max(36.0, 5.0 * dom_size)

    # Guard: both groups must be substantial
    if a["n"] < max(3, min_share * n) or b["n"] < max(3, min_share * n):
        logger.debug(
            f"[SPLIT-SKIP] depth={depth} n={n} dom_size={dom_size:.1f} "
            f"anchors=[({a['x0']:.1f},{a['n']}),({b['x0']:.1f},{b['n']})] "
            f"sep={sep:.1f} reason=min_share"
        )
        return [bucket]
    # Guard: separation must exceed hanging-indent scale
    if sep < sep_floor:
        logger.debug(
            f"[SPLIT-SKIP] depth={depth} n={n} dom_size={dom_size:.1f} "
            f"anchors=[({a['x0']:.1f},{a['n']}),({b['x0']:.1f},{b['n']})] "
            f"sep={sep:.1f} < floor={sep_floor:.1f} reason=sep"
        )
        return [bucket]

    mid = (a["x0"] + b["x0"]) / 2.0
    left  = sorted([ln for ln in bucket if get_x0(ln) <  mid], key=lambda l: l["line_y0"])
    right = sorted([ln for ln in bucket if get_x0(ln) >= mid], key=lambda l: l["line_y0"])
    out = []
    for part in (left, right):
        out.extend(_split_bucket_by_left_edge(part, align_tol, min_share, depth + 1))
    return out


# ---------------------------------------------------------------------------
# Bullet / marker glyph pre-pass helpers
# ---------------------------------------------------------------------------

MARKER_GLYPHS = set("\u21d2\u2794\u2192\u27f6\u2022\u25e6\u25aa\u25ba\u25b6\u25a0\u25a1\u00b7\u2013\u2014")


def _is_marker_line(ln):
    """Return True if this line is a standalone bullet/arrow marker (1–2 non-space glyphs)."""
    txt = "".join(ch for ch in ln.get("text", "") if not ch.isspace())
    return 1 <= len(txt) <= 2 and all(c in MARKER_GLYPHS for c in txt)


def _attach_bullet_markers(lines):
    """
    Pre-pass: merge single-glyph bullet/arrow marker lines into the text line
    that sits immediately to their right on the same visual row.

    A 'marker' line has 1-2 non-whitespace chars that are all bullet symbols
    (e.g. ⇒, •, ►).  These are emitted by PyMuPDF as separate lines with a
    different font and zero horizontal overlap with the body text – so the
    normal x_close clustering rule never fires.  We attach them here before
    column bucketing so downstream clustering sees a single wide line.
    """
    lines = [dict(l) for l in lines]
    for m in lines:
        if not _is_marker_line(m):
            continue
        for t in lines:
            if t is m or t.get("_consumed"):
                continue
            # Same visual row: vertical overlap AND marker sits to the left of text
            if (t["line_y0"] < m["line_y1"] and m["line_y0"] < t["line_y1"]
                    and m["line_x1"] <= t["line_x0"] + 3.0):
                # Prepend marker chars and expand bounding geometry
                t["chars"]   = m["chars"] + t["chars"]
                t["line_x0"] = min(m["line_x0"], t["line_x0"])
                t["bbox"]    = [
                    min(m["bbox"][0], t["bbox"][0]),
                    min(m["bbox"][1], t["bbox"][1]),
                    max(m["bbox"][2], t["bbox"][2]),
                    max(m["bbox"][3], t["bbox"][3]),
                ]
                sep = "" if m["text"].endswith(" ") else " "
                t["text"] = m["text"] + sep + t["text"]
                m["_consumed"] = True
                break
    return [l for l in lines if not l.get("_consumed")]


def extract_page_spacing_data(page, page_idx: int = None,
                              page_images=None, page_drawings=None,
                              pdf_bytes=None):
    """
    Extract per-character spatial data and paragraph typography metadata from a page.
    Uses 3-tier region extraction: rect-bound -> gap-clustered -> per-line floor.
    """
    if page_idx is None:
        page_idx = getattr(page, 'number', 0)

    blocks_out = []

    def _extract_all_lines():
        all_lines = []
        # Use TEXT_ACCURATE_BBOXES so PyMuPDF evaluates actual glyph outlines
        # instead of synthesised ascender/descender metrics. This fixes the
        # right-border under-reporting on condensed CFF fonts (HelveticaNeueLTStd-Cn)
        # and symbol glyphs (e.g. ⇒) that regressed in PyMuPDF ≥1.25.0.
        # unset_quad_corrections is required as a companion (maintainer note, issue #4115).
        fitz.TOOLS.unset_quad_corrections(True)
        flags = fitz.TEXTFLAGS_RAWDICT | fitz.TEXT_ACCURATE_BBOXES
        data = page.get_text("rawdict", flags=flags)
        for block in data.get("blocks", []):
            if block.get("type", -1) != 0:
                continue
            for line in block.get("lines", []):
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

                if not raw_chars:
                    continue

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
                        "hex_color":      ch.get("hex_color", "#000000"),
                        "is_bold":        ch.get("is_bold", False),
                        "is_italic":      ch.get("is_italic", False),
                    })

                if not line_chars:
                    continue

                gaps = [line_chars[i]["x0"] - line_chars[i - 1]["x1"] for i in range(1, len(line_chars))]
                line_color_counts = Counter(c["color"] for c in line_chars)
                dom_color = line_color_counts.most_common(1)[0][0] if line_color_counts else "rgb(0, 0, 0)"

                x0, y0, x1, y1 = line["bbox"][0], line["bbox"][1], line["bbox"][2], line["bbox"][3]
                line_text = "".join(c["c"] for c in line_chars)

                base_family = get_base_font_family(dom_font)
                has_bold = bool("Bold" in dom_font or "-Bd" in dom_font or "bold" in dom_font.lower() or dom_bold)
                has_italic = bool("Italic" in dom_font or "-It" in dom_font or "Oblique" in dom_font or "italic" in dom_font.lower() or dom_italic)

                all_lines.append({
                    "text":        line_text,
                    "bbox":        [x0, y0, x1, y1],
                    "width":       x1 - x0,
                    "height":      y1 - y0,
                    "space_count": line_text.count(" "),
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
                    "font_family": base_family,
                    "has_bold":    has_bold,
                    "has_italic":  has_italic,
                    "spans":       spans,
                })
        return all_lines

    try:
        all_lines = _extract_all_lines()
        # Attach hanging-indent bullet/arrow markers to their text lines before
        # column bucketing so downstream gap-clustering merges them correctly.
        all_lines = _attach_bullet_markers(all_lines)
        if not all_lines:
            return []

        cols = _get_column_boundaries(page)
        rects = _collect_enclosing_rects(page)
        grouped, free = {}, []
        for line in all_lines:
            r = _innermost_rect(rects, fitz.Rect(line["bbox"]))
            if r:
                grouped.setdefault(tuple(r), []).append(line)
            else:
                free.append(line)

        logger.debug(f"[RECTS] page {page_idx}: {len(rects)} rects: "
                     f"{[tuple(round(v,1) for v in r) for r in rects]}")
        logger.debug(f"[GROUP] page {page_idx}: rect-assigned={sum(len(v) for v in grouped.values())} free={len(free)}")

        buckets = {i: [] for i in range(len(cols))}
        for ln in free:
            x0 = ln["line_x0"]
            idx = None
            for i, (c0, c1) in enumerate(cols):
                if c0 - 5 <= x0 <= c1 + 5:
                    idx = i
                    break
            if idx is None:  # nearest column LEFT edge (not center)
                idx = min(range(len(cols)), key=lambda i: abs(x0 - cols[i][0]))
            buckets[idx].append(ln)

        logger.debug(
            f"[REGIONS-DEBUG] page {page_idx}: "
            f"cols={[(round(a, 1), round(b, 1)) for a, b in cols]} "
            f"bucket_sizes={ {i: len(v) for i, v in buckets.items()} }"
        )

        region_tuples = []
        for r_key, lines in grouped.items():
            cx = (min(l["line_x0"] for l in lines) + max(l["line_x1"] for l in lines)) / 2
            c_idx = 0
            for i, (c0, c1) in enumerate(cols):
                if c0 - 5 <= cx <= c1 + 5:
                    c_idx = i
                    break
            region_tuples.append((lines, "rect", c_idx))

        for i in sorted(buckets):
            if buckets[i]:
                subs = _split_bucket_by_left_edge(buckets[i])
                # Unconditional — prints even for 1-sub-bucket (proves the path ran)
                logger.debug(
                    f"[SUBBUCKET] page {page_idx} bucket {i}: {len(subs)} sub-bucket(s) "
                    f"sizes={[len(s) for s in subs]} "
                    f"anchors={[round(s[0]['line_x0'], 1) for s in subs]}"
                )
                for sub in subs:
                    sub = _merge_line_fragments(sub)
                    for cluster in _cluster_free_lines(sub):
                        region_tuples.append((cluster, "gap", i))

        if not region_tuples:
            region_tuples = [([l], "line", 0) for l in all_lines]

        for lines, kind, col in region_tuples:
            logger.debug(f"[REGION] page {page_idx} kind={kind} col={col} n={len(lines)} "
                         f"y={lines[0]['line_y0']:.0f}..{lines[-1]['line_y1']:.0f} '{lines[0]['text'][:30]}'")

        logger.debug(
            f"[REGIONS] page {page_idx}: rect_regions={len(grouped)} "
            f"free_lines={len(free)} regions={len(region_tuples)}"
        )

    except Exception as e:
        logger.exception(f"[REGIONS] extract_page_spacing_data failed on page {page_idx}")
        try:
            all_lines = _extract_all_lines()
        except Exception:
            all_lines = []
        region_tuples = [([l], "line", 0) for l in all_lines]

    # Sort regions by column index (primary), y0 (secondary), x0 (tertiary)
    region_tuples.sort(
        key=lambda item: (
            item[2],
            round(min(l["line_y0"] for l in item[0]), 1),
            min(l["line_x0"] for l in item[0])
        )
    )

    for reg_idx, (reg_lines, reg_kind, _col) in enumerate(region_tuples):
        if not reg_lines:
            continue

        paragraph_text = "\n".join(l["text"] for l in reg_lines)

        all_chars = [ch for l in reg_lines for ch in l.get("chars", [])]
        non_space_chars = [ch for ch in all_chars if ch.get("c", "").strip()]
        target_chars = non_space_chars if non_space_chars else all_chars

        if target_chars:
            dom_font_family = Counter(ch["font"] for ch in target_chars).most_common(1)[0][0]
            total_width = sum(max(0.0, ch["x1"] - ch["x0"]) for ch in target_chars)
            if total_width > 0:
                dom_font_size = round(sum(ch["size"] * max(0.0, ch["x1"] - ch["x0"]) for ch in target_chars) / total_width, 1)
            else:
                dom_font_size = Counter(round(ch["size"], 1) for ch in target_chars).most_common(1)[0][0]
            dom_color_pair = Counter((ch["color"], ch.get("hex_color", "#000000")) for ch in target_chars).most_common(1)[0][0]
            dom_rgb, dom_hex = dom_color_pair
            dom_block_bold = Counter(ch["is_bold"] for ch in target_chars).most_common(1)[0][0]
            dom_block_italic = Counter(ch["is_italic"] for ch in target_chars).most_common(1)[0][0]
        else:
            dom_font_family = reg_lines[0]["font"]
            dom_font_size = reg_lines[0]["size"]
            dom_rgb, dom_hex = "rgb(0, 0, 0)", "#000000"
            dom_block_bold = reg_lines[0]["is_bold"]
            dom_block_italic = reg_lines[0]["is_italic"]

        # Compute block bounds as union of every line & char bbox
        b_x0s = [l["line_x0"] for l in reg_lines] + [c["x0"] for l in reg_lines for c in l.get("chars", []) if c.get("x0") is not None]
        b_x1s = [l["line_x1"] for l in reg_lines] + [c["x1"] for l in reg_lines for c in l.get("chars", []) if c.get("x1") is not None]
        b_y0s = [l["line_y0"] for l in reg_lines] + [c["y0"] for l in reg_lines for c in l.get("chars", []) if c.get("y0") is not None]
        b_y1s = [l["line_y1"] for l in reg_lines] + [c["y1"] for l in reg_lines for c in l.get("chars", []) if c.get("y1") is not None]
        block_x0 = min(b_x0s)
        block_x1 = max(b_x1s)
        block_y0 = min(b_y0s)
        block_y1 = max(b_y1s)

        block_align = _detect_align_from_lines(reg_lines)

        text_bbox = [block_x0, block_y0, block_x1, block_y1]
        union_bbox = text_bbox[:]

        # Dilate text_bbox by 3pt before testing intersections so vector-art
        # bullets drawn just outside the text cluster edge are still captured.
        dilated_bbox = [text_bbox[0] - 3.0, text_bbox[1] - 3.0,
                        text_bbox[2] + 3.0, text_bbox[3] + 3.0]

        for img in (page_images or []):
            ib = img.get("bbox")
            if ib and _rects_intersect(dilated_bbox, ib):
                union_bbox = _union(union_bbox, list(ib))

        for drw in (page_drawings or []):
            db = drw.get("rect")
            if db:
                db_list = [db.x0, db.y0, db.x1, db.y1]
                if _rects_intersect(dilated_bbox, db_list):
                    union_bbox = _union(union_bbox, db_list)

        pw, ph = page.rect.width, page.rect.height
        union_bbox[0] = max(0.0, union_bbox[0])
        union_bbox[1] = max(0.0, union_bbox[1])
        union_bbox[2] = min(pw, union_bbox[2])
        union_bbox[3] = min(ph, union_bbox[3])

        has_non_text = (union_bbox != text_bbox)
        underlay = None
        paragraph_id = f"p_{page_idx}_{reg_idx}"

        if has_non_text and pdf_bytes is not None:
            try:
                tmp_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                tmp_page = tmp_doc[page_idx]
                u_rect = fitz.Rect(union_bbox)
                tmp_page.add_redact_annot(u_rect)
                tmp_page.apply_redactions(
                    images=fitz.PDF_REDACT_IMAGE_NONE,
                    graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                )
                pix = tmp_page.get_pixmap(clip=u_rect, dpi=144)
                underlay = {
                    "data": base64.b64encode(pix.tobytes("png")).decode("ascii"),
                    "ext": "png",
                    "rect": union_bbox,
                }
                tmp_doc.close()
            except Exception as e:
                logger.warning(f"underlay render failed for {paragraph_id}: {e}")

        u_x0, u_y0, u_x1, u_y1 = union_bbox
        block_spans = []
        for l in reg_lines:
            block_spans.extend(l.get("spans", []))

        blocks_out.append({
            "paragraph_id": paragraph_id,
            "block_number": reg_idx,
            "font_size": dom_font_size,
            "font_family": dom_font_family,
            "font_color": dom_rgb,
            "hex_color": dom_hex,
            "is_bold": dom_block_bold,
            "is_italic": dom_block_italic,
            "align": block_align,
            "bbox": union_bbox,
            "pdfX": u_x0,
            "pdfY_top": u_y0,
            "pdfW": u_x1 - u_x0,
            "pdfH": u_y1 - u_y0,
            "text": paragraph_text,
            "line_count": len(reg_lines),
            "spans": block_spans,
            "lines": [
                dict(l, line_bbox=l["bbox"]) for l in reg_lines
            ],
            "underlay": underlay,
            "region_kind": reg_kind,
        })

    blocks_out = _heal_rect_splits(blocks_out, page_idx=page_idx)
    return blocks_out


def _detect_align_from_lines(lines):
    """
    Detect text alignment ('left', 'justify', 'center', 'right') from a list of line dicts.
    """
    if not lines or len(lines) <= 1:
        return "left"

    b_x0s = [l.get("line_x0", l.get("line_bbox", l.get("bbox", [0, 0, 0, 0]))[0]) for l in lines]
    b_x1s = [l.get("line_x1", l.get("line_bbox", l.get("bbox", [0, 0, 0, 0]))[2]) for l in lines]
    block_x0 = min(b_x0s)
    block_x1 = max(b_x1s)

    justified_count = 0
    for l in lines[:-1]:
        lx0 = l.get("line_x0", l.get("line_bbox", l.get("bbox", [0, 0, 0, 0]))[0])
        lx1 = l.get("line_x1", l.get("line_bbox", l.get("bbox", [0, 0, 0, 0]))[2])
        touches_left = abs(lx0 - block_x0) < 5.0
        touches_right = abs(lx1 - block_x1) < 18.0
        if touches_left and touches_right:
            justified_count += 1

    if len(lines) > 1 and justified_count >= (len(lines) - 1) / 2:
        return "justify"

    midpoints = [
        (l.get("line_x0", l.get("line_bbox", l.get("bbox", [0, 0, 0, 0]))[0]) +
         l.get("line_x1", l.get("line_bbox", l.get("bbox", [0, 0, 0, 0]))[2])) / 2
        for l in lines
    ]
    block_mid = (block_x0 + block_x1) / 2
    if all(abs(m - block_mid) < 5.0 for m in midpoints):
        return "center"
    elif all(abs(l.get("line_x1", l.get("line_bbox", l.get("bbox", [0, 0, 0, 0]))[2]) - block_x1) < 5.0 for l in lines):
        return "right"

    return "left"


def _merge_decision(a, b):
    """(ok, reason, details) — verbose decision logger."""
    d = {"a": a.get("paragraph_id"), "b": b.get("paragraph_id"),
         "a_kind": a.get("region_kind"), "b_kind": b.get("region_kind")}
    a_kind = a.get("region_kind")
    b_kind = b.get("region_kind")
    if a_kind != "rect" or b_kind not in ("gap", "line", "rect"):
        return False, "kind_mismatch", d
    if b_kind == "rect":
        # Defense-in-depth: allow rect+rect only when b starts inside a's vertical
        # extent (overflow assigned to outer fill by _innermost_rect after re-bake).
        # Disjoint stacked boxes (table cells) have b["bbox"][1] >= a["bbox"][3].
        if not (b["bbox"][1] < a["bbox"][3] - 1.0):
            return False, "kind_mismatch", d

    # Use TEXT extents, not block bbox (block bbox may include unioned drawings)
    a_lines = a.get("lines") or []
    b_lines = b.get("lines") or []
    a_y1 = max((l.get("line_y1", l["bbox"][3]) for l in a_lines if "line_y1" in l or "bbox" in l), default=a["bbox"][3])
    b_y0 = min((l.get("line_y0", l["bbox"][1]) for l in b_lines if "line_y0" in l or "bbox" in l), default=b["bbox"][1])
    v_gap = b_y0 - a_y1
    d["v_gap"] = round(v_gap, 2)
    min_font = min(a["font_size"], b["font_size"])
    max_gap = max(3.5, 0.6 * min_font)
    min_gap = -max(5.0, 0.5 * min_font)
    d["v_gap_bounds"] = [round(min_gap, 2), round(max_gap, 2)]
    if v_gap < min_gap or v_gap > max_gap:
        return False, "v_gap_out_of_bounds", d
    if abs(a["font_size"] - b["font_size"]) > 1.0:
        return False, "font_size", d

    def _clean_fam(fam):
        if not fam:
            return ""
        fam = re.sub(r"^[A-Z]{6}\+", "", fam).strip()
        return get_base_font_family(fam).strip().lower()

    fam_a = _clean_fam(a.get("font_family", ""))
    fam_b = _clean_fam(b.get("font_family", ""))

    if fam_a != fam_b:
        short, long = (fam_a, fam_b) if len(fam_a) <= len(fam_b) else (fam_b, fam_a)
        # prefix-tolerant: 'newbaskerville-roman' vs 'newbaskerville-roman reg'
        if not (short and long.startswith(short)):
            d.update(a_fam=a.get("font_family"), b_fam=b.get("font_family"),
                     fam_a=fam_a, fam_b=fam_b)
            return False, "font_family", d

    a_w = a.get("pdfW", a["bbox"][2] - a["bbox"][0])
    b_w = b.get("pdfW", b["bbox"][2] - b["bbox"][0])
    min_w = min(a_w, b_w)
    if min_w <= 0:
        return False, "zero_width", d

    h_ovl = min(a["bbox"][2], b["bbox"][2]) - max(a["bbox"][0], b["bbox"][0])
    d["h_ovl_ratio"] = round(h_ovl / min_w, 2)
    if d["h_ovl_ratio"] < 0.6:
        return False, "h_overlap", d

    d["left_diff"] = round(abs(a["bbox"][0] - b["bbox"][0]), 2)
    if d["left_diff"] > 4.0:
        return False, "left_edge", d

    return True, "MERGE", d


def _should_merge(a, b):
    """
    Check if overflow block `b` should be merged downward into rect-bound parent `a`.
    
    Merge rules:
    - Merge is rect -> gap/line only, downward, adjacent.
    - Same left edge, same font size/family, tight vertical gap, >=60% horizontal overlap.
    
    CRITICAL: Vertical gap MUST be calculated using ACTUAL TEXT EXTENTS (line_y0/line_y1),
    NOT the block bounding boxes (bbox). Block bboxes are often artificially inflated by 
    drawing unions (e.g., the redaction fill rect itself). Using bboxes causes `b["bbox"][1] - a["bbox"][3]` 
    to yield a false negative (overlap) when the text actually has a small positive gap.
    DO NOT refactor this to use `bbox` math.
    """
    return _merge_decision(a, b)[0]


def _merge_blocks(a, b):
    """
    Merge overflow block `b` into rect-bound parent `a`.
    """
    m = dict(a)
    bbox = [
        min(a["bbox"][0], b["bbox"][0]),
        a["bbox"][1],
        max(a["bbox"][2], b["bbox"][2]),
        b["bbox"][3]
    ]
    m["bbox"] = bbox
    m["pdfX"] = bbox[0]
    m["pdfY_top"] = bbox[1]
    m["pdfW"] = bbox[2] - bbox[0]
    m["pdfH"] = bbox[3] - bbox[1]
    m["text"] = a["text"] + "\n" + b["text"]
    m["lines"] = a["lines"] + b["lines"]
    m["line_count"] = a["line_count"] + b["line_count"]
    m["spans"] = a.get("spans", []) + b.get("spans", [])
    m["align"] = _detect_align_from_lines(m["lines"])  # re-run alignment on merged lines
    return m


def _heal_rect_splits(blocks, page_idx=None):
    """
    Heal redaction-rect block splits by merging overflow blocks downward into their 
    parent rect block. This handles cases where newly inserted text wraps below 
    the original erased bounding box.
    """
    if not blocks:
        return []

    logger.debug(f"[HEAL] page {page_idx}: {len(blocks)} blocks: " +
                 " | ".join(f"{b['paragraph_id']}({b['region_kind']}, y={b['bbox'][1]:.0f}..{b['bbox'][3]:.0f}, "
                            f"{b['font_family']}/{b['font_size']}, '{b['text'][:25]}...')" for b in blocks))
    healed = []
    for blk in blocks:
        if healed:
            ok, reason, d = _merge_decision(healed[-1], blk)
            logger.debug(f"[HEAL] {d['a']} + {d['b']} -> {reason} {d}")
            if ok:
                healed[-1] = _merge_blocks(healed[-1], blk)
                continue
        healed.append(blk)

    # Re-index paragraph_id and block_number after merging
    for idx, blk in enumerate(healed):
        blk["block_number"] = idx
        if page_idx is not None:
            blk["paragraph_id"] = f"p_{page_idx}_{idx}"

    return healed


def _rects_intersect(r1, r2, pad=2.0):
    """Return True if rect r1=[x0,y0,x1,y1] and r2 overlap (with optional pad)."""
    return (r1[0] - pad < r2[2] and r1[2] + pad > r2[0] and
            r1[1] - pad < r2[3] and r1[3] + pad > r2[1])


def _union(r1, r2):
    """Return the bounding union of two [x0,y0,x1,y1] rects."""
    return [min(r1[0], r2[0]), min(r1[1], r2[1]),
            max(r1[2], r2[2]), max(r1[3], r2[3])]


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

        # Collect images and drawings once per page — passed into
        # extract_page_spacing_data so it can union bboxes and render underlays.
        page_images = page.get_image_info(xrefs=True)
        page_drawings = page.get_drawings()

        page_blocks = extract_page_spacing_data(
            page, page_idx=page_index,
            page_images=page_images,
            page_drawings=page_drawings,
            pdf_bytes=pdf_bytes,
        )
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
            logger.debug(
                f"[TYPOGRAPHY] Page P{page_index + 1} | Paragraph #{p_idx + 1} ({blk['paragraph_id']}) | "
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
        logger.exception("extract-typography failed")
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
        logger.exception("extract-spacing failed")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to extract spacing layout"},
        )


@router.post("/extract-fonts")
async def extract_fonts(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
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
        
        extracted_vault_items = []
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
                            buffer = wrap_cff_in_otf(buffer, basefont_name=basename)
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
                    # Auto-ingested PDF fonts are SUBSETS (incomplete coverage).
                    # Mark them so they go to subsets/ and never become promotion targets.
                    is_subset = bool(subset_tag)  # subset_tag is the 6-letter prefix (e.g., "OPYJSL")
                    extracted_vault_items.append((
                        basename, basename, buffer,
                        {"stem_vw_ratio": stem_vw_ratio, "fmt": ext, "license": "document-embedded", "is_subset": is_subset}
                    ))
                    
                    fonts_out[basename] = {
                        "data": base64.b64encode(buffer).decode("ascii"),
                        "format": ext,
                        "postscript_name": postscript_name,
                        "subset_tag": subset_tag,
                        "stem_vw_ratio": stem_vw_ratio,
                    }

                    # Also register under the bare (tag-stripped) name so the canvas
                    # fontCandidates list matches across bake generations when PyMuPDF
                    # re-subsets the font under a new prefix.
                    if subset_tag and postscript_name and postscript_name not in fonts_out:
                        fonts_out[postscript_name] = fonts_out[basename]
                    logger.debug(f"Extracted font {basename} ({len(buffer)} bytes, {ext}, stem_vw_ratio: {stem_vw_ratio})")
                except Exception as e:
                    logger.warning(f"Failed to extract font {basename}: {e}")
        
        doc.close()
        if extracted_vault_items:
            background_tasks.add_task(vault_ingest_batch, extracted_vault_items)
        logger.info(f"   [FONT ENGINE] SUCCESS: Serving {len(fonts_out)} embedded PDF fonts to frontend")
        for fn in fonts_out.keys():
            logger.debug(f"      • {fn}")
        return JSONResponse(status_code=200, content=fonts_out)
    except Exception as e:
        logger.error(f"extract-fonts failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to extract fonts"},
        )
