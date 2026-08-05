---
archived: 2026-08-04T14:51:51.360831
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\c38fcd32-3b81-4c53-9f32-959e3ed19c28\walkthrough.md
---

# Walkthrough: Style-Faithful Paragraph Re-Insertion & OTF PostScript Naming

## Task 1: Style-Faithful Run-Segmented Paragraph Insertion
Replaced flat single-font `insert_textbox` calls with `TextWriter` + `fitz.Font` run-segmented emission:

### 1a. Extended Run Capture
- Captured per-run `text`, `font`, `size`, `color_int`, and converted `color_rgb`.
- Captured origin `(x, span_baseline_y)` and `line_baseline_y`.
- Calculated `rise = line_baseline_y - span_baseline_y` (positive = raised/superscript).
- Derived `derived_leading` from consecutive line baselines.
- Expanded `erase_rect` upward by `max(rise) + 2pt` to ensure superscript numbers are completely cleared before re-writing.

### 1b. Run-Segmented Emission via TextWriter
- Diff-mapped edited `paragraph_text` back to original run styles (`_build_styled_chars`).
- Reflowed tokens (words/whitespace) over `usable_width = paragraph_rect.width`.
- Applied line justification for full wrapped lines.
- Used `TextWriter` bucketed by `color_rgb` to emit styled character segments at `Point(x, line_baseline_y - rise)` using each run's exact `font`, `size`, `rise`, and `color_rgb`.
- Added per-character missing glyph fallback checking (`font.has_glyph(ord(ch))`).
- Emitted clean `RUN-WRITE x=.. y=.. size=.. rise=.. color=.. font=.. 'text...'` logs per segment.

## Task 2: PostScript Naming for Wrapped CFF Fonts
- Updated `wrap_cff_in_otf(cff_bytes, basefont_name)` in `font_utils.py`.
- Set CFF `fontNames = [basefont_name]` in the CFF FontSet.
- Built a valid OTF `name` table containing:
  - Name ID 6 (PostScript Name): `OPYJSL+NewBaskerville-Roman` (verbatim `basefont_name`).
  - Name ID 1 (Font Family) & Name ID 4 (Full Name): `NewBaskerville-Roman` (bare family name).
  - Name ID 2 (Subfamily): `"Regular"`, `"Bold"`, or `"Italic"`.
- Added sanity check verifying `fitz.Font(fontbuffer=out_bytes).name == basefont_name`.
- Updated `_extract_raw_font` in `font_utils.py` and `POST /api/pdf/extract-fonts` in `editor.py` to pass `basefont_name`.

## Verification
- Ran `pytest backend/test_challenge_pdf_edit.py` → **5/5 tests passed**.
