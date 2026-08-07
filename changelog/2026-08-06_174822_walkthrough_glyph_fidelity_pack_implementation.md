---
archived: 2026-08-06T17:48:22.401740
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\f645c1a7-29aa-477f-b48e-5bee75574bbf\walkthrough.md
---

# Walkthrough — Glyph Fidelity Pack Implementation

We have implemented and verified the **Glyph Fidelity Pack** across [`backend/converter/font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py), [`backend/pdf_routes/editor.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/pdf_routes/editor.py), and [`backend/converter/pdf_edit.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py).

---

## Changes Made

### 1. Authoritative Coverage Detection ([font_utils.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py#L617-L660))
- `cmap_set(buffer)`: Returns the exact set of Unicode codepoints mapped in the font `cmap` table via `fontTools.ttLib.TTFont`.
- `_glyph_has_ink(font_buffer, ch)`: Render-probes raw font buffer on a temporary PyMuPDF pixmap to confirm true outline rendering (`ink > 0`).
- `_find_missing_glyphs(font_obj, text, font_buffer)`: Evaluates missing glyphs authoritatively using `cmap_set` and render probing.

### 2. Family Normalization & In-Document Sibling Scavenging ([font_utils.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py#L665-L700))
- `root_family(name)`: Strips subset tags (`[A-Z]{6}\+`) and style suffixes (`Bold`, `Italic`, `Condensed`, etc.) to produce a clean root family key.
- `build_doc_glyph_index(doc)`: Indexes all embedded fonts across all document pages by `root_family`.
- `cover_for(index, family, ch)`: Scavenges matching sibling subset fonts within the document that contain the missing character codepoint.

### 3. Persistent Font Vault ([font_utils.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py#L705-L750) & [editor.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/pdf_routes/editor.py#L1414))
- Created `backend/font_vault/` (`manifest.json`, `buffers/`, `full/`).
- `vault_ingest(family, basename, buffer, stem_vw_ratio, fmt)`: Called during `/api/pdf/extract-fonts` in `editor.py` to persist font buffers and accumulate family character coverage maps.
- `vault_cover_for(family, ch)`: Scavenges missing character coverage from past font ingestions stored in `font_vault/`.

### 4. 4-Tier Per-Character Glyph Resolution ([pdf_edit.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py#L150-L200) & [L1750-L2000](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py#L1750-L2000))
- `_build_glyph_resolver(...)`: Resolves missing characters following the 4-tier hierarchy:
  1. Document sibling subset (`cover_for`)
  2. On-disk Font Vault (`vault_cover_for`)
  3. Universal Fallback (`get_universal_fallback_font`)
  4. Base-14 `helv`
- Implemented per-character emission loops in both `_emit_layout_manifest` and `_emit_token`, ensuring every character is drawn with a font containing its physical outline.

---

## Verification Results

1. **Python Compilation**: `python -m py_compile backend/converter/font_utils.py backend/pdf_routes/editor.py backend/converter/pdf_edit.py` $\rightarrow$ **Passed (Exit code 0)**.
2. **Backend Unit Tests**: `pytest backend/test_heal_rect_splits.py` $\rightarrow$ **Passed 100% (6/6 tests passed)**.
