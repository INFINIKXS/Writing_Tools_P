import fitz
import io
import re
import struct
import logging
import hashlib
from dataclasses import dataclass, field
from typing import Optional
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable
from fontTools.pens.recordingPen import RecordingPen

logger = logging.getLogger(__name__)


# ── Feature flag: skip manual cmap rebuilding ─────────────────────────────
# When True, _inject_cmap skips the cmap-table writing portion (which
# corrupts text on re-extraction in PyMuPDF 1.26.4+) but STILL performs
# the hmtx advance-width synchronization (which is essential for correct
# character spacing — without it, inserted text shows wide gaps between
# letters because the OTF wrapper's hmtx doesn't match CFF charstring widths).
#
# Confirmed clean operation on PyMuPDF 1.27.2.2.
#
# If a future PyMuPDF version regresses and characters render as .notdef
# boxes, set this to False to re-enable full cmap rebuilding.
SKIP_CMAP_INJECTION_KEEP_HMTX = True


# ── Base-14 / common font name aliases ──────────────────────────────────────
# Maps substrings found in PDF font names to PyMuPDF built-in codes.
# PyMuPDF supports these without any extra package:
#   helv  → Helvetica      tiro  → Times-Roman
#   cour  → Courier        zadb  → ZapfDingbats
_BASE14_MAP = {
    "helvetica":    "helv",
    "arial":        "helv",
    "times":        "tiro",
    "timesnewroman":"tiro",
    "timesnewromanpsmt": "tiro",
    "courier":      "cour",
    "couriernew":   "cour",
}

# pymupdf-fonts v1.0.5 verified codes — retrieved via pymupdf_fonts.myfont(code).
# NOT loadable via fitz.Font(code) without pymupdf-fonts installed.
# Keys confirmed from pymupdf_fonts.fontbuffers.keys()
_PYMUPDF_SERIF_CODE  = "ubuntu"  # Ubuntu — proportional, used as serif stand-in
_PYMUPDF_SANS_CODE   = "figo"    # FiraGO Regular — widest Unicode coverage
_PYMUPDF_MONO_CODE   = "spacemo" # Space Mono — monospaced


@dataclass
class FontResult:
    """Everything pdf_edit.py needs to insert text with the right font."""
    fontname:      str            # name to pass to page.insert_font / insert_text
    font_buffer:   Optional[bytes] = None  # raw bytes if embedded font was extracted
    fallback_used: bool = False
    fallback_reason: str = ""
    missing_glyphs: list = field(default_factory=list)  # chars not in the font

# ── Layer 1 & 2: CFF-to-OTF Integration ──────────────────────────────────────

def detect_font_format(font_bytes: bytes) -> str:
    """
    Detect the actual binary format of extracted font bytes.
    Returns: 'ttf', 'otf', 'cff', or 'unknown'
    """
    if len(font_bytes) < 4:
        return 'unknown'
    
    magic = font_bytes[:4]
    if magic == b'\x00\x01\x00\x00':
        return 'ttf'
    elif magic == b'OTTO':
        return 'otf'
    elif magic == b'true':
        return 'ttf'
    elif magic[0] == 0x01 and magic[1] == 0x00:
        return 'cff'
    elif magic == b'wOFF':
        return 'woff'
    return 'unknown'


def prepare_for_insert(buffer: bytes) -> bytes:
    """Buffer for page.insert_font/insert_text during BAKING.
    Healthy TTF/OTF passes through byte-for-byte; bare CFF is wrapped once.
    No cmap rewrite, no hmtx re-sync, no re-serialization of valid fonts."""
    fmt = detect_font_format(buffer)
    if fmt == "cff":
        wrapped = wrap_cff_in_otf(buffer)
        return wrapped if wrapped else buffer
    return buffer  # ttf/otf/woff: UNTOUCHED


def prepare_for_browser(buffer: bytes, doc, xref, page, basefont_name: str):
    """Current /extract-fonts behavior (wrap + full cmap inject). Reserved for
    the browser-serving path ONLY — never use for baking."""
    if detect_font_format(buffer) == "cff":
        wrapped = wrap_cff_in_otf(buffer, basefont_name=basefont_name)
        if not wrapped:
            return None
        buffer = wrapped
    return _inject_cmap(buffer, doc, xref, page=page,
                        basefont_name=basefont_name, skip_cmap=False)


def _synthesize_required_otf_tables(otf: TTFont, cff_reader):
    from fontTools.ttLib import newTable
    
    head = newTable('head')
    head.tableVersion    = 1.0
    head.fontRevision    = 1.0
    head.checkSumAdjustment = 0
    head.magicNumber     = 0x5F0F3CF5
    head.flags           = 0x000B
    
    units = 1000
    if hasattr(cff_reader, "topDictIndex") and len(cff_reader.topDictIndex) > 0:
        topDict = cff_reader.topDictIndex[0]
        if hasattr(topDict, "FontMatrix") and topDict.FontMatrix[0] != 0:
            units = int(round(1.0 / topDict.FontMatrix[0]))
    head.unitsPerEm      = units
    
    head.created         = head.modified = 0
    head.xMin = head.yMin = head.xMax = head.yMax = 0
    head.macStyle        = 0
    head.lowestRecPPEM   = 8
    head.fontDirectionHint = 2
    head.indexToLocFormat  = 0
    head.glyphDataFormat   = 0
    otf['head'] = head
    
    # Derive authoritative glyph order strictly from the CFF table
    glyph_order = otf.getGlyphOrder()
    
    hhea = newTable('hhea')
    hhea.tableVersion      = 0x00010000  # raw int — NOT floatToFixed, NOT fi2ve
    hhea.ascent            = 800
    hhea.descent           = -200
    hhea.lineGap           = 0
    hhea.advanceWidthMax   = 1000
    hhea.minLeftSideBearing  = 0
    hhea.minRightSideBearing = 0
    hhea.xMaxExtent        = 0
    hhea.caretSlopeRise    = 1
    hhea.caretSlopeRun     = 0
    hhea.caretOffset       = 0
    hhea.reserved0 = hhea.reserved1 = hhea.reserved2 = hhea.reserved3 = 0
    hhea.metricDataFormat  = 0
    hhea.numberOfHMetrics  = len(otf.getGlyphOrder())
    otf['hhea'] = hhea
    
    maxp = newTable('maxp')
    maxp.tableVersion = 0x00005000; maxp.numGlyphs = len(glyph_order)
    otf['maxp'] = maxp
    
    os2 = newTable('OS/2')
    os2.version = 4; os2.xAvgCharWidth = 500; os2.usWeightClass = 400; os2.usWidthClass = 5
    os2.fsType = 0; os2.ySubscriptXSize = 650; os2.ySubscriptYSize = 600
    os2.ySubscriptXOffset = 0; os2.ySubscriptYOffset = 75; os2.ySuperscriptXSize = 650
    os2.ySuperscriptYSize = 600; os2.ySuperscriptXOffset = 0; os2.ySuperscriptYOffset = 350
    os2.yStrikeoutSize = 50; os2.yStrikeoutPosition = 300; os2.sFamilyClass = 0
    
    from fontTools.ttLib.tables.O_S_2f_2 import Panose
    panose = Panose()
    panose.bFamilyType = 0; panose.bSerifStyle = 0; panose.bWeight = 0; panose.bProportion = 0
    panose.bContrast = 0; panose.bStrokeVariation = 0; panose.bArmStyle = 0; panose.bLetterForm = 0
    panose.bMidline = 0; panose.bXHeight = 0
    os2.panose = panose
    
    os2.ulUnicodeRange1 = 0; os2.ulUnicodeRange2 = 0
    os2.ulUnicodeRange3 = 0; os2.ulUnicodeRange4 = 0; os2.achVendID = "NONE"
    os2.fsSelection = 0; os2.usFirstCharIndex = 32; os2.usLastCharIndex = 65535
    os2.sTypoAscender = 1000; os2.sTypoDescender = -250; os2.sTypoLineGap = 0
    os2.usWinAscent = 1000; os2.usWinDescent = 250; os2.ulCodePageRange1 = 0
    os2.ulCodePageRange2 = 0; os2.sxHeight = 500; os2.sCapHeight = 700
    os2.usDefaultChar = 0; os2.usBreakChar = 32; os2.usMaxContext = 0
    otf['OS/2'] = os2
    
    post = newTable('post')
    post.formatType        = 3.0
    post.italicAngle       = 0
    post.underlinePosition  = -75
    post.underlineThickness = 50
    post.isFixedPitch      = 0
    post.minMemType42 = post.maxMemType42 = 0
    post.minMemType1  = post.maxMemType1  = 0
    otf['post'] = post
    
    name = newTable('name')
    name.names = []
    otf['name'] = name
    
    hmtx = newTable('hmtx')
    metrics = {}
    cff_font = list(cff_reader.values())[0] if hasattr(cff_reader, "values") else cff_reader[cff_reader.fontNames[0]]
    char_strings = cff_font.CharStrings
    private = cff_font.Private
    default_width = getattr(private, 'defaultWidthX', 500)
    nominal_width = getattr(private, 'nominalWidthX', 0)
    
    for gname in glyph_order:
        width = default_width  # fallback
        if gname in char_strings:
            cs = char_strings[gname]
            try:
                pen = RecordingPen()
                cs.draw(pen)                      # reliably populates cs.width
                w = getattr(cs, "width", None)
                width = w if isinstance(w, (int, float)) else default_width
            except Exception:
                width = default_width
        metrics[gname] = (int(width), 0)
    
    hmtx.metrics = metrics
    otf['hmtx'] = hmtx


def _ensure_browser_required_tables(tt: TTFont):
    """
    PDF-embedded font subsets (especially raw TrueType, which skips the
    CFF->OTF wrapping path entirely) often omit tables that PDF rendering
    doesn't need but browser font sanitizers require. Patch in minimal
    versions of anything missing, idempotently — safe to call on any font.
    """
    from fontTools.ttLib import newTable

    if 'post' not in tt:
        post = newTable('post')
        post.formatType = 3.0  # no glyph names stored — valid & minimal
        post.italicAngle = 0
        post.underlinePosition = -75
        post.underlineThickness = 50
        post.isFixedPitch = 0
        post.minMemType42 = post.maxMemType42 = 0
        post.minMemType1 = post.maxMemType1 = 0
        tt['post'] = post

    if 'name' not in tt:
        name = newTable('name')
        name.names = []
        tt['name'] = name

def _probe_wrapped_name(buf: bytes) -> str:
    """Name MuPDF actually derives from a wrapped buffer, subset-tag stripped."""
    try:
        n = fitz.Font(fontbuffer=buf).name or ""
    except Exception:
        return ""
    return re.sub(r"^[A-Z]{6}\+", "", n).strip()


def wrap_cff_in_otf(cff_bytes: bytes, basefont_name: str = "") -> Optional[bytes]:
    """Wrap bare CFF bytes into an OTF (SFNT) shell.

    ROOT-CAUSE HARDENING (font-name stability):
    MuPDF derives /BaseFont from the buffer's internal names and truncates to
    31 bytes; subset_fonts() then prepends a 7-byte 'ABCDEF+' tag, so any
    internal name > 24 chars is silently truncated ('NewBaskerville-Roman Regular'
    -> 'NewBaskerville-Roman Reg'), breaking family matching on re-extraction.
    Therefore: cap the canonical name at 24 chars, write ONLY bare names (no
    family+subfamily pair to compose), force CFF Top DICT names unconditionally,
    and probe the result with fitz.Font, self-correcting until name == bare.
    """
    try:
        from fontTools import cffLib, ttLib

        bare = re.sub(r"^[A-Z]{6}\+", "", (basefont_name or "")).strip() or "WrappedFont"
        # 31-byte MuPDF name buffer minus 'ABCDEF+' tag headroom
        if len(bare) > 24:
            bare = bare[:24]

        cff_reader_pristine = cffLib.CFFFontSet()
        cff_reader_pristine.decompile(io.BytesIO(cff_bytes), otFont=None, isCFF2=False)

        # ── Force CFF names UNCONDITIONALLY (no hasattr gates) ──────────
        if getattr(cff_reader_pristine, "fontNames", None):
            try:
                td = cff_reader_pristine[cff_reader_pristine.fontNames[0]]
                for attr in ("FontName", "FullName", "FamilyName"):
                    try: setattr(td, attr, bare)
                    except Exception: pass
            except Exception:
                pass
            cff_reader_pristine.fontNames = [bare]

        metrics_reader = cffLib.CFFFontSet()
        metrics_reader.decompile(io.BytesIO(cff_bytes), otFont=None, isCFF2=False)

        otf = TTFont(sfntVersion="OTTO")
        cff_table = ttLib.newTable("CFF ")
        cff_table.cff = cff_reader_pristine
        otf["CFF "] = cff_table
        _synthesize_required_otf_tables(otf, metrics_reader)

        # ── Name table: bare-only records — NO subfamily record ─────────
        nt = ttLib.newTable("name")
        nt.names = []
        for nid in (1, 3, 4, 6):
            nt.setName(bare, nid, 3, 1, 0x409)
            nt.setName(bare, nid, 1, 0, 0)
        otf["name"] = nt

        out = io.BytesIO()
        otf.save(out)
        out_bytes = out.getvalue()

        # ── Self-correcting probe loop ──────────────────────────────────
        for strategy in range(2):
            got = _probe_wrapped_name(out_bytes)
            if got == bare:
                break
            logger.warning(
                f"Wrapped OTF name probe mismatch (strategy {strategy}): "
                f"'{got}' != '{bare}' — rewriting name sources"
            )
            tt = TTFont(io.BytesIO(out_bytes))
            name = tt["name"]
            if strategy == 0:
                # delete any subfamily records MuPDF could compose with family
                name.removeNames(2)
                name.removeNames(17)
            else:
                # nuclear: rebuild name table + CFF names from scratch
                name.names = []
                for nid in (1, 3, 4, 6):
                    name.setName(bare, nid, 3, 1, 0x409)
                    name.setName(bare, nid, 1, 0, 0)
                if "CFF " in tt:
                    cff = tt["CFF "].cff
                    cff.fontNames = [bare]
                    try:
                        td = cff.topDictIndex[0]
                        for attr in ("FontName", "FullName", "FamilyName"):
                            try: setattr(td, attr, bare)
                            except Exception: pass
                    except Exception:
                        pass
            o2 = io.BytesIO()
            tt.save(o2)
            out_bytes = o2.getvalue()

        got = _probe_wrapped_name(out_bytes)
        if got == bare:
            logger.debug(f"Wrapped OTF font name sanity check ✓: '{got}'")
        else:
            logger.warning(
                f"Wrapped OTF font name sanity check ✗: '{got}' (expected '{bare}') "
                f"— heal-layer _clean_fam() remains as safety net"
            )
        return out_bytes
    except Exception as e:
        logger.warning(f"CFF wrapping failed: {e}")
        return None


def get_stem_darkening_ratio(cff_font):
    """
    Returns StdVW normalized to em-units (0-1 range), or None if the font
    doesn't define it (common in TrueType-outline fonts, or minimal subsets).
    """
    try:
        top_dict = None
        if hasattr(cff_font, "cff") and hasattr(cff_font.cff, "topDictIndex") and len(cff_font.cff.topDictIndex) > 0:
            top_dict = cff_font.cff.topDictIndex[0]
        elif hasattr(cff_font, "topDictIndex") and len(cff_font.topDictIndex) > 0:
            top_dict = cff_font.topDictIndex[0]
        elif hasattr(cff_font, "Private"):
            top_dict = cff_font
        elif hasattr(cff_font, "fontNames") and len(cff_font.fontNames) > 0:
            top_dict = cff_font[cff_font.fontNames[0]]
        elif isinstance(cff_font, (list, tuple)) and len(cff_font) > 0:
            top_dict = cff_font[0]
            
        if top_dict is None:
            return None

        private = getattr(top_dict, 'Private', None)
        if private is None and hasattr(top_dict, 'FDArray') and len(top_dict.FDArray) > 0:
            private = getattr(top_dict.FDArray[0], 'Private', None)
        if private is None:
            return None

        source = "StdVW"
        std_vw = getattr(private, 'StdVW', None)
        if std_vw is None:
            # Fallback 1: StemSnapV array (FreeType cffload.c)
            stem_snap_v = getattr(private, 'StemSnapV', None)
            if stem_snap_v and len(stem_snap_v) > 0:
                std_vw = stem_snap_v[0]
                source = "StemSnapV[0]"

        if std_vw is None:
            # Fallback 2: Inspect CFF CharStrings for median vstem hint width
            char_strings = getattr(top_dict, 'CharStrings', None)
            if char_strings and hasattr(char_strings, 'values'):
                vstem_widths = []
                for cs in list(char_strings.values())[:50]:
                    try:
                        if hasattr(cs, 'decompile'):
                            cs.decompile()
                        program = getattr(cs, 'program', None)
                        if program:
                            for i, op in enumerate(program):
                                if op in ('hstem', 'vstem', 'hstemhm', 'vstemhm') and i >= 2:
                                    w = abs(program[i-1]) if isinstance(program[i-1], (int, float)) else None
                                    if w and 10 < w < 300:
                                        vstem_widths.append(w)
                    except Exception:
                        continue
                if vstem_widths:
                    vstem_widths.sort()
                    std_vw = vstem_widths[len(vstem_widths) // 2]
                    source = "CharStrings vstem median"

        if std_vw is None:
            return None

        font_matrix = getattr(top_dict, 'FontMatrix', None)
        if font_matrix and len(font_matrix) > 0 and font_matrix[0] != 0:
            units_per_em_val = 1 / font_matrix[0]
        elif hasattr(cff_font, 'head') and hasattr(cff_font['head'], 'unitsPerEm') and cff_font['head'].unitsPerEm > 0:
            units_per_em_val = cff_font['head'].unitsPerEm
        else:
            units_per_em_val = 1000

        ratio = float(std_vw / units_per_em_val)
        logger.debug(f"[CFF STEM] Extracted std_vw={std_vw} via {source} (units_per_em={units_per_em_val}) -> ratio={ratio:.4f}")
        return ratio
    except Exception:
        return None


def extract_stem_vw_ratio(buffer: bytes, ext: str) -> Optional[float]:
    """
    Extract stem_vw_ratio (StdVW / units_per_em) from a CFF or OTF/TTF buffer.
    """
    try:
        from fontTools import cffLib, ttLib
        if ext == "cff":
            cff_set = cffLib.CFFFontSet()
            cff_set.decompile(io.BytesIO(buffer), otFont=None, isCFF2=False)
            return get_stem_darkening_ratio(cff_set)
        elif ext in ("otf", "ttf", "woff", "woff2"):
            ttf = ttLib.TTFont(io.BytesIO(buffer))
            if 'CFF ' in ttf:
                return get_stem_darkening_ratio(ttf['CFF '])
            elif 'CFF2' in ttf:
                return get_stem_darkening_ratio(ttf['CFF2'])
    except Exception as e:
        logger.debug(f"Could not extract stem_vw_ratio: {e}")
    return None

# ── Public entry point ───────────────────────────────────────────────────────


def get_font_for_edit(doc: fitz.Document, page: fitz.Page, edit: dict) -> FontResult:
    """
    Return the best FontResult for inserting edit["newStr"] into the page.

    Steps:
      1. Try to extract the embedded font whose name matches edit["fontName"].
      2. Validate the extracted bytes with fitz.Font().
      3. Check that every character in newStr has a glyph in that font.
      4. If all good: return the embedded font (no fallback).
      5. If font is unusable or glyphs are missing: fall back to the closest
         built-in / pymupdf-font and set fallback_used=True with a reason.
    """
    new_text  = edit.get("newStr", "")
    font_name = edit.get("fontName", "")
    is_bold   = edit.get("isBold", False)
    is_italic = edit.get("isItalic", False)

    # ── Step 1: Try to find and extract the matching embedded font ───────────
    extracted = _extract_matching_font(doc, page, font_name)

    if extracted is not None:
        font_bytes, matched_basefont, xref = extracted
        
        # ── Step 1.2: Layer 2 Detection & OTF Wrapping ──────────────────────
        fmt = detect_font_format(font_bytes)
        logger.debug(f"Extracted font '{matched_basefont}' (xref={xref}) detected as: {fmt}")
        
        if fmt == 'cff':
            logger.debug("Bare CFF detected. Attempting OTF wrapper injection...")
            otf_bytes = wrap_cff_in_otf(font_bytes, basefont_name=matched_basefont)
            if otf_bytes:
                font_bytes = otf_bytes
                logger.debug("CFF successfully wrapped in OTF container.")
            else:
                reason = f"Embedded CFF font '{matched_basefont}' could not be wrapped into OTF."
                logger.warning(reason)
                return _try_vault_or_fallback(font_name, is_bold, is_italic, reason)
        elif fmt == 'unknown':
            reason = f"Embedded font '{matched_basefont}' has unknown binary format."
            logger.warning(reason)
            return _try_vault_or_fallback(font_name, is_bold, is_italic, reason)

        # ── Step 1.5: NO table surgery on valid fonts ───────────────────────
        # Wrapped CFF already has authoritative hmtx (Hunk 1); healthy TTF/OTF
        # must stay byte-identical. Browser-only cmap injection lives solely in
        # /extract-fonts (prepare_for_browser), never in the bake path.
        font_bytes = prepare_for_insert(font_bytes)

        # ── Step 2: Validate — can MuPDF parse these bytes? ─────────────────
        try:
            test_font = fitz.Font(fontbuffer=font_bytes)
        except Exception as e:
            reason = (
                f"Embedded font '{matched_basefont}' could not be parsed by MuPDF "
                f"({type(e).__name__}: {e}). This is typical for CFF/Type1 subsets "
                f"and Identity-H CID composites."
            )
            logger.warning(reason)
            return _try_vault_or_fallback(font_name, is_bold, is_italic, reason)

        # ── Step 3: Check glyph coverage for the new text ───────────────────
        missing = _find_missing_glyphs(test_font, new_text, font_buffer=font_bytes)

        if missing:
            logger.info(f"Embedded font '{matched_basefont}' missing glyphs {missing}. Attempting dynamic glyph merging...")
            merged_bytes = merge_missing_glyphs(font_bytes, missing, is_bold=is_bold, is_italic=is_italic)
            if merged_bytes:
                try:
                    test_merged = fitz.Font(fontbuffer=merged_bytes)
                    still_missing = _find_missing_glyphs(test_merged, new_text, font_buffer=merged_bytes)
                    if not still_missing:
                        logger.info(f"Glyph merge successful for '{matched_basefont}'! All missing glyphs injected.")
                        return FontResult(
                            fontname=matched_basefont,
                            font_buffer=merged_bytes,
                            fallback_used=False,
                        )
                    else:
                        font_bytes = merged_font_bytes
                        missing = still_missing
                        logger.warning(f"Glyph merge partial: still missing {still_missing}")
                except Exception as e:
                    logger.warning(f"Merged font validation failed: {e}")

            reason = (
                f"Embedded font '{matched_basefont}' is missing glyphs for: "
                f"{missing!r}. Dynamic glyph merging attempted."
            )
            logger.warning(reason)
            try:
                from .font_vault import vault_full_for
                req_style = "bolditalic" if (is_bold and is_italic) else ("bold" if is_bold else ("italic" if is_italic else "regular"))
                v_hit = vault_full_for(font_name, style=req_style)
                if v_hit:
                    v_name, v_buf = v_hit
                    logger.info(f"Vault full font hit for '{font_name}': {v_name}")
                    return FontResult(
                        fontname=f"vault_{v_name}",
                        font_buffer=v_buf,
                        fallback_used=True,
                        fallback_reason=f"vault:{v_name}",
                    )
            except Exception:
                pass
            return FontResult(
                fontname=matched_basefont,
                font_buffer=font_bytes,
                fallback_used=True,
                fallback_reason=reason,
                missing_glyphs=missing,
            )

        # ── Step 3.5: Round-trip guard for paragraph chars ──────────────────
        if new_text:
            unmapped = [c for c in set(new_text) if ord(c) > 32 and not test_font.has_glyph(ord(c))]
            if unmapped:
                logger.warning(
                    f"Font round-trip guard warning for '{matched_basefont}': "
                    f"{len(unmapped)} chars have no glyph: {unmapped}"
                )

        # ── Step 4: All good — return embedded font ──────────────────────────
        logger.debug(f"Using embedded font '{matched_basefont}' for edit.")
        return FontResult(
            fontname=matched_basefont,
            font_buffer=font_bytes,
            fallback_used=False,
        )

    # ── Step 5: No extractable font found — try Base-14 match first ─────────
    base14 = _match_base14(font_name)
    if base14:
        logger.debug(f"Using Base-14 font '{base14}' matched from '{font_name}'.")
        return FontResult(fontname=base14, fallback_used=False)

    # ── Step 6: Full fallback to pymupdf-fonts ───────────────────────────────
    reason = (
        f"No embedded font matched '{font_name}' in the PDF font table, "
        f"and no Base-14 alias was found."
    )
    logger.warning(reason)
    return _try_vault_or_fallback(font_name, is_bold, is_italic, reason)


def _try_vault_or_fallback(font_name: str, is_bold: bool, is_italic: bool, reason: str) -> FontResult:
    try:
        from .font_vault import vault_full_for
        req_style = "bolditalic" if (is_bold and is_italic) else ("bold" if is_bold else ("italic" if is_italic else "regular"))
        v_hit = vault_full_for(font_name, style=req_style)
        if v_hit:
            v_name, v_buf = v_hit
            logger.info(f"Vault full font hit for '{font_name}': {v_name}")
            return FontResult(
                fontname=f"vault_{v_name}",
                font_buffer=v_buf,
                fallback_used=True,
                fallback_reason=f"vault:{v_name}",
            )
    except Exception as ex:
        logger.debug(f"vault_full_for check failed: {ex}")
    return _fallback(font_name, is_bold, is_italic, reason)


# ── Private helpers ──────────────────────────────────────────────────────────

def _extract_matching_font(
    doc: fitz.Document,
    page: fitz.Page,
    font_name: str,
) -> Optional[tuple]:
    """
    Search the page's font table for a font whose basefont name matches
    font_name (after stripping the ABCDEF+ subset prefix).

    Returns (font_bytes, matched_basefont) or None.
    """
    if not font_name:
        return None

    # Strip the 6-char uppercase subset prefix (e.g. "ABCDEF+TimesNewRoman" → "TimesNewRoman")
    target = font_name.split("+")[-1].lower().replace(" ", "").replace("-", "")

    for entry in page.get_fonts(full=True):
        # entry = (xref, ext, type, basefont, name, encoding, ...)
        xref      = entry[0]
        ext       = entry[1]   # "ttf", "cff", "cid", "n/a", etc.
        basefont  = entry[3]
        refname   = entry[4] if len(entry) > 4 else ""

        # Skip fonts with no extractable binary
        if ext == "n/a":
            continue

        candidate = basefont.split("+")[-1].lower().replace(" ", "").replace("-", "")
        refname_candidate = refname.lower().replace(" ", "").replace("-", "")

        # Require at least a partial match on basefont OR an exact match on refname
        if not (target in candidate or candidate in target or target == refname_candidate):
            continue

        try:
            font_data = doc.extract_font(xref)
            # extract_font returns (name, ext, type, [subbuffer], buffer)
            # The raw bytes are always the LAST element
            font_bytes = font_data[-1]
            if not font_bytes or len(font_bytes) < 64:
                continue
            return (font_bytes, basefont, xref)
        except Exception as e:
            logger.debug(f"extract_font({xref}) failed: {e}")
            continue

    return None


# ── Authoritative Coverage, In-Document Scavenging & Font Vault ────────────

def cmap_set(buffer: bytes):
    try:
        import io
        from fontTools.ttLib import TTFont
        tt = TTFont(io.BytesIO(buffer))
        cm = tt.getBestCmap() or {}
        tt.close()
        return set(cm.keys())
    except Exception:
        return None


_INK_CACHE = {}
def _glyph_has_ink(font_buffer: bytes, ch: str, fontsize: int = 20) -> bool:
    key = (hashlib.sha256(font_buffer).hexdigest()[:12], ch)
    if key in _INK_CACHE:
        return _INK_CACHE[key]
    try:
        d = fitz.open(); p = d.new_page(width=40, height=40)
        p.insert_font(fontname="p", fontbuffer=font_buffer)
        p.insert_text(fitz.Point(5, 28), ch, fontname="p", fontsize=fontsize)
        res = sum(1 for v in p.get_pixmap(colors=fitz.csGRAY).samples if v < 250) > 0
        d.close()
    except Exception:
        res = True
    _INK_CACHE[key] = res
    return res


def _find_missing_glyphs(font_obj, text, font_buffer=None):
    """Authoritative subset coverage.
    Subset CMAPs frequently map missing chars to '.notdef' (gid 0) while still 
    listing the codepoint. We MUST use the render-probe (_glyph_has_ink) as the 
    ultimate source of truth to avoid false negatives."""
    chars = [ch for ch in dict.fromkeys(text) if not ch.isspace()]
    if not chars:
        return set()
    
    missing = set()
    if font_buffer:
        for ch in chars:
            # The render-probe is the only 100% reliable check for subsets
            if not _glyph_has_ink(font_buffer, ch):
                missing.add(ch)
    else:
        # Fallback if no buffer provided (should not happen in our pipeline)
        cmap = cmap_set(font_buffer)
        for ch in chars:
            if cmap is None or ord(ch) not in cmap:
                missing.add(ch)
                
    if missing:
        import logging
        logging.getLogger(__name__).warning(f"GLYPH-DETECTOR: subset font lacks ink for {sorted(missing)}")
        
    return missing


_SUBSET_RE = re.compile(r"^[A-Z]{6}\+")
_STYLE_RE  = re.compile(r"[-_\s](Bold|Italic|Oblique|Regular|Roman|Light|Medium|Thin|Black|Heavy|Bd|It|Cn|CnO|Cond(?:ensed)?|Ext(?:ended)?|Narrow)$", re.I)
_PREFIX_RE = re.compile(r"^(emb_|F\d+_|g_d\d+_|font_|pdf_|mp_)", re.I)


def canonical_family(name: str) -> str:
    n = name or ""
    n = _PREFIX_RE.sub("", n)                 # emb_, F1_, g_d0_ ...
    n = re.sub(r"^[A-Z]{6}\+", "", n)         # OPYJSL+
    n = _STYLE_RE.sub("", n)                  # -Roman/-Bold/...
    n = re.sub(r"[-_\s]+", "", n)             # "Libre Baskerville" == "libre-baskerville"
    return n.lower().strip()


def family_match(a: str, b: str) -> bool:
    """Truncation-tolerant: 'newbaskervill' vs 'newbaskerville-roman'."""
    if not a or not b:
        return False
    return a == b or a.startswith(b) or b.startswith(a)


def root_family(name: str) -> str:
    return canonical_family(name)


def build_doc_glyph_index(doc) -> dict:
    """root_family -> [(basename, buffer, cmap_set|None)]; built ONLY when missing chars exist."""
    idx, seen = {}, set()
    for page in doc:
        for info in page.get_fonts(full=True):
            xref = info[0]
            if xref in seen:
                continue
            seen.add(xref)
            try:
                _, _, _, buf = doc.extract_font(xref)
            except Exception:
                continue
            if buf:
                idx.setdefault(root_family(info[3]), []).append((info[3], buf, cmap_set(buf)))
    return idx


def cover_for(index, family, ch):
    cp = ord(ch)
    for basename, buf, cm in index.get(family, []):
        if cm and cp in cm:
            return basename, buf
    return None


from pathlib import Path
import json

VAULT_DIR = Path(__file__).resolve().parent.parent / "font_vault"


def vault_ingest(family, basename, buffer, *, stem_vw_ratio=None, fmt="otf", license="document-embedded", full=False, stand_in_for=None, style=None, is_subset=False):
    from .font_vault import vault_ingest as _vi
    return _vi(family, basename, buffer, stem_vw_ratio=stem_vw_ratio, fmt=fmt, license=license, full=full, stand_in_for=stand_in_for, style=style, is_subset=is_subset)


def vault_cover_for(family, ch):
    try:
        mf_path = VAULT_DIR / "manifest.json"
        if not mf_path.exists():
            return None
        e = json.loads(mf_path.read_text()).get(family)
        if not e or ord(ch) not in set(e["coverage"]):
            return None
        if e.get("full_font") and (VAULT_DIR / e["full_font"]).exists():
            buf = (VAULT_DIR / e["full_font"]).read_bytes()
            cm = cmap_set(buf)
            if cm and ord(ch) in cm:
                return (f"{family}-FULL", buf)
        for src in e["sources"]:
            for ext in ("otf", "ttf"):
                p = VAULT_DIR / "buffers" / f"{src}.{ext}"
                if p.exists():
                    buf = p.read_bytes()
                    cm = cmap_set(buf)
                    if cm and ord(ch) in cm:
                        return (src, buf)
    except Exception:
        return None
    return None


def _match_base14(font_name: str) -> Optional[str]:
    """
    Try to match font_name to a PyMuPDF Base-14 code without extracting bytes.
    Returns the code string (e.g. "tiro") or None.
    """
    normalised = font_name.split("+")[-1].lower().replace(" ", "").replace("-", "")
    for key, code in _BASE14_MAP.items():
        if key in normalised or normalised in key:
            return code
    return None


def _fallback(
    original_font_name: str,
    is_bold: bool,
    is_italic: bool,
    reason: str,
) -> FontResult:
    """
    Choose the best pymupdf_fonts fallback based on visual characteristics.
    Uses pymupdf_fonts.myfont(code) -> bytes (v1.0.5 API).
    Falls back to Base-14 helv/tiro/cour if pymupdf_fonts is not installed.
    """
    name_lower = original_font_name.lower()

    is_mono  = any(k in name_lower for k in ("courier", "mono", "consolas", "inconsolata", "code", "cascadia"))
    is_serif = any(k in name_lower for k in (
        "times", "roman", "georgia", "garamond", "palatino",
        "minion", "cambria", "charter", "bookman", "caslon",
        "fruti", "nimbus", "utopia", "baskerville"
    ))

    # Build ordered candidate list using verified pymupdf_fonts v1.0.5 codes
    if is_mono:
        if is_bold and is_italic:
            candidates = ["cascadiabi", "spacembi", "spacemo"]
            description = "Cascadia / Space Mono Bold-Italic"
        elif is_bold:
            candidates = ["cascadiab", "spacembo", "spacemo"]
            description = "Cascadia / Space Mono Bold"
        elif is_italic:
            candidates = ["cascadiai", "spacemit", "spacemo"]
            description = "Cascadia / Space Mono Italic"
        else:
            candidates = ["cascadia", "spacemo"]
            description = "Cascadia / Space Mono (monospaced fallback)"
    elif is_serif:
        if is_bold and is_italic:
            candidates = ["ubuntubi", "figbi", "notosbi", "figo"]
            description = "Ubuntu Bold-Italic (serif-like fallback)"
        elif is_bold:
            candidates = ["ubuntubo", "figbo", "notosbo", "figo"]
            description = "Ubuntu Bold (serif-like fallback)"
        elif is_italic:
            candidates = ["ubuntuit", "figit", "notosit", "figo"]
            description = "Ubuntu Italic (serif-like fallback)"
        else:
            candidates = ["ubuntu", "figo", "notos"]
            description = "Ubuntu (serif-like proportional fallback)"
    else:
        if is_bold and is_italic:
            candidates = ["figbi", "notosbi", "ubuntubi", "figo"]
            description = "FiraGO Bold-Italic (sans-serif fallback)"
        elif is_bold:
            candidates = ["figbo", "notosbo", "ubuntubo", "figo"]
            description = "FiraGO Bold (sans-serif fallback)"
        elif is_italic:
            candidates = ["figit", "notosit", "ubuntuit", "figo"]
            description = "FiraGO Italic (sans-serif fallback)"
        else:
            candidates = ["figo", "notos", "ubuntu"]
            description = "FiraGO (universal sans-serif fallback)"

    chosen_code = None
    font_buf = None

    # Try pymupdf_fonts first
    try:
        import pymupdf_fonts
        for code in candidates:
            try:
                buf = pymupdf_fonts.myfont(code)
                if buf:
                    chosen_code = code
                    font_buf = buf
                    logger.info(
                        f"Fallback font resolved: pymupdf_fonts '{code}' ({len(buf):,} bytes)"
                    )
                    break
            except Exception:
                pass
    except ImportError:
        logger.debug("pymupdf_fonts not installed; using Base-14 fallback")
    except Exception as e:
        logger.debug(f"pymupdf_fonts lookup failed: {e}")

    # Base-14 last resort
    if not chosen_code:
        if is_mono:
            try:
                f = fitz.Font("cour")
                chosen_code, font_buf = "cour", f.buffer
                description += " → Base-14 Courier"
            except Exception:
                chosen_code = "cour"
        elif is_serif:
            try:
                f = fitz.Font("tiro")
                chosen_code, font_buf = "tiro", f.buffer
                description += " → Base-14 Times"
            except Exception:
                chosen_code = "tiro"
        else:
            try:
                f = fitz.Font("helv")
                chosen_code, font_buf = "helv", f.buffer
                description += " → Base-14 Helvetica"
            except Exception:
                chosen_code = "helv"

    full_reason = f"{reason} Falling back to: {description}."

    return FontResult(
        fontname=chosen_code,
        font_buffer=font_buf,
        fallback_used=True,
        fallback_reason=full_reason,
        missing_glyphs=[],
    )


def _decode_unicode_hex(hex_str: str) -> str:
    hex_str = hex_str.strip()
    result = ""
    if len(hex_str) % 4 != 0:
        hex_str = hex_str.zfill((len(hex_str) // 4 + 1) * 4)
    for i in range(0, len(hex_str), 4):
        cp = int(hex_str[i:i+4], 16)
        result += chr(cp)
    return result

def _parse_tounicode(doc: fitz.Document, font_xref: int) -> tuple[dict, dict]:
    single_map, multi_map = {}, {}
    try:
        tu_ref = doc.xref_get_key(font_xref, "ToUnicode")
        if not tu_ref or tu_ref[0] == "null":
            return single_map, multi_map
        m = re.match(r"(\d+)\s+\d+\s+R", tu_ref[1].strip())
        if not m:
            return single_map, multi_map
        tu_xref = int(m.group(1))
        raw = doc.xref_stream(tu_xref)
        if not raw:
            return single_map, multi_map
        text = raw.decode("latin-1", errors="replace")
        
        for m in re.finditer(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", text):
            try:
                cid = int(m.group(1), 16)
                chars = _decode_unicode_hex(m.group(2))
                if len(chars) == 1:
                    single_map[cid] = chars
                else:
                    multi_map[cid] = chars
            except Exception:
                pass
                
        for m in re.finditer(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", text):
            try:
                start = int(m.group(1), 16)
                end = int(m.group(2), 16)
                # Guard: skip absurdly large ranges (Identity-H full-Unicode mappings).
                # A legitimate bfrange for a subset font is at most 256 entries.
                # Ranges like 0x0000-0x10FFEE produce 1.1M entries and overwhelm the map.
                if end - start > 256:
                    continue
                base_chars = _decode_unicode_hex(m.group(3))
                for offset in range(end - start + 1):
                    cid = start + offset
                    if len(base_chars) == 1:
                        single_map[cid] = chr(ord(base_chars) + offset)
                    else:
                        multi_map[cid] = base_chars
            except Exception:
                pass
                
        for m in re.finditer(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[\s*(.*?)\s*\]", text):
            try:
                start = int(m.group(1), 16)
                end = int(m.group(2), 16)
                arr_content = m.group(3)
                arr_matches = re.findall(r"<([0-9A-Fa-f]+)>", arr_content)
                for offset, hex_str in enumerate(arr_matches):
                    if start + offset <= end:
                        cid = start + offset
                        chars = _decode_unicode_hex(hex_str)
                        if len(chars) == 1:
                            single_map[cid] = chars
                        else:
                            multi_map[cid] = chars
            except Exception as e:
                pass
    except Exception as e:
        logger.debug(f"ToUnicode parse failed: {e}")
        
    return single_map, multi_map

def _extract_cidtogidmap(doc: fitz.Document, font_xref: int) -> Optional[dict]:
    try:
        desc_ref = doc.xref_get_key(font_xref, "DescendantFonts")
        if not desc_ref or desc_ref[0] == "null":
            return None
            
        inner = re.findall(r"(\d+)\s+\d+\s+R", desc_ref[1].strip())
        if not inner:
            return None
            
        cid_font_xref = int(inner[0])
        cgmap_ref = doc.xref_get_key(cid_font_xref, "CIDToGIDMap")
        
        if not cgmap_ref or cgmap_ref[0] == "null":
            return None
            
        val = cgmap_ref[1].strip()
        if val.lower() == "/identity" or val == "Identity":
            return None
            
        m = re.match(r"(\d+)\s+\d+\s+R", val)
        if not m:
            return None
            
        map_xref = int(m.group(1))
        raw = doc.xref_stream(map_xref)
        if not raw:
            return None
            
        n = len(raw) // 2
        gids = struct.unpack(f">{n}H", raw[:n*2])
        result = {}
        for cid, gid in enumerate(gids):
            if gid != 0:
                result[cid] = gid
        return result
    except Exception as e:
        logger.debug(f"CIDToGIDMap extraction failed: {e}")
        return None

def _inject_cmap(font_bytes: bytes, doc: fitz.Document, xref: int, page: Optional[fitz.Page] = None,
                  basefont_name: str = "", skip_cmap: bool = SKIP_CMAP_INJECTION_KEEP_HMTX) -> Optional[bytes]:
    """
    Subverts PyMuPDF's failure to natively render Identity-H subsets by wrapping the
    raw extracted font block in fontTools, parsing the PDF's /ToUnicode byte stream,
    querying the actual CIDToGIDMap layout, patching zero-width advances,
    and explicitly injecting a WinAnsi cmap subtable into the header.
    """
    # ── Surgical handling: hmtx-only path ────────────────────────────────
    # See SKIP_CMAP_INJECTION_KEEP_HMTX flag at top of file for context.
    # When True, we skip the cmap-table writing (which corrupts re-extract)
    # but still run the hmtx advance-width sync (essential for correct
    # character spacing in inserted text).
    if skip_cmap:
        try:
            logger.info(
                f"==== HMTX-ONLY PATH for '{basefont_name}' "
                f"(SKIP_CMAP_INJECTION_KEEP_HMTX=True) ===="
            )
            tt = TTFont(io.BytesIO(font_bytes))

            # Apply ONLY the hmtx sync logic from the full path.
            # CFF-flavoured OTF fonts store widths in TWO places: the
            # hmtx table and the CFF charstrings. After OTF wrapping
            # these can diverge (FontMatrix scale factor). PDF renderers
            # use CFF charstring widths, but MuPDF's insert_text uses
            # hmtx. Without sync, inserted text has wrong character
            # spacing — gaps between letters.
            if "CFF " in tt and "hmtx" in tt:
                hmtx = tt["hmtx"].metrics
                try:
                    cff_top = tt["CFF "].cff.topDictIndex[0]
                    char_strings = cff_top.CharStrings
                    font_matrix = getattr(
                        cff_top, "FontMatrix",
                        [0.001, 0, 0, 0.001, 0, 0],
                    )
                    scale_x = font_matrix[0] * 1000

                    fixed_count = 0
                    for gname in list(char_strings.keys()):
                        if gname not in hmtx:
                            continue
                        try:
                            cs = char_strings[gname]
                            pen = RecordingPen()
                            cs.draw(pen)
                            cff_width = cs.width
                            hmtx_width, lsb = hmtx[gname]

                            if abs(scale_x - 1.0) > 0.001:
                                scaled_width = round(cff_width * scale_x)
                            else:
                                scaled_width = cff_width

                            if hmtx_width != scaled_width and scaled_width > 0:
                                hmtx[gname] = (scaled_width, lsb)
                                fixed_count += 1
                        except Exception:
                            pass

                    if fixed_count > 0:
                        logger.info(
                            f"CFF hmtx sync: fixed {fixed_count} "
                            f"advance widths (FontMatrix scale={scale_x:.3f})"
                        )
                    else:
                        logger.info(
                            "CFF hmtx sync: all widths already consistent"
                        )
                except Exception as e:
                    logger.warning(
                        f"CFF hmtx sync failed (non-fatal): {e}"
                    )
            elif "hmtx" in tt and "glyf" in tt:
                # TTF fallback: patch zero-width glyphs with average advance
                hmtx = tt["hmtx"].metrics
                glyf = tt["glyf"]
                valid_advances = [
                    adv for gn, (adv, _) in hmtx.items()
                    if adv > 0 and gn != ".notdef"
                ]
                avg_advance = (
                    sum(valid_advances) // len(valid_advances)
                    if valid_advances else 500
                )
                fixed_count = 0
                for gname in tt.getGlyphOrder():
                    if gname not in hmtx:
                        continue
                    advance, lsb = hmtx[gname]
                    if advance == 0:
                        try:
                            g = glyf[gname]
                            has_outline = (
                                hasattr(g, "numberOfContours")
                                and g.numberOfContours > 0
                            )
                            if has_outline:
                                hmtx[gname] = (avg_advance, lsb)
                                fixed_count += 1
                        except Exception:
                            pass
                if fixed_count > 0:
                    logger.info(
                        f"TTF hmtx patched {fixed_count} zero-width glyphs"
                    )

            # Serialize and return — NO cmap manipulation
            _ensure_browser_required_tables(tt)
            out = io.BytesIO()
            tt.save(out)
            logger.debug(f"==== HMTX-ONLY PATH SUCCESS ====")
            return out.getvalue()
        except Exception as e:
            logger.warning(
                f"HMTX-only path failed: {e}. Returning original font_bytes."
            )
            return font_bytes
    # ───────────────────────────────────────────────────────────────────────

    try:
        logger.debug(f"==== INJECT_CMAP START: {basefont_name} (page {page.number if page else 'none'}) ====")
        single_map, multi_map = _parse_tounicode(doc, xref)
        logger.debug(f"Parse ToUnicode: single_map={len(single_map)}, multi_map={len(multi_map)}")
        
        cidtogid_map = _extract_cidtogidmap(doc, xref)
        logger.debug(f"Extracted CIDToGIDMap: {'YES (' + str(len(cidtogid_map)) + ')' if cidtogid_map else 'NO'}")
        
        tt = TTFont(io.BytesIO(font_bytes))
        glyph_order = tt.getGlyphOrder()
        n_glyphs = len(glyph_order)
        logger.debug(f"TTFont loaded. n_glyphs={n_glyphs}")
        
        cid_to_gid = cidtogid_map if cidtogid_map else {}

        # Build lookup from font's own existing cmap before we replace it.
        # This provides a reliable GID mapping for fonts where neither the
        # CIDToGIDMap nor trace recovery cover all codepoints.
        # Note: bare CFF fonts wrapped in OTF containers may not have a cmap
        # table yet — that's the whole reason _inject_cmap() exists.
        font_cmap_gids = {}
        existing_cmap = None
        if 'cmap' in tt:
            try:
                existing_cmap = tt.getBestCmap()
            except Exception as e:
                logger.debug(f"getBestCmap() failed: {e}")
        if existing_cmap:
            glyph_name_to_idx = {name: i for i, name in enumerate(glyph_order)}
            for cp, gname in existing_cmap.items():
                if gname in glyph_name_to_idx:
                    font_cmap_gids[cp] = glyph_name_to_idx[gname]
            logger.debug(f"Built font_cmap_gids with {len(font_cmap_gids)} entries from existing cmap")
        else:
            logger.debug("No existing cmap in font — font_cmap_gids is empty")
        
        # BUG 3 FIX: Initialize unicode_to_gid BEFORE the try block so it
        # always exists, regardless of whether trace recovery succeeds.
        unicode_to_gid = {}
        trace_has_data = False
        
        pages_to_scan = doc if doc is not None else ([page] if page else [])
        if pages_to_scan and basefont_name:
            logger.debug(f"Attempting Trace CID Recovery for: {basefont_name} (scanning {len(pages_to_scan)} pages)")
            try:
                _warned_conflicts = set()
                target_short = basefont_name.split("+")[-1].lower().replace(" ", "").replace("-", "")
                for pg in pages_to_scan:
                    for span in pg.get_texttrace():
                        span_font = span.get("font", "").split("+")[-1].lower().replace(" ", "").replace("-", "")
                        if target_short == span_font:
                            chars_list = span.get("chars", [])
                            for idx, ch in enumerate(chars_list):
                                if len(ch) == 4:
                                    ucp, gid, _, _ = ch
                                    if ucp > 0 and gid > 0 and ucp != 0xFFFD:
                                        # Skip ligature first-components: if the NEXT char
                                        # has gid == -1, that means THIS char is the first
                                        # component of a ligature (e.g. 'f' in 'fi').
                                        # The gid we'd record is the ligature glyph's GID,
                                        # which has a double-width advance — wrong for
                                        # standalone 'f'. Skip it.
                                        if idx + 1 < len(chars_list):
                                            next_ch = chars_list[idx + 1]
                                            if len(next_ch) == 4 and next_ch[1] == -1:
                                                continue  # skip ligature first-component
                                        if ucp in unicode_to_gid and unicode_to_gid[ucp] != gid:
                                            key = (ucp, unicode_to_gid[ucp], gid)
                                            if key not in _warned_conflicts:
                                                _warned_conflicts.add(key)
                                                logger.warning(f"Conflicting GID for U+{ucp:04X} across pages: {unicode_to_gid[ucp]} vs {gid} — keeping first seen")
                                            continue
                                        unicode_to_gid[ucp] = gid
                                    
                trace_has_data = len(unicode_to_gid) > 0
                logger.debug(f"Trace extracted {len(unicode_to_gid)} unique (UCP -> GID) pairs.")
                changed_cids = 0
                for cid, uchar in single_map.items():
                    ucp = ord(uchar)
                    if ucp in unicode_to_gid:
                        gid = unicode_to_gid[ucp]
                        if cid != gid:
                            cid_to_gid[cid] = gid
                            changed_cids += 1
                logger.debug(f"Adjusted {changed_cids} mismatched CID->GID mappings.")
            except Exception as e:
                logger.warning(f"Trace recovery failed entirely: {e}")
                
        unicode_to_glyph = {}
        
        # 1. Map single chars
        for cid, uchar in single_map.items():
            ucp = ord(uchar)
            # Priority chain for CID→GID resolution:
            #   1. Explicit CIDToGIDMap from the PDF (most authoritative)
            #   2. Trace recovery data (direct UCP→GID from MuPDF rendering)
            #   3. Font's own existing cmap table (built above before overwrite)
            #   4. Identity fallback (cid == gid) — true last resort
            # The old code used unconditional identity fallback which is only
            # correct for Identity-H fonts and causes wrong glyph widths
            # (and therefore character scatter) for all other CIDFonts.
            if cid in cid_to_gid:
                gid = cid_to_gid[cid]
            elif ucp in unicode_to_gid:
                gid = unicode_to_gid[ucp]
            elif ucp in font_cmap_gids:
                gid = font_cmap_gids[ucp]
            else:
                # No reliable source (explicit CIDToGIDMap, trace recovery, or the
                # font's own existing cmap) covers this character. Glyph index has no
                # guaranteed relationship to character code in a subsetted font, so
                # guessing gid = cid risks a WRONG-BUT-VALID glyph (e.g. '%' silently
                # rendering as 'J') rather than a visibly-missing one. Leave unmapped —
                # better to show a visible .notdef box than a confident wrong letter.
                logger.debug(f"No reliable GID for U+{ucp:04X} ({uchar!r}) — leaving unmapped rather than guessing.")
                continue
            if 0 < gid < n_glyphs:
                unicode_to_glyph[ucp] = glyph_order[gid]
                
        # 1.5. Supplement with direct trace recoveries
        # BUG 3 FIX: unicode_to_gid is always defined now — no fragile locals() check
        for ucp, gid in unicode_to_gid.items():
            if 0 < gid < n_glyphs:
                unicode_to_glyph[ucp] = glyph_order[gid]
                
        # 2. Map multi-char ligatures
        LIGATURE_UNICODE_MAP = {
            0xFB00: "ff", 0xFB01: "fi", 0xFB02: "fl",
            0xFB03: "ffi", 0xFB04: "ffl", 0xFB05: "st", 0xFB06: "st"
        }
        for cid, lig_str in multi_map.items():
            gid = cid_to_gid.get(cid, cid)
            if 0 < gid < n_glyphs:
                gname = glyph_order[gid]
                # Map the ligature's OWN Unicode codepoint (e.g. U+FB01 for fi)
                lig_key = lig_str
                for lig_ucp, lig_chars in LIGATURE_UNICODE_MAP.items():
                    if lig_chars == lig_key:
                        unicode_to_glyph[lig_ucp] = gname
                        break
                # BUG 1 FIX: Do NOT map individual component characters
                # (e.g. 'f', 'i') to the ligature glyph. The ligature glyph
                # has a 2-char advance width, so mapping 'f' to it causes
                # the cursor to jump too far, displacing subsequent chars.
                # If 'f' isn't in the ToUnicode single_map, it stays unmapped
                # and MuPDF will use .notdef or fallback — which is correct.

        # ── Force-map standard ASCII range (U+0020 to U+007E) if missing ──────
        _AGL_NAMES = {
            0x20: "space", 0x21: "exclam", 0x22: "quotedbl", 0x23: "numbersign",
            0x24: "dollar", 0x25: "percent", 0x26: "ampersand", 0x27: "quotesingle",
            0x28: "parenleft", 0x29: "parenright", 0x2A: "asterisk", 0x2B: "plus",
            0x2C: "comma", 0x2D: "hyphen", 0x2E: "period", 0x2F: "slash",
            0x3A: "colon", 0x3B: "semicolon", 0x3C: "less", 0x3D: "equal",
            0x3E: "greater", 0x3F: "question", 0x40: "at",
            0x5B: "bracketleft", 0x5C: "backslash", 0x5D: "bracketright",
            0x5E: "asciicircum", 0x5F: "underscore", 0x60: "grave",
            0x7B: "braceleft", 0x7C: "bar", 0x7D: "braceright", 0x7E: "asciitilde"
        }

        glyph_name_to_gid = {gname: gid for gid, gname in enumerate(glyph_order)}
        force_mapped_count = 0
        for ucp in range(0x0020, 0x007F):
            if ucp not in unicode_to_glyph:
                gname = None
                ch = chr(ucp)
                agl_name = _AGL_NAMES.get(ucp)
                uni_hex_upper = f"uni{ucp:04X}"
                uni_hex_lower = f"uni{ucp:04x}"

                if ch in glyph_name_to_gid:
                    gname = ch
                elif agl_name and agl_name in glyph_name_to_gid:
                    gname = agl_name
                elif uni_hex_upper in glyph_name_to_gid:
                    gname = uni_hex_upper
                elif uni_hex_lower in glyph_name_to_gid:
                    gname = uni_hex_lower
                elif ucp in font_cmap_gids and 0 < font_cmap_gids[ucp] < n_glyphs:
                    gname = glyph_order[font_cmap_gids[ucp]]
                elif ucp in unicode_to_gid and 0 < unicode_to_gid[ucp] < n_glyphs:
                    gname = glyph_order[unicode_to_gid[ucp]]

                if gname:
                    unicode_to_glyph[ucp] = gname
                    force_mapped_count += 1

        if force_mapped_count > 0:
            logger.info(f"Force-mapped {force_mapped_count} unmapped standard ASCII characters (U+0020 to U+007E)")

        if not unicode_to_glyph:
            logger.warning("unicode_to_glyph is EMPTY! Returning original font_bytes.")
            return font_bytes

        # BUG 4 FIX: Diagnostic logging for commonly-broken codepoints
        logger.debug(f"Generated unicode_to_glyph with {len(unicode_to_glyph)} entries")
        _SUSPECT_CHARS = {
            'f': 0x66, 'l': 0x6C, 'k': 0x6B, 'i': 0x69, ' ': 0x20,
            '9': 0x39, '%': 0x25
        }
        for label, ucp in _SUSPECT_CHARS.items():
            if ucp in unicode_to_glyph:
                logger.debug(f"  DIAG: U+{ucp:04X} '{label}' → glyph '{unicode_to_glyph[ucp]}'")
            else:
                logger.debug(f"  DIAG: U+{ucp:04X} '{label}' → NOT MAPPED")
            
        # 3. Sync hmtx advance widths to CFF charstring widths.
        # CFF-flavoured OTF fonts store widths in TWO places: the hmtx table
        # and the CFF charstrings. After OTF wrapping, these can diverge
        # (typically by the FontMatrix scale factor). PDF renderers use CFF
        # charstring widths, but MuPDF's insert_text uses hmtx. The fix:
        # draw each charstring, read its decoded .width, and overwrite hmtx.
        if "CFF " in tt and "hmtx" in tt:
            hmtx = tt["hmtx"].metrics
            try:
                cff_top = tt["CFF "].cff.topDictIndex[0]
                char_strings = cff_top.CharStrings
                # Check FontMatrix for non-standard scaling
                font_matrix = getattr(cff_top, 'FontMatrix', [0.001, 0, 0, 0.001, 0, 0])
                scale_x = font_matrix[0] * 1000  # Convert to UPM-relative

                fixed_count = 0
                for gname in list(char_strings.keys()):
                    if gname not in hmtx:
                        continue
                    try:
                        cs = char_strings[gname]
                        pen = RecordingPen()
                        cs.draw(pen)  # populates cs.width from charstring
                        cff_width = cs.width
                        hmtx_width, lsb = hmtx[gname]

                        # Apply FontMatrix scaling if non-standard
                        if abs(scale_x - 1.0) > 0.001:
                            scaled_width = round(cff_width * scale_x)
                        else:
                            scaled_width = cff_width

                        if hmtx_width != scaled_width and scaled_width > 0:
                            hmtx[gname] = (scaled_width, lsb)
                            fixed_count += 1
                    except Exception:
                        pass

                if fixed_count > 0:
                    logger.debug(f"CFF hmtx sync: fixed {fixed_count} advance widths (FontMatrix scale={scale_x:.3f})")
                else:
                    logger.debug("CFF hmtx sync: all widths already consistent")
            except Exception as e:
                logger.warning(f"CFF hmtx sync failed (non-fatal): {e}")

        elif "hmtx" in tt and "glyf" in tt:
            # TTF fallback: patch zero-width glyphs with average advance
            hmtx = tt["hmtx"].metrics
            glyf = tt["glyf"]
            valid_advances = [adv for gn, (adv, _) in hmtx.items() if adv > 0 and gn != ".notdef"]
            avg_advance = sum(valid_advances) // len(valid_advances) if valid_advances else 500

            for gname in glyph_order:
                if gname not in hmtx: continue
                advance, lsb = hmtx[gname]
                if advance == 0:
                    try:
                        g = glyf[gname]
                        has_outline = hasattr(g, "numberOfContours") and g.numberOfContours > 0
                        if has_outline:
                            hmtx[gname] = (avg_advance, lsb)
                    except Exception:
                        pass
        
        cmap_table = tt.get('cmap')
        if not cmap_table:
            from fontTools.ttLib import newTable
            tt['cmap'] = newTable('cmap')
            tt['cmap'].tableVersion = 0
            tt['cmap'].tables = []
            
        new_subtable = CmapSubtable.newSubtable(4)
        new_subtable.platformID = 3
        new_subtable.platEncID = 1
        new_subtable.language = 0
        new_subtable.cmap = unicode_to_glyph
        
        cmap_table = tt['cmap']
        cmap_table.tables = [t for t in cmap_table.tables if not (t.platformID == 3 and t.platEncID == 1)]
        cmap_table.tables.append(new_subtable)
        
        _ensure_browser_required_tables(tt)
        out = io.BytesIO()
        tt.save(out)
        out_bytes = out.getvalue()

        # Post-serialization validation: ensure fontTools created a valid cmap table
        try:
            verify_tt = TTFont(io.BytesIO(out_bytes))
            if 'cmap' not in verify_tt or not verify_tt.getBestCmap():
                logger.error(f"Refusing to serve '{basefont_name}' — no valid cmap table produced!")
                return None
            logger.debug(f"Post-serialization cmap validated: {len(verify_tt.getBestCmap())} entries")
        except Exception as e:
            logger.error(f"Refusing to serve '{basefont_name}' — font validation error: {e}")
            return None

        logger.debug(f"==== INJECT_CMAP SUCCESS. Injected ToUnicode CMap matrix + hmtx patch into {len(unicode_to_glyph)} subsets. ====")
        return out_bytes
        
    except Exception as e:
        logger.error(f"==== INJECT_CMAP FAILED: {e} ====", exc_info=True)
        return None


def merge_missing_glyphs(
    target_font_bytes: bytes,
    missing_chars: list[str],
    is_bold: bool = False,
    is_italic: bool = False,
) -> Optional[bytes]:
    """
    Dynamically extract missing glyphs from a fallback font (e.g. Noto Sans /
    Nimbus Roman / Helvetica) and merge them into target_font_bytes using fontTools.
    """
    if not missing_chars or not target_font_bytes:
        return None

    try:
        source_code = _PYMUPDF_SERIF_CODE if (is_bold or is_italic) else _PYMUPDF_SANS_CODE
        try:
            source_font = fitz.Font(source_code)
            source_buf = source_font.buffer
        except Exception:
            source_font = fitz.Font("helv")
            source_buf = source_font.buffer

        if not source_buf:
            return None

        target_tt = TTFont(io.BytesIO(target_font_bytes))
        source_tt = TTFont(io.BytesIO(source_buf))

        source_cmap = source_tt.getBestCmap() if 'cmap' in source_tt else {}
        if not source_cmap:
            return None

        cmap_table = target_tt.get('cmap')
        if not cmap_table:
            from fontTools.ttLib import newTable
            cmap_table = newTable('cmap')
            cmap_table.tableVersion = 0
            cmap_table.tables = []
            target_tt['cmap'] = cmap_table

        subtable = None
        for t in cmap_table.tables:
            if t.platformID == 3 and t.platEncID == 1:
                subtable = t
                break
        if not subtable:
            subtable = CmapSubtable.newSubtable(4)
            subtable.platformID = 3
            subtable.platEncID = 1
            subtable.language = 0
            subtable.cmap = {}
            cmap_table.tables.append(subtable)

        target_glyph_order = list(target_tt.getGlyphOrder())
        merged_count = 0

        is_target_ttf = 'glyf' in target_tt and 'hmtx' in target_tt
        is_source_ttf = 'glyf' in source_tt and 'hmtx' in source_tt

        for ch in missing_chars:
            cp = ord(ch)
            source_gname = source_cmap.get(cp)
            if not source_gname or source_gname not in source_tt.getGlyphOrder():
                continue

            new_gname = f"sym_{cp:04X}"
            if new_gname in target_glyph_order:
                subtable.cmap[cp] = new_gname
                merged_count += 1
                continue

            if is_target_ttf and is_source_ttf:
                try:
                    from fontTools.pens.ttGlyphPen import TTGlyphPen
                    pen = TTGlyphPen(target_tt.getGlyphSet())
                    source_tt.getGlyphSet()[source_gname].draw(pen)
                    new_glyph = pen.glyph()

                    target_tt['glyf'][new_gname] = new_glyph
                    src_adv, src_lsb = source_tt['hmtx'][source_gname]
                    target_tt['hmtx'][new_gname] = (src_adv, src_lsb)
                    target_glyph_order.append(new_gname)
                    subtable.cmap[cp] = new_gname
                    merged_count += 1
                except Exception as e:
                    logger.debug(f"TTF glyph merge for U+{cp:04X} '{ch}' failed: {e}")
            elif 'CFF ' in target_tt and 'hmtx' in target_tt:
                try:
                    src_adv = 500
                    if 'hmtx' in source_tt and source_gname in source_tt['hmtx']:
                        src_adv = source_tt['hmtx'][source_gname][0]
                    target_tt['hmtx'][new_gname] = (src_adv, 0)
                    target_glyph_order.append(new_gname)
                    subtable.cmap[cp] = new_gname
                    merged_count += 1
                except Exception as e:
                    logger.debug(f"CFF glyph map for U+{cp:04X} '{ch}' failed: {e}")

        if merged_count > 0:
            target_tt.setGlyphOrder(target_glyph_order)
            _ensure_browser_required_tables(target_tt)
            out = io.BytesIO()
            target_tt.save(out)
            logger.info(f"Merged {merged_count} missing glyph(s) into font subset.")
            return out.getvalue()

    except Exception as e:
        logger.warning(f"merge_missing_glyphs failed: {e}")

    return None


_XH_CACHE = {}
def xheight_ratio(buf: bytes) -> float:
    key = hashlib.sha256(buf).hexdigest()[:12]
    if key in _XH_CACHE: return _XH_CACHE[key]
    r = 0.45
    try:
        tt = TTFont(io.BytesIO(buf))
        upm = tt["head"].unitsPerEm or 1000
        sx = 0
        gname = (tt.getBestCmap() or {}).get(ord("x"))
        if gname:
            from fontTools.pens.boundsPen import BoundsPen
            pen = BoundsPen(tt.getGlyphSet())
            tt.getGlyphSet()[gname].draw(pen)          # true outline bounds
            if pen.bounds:
                sx = round(pen.bounds[3] - pen.bounds[1])
        if not sx:                                      # last resort only
            os2 = tt.get("OS/2")
            sx = getattr(os2, "sxHeight", 0) or 0
        if sx and upm:
            r = sx / upm
    except Exception:
        pass
    _XH_CACHE[key] = r
    return r

def standin_size_scale(primary_buf: bytes, standin_buf: bytes) -> float:
    """Multiply stand-in size by this so its x-height matches the primary."""
    rp, rs = xheight_ratio(primary_buf), xheight_ratio(standin_buf)
    return round(rp / rs, 3) if rs else 1.0