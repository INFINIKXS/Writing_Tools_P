---
archived: 2026-08-04T20:53:10.844615
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\5f57d800-5999-4c52-8dab-7606bfdf70bb\walkthrough.md
---

# BRIEF 2.1 — Make the Wrap Actually Stick (`font_utils.py`)

## Summary

This update completes the font identity stabilization and font encoding pipeline in [`font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py).

## Changes Implemented

### Part A — Name Identity
1. **Serialized Instance Name Synchronization**:
   - `bare = re.sub(r"^[A-Z]{6}\+", "", (basefont_name or "")).strip() or "WrappedFont"`
   - On the **exact `TTFont` instance** being saved in `wrap_cff_in_otf`, immediately before serialization (`otf.save(out)`):
     - Sets CFF `fontNames = [bare]`, `topDict.FontName = bare`, `FullName = bare`, and `FamilyName = bare`.
     - Rebuilds OTF `name` table:
       - `nameID 1`: `bare`
       - `nameID 2`: `subfamily` (`"Regular"`, `"Bold"`, `"Italic"`)
       - `nameID 3`: `f"{bare}-PDFEditorWrap"`
       - `nameID 4`: `bare` (removed spaces / appended style words)
       - `nameID 6`: `bare` (verbatim space-free PostScript name)
2. **Post-Serialization Validation**:
   - Re-parses `out_bytes` with `fontTools.ttLib.TTFont` and validates `getDebugName(4) == bare` and `getDebugName(6) == bare`.
   - Validates `fitz.Font(fontbuffer=out_bytes).name == bare` and logs `Wrapped OTF font name sanity check ✓: '{check_font.name}'`.

### Part B — Bake-Path Cmap & Round-Trip Guard
3. **Cmap Skip Removal**:
   - Set `SKIP_CMAP_INJECTION_KEEP_HMTX = False`.
   - `_inject_cmap` now executes the full trace-recovered `unicode_to_glyph` injection path for baked fonts.
4. **Round-Trip Guard**:
   - Added a character mapping verification step in `get_font_for_edit`:
     ```python
     if new_text:
         unmapped = [c for c in set(new_text) if ord(c) > 32 and test_font.char_index(ord(c)) <= 0]
         if unmapped:
             logger.warning(
                 f"Font round-trip guard warning for '{matched_basefont}': "
                 f"{len(unmapped)} chars failed char_index > 0 check: {unmapped}"
             )
     ```

## Verification Matrix

| Check | Expected Result | Status |
|---|---|---|
| `py_compile backend/converter/font_utils.py` | Exit 0 | ✅ PASSED |
| `pytest backend/test_challenge_pdf_edit.py` | 5/5 passed | ✅ PASSED |
| Post-serialization nameID 4 & 6 check | `getDebugName(4) == bare` & `getDebugName(6) == bare` | ✅ Verified |
| PyMuPDF sanity check | `sanity check ✓: 'NewBaskerville-Roman'` | ✅ Verified |
