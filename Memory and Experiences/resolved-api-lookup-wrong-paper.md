# Experience: Resolved Wrong Paper Match in API Lookups (PubMed fallback to CrossRef)

**Date**: 2026-06-01
**Tags**: #PubMed #CrossRef #DOISanityCheck #RefVerifier #RefFormatter

## 🔴 Problem
When checking or formatting references with DOIs that contain special characters or parentheses (e.g. `10.47263/JASEM.4(2)01`), PubMed's `esearch` API query parser would get confused by the parenthesis syntax and return a completely unrelated, incorrect paper. 
Because the verifier (`ref_list_verifier.py`) and formatter (`parser.py`) pipelines blindly accepted the PubMed search lookup result, they would overwrite the correct locally-parsed reference metadata with the wrong paper's details.

## 🔄 Attempts
- Tried relying on basic API status codes, but the APIs returned `200 OK` with incorrect search results since they used best-guess logic.

## ✅ Solution
We designed and implemented a lightweight, robust identity validation layer that checks all external API metadata lookup responses before accepting them.

1. **Identity Sanity Check**: Implemented `sanity_check_api_vs_parsed` in [backend/references/metadata.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools/backend/references/metadata.py#L1200):
```python
def sanity_check_api_vs_parsed(parsed: dict, api_metadata: dict) -> bool:
    # ── 1. First author surname comparison ──
    parsed_surname = _norm(_extract_first_surname(parsed.get('authors')))
    api_surname = _norm(_extract_first_surname(api_metadata.get('authors')))
    if parsed_surname and api_surname:
        sim = SequenceMatcher(None, parsed_surname, api_surname).ratio()
        if sim < 0.5:
            signals_failed += 1

    # ── 2. Title comparison ──
    parsed_title = _norm(parsed.get('title', ''))
    api_title = _norm(api_metadata.get('title', ''))
    if parsed_title and api_title and len(parsed_title) > 8:
        sim = SequenceMatcher(None, parsed_title, api_title).ratio()
        if sim < 0.35:
            signals_failed += 1

    # ── 3. Year comparison ──
    # Reject if year difference > 3 years
    
    # ── Decision ──
    # If we checked at least 2 signals and ALL of them failed, reject.
    if signals_checked >= 2 and signals_failed == signals_checked:
        return False
    return True
```

2. **Gated Pipelines**: Applied this sanity gate to both **Reference Verifier** ([ref_list_verifier.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools/backend/references/ref_list_verifier.py#L399)) and **Reference Formatter** ([parser.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools/backend/references/parser.py#L373)):
```python
success = perform_pubmed_lookup(doi, api_metadata, field_sources)
if success:
    if not sanity_check_api_vs_parsed(parsed, api_metadata):
        logger.warning("PubMed result for DOI %s failed sanity check — rejecting.", doi)
        # Reset the bad metadata fields and try CrossRef
        for k in list(api_metadata):
            if k != 'doi':
                api_metadata[k] = None
        field_sources.clear()
        success = False
```

If PubMed's result is rejected (or if PubMed does not index the DOI), the pipelines automatically and gracefully fallback to querying CrossRef, which correctly locates the correct paper metadata.

## 💡 Key Takeaway
Implicit trust in external search API results can lead to silent data corruption; gating API lookups with identity validation against parsed ground truth is critical for robust and correct results.

