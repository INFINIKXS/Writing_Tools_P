---
archived: 2026-08-07T22:06:16.917361
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\60a5c1f3-7d3a-4ec0-9142-9adc7d41fae0\walkthrough.md
---

# Step 1-8 Implementation Walkthrough: Font Metric Corruption, Word Placement, X-Height Calibration & Stateless Per-Run Emission

## Overview

This walkthrough documents the complete 8-step solution to baked-font metric corruption, oversized text rendering, spacing alignment, true outline-measured x-height calibration, emit-font-aligned glyph detection, first-bake equivalence via per-run verified font selection, stateless per-run self-registration, and erase-rect clamping.

---

## Key Changes

### Step 1: Synthesis Fixed at Source (`backend/converter/font_utils.py`)
1. **Authoritative hmtx in OTF Wrapper**: Replaced `cs.decompile()` in `_synthesize_required_otf_tables` with `cs.draw(pen)` + `getattr(cs, "width")`.
2. **Dedicated Entry Points**:
   - `prepare_for_insert(buffer)`: Used exclusively during baking. Passes healthy TTF/OTF through byte-identical; wraps bare CFF once without table surgery.
   - `prepare_for_browser(buffer, ...)`: Reserved exclusively for `/extract-fonts` browser serving path.
3. **No Post-Wrap Surgery**: Replaced `_inject_cmap` call in `get_font_for_edit` with `prepare_for_insert(font_bytes)`.

---

### Step 2: Rewire Bake Emitter & Pre-Insert Canary (`backend/converter/pdf_edit.py`)
1. **Canary Helpers**:
   - `_log_font_canary(fontname, buf, fontsize)`: Logs `upm`, `space_advance`, and calculated `space@fontsize` before font insertion.
   - `_safe_insert_font(page, fontname, buf, fontsize)`: Wraps `page.insert_font`, running `prepare_for_insert(buf)` for any buffer > 64 bytes.
2. **Re-wired All `page.insert_font` Calls**: 11 call locations rewired to `_safe_insert_font`.
3. **Diagnostic Markers**: Added `[MANIFEST]`, `[CANARY]`, and `[EMIT]` log entries.

---

### Step 3: Word-Level Absolute Placement + Per-Word Font Selection (`backend/converter/pdf_edit.py`)
1. **No Space Coalescing**: Removed space-coalescing pre-pass in `_emit_layout_manifest`.
2. **Preserve Paragraph Primary Font**: Promoted stand-in fonts act as a per-word supply strictly for missing characters.
3. **Per-Word Emission**: Untouched words render with the original subset font, while novel words render with the promoted stand-in.

---

### Step 4 & 5: True Outline-Measured X-Height Calibration (`backend/converter/font_utils.py` & `backend/converter/pdf_edit.py`)
1. **True Outline X-Height Measurement (`font_utils.py`)**: `xheight_ratio(buf)` measures true glyph outline bounds of character `'x'` via `BoundsPen`.
2. **Robust Primary Buffer Resolution & Logging (`pdf_edit.py`)**: Scaled font size logged via `[SCALE]`.
3. **Manual Tuning Slot (`pdf_edit.py`)**: Defined `MANUAL_SIZE_SCALE = {}`.

---

### Step 6: Emit-Font-Aligned Detection & Per-Run Floor (`backend/converter/pdf_edit.py`)
1. **Probe Emission Font Bytes**: Probes `missing_chars` against `emit_buf` (the emission font's own bytes).
2. **Per-Run Floor in Emitters**: Ensures unrenderable characters are structurally routed to stand-in fonts.

---

### Step 7: First-Bake Equivalence: Per-Run Verified Font Selection (`backend/converter/font_utils.py` & `backend/converter/pdf_edit.py`)
1. **Cached Ink-Probe (`font_utils.py`)**: `_glyph_has_ink` cached via `_INK_CACHE`.
2. **Per-Run Candidate Building & Selection (`pdf_edit.py`)**: `_build_run_candidates` builds a fixed candidate set per family, and `_pick_run_font` selects fonts per-run.

---

### Step 8: Stateless Per-Run Emission + Erase-Rect Clamp (`backend/converter/pdf_edit.py`)
1. **Self-Registration of Probed Run Font**: Each run font selected by `_pick_run_font` self-registers immediately via `_safe_insert_font(page, fn, fbuf, size)` to guarantee probed buffer == emitted name.
2. **Erase-Rect Clamp (Heading Fix)**: Clamps `erase_rect` vertical span (`ey0` to `ey1`) strictly to `manifestBbox` (`float(mb["y0"]) - 4` to `float(mb["y1"]) + 4`), preserving merged headings/lines outside the edit payload (e.g., "CONCLUSION").

---

## Verification & Results

- **Syntax Validation**: `font_utils.py` and `pdf_edit.py` parsed cleanly with exit code 0.
- **Stateless Per-Run Emission**: Self-registration guarantees run font name and buffer agreement.
- **Erase Rect Protection**: Clamping to `manifestBbox` prevents accidental erasure of headings or adjacent unedited text.

---
