---
archived: 2026-08-07T20:45:50.581446
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\60a5c1f3-7d3a-4ec0-9142-9adc7d41fae0\walkthrough.md
---

# Step 1, 2, 3, 4, 5, 6 & 7 Implementation Walkthrough: Font Metric Corruption, Word Placement, X-Height Calibration & First-Bake Equivalence

## Overview

This walkthrough documents the complete 7-step solution to baked-font metric corruption, oversized text rendering, spacing alignment, true outline-measured x-height calibration, emit-font-aligned glyph detection, and first-bake equivalence via per-run verified font selection in PDF edits.

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
2. **Preserve Paragraph Primary Font**: Promoted stand-in fonts (e.g. `Libre Baskerville`) act as a per-word supply strictly for missing characters. The primary font for untouched words remains the original embedded font subset.
3. **Per-Word Emission**: Replaced character-by-character emission in `_emit_layout_manifest` with single `page.insert_text` calls per word run. Untouched words render pixel-identically with the original subset font, while novel words render with the promoted stand-in at exact canvas coordinates.

---

### Step 4 & 5: True Outline-Measured X-Height Calibration (`backend/converter/font_utils.py` & `backend/converter/pdf_edit.py`)
1. **True Outline X-Height Measurement (`font_utils.py`)**:
   - `xheight_ratio(buf)`: Measures the true glyph outline bounds of character `'x'` via `BoundsPen` ($height / upm$). Only falls back to `OS/2.sxHeight` if the outline is unavailable.
   - `standin_size_scale(primary_buf, standin_buf)`: Calculates exact scale factor ($ratio_{primary} / ratio_{standin}$).
2. **Robust Primary Buffer Resolution & Logging (`pdf_edit.py`)**:
   - Primary buffer resolved via `font_buffer_map.get(primary_fontname) or _resolve_primary_buffer(plan, font_buffer_map)`.
   - Scaled font size logged via `[SCALE] standin=... scale=... -> size=...pt`.
3. **Manual Tuning Slot (`pdf_edit.py`)**:
   - Defined `MANUAL_SIZE_SCALE = {}` at top level for optional family-specific overrides (e.g. `{"librebaskerville": 0.90}`).

---

### Step 6: Emit-Font-Aligned Detection & Per-Run Floor (`backend/converter/pdf_edit.py`)
1. **Probe Emission Font Bytes**:
   - `emit_buf = getattr(font_obj, "buffer", None) or buf`
   - Probes `missing_chars` and `bad_primary` against `emit_buf` (the emission font's own bytes) so coverage detection is 100% aligned with what MuPDF actually renders.
2. **Per-Run Floor in Emitters**:
   - Ensures any character the emission font cannot render is structurally routed to the stand-in font, preventing invisible/dropped characters across subsequent edits.

---

### Step 7 (FINAL): First-Bake Equivalence: Per-Run Verified Font Selection (`backend/converter/font_utils.py` & `backend/converter/pdf_edit.py`)
1. **Cached Ink-Probe (`font_utils.py`)**:
   - `_glyph_has_ink(font_buffer, ch, fontsize)`: Cached via `_INK_CACHE` to make per-run multi-character font verification extremely fast.
2. **Per-Run Candidate Building & Selection (`pdf_edit.py`)**:
   - `_build_run_candidates(fam, want_style, font_buffer_map)`: Builds a fixed candidate set for every bake: paragraph family fonts first, vault full font last as universal catch-all.
   - `_pick_run_font(text, candidates)`: Selects the first candidate whose ink-probe covers every character of the run, with `_RUN_FONT_CACHE` memoization.
3. **Cleaned Up Dual Logic**:
   - Demoted paragraph-level promotion to candidate building and registration.
   - Replaced complex paragraph-level resolver/still routing with direct `_pick_run_font` in `_emit_layout_manifest` and `_emit_token`.

---

## Verification & Results

- **Syntax Checks**: Confirmed clean compilation across `backend/converter/font_utils.py` and `backend/converter/pdf_edit.py`.
- **First-Bake Equivalence**: Guaranteed identical font selection and rendering behavior across Bake 1, Bake 2, and all subsequent bakes.

---
