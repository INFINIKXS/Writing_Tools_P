---
archived: 2026-08-07T17:31:49.680532
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\60a5c1f3-7d3a-4ec0-9142-9adc7d41fae0\walkthrough.md
---

# Step 1, 2 & 3 Implementation Walkthrough: Font Metric Corruption & Word-Level Absolute Placement

## Overview

This walkthrough documents the full 3-step solution to baked-font metric corruption, oversized text rendering, and spacing alignment issues in PDF edits.

---

## Key Changes

### Step 1: Synthesis Fixed at Source (`backend/converter/font_utils.py`)
1. **Authoritative hmtx in OTF Wrapper (Hunk 1)**: Replaced `cs.decompile()` in `_synthesize_required_otf_tables` with `cs.draw(pen)` + `getattr(cs, "width")` (the draw-based width extraction). Eliminates divergence between initial wrapping and re-sync.
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
1. **No Space Coalescing**: Removed space-coalescing pre-pass in `_emit_layout_manifest`. Every word and space retains its absolute canvas $x$-coordinate. Inter-word spacing is driven by layout coordinates, not font width metrics.
2. **Preserve Paragraph Primary Font**: Promoted stand-in fonts (e.g. `Libre Baskerville`) act as a per-word supply strictly for missing characters in `resolver`. The primary font for untouched words remains the original embedded font subset.
3. **Per-Word Emission**: Replaced character-by-character emission in `_emit_layout_manifest` with single `page.insert_text` calls per word run. Untouched words render pixel-identically with the original subset font, while novel words render with the promoted stand-in at exact canvas coordinates.

---

## Verification & Results

- **Verification Gate (`verify_step1.py`)**: Passed with 100% assertions green on healthy TTFs and extracted CFF fonts (`HelveticaNeueLTStd-BdCn`).
- **Syntax Checks**: Confirmed clean compilation across `backend/converter/font_utils.py` and `backend/converter/pdf_edit.py`.

---
