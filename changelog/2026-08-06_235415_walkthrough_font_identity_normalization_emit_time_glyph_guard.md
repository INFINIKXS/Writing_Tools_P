---
archived: 2026-08-06T23:54:15.029468
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\0de22959-305c-4d38-a25b-bfa861b7f724\walkthrough.md
---

# Walkthrough — Font Identity Normalization + Emit-Time Glyph Guard

## Context & Objectives
1. **Tolerant Family Matching**: Prefix-mangled font names (e.g. `emb_OPYJSL+NewBaskervill`) failed exact family lookups in font vault manifests, triggering unnecessary fallback to universal fonts with mismatched metrics.
2. **Buffer Resolution & Bad-Char Detection**: Robustly resolving primary font buffers across subset prefixes and alias names, combined with an ink-probe pass (`_primary_bad_chars`) against the actual primary buffer.
3. **Emit-Time Guard (Unbreakable Floor)**: Adding a 5-tier per-character emission check so no character without a verified ink outline in the primary font program is ever painted with the primary font.

## Changes Made

### 1. `backend/converter/font_utils.py` (CHANGE 1)
- Added `canonical_family(name)` to strip generated prefixes (`emb_`, `F1_`, `g_d0_`, etc.), subset tags (`OPYJSL+`), and style suffixes.
- Added `family_match(a, b)` for truncation-tolerant matching (e.g., `'newbaskervill'` vs `'newbaskerville-roman'`).
- Delegated `root_family(name)` to `canonical_family(name)`.

### 2. `backend/converter/font_vault.py` (CHANGE 2)
- Added `_find_entry(mf, family)` to perform tolerant manifest lookups matching family names and `stand_in_for` attributes via `family_match`.
- Updated `vault_cover_for` and `vault_full_for` to use `_find_entry`.

### 3. `backend/converter/pdf_edit.py` (CHANGE 3, 4, 5)
- Added `_resolve_primary_buffer(plan, font_buffer_map)` to resolve actual font buffers across prefix variants.
- Added `_primary_bad_chars(font_obj, buf, text)` to ink-probe characters against the actual primary buffer.
- Integrated `bad_primary` into both the manifest fast-path and run-faithful emission paths (`still = (missing_chars | bad_primary) - set(resolver)`).
- Updated `_emit_layout_manifest` and `_emit_token` to use 5-tier per-character emission logic:
  - Tier 1: `resolver` (Sibling / Vault stand-in)
  - Tier 2: `still` (Universal font fallback)
  - Tier 3: `helv`
  - Tier 4: `bad_primary` -> `helv` (EMIT-GUARD prevents painting blank/null glyphs)
  - Tier 5: Primary font
- Logged `EMIT-GUARD: [...] -> helv` when unserved bad primary characters are caught.

## Verification
- **All Unit Test Suites Passed**: `test_font_vault_gauntlet.py`, `test_novel_character_trap.py`, `test_root_family.py`, `test_glyph_detector_subset.py` (8/8 tests passed in 91.8s).
