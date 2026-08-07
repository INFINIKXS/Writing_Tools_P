---
archived: 2026-08-06T00:49:48.995892
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Walkthrough — Root-Cause CFF Font Wrapper Name Capping & Probe Loop

We have updated `wrap_cff_in_otf` in [`converter/font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py) with font-name stability hardening:

1. **24-Character Name Capping**
   - Caps canonical font names at 24 characters (`if len(bare) > 24: bare = bare[:24]`).
   - Accommodates MuPDF's 31-byte internal `/BaseFont` buffer limit after `doc.subset_fonts()` prepends the 7-byte `ABCDEF+` tag (`7 + 24 <= 31`).

2. **Bare-Only Name Tables & Unconditional CFF Naming**
   - Writes bare-only records to `name` table (omitting subfamily records `nid=2` and `nid=17`) to prevent `" Regular"` composition.
   - Sets CFF Top DICT names unconditionally.

3. **Self-Correcting Probe Loop (`_probe_wrapped_name`)**
   - Probes the generated OTF buffer using `fitz.Font(fontbuffer=out_bytes)`.
   - Automatically rewrites name sources if a mismatch is detected, logging `Wrapped OTF font name sanity check ✓: '...'`.

---

### Verification
- **Unit Tests**: `test_heal_rect_splits.py` executed 3 tests and passed (`OK`).
- **Archived Walkthrough**: Saved to `changelog/`.
