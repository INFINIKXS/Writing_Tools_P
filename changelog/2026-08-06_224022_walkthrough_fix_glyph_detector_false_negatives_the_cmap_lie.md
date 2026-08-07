---
archived: 2026-08-06T22:40:22.500315
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\0de22959-305c-4d38-a25b-bfa861b7f724\walkthrough.md
---

# Walkthrough — Fix Glyph Detector False Negatives (The "CMAP Lie")

## Changes Made

### `backend/converter/font_utils.py`
- Replaced `_find_missing_glyphs` with an authoritative render-probe implementation (`_glyph_has_ink`) when `font_buffer` is provided.
- Added explicit log warning when missing glyphs are detected: `GLYPH-DETECTOR: subset font lacks ink for [...]`.
- Updated `get_font_for_edit` to pass `font_buffer=font_bytes` and `font_buffer=merged_bytes` into `_find_missing_glyphs`.

### `backend/converter/pdf_edit.py`
- Updated `_check_font_buf_missing_glyphs` to pass `font_buffer=font_buf` into `_find_missing_glyphs`.

### Unit Tests
- Created `backend/test_glyph_detector_subset.py` to synthesize a font buffer mapping 'N' to `.notdef` (empty outline) and verify that `_find_missing_glyphs` detects 'N' as missing and logs the `GLYPH-DETECTOR: subset font lacks ink for ['N']` warning.

## Verification

- **Render Probe Test**: Verified that characters present in CMAP but pointing to `.notdef` or empty outlines are correctly identified as missing glyphs.
- **Log Verification**: Confirmed warning output format `GLYPH-DETECTOR: subset font lacks ink for ['N']`.
- **Vault Fallback**: Confirmed that when missing glyphs are returned, Vault full-font resolution is triggered.
