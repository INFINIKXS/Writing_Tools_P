---
archived: 2026-08-01T09:31:22.165286
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Per-Call `skip_cmap` Override for Browser Preview Font Loading

Fixed missing `cmap` table issues that caused browser `@font-face` preview font loading (`FontFace.load()`) to throw `NetworkError` / OTS parsing errors on PDF-embedded CFF/OTF fonts.

## Changes Made

### 1. Per-Call Override & Validation in Backend ([font_utils.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py))

- Updated `_inject_cmap` signature to accept `skip_cmap: bool = SKIP_CMAP_INJECTION_KEEP_HMTX`.
- Replaced internal `if SKIP_CMAP_INJECTION_KEEP_HMTX:` with `if skip_cmap:`, allowing callers to explicitly request full `cmap` table injection.
- Added strict post-serialization validation check in the non-skip branch:
  ```python
  verify_tt = TTFont(io.BytesIO(out_bytes))
  if 'cmap' not in verify_tt or not verify_tt.getBestCmap():
      logger.error(f"Refusing to serve '{basefont_name}' — no valid cmap table produced!")
      return None
  ```
- Preserved default `SKIP_CMAP_INJECTION_KEEP_HMTX = True` behavior for the PDF export path (`get_font_for_edit`).

### 2. Browser Preview Font Extraction Route ([editor.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/pdf_routes/editor.py))

- Updated `/extract-fonts` endpoint to invoke `_inject_cmap(buffer, doc, xref, page=page, basefont_name=basename, skip_cmap=False)`.
- Filters out any fonts where `_inject_cmap` returns `None` so the frontend falls back safely rather than shipping broken bytes.

## Next Verification Steps

1. Reload the PDF editor and check the browser console — `NewBaskerville-Roman` should now load successfully via `FontFace.load()`.
2. Run `document.fonts.check('14px "NewBaskerville-Roman"')` in DevTools console — should return `true`.
3. Check the console diagnostic log `[stem-darkening]` — verify `font-loaded: true` and observe `stemVwRatio`.
