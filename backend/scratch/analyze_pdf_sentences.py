import os
import sys
import io
import re

# Force UTF-8 output to avoid encoding errors
sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from PyPDF2 import PdfReader

def analyze_pdf(pdf_path):
    print(f"=== PDF TEXT EXTRACTION ANALYSIS ===")
    print(f"File: {pdf_path}")
    print(f"File size: {os.path.getsize(pdf_path):,} bytes")
    
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    reader = PdfReader(io.BytesIO(file_bytes))
    total_pages = len(reader.pages)
    print(f"Total pages: {total_pages}")
    print()

    # Per-page extraction analysis
    total_chars = 0
    total_words = 0
    empty_pages = 0
    sparse_pages = 0  # fewer than 50 words
    
    print("--- Per-Page Extraction ---")
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ''
        chars = len(text)
        words = len(text.split())
        total_chars += chars
        total_words += words
        
        status = ""
        if chars == 0:
            empty_pages += 1
            status = " [EMPTY - likely image/scan]"
        elif words < 50:
            sparse_pages += 1
            status = " [SPARSE - likely slide/header]"
        
        # Show first 120 chars of each page to see what's being extracted
        preview = text.replace('\n', ' ').strip()[:120]
        print(f"  Page {i+1:3d}: {words:4d} words, {chars:5d} chars{status}")
        if preview:
            print(f"           Preview: {preview}...")
    
    print()
    print(f"--- Summary ---")
    print(f"Total characters: {total_chars:,}")
    print(f"Total words: {total_words:,}")
    print(f"Empty pages (0 chars): {empty_pages}")
    print(f"Sparse pages (<50 words): {sparse_pages}")
    print(f"Content-rich pages (50+ words): {total_pages - empty_pages - sparse_pages}")
    
    # Now test with pdfplumber if available
    try:
        import pdfplumber
        print()
        print("=== COMPARING WITH pdfplumber ===")
        plumber_total_chars = 0
        plumber_total_words = 0
        plumber_empty = 0
        
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ''
                chars = len(text)
                words = len(text.split())
                plumber_total_chars += chars
                plumber_total_words += words
                if chars == 0:
                    plumber_empty += 1
        
        print(f"pdfplumber total chars: {plumber_total_chars:,}")
        print(f"pdfplumber total words: {plumber_total_words:,}")
        print(f"pdfplumber empty pages: {plumber_empty}")
        print(f"Improvement over PyPDF2: {plumber_total_words - total_words:+,} words ({(plumber_total_words/max(total_words,1)-1)*100:+.0f}%)")
    except ImportError:
        print()
        print("[INFO] pdfplumber not installed - skipping comparison")
    
    # Now test with pikepdf+pdfminer (what the app's converter already uses)
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract
        print()
        print("=== COMPARING WITH pdfminer ===")
        pdfminer_text = pdfminer_extract(pdf_path)
        pdfminer_chars = len(pdfminer_text)
        pdfminer_words = len(pdfminer_text.split())
        print(f"pdfminer total chars: {pdfminer_chars:,}")
        print(f"pdfminer total words: {pdfminer_words:,}")
        print(f"Improvement over PyPDF2: {pdfminer_words - total_words:+,} words ({(pdfminer_words/max(total_words,1)-1)*100:+.0f}%)")
    except ImportError:
        print()
        print("[INFO] pdfminer not installed - skipping comparison")
    
    # Now run the actual sentence pipeline
    print()
    print("=== SENTENCE PIPELINE ANALYSIS (with PyPDF2 text) ===")
    import moldbank_store
    nlp = moldbank_store._get_nlp()
    
    full_text = ""
    for page in reader.pages:
        text = page.extract_text() or ''
        full_text += text + "\n"
    
    doc = nlp(full_text)
    
    total_spacy_sents = 0
    passed_sents = []
    rejected_reasons = {
        "too_short": 0,
        "too_long": 0,
        "url_or_doi": 0,
        "ref_citation_line": 0,
        "starts_with_number": 0,
        "too_many_numbers": 0,
        "brackets_citations_remain": 0,
        "caption": 0,
        "no_lowercase": 0,
    }

    for sent in doc.sents:
        total_spacy_sents += 1
        s = sent.text.strip().replace('\n', ' ')
        s = re.sub(r'\s+', ' ', s)
        s_clean = moldbank_store._clean_citations(s)
        
        word_count = len(s_clean.split())
        
        if word_count < 8 or len(s_clean) < 40:
            rejected_reasons["too_short"] += 1
        elif word_count > 60:
            rejected_reasons["too_long"] += 1
        elif re.search(r'https?://|doi\.org|dx\.doi|www\.', s_clean, re.IGNORECASE):
            rejected_reasons["url_or_doi"] += 1
        elif re.search(r'\b(et al\.?|doi|vol\.|pp\.|ed\.|eds\.|no\.|issn)\b', s_clean, re.IGNORECASE):
            rejected_reasons["ref_citation_line"] += 1
        elif re.match(r'^\d+[\.\)]\s', s_clean):
            rejected_reasons["starts_with_number"] += 1
        elif len(re.findall(r'\b\d+\b', s_clean)) > 4:
            rejected_reasons["too_many_numbers"] += 1
        elif re.search(r'\(\w[\w\s,\.]+\d{4}\w*\)|\[\d+\]', s_clean):
            rejected_reasons["brackets_citations_remain"] += 1
        elif re.match(r'^(fig(ure)?|table|appendix|box)[\s\.\d]', s_clean, re.IGNORECASE):
            rejected_reasons["caption"] += 1
        elif not re.search(r'[a-z]{3,}', s_clean):
            rejected_reasons["no_lowercase"] += 1
        else:
            passed_sents.append(s_clean)

    print(f"spaCy sentences: {total_spacy_sents}")
    print(f"Passed filters: {len(passed_sents)}")
    print(f"Rejection breakdown:")
    for reason, count in rejected_reasons.items():
        if count > 0:
            print(f"  - {reason}: {count}")
    
    # Show some samples of short rejects to understand what's being lost
    print()
    print("=== SAMPLE SHORT REJECTS (to see what's being lost) ===")
    count = 0
    for sent in doc.sents:
        s = sent.text.strip().replace('\n', ' ')
        s = re.sub(r'\s+', ' ', s)
        s_clean = moldbank_store._clean_citations(s)
        word_count = len(s_clean.split())
        if 4 <= word_count < 8:
            print(f"  [{word_count}w] {s_clean}")
            count += 1
            if count >= 10:
                break


if __name__ == "__main__":
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
    else:
        # Use the PDF the user uploaded in the last run
        base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        pdf_path = os.path.join(base, "L7+Criticality+2025.pdf")
    
    analyze_pdf(pdf_path)
