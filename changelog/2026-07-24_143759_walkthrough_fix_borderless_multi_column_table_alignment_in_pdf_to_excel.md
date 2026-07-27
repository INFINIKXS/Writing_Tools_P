---
archived: 2026-07-24T14:37:59.720693
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\917a5a31-4816-4df7-a2f3-5ba3f4593fc5\walkthrough.md
---

# Walkthrough — Fix Borderless Multi-Column Table Alignment in PDF to Excel

We diagnosed and fixed why PDF documents with borderless multi-column layouts (such as `APRIL ROASTER.pdf`) were collapsing into a single vertical column (Column A) when exported to Excel.

## Root Cause Analysis

1. **Missing Vector Gridlines**:
   Standard PDF table extractors (including PyMuPDF's `page.find_tables()` and `pdfplumber.extract_tables()`) search for explicit drawn vector gridlines/borders. Because `APRIL ROASTER.pdf` has visual whitespace columns without explicit drawn lines, standard vector table extractors returned 0 tables.
2. **Fallback Collapse**:
   When 0 vector tables were detected, the system previously fell back to simple reading-order text extraction (`page.get_text("text")`). Reading order processes PDF text top-to-bottom across blocks, dumping headers (`DATE`, `MORNING`, `AFTERNOON`) and content sequentially into Column A.

---

## Solution Implemented

We created a **Spatial Layout Column Clustering Engine** (`_extract_spatial_table_from_fitz_page`) in [`backend/converter/__init__.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/__init__.py#L788):

1. **Vertical Line Grouping**: Clusters text words by vertical `y0` center alignment within a tight threshold (`abs(line_y - word_y0) < 4.5pt`).
2. **Horizontal Column Gutter Detection**: Scans horizontal word gaps (`x1` to next `x0`) across all lines on the page to identify distinct vertical gutters (`col_breaks`).
3. **Spatial Grid Mapping**: Maps each word to its appropriate column index (`col_idx`) based on its `x0` coordinate:
   - **Column A**: `DATE` and date values (`WEDNESDAY 1ST APRIL, 2026`, etc.)
   - **Column B**: `MORNING (8am to 2pm)` and morning staff lists (`SHATIMA, ZAINAB, GLORIA`, etc.)
   - **Column C**: `AFTERNOON (2pm to 7pm)` and afternoon staff lists (`FATIMA, MARIA, SURAYYA`, etc.)

---

## Verification Results

We uploaded `APRIL ROASTER.pdf` to `/api/convert/pdf-to-excel` and verified the generated Excel workbook `APRIL_ROASTER.xlsx`:

```text
=== Sheet: Page_1 ===
Row 1: ['DATE', 'MORNING (8am to 2pm)', 'AFTERNOON (2pm to 7pm)']
Row 2: ['WEDNESDAY 1ST APRIL, 2026', 'SHATIMA, ZAINAB, GLORIA', 'FATIMA, MARIA,SURAYYA']
Row 3: ['THURSDAY 2ND APRIL, 2026', 'SHATIMA, GLORIA', 'SHATIMA, GLORIA, SURAYYA']
Row 4: ['FRIDAY 3RD APRIL, 2026', 'KHALIL, ZAINAB', 'KHALIL, FATIMA, AISHA']
Row 5: ['SATURDAY 4TH APRIL, 2026', 'AMINA, UMAR', 'AISHA, ZAINAB']
Row 6: ['SUNDAY 5TH APRIL, 2026', 'ZAINAB, UMAR', 'MARIA, AMINA']
```

The table now maps to Column A, Column B, and Column C in Excel!
