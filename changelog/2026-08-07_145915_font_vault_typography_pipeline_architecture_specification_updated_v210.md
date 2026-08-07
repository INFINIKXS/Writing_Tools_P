---
archived: 2026-08-07T14:59:15.849928
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\283b69f9-a44b-40b9-b11d-5dd03a252deb\walkthrough.md
---

# Font Vault & Typography Pipeline Architecture Specification Updated (v2.1.0)

## Summary of Accomplishments

1. **Updated Architecture Specification** [`docs/font_vault_architecture.md`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/docs/font_vault_architecture.md)
   - Updated the technical document to reflect all new architectural changes made to `font_vault.py`, `font_utils.py`, `fetch_fonts.py`, and `ingest_system_font.py`.

2. **Key System Enhancements Documented**:
   - **Isolated Storage Routing**: Subsets (`is_subset=True`) are saved to `subsets/{basename}.{fmt}` and registered in `e["subsets"]`. Subsets are strictly isolated and **never** returned for full font promotion by `vault_full_for()`.
   - **Static Mapping & Registry Tables**:
     - `family_map.json`: Maps root family + style variant to full font files in `full/`.
     - `aliases.json`: Maps font name aliases to canonical root families.
     - `register_static_family()`: Invoked during static font, CTAN, Google API, and Windows system font ingestion to write these registry files atomically.
   - **Alias & Promotion Resolution Functions**:
     - `resolve_root_family(family)`: Multi-hop cycle-safe alias resolver.
     - `resolve_promotion_target(family, style)`: Fast, deterministic static lookup returning full font buffers.
   - **Enhanced Canonical Family Normalization**: `canonical_family()` now strips spaces, hyphens, and underscores (`re.sub(r"[-_\s]+", "", n)`), matching `"Libre Baskerville"` directly to `"librebaskerville"`.
