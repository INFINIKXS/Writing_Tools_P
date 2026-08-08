---
archived: 2026-08-08T01:03:29.395519
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\283b69f9-a44b-40b9-b11d-5dd03a252deb\walkthrough.md
---

# PDF-Safe Font Name Sanitization & Authentic ITC Table Mapping Completed

## Summary of Accomplishments

1. **CHANGE 1 — PDF-Safe Name Sanitization (`backend/converter/font_vault.py`)** [file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_vault.py]
   - Added helper `_pdf_safe(name: str) -> str`:
     ```python
     def _pdf_safe(name: str) -> str:
         return re.sub(r"[^A-Za-z0-9_+\-]", "-", name)
     ```
   - Applied `_pdf_safe()` at all font return sites: `resolve_promotion_target`, `vault_full_for`, and `vault_cover_for`.
   - Replaces spaces and non-standard symbols in font stems (e.g. `"New Baskerville ITC W04 Roman"` $\rightarrow$ `"New-Baskerville-ITC-W04-Roman"`), making font names 100% compliant with PDF name token standards in PyMuPDF `insert_text`.

2. **CHANGE 2 — Table Pointer Update to Authentic Font (`family_map.json` & `manifest.json`)**
   - Updated `family_map.json` under key `newbaskerville.regular`:
     `"regular": "full/New Baskerville ITC W04 Roman.ttf"`
   - Updated `manifest.json` under key `newbaskerville_regular`:
     `"full_font": "full/New Baskerville ITC W04 Roman.ttf"`
   - Maintained `libre-baskerville-Bold.ttf` and `libre-baskerville-Italic.ttf` for `bold` and `italic` variants.
   - Updated both local `%LOCALAPPDATA%\pdf_editor_font_vault` and project workspace `backend/font_vault`.

3. **Verification Results**
   - Tested lookups:
     ```python
     resolve_promotion_target('NewBaskerville-Roman', style='regular')
     # Returns: ('New-Baskerville-ITC-W04-Roman', <766-glyph TTF buffer>, 'newbaskerville')

     vault_full_for('NewBaskerville-Roman', style='regular')
     # Returns: ('New-Baskerville-ITC-W04-Roman', <766-glyph TTF buffer>)
     ```
   - Standard bakes and promotions on `NewBaskerville-Roman` paragraphs now output `[RUNFONT]` and `PROMOTE` logs with `New-Baskerville-ITC-W04-Roman` using the authentic 766-glyph cut.
