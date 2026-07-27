import sys
sys.path.insert(0, '.')
from references.ref_list_verifier import verify_single_reference
from references.parser import parse_raw_reference_async
import asyncio

async def test_doi():
    # Memon et al. reference string with the problematic DOI
    ref_str = (
        "Memon, M. A., Ting, H., Cheah, J. H., Thurasamy, R., Chuah, F., & Cham, T. H. (2020). "
        "Sample Size for Survey Research: Review and Recommendations. Journal of Applied Structural "
        "Equation Modeling, 4(2), i-xx. https://doi.org/10.47263/JASEM.4(2)01"
    )
    
    print("Testing verify_single_reference with JASEM DOI...")
    result = verify_single_reference(ref_str, style="apa")
    print(f"Verify Result api_verified: {result.get('api_verified')}")
    print(f"Verify Result api_source: {result.get('api_source')}")
    print(f"Verify Result corrections: {result.get('corrections')}")
    
    print("\nTesting parse_raw_reference_async with JASEM DOI...")
    parsed_res = await parse_raw_reference_async(ref_str)
    print(f"Parser Result authors: {parsed_res.get('authors')}")
    print(f"Parser Result title: {parsed_res.get('title')}")
    print(f"Parser Result year: {parsed_res.get('year')}")
    print(f"Parser Result doi: {parsed_res.get('doi')}")

if __name__ == "__main__":
    asyncio.run(test_doi())
