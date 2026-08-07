---
archived: 2026-08-06T00:38:15.154932
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Walkthrough — Font Family Normalization & Style Variant Fallback

We have updated the font family check in `_merge_decision` (`backend/pdf_routes/editor.py`) to clean PyMuPDF font variant strings before comparison:

```python
def _clean_fam(fam):
    if not fam: return ""
    # 1. Remove 6-letter subset prefix (e.g., "ABCDEF+NewBaskerville...")
    fam = re.sub(r"^[A-Z]{6}\+", "", fam)
    # 2. Get base family (strips everything after first hyphen or comma)
    return get_base_font_family(fam)

fam_a = _clean_fam(a.get("font_family", ""))
fam_b = _clean_fam(b.get("font_family", ""))

if fam_a != fam_b:
    # Fallback: if base names don't match exactly, check if one contains the other
    # (e.g., "NewBaskerville" matches "NewBaskerville Roman")
    if not (fam_a and fam_b and (fam_a in fam_b or fam_b in fam_a)):
        d.update(a_fam=a.get("font_family"), b_fam=b.get("font_family"), fam_a=fam_a, fam_b=fam_b)
        return False, "font_family", d
```

---

### Diagnosis & Solution
- **Root Cause Identified**: Log output revealed `a_fam: 'NewBaskerville-Roman Reg'` vs `b_fam: 'NewBaskerville-Roman'`. PyMuPDF appended `" Reg"` (Regular) to the parent block's re-extracted font during the bake.
- **Solution**: `_clean_fam` strips the `OPYJSL+` subset prefix, uses `get_base_font_family()` to split on hyphens/commas, and provides a substring fallback check. Both `"NewBaskerville-Roman Reg"` and `"NewBaskerville-Roman"` resolve to `"NewBaskerville"`.

---

### Verification
- **Unit Tests**: `test_heal_rect_splits.py` executed 3 tests and passed (`OK`).
- **Archived Walkthrough**: Archived to `changelog/`.
