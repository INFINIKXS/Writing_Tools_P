---
archived: 2026-08-07T01:32:29.121124
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\0de22959-305c-4d38-a25b-bfa861b7f724\walkthrough.md
---

# Walkthrough — Content-Addressed Font Identity Implementation

## Core Concept
Font names in PDFs undergoing subsetting/saving cycles are ephemeral (`OPYJSL+` → `ZWAAJC+` → `UIGDYW+`). Font identity must be **content-addressed** via binary buffer hash so name changes across save/load cycles never blind the glyph detector or break buffer lookups.

## Changes Implemented

### 1. `backend/converter/font_utils.py` (CHANGE 1)
- Stripped all `emb_` prefixing and `[:20]` slicing from `get_font_for_edit`.
- `get_font_for_edit` returns full clean base font names verbatim (`OPYJSL+NewBaskerville-Roman`).

### 2. `backend/converter/pdf_edit.py` (CHANGE 2)
- Added `_font_id(buf)` helper returning `hashlib.sha256(buf).hexdigest()[:16]`.
- **Phase 1**: Pre-recorded `plan["font_id"] = _font_id(font_buffer)` and registered font buffers under both `fontname` and `buf_id` keys in `plan["font_registrations"]`.
- **Phase 2.5**: Preserved hash-indexed buffer mappings in `font_buffer_map[buf_id] = font_buffer`.
- **Phase 3**: Updated `_resolve_primary_buffer` to look up by `font_id` first before falling back to family matching:
  ```python
  if plan.get("font_id") and plan["font_id"] in font_buffer_map:
      return font_buffer_map[plan["font_id"]]
  ```

### 3. `backend/converter/font_vault.py` (CHANGE 3)
- Added `_font_id(buf)` helper and recorded `"buffer_id": _font_id(buffer)` on each font entry during `vault_ingest`.

## Verification Results
- **Full Font Suite Passed**: All 9 unit tests across `test_font_vault_gauntlet.py`, `test_novel_character_trap.py`, `test_root_family.py`, `test_glyph_detector_subset.py`, and `test_twobake_gauntlet.py` passed in 53.0s.
- Verified zero `emb_` presence in returns/logs and confirmed hash-resolved buffer lookup stability across multiple edit passes.
