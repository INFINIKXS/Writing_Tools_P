---
archived: 2026-08-07T14:14:20.994692
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\411782e8-470e-40d2-a45e-3fa9f7abf47e\walkthrough.md
---

# Stop Auto-Ingest from Polluting the Full-Font Vault

## Summary of Changes

To prevent embedded PDF font subsets (e.g., `OPYJSL+NewBaskerville-Roman`) auto-ingested via `/extract-fonts` from polluting the `full/` directory and being returned by `vault_full_for()` as promotion targets, the following changes were implemented:

1. **`backend/converter/font_vault.py`**:
   - Added `is_subset=False` parameter to `vault_ingest()`.
   - Updated directory creation and routing in `vault_ingest()`:
     - Full fonts (`full=True`) → `VAULT_DIR / "full/"`
     - Subsets (`is_subset=True`) → `VAULT_DIR / "subsets/"`
     - General buffers (`else`) → `VAULT_DIR / "buffers/"`
   - Manifest tracking update:
     - Entries now track `"subsets": []` separately from `"sources": []` and `"full_font"`.
     - When `is_subset=True`, filenames are appended to `entry["subsets"]` and ignored for `full_font` promotion.
   - Updated `vault_cover_for()` to search both `buffers/` and `subsets/` for subset coverage.
   - Updated `vault_full_for()` safety checks to strictly ignore any entries pointing to `subsets/`.

2. **`backend/converter/font_utils.py`**:
   - Passed `is_subset` parameter through `vault_ingest()` wrapper.

3. **`backend/pdf_routes/editor.py`**:
   - Updated `/extract-fonts` endpoint to compute `is_subset = bool(subset_tag)` and pass `is_subset=is_subset` when scheduling background ingestion batch items.

4. **`backend/pdf_routes/vault.py`**:
   - Updated `/font/{filename}` file server endpoint to check `subsets/` directory alongside `full/` and `buffers/`.

## Verification

- **Syntax & Compilation:** Python syntax validation succeeded across all modified files (`font_vault.py`, `font_utils.py`, `editor.py`, `vault.py`).
- **Backward Compatibility:** `fetch_fonts.py` and manual font registrations continue defaulting `is_subset=False` and correctly register full fonts.
