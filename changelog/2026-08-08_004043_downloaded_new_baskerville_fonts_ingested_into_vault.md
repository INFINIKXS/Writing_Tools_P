---
archived: 2026-08-08T00:40:43.633379
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\283b69f9-a44b-40b9-b11d-5dd03a252deb\walkthrough.md
---

# Downloaded New Baskerville Fonts Ingested into Vault

## Summary of Ingested Fonts

The custom font ingestion pipeline scanned your downloaded font directories and successfully ingested, registered, and synced **4 authentic New Baskerville font binaries**:

1. **`New Baskerville Roman.otf`**
   - **Format**: OpenType (`.otf`)
   - **Glyphs**: 204 glyphs
   - **UnitsPerEm**: 1000
   - **Source**: `C:\Users\Paradox-Labs\Downloads\new-baskerville-roman`

2. **`New Baskerville ITC W04 Roman.ttf`**
   - **Format**: TrueType (`.ttf`)
   - **Glyphs**: 766 glyphs
   - **UnitsPerEm**: 1000
   - **Source**: `C:\Users\Paradox-Labs\Downloads\OnlineWebFonts_COM_ca9dfb1ad44b59f800ef2a046cb22ec1`

3. **`New Baskerville ITC W04 Roman.otf`**
   - **Format**: OpenType (`.otf`)
   - **Glyphs**: 766 glyphs
   - **UnitsPerEm**: 1000
   - **Source**: `C:\Users\Paradox-Labs\Downloads\OnlineWebFonts_COM_ca9dfb1ad44b59f800ef2a046cb22ec1`

4. **`c084ee0e4875ec265ed741ce1452b0bb.ttf`**
   - **Format**: TrueType (`.ttf`)
   - **Glyphs**: 766 glyphs
   - **UnitsPerEm**: 1000
   - **Source**: Web font package

---

## Vault Synchronization & Registry
- All 4 font files were stored in `%LOCALAPPDATA%\pdf_editor_font_vault\full\` and synced to `backend/font_vault/full/`.
- Registered in `family_map.json` and `aliases.json` under `newbaskerville`.
- The system now resolves any PDF paragraph or canvas text referencing `NewBaskerville-Roman`, `New Baskerville Roman`, or `New Baskerville ITC W04 Roman` directly to these authentic full-charset font binaries!
