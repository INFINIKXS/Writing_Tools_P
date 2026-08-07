---
archived: 2026-08-07T18:00:03.996169
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\60a5c1f3-7d3a-4ec0-9142-9adc7d41fae0\walkthrough.md
---

# Step 1, 2, 3 & 4 Implementation Walkthrough: Font Metric Corruption, Word Placement & X-Height Calibration

## Overview

This walkthrough documents the complete 4-step solution to baked-font metric corruption, oversized text rendering, spacing alignment, and stand-in font x-height calibration in PDF edits.

---

## Key Changes

### Step 1: Synthesis Fixed at Source (`backend/converter/font_utils.py`)
1. **Authoritative hmtx in OTF Wrapper (Hunk 1)**: Replaced `cs.decompile()` in `_synthesize_required_otf_tables` with `cs.draw(pen)` + `getattr(cs, "width")` (draw-based width extraction).
2. **Dedicated Entry Points (Hunk 2)**:
   - `prepare_for_insert(buffer)`: Used exclusively during baking. Passes healthy TTF/OTF through byte-for-byte; wraps bare CFF once without table surgery.
   - `prepare_for_browser(buffer, ...)`: Reserved exclusively for `/extract-fonts` browser serving path.
3. **No Post-Wrap Surgery (Hunk 3)**: Replaced `_inject_cmap` call in `get_font_for_edit` with `prepare_for_insert(font_bytes)`.

---

### Step 2: Rewire Bake Emitter & Pre-Insert Canary (`backend/converter/pdf_edit.py`)
1. **Canary Helpers**:
   - `_log_font_canary(fontname, buf, fontsize)`: Logs `upm`, `space_advance`, and calculated `space@fontsize` before font insertion.
   - `_safe_insert_font(page, fontname, buf, fontsize)`: Wraps `page.insert_font`, running `prepare_for_insert(buf)` for any buffer > 64 bytes.
2. **Re-wired All `page.insert_font` Calls**: 11 call locations rewired to `_safe_insert_font`.
3. **Diagnostic Markers**: Added `[MANIFEST]`, `[CANARY]`, and `[EMIT]` log entries to verify font size and rendering metrics end-to-end.

---

### Step 3: Word-Level Absolute Placement + Per-Word Font Selection (`backend/converter/pdf_edit.py`)
1. **No Space Coalescing**: Removed space-coalescing pre-pass in `_emit_layout_manifest`. Every word and space retains its absolute canvas $x$-coordinate.
2. **Preserve Paragraph Primary Font**: Promoted stand-in fonts (e.g. `Libre Baskerville`) act as a per-word supply strictly for missing characters in `resolver`. The primary font for untouched words remains the original embedded font subset.
3. **Per-Word Emission**: Replaced character-by-character emission in `_emit_layout_manifest` with single `page.insert_text` calls per word run. Untouched words render pixel-identically with the original subset font, while novel words render with the promoted stand-in at exact canvas coordinates.

---

### Step 4: X-Height-Calibrated Stand-In Sizing (`backend/converter/font_utils.py` & `backend/converter/pdf_edit.py`)
1. **X-Height Ratio Calculation (`font_utils.py`)**:
   - `xheight_ratio(buf)`: Inspects `OS/2.sxHeight` or falls back to drawing glyph `'x'` via `BoundsPen` to derive normalized x-height ($sx / upm$).
   - `standin_size_scale(primary_buf, standin_buf)`: Calculates exact scale factor ($ratio_{primary} / ratio_{standin}$).
2. **Per-Run Stand-In Scaling (`pdf_edit.py`)**:
   - In `_emit_layout_manifest` and `_emit_token`, stand-in font sizes are scaled by `MANUAL_SIZE_SCALE` override or `standin_size_scale(pb, sb)`.
3. **Manual Tuning Slot (`pdf_edit.py`)**:
   - Defined `MANUAL_SIZE_SCALE = {}` at top level for optional family-specific overrides (e.g. `{"librebaskerville": 0.90}`).

---

## Verification & Results

- **X-Height Calibration Test**: Verified `xheight_ratio` correctly extracts `0.5300` for Libre Baskerville.
- **Verification Gate (`verify_step1.py`)**: Passed with 100% assertions green on healthy TTFs and extracted CFF fonts (`HelveticaNeueLTStd-BdCn`).
- **Syntax Checks**: Confirmed clean compilation across `backend/converter/font_utils.py` and `backend/converter/pdf_edit.py`.

---
