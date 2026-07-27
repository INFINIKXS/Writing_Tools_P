import sys
import asyncio
sys.path.insert(0, '.')
from utils.text_extraction import extract_docx_text
from citations.extraction import extract_reference_section, extract_citations_regex
from references.ref_list_verifier import segment_verifier_text_via_llm
from citations.verification import verify_matches_with_string_search

async def main():
    file_path = r"C:\Users\Paradox-Labs\Documents\MY RESEARCH\my writiing\Miracle\Poster project\Powerpoint\1.0 Case Study 1.docx"
    with open(file_path, "rb") as f:
        file_bytes = f.read()
    
    text = extract_docx_text(file_bytes)
    print("Full text length:", len(text))
    
    body, refs_section = extract_reference_section(text)
    print("Body length:", len(body))
    print("References section length:", len(refs_section))
    
    # 1. In-text citations
    citations = extract_citations_regex(body)
    print(f"\nExtracted {len(citations)} citations.")
    prescott_cits = [c for c in citations if "Prescott" in c["text"]]
    print("Prescott citations in body:")
    for c in prescott_cits:
        print(" ", c)
        
    # 2. Extract references via LLM / Fallback
    # Note: Since calling Gemini via API might fail or require keys, let's see if we succeed
    print("\nCalling segment_verifier_text_via_llm...")
    try:
        references = await segment_verifier_text_via_llm(text, is_full_document=True)
        print(f"Extracted {len(references)} references.")
    except Exception as e:
        print("Failed to run segment_verifier_text_via_llm:", e)
        return
        
    prescott_refs = [r for r in references if "Prescott" in r]
    print("\nPrescott references extracted:")
    for r in prescott_refs:
        print(" ", r)
        
    # 3. Verify
    print("\nVerifying...")
    verification = verify_matches_with_string_search([c["text"] for c in citations], references)
    
    print("\nUnmatched citations (sample 10):")
    for uc in verification["unmatched_citations"][:10]:
        print(" ", uc)
        
    print("\nPrescott in unmatched citations?")
    for uc in verification["unmatched_citations"]:
        if "Prescott" in uc:
            print("  YES:", uc)
            
    print("\nConfirmed matches for Prescott:")
    for match in verification["confirmed_matches"]:
        if "Prescott" in match["citation"]:
            print("  Match:", match["citation"], "-->", match["matched_ref"][:100])

if __name__ == "__main__":
    asyncio.run(main())
