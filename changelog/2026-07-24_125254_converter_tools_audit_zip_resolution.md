---
archived: 2026-07-24T12:52:54.312052
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\917a5a31-4816-4df7-a2f3-5ba3f4593fc5\walkthrough.md
---

# Converter Tools Audit & ZIP Resolution

We performed a comprehensive audit across all **27 tools** in the document converter module to ensure every tool returns native target files (`.pdf`, `.docx`, `.jpg`, `.webp`, `.png`, `.txt`, `.pptx`, `.xlsx`, `.html`) directly instead of `.zip` archives.

## Audit Findings & Fixes Across All Tools

| Tool ID | Tool Name | Native Single-Output Format | Batch / Multi-File Format | Status |
| :--- | :--- | :--- | :--- | :--- |
| `pdf-to-word` | PDF to Word | `.docx` | N/A | Native `.docx` |
| `word-to-pdf` | Word to PDF | `.pdf` | N/A | Native `.pdf` |
| `pdf-to-text` | PDF to Text | `.txt` | N/A | Native `.txt` |
| `image-to-pdf` | Image to PDF | `.pdf` | Combined `.pdf` | Native `.pdf` |
| `pdf-to-images` | PDF to Images | `.jpg` (1-page PDF) | `.zip` (>1 pages) | **Updated** (1-page PDF returns `.jpg` directly) |
| `merge-pdf` | Merge PDF | `.pdf` | Combined `.pdf` | Native `.pdf` |
| `split-pdf` | Split PDF | `.pdf` (1 output group) | `.zip` (>1 output groups) | **Updated** (1 output group returns `.pdf` directly) |
| `remove-pages` | Remove Pages | `.pdf` | N/A | Native `.pdf` |
| `extract-pages` | Extract Pages | `.pdf` | N/A | Native `.pdf` |
| `organize-pdf` | Organize PDF | `.pdf` | N/A | Native `.pdf` |
| `compress-pdf` | Compress PDF | `.pdf` | N/A | Native `.pdf` |
| `compress-image` | Compress Image | `.jpg`/`.png`/`.webp` | `.zip` (batch upload) | **Updated** (Single file returns image directly) |
| `rotate-pdf` | Rotate PDF | `.pdf` | N/A | Native `.pdf` |
| `add-watermark` | Add Watermark | `.pdf` | N/A | Native `.pdf` |
| `add-page-numbers` | Add Page Numbers | `.pdf` | N/A | Native `.pdf` |
| `crop-pdf` | Crop PDF | `.pdf` | N/A | Native `.pdf` |
| `repair-pdf` | Repair PDF | `.pdf` | N/A | Native `.pdf` |
| `pdf-to-pptx` | PDF to PowerPoint | `.pptx` | N/A | Native `.pptx` |
| `pdf-to-excel` | PDF to Excel | `.xlsx` | N/A | Native `.xlsx` |
| `pptx-to-pdf` | PowerPoint to PDF | `.pdf` | N/A | Native `.pdf` |
| `excel-to-pdf` | Excel to PDF | `.pdf` | N/A | Native `.pdf` |
| `flatten-pdf` | Flatten PDF | `.pdf` | N/A | Native `.pdf` |
| `html-to-pdf` | HTML to PDF | `.pdf` | N/A | Native `.pdf` |
| `pdf-to-html` | PDF to HTML | `.html` | N/A | Native `.html` |
| `text-to-pdf` | Text to PDF | `.pdf` | N/A | Native `.pdf` |
| `pdf-to-pdfa` | PDF to PDF/A | `.pdf` | N/A | Native `.pdf` |
| `compare-pdf` | Compare PDFs | `.pdf` | N/A | Native `.pdf` |

---

## Technical Summary of Fixes

1. **`expose_headers=["*"]` in Backend CORS**: Fixed browser masking of `Content-Disposition` headers so the exact backend file extension (`.pdf`, `.docx`, `.jpg`, `.webp`) is delivered to the browser.
2. **Dynamic Fallback Extension in Frontend**: Replaced hardcoded `.zip` fallback names with dynamic input file name + target output extension.
3. **Smart Single-Output Logic in Backend**:
   - `pdf-to-images`: 1-page PDF returns `.jpg` directly; multi-page PDF returns `.zip`.
   - `split-pdf`: 1-part range split returns `.pdf` directly; multi-part split returns `.zip`.
   - `compress-image`: 1 image upload returns `.jpg`/`.png`/`.webp` directly; multi-image batch upload returns `.zip`.
