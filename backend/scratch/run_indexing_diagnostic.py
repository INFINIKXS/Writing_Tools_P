import os
import sys
import io
import re

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import moldbank_store
from PyPDF2 import PdfReader

pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "188.pdf"))
print(f"Reading PDF: {pdf_path}")

with open(pdf_path, "rb") as f:
    file_bytes = f.read()

reader = PdfReader(io.BytesIO(file_bytes))
pages_text = []
for page in reader.pages:
    pages_text.append(page.extract_text() or "")

print(f"Extracted {len(pages_text)} pages.", flush=True)

# Run page boundary cleaning page-by-page
cleaned_pages = []
for idx, page_text in enumerate(pages_text):
    cleaned = moldbank_store._clean_page_headers_footers(page_text, "188.pdf")
    cleaned_pages.append(cleaned)

full_text = "\n".join(cleaned_pages)

# Split sentences
sentences = moldbank_store._split_sentences(full_text)

print(f"\nTotal accepted sentences for ingestion: {len(sentences)}")
print("\nSample accepted sentences (first 25):")
for idx, s in enumerate(sentences[:25]):
    print(f"{idx+1:2d}: {s}")
