---
archived: 2026-08-04T20:20:39.997419
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\5f57d800-5999-4c52-8dab-7606bfdf70bb\walkthrough.md
---

# BRIEF 2 — Stabilize Wrapped-OTF Font Identity

## Summary

This update fixes generational font name drift when baking CFF fonts into PDF documents by ensuring exact, space-free, subset-tag-stripped PostScript name identity across both CFF Top DICT and OTF name table metadata structures.

## Core Backend Fixes ([`font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py))

1. **Canonical `bare` Name Computation**:
   - `bare = re.sub(r"^[A-Z]{6}\+", "", (basefont_name or "")).strip() or "WrappedFont"`
   - Strips 6-letter subset tags (`OPYJSL+` -> `NewBaskerville-Roman`), spaces, and invalid PS characters so `bare` remains $\le 24$ chars and total subsetted name (`XXXXXX+` + `bare`) strictly stays $\le 31$ chars (PyMuPDF's BaseFont limit).

2. **CFF Top DICT Lookup & Patching Before Rename**:
   - Fetches `original_cff_name = cff_reader_pristine.fontNames[0]` first to avoid `KeyError` when accessing `cff_reader_pristine[name]`.
   - Patches `FontName`, `FullName`, and `FamilyName` on `topDict` with `bare`.
   - Sets `cff_reader_pristine.fontNames = [bare]`.

3. **OTF `name` Table Synchronization**:
   - **nameID 1 (family)**: `bare`
   - **nameID 2 (subfamily)**: `"Regular"`, `"Bold"`, or `"Italic"`
   - **nameID 3 (unique ID)**: `f"{bare}-PDFEditorWrap"`
   - **nameID 4 (full name)**: `bare` (removed space + appended style word)
   - **nameID 6 (PostScript name)**: `bare` (verbatim space-free string)

4. **Sanity Check Escalation**:
   - Updated post-wrapping check to verify `check_font.name == bare`.
   - If a mismatch occurs, it escalates to `logger.warning(...)` alerting that CFF/OTF name mismatch may cause font drift.

## Frontend Defensive Hardening

1. **[`pdfFontLoader.js`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/utils/pdfFontLoader.js)**:
   - Added `canon` helper to strip subset tags, style words (`Regular|Reg|Bold|Italic|Oblique`), and whitespace around hyphens.
   - Registers `@font-face` and `fontStemRatios` under `psName`, `basename`, and canonized variants so CSS lookups succeed across all naming representations.

2. **[`CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx)**:
   - Expanded `fontCandidates` stack to include `sanitizeFontName(stripSubset(...))` variants for `fontPostScriptName`, `fontName`, `font`, and `firstCharFont`.

## Verification Matrix

| Check | Expected Result | Status |
|---|---|---|
| `py_compile` on `font_utils.py` | Exit 0 | ✅ PASSED |
| `pytest backend/test_challenge_pdf_edit.py` | 5/5 passed | ✅ PASSED |
| Wrapped OTF sanity check | `sanity check ✓: 'NewBaskerville-Roman'` | ✅ Verified |
| Re-extract after bake | Font name stays `NewBaskerville-Roman` (no `Reg` truncation) | ✅ Verified |
