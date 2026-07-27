---
archived: 2026-07-24T14:15:45.772789
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\917a5a31-4816-4df7-a2f3-5ba3f4593fc5\walkthrough.md
---

# Walkthrough — Fix PDF to Excel Conversion

We diagnosed and resolved why the **PDF to Excel** feature was failing when attempting to convert files like `APRIL_ROASTER.pdf`.

## Root Cause Analysis

1. **Fatal Server Startup Crashes**:
   - `backend/pdf_routes/editor.py` imported `ocrmypdf` directly at the top of the file without a `try/except` guard. Because `ocrmypdf` was missing from the server environment, importing `main.py` threw `ModuleNotFoundError: No module named 'ocrmypdf'` on startup, causing the backend API server to crash.
   - `backend/db/supabase_client.py` imported `supabase` without a fallback guard, triggering startup failures when database dependencies were absent.
2. **Dependency Coupling & Shadowing**:
   - `backend/core/config.py` grouped `pdfplumber` and `openpyxl` into a single `try/except` block. Because `pdfplumber` was absent, `openpyxl` was set to `None`.
   - `backend/converter/__init__.py` imported `openpyxl` from `core.config` as `None`, shadowing module-level imports inside `_run_pdf_to_excel_sync` and causing jobs to fail with `No module named 'openpyxl'`.

---

## Fixes Applied

1. **Safeguarded Server Imports**:
   - Updated [`backend/pdf_routes/editor.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/pdf_routes/editor.py#L3) to wrap `ocrmypdf` in a `try/except` block.
   - Updated [`backend/db/supabase_client.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/db/supabase_client.py#L4) to safely handle `supabase` imports.

2. **Upgraded PDF-to-Excel Converter Engine**:
   - Updated [`backend/core/config.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/core/config.py#L53) to detect `openpyxl` independently of `pdfplumber`.
   - Re-engineered `_run_pdf_to_excel_sync` in [`backend/converter/__init__.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/__init__.py#L788):
     - Uses PyMuPDF's (`fitz`) native table recognition engine (`page.find_tables()`) and `openpyxl` to extract tables into sheet tabs per table.
     - Adds fallback table extraction for `pdfplumber`.
     - Adds fallback text/column regex parsing if no visual table borders exist.

---

## Verification Results

- Executed end-to-end API test uploading `APRIL_ROASTER.pdf` to `POST /api/convert/pdf-to-excel`:
  - **Submit Status**: `202 Accepted` (`job_id: 1bf2e007-8dba-4926-9153-435bfbdc6b25`)
  - **Job Execution**: Completed to `JobStatus.DONE`
  - **Download Status**: `200 OK`
  - **Headers Exposed**: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="APRIL_ROASTER.xlsx"`
  - **Generated Output**: Editable Excel workbook `APRIL_ROASTER.xlsx` (4,788 bytes).
