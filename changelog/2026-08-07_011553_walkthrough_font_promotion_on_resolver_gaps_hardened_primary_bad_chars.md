---
archived: 2026-08-07T01:15:53.885160
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\0de22959-305c-4d38-a25b-bfa861b7f724\walkthrough.md
---

# Walkthrough — Font Promotion on Resolver Gaps & Hardened `_primary_bad_chars`

## Objectives
1. **Hardened `_primary_bad_chars`**: If `buf` is `None` (e.g. when font buffer extraction fails or wasn't available), probe `font_obj.has_glyph(ord(ch))` instead of skipping, preventing probe silent disabling.
2. **Full-Charset Family Font Promotion**: When `resolver` leaves gaps (`still` contains unserved characters), immediately promote a full-charset family font from the vault (`vault_full_for(fam)` or `vault_cover_for(fam, ...)`). Update `plan["fontname"]`, `font_obj`, and `font_name_actual` to the promoted font name, so the entire paragraph is rendered cleanly with a matching family font.

## Key Code Updates

### 1. Hardened `_primary_bad_chars` (`backend/converter/pdf_edit.py`)
```python
def _primary_bad_chars(font_obj, buf, text):
    """Ink-probe every unique char against the ACTUAL primary buffer or font_obj."""
    from .font_utils import _glyph_has_ink
    bad = set()
    for ch in dict.fromkeys(text):
        if ch.isspace():
            continue
        if buf is not None:
            if not _glyph_has_ink(buf, ch):
                bad.add(ch)
        elif font_obj is not None:
            try:
                if not font_obj.has_glyph(ord(ch)):
                    bad.add(ch)
            except Exception:
                bad.add(ch)
    return bad
```

### 2. Paragraph Font Promotion (`backend/converter/pdf_edit.py`)
Applied in both manifest fast-path and run-faithful emission paths:
```python
bad_primary = _primary_bad_chars(font_obj, buf, manifest_text)
bad = missing_chars | bad_primary

resolver = _build_glyph_resolver(doc, font_buffer_map, plan["fontname"], bad)
still = bad - set(resolver)

if still:
    # Resolver left gaps → PROMOTE full-charset family font to primary.
    fam = canonical_family(plan["fontname"])
    hit = vault_full_for(fam) or vault_cover_for(fam, sorted(still)[0])
    if hit:
        pname, pbuf = hit
        page.insert_font(fontname=pname, fontbuffer=pbuf)
        font_buffer_map[pname] = pbuf
        plan["fontname"], font_obj, font_name_actual = pname, fitz.Font(fontbuffer=pbuf), pname
        logger.warning(f"PROMOTE: paragraph font -> {pname} (subset lacked {sorted(still)})")
        resolver, still = {}, set()   # whole paragraph now emits with the complete font
```

## Verification
- Ran test suite (`test_font_vault_gauntlet.py`, `test_novel_character_trap.py`, `test_root_family.py`, `test_glyph_detector_subset.py`, `test_twobake_gauntlet.py`).
- All 9 tests passed cleanly in 54.5s.
