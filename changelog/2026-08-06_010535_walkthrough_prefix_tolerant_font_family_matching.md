---
archived: 2026-08-06T01:05:35.397457
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Walkthrough — Prefix-Tolerant Font Family Matching

We have updated the font family matching logic in `backend/pdf_routes/editor.py`:

```python
def _clean_fam(fam):
    if not fam:
        return ""
    fam = re.sub(r"^[A-Z]{6}\+", "", fam).strip()
    return get_base_font_family(fam).strip().lower()

fam_a = _clean_fam(a.get("font_family", ""))
fam_b = _clean_fam(b.get("font_family", ""))

if fam_a != fam_b:
    short, long = (fam_a, fam_b) if len(fam_a) <= len(fam_b) else (fam_b, fam_a)
    # prefix-tolerant: 'newbaskerville-roman' vs 'newbaskerville-roman reg'
    if not (short and long.startswith(short)):
        d.update(a_fam=a.get("font_family"), b_fam=b.get("font_family"),
                 fam_a=fam_a, fam_b=fam_b)
        return False, "font_family", d
```

---

### Key Resolution
- **Prefix-Tolerant Matching**: `'newbaskerville-roman'` vs `'newbaskerville-roman reg'` evaluates to `long.startswith(short) == True`, successfully merging font variant names created during PDF font re-extraction.
- **Unit Tests**: `test_heal_rect_splits.py` executed 3 tests in 0.001s and passed (`OK`).
- **Archived Walkthrough**: Saved to `changelog/`.
