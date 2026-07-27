"""
Utility script to populate empty example sentences in grammarbank_local_fallback.json using Gemini.
"""
import os
import json
import asyncio
from google import genai
from google.genai import types

# Add parent dir to path if needed
import sys
sys.path.insert(0, os.path.dirname(__file__))

# Import key manager or setup api key
from api_key_manager import get_client

async def generate_example(pattern: str, subcategory: str) -> str:
    """Generate a single premium academic example sentence for a pattern."""
    prompt = f"""You are a senior academic writer and copyeditor.
Generate a single, premium, high-quality, realistic academic or clinical example sentence that naturally uses the following grammatical pattern:
Pattern: "{pattern}"
Subcategory: "{subcategory}"

Rules:
1. The sentence must sound like it was extracted from a high-impact peer-reviewed journal paper (e.g., Nature, NEJM, IEEE).
2. The pattern word/phrase MUST appear exactly as written.
3. Return ONLY the sentence itself. No introductory or explanatory text. No quotation marks around the output.

Example output for pattern "notwithstanding":
Notwithstanding the small sample size, the statistical power remains sufficient to support the primary hypothesis.
"""
    model_name = 'gemini-3.1-flash-lite-preview'
    try:
        client = get_client(model=model_name)
        response = client.models.generate_content(
            model=model_name,
            contents=prompt
        )
        return response.text.strip().strip('"')
    except Exception as e:
        print(f"Error generating example for '{pattern}': {e}")
        return ""

async def main():
    fallback_path = os.path.join(os.path.dirname(__file__), "grammarbank_local_fallback.json")
    if not os.path.exists(fallback_path):
        print(f"Fallback file not found at {fallback_path}")
        return

    with open(fallback_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    empty_items = [item for item in items if not item.get("example") or item["example"].strip() == ""]
    print(f"Found {len(empty_items)} items with empty examples out of {len(items)} total items.")

    if not empty_items:
        print("No empty examples to populate.")
        return

    # Process in batches to respect rate limits
    batch_size = 5
    for i in range(0, len(empty_items), batch_size):
        batch = empty_items[i:i+batch_size]
        print(f"Processing batch {i//batch_size + 1}/{(len(empty_items) + batch_size - 1)//batch_size}...")
        
        tasks = []
        for item in batch:
            tasks.append(generate_example(item["pattern"], item["subcategory"]))
            
        results = await asyncio.gather(*tasks)
        
        for item, example in zip(batch, results):
            if example:
                item["example"] = example
                print(f"✓ '{item['pattern']}' -> '{example}'")
            else:
                print(f"✗ Failed for '{item['pattern']}'")
                
        # Save after each batch
        with open(fallback_path, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2, ensure_ascii=False)
            
        # Pause slightly between batches
        await asyncio.sleep(1.0)

    print("Finished populating empty examples!")

if __name__ == "__main__":
    asyncio.run(main())
