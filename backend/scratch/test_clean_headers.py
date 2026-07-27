import fitz
import os
import re
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import moldbank_store
from moldbank_store import _get_nlp, _clean_citations, _is_valid_prose_sentence

pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "188.pdf"))
doc = fitz.open(pdf_path)

def clean_page_headers_footers(text: str, filename: str = "") -> str:
    lines = text.split("\n")
    cleaned_lines = []
    
    # Common header/footer patterns to discard
    # E.g. "DOI 10.1258/jrsm.2010.090460", "J R Soc Med 2010: 103: 188-198", "188"
    patterns = [
        r'^doi\b.*',
        r'^j\s+r\s+soc\s+med\b.*',
        r'^\d+$', # single page number
        r'^research$',
        r'^journal\s+of\s+the\s+royal\s+society\s+of\s+medicine.*',
        # Matches the running header title (roughly)
        r'^ethnic\s+and\s+social\s+inequalities\s+in\s+women.*'
    ]
    
    compiled = [re.compile(p, re.IGNORECASE) for p in patterns]
    
    # Check first 4 and last 4 lines on each page
    total_lines = len(lines)
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
            
        # Is it in the header/footer zone (top 4 or bottom 4 lines)?
        is_boundary = (idx < 4 or idx >= total_lines - 4)
        
        if is_boundary:
            # Check if it matches any pattern
            matched = False
            for r in compiled:
                if r.search(stripped):
                    matched = True
                    break
            if matched:
                print(f"  [STRIPPED] {repr(stripped)}")
                continue
                
        cleaned_lines.append(line)
        
    return "\n".join(cleaned_lines)

print("Processing PDF pages...", flush=True)
cleaned_pages = []
for i in range(len(doc)):
    page_text = doc[i].get_text()
    print(f"\n--- Page {i+1} ---")
    cleaned = clean_page_headers_footers(page_text)
    cleaned_pages.append(cleaned)

full_text = "\n".join(cleaned_pages)
print("\nLoading spaCy...", flush=True)
nlp = _get_nlp()
spacy_doc = nlp(full_text)

accepted = []
rejected = []

for sent in spacy_doc.sents:
    s = sent.text.strip().replace('\n', ' ')
    s = re.sub(r'\s+', ' ', s)
    s_clean = _clean_citations(s)
    
    if _is_valid_prose_sentence(s_clean):
        accepted.append(s_clean)
    else:
        rejected.append(s_clean)

print(f"\nTotal raw sentences: {len(list(spacy_doc.sents))}")
print(f"Accepted: {len(accepted)}")
print(f"Rejected: {len(rejected)}")

print("\n--- First 10 Accepted ---")
for s in accepted[:10]:
    print(f"  * {s}")

print("\n--- First 10 Rejected ---")
for s in rejected[:10]:
    print(f"  * {s}")
