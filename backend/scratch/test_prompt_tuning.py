import os
import sys
import io
import asyncio
import json
import logging

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from core.gemini import get_client, gemini_request_with_retry
import moldbank_store
from PyPDF2 import PdfReader

# Configure logging
logging.basicConfig(level=logging.INFO)

pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "188.pdf"))
with open(pdf_path, "rb") as f:
    file_bytes = f.read()

reader = PdfReader(io.BytesIO(file_bytes))
pages_text = []
for page in reader.pages:
    pages_text.append(page.extract_text() or "")

# Preprocess and split sentences
cleaned_pages = [moldbank_store._clean_page_headers_footers(pt, "188.pdf") for pt in pages_text]
full_text = "\n".join(cleaned_pages)
sentences = moldbank_store._split_sentences(full_text)

# We take the first 30 sentences
chunk = sentences[:30]
print(f"Total sentences in chunk: {len(chunk)}")

async def test_tuned_mining():
    numbered = "\n".join(f"{j+1}. {s}" for j, s in enumerate(chunk))
    
    prompt = f"""You are a structural linguistics analyst. Your task is to decompose academic sentences into scaffold + content slots for a Mold Bank used in structural transplant writing.
    
For each sentence below, perform the decomposition and return a JSON array of objects.

Each JSON object in the array must have these exact fields:
- "index": (the sentence number, 1-based)
- "original_sentence": "verbatim original sentence"
- "skeleton": "sentence with 1-5 content slots replaced by [SLOT_1], [SLOT_2], etc."
- "scaffold_words": ["array", "of", "verbatim", "scaffold", "words"]
- "slot_count": (integer count of content slots, between 1 and 5)
- "slot_labels": ["SLOT_1:part_of_speech", "SLOT_2:part_of_speech", ...]
- "scaffold_density": (float between 0.0 and 1.0, representing the fraction of words that are scaffold words)
- "frame_type": "one of: causal | contrastive | concessive | purposive | assertive | speculative | enumerative | attributive | escalation | failure | success | unified-conclusion | competing-alternatives | general"
- "frame_markers": ["specific", "words", "in", "scaffold", "carrying", "the", "frame"]
- "rhetorical_move": "one of: attribution | enumeration | contrast | concession | assertion | definition | comparison | qualification | summation | evidence_claim | process_description"
- "paragraph_function": "one of: topic_sentence | context_setter | elaboration | evidence_presentation | evidence_bridge | evaluation | counter_argument | rebuttal | concession | synthesis | micro_conclusion | transition_bridge"

Rules for Slot Creation & Granularity:
1. Enforce a STRICT limit of 1 to 5 content slots per sentence. DO NOT exceed 5 slots.
2. To stay within the 1-5 slot limit, DO NOT be overly granular. Group complex noun phrases (e.g., "ethnic and social inequalities in women’s experience of maternity care") or verb phrases into a single slot (e.g. "[SLOT_1]:noun_phrase") rather than splitting them into multiple separate slots.
3. Replace ONLY the main thematic variables/concepts that a writer would want to transplant (e.g. key subjects, actions, or outcomes). Keep standard academic nouns, common verbs (e.g., "examine", "show", "suggest", "remain"), and connective structures verbatim in the scaffold.
4. Keep ALL connective tissue verbatim in the scaffold: prepositions, determiners, auxiliaries, conjunctions, fixed phrases.

SENTENCES TO ANALYSE:
{numbered}

Return ONLY a valid JSON array of objects, with no markdown styling, no explanation, and no backticks.
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
    print(f"\nGemini returned {len(parsed)} items.")
    
    accepted = 0
    for item in parsed:
        idx = item.get("index", 0) - 1
        if 0 <= idx < len(chunk):
            sentence_txt = chunk[idx]
            slot_count = item.get("slot_count", 0)
            density = item.get("scaffold_density", 0.0)
            frame = item.get("frame_type", "")
            
            # Apply quality gates
            if slot_count < 1 or slot_count > 5:
                print(f"  [-] Rejected {idx+1} (Slots): count={slot_count}")
                continue
            if density < 0.30:
                print(f"  [-] Rejected {idx+1} (Density): density={density}")
                continue
            if not frame or frame.lower() in ["", "none"]:
                print(f"  [-] Rejected {idx+1} (Frame): frame={frame}")
                continue
                
            accepted += 1
            print(f"  [+] Accepted {idx+1}: {item['skeleton']}")
            print(f"      Original: {sentence_txt}")
            
    print(f"\nAccepted count: {accepted} / {len(chunk)}")

asyncio.run(test_tuned_mining())
