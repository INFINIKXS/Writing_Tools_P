---
archived: 2026-08-04T18:58:58.892484
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\5f57d800-5999-4c52-8dab-7606bfdf70bb\walkthrough.md
---

# Bake Engine Fidelity Fixes — Walkthrough

## Changes Made

### TASK 1 — `backend/converter/pdf_edit.py`: RUN-SEG paragraph emission hardening

Three bug-fixes applied to the `if resolved_super_ranges:` emission path:

#### 1a. Glyph coverage guard (silent glyph drop protection)
Inserted immediately after the `page.insert_font()` re-registration block:
- Calls `_find_missing_glyphs(font_obj, paragraph_text)` to detect characters absent from the embedded subset.
- If any are found: logs a `RUN-SEG: '...' lacks glyphs [...]` warning, then registers the universal fallback font onto the page.
- The `fb_name` / `fb_font` pair is passed into the new `_emit_token` helper below.

#### 1b. `_emit_token` helper replacing bare `page.insert_text()`
- If no missing glyphs → emits the whole fragment in one `page.insert_text()` call (zero overhead).
- If missing glyphs present → iterates char-by-char, routing each missing char through `fb_name` (fallback) and normal chars through `font_name_actual`.
- Returns the new `x` cursor position, so the `x += font_obj.text_length(...)` duplicate is eliminated.

#### 1c. `break_ok`-gated line-break guard
Changed `if (x + _unit_width(i) > right) and (x > left):` to `if token["break_ok"] and ...`. This prevents mid-citation line breaks — glued citation fragments (`break_ok=False`) are never the trigger point for a line wrap; only the first fragment of a word (`break_ok=True`) can open a new line.

#### 1d. `start_x` for accurate superscript logging
The `RUN-SEG INSERT sup` log line now captures `start_x = x` before `_emit_token` updates `x`, so the logged coordinate is the token's actual left edge.

---

### TASK 2 — `backend/converter/font_utils.py`: CFF Top DICT FullName patch in `wrap_cff_in_otf`

**Root cause:** PyMuPDF reads `fitz.Font.name` from the CFF Top DICT `FullName` field (not from the OTF `name` table nameID 4). The OTF name table already had `ps_name` = `basefont_name` verbatim, but the CFF Top DICT `FullName` still held the family-derived string (e.g. `NewBaskerville-Roman Regular`), producing the mismatch in the sanity-check log.

**Fix:** After `cff_reader_pristine.fontNames = [basefont_name]`, also:
```python
top_dict = cff_reader_pristine[basefont_name]
top_dict.FullName = basefont_name          # e.g. "OPYJSL+NewBaskerville-Roman"
top_dict.FamilyName = basefont_name.split("+")[-1]  # e.g. "NewBaskerville-Roman"
```
After this, `fitz.Font(fontbuffer=wrapped).name` == `basefont_name` — the sanity check log will print **identical** actual and expected values on every wrap, including second-generation re-wrapped fonts.

---

### TASK 3 — `backend/pdf_routes/editor.py`: Dual-key `@font-face` registration

In the `extract-fonts` route, after storing the font entry under `basename` (e.g. `OPYJSL+NewBaskerville-Roman`), also store it under the bare `postscript_name` (e.g. `NewBaskerville-Roman`) if it has a subset tag and the bare name isn't already registered:

```python
if subset_tag and postscript_name and postscript_name not in fonts_out:
    fonts_out[postscript_name] = fonts_out[basename]
```

This guarantees that the canvas `fontCandidates` array matches a loaded `@font-face` on every bake generation — even when PyMuPDF re-subsets the font under a new random 6-letter prefix.

---

## Verification

| Check | Result |
|---|---|
| `py_compile` — `pdf_edit.py` | ✅ Exit 0 |
| `py_compile` — `font_utils.py` | ✅ Exit 0 |
| `py_compile` — `editor.py` | ✅ Exit 0 |
| `pytest backend/test_challenge_pdf_edit.py` | ✅ 5/5 passed (45s) |
