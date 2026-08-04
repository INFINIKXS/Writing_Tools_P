---
archived: 2026-08-04T12:10:30.888039
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\c38fcd32-3b81-4c53-9f32-959e3ed19c28\walkthrough.md
---

# Walkthrough: Font Buffer Injection, Glyph Merging, XREF Protection & ASCII CMap Recovery

## Overview
This update addresses 4 core issues in the PDF Typography & Editing Engine:

1. **Font Buffer Registration Failure**: Resolved missing `fontbuffer` errors during `insert_text` / `insert_textbox`.
2. **Missing Glyphs in Font Subsets**: Implemented dynamic `merge_missing_glyphs()` to inject missing punctuation/symbols from system fallback fonts instead of defaulting to `helv`.
3. **MuPDF XREF Corruption**: Added error-recovering `apply_redactions()` and `doc.save(..., clean=True)` to rebuild XREF streams cleanly.
4. **CMap / ToUnicode Mapping Failures**: Force-mapped standard ASCII ranges (U+0020 to U+007E) to GIDs in `_inject_cmap()` using AGL names, unicode hex patterns, and font CMaps.

---

## Detailed Changes

### 1. [`backend/converter/pdf_edit.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py)

#### Font Buffer Injection
- Maintained a `font_buffer_map` during Phase 2.5 font registration.
- Passed `fontbuffer=font_buf_arg` into `page.insert_textbox()` and `page.insert_text()` whenever custom extracted font bytes are present.

#### Redaction & XREF Safety
- Added fallback handling around `page.apply_redactions()` to catch stream state exceptions.
- Updated `doc.save()` to run with `garbage=4, deflate=True, clean=True` to rebuild XREF tables and remove dangling object references.

---

### 2. [`backend/converter/font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py)

#### Dynamic Glyph Merging (`merge_missing_glyphs`)
- Created `merge_missing_glyphs(target_font_bytes, missing_chars, is_bold, is_italic)`.
- Uses `fontTools` (`TTGlyphPen`, `TTFont`) to extract missing glyph outlines (e.g. `,`, `•`, `-`) from fallback fonts and inject them into the subset font's `glyf`/`hmtx`/`cmap` tables.
- Integrated into `get_font_for_edit()`: when missing glyphs are detected, dynamic glyph merging runs before declaring fallback.

#### Force-Mapped ASCII Range in `_inject_cmap()`
- Added an explicit force-mapping pass for U+0020 through U+007E.
- Matches unmapped codepoints against Adobe Glyph List (AGL) names (`space`, `comma`, `period`, `hyphen`, etc.), unicode hex names (`uni002C`), and existing font CMaps.

---

## Verification
- Applied code modifications cleanly to `backend/converter/font_utils.py` and `backend/converter/pdf_edit.py`.
- Automated test suite (`pytest backend/test_challenge_pdf_edit.py`) launched.
