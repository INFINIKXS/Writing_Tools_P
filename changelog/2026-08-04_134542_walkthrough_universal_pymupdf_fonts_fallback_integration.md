---
archived: 2026-08-04T13:45:42.188430
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\c38fcd32-3b81-4c53-9f32-959e3ed19c28\walkthrough.md
---

# Walkthrough: Universal pymupdf_fonts Fallback Integration

## Problem
The engine was falling back to Base-14 `helv` for any text where the embedded font subset was missing glyphs. `helv` (Helvetica) covers only ASCII and lacks modern Unicode characters, causing layout breaks and missing punctuation.

## Changes Made

### 1. Installed `pymupdf-fonts`
- Added `pymupdf-fonts` to [`backend/requirements.txt`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/requirements.txt)
- Installed `pymupdf_fonts-1.0.5` which ships FiraGO, Noto Sans, Ubuntu, Space Mono, Cascadia Code

### 2. Corrected API: `.font()` → `.myfont()`
The documented `pymupdf_fonts.font()` does not exist in v1.0.5. The correct API is:
```python
import pymupdf_fonts
buf: bytes = pymupdf_fonts.myfont("figo")   # FiraGO Regular — 804KB, widest Unicode
```

### 3. [`backend/converter/pdf_edit.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py)
- Added `from typing import Optional` (was missing — caused `NameError` at module load)
- Rewrote `get_universal_fallback_font(fontname)` with:
  - Bold/italic/mono/serif detection from original font name
  - Ordered candidate list of verified pymupdf_fonts v1.0.5 codes
  - `pymupdf_fonts.myfont(code)` call with iteration through candidates
  - Graceful `ImportError` fallback to Base-14 `tiro`/`cour`/`helv`
- `_get_fallback_font_name()` delegates to `get_universal_fallback_font()`

### 4. [`backend/converter/font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py)
- Updated `_PYMUPDF_SERIF_CODE`, `_PYMUPDF_SANS_CODE`, `_PYMUPDF_MONO_CODE` to verified codes
- Rewrote `_fallback()` to use `pymupdf_fonts.myfont()` with identical candidate logic

### Font Priority Table

| Case | Primary candidates | Base-14 fallback |
|---|---|---|
| Sans-serif (default) | `figo → notos → ubuntu` | `helv` |
| Serif | `ubuntu → figo → notos` | `tiro` |
| Monospaced | `cascadia → spacemo` | `cour` |
| Bold sans | `figbo → notosbo → ubuntubo` | `helv` |
| Italic sans | `figit → notosit → ubuntuit` | `helv` |

## Verification
- `pymupdf_fonts.myfont('figo')` → **804,888 bytes** ✓
- `pymupdf_fonts.myfont('notos')` → **455,188 bytes** ✓
- `pytest backend/test_challenge_pdf_edit.py` → **5/5 passed** ✓
