import pypdf
import fitz
from PyPDF2 import PdfReader as PyPDF2Reader
import os

pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "188.pdf"))

print("=== Comparing Spacing Recovery ===")

# Page 1, bottom block contains the Funding section:
# "Development of the survey questionnaire, sampling approach..."

print("\n--- PyPDF2 (Current) ---")
reader2 = PyPDF2Reader(pdf_path)
p1_pdf2 = reader2.pages[0].extract_text()
for line in p1_pdf2.split("\n"):
    if "Funding" in line or "questionnaire" in line or "Ethical" in line:
        print(f"  {repr(line)}")

print("\n--- PyMuPDF (fitz) ---")
doc = fitz.open(pdf_path)
p1_mupdf = doc[0].get_text()
for line in p1_mupdf.split("\n"):
    if "Funding" in line or "questionnaire" in line or "Ethical" in line:
        print(f"  {repr(line)}")

print("\n--- pypdf (modern) ---")
reader_modern = pypdf.PdfReader(pdf_path)
p1_pypdf = reader_modern.pages[0].extract_text()
for line in p1_pypdf.split("\n"):
    if "Funding" in line or "questionnaire" in line or "Ethical" in line:
        print(f"  {repr(line)}")
