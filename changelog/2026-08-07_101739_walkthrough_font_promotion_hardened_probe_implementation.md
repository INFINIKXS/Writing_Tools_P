---
archived: 2026-08-07T10:17:39.637084
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\0de22959-305c-4d38-a25b-bfa861b7f724\walkthrough.md
---

# Walkthrough — Font Promotion & Hardened Probe Implementation

## Objectives & Root Cause
1. **The Ephemeral Subset Problem**: Re-subsetted PDF fonts (`OPYJSL+` → `ZWAAJC+`) never grow new glyphs. On subsequent bakes, if characters are drawn using an incomplete subset as primary font, per-character routing runs on every generation.
2. **Font Promotion Solution**: If a subset font lacks characters and the glyph resolver leaves gaps (`still` non-empty), **promote** a full-charset family font (e.g. `libre-baskerville-Regular` from vault) to be the paragraph's primary font for that bake (`plan["fontname"] = pname`).
3. **Hardened Bad-Char Probe**: In `_primary_bad_chars`, when `buf is None` or ink-probing raises an exception, fall back to checking `not font_obj.has_glyph(ord(ch))` so probe detection can never be silently disabled.

## Key Changes

### 1. Hardened Probe (`backend/converter/pdf_edit.py`)
```python
def _primary_bad_chars(font_obj, buf, text):
    """Ink-probe every unique char against the primary buffer or font_obj."""
    from .font_utils import _glyph_has_ink
    bad = set()
    for ch in dict.fromkeys(text):
        if ch.isspace():
            continue
        if buf is not None:
            try:
                if not _glyph_has_ink(buf, ch):
                    bad.add(ch)
                continue
            except Exception:
                pass
        try:
            if font_obj and not font_obj.has_glyph(ord(ch)):
                bad.add(ch)
        except Exception:
            bad.add(ch)
    return bad
```

### 2. Font Promotion (`backend/converter/pdf_edit.py`)
In both manifest fast-path and run-faithful emission loops:
```python
bad = missing_chars | bad_primary
resolver = _build_glyph_resolver(doc, font_buffer_map, plan["fontname"], bad)
still = bad - set(resolver)

if still:
    from .font_vault import vault_full_for, vault_cover_for
    fam = canonical_family(plan["fontname"])
    hit = vault_full_for(fam) or vault_cover_for(fam, sorted(still)[0])
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
        logger.warning(f"PROMOTE: paragraph font -> {pname} (subset lacked {sorted(still)})")
        resolver, still = {}, set()
```

## Verification
- **Full Test Suite Passed**: 10/10 tests across `test_font_vault_gauntlet.py`, `test_novel_character_trap.py`, `test_root_family.py`, `test_glyph_detector_subset.py`, `test_twobake_gauntlet.py`, and `test_font_promotion_gauntlet.py` passed cleanly (36.17s).
- **Log Verification**: Confirmed `PROMOTE: paragraph font -> libre-baskerville-Regular` when subsets lack characters, and subsequent bakes operate silently with complete character coverage.
