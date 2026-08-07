---
archived: 2026-08-07T14:42:26.067148
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\411782e8-470e-40d2-a45e-3fa9f7abf47e\walkthrough.md
---

# Step 3: Static Family Table + Alias Lines (Deterministic Promotion Resolution)

## Summary of Implementation

This step eliminates font drift and order-dependent promotion by replacing mutable manifest scans with two static, immutable lookup tables (`family_map.json` and `aliases.json`).

### Key Changes Made

1. **`backend/converter/font_utils.py`**:
   - Updated `canonical_family()` to normalize spaces, hyphens, and underscores (`re.sub(r"[-_\s]+", "", n)`), ensuring `"Libre Baskerville"` and `"libre-baskerville"` collapse to the exact same key.
   - Updated `_STYLE_RE` separator to match space-separated style names as well (`[-_\s]`).

2. **`backend/converter/font_vault.py`**:
   - Added static JSON writing helper `_atomic_write_json()`.
   - Added `register_static_family(root_fam, style, rel_path, alias=None)` to update `family_map.json` and `aliases.json` safely under `_LOCK`.
   - Added `resolve_root_family(family)` to traverse alias chains (up to 3 hops, cycle-safe).
   - Added `resolve_promotion_target(family, style="regular")` for static table lookups (`sampled name -> alias chain -> root family -> style -> file`).
   - Updated `_find_entry()` to use `resolve_root_family()`.

3. **Ingestion & Fetch Tools (`tools/fetch_fonts.py` & `tools/ingest_system_font.py`)**:
   - Added calls to `register_static_family()` following `vault_ingest(..., full=True, ...)` to generate static mapping entries.

4. **`backend/converter/pdf_edit.py`**:
   - Updated Phase-1 paragraph plan creation to set `plan["is_bold"]` and `plan["is_italic"]` flags.
   - Updated promotion blocks to call `resolve_promotion_target(plan["fontname"], want_style)` for deterministic static lookup.

---

## Verification Results

### 1. `family_map.json` & `aliases.json` Contents

`family_map.json`:
```json
{
 "newbaskerville": {
  "regular": "full/libre-baskerville-Regular.ttf",
  "bold": "full/libre-baskerville-Bold.ttf",
  "italic": "full/libre-baskerville-Italic.ttf"
 },
 "courier": {
  "bold": "full/texgyrecursor-bold.otf"
 },
 "helvetica": {
  "bold": "full/texgyreheros-bold.otf",
  "bolditalic": "full/texgyreheros-bolditalic.otf",
  "italic": "full/texgyreheros-italic.otf"
 },
 "timesnewroman": {
  "bold": "full/texgyretermes-bold.otf",
  "italic": "full/texgyretermes-italic.otf",
  "regular": "full/Tinos-regular.ttf",
  "bolditalic": "full/Tinos-700italic.ttf"
 },
 "arial": {
  "regular": "full/Arimo-regular.ttf",
  "bold": "full/Arimo-700.ttf",
  "italic": "full/Arimo-italic.ttf",
  "bolditalic": "full/Arimo-700italic.ttf"
 }
}
```

`aliases.json`:
```json
{
 "librebaskerville": "newbaskerville",
 "texgyrecursor": "courier",
 "texgyreheros": "helvetica",
 "texgyrepagella": "palatino",
 "texgyretermes": "timesnewroman",
 "arimo": "arial",
 "tinos": "timesnewroman",
 "cousine": "couriernew",
 "carlito": "calibri",
 "caladea": "cambria",
 "roboto": "helveticaneue",
 "opensans": "helvetica"
}
```

### 2. Direct Assertion Check
```python
from converter.font_vault import resolve_promotion_target
t = resolve_promotion_target("CPFFCQ+Libre Baskerville Italic", "regular")
assert t and "Regular" in t[0], t
```
**Output:**
```
RESULT: ('libre-baskerville-Regular', b'...', 'newbaskerville')
ASSERTION SUCCESS!
```

### 3. Test Suite Verification
Running `pytest backend/test_twobake_gauntlet.py backend/test_font_promotion_gauntlet.py backend/test_font_vault_gauntlet.py`:
```
============================= 6 passed in 29.85s ==============================
```
