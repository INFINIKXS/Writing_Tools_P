---
archived: 2026-08-06T22:49:13.253543
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\0de22959-305c-4d38-a25b-bfa861b7f724\walkthrough.md
---

# Walkthrough — Fix "Novel Character" Widths Trap in Subset Fonts

## Context & Root Cause
Subset fonts embedded in PDFs often contain the glyph outline for characters not present in the original document text, but lack corresponding entries in the PDF font's internal `Widths` and `Encoding` arrays. When PDF.js renders these "novel" characters, it defaults to 0 width, rendering them invisibly with zero spacing.

## Changes Made

### `backend/converter/pdf_edit.py`

1. **CHANGE 1 — Preserve `origStr` in Paragraph Plan (Phase 1)**:
   - Added `plan["origStr"] = orig_text` when building paragraph edit plans so original text is available during emission in Phase 3.

2. **CHANGE 2 — Novel-Char Trap in Manifest Fast-Path (Phase 3)**:
   - Evaluated `novel_chars = set(manifest_text) - set(orig_str)` (excluding whitespace).
   - For subset fonts (font name containing `+`), merged `novel_chars` into `missing_chars` and logged:
     `DEBUG: NOVEL-CHARS: forcing [...] to fallback (not in origStr)`

3. **CHANGE 3 — Novel-Char Trap in Run-Faithful Path (Phase 3)**:
   - Applied the identical novel character detection in the `resolved_super_ranges` paragraph emission path.

## Verification

- **Unit Test**: `backend/test_novel_character_trap.py` passed, confirming that novel non-space characters in subset font operations are isolated and added to fallback set.
- **Log Verification**: Confirmed debug log format `NOVEL-CHARS: forcing [...] to fallback (not in origStr)`.
