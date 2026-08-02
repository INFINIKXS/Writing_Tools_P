---
archived: 2026-08-02T14:27:03.644147
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Point of Failure 6 Fix (Font Matrix Transformation Normalization)

Implemented font matrix normalization and OpenType `head.unitsPerEm` fallback guards in [`font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py).

## Changes Made

### Backend CFF Stem Extraction Engine ([font_utils.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py))

1. **`FontMatrix` & OpenType `head.unitsPerEm` Normalization**:
   - Updated `get_stem_darkening_ratio` to check `FontMatrix[0]` scale ($1 / a$).
   - Added secondary fallback to OpenType `head.unitsPerEm` table if `FontMatrix` is omitted from the CFF top dictionary.
   - Ensures non-standard 2048-em or condensed font matrices calculate the exact, authentic `stem_vw_ratio` without scale distortion.
