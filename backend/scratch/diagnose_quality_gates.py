import os
import sys
import io
import json
import asyncio
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from PyPDF2 import PdfReader
import moldbank_store
from core.gemini import get_client, gemini_request_with_retry

async def diagnose_gates(pdf_path):
    print(f"Diagnosing Quality Gates on: {pdf_path}")
    if not os.path.exists(pdf_path):
        print("Error: File not found")
        return

    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    reader = PdfReader(io.BytesIO(file_bytes))
    full_text = ""
    for page in reader.pages[:10]: # Analyze first 10 pages to save time/tokens
        full_text += (page.extract_text() or '') + "\n"

    # Get split sentences
    sentences = moldbank_store._split_sentences(full_text)
    print(f"Total candidate sentences from split: {len(sentences)}")
    
    # Take a sample of 30 sentences to diagnose
    sample = sentences[:30]
    print(f"Running LLM analysis on sample of {len(sample)} sentences...")

    numbered = "\n".join(f"{j+1}. {s}" for j, s in enumerate(sample))
    prompt = f"""You are a structural linguistics analyst. Decompose each academic sentence below into mold metadata.
Return a valid JSON array of objects. Do not skip any sentence, even if it is bad or complex.

Each JSON object in the array must have:
- "index": (1-based index)
- "original_sentence": "verbatim sentence"
- "skeleton": "sentence with slots like [SLOT_1], etc."
- "scaffold_words": ["array", "of", "words"]
- "slot_count": (integer count of slots)
- "scaffold_density": (float between 0.0 and 1.0)
- "frame_type": "causal | contrastive | concessive | purposive | assertive | speculative | enumerative | attributive | escalation | failure | success | unified-conclusion | competing-alternatives"

SENTENCES:
{numbered}

Return ONLY valid JSON array.
"""
    
    model_name = 'gemini-3.1-flash-lite'
    client = get_client(model=model_name)
    response = await gemini_request_with_retry(client, prompt, model=model_name)
    raw = response.text.strip()

    if raw.startswith('```json'):
        raw = raw[7:].strip()
    if raw.startswith('```'):
        raw = raw[3:].strip()
    if raw.endswith('```'):
        raw = raw[:-3].strip()

    parsed = json.loads(raw)
    
    passed_count = 0
    rejections = []

    for item in parsed:
        idx = item.get("index", 0) - 1
        if 0 <= idx < len(sample):
            sent = sample[idx]
            word_len = len(sent.split())
            slots = item.get("slot_count", 0)
            density = item.get("scaffold_density", 0.0)
            frame = item.get("frame_type", "")
            
            # Normalize density if LLM returned percentage
            if density >= 45.0:
                density = density / 100.0

            reasons = []
            if word_len < 10 or word_len > 50:
                reasons.append(f"Length ({word_len} words, limits: 10-50)")
            if slots < 1 or slots > 4:
                reasons.append(f"Slots ({slots} slots, limits: 1-4)")
            if density < 0.45:
                reasons.append(f"Density ({density:.2f}, limit: >=0.45)")
            if not frame or frame.lower() in ["", "none", "general"]:
                reasons.append(f"Frame ('{frame}', invalid/missing)")

            if not reasons:
                passed_count += 1
                rejections.append({
                    "sentence": sent,
                    "status": "PASSED",
                    "details": f"Len={word_len}, Slots={slots}, Dens={density:.2f}, Frame={frame}"
                })
            else:
                rejections.append({
                    "sentence": sent,
                    "status": "REJECTED",
                    "details": " | ".join(reasons) + f" [Parsed: Len={word_len}, Slots={slots}, Dens={density:.2f}, Frame={frame}]"
                })

    print("\n=== GATE DIAGNOSTIC RESULTS ===")
    print(f"Passed: {passed_count} / {len(sample)}")
    print(f"Rejected: {len(sample) - passed_count} / {len(sample)}")
    print("\nDetailed breakdown:")
    for r in rejections:
        print(f"[{r['status']}] {r['sentence'][:70]}...")
        print(f"      Reason: {r['details']}")

if __name__ == "__main__":
    import asyncio
    pdf_path = "C:\\Users\\Paradox-Labs\\Documents\\Projects\\Writing_Tools\\Critical_Thinking-1.pdf"
    asyncio.run(diagnose_gates(pdf_path))
