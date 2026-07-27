---
archived: 2026-07-23T13:41:50.961807
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\3fac996e-1c33-477f-9580-ad636a0cabf1\walkthrough.md
---

# Full PDF Tools Suite Walkthrough (Phase 1, Phase 2, & Phase 3 Complete)

## Summary of Complete Implementation

All 24 document conversion tools outlined in the architectural plan are fully implemented, tested, and integrated on both the backend FastAPI server and the frontend React application.

---

### Key Architectural Highlights

1. **100% Async Job Queue Architecture**:
   - Every single converter tool operates on an asynchronous background job pipeline (`_job_store`).
   - File uploads return a `202 Accepted` response with a `job_id` immediately.
   - Long-running tasks execute in a multi-worker `ThreadPoolExecutor` without blocking FastAPI's event loop.
2. **30-Minute Re-download TTL**:
   - Converted files remain accessible at `/api/jobs/{job_id}/download` for 30 minutes (`JOB_TTL_SECONDS = 1800`) before background temp file cleanup.
3. **Preserved Input Filename Rules**:
   - Output files retain the original file's name stem (e.g. `report_pdfa.pdf`, `contract_repaired.pdf`, `page_vs_page2_comparison.pdf`).
4. **Resilient Fallback Engines**:
   - **HTML → PDF**: Uses `WeasyPrint` primary with zero-dependency PyMuPDF `fitz` HTML engine fallback.
   - **Repair PDF**: Structural repair using PyMuPDF clean save + `pikepdf` xref rebuild fallback.
   - **PDF → PDF/A**: ISO archival conversion via Ghostscript CLI + PyMuPDF fallback.

---

### Complete Tool Matrix (24 Endpoints)

| # | Tool Name | Endpoint | Key Feature / Engine | Phase |
|---|---|---|---|---|
| 1 | PDF to Word | `POST /api/convert/pdf-to-word` | Layout preservation + Tesseract OCR | Phase 1 |
| 2 | Word to PDF | `POST /api/convert/word-to-pdf` | LibreOffice `soffice` headless | Phase 1 |
| 3 | PDF to Text | `POST /api/convert/pdf-to-text` | Plaintext extraction + OCR fallback | Phase 1 |
| 4 | Image to PDF | `POST /api/convert/image-to-pdf` | Pillow image binder | Phase 1 |
| 5 | PDF to Images | `POST /api/convert/pdf-to-images` | `pdf2image` + Poppler `.zip` | Phase 1 |
| 6 | Merge PDF | `POST /api/convert/merge-pdf` | Multi-file `pypdf` page joiner | Phase 1 |
| 7 | Split PDF | `POST /api/convert/split-pdf` | Semicolon range groups (`1-3; 4-6`) | Phase 1 |
| 8 | Remove Pages | `POST /api/convert/remove-pages` | Page index removal | Phase 1 |
| 9 | Extract Pages | `POST /api/convert/extract-pages` | Page index filtering | Phase 1 |
| 10 | Organize PDF | `POST /api/convert/organize-pdf` | Custom page reordering | Phase 1 |
| 11 | Compress PDF | `POST /api/convert/compress-pdf` | Stream compression & ratio calculation | Phase 1 |
| 12 | Rotate PDF | `POST /api/convert/rotate-pdf` | 90° / 180° / 270° rotation | Phase 1 |
| 13 | Add Watermark | `POST /api/convert/add-watermark` | PyMuPDF text stamp | Phase 1 |
| 14 | Add Page Numbers | `POST /api/convert/add-page-numbers` | Top / bottom page numbering | Phase 1 |
| 15 | Crop PDF | `POST /api/convert/crop-pdf` | MediaBox margin trimming (in mm) | Phase 1 |
| 16 | Repair PDF | `POST /api/convert/repair-pdf` | PyMuPDF + `pikepdf` fallback | Phase 2 |
| 17 | PDF to PowerPoint | `POST /api/convert/pdf-to-pptx` | 16:9 widescreen `.pptx` slide generator | Phase 2 |
| 18 | PDF to Excel | `POST /api/convert/pdf-to-excel` | `pdfplumber` table extraction to `.xlsx` | Phase 2 |
| 19 | PowerPoint to PDF | `POST /api/convert/pptx-to-pdf` | LibreOffice `.pptx` / `.ppt` / `.odp` | Phase 2 |
| 20 | Excel to PDF | `POST /api/convert/excel-to-pdf` | LibreOffice `.xlsx` / `.xls` / `.csv` | Phase 2 |
| 21 | Flatten PDF Forms | `POST /api/convert/flatten-pdf` | PyMuPDF `doc.bake()` form field baking | Phase 2 |
| 22 | HTML to PDF | `POST /api/convert/html-to-pdf` | `WeasyPrint` + PyMuPDF HTML engine | Phase 3 |
| 23 | PDF to PDF/A | `POST /api/convert/pdf-to-pdfa` | Ghostscript ISO PDF/A compliance | Phase 3 |
| 24 | Compare PDFs | `POST /api/convert/compare-pdf` | PyMuPDF side-by-side comparative PDF | Phase 3 |
