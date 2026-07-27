import os
import sys
import io
import re

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Import functions from moldbank_store
import moldbank_store
from moldbank_store import _split_sentences, _clean_citations, _is_valid_prose_sentence, _get_nlp

pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "188.pdf"))

print(f"Checking PDF: {pdf_path}")
print(f"Exists: {os.path.exists(pdf_path)}")

# 1. PyPDF2 Extraction
try:
    from PyPDF2 import PdfReader as PyPDFReader
    reader = PyPDFReader(pdf_path)
    pypdf2_text = ""
    for page in reader.pages:
        pypdf2_text += (page.extract_text() or "") + "\n"
    print(f"\nPyPDF2 extracted characters: {len(pypdf2_text)}")
    print(f"PyPDF2 extracted words: {len(pypdf2_text.split())}")
except Exception as e:
    print(f"PyPDF2 failed: {e}")
    pypdf2_text = ""

# 2. pypdf (newer) Extraction
try:
    import pypdf
    reader = pypdf.PdfReader(pdf_path)
    pypdf_text = ""
    for page in reader.pages:
        pypdf_text += (page.extract_text() or "") + "\n"
    print(f"\npypdf extracted characters: {len(pypdf_text)}")
    print(f"pypdf extracted words: {len(pypdf_text.split())}")
except Exception as e:
    print(f"pypdf failed: {e}")
    pypdf_text = ""

# 3. PyMuPDF (fitz) Extraction
try:
    import fitz
    doc = fitz.open(pdf_path)
    pymupdf_text = ""
    for page in doc:
        pymupdf_text += page.get_text() + "\n"
    print(f"\nPyMuPDF extracted characters: {len(pymupdf_text)}")
    print(f"PyMuPDF extracted words: {len(pymupdf_text.split())}")
except Exception as e:
    print(f"PyMuPDF failed: {e}")
    pymupdf_text = ""

# Compare sentence splitting on PyPDF2 vs PyMuPDF
def analyze_text(text_name, text):
    if not text:
        return
    nlp = _get_nlp()
    doc = nlp(text)
    
    total_raw_sents = 0
    accepted = []
    rejected_reasons = {
        "too_short_or_long": 0,
        "url_doi": 0,
        "ref_citation_keyword": 0,
        "starts_with_number": 0,
        "too_many_numbers": 0,
        "brackets_citations": 0,
        "figure_caption": 0,
        "no_lowercase": 0
    }
    
    print(f"\n=== Analyzing {text_name} ===")
    for sent in doc.sents:
        total_raw_sents += 1
        s = sent.text.strip().replace('\n', ' ')
        s = re.sub(r'\s+', ' ', s)
        s_clean = _clean_citations(s)
        
        # Manually trace _is_valid_prose_sentence logic
        word_count = len(s_clean.split())
        if word_count < 8 or len(s_clean) < 40:
            rejected_reasons["too_short_or_long"] += 1
            continue
        if word_count > 60:
            rejected_reasons["too_short_or_long"] += 1
            continue
            
        if re.search(r'https?://|doi\.org|dx\.doi|www\.', s_clean, re.IGNORECASE):
            rejected_reasons["url_doi"] += 1
            continue
            
        if re.search(r'\b(et al\.?|doi|vol\.|pp\.|ed\.|eds\.|no\.|issn)\b', s_clean, re.IGNORECASE):
            rejected_reasons["ref_citation_keyword"] += 1
            continue
            
        if re.match(r'^\d+[\.\)]\s', s_clean):
            rejected_reasons["starts_with_number"] += 1
            continue
            
        number_count = len(re.findall(r'\b\d+\b', s_clean))
        if number_count > 4:
            rejected_reasons["too_many_numbers"] += 1
            continue
            
        if re.search(r'\(\w[\w\s,\.]+\d{4}\w*\)|\[\d+\]', s_clean):
            rejected_reasons["brackets_citations"] += 1
            continue
            
        if re.match(r'^(fig(ure)?|table|appendix|box)[\s\.\d]', s_clean, re.IGNORECASE):
            rejected_reasons["figure_caption"] += 1
            continue
            
        if not re.search(r'[a-z]{3,}', s_clean):
            rejected_reasons["no_lowercase"] += 1
            continue
            
        accepted.append(s_clean)
        
    print(f"Total raw sentences: {total_raw_sents}")
    print(f"Valid/Accepted sentences: {len(accepted)}")
    print(f"Rejected count: {total_raw_sents - len(accepted)}")
    print("Rejection reasons breakdown:")
    for reason, count in rejected_reasons.items():
        print(f"  - {reason}: {count}")
        
    print("\nSample accepted sentences (first 5):")
    for s in accepted[:5]:
        print(f"  * {s}")
        
    print("\nSample rejected sentences due to ref_citation_keyword (first 5):")
    ref_rejected = []
    for sent in doc.sents:
        s = sent.text.strip().replace('\n', ' ')
        s = re.sub(r'\s+', ' ', s)
        s_clean = _clean_citations(s)
        if re.search(r'\b(et al\.?|doi|vol\.|pp\.|ed\.|eds\.|no\.|issn)\b', s_clean, re.IGNORECASE):
            ref_rejected.append(s_clean)
    for s in ref_rejected[:5]:
        print(f"  * {s}")

if pypdf2_text:
    analyze_text("PyPDF2", pypdf2_text)
if pypdf_text:
    analyze_text("pypdf (newer)", pypdf_text)
if pymupdf_text:
    analyze_text("PyMuPDF (fitz)", pymupdf_text)
