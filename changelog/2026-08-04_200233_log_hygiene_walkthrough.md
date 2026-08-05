---
archived: 2026-08-04T20:02:33.618868
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\5f57d800-5999-4c52-8dab-7606bfdf70bb\walkthrough.md
---

# Log Hygiene — Walkthrough

## Goal
A full extract + bake cycle prints ≤ ~15 terminal lines by default. All detail remains available behind `PDF_VERBOSE=1`.

## Changes Made

### A. [`backend/main.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/main.py)

Added after imports:
- `logging.getLogger("fontTools").setLevel(logging.ERROR)` — silences `'created' timestamp` warnings emitted by fontTools internals
- `_AccessFilter` on `uvicorn.access` — suppresses `/api-key-usage` and `/api/style/profile` health-poll routes from the access log
- `PDF_VERBOSE=1` env guard — sets all three PDF loggers (`pdf_routes.editor`, `converter.font_utils`, `converter.pdf_edit`) to `DEBUG` when set

### B. [`backend/pdf_routes/editor.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/pdf_routes/editor.py)

Demoted from `logger.info` → `logger.debug`:
| Message prefix | Note |
|---|---|
| `Column detection: two/single column` | Per-extract |
| `[CLUSTER-DEBUG]` | Also converted from bare `print()` to `logger.debug()` |
| `[REGIONS-DEBUG]`, `[SUBBUCKET]`, `[REGIONS]` | Per-page |
| Per-paragraph `[TYPOGRAPHY]` dump | Also stripped embedded `[INFO] ` prefix |
| `Extracted font … bytes` (per font) | Per-extract |
| `• fontname` bullet list under FONT ENGINE | Kept the one-line SUCCESS summary at INFO |

**Kept at INFO:** `[TYPOGRAPHY ENGINE] START/SUCCESS`, `[FONT ENGINE] SUCCESS: Serving N …`

### C. [`backend/converter/font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py)

Demoted from `logger.info`/`logger.warning` → `logger.debug`:
- `==== INJECT_CMAP START/SUCCESS`
- `Parse ToUnicode`, `Extracted CIDToGIDMap`, `TTFont loaded`
- `No existing cmap`, `Built font_cmap_gids`
- `Attempting Trace CID Recovery`, `Trace extracted`, `Adjusted … mismatched`
- `No reliable GID` (was `WARNING` — silenced to `DEBUG` since it fires for every unmapped char)
- `Generated unicode_to_glyph` + all `DIAG:` per-char lines
- `Post-serialization cmap validated`, `CFF hmtx sync`
- `Wrapped OTF font name sanity check`
- `[CFF STEM] Extracted std_vw`
- `Extracted font '…' detected as:`, `Bare CFF detected`, `CFF successfully wrapped`
- `==== HMTX-ONLY PATH SUCCESS`
- `Using embedded font`, `Using Base-14 font`

### D. [`backend/converter/pdf_edit.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py)

Demoted from `logger.info` → `logger.debug`:
- `PARAGRAPH RUNS: …` + all `  RUN line_y=…` per-run lines
- `REDACT: rect=…` + `  ERASING TEXT:`
- `Phase 2.5: registered '…'` + `Phase 2.5: registered fallback '…'`
- `EXECUTING SUPERSCRIPT-AWARE PARAGRAPH INSERT`
- `RUN-SEG INSERT sup '…'`
- `Universal fallback font resolved`

**Kept at INFO:** `PARAGRAPH EDIT: page …`, `PARAGRAPH RUN-SEG INSERT SUCCESS`, `PARAGRAPH INSERT OK`

## Expected Terminal Output (default, no PDF_VERBOSE)

A single extract-spacing + apply-edits with one paragraph edit should produce approximately:

```
INFO  [TYPOGRAPHY ENGINE] START: Extracting typography for PDF (N pages)
INFO  [TYPOGRAPHY ENGINE] SUCCESS: Extracted M paragraphs across N pages
INFO  [FONT ENGINE] SUCCESS: Serving K embedded PDF fonts to frontend
INFO  PARAGRAPH EDIT: page P, rect=[…], orig_len=…, new_len=…
INFO  PARAGRAPH RUN-SEG INSERT SUCCESS: page P
INFO  POST /api/pdf/apply-edits HTTP/1.1 200 OK
```

With `PDF_VERBOSE=1` all demoted lines return unchanged.

## Verification

| Check | Result |
|---|---|
| `py_compile` — `main.py`, `pdf_edit.py`, `font_utils.py`, `editor.py` | ✅ Exit 0 |
| `pytest backend/test_challenge_pdf_edit.py` | ✅ 5/5 passed |
