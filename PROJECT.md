# Project: PDF Metadata Extraction and Strict Verification Pipeline Improvements

## Architecture
- **Reference Generator Pipeline**: The Writing Tools app extracts metadata from uploaded PDFs (Layer 1: embedded properties, Layer 2: custom regex, Layer 3: pdf2doi, Layer 4: CrossRef, Layer 5: PubMed). It strictly verifies that the metadata belongs to the PDF.
- **Strict Verification Logic**: Matches extracted/AI-parsed metadata against PDF text and API-returned metadata.
- **Target Files**:
  - `backend/references/metadata.py`: Contains `strict_ai_verify_against_pdf`, `hard_verify_against_pdf`, `_validate_api_result`, `sanity_check_api_vs_parsed`.
  - `backend/references/ref_list_verifier.py`: Contains `_compare_authors` and first author surname checks.
  - `backend/citations/verification.py`: Contains `verify_matches_with_string_search`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Exploration & Analysis | Spawning Explorers to identify all normalization, entity decoding, and surname matching issues. | None | PLANNED |
| 2 | Implementation | Spawning Worker to modify metadata.py, ref_list_verifier.py, and verification.py. | M1 | PLANNED |
| 3 | Review and Challenge | Spawning Reviewers and Challengers to verify correctness of normalization and matching. | M2 | PLANNED |
| 4 | Forensic Audit | Spawning Forensic Auditor to ensure no cheating/hardcoding of MILQ-103-205.pdf. | M3 | PLANNED |

## Interface Contracts
- `strict_ai_verify_against_pdf(ai_data: dict, pdf_path: str) -> bool`:
  Aggressively extracts text from first 2 pages of PDF, normalizes both PDF text and metadata fields (accents stripped, HTML entities decoded), and matches all fields.
- `hard_verify_against_pdf(title: str, authors: list, pdf_path: str) -> bool`:
  Normalizes title, author names, and PDF text (accents stripped, HTML entities decoded) before verbatim matching.
- `_compare_authors(user_authors, api_authors) -> dict`:
  Normalizes names and extracts surnames regardless of "Last, First" or "First Last" ordering.

## Code Layout
- `backend/references/metadata.py`
- `backend/references/ref_list_verifier.py`
- `backend/citations/verification.py`
- `backend/test_all_verifier.py`
- `backend/test_batch_direct.py`
