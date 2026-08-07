---
archived: 2026-08-07T00:56:29.040688
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\0de22959-305c-4d38-a25b-bfa861b7f724\walkthrough.md
---

# Walkthrough — Font Identity Root-Cause Fix

## Root Cause Analysis
1. **Font Name Mangling**: `get_font_for_edit()` in `font_utils.py` prepended `emb_` and truncated base font names to 20 characters (e.g. `emb_OPYJSL+NewBaskervill`), corrupting downstream font family lookups.
2. **Failed Vault Routing**: Mangled font names caused `root_family()` to generate mismatched family keys (`emb_newbaskervill`), causing vault lookups (`vault_cover_for` / `vault_full_for`) to miss and force unnecessary fallback to universal fonts.
3. **Multi-Bake Inconsistency**: On subsequent bakes, characters already present in `origStr` bypassed the Novel-Char trap, and with `font_buffer=None` passed to probe functions due to name resolution failure, unserved characters were drawn as `.notdef` (invisible boxes).

## Changes Implemented

### 1. `backend/converter/font_utils.py` (CHANGE 1)
- Removed `f"emb_{matched_basefont[:20]}"` prefixing and slicing in `get_font_for_edit`.
- `get_font_for_edit` now returns the clean, full base font name (`matched_basefont`).

### 2. `backend/converter/pdf_edit.py` (CHANGE 2 & CHANGE 3)
- Implemented `_resolve_primary_buffer(plan, font_buffer_map)` to resolve primary buffers across prefix and alias variants using `family_match`.
- Implemented `bad_primary` ink-probing for all characters in edit text:
  `bad_primary = {ch for ch in dict.fromkeys(text) if not ch.isspace() and not _glyph_has_ink(buf, ch)} if buf else set()`
- Updated `still` computation: `still |= (bad_primary - set(resolver))`.
- Updated `_emit_layout_manifest` and `_emit_token` to enforce the emit-time per-character floor:
  ```python
  elif ch in bad_primary:          # NEVER paint with a font that lacks the glyph
      fn, fo = "helv", helv_font
  ```

### 3. `backend/converter/font_vault.py` (CHANGE 4)
- Updated `_find_entry(mf, family)` to perform tolerant manifest lookups matching family names and `stand_in_for` attributes via `family_match`.
- Updated `vault_cover_for` and `vault_full_for` to use `_find_entry`.

## Verification Results
- All 9 backend font unit tests passed (`test_font_vault_gauntlet.py`, `test_novel_character_trap.py`, `test_root_family.py`, `test_glyph_detector_subset.py`, `test_twobake_gauntlet.py`).
- Confirmed that `get_font_for_edit` returns the full unmangled base font name and `_build_glyph_resolver` routes missing/novel characters to `SCAVENGE` or `VAULT` (e.g. `libre-baskerville-Regular`).
