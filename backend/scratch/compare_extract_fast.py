import os
import sys
import re

print("Starting comparison script...", flush=True)

# Path to 188.pdf
pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "188.pdf"))
print(f"PDF Path: {pdf_path}", flush=True)
print(f"Exists: {os.path.exists(pdf_path)}", flush=True)

# 1. PyPDF2 Extraction
pypdf2_text = ""
try:
    from PyPDF2 import PdfReader as PyPDFReader
    reader = PyPDFReader(pdf_path)
    print(f"PyPDF2 Reader initialized. Pages: {len(reader.pages)}", flush=True)
    for i, page in enumerate(reader.pages):
        txt = page.extract_text() or ""
        print(f"PyPDF2 Page {i+1} character count: {len(txt)}", flush=True)
        pypdf2_text += txt + "\n"
    print(f"PyPDF2 total characters: {len(pypdf2_text)}, words: {len(pypdf2_text.split())}", flush=True)
except Exception as e:
    print(f"PyPDF2 failed: {e}", flush=True)

# 2. pypdf (newer version) Extraction
pypdf_text = ""
try:
    import pypdf
    reader = pypdf.PdfReader(pdf_path)
    print(f"pypdf Reader initialized. Pages: {len(reader.pages)}", flush=True)
    for i, page in enumerate(reader.pages):
        txt = page.extract_text() or ""
        print(f"pypdf Page {i+1} character count: {len(txt)}", flush=True)
        pypdf_text += txt + "\n"
    print(f"pypdf total characters: {len(pypdf_text)}, words: {len(pypdf_text.split())}", flush=True)
except Exception as e:
    print(f"pypdf failed: {e}", flush=True)

# 3. PyMuPDF (fitz) Extraction
pymupdf_text = ""
try:
    import fitz
    doc = fitz.open(pdf_path)
    print(f"PyMuPDF initialized. Pages: {len(doc)}", flush=True)
    for i in range(len(doc)):
        page = doc[i]
        txt = page.get_text() or ""
        print(f"PyMuPDF Page {i+1} character count: {len(txt)}", flush=True)
        pymupdf_text += txt + "\n"
    print(f"PyMuPDF total characters: {len(pymupdf_text)}, words: {len(pymupdf_text.split())}", flush=True)
except Exception as e:
    print(f"PyMuPDF failed: {e}", flush=True)

# Check spaCy and sentence slicing
print("Loading spaCy...", flush=True)
try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    print("spaCy en_core_web_sm loaded successfully!", flush=True)
    
    # Analyze PyPDF2 text
    if pypdf2_text:
        doc_pypdf2 = nlp(pypdf2_text)
        print(f"PyPDF2 spaCy raw sentences: {len(list(doc_pypdf2.sents))}", flush=True)
        
    # Analyze PyMuPDF text
    if pymupdf_text:
        doc_pymupdf = nlp(pymupdf_text)
        print(f"PyMuPDF spaCy raw sentences: {len(list(doc_pymupdf.sents))}", flush=True)
        
        # Let's inspect some sentences from PyMuPDF to see why they get rejected
        print("\n--- Sample raw sentences from PyMuPDF (first 20) ---", flush=True)
        sents = list(doc_pymupdf.sents)
        for idx, sent in enumerate(sents[:20]):
            print(f"{idx+1}: {repr(sent.text.strip())}", flush=True)
            
except Exception as e:
    print(f"spaCy failed: {e}", flush=True)

print("Finished!", flush=True)
