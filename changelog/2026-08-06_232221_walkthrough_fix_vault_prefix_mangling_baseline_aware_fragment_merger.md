---
archived: 2026-08-06T23:22:21.712687
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\0de22959-305c-4d38-a25b-bfa861b7f724\walkthrough.md
---

# Walkthrough — Fix Vault Prefix Mangling & Baseline-Aware Fragment Merger

## Context & Problem
1. Generated font name prefixes such as `emb_` (e.g. `emb_OPYJSL+NewBaskervill`) prevented `root_family()` from matching vault font families (e.g. `newbaskerville`), forcing unwarranted fallback to universal fonts with mismatched metrics.
2. Mismatched ascender/descender metrics in fallback fonts caused line fragment vertical bbox overlap checks (`ov > 0.35 * min(h, mh)`) to fail, fragmenting single visual lines.

## Changes Made

### 1. `backend/converter/font_utils.py`
- Defined `_PREFIX_RE = re.compile(r"^(emb_|F\d+_|g_d\d+_|font_|pdf_|mp_)", re.I)`.
- Updated `root_family(name)` to strip generated prefixes (`emb_`, `F1_`, `g_d0_`, etc.) *before* stripping subset tags (`OPYJSL+`) and style suffixes.

### 2. `backend/pdf_routes/editor.py`
- Updated `_merge_line_fragments()` to compute the dominant baseline (`ln_baseline`) from non-superscript/subscript character `origin_y` values.
- Enabled baseline-aware merging (`abs(ln_baseline - m["_baseline"]) < 1.5`), ensuring line fragments sharing the same visual baseline are merged into a single line regardless of font metric variations.
- Lowered bbox overlap threshold to `0.25 * min(h, mh)`.

### 3. `backend/converter/pdf_edit.py`
- Added `VAULT-MISS` debug logging inside `_build_glyph_resolver()` when a character cannot be resolved in document scavenge or vault lookups:
  `logger.debug(f"VAULT-MISS: {ch!r} not found for family {fam!r} (primary={primary_name!r})")`

## Verification
- **Unit Test**: `backend/test_root_family.py` verified prefix stripping (`emb_`, `F1_`, `g_d0_`, `font_`) for vault family matching.
- **Gauntlet & Novel-Trap Suite**: Ran `test_font_vault_gauntlet.py` and `test_novel_character_trap.py` (5/5 tests passed).
