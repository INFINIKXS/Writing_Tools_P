---
archived: 2026-07-30T21:59:08.478304
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\61776a9d-cd40-45ac-9030-e58d4e88d8f6\walkthrough.md
---

# PyMuPDF Re-Serialization Ghosting Fix

## Overview
This walkthrough documents the backend updates implemented in `backend/converter/pdf_edit.py` to fix PyMuPDF re-serialization ghosting issues when editing paragraphs in PDF files.

## Key Changes
1. **Payload Plan Processing (`backend/converter/pdf_edit.py`)**:
   - Captured `lines = edit.get("lines", [])` from incoming edit payload objects.
   - Stored `lines` in the edit `plan` dictionary as `plan["lines"] = lines`.

2. **Paragraph Edit Text Formatting (`backend/converter/pdf_edit.py`)**:
   - In paragraph edit detection and processing, checked if `lines` is non-empty.
   - Formatted paragraph text using `paragraph_text = "\n".join(lines)` when `lines` is present, falling back to `new_text` / `plan["paragraph_text"]` when `lines` is empty.

3. **Justified Text Insertion (`backend/converter/pdf_edit.py`)**:
   - Ensured `page.insert_textbox()` is invoked with `align=fitz.TEXT_ALIGN_JUSTIFY` and uses the newline-joined `paragraph_text`.

4. **Testing & Verification (`backend/test_challenge_pdf_edit.py`)**:
   - Added test case `test_apply_edits_paragraph_lines` to `backend/test_challenge_pdf_edit.py`.
   - Verified that redaction, multi-line paragraph re-insertion, plain text editing, and superscript handling pass all test assertions cleanly.

## Verification Results
Ran `python backend/test_challenge_pdf_edit.py` with the following output:
- `--- RUNNING TEST 1: Plain Text Edit ---` -> PASSED
- `--- RUNNING TEST 2: Superscript Same-Text Edit ---` -> PASSED
- `--- RUNNING TEST 3: Superscript Diff-Text Edit ---` -> PASSED
- `--- RUNNING TEST 4: Paragraph Edit with Lines ---` -> PASSED
