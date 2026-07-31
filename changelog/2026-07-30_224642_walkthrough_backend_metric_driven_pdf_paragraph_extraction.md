---
archived: 2026-07-30T22:46:42.459798
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\3d96f0f9-8628-4d7c-8779-1190c4e268b9\walkthrough.md
---

# Walkthrough: Backend Metric-Driven PDF Paragraph Extraction

We have updated the backend block metadata parser in `backend/pdf_routes/editor.py` to support 100% backend metric-driven paragraph extraction using PyMuPDF `rawdict`.

## Key Changes

### 1. `backend/pdf_routes/editor.py`
Updated `extract_page_spacing_data(page)`:
- Extracted line-level text, bounding box coordinates `[x0, y0, x1, y1]`, `width` (`x1 - x0`), `height` (`y1 - y0`), and `space_count` (`line_text.count(" ")`).
- Attached the exact metric-driven `lines` array objects to each paragraph item:
```python
{
    "text": line_text,
    "bbox": [x0, y0, x1, y1],
    "width": x1 - x0,
    "height": y1 - y0,
    "space_count": space_count
}
```

### 2. `backend/test_challenge_pdf_edit.py`
- Added `test_extract_spacing_block_line_metrics()` to test and verify that block line metric extraction runs cleanly against the `/api/pdf/extract-spacing` API endpoint.
- Validated all 5 tests in `test_challenge_pdf_edit.py`.

---

## Verification Results

### Test Execution (`python backend/test_challenge_pdf_edit.py`)
```
--- RUNNING TEST 1: Plain Text Edit ---
Extracted text raw:
'The fast brown fox jumps over the lazy dog.\n'

--- RUNNING TEST 2: Superscript Same-Text Edit ---
Spans info: [('According to Einstein E=mc', (50.0, 100.0), 12.0), ('2', (190.23199462890625, 96.0), 8.4), (' in relativity.', (194.89999389648438, 100.0), 12.0)]
Superscript span found: True

--- RUNNING TEST 3: Superscript Diff-Text Edit ---
Spans info: [('Reference ', (50.0, 100.0), 12.0), ('1', (105.3479995727539, 96.0), 8.4), (' was cited here recently.', (110.01599884033203, 100.0), 12.0)]
Superscript span found: True

--- RUNNING TEST 4: Paragraph Edit with Lines ---
Extracted paragraph text raw:
'First line of paragraph edit.\nSecond line of paragraph edit.\n'
Paragraph edit with lines passed successfully!

--- RUNNING TEST 5: Extract Spacing Block Line Metrics ---
Verified line metric: text='The quick brown fox', bbox=[50.0, 90.96399688720703, 158.68399047851562, 101.89200592041016], w=108.7, h=10.9, space_count=3
Verified line metric: text='jumps over the lazy dog.', bbox=[50.0, 120.96399688720703, 178.02801513671875, 131.8920135498047], w=128.0, h=10.9, space_count=4
Extract spacing block line metrics test passed successfully!
```
Exit code: **0 (ALL TESTS PASSED)**
