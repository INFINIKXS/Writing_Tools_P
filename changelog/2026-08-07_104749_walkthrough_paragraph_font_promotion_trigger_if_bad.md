---
archived: 2026-08-07T10:47:49.115403
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\0de22959-305c-4d38-a25b-bfa861b7f724\walkthrough.md
---

# Walkthrough — Paragraph Font Promotion Trigger (`if bad:`)

## Core Concept
By changing the promotion condition from `if still:` to `if bad:`, the **first time** a paragraph requires even a single novel or un-inked character, the **entire paragraph is immediately promoted** to emit using the vault's complete family font (`libre-baskerville-Regular`).

When PyMuPDF's `subset_fonts()` subsets the document upon save, it produces a complete subset for that entire paragraph. Subsequent editing passes on that paragraph find zero missing characters (`bad` is empty), resulting in zero per-character fallback routing across all future bakes.

## Changes Implemented

### `backend/converter/pdf_edit.py`
Updated both the **manifest fast-path** and **run-faithful emission path**:

```python
bad_primary = _primary_bad_chars(font_obj, buf, paragraph_text)
bad = missing_chars | bad_primary
resolver = _build_glyph_resolver(doc, font_buffer_map, plan["fontname"], bad)
still = bad - set(resolver)

if bad:  # Promotes paragraph whenever subset lacks any character
    from .font_vault import vault_full_for, vault_cover_for
    fam = canonical_family(plan["fontname"])
    hit = vault_full_for(fam) or vault_cover_for(fam, sorted(bad)[0])
    if hit:
        pname, pbuf = hit
        try:
            page.insert_font(fontname=pname, fontbuffer=pbuf)
        except Exception:
            pass
        font_buffer_map[pname] = pbuf
        p_id = _font_id(pbuf)
        font_buffer_map[p_id] = pbuf
        plan["font_id"] = p_id
        plan["fontname"] = pname
        font_obj = fitz.Font(fontbuffer=pbuf)
        font_name_actual = pname
        logger.warning(f"PROMOTE: paragraph font -> {pname} (subset lacked {sorted(bad)})")
        resolver, still = {}, set()  # whole paragraph emits in complete font
```

## Verification Results
- **Full 10-Test Suite Passed**: `test_font_vault_gauntlet.py`, `test_novel_character_trap.py`, `test_root_family.py`, `test_glyph_detector_subset.py`, `test_twobake_gauntlet.py`, `test_font_promotion_gauntlet.py` (10/10 passed in 39.72s).
- Verified `PROMOTE: paragraph font -> libre-baskerville-Regular (subset lacked [...])` logs on initial missing characters and complete silence on subsequent bakes.
