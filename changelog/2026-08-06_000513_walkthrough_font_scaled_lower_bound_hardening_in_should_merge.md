---
archived: 2026-08-06T00:05:13.198842
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Walkthrough — Font-Scaled Lower Bound Hardening in `_should_merge`

We have updated the vertical gap check in `_should_merge` (`backend/pdf_routes/editor.py`) to dynamically scale the overlap tolerance floor with font size:

```python
min_font = min(a["font_size"], b["font_size"])
if v_gap < -max(5.0, 0.5 * min_font) or v_gap > max(3.5, 0.6 * min_font):
    return False
```

### Benefits
- **Dynamic Scale**: Ensures dense paragraphs with larger or smaller font sizes dynamically adjust their maximum tolerable vertical overlap floor (`-max(5.0, 0.5 * min_font)`).

---

### Verification
- **Unit Tests**: `test_heal_rect_splits.py` executed 3 tests and passed (`OK`).
- **Archived Walkthrough**: Archived to `changelog/`.
