# Experience: Resolved PDF Extractor vs Reference Verifier Year Discrepancy
**Date**: 2026-06-01
**Tags**: #FastAPI #BiomedicalMetadata #CrossRef #PubMed #PDFExtraction #Citations

## 🔴 Problem
During direct PDF uploads via the **PDF Metadata Extractor (`/api/extract-reference`)**, some biomedical papers (e.g. `bmjsrh-2021-201413.pdf` by Bosó Pérez) were successfully extracted with **`2022`** as the publication year. However, subsequent validations of reference lists containing these papers via the **Reference Verifier (`/api/verify-reference-list`)** flagged them as a year mismatch, correcting them to **`2023`**.

This year discrepancy was caused by database mismatches between CrossRef and PubMed combined with inconsistent lookup priorities across the two pipelines:
1. The **PDF Extractor** prioritized CrossRef first to support high-speed batch imports, retrieving CrossRef's *Online-First* (Epub) publication date of October **2022**.
2. The **Reference Verifier** prioritized PubMed first to utilize PubMed's structured biomedical journal metadata, retrieving PubMed's final official print-volume publication date of January **2023**.

## 🔄 Attempts
- Verified the local PDF metadata year vs. API results.
- Identified that both APIs are correct in their own database contexts, but the mismatch creates a poor user experience during validation.
- Swapping database query priority inside the PDF extraction pipeline was proposed as the standard fix.

## ✅ Solution
We aligned the lookup priorities in `_extract_metadata_async` in [backend/references/metadata.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools/backend/references/metadata.py#L1350-L1385) to perform **PubMed-first** lookup, falling back to CrossRef:

```python
# ── PubMed first (authoritative print metadata for biomedical journals) ──
def do_pubmed():
    pubmed = pubmed_lookup(candidate_doi)
    if pubmed and _validate_api_result(meta, pubmed, pdf_path):
        return pubmed
    return None
    
pubmed_data = await asyncio.to_thread(do_pubmed)
if pubmed_data:
    _merge(meta, pubmed_data, overwrite=True)
    meta["verification_status"] = "verified_pubmed"
    if "pubmed_verify" not in meta["extraction_layers"]:
        meta["extraction_layers"].append("pubmed_verify")
    logger.info("DOI %s VERIFIED via PubMed.", candidate_doi)
    verified = True
    break
    
# ── CrossRef fallback ──
cr_data = crossref_map.get(candidate_doi)
if cr_data:
    valid = await asyncio.to_thread(_validate_api_result, meta, cr_data, pdf_path)
    if valid:
        _merge(meta, cr_data, overwrite=True)
        meta["verification_status"] = "verified_crossref"
        if "crossref_verify" not in meta["extraction_layers"]:
            meta["extraction_layers"].append("crossref_verify")
        logger.info("DOI %s VERIFIED via CrossRef.", candidate_doi)
        verified = True
        break
```

This ensures that the PDF extractor immediately receives the final print-volume publication year (`2023`) from PubMed, matching the year later fetched by the reference verifier.

## 💡 Key Takeaway
Always align database query priorities and source authority rules across all data-ingestion (extraction) and data-validation (verification) pipelines to prevent runtime discrepancies and year mismatch flags.
